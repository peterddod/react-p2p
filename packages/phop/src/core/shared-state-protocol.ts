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
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  return d.type === 'state-request' && typeof d.key === 'string';
}

export function isSharedStatePayload(data: unknown): data is SharedStatePayload {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.key === 'string' &&
    'state' in d &&
    d.state !== undefined &&
    typeof d.meta === 'object' &&
    d.meta !== null
  );
}
