import dotenv from 'dotenv';
import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import { exchangeCodeForTokens } from './spotifyAuth.js';

dotenv.config();

const app = express();
app.use(express.json());

// Manual CORS handling (replace '*' with your frontend URL in production)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const rooms = {};

wss.on('connection', (ws) => {
  console.log('New WebSocket connection');

  // ======================
  // Ping/Pong Implementation (Critical for Railway)
  // ======================
  const pingInterval = setInterval(() => {
    if (ws.readyState === 1) { // 1 = OPEN
      ws.ping();
      console.log('Sent ping to client');
    }
  }, 25_000); // 25 seconds (< Railway's 30s timeout)

  ws.on('pong', () => {
    console.log('Received pong from client');
  });

  ws.on('message', (msg) => {
    try {
      const { roomId, action, data } = JSON.parse(msg);
      console.log(`Received message for room ${roomId}:`, action);

      if (!rooms[roomId]) rooms[roomId] = new Set();
      rooms[roomId].add(ws);

      rooms[roomId].forEach(client => {
        if (client !== ws && client.readyState === 1) {
          client.send(JSON.stringify({ action, data }));
        }
      });
    } catch (e) {
      console.error('Invalid message:', e);
    }
  });

  ws.on('close', () => {
    console.log('WebSocket disconnected');
    clearInterval(pingInterval); // Critical cleanup
    Object.keys(rooms).forEach(roomId => {
      rooms[roomId].delete(ws);
    });
  });
});

// ======================
// Railway WebSocket Test Endpoints
// ======================
app.get('/ws-test', (req, res) => {
  const websocketUrl = `wss://${req.headers.host}`;
  res.send(`
    <html>
      <body>
        <h1>WebSocket Test</h1>
        <p>Connecting to: <code>${websocketUrl}</code></p>
        <script>
          const ws = new WebSocket('${websocketUrl}');
          ws.onopen = () => document.body.innerHTML += '<p>✅ Connected!</p>';
          ws.onerror = (e) => document.body.innerHTML += '<p>❌ Error: ' + e + '</p>';
          ws.onmessage = (e) => document.body.innerHTML += '<p>📩 Message: ' + e.data + '</p>';
          
          // Client-side pong response (optional)
          ws.on('pong', () => console.log('Received server ping'));
        </script>
      </body>
    </html>
  `);
});

app.get('/ws-send-test', (req, res) => {
  wss.clients.forEach(client => {
    if (client.readyState === 1) {
      client.send(JSON.stringify({ 
        action: 'test', 
        data: 'Hello from Railway server!' 
      }));
    }
  });
  res.send('Test messages sent to all WebSocket clients');
});

// ======================
// Spotify Auth Endpoint
// ======================
app.post('/auth/callback', async (req, res) => {
  const { code } = req.body;
  try {
    const tokens = await exchangeCodeForTokens(code);
    res.json(tokens);
  } catch (e) {
    res.status(500).send('Auth error');
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`
  Backend running on port ${PORT}
  
  WebSocket Test Endpoints:
  - Browser test: https://${process.env.RAILWAY_PUBLIC_DOMAIN}/ws-test
  - Send test message: https://${process.env.RAILWAY_PUBLIC_DOMAIN}/ws-send-test
  `);
});
