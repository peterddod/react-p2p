# React P2P - Monorepo

A comprehensive peer-to-peer state management solution for React applications. This monorepo contains the library, signalling server, and example implementation.

## 📦 Packages

### [`packages/react-p2p`](./packages/react-p2p)
The core P2P state management library for React. Provides hooks and utilities for managing synchronized state across peers.

**Features:**
- `createStore` - Create a reactive state store
- `useStore` - Hook to consume store state
- P2P state synchronization
- WebRTC integration (planned)

**Installation:**
```bash
npm install react-p2p
```

### [`packages/signalling-server`](./packages/signalling-server)
A WebSocket-based signalling server that coordinates WebRTC peer connections.

**Features:**
- Room-based peer organization
- WebRTC offer/answer signalling
- ICE candidate exchange
- Automatic peer discovery

**Running:**
```bash
cd packages/signalling-server
bun run dev
# or
PORT=3000 bun run start
```

### [`packages/example`](./packages/example)
A demo application showing react-p2p in action with two iframes sharing synchronized counter state.

**Running:**
```bash
bun run dev
```

## 🚀 Quick Start

### Install Dependencies
```bash
bun install
```

### Development Mode
Run all packages in development mode:
```bash
bun run dev
```

This will start:
- Example app on `http://localhost:5173`
- Signalling server on `http://localhost:8080`

### Build All Packages
```bash
bun run build
```

Or build individual packages:
```bash
bun run build:lib      # Build react-p2p library
bun run build:server   # Build signalling server
bun run build:example  # Build example app
```

## 📁 Project Structure

```
react-p2p/
├── packages/
│   ├── react-p2p/           # npm package (library)
│   │   ├── src/
│   │   ├── dist/            # Build output
│   │   └── package.json
│   ├── signalling-server/   # WebSocket signalling server
│   │   ├── src/
│   │   ├── dist/
│   │   └── package.json
│   └── example/             # Demo app with iframes
│       ├── src/
│       ├── dist/
│       └── package.json
├── package.json             # Workspace root
├── tsconfig.json            # Shared TypeScript config
└── README.md
```

## 🛠 Technology Stack

- **React** 19.x
- **TypeScript** 5.x
- **WebRTC** for peer connections
- **WebSocket** for signalling
- **Vite** for bundling examples
- **tsup** for library bundling
- **Bun** as package manager

## 📝 License

MIT

## 👤 Author

Peter Dodd

## 🔗 Repository

https://github.com/peterddod/react-p2p
