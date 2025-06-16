import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App' // Your main component
import './index.css' // Optional CSS

// Initialize WebSocket connection early (optional)
const socketUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8080'
const socket = new WebSocket(socketUrl)

// Global error handler (recommended for production)
const handleGlobalError = (error) => {
  console.error('Global error:', error)
  // Send error reports to backend if needed
  socket.send(JSON.stringify({
    type: 'ERROR_REPORT',
    error: error.message
  }))
}

// Render the app
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App socket={socket} /> {/* Pass socket as prop */}
  </React.StrictMode>
)

// WebSocket connection management
socket.onopen = () => {
  console.log('WebSocket connected')
  // Optional: Join default room
  socket.send(JSON.stringify({
    roomId: 'default',
    action: 'JOIN'
  }))
}

// Global error listeners
window.addEventListener('error', handleGlobalError)
window.addEventListener('unhandledrejection', handleGlobalError)
