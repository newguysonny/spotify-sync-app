const axios = require('axios');
const qs = require('querystring');

async function exchangeCodeForTokens(code) {
  const resp = await axios.post(
    'https://accounts.spotify.com/api/token',
    qs.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.REDIRECT_URI,
      client_id: process.env.SPOTIFY_CLIENT_ID,
      client_secret: process.env.SPOTIFY_CLIENT_SECRET
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return resp.data; // includes access_token, refresh_token, expires_in
}

module.exports = { exchangeCodeForTokens };
