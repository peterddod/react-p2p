/**
 * A hook that allows you to share state between multiple peers.
 */

import { useState } from 'react';

export function useSharedState<TState>(
  initialState: TState
): [TState, (next: TState | ((prev: TState) => TState)) => void] {
  const [state, setState] = useState<TState>(initialState);
  return [state, setState];
}
