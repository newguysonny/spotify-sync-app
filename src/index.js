import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer } from 'ws';
import { exchangeCodeForTokens } from './spotifyAuth.js';

dotenv.config();

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const rooms = {};

wss.on('connection', (ws) => {
  console.log('New WebSocket connection');

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
    Object.keys(rooms).forEach(roomId => {
      rooms[roomId].delete(ws);
    });
  });
});

// ======================
// Manual Testing Endpoints
// ======================
app.get('/ws-test', (req, res) => {
  res.send(`
    <html>
      <body>
        <h1>WebSocket Test</h1>
        <script>
          const ws = new WebSocket('wss://${req.headers.host}');
          ws.onopen = () => document.body.innerHTML += '<p>✅ Connected!</p>';
          ws.onerror = (e) => document.body.innerHTML += '<p>❌ Error: ' + e + '</p>';
          ws.onmessage = (e) => document.body.innerHTML += '<p>📩 Message: ' + e.data + '</p>';
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
        data: 'Hello from server!' 
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
  
  Test WebSocket connections:
  - Browser test: https://${process.env.RAILWAY_PUBLIC_DOMAIN || 'localhost:' + PORT}/ws-test
  - Send test message: https://${process.env.RAILWAY_PUBLIC_DOMAIN || 'localhost:' + PORT}/ws-send-test
  `);
});
