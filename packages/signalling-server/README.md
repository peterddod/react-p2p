# Signalling Server

A WebSocket-based signaling server for coordinating WebRTC peer-to-peer connections.

## Features

- Room-based peer organization
- Message relaying between peers in the same room
- Automatic peer discovery
- Connection/disconnection notifications
- Runs on port 8080 by default

## Development

Build the server in watch mode (rebuilds on changes):

```bash
bun run dev
```

To actually run the server after building:

```bash
bun run start
```

Server will be available at `ws://localhost:8080`

## Production

Build and run the server:

```bash
bun run build
bun run start
```

Set a custom port via environment variable:

```bash
PORT=3000 bun run start
```

## Protocol

### Client → Server Messages

#### Join a Room
```json
{
  "type": "join",
  "roomId": "room-name",
  "peerId": "unique-peer-id"
}
```

#### Send Signal to Peer
```json
{
  "type": "signal",
  "to": "target-peer-id",
  "from": "sender-peer-id",
  "signal": { /* WebRTC signaling data */ }
}
```

### Server → Client Messages

#### Peers List (sent on join)
```json
{
  "type": "peers",
  "peers": ["peer-id-1", "peer-id-2"]
}
```

#### Peer Joined
```json
{
  "type": "peer-joined",
  "peerId": "new-peer-id"
}
```

#### Peer Left
```json
{
  "type": "peer-left",
  "peerId": "departed-peer-id"
}
```

#### Signal from Peer
```json
{
  "type": "signal",
  "from": "sender-peer-id",
  "signal": { /* WebRTC signaling data */ }
}
```

## Architecture

- Each WebSocket connection represents a peer
- Peers are organized into rooms by `roomId`
- Server relays messages between peers in the same room
- Automatic cleanup of empty rooms
- Connection state logged to console

## License

MIT

