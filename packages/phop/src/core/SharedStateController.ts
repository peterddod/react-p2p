import type { JSONSerializable, Message, MessageHandler } from '../types';
import type { MergeMeta, MergeStrategy, StrategyContext } from './merge-strategies/types';
import { isSharedStatePayload, isStateRequest } from './shared-state-protocol';

/**
 * Subset of RoomContextValue that the controller needs. Using a narrow
 * interface avoids coupling the controller to React context directly.
 */
export interface RoomHandle {
  peerId: string;
  peers: string[];
  broadcast: <TData extends JSONSerializable = JSONSerializable>(message: Message<TData>) => void;
  sendToPeer: <TData extends JSONSerializable = JSONSerializable>(
    peerId: string,
    message: Message<TData>
  ) => void;
  onMessage: <TData extends JSONSerializable = JSONSerializable>(
    handler: MessageHandler<TData>
  ) => () => void;
  onPeerConnected: (handler: (remotePeerId: string) => void) => () => void;
}

type Listener = () => void;
type SetStateAction<TState> = TState | ((prev: TState) => TState);

/**
 * Manages the full lifecycle of a single shared-state key: strategy
 * connection, message dispatch, state-request handling, and subscriber
 * notification. Framework-agnostic — React binding happens in the hook layer.
 */
export class SharedStateController<
  TState extends JSONSerializable = JSONSerializable,
  TMeta extends MergeMeta = MergeMeta,
> {
  private state: TState | null;
  private meta: TMeta;
  private readonly key: string;
  private readonly strategy: MergeStrategy<TState, TMeta>;

  // Mutable room fields, updated via syncRoom().
  private peerId = '';
  private peers: string[] = [];
  private broadcast!: RoomHandle['broadcast'];
  private sendToPeer!: RoomHandle['sendToPeer'];
  private onMessage!: RoomHandle['onMessage'];
  private onPeerConnected!: RoomHandle['onPeerConnected'];

  // Strategy handler sets.
  private readonly localWriteHandlers = new Set<(state: TState | null) => void>();
  private readonly messageHandlers = new Set<(data: JSONSerializable, senderId: string) => void>();
  private readonly peersChangedHandlers = new Set<(peers: string[]) => void>();

  // External subscribers (useSyncExternalStore / store API).
  private readonly listeners = new Set<Listener>();

  private strategyCleanup: (() => void) | null = null;
  private messageUnsubscribe: (() => void) | null = null;
  private destroyed = false;

  constructor(
    key: string,
    initialState: TState | null,
    strategy: MergeStrategy<TState, TMeta>,
    room: RoomHandle
  ) {
    this.key = key;
    this.state = initialState;
    this.meta = strategy.initialMeta;
    this.strategy = strategy;

    this.applyRoom(room);
    this.connectStrategy();
    this.subscribeToMessages();
  }

  // -------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------

  getState = (): TState | null => this.state;

  getMeta = (): TMeta => this.meta;

  setState = (next: SetStateAction<TState | null>): void => {
    const resolved =
      typeof next === 'function'
        ? (next as (prev: TState | null) => TState | null)(this.state)
        : next;
    for (const handler of this.localWriteHandlers) {
      handler(resolved);
    }
  };

  /**
   * Subscribe to state changes. Returns an unsubscribe function.
   * Compatible with `useSyncExternalStore`.
   */
  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /**
   * Push latest room fields into the controller. Call on every render
   * so the strategy always sees current values without re-subscription.
   */
  syncRoom(room: RoomHandle): void {
    const prevPeers = this.peers;

    this.applyRoom(room);

    if (prevPeers !== room.peers) {
      for (const handler of this.peersChangedHandlers) {
        handler(room.peers);
      }
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.strategyCleanup?.();
    this.messageUnsubscribe?.();
    this.localWriteHandlers.clear();
    this.messageHandlers.clear();
    this.peersChangedHandlers.clear();
    this.listeners.clear();
  }

  // -------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------

  private applyRoom(room: RoomHandle): void {
    this.peerId = room.peerId;
    this.peers = room.peers;
    this.broadcast = room.broadcast;
    this.sendToPeer = room.sendToPeer;
    this.onMessage = room.onMessage;
    this.onPeerConnected = room.onPeerConnected;
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  private connectStrategy(): void {
    // Arrow methods on `this` close over the instance, but the peerId
    // getter on StrategyContext must be a plain property accessor — capture
    // `this` so the object-literal getter can reach it.
    const self = this;

    const ctx: StrategyContext<TState, TMeta> = {
      get peerId() {
        return self.peerId;
      },
      getPeers: () => this.peers,
      getState: () => this.state,
      getMeta: () => this.meta,

      broadcast: (data) => {
        if (typeof data !== 'object' || data === null || Array.isArray(data)) {
          throw new Error('ctx.broadcast: data must be a plain object');
        }
        this.broadcast({
          senderId: this.peerId,
          data: { ...(data as Record<string, JSONSerializable>), key: this.key },
          timestamp: Date.now(),
        });
      },

      sendToPeer: (targetPeerId, data) => {
        if (typeof data !== 'object' || data === null || Array.isArray(data)) {
          throw new Error('ctx.sendToPeer: data must be a plain object');
        }
        this.sendToPeer(targetPeerId, {
          senderId: this.peerId,
          data: { ...(data as Record<string, JSONSerializable>), key: this.key },
          timestamp: Date.now(),
        });
      },

      onMessage: (handler) => {
        this.messageHandlers.add(handler);
        return () => {
          this.messageHandlers.delete(handler);
        };
      },

      onPeersChanged: (handler) => {
        this.peersChangedHandlers.add(handler);
        return () => {
          this.peersChangedHandlers.delete(handler);
        };
      },

      onPeerConnected: (handler) => {
        return this.onPeerConnected(handler);
      },

      commit: (state, meta) => {
        this.state = state;
        this.meta = meta;
        this.notify();
      },

      onLocalWrite: (handler) => {
        this.localWriteHandlers.add(handler);
        return () => {
          this.localWriteHandlers.delete(handler);
        };
      },
    };

    this.strategyCleanup = this.strategy.connect(ctx);
  }

  private subscribeToMessages(): void {
    this.messageUnsubscribe = this.onMessage(({ senderId, data }) => {
      if (senderId === this.peerId) return;

      if (isStateRequest(data)) {
        if (data.key === this.key) {
          this.sendToPeer(senderId, {
            senderId: this.peerId,
            data: {
              key: this.key,
              state: this.state,
              meta: this.meta,
            } as JSONSerializable,
            timestamp: Date.now(),
          });
        }
        return;
      }

      if (typeof data !== 'object' || data === null) return;
      const keyed = data as Record<string, JSONSerializable>;
      if (keyed.key !== this.key) return;

      // For standard state payloads strip the namespace key before forwarding
      // so strategies receive a consistent { state, meta } shape. For other
      // keyed protocol messages (e.g. consensus rounds) forward the full
      // payload so strategies can dispatch on their own message type field.
      const forwarded: JSONSerializable = isSharedStatePayload(data)
        ? ({ state: data.state, meta: data.meta } as JSONSerializable)
        : (keyed as JSONSerializable);

      for (const handler of this.messageHandlers) {
        handler(forwarded, senderId);
      }
    });
  }
}
