# React P2P

> ⚠️ **Early Development** - Core P2P features are under active development

A peer-to-peer state management library for React applications.

## Overview

React P2P is a monorepo containing:
- A React state management library designed for peer-to-peer synchronization
- A WebSocket signaling server for coordinating WebRTC connections
- Example applications demonstrating usage

Currently implements local state management with P2P synchronization in development.

## Quick Start

### Prerequisites
- [Bun](https://bun.sh) 1.1.25 or later

### Installation
```bash
git clone https://github.com/peterddod/react-p2p.git
cd react-p2p
bun install
```

### Run Development

Start the signaling server:
```bash
bun run start:server
```

In a separate terminal, run the example app:
```bash
bun run dev:example
```

This provides:
- Example app: http://localhost:9000
- Signaling server: ws://localhost:8080

## Project Structure

```
react-p2p/
├── packages/
│   ├── react-p2p/           # Core library
│   ├── signalling-server/   # WebSocket signaling server
│   └── example/             # Demo application
├── biome.json               # Linting & formatting config
├── tsconfig.base.json       # Shared TypeScript config
└── package.json             # Workspace root
```

## Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Run example + server in parallel |
| `bun run start:server` | Start the signaling server |
| `bun run dev:server` | Build signaling server in watch mode |
| `bun run dev:example` | Run example app only |
| `bun run build` | Build all packages |
| `bun run build:lib` | Build library only |
| `bun run build:server` | Build server only |
| `bun run build:example` | Build example only |
| `bun run check` | Lint & format all code |
| `bun run lint` | Check for linting issues |

## Contributing

### Development Setup

1. Fork and clone the repository
2. Install dependencies: `bun install`
3. Create a branch: `git checkout -b feature/my-feature`
4. Make your changes
5. Run linting: `bun run check`
6. Commit with [conventional commits](https://www.conventionalcommits.org/):
   - `feat:` - New features
   - `fix:` - Bug fixes
   - `chore:` - Tooling/maintenance
   - `docs:` - Documentation
7. Push and open a PR

### Code Quality

This project uses [Biome](https://biomejs.dev) for linting and formatting.

- Format on save is configured in `.vscode/settings.json`
- Run `bun run check` before committing
- Install the recommended Biome extension for VS Code

### TypeScript

Shared configuration in `tsconfig.base.json`. Each package extends this with specific needs.

## Technology Stack

- **[Bun](https://bun.sh)** - Package manager & runtime
- **[TypeScript](https://www.typescriptlang.org/)** - Type safety
- **[React](https://react.dev/)** 19.x - UI library
- **[Biome](https://biomejs.dev/)** - Linting & formatting
- **[Vite](https://vite.dev/)** - Example app bundler
- **[tsup](https://tsup.egoist.dev/)** - Library bundler
- **[WebSocket](https://github.com/websockets/ws)** - Signaling server

## License

MIT © [Peter Dodd](https://github.com/peterddod)
