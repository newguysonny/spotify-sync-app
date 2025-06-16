import React, { useEffect, useState, useCallback } from 'react';
import { spotifyPlayerInit } from './spotifyPlayer';

export default function App() {
  const [player, setPlayer] = useState(null);
  const [ws, setWs] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  // Memoized send function
  const send = useCallback((action) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ roomId: 'room1', action }));
    } else {
      console.error('WebSocket is not connected');
    }
  }, [ws]);

  useEffect(() => {
    const token = localStorage.getItem('spotifyAccessToken');
    if (!token) return;

    // Initialize Spotify player
    spotifyPlayerInit(token)
      .then(setPlayer)
      .catch(error => console.error('Player initialization failed:', error));

    // Initialize WebSocket
    const socket = new WebSocket('ws://charismatic-recreation-production.up.railway.app:8080');
    
    socket.onopen = () => {
      setIsConnected(true);
      console.log('WebSocket connected');
    };
    
    socket.onmessage = (msg) => {
      try {
        const { action } = JSON.parse(msg.data);
        if (!player) return;
        
        if (action === 'play') player.resume();
        if (action === 'pause') player.pause();
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    };
    
    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    socket.onclose = () => {
      setIsConnected(false);
      console.log('WebSocket disconnected');
    };

    setWs(socket);

    // Cleanup function
    return () => {
      if (socket) {
        socket.close();
      }
      if (player) {
        // Add any necessary player cleanup here
      }
    };
  }, [player]); // Added player as dependency

  return (
    <div>
      <p>WebSocket status: {isConnected ? 'Connected' : 'Disconnected'}</p>
      <button 
        onClick={() => send('play')} 
        disabled={!isConnected}
      >
        Play
      </button>
      <button 
        onClick={() => send('pause')} 
        disabled={!isConnected}
      >
        Pause
      </button>
    </div>
  );
}
