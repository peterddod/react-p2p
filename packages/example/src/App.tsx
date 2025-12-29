import './App.css';

function App() {
  return (
    <div className="app">
      <div className="header">
        <h1>React P2P - Messaging Demo</h1>
        <p>Two iframes connecting as peers and exchanging messages via WebRTC</p>
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
          <li>Messages are sent directly between peers without going through the server</li>
          <li>Try sending messages from either peer to see real-time communication</li>
        </ul>
      </div>
    </div>
  );
}

export default App;
