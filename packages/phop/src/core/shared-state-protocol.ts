import type { JSONSerializable } from '../types';
import type { MergeMeta } from './merge-strategies/types';

export type StateRequestPayload = {
  type: 'state-request';
  key: string;
};

export type SharedStatePayload = {
  key: string;
  state: JSONSerializable | null;
  meta: MergeMeta;
};

export function isStateRequest(data: unknown): data is StateRequestPayload {
  return (
    typeof data === 'object' &&
    data !== null &&
    'type' in data &&
    (data as StateRequestPayload).type === 'state-request'
  );
}

export function isSharedStatePayload(data: unknown): data is SharedStatePayload {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  return typeof d.key === 'string' && 'state' in d && typeof d.meta === 'object' && d.meta !== null;
}
