import { useSyncExternalStore } from "react";

export type Listener<TState> = (state: TState) => void;

export interface Store<TState> {
  getState: () => TState;
  setState: (next: TState | ((prev: TState) => TState)) => void;
  subscribe: (listener: Listener<TState>) => () => void;
}

export function createStore<TState>(initialState: TState): Store<TState> {
  let currentState = initialState;
  const listeners = new Set<Listener<TState>>();

  function getState(): TState {
    return currentState;
  }

  function setState(next: TState | ((prev: TState) => TState)): void {
    currentState =
      typeof next === "function"
        ? (next as (prev: TState) => TState)(currentState)
        : next;
    for (const notify of listeners) notify(currentState);
  }

  function subscribe(listener: Listener<TState>): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return { getState, setState, subscribe };
}

export function useStore<TState>(store: Store<TState>): TState {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

