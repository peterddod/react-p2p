import WebSocket from "ws";
import { createServer } from "http";

const PORT = process.env.PORT || 8080;
const server = createServer();
const wss = new WebSocket.Server({ server });

interface Peer {
  id: string;
  ws: WebSocket;
  room?: string;
}

const peers = new Map<string, Peer>();

wss.on("connection", (ws) => {
  const peerId = Math.random().toString(36).substring(2, 15);
  const peer: Peer = { id: peerId, ws };
  peers.set(peerId, peer);

  console.log(`Peer connected: ${peerId}`);

  ws.on("message", (data) => {
    try {
      const message = JSON.parse(data.toString());
      handleMessage(peer, message);
    } catch (error) {
      console.error("Failed to parse message:", error);
    }
  });

  ws.on("close", () => {
    console.log(`Peer disconnected: ${peerId}`);
    peers.delete(peerId);
    broadcastToRoom(peer.room, {
      type: "peer-left",
      peerId,
    });
  });

  ws.on("error", (error) => {
    console.error(`WebSocket error for ${peerId}:`, error);
  });
});

function handleMessage(sender: Peer, message: any) {
  const { type, roomId, targetPeerId, data } = message;

  switch (type) {
    case "join-room":
      sender.room = roomId;
      broadcastToRoom(roomId, {
        type: "peer-joined",
        peerId: sender.id,
      });
      sendPeersList(sender, roomId);
      break;

    case "offer":
    case "answer":
    case "ice-candidate":
      forwardToTarget(targetPeerId, {
        type,
        from: sender.id,
        data,
      });
      break;

    default:
      console.warn(`Unknown message type: ${type}`);
  }
}

function broadcastToRoom(room: string | undefined, message: any) {
  if (!room) return;
  const payload = JSON.stringify(message);
  peers.forEach((peer) => {
    if (peer.room === room && peer.ws.readyState === WebSocket.OPEN) {
      peer.ws.send(payload);
    }
  });
}

function sendPeersList(peer: Peer, room: string) {
  const roomPeers = Array.from(peers.values())
    .filter((p) => p.room === room && p.id !== peer.id)
    .map((p) => p.id);

  peer.ws.send(
    JSON.stringify({
      type: "peers-list",
      peerIds: roomPeers,
    })
  );
}

function forwardToTarget(targetPeerId: string | undefined, message: any) {
  const target = peers.get(targetPeerId || "");
  if (target && target.ws.readyState === WebSocket.OPEN) {
    target.ws.send(JSON.stringify(message));
  }
}

server.listen(PORT, () => {
  console.log(`Signalling server running on port ${PORT}`);
});

