# React P2P Example - Messaging Demo

A demonstration application for the react-p2p library featuring two iframes that communicate via WebRTC peer-to-peer connections.

## Features

- **Two Peer iframes**: Each iframe represents an independent peer in a P2P network
- **Real-time Messaging**: Send messages between peers instantly
- **WebRTC Connection**: Direct peer-to-peer communication using WebRTC data channels
- **Connection Status**: Visual indicators show connection state
- **Peer Discovery**: Automatic peer discovery via signaling server
- **Beautiful UI**: Modern, responsive design with gradient themes

## Getting Started

### Prerequisites

Make sure you have Node.js 16+ or Bun installed.

### 1. Install Dependencies

From the monorepo root:

```bash
bun install
# or
npm install
```

### 2. Start the Signaling Server

The P2P connection requires a signaling server to help peers discover each other.

From the monorepo root:

```bash
bun run start:server
# or from the signalling-server directory:
cd packages/signalling-server
bun run build
bun run start
```

The signaling server will start on `ws://localhost:8080`

### 3. Run the Example App

In a new terminal, from the monorepo root:

```bash
bun run dev:example
# or from the example directory:
cd packages/example
bun run dev
```

Open your browser to `http://localhost:9000` (or the port shown in the terminal)

## How It Works

1. **Main Page**: Displays two iframes side by side (`App.tsx`)
2. **Peer Initialization**: Each iframe runs an instance of `Peer.tsx` which connects to the signaling server
3. **Room Connection**: Both peers join the same room (`demo-room`) via the `<Room>` provider
4. **WebRTC Handshake**: The signaling server facilitates ICE candidate exchange and SDP negotiation
5. **P2P Data Channel**: Once connected, peers establish a direct WebRTC data channel
6. **Message Exchange**: Messages are sent directly between peers without going through the server

## Architecture

### Components

```
App.tsx           # Main container with two iframes
├── index.html    # Main app entry
└── peer.html     # Peer iframe entry
    └── Peer.tsx  # Individual peer with messaging UI
        └── <Room> Provider (from react-p2p)
            └── useRoom() hook
```

### Connection Flow

```
┌─────────────────┐         ┌─────────────────┐
│    Peer 1       │         │    Peer 2       │
│   (iframe)      │         │   (iframe)      │
└────────┬────────┘         └────────┬────────┘
         │                           │
         │  WebSocket (signaling)    │
         └────────┬──────────────────┘
                  │
         ┌────────▼────────┐
         │   Signaling     │
         │    Server       │
         │ (ws://localhost │
         │     :8080)      │
         └─────────────────┘

After connection established:
┌─────────────────┐ WebRTC P2P ┌─────────────────┐
│    Peer 1       │◄──────────►│    Peer 2       │
│   (iframe)      │ Data Channel│   (iframe)      │
└─────────────────┘             └─────────────────┘
```

## Project Structure

```
example/
├── src/
│   ├── App.tsx          # Main app with iframe container
│   ├── App.css          # Main app styles
│   ├── main.tsx         # Entry point for main app
│   ├── Peer.tsx         # Peer component with messaging UI
│   ├── Peer.css         # Peer component styles
│   └── peer.tsx         # Entry point for peer iframe
├── public/              # Static assets
├── index.html           # Main app HTML template
├── peer.html            # Peer iframe HTML template
└── farm.config.ts       # Farm configuration
```

## Using the Demo

1. **Wait for Connection**: Both peers will automatically connect to the signaling server
2. **Check Status**: Look for the green "Connected" indicator in the header
3. **Send Messages**: Type a message in either peer's input field and click "Send" (or press Enter)
4. **Observe**: Messages appear instantly in both peers' message lists
5. **Peer Info**: The info section shows your peer ID and connected peers

## API Usage Example

The demo uses the react-p2p library's `Room` component and `useRoom` hook:

```tsx
import { Room, useRoom } from 'react-p2p';

// Wrap your component with the Room provider
<Room signallingServerUrl="ws://localhost:8080" roomId="demo-room">
  <YourComponent />
</Room>

// Inside your component, use the useRoom hook
function YourComponent() {
  const { peerId, peers, isConnected, broadcast, onMessage } = useRoom();
  
  // Listen for messages
  useEffect(() => {
    onMessage((fromPeerId, message) => {
      console.log('Received message from', fromPeerId, message);
    });
  }, [onMessage]);
  
  // Send messages
  const sendMessage = () => {
    broadcast({ type: 'chat', text: 'Hello!' });
  };
  
  return <div>...</div>;
}
```

## Building for Production

```bash
bun run build
# or
npm run build
```

Built files will be in the `dist/` directory and can be served statically.

## Technologies Used

- **React 19**: UI framework with latest features
- **WebRTC**: Peer-to-peer communication protocol
- **WebSocket**: Signaling for peer discovery
- **Farm**: Extremely fast build tool and dev server
- **TypeScript**: Type safety and better DX
- **react-p2p**: The star of the show!

## Troubleshooting

### Peers not connecting?

1. Make sure the signaling server is running on `ws://localhost:8080`
2. Check browser console for any WebSocket errors
3. Ensure both peers are in the same room ID

### Messages not sending?

1. Check that the connection status shows "Connected"
2. Make sure there's at least one other peer in the room
3. Check browser console for any errors

## License

MIT
