export function spotifyPlayerInit(token) {
  return new Promise(resolve => {
    window.onSpotifyWebPlaybackSDKReady = () => {
      const player = new Spotify.Player({
        name: 'Sync Party Player',
        getOAuthToken: cb => cb(token),
        volume: 0.8
      });
      player.connect().then(success => success && resolve(player));
    };
    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    document.body.appendChild(script);
  });
}
