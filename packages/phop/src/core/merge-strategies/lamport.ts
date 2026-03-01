import type { JSONSerializable } from '../../types';
import type { MergeStrategy, StrategyContext } from './types';

/**
 * Metadata carried by the Lamport clock strategy.
 * `clock` is a monotonically increasing logical counter; `tiebreaker` is the
 * writing peer's ID, used to deterministically resolve equal-clock conflicts.
 */
export type LamportMeta = { clock: number; tiebreaker: string };

/**
 * Creates a Lamport logical-clock merge strategy.
 *
 * Unlike wall-clock timestamps, Lamport clocks do not rely on peers having
 * synchronised system clocks. The clock advances monotonically: it increments
 * on every local write and is fast-forwarded to `max(local, incoming)` on
 * every receive, so causal ordering is preserved across all peers.
 *
 * Concurrent writes (same clock value) are broken deterministically by
 * comparing the writing peer's ID as a string, so every peer reaches the same
 * result independently.
 *
 * @param getPeerId - A function that returns the local peer's ID at call time.
 *   Pass a ref-backed getter so the strategy stays stable even before the
 *   signalling handshake completes.
 */
export function createLamportStrategy(
  getPeerId: () => string
): MergeStrategy<JSONSerializable, LamportMeta> {
  let localClock = 0;

  return {
    initialMeta: { clock: 0, tiebreaker: getPeerId() },

    connect(ctx: StrategyContext<JSONSerializable, LamportMeta>): () => void {
      // ctx.onMessage receives pre-filtered messages for this state key.
      // data is the { state, meta } payload (key already stripped by the hook).
      const unsubMessage = ctx.onMessage((data, senderId) => {
        const payload = data as { state: JSONSerializable | null; meta: LamportMeta };
        const incomingMeta = payload.meta;
        const currentMeta = ctx.getMeta();

        localClock = Math.max(localClock, incomingMeta.clock);

        const clockWins = incomingMeta.clock > currentMeta.clock;
        const incomingTiebreaker = incomingMeta.tiebreaker || senderId;
        const currentTiebreaker = currentMeta.tiebreaker || getPeerId();
        const tiebreakWins =
          incomingMeta.clock === currentMeta.clock && incomingTiebreaker > currentTiebreaker;

        if (clockWins || tiebreakWins) {
          ctx.commit(payload.state, { ...incomingMeta, tiebreaker: incomingTiebreaker });
        }
      });

      const unsubWrite = ctx.onLocalWrite((state) => {
        const meta: LamportMeta = { clock: ++localClock, tiebreaker: getPeerId() };
        ctx.commit(state, meta);
        ctx.broadcast({ state, meta });
      });

      const unsubConnected = ctx.onPeerConnected((remotePeerId) => {
        ctx.sendToPeer(remotePeerId, { state: ctx.getState(), meta: ctx.getMeta() });
      });

      return () => {
        unsubMessage();
        unsubWrite();
        unsubConnected();
      };
    },
  };
}
