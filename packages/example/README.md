# Example App - Iframe Counter Demo

A demonstration of react-p2p with two iframes sharing synchronized counter state.

## Features

- Two iframes running independently
- Each has its own counter
- When connected via P2P, counters synchronize
- Built with React 19 and Vite

## Development

```bash
# From root
bun install
bun run dev

# Or from example directory
cd packages/example
bun install
bun run dev
```

The app will be available at `http://localhost:5173`

## How it Works

1. The main app displays two iframes side by side
2. Each iframe runs a counter component
3. When a P2P connection is established, counter updates sync automatically
4. The signalling server coordinates the WebRTC connection between iframes

## Building

```bash
bun run build
```

The built files will be in the `dist/` directory.
