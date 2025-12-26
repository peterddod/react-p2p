# react-p2p

> ⚠️ **Early Development** - P2P synchronization features are under active development

A React state management library designed for peer-to-peer synchronization.

## Current Status

Currently provides local state management primitives. P2P synchronization features are in development.

**Available APIs:**
- `createStore<T>(initialState)` - Create a reactive state store
- `useStore<T>(store)` - React hook to consume store state
- `Store<T>` - TypeScript interface for stores

## Installation

This package is not yet published to npm. For development, it's used via workspace dependencies in the monorepo.

```json
{
  "dependencies": {
    "react-p2p": "workspace:*"
  }
}
```

## Usage

```tsx
import { createStore, useStore } from 'react-p2p';

// Create a store
const counterStore = createStore({ count: 0 });

// Use in a component
function Counter() {
  const state = useStore(counterStore);
  
  return (
    <button onClick={() => counterStore.setState({ count: state.count + 1 })}>
      Count: {state.count}
    </button>
  );
}
```

## API Reference

### `createStore<TState>(initialState: TState): Store<TState>`

Creates a new state store with the given initial state.

**Returns:**
- `getState(): TState` - Get current state
- `setState(next: TState | (prev: TState) => TState): void` - Update state
- `subscribe(listener: (state: TState) => void): () => void` - Subscribe to changes

### `useStore<TState>(store: Store<TState>): TState`

React hook that subscribes to a store and returns its current state. Re-renders when the store updates.

## Development

```bash
# Watch mode (rebuilds on changes)
bun run dev

# Build for production
bun run build
```

Output is in `dist/` directory with CommonJS, ESM, and TypeScript definitions.

## License

MIT

