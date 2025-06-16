import axios from 'axios';
import { stringify } from 'querystring';

async function exchangeCodeForTokens(code) {
  const resp = await axios.post(
    'https://accounts.spotify.com/api/token',
    stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.REDIRECT_URL,
      client_id: process.env.SPOTIFY_CLIENT_ID,
      client_secret: process.env.SPOTIFY_CLIENT_SECRET
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return resp.data; // { access_token, refresh_token, expires_in }
}

// Named export (ESM alternative to module.exports)
export { exchangeCodeForTokens };
