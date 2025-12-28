import { createContext, useEffect, useRef, useState } from 'react';
import { PeerConnection } from '../core/PeerConnection';
import { SignalingClient } from '../core/SignalingClient';

export interface RoomContextValue {
  roomId: string;
  peerId: string;
  peers: string[];
  isConnected: boolean;
  broadcast: (message: Record<string, unknown>) => void;
  sendToPeer: (peerId: string, message: Record<string, unknown>) => void;
  onMessage: (handler: (peerId: string, message: Record<string, unknown>) => void) => void;
}

export const RoomContext = createContext<RoomContextValue | null>(null);

interface RoomProps extends React.PropsWithChildren {
  signallingServerUrl: string;
  roomId: string;
}

export function Room({ children, signallingServerUrl, roomId }: RoomProps) {
  const [peerId, setPeerId] = useState<string>('');
  const [peers, setPeers] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const signalingClientRef = useRef<SignalingClient | null>(null);
  const connectionsRef = useRef<Map<string, PeerConnection>>(new Map());
  const messageHandlerRef = useRef<
    ((peerId: string, message: Record<string, unknown>) => void) | null
  >(null);

  useEffect(
    function initializeSignalingClient() {
      const client = new SignalingClient(signallingServerUrl, roomId);
      signalingClientRef.current = client;

      client.on('joined', (event) => {
        if (event.peerId) {
          setPeerId(event.peerId);
          setIsConnected(true);
        }
        if (event.peers) {
          setPeers(event.peers);
        }
      });

      client.on('peer-list', (event) => {
        if (event.peers) {
          setPeers(event.peers);
        }
      });

      client.on('peer-joined', (event) => {
        if (event.peers) {
          setPeers(event.peers);
        }
      });

      client.on('peer-left', (event) => {
        if (event.peerId) {
          const connection = connectionsRef.current.get(event.peerId);
          if (connection) {
            connection.close();
            connectionsRef.current.delete(event.peerId);
          }
        }
        if (event.peers) {
          setPeers(event.peers);
        }
      });

      client.on('signal', (event) => {
        if (event.from && event.data) {
          const connection = connectionsRef.current.get(event.from);
          connection?.handleSignal(event.data);
        }
      });

      client.on('disconnected', () => {
        setIsConnected(false);
        connectionsRef.current.forEach((conn) => {
          conn.close();
        });
        connectionsRef.current.clear();
      });

      client.connect().catch((error) => {
        console.error('Failed to connect to signaling server:', error);
        setIsConnected(false);
      });

      return () => {
        connectionsRef.current.forEach((conn) => {
          conn.close();
        });
        connectionsRef.current.clear();
        client.disconnect();
      };
    },
    [signallingServerUrl, roomId]
  );

  useEffect(
    function createPeerConnections() {
      if (!peerId || !signalingClientRef.current) return;

      const signalingClient = signalingClientRef.current;

      peers.forEach((remotePeerId) => {
        if (remotePeerId === peerId) return;

        if (connectionsRef.current.has(remotePeerId)) return;

        const connection = new PeerConnection(
          peerId,
          remotePeerId,
          signalingClient,
          (fromPeerId, message) => {
            messageHandlerRef.current?.(fromPeerId, message);
          }
        );

        connectionsRef.current.set(remotePeerId, connection);
      });

      connectionsRef.current.forEach((connection, remotePeerId) => {
        if (!peers.includes(remotePeerId)) {
          connection.close();
          connectionsRef.current.delete(remotePeerId);
        }
      });
    },
    [peers, peerId]
  );

  const broadcast = (message: Record<string, unknown>) => {
    connectionsRef.current.forEach((connection) => {
      connection.send(message);
    });
  };

  const sendToPeer = (targetPeerId: string, message: Record<string, unknown>) => {
    const connection = connectionsRef.current.get(targetPeerId);
    connection?.send(message);
  };

  const onMessage = (handler: (peerId: string, message: Record<string, unknown>) => void) => {
    messageHandlerRef.current = handler;
  };

  const contextValue: RoomContextValue = {
    roomId,
    peerId,
    peers,
    isConnected,
    broadcast,
    sendToPeer,
    onMessage,
  };

  return <RoomContext.Provider value={contextValue}>{children}</RoomContext.Provider>;
}
