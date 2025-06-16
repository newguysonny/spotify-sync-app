import React, { useState, useEffect, useCallback } from 'react';
import { spotifyPlayerInit } from './spotifyPlayer';

export default function App({ socket }) {
  const [player, setPlayer] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(null);

  // Initialize Spotify Player
  useEffect(() => {
    const token = localStorage.getItem('spotifyAccessToken');
    if (!token) return;

    spotifyPlayerInit(token)
      .then(player => {
        setPlayer(player);
        
        // Set up player event listeners
        player.addListener('player_state_changed', state => {
          if (state?.track_window?.current_track) {
            setCurrentTrack(state.track_window.current_track);
            // Broadcast track change to room
            socket.send(JSON.stringify({
              roomId: 'default',
              action: 'TRACK_UPDATE',
              data: state.track_window.current_track
            }));
          }
        });
      })
      .catch(error => {
        console.error('Player initialization error:', error);
        socket.send(JSON.stringify({
          type: 'ERROR',
          message: 'Player init failed'
        }));
      });

    return () => {
      if (player) {
        player.disconnect();
      }
    };
  }, []);

  // WebSocket message handler
  useEffect(() => {
    if (!socket) return;

    const handleMessage = (event) => {
      try {
        const { action, data } = JSON.parse(event.data);
        
        switch (action) {
          case 'PLAY':
            player?.resume();
            break;
          case 'PAUSE':
            player?.pause();
            break;
          case 'SYNC_TRACK':
            if (data?.uri) {
              player?.activateElement().then(() => {
                player?.play({ uris: [data.uri] });
              });
            }
            break;
          default:
            console.log('Unhandled action:', action);
        }
      } catch (error) {
        console.error('Message handling error:', error);
      }
    };

    socket.onmessage = handleMessage;
    socket.onopen = () => setIsConnected(true);
    socket.onclose = () => setIsConnected(false);

    return () => {
      socket.onmessage = null;
    };
  }, [player, socket]);

  // Send actions to server
  const sendAction = useCallback((action, data = {}) => {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        roomId: 'default',
        action,
        data
      }));
    }
  }, [socket]);

  // UI Controls
  const handlePlay = () => sendAction('PLAY');
  const handlePause = () => sendAction('PAUSE');
  const handleSync = () => {
    if (currentTrack) {
      sendAction('SYNC_TRACK', { uri: currentTrack.uri });
    }
  };

  return (
    <div className="app-container">
      <div className="connection-status">
        WebSocket: {isConnected ? '✅ Connected' : '❌ Disconnected'}
      </div>
      
      {player ? (
        <div className="player-controls">
          <button onClick={handlePlay}>Play</button>
          <button onClick={handlePause}>Pause</button>
          {currentTrack && (
            <button onClick={handleSync}>
              Sync "{currentTrack.name}" to Room
            </button>
          )}
          
          {currentTrack && (
            <div className="now-playing">
              <img 
                src={currentTrack.album.images[0]?.url} 
                alt="Album cover" 
                width={100}
              />
              <div>
                <h3>{currentTrack.name}</h3>
                <p>{currentTrack.artists.map(a => a.name).join(', ')}</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="auth-message">
          Please authenticate with Spotify
        </div>
      )}
    </div>
  );
}
