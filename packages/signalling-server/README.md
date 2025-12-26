# Signalling Server

A WebSocket-based signalling server for WebRTC peer-to-peer connections.

## Features

- Room-based peer organization
- WebRTC offer/answer signalling
- ICE candidate exchange
- Automatic peer discovery

## Development

```bash
bun run dev
```

## Build

```bash
bun run build
```

## Production

Set the `PORT` environment variable (default: 8080):

```bash
PORT=3000 bun run start
```

## API

### Client Messages

- `join-room`: Join a room with other peers
  ```json
  { "type": "join-room", "roomId": "my-room" }
  ```

- `offer`: Send WebRTC offer to a peer
  ```json
  { "type": "offer", "targetPeerId": "peer-id", "data": {...} }
  ```

- `answer`: Send WebRTC answer to a peer
  ```json
  { "type": "answer", "targetPeerId": "peer-id", "data": {...} }
  ```

- `ice-candidate`: Send ICE candidate to a peer
  ```json
  { "type": "ice-candidate", "targetPeerId": "peer-id", "data": {...} }
  ```

### Server Messages

- `peer-joined`: A peer joined the room
  ```json
  { "type": "peer-joined", "peerId": "peer-id" }
  ```

- `peer-left`: A peer left the room
  ```json
  { "type": "peer-left", "peerId": "peer-id" }
  ```

- `peers-list`: List of current peers in the room
  ```json
  { "type": "peers-list", "peerIds": ["peer-1", "peer-2"] }
  ```

- `offer`, `answer`, `ice-candidate`: Forwarded from other peers
  ```json
  { "type": "offer", "from": "peer-id", "data": {...} }
  ```

