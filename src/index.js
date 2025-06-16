require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { exchangeCodeForTokens } = require('./spotifyAuth');

const app = express();
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const rooms = {}; // roomId → [WebSocket clients]

wss.on('connection', ws => {
  ws.on('message', msg => {
    const { roomId, action, data } = JSON.parse(msg);
    rooms[roomId] = rooms[roomId] || [];
    rooms[roomId].push(ws);
    rooms[roomId].forEach(client => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ action, data }));
      }
    });
  });
});

app.post('/auth/callback', async (req, res) => {
  const { code } = req.body;
  try {
    const tokens = await exchangeCodeForTokens(code);
    res.json(tokens);
  } catch (e) {
    res.status(500).send('Auth error');
  }
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Backend running on ${PORT}`));
