const { authHeaders } = require('./httpHeaders');

const BASE_URL = process.env.BASE_URL || 'https://api.advelsoft.my';

/**
 * Auth model (reverse-engineered):
 *
 * - The working session token for authenticated endpoints (booking,
 *   facilityRead, etc.) is `userTokenNo`.
 * - `userTokenNo` is minted by a fresh email+password POST /login/loginCheck.
 * - CRUCIALLY: the app always sends a persistent "master" token in the
 *   Authorization: Bearer header even on the loginCheck call itself. Sending
 *   email+password WITHOUT this header is rejected with 403 "Access Denied".
 *   This was the cause of our earlier login failures.
 * - The master token (MASTER_TOKEN in .env) is long-lived and stored on the
 *   device; it survives app restarts. It does NOT work directly on booking
 *   endpoints - it only authorizes the login/token-validation calls.
 *
 * So the login flow is:
 *   POST /login/loginCheck
 *     headers: Authorization: Bearer <MASTER_TOKEN>
 *     body:    { email, password }
 *   -> returns fresh userTokenNo (the session token used for everything else)
 */

function getMasterToken() {
  const master = process.env.MASTER_TOKEN;
  if (!master) {
    throw new Error('MASTER_TOKEN is not set in .env');
  }
  return master;
}

/**
 * Performs a fresh email+password login (authorized by the master token)
 * and returns a fresh session token (userTokenNo) usable for booking/read
 * endpoints. Throws if login fails or the response shape is unexpected.
 */
async function login() {
  const masterToken = getMasterToken();

  const res = await fetch(`${BASE_URL}/login/loginCheck`, {
    method: 'POST',
    headers: authHeaders(masterToken),
    body: JSON.stringify({
      email: process.env.LOGIN_EMAIL,
      password: process.env.LOGIN_PASSWORD,
    }),
  });

  const body = await res.json().catch(() => ({}));

  const sessionToken = body?.data?.[0]?.userTokenNo;
  if (body.status !== 'Success' || !sessionToken) {
    throw new Error(
      `Login failed (HTTP ${res.status}): ${body.message || 'unexpected response shape'} ` +
        `- if this says "Access Denied", the MASTER_TOKEN may be stale; re-capture it from the app.`
    );
  }

  return sessionToken;
}

module.exports = { login };
