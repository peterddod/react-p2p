import { useCallback, useEffect, useRef, useState } from 'react';
import { useRoom } from '..';
import { JSONSerializable } from '../context/Room';

export type MergeMeta = Record<string, JSONSerializable>;

export interface MergeStrategy<
  TState extends JSONSerializable = JSONSerializable,
  TMeta extends MergeMeta = MergeMeta,
> {
  /** Produce meta when this peer sets state (e.g. timestamp, version). */
  createMeta(): TMeta;

  /**
   * Decide how to merge incoming state with current.
   * Return new { state, meta } to apply, or null to keep current.
   */
  merge(
    currentState: TState | null,
    currentMeta: TMeta,
    incomingState: TState | null,
    incomingMeta: TMeta,
    senderId: string
  ): { state: TState | null; meta: TMeta } | null;
}

type SharedStatePayload<TState extends JSONSerializable, TMeta extends MergeMeta = MergeMeta> = {
  key: string;
  state: TState | null;
  meta: TMeta;
};

type StateRequestPayload = {
  type: 'state-request';
  key: string;
};

function isStateRequest(
  data: SharedStatePayload<JSONSerializable> | StateRequestPayload
): data is StateRequestPayload {
  return typeof data === 'object' && data !== null && 'type' in data && data.type === 'state-request';
}

type NewestWinsMeta = { timestamp: number };

const newestWinsStrategy: MergeStrategy<JSONSerializable, NewestWinsMeta> = {
  createMeta(): NewestWinsMeta {
    return { timestamp: Date.now() };
  },
  merge(
    _currentState,
    currentMeta,
    incomingState,
    incomingMeta
  ): { state: JSONSerializable | null; meta: NewestWinsMeta } | null {
    return incomingMeta.timestamp > currentMeta.timestamp
      ? { state: incomingState, meta: incomingMeta }
      : null;
  },
};

const INITIAL_META: NewestWinsMeta = { timestamp: 0 };

/**
 * A hook that allows you to share state between multiple peers.
 *
 * Works hostlessly by:
 *
 * - Broadcasting updates to all peers under the given key; everyone keeps the latest timestamped state.
 * - Late joiners: when this peer sees new peers, it requests state for this key from them; each peer
 *   replies with its current state; this peer (and the existing merge logic) keeps the one with the
 *   latest timestamp.
 *
 * @param key - A string key that namespaces this shared state slice. Multiple calls with the same key share state; different keys are independent.
 * @param initialState - The initial state of the shared state (used only before any sync or update).
 * @returns A tuple containing the current state and a function to update the state.
 */
export function useSharedState<TState extends JSONSerializable>(
  key: string,
  initialState: TState | null
): [state: TState | null, setState: (next: TState | null) => void] {
  const [rawState, setRawState] = useState<TState | null>(initialState);
  const rawStateMetaRef = useRef<NewestWinsMeta>(INITIAL_META);
  const prevPeersRef = useRef<string[]>([]);

  const { broadcast, onMessage, peerId, peers, sendToPeer } = useRoom();

  useEffect(
    function handleMessage() {
      const unsubscribe = onMessage<
        SharedStatePayload<TState, NewestWinsMeta> | StateRequestPayload
      >(({ senderId, data }) => {
        if (senderId === peerId) return;

        if (isStateRequest(data)) {
          if (data.key === key) {
            sendToPeer(senderId, {
              senderId: peerId,
              data: { key, state: rawState, meta: rawStateMetaRef.current },
              timestamp: Date.now(),
            });
          }
          return;
        }

        if (data.key !== key || !('state' in data) || !('meta' in data)) return;

        const payload = data as SharedStatePayload<TState, NewestWinsMeta>;
        const result = newestWinsStrategy.merge(
          rawState,
          rawStateMetaRef.current,
          payload.state,
          payload.meta as NewestWinsMeta,
          senderId
        );
        if (result) {
          setRawState(result.state as TState | null);
          rawStateMetaRef.current = result.meta;
        }
      });
      return unsubscribe;
    },
    [key, onMessage, peerId, rawState, sendToPeer]
  );

  useEffect(
    function requestStateFromNewPeers() {
      const others = peers.filter((p) => p !== peerId);
      const prevOthers = prevPeersRef.current.filter((p) => p !== peerId);
      const newPeers = others.filter((p) => !prevOthers.includes(p));
      prevPeersRef.current = peers;

      if (newPeers.length === 0) return;

      const payload: StateRequestPayload = { type: 'state-request', key };
      newPeers.forEach((targetId) => {
        sendToPeer(targetId, {
          senderId: peerId,
          data: payload,
          timestamp: Date.now(),
        });
      });
    },
    [key, peerId, peers, sendToPeer]
  );

  const setState = useCallback(
    (next: TState | null): void => {
      const meta = newestWinsStrategy.createMeta();
      rawStateMetaRef.current = meta;
      setRawState(next);
      broadcast<SharedStatePayload<TState, NewestWinsMeta>>({
        senderId: peerId,
        data: { key, state: next, meta },
        timestamp: meta.timestamp,
      });
    },
    [broadcast, key, peerId]
  );

  return [rawState, setState];
}
