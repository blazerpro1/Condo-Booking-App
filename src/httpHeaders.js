// Matches the headers the real iOS app sends, captured via traffic
// inspection. The API appears to reject requests missing a recognized
// User-Agent, even with valid credentials/token.
const APP_USER_AGENT = process.env.APP_USER_AGENT || 'WooYoo20/1 CFNetwork/3860.600.12 Darwin/25.5.0';

function baseHeaders() {
  return {
    Accept: 'application/json',
    'Accept-Language': 'en-GB,en;q=0.9',
    'User-Agent': APP_USER_AGENT,
    'wy-user-agent': process.env.WY_USER_AGENT,
  };
}

function jsonHeaders() {
  return {
    ...baseHeaders(),
    'Content-Type': 'application/json',
  };
}

function authHeaders(token) {
  return {
    ...jsonHeaders(),
    Authorization: `Bearer ${token}`,
  };
}

module.exports = { baseHeaders, jsonHeaders, authHeaders };
