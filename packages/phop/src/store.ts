import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';
import {
  createLamportStrategy,
  type LamportMeta,
  type MergeMeta,
  type MergeStrategy,
} from './core/merge-strategies';
import { type RoomHandle, SharedStateController } from './core/SharedStateController';
import { useRoom } from './hooks/useRoom';
import type { JSONSerializable } from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SetState<T> = (partial: Partial<T> | ((prev: T) => Partial<T>)) => void;

type GetState<T> = () => T;

type StoreInitializer<T> = (set: SetState<T>, get: GetState<T>) => T;

interface SharedStoreOptionsWithPartialize<
  T,
  TSynced extends JSONSerializable,
  TMeta extends MergeMeta,
> {
  partialize: (state: T) => TSynced;
  strategy?: MergeStrategy<TSynced, TMeta>;
}

interface SharedStoreOptionsBase<TMeta extends MergeMeta> {
  strategy?: MergeStrategy<JSONSerializable, TMeta>;
}

/**
 * Internal descriptor — always stores the optional partialize/strategy.
 */
interface SharedStoreDescriptor<T, TMeta extends MergeMeta> {
  key: string;
  initializer: StoreInitializer<T>;
  partialize?: (state: T) => JSONSerializable;
  strategy?: MergeStrategy<JSONSerializable, TMeta>;
}

type EqualityFn<T> = (a: T, b: T) => boolean;

/**
 * A hook returned by `createSharedStore`. Call inside a `<Room>` to bind the
 * store to the current room context. Supports an optional selector for
 * fine-grained re-renders.
 */
interface UseSharedStore<T> {
  (): T;
  <U>(selector: (state: T) => U, equalityFn?: EqualityFn<U>): U;
}

interface StoreRegistryEntry<T, TMeta extends MergeMeta> {
  instance: StoreInstance<T, TMeta>;
  refCount: number;
}

type StoreRegistry = Map<string, StoreRegistryEntry<unknown, MergeMeta>>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Default partialize: strips function-valued properties so the remainder
 * is safe to send over the wire as JSON. Used automatically when no
 * explicit `partialize` option is provided.
 */
