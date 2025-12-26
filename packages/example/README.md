# Example App

A demonstration application for the react-p2p library featuring two iframes with independent counters.

## Current Status

This example demonstrates the basic UI structure for a P2P demo. The counters currently operate independently. P2P synchronization between iframes is under development.

## Features

- Two side-by-side iframes
- Each iframe contains an independent counter component
- Built with React 19 and Vite
- Uses the `react-p2p` library (local state currently)
- Hot module reloading for fast development

## Development

From the monorepo root:

```bash
bun install
bun run dev
```

Or from this directory:

```bash
cd packages/example
bun run dev
```

The app will be available at `http://localhost:5173`

## Structure

```
example/
├── src/
│   ├── App.tsx          # Main app with iframe container
│   ├── App.css          # Styles
│   └── main.tsx         # Entry point
├── public/              # Static assets
└── index.html           # HTML template
```

## How It Works

1. The main app (`App.tsx`) renders two iframes side by side
2. Each iframe is intended to load an independent instance
3. The `Counter` component uses React's `useState` for local state
4. When P2P features are implemented, counter state will sync across iframes

## Building

```bash
bun run build
```

Built files will be in the `dist/` directory and can be served statically.

## Future Development

- [ ] Add WebRTC connection between iframes
- [ ] Implement P2P state synchronization
- [ ] Add connection status indicator
- [ ] Demo conflict resolution strategies

## License

MIT
