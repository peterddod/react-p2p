# phop

Peer-to-peer state management for React using WebRTC. Share and sync state across browsers in real time — no backend required.

> ⚠️ **Early Development** — P2P synchronization features are under active development

## Installation

```bash
npm install @peterddod/phop
```

## Usage

Wrap your app in a `<Room>` provider and connect to a signaling server:

```tsx
import { Room, useRoom, useSharedState } from '@peterddod/phop';

function App() {
  return (
    <Room signallingServerUrl="wss://your-signalling-server" roomId="my-room">
      <Counter />
    </Room>
  );
}

function Counter() {
  const [count, setCount] = useSharedState('count', 0);

  return (
    <button onClick={() => setCount((prev) => (prev ?? 0) + 1)}>
      Count: {count}
    </button>
  );
}
```

State updates in `useSharedState` are automatically broadcast to all peers in the room and merged using a configurable conflict resolution strategy.

## API

### `<Room>`

Establishes a WebRTC mesh with all peers in the given room.

| Prop | Type | Description |
|------|------|-------------|
| `signallingServerUrl` | `string` | WebSocket URL of the signaling server |
| `roomId` | `string` | Room identifier — peers sharing a room ID connect to each other |

### `useSharedState(key, initialValue, strategy?)`

Shared state hook — works like `useState` but syncs across all peers in the room. Best for simple, single-value state.

```ts
const [value, setValue] = useSharedState<T>(
  key: string,
  initialValue: T,
  strategy?: MergeStrategy
);

setValue(nextValue);
setValue((prev) => deriveNext(prev));
```

### `createSharedStore(key, initializer, options?)`

Define a Zustand-style store that syncs across peers. Define at module scope, use inside a `<Room>`.

```tsx
import { createSharedStore } from '@peterddod/phop';

const useCounterStore = createSharedStore('counter', (set) => ({
  count: 0,
  increment: () => set((s) => ({ count: s.count + 1 })),
}));

function Counter() {
  const count = useCounterStore((s) => s.count);
  const increment = useCounterStore((s) => s.increment);
  return <button onClick={increment}>Count: {count}</button>;
}
```

By default, `createSharedStore` syncs the state returned by `partialize` (or all non-function fields if `partialize` is omitted). You only need `partialize` when you want to explicitly control the synced slice or your state includes non-JSON-serializable values.

```ts
type State = { count: number; increment: () => void };
type Synced = { count: number };

const useStore = createSharedStore<State, Synced>('key', (set) => ({
  count: 0,
  increment: () => set((s) => ({ count: s.count + 1 })),
}), {
  partialize: (s) => ({ count: s.count }),
});
```

A custom `MergeStrategy` can be passed via `options.strategy`. The default is a Lamport logical clock.

#### `useSharedState` vs `createSharedStore`

| | `useSharedState` | `createSharedStore` |
|---|---|---|
| **Mental model** | `useState` | Zustand `create` |
| **Scope** | One value per key | Object with actions |
| **Selectors** | No | Yes — fine-grained re-renders |
| **Best for** | Simple shared values | App-level shared state with logic |

### `useRoom()`

Access room metadata and low-level messaging.

```ts
const { peerId, peers, isConnected, broadcast, onMessage } = useRoom();
```

## Signaling Server

phop requires a lightweight signaling server to coordinate the initial WebRTC handshake. Once peers are connected, all state sync happens directly between browsers.

A production-ready server is available as a Docker image:

```bash
docker run -p 8080:8080 ghcr.io/peterddod/phop/signalling-server:latest
```

Source and self-hosting instructions: [`packages/signalling-server`](../signalling-server)

## License

MIT © [Peter Dodd](https://github.com/peterddod)
