import { useEffect, useState } from 'react';
import { Room, useRoom } from 'react-p2p';
import './Peer.css';

// Component that uses the P2P connection
function PeerContent({ peerName }: { peerName: string }) {
  const { peerId, peers, isConnected, broadcast, onMessage } = useRoom();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<
    Array<{ from: string; text: string; timestamp: number }>
  >([]);

  useEffect(() => {
    // Listen for incoming messages
    onMessage((fromPeerId: string, data: Record<string, unknown>) => {
      if (data.type === 'chat' && typeof data.text === 'string') {
        const messageText = data.text as string;
        setMessages((prev) => [
          ...prev,
          {
            from: fromPeerId,
            text: messageText,
            timestamp: Date.now(),
          },
        ]);
      }
    });
  }, [onMessage]);

  const handleSendMessage = () => {
    if (!message.trim()) return;

    // Broadcast message to all peers
    broadcast({
      type: 'chat',
      text: message,
    });

    // Add to own message list
    setMessages((prev) => [
      ...prev,
      {
        from: 'me',
        text: message,
        timestamp: Date.now(),
      },
    ]);

    setMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="peer-container">
      <div className="peer-header">
        <h2>{peerName}</h2>
        <div className="connection-status">
          <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`} />
          <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>

      <div className="peer-info">
        <div className="info-item">
          <span className="info-label">My ID:</span>
          <span className="info-value">{peerId || 'Connecting...'}</span>
        </div>
        <div className="info-item">
          <span className="info-label">Peers:</span>
          <span className="info-value">
            {peers.length === 0
              ? 'Waiting for peers...'
              : peers.filter((p: string) => p !== peerId).join(', ')}
          </span>
        </div>
      </div>

      <div className="messages-container">
        <div className="messages-header">Messages</div>
        <div className="messages-list">
          {messages.length === 0 ? (
            <div className="no-messages">No messages yet. Send one to get started!</div>
          ) : (
            messages.map((msg, index) => (
              <div
                key={`${msg.timestamp}-${index}`}
                className={`message ${msg.from === 'me' ? 'message-sent' : 'message-received'}`}
              >
                <div className="message-sender">
                  {msg.from === 'me' ? 'You' : `Peer ${msg.from.slice(0, 8)}`}
                </div>
                <div className="message-text">{msg.text}</div>
                <div className="message-time">{new Date(msg.timestamp).toLocaleTimeString()}</div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="message-input-container">
        <input
          type="text"
          className="message-input"
          placeholder="Type a message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={!isConnected || peers.length === 0}
        />
        <button
          type="button"
          className="send-button"
          onClick={handleSendMessage}
          disabled={!isConnected || peers.length === 0 || !message.trim()}
        >
          Send
        </button>
      </div>
    </div>
  );
}

// Main Peer component with Room provider
export default function PeerComponent() {
  // Get peer name from URL query parameter
  const params = new URLSearchParams(window.location.search);
  const peerName = params.get('peer') || 'Unknown';

  // Use localhost:8080 for the signaling server (adjust as needed)
  const signallingServerUrl = 'ws://localhost:8080';
  const roomId = 'demo-room';

  return (
    <Room signallingServerUrl={signallingServerUrl} roomId={roomId}>
      <PeerContent peerName={`Peer ${peerName}`} />
    </Room>
  );
}
