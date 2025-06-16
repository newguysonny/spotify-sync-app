import dotenv from 'dotenv';
import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import { exchangeCodeForTokens } from './spotifyAuth.js';

dotenv.config();

const app = express();
app.use(express.json());

// Enhanced CORS configuration
app.use((req, res, next) => {
  const allowedOrigins = [
    'https://spotify-sync-app.vercel.app/',
    'https://charismatic-recreation-production.up.railway.app/',
    'http://localhost:8080'
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Upgrade, Sec-WebSocket-Key, Sec-WebSocket-Version');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

const server = http.createServer(app);
const wss = new WebSocketServer({
  server,
  clientTracking: true,
  perMessageDeflate: {
    zlibDeflateOptions: {
      chunkSize: 1024,
      memLevel: 7,
      level: 3
    },
    zlibInflateOptions: {
      chunkSize: 10 * 1024
    },
    threshold: 1024
  }
});

// Connection management
const activeConnections = new Map();
const rooms = new Map();

// Connection heartbeat configuration
const HEARTBEAT_INTERVAL = 20000; // 20 seconds
const HEARTBEAT_TIMEOUT = 10000; // 10 seconds

wss.on('connection', (ws, req) => {
  const connectionId = Date.now();
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  
  console.log(`[${connectionId}] New connection from ${clientIp}`);
  activeConnections.set(connectionId, ws);

  // Set up heartbeat
  let heartbeatTimeout;
  const resetHeartbeat = () => {
    if (heartbeatTimeout) clearTimeout(heartbeatTimeout);
    heartbeatTimeout = setTimeout(() => {
      console.warn(`[${connectionId}] Heartbeat failed - terminating`);
      ws.terminate();
    }, HEARTBEAT_TIMEOUT);
  };

  const heartbeatInterval = setInterval(() => {
    if (ws.readyState === ws.OPEN) {
      ws.ping();
      console.debug(`[${connectionId}] Sent ping`);
    }
  }, HEARTBEAT_INTERVAL);

  // Message handling
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      console.log(`[${connectionId}] Received:`, message);

      // Handle different message types
      if (message.type === 'join') {
        const { roomId } = message;
        if (!rooms.has(roomId)) {
          rooms.set(roomId, new Set());
        }
        rooms.get(roomId).add(ws);
        console.log(`[${connectionId}] Joined room ${roomId}`);
      } else if (message.type === 'broadcast') {
        const { roomId, action, data } = message;
        if (rooms.has(roomId)) {
          rooms.get(roomId).forEach(client => {
            if (client !== ws && client.readyState === client.OPEN) {
              client.send(JSON.stringify({ action, data }));
            }
          });
        }
      }
    } catch (error) {
      console.error(`[${connectionId}] Message error:`, error);
    }
  });

  // Event handlers
  ws.on('pong', () => {
    console.debug(`[${connectionId}] Received pong`);
    resetHeartbeat();
  });

  ws.on('error', (error) => {
    console.error(`[${connectionId}] Error:`, error);
  });

  ws.on('close', () => {
    console.log(`[${connectionId}] Connection closed`);
    clearInterval(heartbeatInterval);
    clearTimeout(heartbeatTimeout);
    activeConnections.delete(connectionId);
    
    // Clean up room assignments
    rooms.forEach((clients, roomId) => {
      clients.delete(ws);
      if (clients.size === 0) {
        rooms.delete(roomId);
      }
    });
  });

  // Initial heartbeat setup
  resetHeartbeat();
});

// Server status monitoring
setInterval(() => {
  const stats = {
    timestamp: new Date().toISOString(),
    connections: activeConnections.size,
    rooms: rooms.size,
    memoryUsage: process.memoryUsage()
  };
  console.log('Server stats:', stats);
}, 60000);

// Enhanced test endpoints
app.get('/ws-test', (req, res) => {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const websocketUrl = `${protocol === 'https' ? 'wss' : 'ws'}://${host}`;

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>WebSocket Test</title>
      <style>
        /* ... (keep previous styles) ... */
      </style>
    </head>
    <body>
      <h1>WebSocket Connection Test</h1>
      <p>Connecting to: <code>${websocketUrl}</code></p>
      <div id="output"></div>
      
      <script>
        const output = document.getElementById('output');
        const ws = new WebSocket('${websocketUrl}');
        
        function log(message, isError = false) {
          const line = document.createElement('div');
          line.textContent = \`[\${new Date().toLocaleTimeString()}] \${message}\`;
          if (isError) line.style.color = 'red';
          output.appendChild(line);
          output.scrollTop = output.scrollHeight;
        }
        
        ws.onopen = () => {
          log('✅ Connected to server');
          document.body.className = 'connected';
          ws.send(JSON.stringify({ type: 'join', roomId: 'test-room' }));
        };
        
        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data);
            log(\`📩 Received: \${JSON.stringify(msg)}\`);
          } catch {
            log(\`📩 Received raw data: \${e.data}\`);
          }
        };
        
        ws.onerror = (e) => {
          log(\`❌ Error: \${e.message || 'Unknown error'}\`, true);
          document.body.className = 'disconnected';
        };
        
        ws.onclose = (e) => {
          log(\`⚠️ Disconnected: \${e.code} - \${e.reason || 'No reason given'}\`, true);
          document.body.className = 'disconnected';
        };
        
        // Test message sender
        window.sendTest = () => {
          const msg = {
            type: 'broadcast',
            roomId: 'test-room',
            action: 'test',
            data: { timestamp: Date.now() }
          };
          ws.send(JSON.stringify(msg));
          log('Sent test message');
        };
      </script>
      
      <button onclick="sendTest()">Send Test Message</button>
    </body>
    </html>
  `);
});

// Debug endpoint
app.get('/ws-status', (req, res) => {
  res.json({
    status: 'online',
    stats: {
      connections: activeConnections.size,
      rooms: rooms.size,
      uptime: process.uptime()
    },
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT,
      RAILWAY_PUBLIC_DOMAIN: process.env.RAILWAY_PUBLIC_DOMAIN
    }
  });
});

// Existing Spotify endpoint
app.post('/auth/callback', async (req, res) => {
  try {
    const tokens = await exchangeCodeForTokens(req.body.code);
    res.json(tokens);
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`
  Server running on port ${PORT}
  
  Test Endpoints:
  - WebSocket Test: /ws-test
  - Status: /ws-status
  - Spotify Auth: /auth/callback
  
  WebSocket URL: wss://${process.env.RAILWAY_PUBLIC_DOMAIN || `localhost:${PORT}`}
  `);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received - shutting down');
  wss.clients.forEach(client => client.close(1001, 'Server shutting down'));
  server.close();
});
