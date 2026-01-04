import './App.css';

function App() {
  return (
    <div className="app">
      <div className="header">
        <h1>React P2P - Shared State Demo</h1>
        <p>Two iframes sharing state via WebRTC using the useSharedState hook</p>
      </div>

      <div className="iframes-container">
        <div className="iframe-wrapper">
          <h3>Peer 1</h3>
          <iframe src="/peer.html?peer=1" title="Peer 1" className="peer-iframe" />
        </div>

        <div className="iframe-wrapper">
          <h3>Peer 2</h3>
          <iframe src="/peer.html?peer=2" title="Peer 2" className="peer-iframe" />
        </div>
      </div>

      <div className="info">
        <h3>How it works</h3>
        <ul>
          <li>Each iframe represents an independent peer in the same room</li>
          <li>Peers discover each other via a signaling server (WebSocket)</li>
          <li>Once discovered, they establish a direct P2P connection using WebRTC</li>
          <li>The <code>useSharedState</code> hook automatically syncs state across all peers</li>
          <li>Messages are synchronized in real-time without manual broadcast calls</li>
          <li>State changes from any peer are automatically merged and synced to all others</li>
        </ul>
        
        <h3>Connect from other devices on your network</h3>
        <ol>
          <li>Find your computer's IP address (e.g., <code>192.168.1.100</code>)</li>
          <li>Make sure the signaling server is running (<code>bun run dev:server</code>)</li>
          <li>On another device, open: <code>http://&lt;your-ip&gt;:9001/peer.html?peer=3</code></li>
          <li>The page will automatically connect to the signaling server on that IP</li>
        </ol>
      </div>
    </div>
  );
}

export default App;
