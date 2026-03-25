import { createSharedStore, Room, useRoom, useSharedState } from '@peterddod/phop';
import { useState } from 'react';
import './Peer.css';

// ---------------------------------------------------------------------------
// Zustand-style shared store — defined at module scope, bound inside <Room>
// ---------------------------------------------------------------------------

interface LabelState {
  label: string;
  color: string;
  setLabel: (label: string) => void;
  cycleColor: () => void;
}

const COLORS = ['#667eea', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];

const useLabelStore = createSharedStore<LabelState>('label', (set, get) => ({
  label: '',
  color: COLORS[0],
  setLabel: (label: string) => set({ label }),
  cycleColor: () => {
    const idx = COLORS.indexOf(get().color);
    set({ color: COLORS[(idx + 1) % COLORS.length] });
  },
}));

const DEFAULT_SERVER_URL = 'ws://localhost:8080';

function SharedLabel({ disabled }: { disabled: boolean }) {
  const label = useLabelStore((s) => s.label);
  const color = useLabelStore((s) => s.color);
  const setLabel = useLabelStore((s) => s.setLabel);
  const cycleColor = useLabelStore((s) => s.cycleColor);

  return (
    <div className="store-container">
      <p className="counter-label">Shared store (createSharedStore)</p>
      <div className="store-preview" style={{ borderColor: color }}>
        <span className="store-preview-text" style={{ color }}>
          {label || 'Type something...'}
        </span>
      </div>
      <div className="store-controls">
        <input
          type="text"
          className="store-input"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Shared label"
          disabled={disabled}
          style={{ borderColor: color }}
        />
        <button
          type="button"
          className="counter-button"
          onClick={cycleColor}
          disabled={disabled}
          style={{
            background: color,
            boxShadow: `0 2px 8px ${color}55`,
            width: 40,
            height: 40,
            fontSize: '1.1rem',
          }}
          title="Cycle color"
        >
          &#9673;
        </button>
      </div>
    </div>
  );
}

function PeerContent({
  peerName,
  serverUrl,
  onDisconnect,
}: {
  peerName: string;
  serverUrl: string;
  onDisconnect: () => void;
}) {
  const { peerId, peers, isConnected } = useRoom();
  const [count, setCount] = useSharedState<number>('counter', 0);

  const disabled = !isConnected || peers.filter((p: string) => p !== peerId).length === 0;

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
          <span className="info-label">Server:</span>
          <span className="info-value">{serverUrl}</span>
        </div>
        <div className="info-item">
          <span className="info-label">My ID:</span>
          <span className="info-value">{peerId || 'Connecting...'}</span>
        </div>
        <div className="info-item">
          <span className="info-label">Peers:</span>
          <span className="info-value">
            {peers.filter((p: string) => p !== peerId).length === 0
              ? 'Waiting for peers...'
              : peers.filter((p: string) => p !== peerId).join(', ')}
          </span>
        </div>
      </div>

      <div className="demos-container">
        <div className="counter-container">
          <p className="counter-label">Shared counter (useSharedState)</p>
          <div className="counter-display">{count ?? 0}</div>
          <div className="counter-controls">
            <button
              type="button"
              className="counter-button"
              onClick={() => setCount((count ?? 0) - 1)}
              disabled={disabled}
            >
              −
            </button>
            <button
              type="button"
              className="counter-button"
              onClick={() => setCount((count ?? 0) + 1)}
              disabled={disabled}
            >
              +
            </button>
          </div>
        </div>

        <SharedLabel disabled={disabled} />

        {disabled && (
          <p className="counter-hint">
            {!isConnected ? 'Connecting to room...' : 'Waiting for another peer to join...'}
          </p>
        )}
      </div>

      <div className="disconnect-container">
        <button type="button" className="disconnect-button" onClick={onDisconnect}>
          Disconnect
        </button>
      </div>
    </div>
  );
}

export default function PeerComponent() {
  const params = new URLSearchParams(window.location.search);
  const peerName = params.get('peer') || 'Unknown';
  const roomId = params.get('roomId') || 'demo-room';

  const [inputUrl, setInputUrl] = useState(DEFAULT_SERVER_URL);
  const [serverUrl, setServerUrl] = useState<string | null>(null);

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    setServerUrl(inputUrl.trim());
  };

  if (!serverUrl) {
    return (
      <div className="peer-container">
        <div className="peer-header">
          <h2>Peer {peerName}</h2>
        </div>
        <form className="server-form" onSubmit={handleConnect}>
          <label className="server-label" htmlFor="server-url">
            Relay server address
          </label>
          <div className="server-input-row">
            <input
              id="server-url"
              type="text"
              className="server-input"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="ws://localhost:8080"
              spellCheck={false}
            />
            <button type="submit" className="server-connect-button" disabled={!inputUrl.trim()}>
              Connect
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <Room signallingServerUrl={serverUrl} roomId={roomId}>
      <PeerContent
        peerName={`Peer ${peerName}`}
        serverUrl={serverUrl}
        onDisconnect={() => setServerUrl(null)}
      />
    </Room>
  );
}
