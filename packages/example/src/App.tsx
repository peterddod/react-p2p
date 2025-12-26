import { useState } from 'react';
import './App.css';

// Counter component that can be embedded in an iframe
export function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div className="counter-container">
      <h2>Counter</h2>
      <div className="card">
        <button type="button" onClick={() => setCount((count) => count + 1)}>
          Count: {count}
        </button>
      </div>
    </div>
  );
}

// Main app that displays two iframes
function App() {
  return (
    <div className="app">
      <div className="header">
        <h1>React P2P - Iframe Counter Demo</h1>
        <p>Two iframes sharing state via P2P connection</p>
      </div>

      <div className="iframes-container">
        <div className="iframe-wrapper">
          <h3>Peer 1</h3>
          <iframe src="/iframe.html?peerId=1" title="Peer 1" className="peer-iframe" />
        </div>

        <div className="iframe-wrapper">
          <h3>Peer 2</h3>
          <iframe src="/iframe.html?peerId=2" title="Peer 2" className="peer-iframe" />
        </div>
      </div>

      <div className="info">
        <h3>How it works</h3>
        <ul>
          <li>Each iframe runs an independent counter</li>
          <li>When connected via P2P, counter updates sync across peers</li>
          <li>Built with WebRTC and the react-p2p library</li>
        </ul>
      </div>
    </div>
  );
}

export default App;
