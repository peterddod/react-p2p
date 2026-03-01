# phop

Peer-to-peer state management for React using WebRTC. Share and sync state across browsers in real time — no backend required.

> ⚠️ **Early Development** — Core P2P features are under active development

## What is phop?

phop lets React apps share state directly between browsers using WebRTC data channels. A lightweight signaling server handles the initial handshake; after that, state flows peer-to-peer with no server in the middle.

```tsx
import { useSharedState } from '@peterddod/phop';

function Counter() {
  const [count, setCount] = useSharedState('count', 0);
  return <button onClick={() => setCount(count + 1)}>Count: {count}</button>;
}
```

## Packages

| Package | Description |
|---------|-------------|
| [`@peterddod/phop`](packages/phop) | React library — `npm install @peterddod/phop` |
| [`signalling-server`](packages/signalling-server) | WebSocket server for coordinating WebRTC connections |
| [`integration-tests`](packages/integration-tests) | Playwright integration tests — real WebRTC, multiple peers |
| `example` | Demo app showing two peers syncing state in real time |

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) 1.1.25+

### Run locally

```bash
git clone https://github.com/peterddod/phop.git
cd phop
bun install
bun run dev
```

This starts three processes in parallel:

- **Example app** — http://localhost:9000
- **Signaling server** — ws://localhost:8080
- **Library** — watches `packages/phop/src` and rebuilds on changes

Open http://localhost:9000 to see two peer iframes syncing a shared counter in real time.

## Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start everything in parallel |
| `bun run build` | Build all packages |
| `bun run build:lib` | Build phop library only |
| `bun run build:server` | Build signaling server only |
| `bun run lint` | Check for linting issues |
| `bun run check` | Lint and format all code |
| `bun run test:integration` | Run the Playwright integration test suite |

## Testing

Integration tests run real WebRTC connections between multiple browser peers. On first use, install the Playwright browser:

```bash
bunx playwright install chromium
```

Then run the suite:

```bash
bun run test:integration
```

Tests cover messaging, peer lifecycle, late-joiner state sync, and merge strategy convergence. See [`packages/integration-tests`](packages/integration-tests) for the full guide.

## Contributing

1. Fork and clone the repository
2. Install dependencies: `bun install`
3. Create a branch: `git checkout -b feature/my-feature`
4. Commit using [conventional commits](https://www.conventionalcommits.org/):
   - `feat:` — new feature (triggers minor release)
   - `fix:` — bug fix (triggers patch release)
   - `feat!:` / `BREAKING CHANGE:` — breaking change (triggers major release)
   - `chore:`, `docs:`, `ci:` — no release
5. Open a PR — releases to npm and GHCR happen automatically on merge to `main`

## License

MIT © [Peter Dodd](https://github.com/peterddod)
