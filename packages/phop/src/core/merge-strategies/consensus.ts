import type { JSONSerializable } from '../../types';
import type { MergeStrategy, StrategyContext } from './types';

export type ConsensusMeta = { index: number };

// ---------------------------------------------------------------------------
// Internal protocol message shapes
// ---------------------------------------------------------------------------

type ProposeMessage = {
  type: 'consensus-propose';
  index: number;
  localState: JSONSerializable | null;
};

type ReadyMessage = {
  type: 'consensus-ready';
  index: number;
};

type DiffMessage = {
  type: 'consensus-diff';
  index: number;
  /** The full proposed next-state from this peer. */
  state: JSONSerializable | null;
};

type HashMessage = {
  type: 'consensus-hash';
  index: number;
  hash: string;
};

type ConsensusMessage = ProposeMessage | ReadyMessage | DiffMessage | HashMessage;

function isConsensusMessage(data: unknown): data is ConsensusMessage {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.type === 'string' && d.type.startsWith('consensus-') && typeof d.index === 'number'
  );
}

// ---------------------------------------------------------------------------
// Deterministic hash
// ---------------------------------------------------------------------------

function sortedStringify(value: JSONSerializable | null): string {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return JSON.stringify(value);
  }
  const sorted: Record<string, JSONSerializable> = {};
  for (const k of Object.keys(value as Record<string, JSONSerializable>).sort()) {
    sorted[k] = sortedStringify(
      (value as Record<string, JSONSerializable>)[k]
    ) as unknown as JSONSerializable;
  }
  return JSON.stringify(sorted);
}

function hashState(state: JSONSerializable | null): string {
  return sortedStringify(state);
}

// ---------------------------------------------------------------------------
// Co-merge: fold all peer states into a single value
//
// Uses a simple last-write-wins by peer ID ordering (deterministic across all
// peers) when states conflict. Callers can supply a custom mergeFn to override.
// ---------------------------------------------------------------------------

type MergeFn<TState extends JSONSerializable> = (
  states: Array<{ peerId: string; state: TState | null }>
) => TState | null;

function defaultMerge<TState extends JSONSerializable>(
  states: Array<{ peerId: string; state: TState | null }>
): TState | null {
  // Sort by peer ID descending so the lexicographically greatest peer wins on
  // conflicts — deterministic and identical across all peers.
  const sorted = [...states].sort((a, b) => (a.peerId > b.peerId ? -1 : 1));
  return sorted[0]?.state ?? null;
}

// ---------------------------------------------------------------------------
// Round state machine
// ---------------------------------------------------------------------------

type RoundPhase = 'proposing' | 'ready' | 'diffing' | 'hashing';

interface Round<TState extends JSONSerializable> {
  index: number;
  phase: RoundPhase;
  /** Peers participating in this round (snapshot when round started). */
  peers: Set<string>;
  /** Proposed local states received from each peer (including self). */
  proposals: Map<string, TState | null>;
  /** Ready signals received. */
  readyFrom: Set<string>;
  /** Diff (full proposed state) received from each peer. */
  diffs: Map<string, TState | null>;
  /** Hashes received from each peer. */
  hashes: Map<string, string>;
  /** The merged next-state computed locally after applying all diffs. */
  mergedState: TState | null;
}

// ---------------------------------------------------------------------------
// Strategy factory
// ---------------------------------------------------------------------------

/**
 * Creates a consensus merge strategy.
 *
 * All peers in the room must agree on a new state before it is committed.
 * The protocol proceeds in four phases per round:
 *
 * 1. **Propose** — any peer with a pending local write broadcasts its proposed
 *    state together with a monotonically increasing round index. All other
 *    peers join the round with their own current local state.
 * 2. **Ready** — once a peer has received a proposal from every participant it
 *    locks its own proposed state and broadcasts a ready signal.
 * 3. **Diff** — once all ready signals are received every peer broadcasts its
 *    full proposed state so peers can co-merge.
 * 4. **Hash** — each peer applies the co-merge, hashes the result, and
 *    broadcasts the hash. When all hashes match the new state is committed.
 *    If hashes diverge the round is aborted and retried.
 *
 * If a new local write arrives while a round is in progress it is queued and
 * becomes the proposed state for the next round.
 *
 * Late joiners receive the committed state via the normal `onPeerConnected`
 * push and are excluded from any in-progress round.
 *
 * @param getPeerId - A function that returns the local peer's ID at call time.
 * @param mergeFn - Optional co-merge function. Receives all proposed states
 *   with their peer IDs and returns the merged result. Defaults to a
 *   deterministic last-write-wins by peer ID ordering.
 */
