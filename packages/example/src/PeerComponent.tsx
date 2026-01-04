import { useState } from 'react';
import { Room, useRoom, useSharedState } from 'react-p2p';
import './Peer.css';

interface ChatMessage {
  from: string;
  text: string;
  timestamp: number;
}

interface MessagesState {
  messages: ChatMessage[];
}

// Component that uses the P2P connection
function PeerContent({ peerName }: { peerName: string }) {
  const { peerId, peers, isConnected } = useRoom();
  const [message, setMessage] = useState('');
  
  // Use shared state for messages - automatically synced across all peers
  const [messagesState, setMessagesState] = useSharedState<MessagesState>('chat-messages', {
    messages: [],
  });

  const handleSendMessage = () => {
    if (!message.trim()) return;

    // Add message to shared state - will automatically sync to all peers
    const newMessage: ChatMessage = {
      from: peerId,
      text: message,
      timestamp: Date.now(),
    };

    setMessagesState((prev) => ({
      messages: [...prev.messages, newMessage],
    }));

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
        <div className="messages-header">Messages (Synced via useSharedState)</div>
        <div className="messages-list">
          {messagesState.messages.length === 0 ? (
            <div className="no-messages">No messages yet. Send one to get started!</div>
          ) : (
            messagesState.messages.map((msg, index) => (
              <div
                key={`${msg.timestamp}-${index}`}
                className={`message ${msg.from === peerId ? 'message-sent' : 'message-received'}`}
              >
                <div className="message-sender">
                  {msg.from === peerId ? 'You' : `Peer ${msg.from.slice(0, 8)}`}
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

  // Use the same hostname as the page was loaded from
  // This allows it to work on localhost and on network IP addresses
  const hostname = window.location.hostname;
  const signallingServerUrl = `ws://${hostname}:8080`;
  const roomId = 'demo-room';

  return (
    <Room signallingServerUrl={signallingServerUrl} roomId={roomId}>
      <PeerContent peerName={`Peer ${peerName}`} />
    </Room>
  );
}
