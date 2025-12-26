import React from 'react'
import ReactDOM from 'react-dom/client'
import App, { Counter } from './App.tsx'
import './index.css'

// Check if this is running in an iframe
const isIframe = window.self !== window.top

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element not found')
}

if (isIframe) {
  // Render Counter component in iframe
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <Counter />
    </React.StrictMode>,
  )
} else {
  // Render main App in top-level window
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}
