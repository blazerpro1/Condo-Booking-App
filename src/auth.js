const { jsonHeaders } = require('./httpHeaders');

const BASE_URL = process.env.BASE_URL || 'https://api.advelsoft.my';

/**
 * Logs in with the credentials in .env and returns the bearer token
 * (the API calls it `userTokenNo`).
 * Throws if login fails or the response shape is unexpected.
 */
async function login() {
  const res = await fetch(`${BASE_URL}/login/loginCheck`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({
      email: process.env.LOGIN_EMAIL,
      password: process.env.LOGIN_PASSWORD,
    }),
  });

  const body = await res.json().catch(() => ({}));

  const token = body?.data?.[0]?.userTokenNo;
  if (body.status !== 'Success' || !token) {
    throw new Error(
      `Login failed (HTTP ${res.status}): ${body.message || 'unexpected response shape'}`
    );
  }

  return token;
}

module.exports = { login };