function stripFunctions(obj: unknown): JSONSerializable {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    return obj as JSONSerializable;
  }
  const result: Record<string, JSONSerializable> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v !== 'function') {
      result[k] = v as JSONSerializable;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Internal: per-room store instance
// ---------------------------------------------------------------------------

class StoreInstance<T, TMeta extends MergeMeta> {
  private state: T;
  private readonly controller: SharedStateController<JSONSerializable, TMeta>;
  private readonly listeners = new Set<() => void>();
  private readonly partialize: (state: T) => JSONSerializable;

  constructor(
    descriptor: SharedStoreDescriptor<T, TMeta>,
    room: RoomHandle,
    strategy: MergeStrategy<JSONSerializable, TMeta>
  ) {
    this.partialize = descriptor.partialize ?? stripFunctions;

    const set: SetState<T> = (partial) => {
      const currentState = this.state;
      const nextPartial =
        typeof partial === 'function'
          ? (partial as (prev: T) => Partial<T>)(currentState)
          : partial;
      const nextState = { ...currentState, ...nextPartial } as T;
      this.state = nextState;
      this.notify();
      this.controller.setState(this.partialize(nextState));
    };

    const get: GetState<T> = () => this.state;

    this.state = descriptor.initializer(set, get);

    const initialSynced = this.partialize(this.state);

    this.controller = new SharedStateController<JSONSerializable, TMeta>(
      descriptor.key,
      initialSynced,
      strategy,
      room
    );

    // When the controller commits (remote update), merge the synced slice
    // back into the full store state, preserving non-synced fields (e.g.
    // action functions) from the current state.
    this.controller.subscribe(() => {
      const synced = this.controller.getState();
      if (synced !== null) {
        this.state = Object.assign({}, this.state, synced) as T;
        this.notify();
      }
    });
  }

  getState = (): T => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  syncRoom(room: RoomHandle): void {
    this.controller.syncRoom(room);
  }

  destroy(): void {
    this.controller.destroy();
    this.listeners.clear();
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Define a shared P2P store at module scope. Returns a React hook that, when
 * called inside a `<Room>`, binds the store to the current room context.
 *
 * Function-valued properties (actions) are automatically stripped before
 * syncing over the wire, and preserved locally on remote updates. Provide
 * an explicit `partialize` option for fine-grained control over the synced
 * slice.
 *
 * API mirrors Zustand's `create`:
 *
 * ```ts
 * const useCounterStore = createSharedStore('counter', (set) => ({
 *   count: 0,
 *   increment: () => set((s) => ({ count: s.count + 1 })),
 * }));
 *
 * function Counter() {
 *   const count = useCounterStore((s) => s.count);
 *   const increment = useCounterStore((s) => s.increment);
 *   return <button onClick={increment}>Count: {count}</button>;
 * }
 * ```
 */
export function createSharedStore<
  T,
  TSynced extends JSONSerializable,
  TMeta extends MergeMeta = LamportMeta,
>(
  key: string,
  initializer: StoreInitializer<T>,
  options: SharedStoreOptionsWithPartialize<T, TSynced, TMeta>
): UseSharedStore<T>;

export function createSharedStore<T, TMeta extends MergeMeta = LamportMeta>(
  key: string,
  initializer: StoreInitializer<T>,
  options?: SharedStoreOptionsBase<TMeta>
): UseSharedStore<T>;

export function createSharedStore<T, TMeta extends MergeMeta = LamportMeta>(
  key: string,
  initializer: StoreInitializer<T>,
  options?: {
    partialize?: (state: T) => JSONSerializable;
    strategy?: MergeStrategy<JSONSerializable, TMeta>;
  }
): UseSharedStore<T> {
  const descriptor: SharedStoreDescriptor<T, TMeta> = {
    key,
    initializer,
    partialize: options?.partialize,
    strategy: options?.strategy,
  };

  function useSharedStore(): T;
  function useSharedStore<U>(selector: (state: T) => U, equalityFn?: EqualityFn<U>): U;
  function useSharedStore<U>(selector?: (state: T) => U, equalityFn?: EqualityFn<U>): T | U {
    const room = useRoom();
    const roomHandle = useMemo(
      () => ({
        peerId: room.peerId,
        peers: room.peers,
        broadcast: room.broadcast,
        sendToPeer: room.sendToPeer,
        onMessage: room.onMessage,
        onPeerConnected: room.onPeerConnected,
      }),
      [room]
    );
    const localRegistryRef = useRef<StoreRegistry | null>(null);

    const peerIdRef = useRef(room.peerId);
    peerIdRef.current = room.peerId;

    const lamportRef = useRef<MergeStrategy<JSONSerializable, LamportMeta>>(
      createLamportStrategy(() => peerIdRef.current)
    );

    const effectiveStrategy = (descriptor.strategy ?? lamportRef.current) as MergeStrategy<
      JSONSerializable,
      TMeta
    >;

    if (localRegistryRef.current === null) {
      localRegistryRef.current = new Map();
    }

    const registry = (room.__internalStoreRegistry ??
      localRegistryRef.current) as unknown as StoreRegistry;
    const registryKey = `shared-store:${descriptor.key}`;

    let entry = registry.get(registryKey) as StoreRegistryEntry<T, TMeta> | undefined;
    if (!entry) {
      entry = {
        instance: new StoreInstance(descriptor, roomHandle, effectiveStrategy),
        refCount: 0,
      };
      registry.set(registryKey, entry as unknown as StoreRegistryEntry<unknown, MergeMeta>);
    }

    const instance = entry.instance;

    // Keep room bindings fresh outside render to preserve hook purity.
    useLayoutEffect(() => {
      instance.syncRoom(roomHandle);
    }, [instance, roomHandle]);

    useEffect(() => {
      entry.refCount += 1;

      return () => {
        entry.refCount -= 1;
        if (entry.refCount === 0) {
          entry.instance.destroy();
          if (
            registry.get(registryKey) ===
            (entry as unknown as StoreRegistryEntry<unknown, MergeMeta>)
          ) {
            registry.delete(registryKey);
          }
        }
      };
    }, [entry, registry, registryKey]);

    const subscribe = instance.subscribe;
    const getStateSnapshot = instance.getState;
    const selectorRef = useRef<typeof selector>(selector);
    selectorRef.current = selector;
    const equalityFnRef = useRef<typeof equalityFn>(equalityFn);
    equalityFnRef.current = equalityFn;
    const hasSelectionRef = useRef(false);
    const selectedRef = useRef<U | undefined>(undefined);

    const getSnapshot = useCallback((): T | U => {
      const state = getStateSnapshot();
      const currentSelector = selectorRef.current;
      if (!currentSelector) {
        hasSelectionRef.current = false;
        return state;
      }

      const next = currentSelector(state);
      if (hasSelectionRef.current) {
        const prev = selectedRef.current as U;
        const equal = equalityFnRef.current ? equalityFnRef.current(prev, next) : prev === next;
        if (equal) return prev;
      }

      hasSelectionRef.current = true;
      selectedRef.current = next;
      return next;
    }, [getStateSnapshot]);

    const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
    return snapshot as T | U;
  }

  return useSharedStore as UseSharedStore<T>;
}
