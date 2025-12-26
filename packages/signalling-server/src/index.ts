// server.ts
import { WebSocketServer, WebSocket } from 'ws';

const wss = new WebSocketServer({ port: 8080 });

type Room = Map<string, WebSocket>;
const rooms = new Map<string, Room>();

wss.on('connection', (ws: WebSocket) => {
  let currentRoom: string | null = null;
  let peerId: string | null = null;
  
  ws.on('message', (data: Buffer) => {
    const msg = JSON.parse(data.toString()) as {
      type: string;
      roomId?: string;
      peerId?: string;
      to?: string;
      from?: string;
      signal?: unknown;
    };
    
    switch (msg.type) {
      case 'join':
        if (!msg.roomId || !msg.peerId) return;
        
        currentRoom = msg.roomId;
        peerId = msg.peerId;
        
        if (!rooms.has(currentRoom)) {
          rooms.set(currentRoom, new Map());
        }
        
        const room = rooms.get(currentRoom)!;
        
        // Tell new peer about existing peers
        const existingPeers = Array.from(room.keys());
        ws.send(JSON.stringify({
          type: 'peers',
          peers: existingPeers
        }));
        
        // Tell existing peers about new peer
        room.forEach((peerWs) => {
          peerWs.send(JSON.stringify({
            type: 'peer-joined',
            peerId
          }));
        });
        
        room.set(peerId, ws);
        console.log(`Peer ${peerId} joined room ${currentRoom} (${room.size} peers total)`);
        break;
        
      case 'signal':
        // Relay WebRTC signaling to specific peer
        if (!currentRoom || !msg.to) return;
        
        const targetPeer = rooms.get(currentRoom)?.get(msg.to);
        if (targetPeer) {
          targetPeer.send(JSON.stringify({
            type: 'signal',
            from: msg.from,
            signal: msg.signal
          }));
        }
        break;
    }
  });
  
  ws.on('close', () => {
    if (currentRoom && peerId) {
      const room = rooms.get(currentRoom);
      if (room) {
        room.delete(peerId);
        
        // Notify others
        room.forEach((peerWs) => {
          peerWs.send(JSON.stringify({
            type: 'peer-left',
            peerId
          }));
        });
        
        console.log(`Peer ${peerId} left room ${currentRoom} (${room.size} peers remaining)`);
        
        // Clean up empty rooms
        if (room.size === 0) {
          rooms.delete(currentRoom);
          console.log(`Room ${currentRoom} deleted (empty)`);
        }
      }
    }
  });
  
  ws.on('error', (err: Error) => {
    console.error('WebSocket error:', err);
  });
});

console.log('🚀 Signaling server running on ws://localhost:8080');