export function createConsensusStrategy<TState extends JSONSerializable>(
  getPeerId: () => string,
  mergeFn?: MergeFn<TState>
): MergeStrategy<TState, ConsensusMeta> {
  const merge = mergeFn ?? defaultMerge<TState>;
  let roundIndex = 0;
  let activeRound: Round<TState> | null = null;
  // Local state written while a round is in progress — replayed as the next round.
  let pendingWrite: { state: TState | null } | null = null;

  // ---------------------------------------------------------------------------
  // Helpers (closed over ctx at connect time)
  // ---------------------------------------------------------------------------

  let ctx: StrategyContext<TState, ConsensusMeta>;

  function remotePeers(): string[] {
    return ctx.getPeers().filter((p) => p !== getPeerId());
  }

  function broadcast(msg: ConsensusMessage): void {
    ctx.broadcast(msg as unknown as Record<string, JSONSerializable>);
  }

  function sendToPeer(peerId: string, msg: ConsensusMessage): void {
    ctx.sendToPeer(peerId, msg as unknown as Record<string, JSONSerializable>);
  }

  // ---------------------------------------------------------------------------
  // Round lifecycle
  // ---------------------------------------------------------------------------

  function startRound(index: number, localState: TState | null): Round<TState> {
    const peerId = getPeerId();
    const peers = new Set([peerId, ...remotePeers()]);
    const round: Round<TState> = {
      index,
      phase: 'proposing',
      peers,
      proposals: new Map([[peerId, localState]]),
      readyFrom: new Set(),
      diffs: new Map(),
      hashes: new Map(),
      mergedState: null,
    };
    activeRound = round;
    return round;
  }

  function advanceToReady(round: Round<TState>): void {
    round.phase = 'ready';
    broadcast({ type: 'consensus-ready', index: round.index });
    checkAllReady(round);
  }

  function checkAllProposed(round: Round<TState>): void {
    if (round.phase !== 'proposing') return;
    for (const p of round.peers) {
      if (!round.proposals.has(p)) return;
    }
    advanceToReady(round);
  }

  function checkAllReady(round: Round<TState>): void {
    if (round.phase !== 'ready') return;
    for (const p of round.peers) {
      if (!round.readyFrom.has(p)) return;
    }
    // All peers ready — send our proposed diff to every participant.
    round.phase = 'diffing';
    const myState = round.proposals.get(getPeerId()) ?? null;
    round.diffs.set(getPeerId(), myState);
    for (const p of round.peers) {
      if (p !== getPeerId()) {
        sendToPeer(p, { type: 'consensus-diff', index: round.index, state: myState });
      }
    }
    checkAllDiffs(round);
  }

  function checkAllDiffs(round: Round<TState>): void {
    if (round.phase !== 'diffing') return;
    for (const p of round.peers) {
      if (!round.diffs.has(p)) return;
    }
    // Merge all diffs and hash.
    round.phase = 'hashing';
    const entries = Array.from(round.diffs.entries()).map(([peerId, state]) => ({
      peerId,
      state,
    }));
    round.mergedState = merge(entries);
    const hash = hashState(round.mergedState);
    round.hashes.set(getPeerId(), hash);
    broadcast({ type: 'consensus-hash', index: round.index, hash });
    checkAllHashes(round);
  }

  function checkAllHashes(round: Round<TState>): void {
    if (round.phase !== 'hashing') return;
    for (const p of round.peers) {
      if (!round.hashes.has(p)) return;
    }
    const hashes = Array.from(round.hashes.values());
    const allMatch = hashes.every((h) => h === hashes[0]);

    if (allMatch) {
      commitRound(round);
    } else {
      // Diverged — abort and retry with the merged state as the new proposal.
      const retryState = round.mergedState;
      activeRound = null;
      initiateRound(retryState);
    }
  }

  function commitRound(round: Round<TState>): void {
    const newIndex = round.index;
    activeRound = null;
    ctx.commit(round.mergedState, { index: newIndex });

    // If a write arrived while the round was in progress, start the next round.
    if (pendingWrite !== null) {
      const { state } = pendingWrite;
      pendingWrite = null;
      initiateRound(state);
    }
  }

  function initiateRound(localState: TState | null): void {
    roundIndex += 1;
    const round = startRound(roundIndex, localState);
    broadcast({
      type: 'consensus-propose',
      index: round.index,
      localState,
    });
    // If we are the only peer, skip straight to ready.
    checkAllProposed(round);
  }

  // ---------------------------------------------------------------------------
  // Incoming message dispatch
  // ---------------------------------------------------------------------------

  function handleMessage(data: JSONSerializable, senderId: string): void {
    if (!isConsensusMessage(data)) return;

    switch (data.type) {
      case 'consensus-propose':
        handlePropose(data, senderId);
        break;
      case 'consensus-ready':
        handleReady(data, senderId);
        break;
      case 'consensus-diff':
        handleDiff(data, senderId);
        break;
      case 'consensus-hash':
        handleHash(data, senderId);
        break;
    }
  }

  function handlePropose(msg: ProposeMessage, senderId: string): void {
    // If we have no active round, join this one with our current local state.
    if (activeRound === null) {
      roundIndex = Math.max(roundIndex, msg.index);
      const round = startRound(msg.index, ctx.getState());
      // Immediately broadcast our own proposal so others know we've joined.
      broadcast({
        type: 'consensus-propose',
        index: round.index,
        localState: ctx.getState(),
      });
      round.proposals.set(senderId, msg.localState as TState | null);
      checkAllProposed(round);
      return;
    }

    if (activeRound.index !== msg.index) return;
    if (activeRound.proposals.has(senderId)) return;
    activeRound.proposals.set(senderId, msg.localState as TState | null);
    checkAllProposed(activeRound);
  }

  function handleReady(msg: ReadyMessage, senderId: string): void {
    if (activeRound === null || activeRound.index !== msg.index) return;
    if (activeRound.phase !== 'ready') return;
    activeRound.readyFrom.add(senderId);
    checkAllReady(activeRound);
  }

  function handleDiff(msg: DiffMessage, senderId: string): void {
    if (activeRound === null || activeRound.index !== msg.index) return;
    if (activeRound.phase !== 'diffing') return;
    activeRound.diffs.set(senderId, msg.state as TState | null);
    checkAllDiffs(activeRound);
  }

  function handleHash(msg: HashMessage, senderId: string): void {
    if (activeRound === null || activeRound.index !== msg.index) return;
    if (activeRound.phase !== 'hashing') return;
    activeRound.hashes.set(senderId, msg.hash);
    checkAllHashes(activeRound);
  }

  // ---------------------------------------------------------------------------
  // MergeStrategy implementation
  // ---------------------------------------------------------------------------

  return {
    initialMeta: { index: 0 },

    connect(context: StrategyContext<TState, ConsensusMeta>): () => void {
      ctx = context;

      const unsubMessage = ctx.onMessage(handleMessage);

      const unsubWrite = ctx.onLocalWrite((state) => {
        if (activeRound !== null) {
          // Queue the write; it will become the proposal for the next round.
          pendingWrite = { state };
          return;
        }
        initiateRound(state);
      });

      const unsubConnected = ctx.onPeerConnected((remotePeerId) => {
        ctx.sendToPeer(remotePeerId, {
          state: ctx.getState(),
          meta: ctx.getMeta(),
        } as unknown as Record<string, JSONSerializable>);
      });

      return () => {
        unsubMessage();
        unsubWrite();
        unsubConnected();
      };
    },
  };
}
