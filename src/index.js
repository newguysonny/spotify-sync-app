import dotenv from 'dotenv';
import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import { exchangeCodeForTokens } from './spotifyAuth.js';

dotenv.config();

const app = express();
app.use(express.json());

// Enhanced CORS for WebSocket upgrades
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Upgrade, Sec-WebSocket-Key, Sec-WebSocket-Version');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

const server = http.createServer(app);
const wss = new WebSocketServer({
  server,
  clientTracking: true, // Enable built-in client tracking
  perMessageDeflate: false // Disable compression (can cause issues)
});

const rooms = {};
const activeConnections = new Map();

wss.on('connection', (ws, req) => {
  console.log(`New connection from ${req.socket.remoteAddress}`);
  const connectionId = Date.now();
  activeConnections.set(connectionId, ws);

  // Enhanced keepalive system
  const keepAlive = {
    pingInterval: setInterval(() => {
      if (ws.readyState === ws.OPEN) {
        ws.ping();
        console.log(`[${connectionId}] Sent ping`);
        
        // Double-check connection state
        if (ws.readyState !== ws.OPEN) {
          console.warn(`[${connectionId}] Connection died during ping`);
          clearInterval(keepAlive.pingInterval);
          ws.terminate();
        }
      }
    }, 20_000), // 20 seconds (more aggressive than Railway's 30s timeout)

    timeout: setTimeout(() => {
      console.warn(`[${connectionId}] No pong response - terminating`);
      ws.terminate();
    }, 10_000) // Allow 10s for pong response
  };

  ws.on('pong', () => {
    console.log(`[${connectionId}] Received pong`);
    clearTimeout(keepAlive.timeout);
    keepAlive.timeout = setTimeout(() => {
      ws.terminate();
    }, 10_000);
  });

  ws.on('message', (msg) => {
    try {
      const { roomId, action, data } = JSON.parse(msg);
      console.log(`[${connectionId}] Room ${roomId}: ${action}`);

      if (!rooms[roomId]) rooms[roomId] = new Set();
      rooms[roomId].add(ws);

      // Broadcast to room
      rooms[roomId].forEach(client => {
        if (client !== ws && client.readyState === ws.OPEN) {
          client.send(JSON.stringify({ action, data }));
        }
      });
    } catch (e) {
      console.error(`[${connectionId}] Invalid message:`, e);
    }
  });

  ws.on('close', (code, reason) => {
    console.log(`[${connectionId}] Closed (${code}): ${reason.toString()}`);
    clearInterval(keepAlive.pingInterval);
    clearTimeout(keepAlive.timeout);
    activeConnections.delete(connectionId);
    
    Object.keys(rooms).forEach(roomId => {
      rooms[roomId].delete(ws);
      if (rooms[roomId].size === 0) delete rooms[roomId];
    });
  });

  ws.on('error', (err) => {
    console.error(`[${connectionId}] Error:`, err);
  });
});

// Connection health monitor
setInterval(() => {
  console.log(`Active connections: ${wss.clients.size}`);
  wss.clients.forEach(ws => {
    console.log(`- State: ${ws.readyState} (${ws.readyState === ws.OPEN ? 'OPEN' : 'CLOSED'})`);
  });
}, 60_000);

// ... (rest of your endpoints remain the same) ...

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`
  Server running on port ${PORT}
  WebSocket alive check interval: 20s
  Test endpoints:
  - https://${process.env.RAILWAY_PUBLIC_DOMAIN}/ws-test
  - https://${process.env.RAILWAY_PUBLIC_DOMAIN}/ws-send-test
  `);
});
