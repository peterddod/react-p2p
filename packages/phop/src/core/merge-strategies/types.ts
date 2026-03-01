import type { JSONSerializable } from '../../types';

export type MergeMeta = Record<string, JSONSerializable>;

/**
 * The full context passed to a strategy's `connect` method.
 *
 * Gives the strategy everything it needs to participate in state sync:
 * read current state, send/receive messages, react to peer changes, and
 * commit a new state value back into React when ready.
 */
export interface StrategyContext<
  TState extends JSONSerializable = JSONSerializable,
  TMeta extends MergeMeta = MergeMeta,
> {
  /** The local peer's ID. */
  peerId: string;
  /** Returns the current list of all peers in the room (including self). */
  getPeers(): string[];
  /** Returns the current committed state value. */
  getState(): TState | null;
  /** Returns the current committed metadata. */
  getMeta(): TMeta;
  /** Sends a message to all connected peers. */
  broadcast(data: JSONSerializable): void;
  /** Sends a message to a specific peer. */
  sendToPeer(peerId: string, data: JSONSerializable): void;
  /**
   * Subscribes to all incoming messages for this state key.
   * Returns an unsubscribe function.
   */
  onMessage(handler: (data: JSONSerializable, senderId: string) => void): () => void;
  /**
   * Subscribes to peer list changes.
   * Returns an unsubscribe function.
   */
  onPeersChanged(handler: (peers: string[]) => void): () => void;
  /**
   * Subscribes to new peer data-channel connections.
   * Returns an unsubscribe function.
   */
  onPeerConnected(handler: (remotePeerId: string) => void): () => void;
  /**
   * Called by the strategy when it has determined a new state value.
   * Triggers a React state update in `useSharedState`.
   */
  commit(state: TState | null, meta: TMeta): void;
  /**
   * Called by the strategy when the local peer calls setState.
   * The strategy decides what to do with the new value (e.g. broadcast
   * immediately for simple strategies, or start a consensus round).
   */
  onLocalWrite(handler: (state: TState | null) => void): () => void;
}

/**
 * A merge strategy controls all state synchronisation behaviour for a
 * `useSharedState` instance.
 *
 * The strategy receives a `StrategyContext` via `connect()` on mount and
 * uses it to subscribe to messages, commit new state, and react to peer
 * changes. `connect()` must return a cleanup function that unsubscribes all
 * listeners when the hook unmounts.
 *
 * Simple strategies (e.g. Lamport, LWW) subscribe to `onMessage`, run their
 * merge logic, and call `ctx.commit()` when the incoming state wins.
 * Complex strategies (e.g. consensus) can run multi-round protocols and
 * call `ctx.commit()` only once the round is complete.
 */
export interface MergeStrategy<
  TState extends JSONSerializable = JSONSerializable,
  TMeta extends MergeMeta = MergeMeta,
> {
  /** Initial metadata before any sync or update. */
  initialMeta: TMeta;

  /**
   * Called once when the hook mounts. The strategy subscribes to context
   * events here and returns a cleanup function.
   */
  connect(context: StrategyContext<TState, TMeta>): () => void;
}
