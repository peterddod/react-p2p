export { Room, RoomContext, type RoomContextValue } from './context';
export {
  type ConsensusMeta,
  createConsensusStrategy,
  createLamportStrategy,
  createLastWriteWinsStrategy,
  type LamportMeta,
  type LastWriteWinsMeta,
  type MergeMeta,
  type MergeStrategy,
  type StrategyContext,
} from './core/merge-strategies';
export { SharedStateController, type RoomHandle } from './core/SharedStateController';
export { useRoom, useSharedState } from './hooks';
export { createSharedStore } from './store';
export type { JSONSerializable, Message, MessageHandler } from './types';
