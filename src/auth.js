const { jsonHeaders, authHeaders } = require('./httpHeaders');

const BASE_URL = process.env.BASE_URL || 'https://api.advelsoft.my';

/**
 * The real app always calls POST /device/create right after a successful
 * login, before using the token for anything else. Without this step, the
 * token from loginCheck is apparently not yet "activated" for other
 * authenticated endpoints (facilityRead, booking, etc).
 *
 * Device metadata values below are just descriptive fields matching what
 * a real iPhone sends - they don't need to match your actual device
 * exactly, but can be overridden via .env if the server ever starts
 * validating them more strictly.
 */
async function registerDevice(token) {
  const res = await fetch(`${BASE_URL}/device/create`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      deviceAppVersion: process.env.DEVICE_APP_VERSION || '1.3.23',
      deviceBuildVersion: process.env.DEVICE_BUILD_VERSION || '1',
      deviceName: 'iPhone',
      deviceBrand: 'Apple',
      deviceManufacturer: 'Apple',
      deviceOS: 'iOS',
      deviceOSVersion: process.env.DEVICE_OS_VERSION || '18.0',
      deviceModel: process.env.DEVICE_MODEL || 'iPhone',
      notificationID: process.env.NOTIFICATION_ID || '',
      notificationPushToken: process.env.NOTIFICATION_PUSH_TOKEN || '',
      notificationSubscribed: '0',
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (body.status !== 'Success') {
    throw new Error(
      `Device registration failed (HTTP ${res.status}): ${body.message || 'unexpected response shape'}`
    );
  }

  return body.deviceID;
}

/**
 * Logs in with the credentials in .env, then registers the device to
 * activate the token, and returns the bearer token (the API calls it
 * `userTokenNo`) ready for use on other authenticated endpoints.
 * Throws if login or device registration fails.
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

  await registerDevice(token);

  return token;
}

module.exports = { login };
