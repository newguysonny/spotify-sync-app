import React, { useEffect, useState } from 'react';
import { spotifyPlayerInit } from './spotifyPlayer';

export default function App() {
  const [player, setPlayer] = useState(null);
  const [ws, setWs] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('spotifyAccessToken');
    if (!token) return;

    spotifyPlayerInit(token).then(setPlayer);

    const socket = new WebSocket('ws://localhost:4000');
    socket.onmessage = msg => {
      const { action } = JSON.parse(msg.data);
      if (!player) return;
      if (action === 'play') player.resume();
      if (action === 'pause') player.pause();
    };
    setWs(socket);
  }, []);

  const send = action => ws.send(JSON.stringify({ roomId: 'room1', action }));

  return (
    <div>
      <button onClick={() => send('play')}>Play</button>
      <button onClick={() => send('pause')}>Pause</button>
    </div>
  );
}
