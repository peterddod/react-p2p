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
} from '../core/merge-strategies';
import { SharedStateController } from '../core/SharedStateController';
import type { JSONSerializable } from '../types';
import { useRoom } from './useRoom';

type SetStateAction<TState> = TState | ((prev: TState) => TState);

/**
 * A hook that allows you to share state between multiple peers.
 *
 * Works hostlessly by:
 *
 * - Broadcasting updates to all peers under the given key; everyone keeps the
 *   causally latest state according to a Lamport logical clock.
 * - Late joiners: when a data channel opens to a new peer, both sides push
 *   their current state to each other; the merge strategy keeps the winner.
 *
 * @param key - A string key that namespaces this shared state slice. Multiple calls with the same key share state; different keys are independent.
 * @param initialState - The initial state of the shared state (used only before any sync or update).
 * @returns A tuple containing the current state and a function to update the state.
 */
export function useSharedState<TState extends JSONSerializable>(
  key: string,
  initialState: TState | null
): [state: TState | null, setState: (next: SetStateAction<TState | null>) => void];

/**
 * A hook that allows you to share state between multiple peers with a custom merge strategy.
 *
 * @param key - A string key that namespaces this shared state slice.
 * @param initialState - The initial state (used only before any sync or update).
 * @param strategy - A merge strategy controlling how incoming state is reconciled.
 * @returns A tuple containing the current state and a function to update the state.
 */
export function useSharedState<TState extends JSONSerializable, TMeta extends MergeMeta>(
  key: string,
  initialState: TState | null,
  strategy: MergeStrategy<TState, TMeta>
): [state: TState | null, setState: (next: SetStateAction<TState | null>) => void];

export function useSharedState<
  TState extends JSONSerializable,
  TMeta extends MergeMeta = LamportMeta,
>(
  key: string,
  initialState: TState | null,
  strategy?: MergeStrategy<TState, TMeta>
): [state: TState | null, setState: (next: SetStateAction<TState | null>) => void] {
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
  const peerIdRef = useRef(room.peerId);
  peerIdRef.current = room.peerId;

  const lamportStrategyRef = useRef<MergeStrategy<JSONSerializable, LamportMeta>>(
    createLamportStrategy(() => peerIdRef.current)
  );

  const effectiveStrategy: MergeStrategy<TState, TMeta> =
    strategy !== undefined
      ? strategy
      : (lamportStrategyRef.current as unknown as MergeStrategy<TState, TMeta>);

  const controllerRef = useRef<SharedStateController<TState, TMeta> | null>(null);
  const pendingDestroyRef = useRef<SharedStateController<TState, TMeta> | null>(null);

  // Create / recreate controller when key or strategy changes.
  // We track prev values to detect changes and destroy the old controller.
  const prevKeyRef = useRef(key);
  const prevStrategyRef = useRef(effectiveStrategy);

  if (
    controllerRef.current === null ||
    prevKeyRef.current !== key ||
    prevStrategyRef.current !== effectiveStrategy
  ) {
    pendingDestroyRef.current = controllerRef.current;
    controllerRef.current = new SharedStateController(
      key,
      initialState,
      effectiveStrategy,
      roomHandle
    );
    prevKeyRef.current = key;
    prevStrategyRef.current = effectiveStrategy;
  }

  const controller = controllerRef.current;

  // Keep controller room bindings in an effect to avoid render-phase side effects.
  useLayoutEffect(() => {
    pendingDestroyRef.current?.destroy();
    pendingDestroyRef.current = null;
    controller.start();
    controller.syncRoom(roomHandle);
  }, [controller, roomHandle]);

  // Destroy controller on unmount.
  useEffect(() => {
    return () => {
      pendingDestroyRef.current?.destroy();
      pendingDestroyRef.current = null;
      controllerRef.current?.destroy();
      controllerRef.current = null;
    };
  }, []);

  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getState,
    controller.getState
  );

  const setState = useCallback((next: SetStateAction<TState | null>): void => {
    controllerRef.current?.setState(next);
  }, []);

  return [state, setState];
}
