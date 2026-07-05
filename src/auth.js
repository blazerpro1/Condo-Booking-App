const { authHeaders } = require('./httpHeaders');

const BASE_URL = process.env.BASE_URL || 'https://api.advelsoft.my';

/**
 * The app authenticates using a long-lived "master" token that is stored
 * persistently on the device and survives logout / app restarts. This
 * token is sent as the Authorization: Bearer header. The actual login
 * flow the app performs on launch is:
 *
 *   1. POST /superTokenCheck   (master token) -> validates the master token
 *   2. POST /login/tokenCheck  (master token) -> returns a fresh short-lived
 *                                                session token (userTokenNo)
 *
 * The session token returned by step 2 is what must be used for all other
 * authenticated endpoints (facilityDetailedRead, booking, etc). The master
 * token itself does NOT work directly on those endpoints.
 *
 * Set MASTER_TOKEN in .env to the persistent token captured from the app's
 * superTokenCheck / tokenCheck Authorization header.
 */

function getMasterToken() {
  const master = process.env.MASTER_TOKEN;
  if (!master) {
    throw new Error('MASTER_TOKEN is not set in .env');
  }
  return master;
}

async function superTokenCheck(masterToken) {
  const res = await fetch(`${BASE_URL}/superTokenCheck`, {
    method: 'POST',
    headers: authHeaders(masterToken),
    body: '{}',
  });
  const body = await res.json().catch(() => ({}));
  if (body.status !== 'Success') {
    throw new Error(
      `superTokenCheck failed (HTTP ${res.status}): ${body.message || 'unexpected response'} ` +
        `- the MASTER_TOKEN may be stale; re-capture it from the app.`
    );
  }
  return true;
}

async function tokenCheck(masterToken) {
  const res = await fetch(`${BASE_URL}/login/tokenCheck`, {
    method: 'POST',
    headers: authHeaders(masterToken),
    body: '{}',
  });
  const body = await res.json().catch(() => ({}));
  const sessionToken = body?.data?.[0]?.userTokenNo;
  if (body.status !== 'Success' || !sessionToken) {
    throw new Error(
      `tokenCheck failed (HTTP ${res.status}): ${body.message || 'unexpected response shape'}`
    );
  }
  return sessionToken;
}

/**
 * Performs the full auth handshake using the persistent master token and
 * returns a fresh session token (userTokenNo) usable for booking/read
 * endpoints.
 */
async function login() {
  const masterToken = getMasterToken();
  await superTokenCheck(masterToken);
  const sessionToken = await tokenCheck(masterToken);
  return sessionToken;
}

module.exports = { login };
