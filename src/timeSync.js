const { log } = require('./logger');

const BASE_URL = process.env.BASE_URL || 'https://api.advelsoft.my';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * IMPORTANT CAVEAT:
 * HTTP `Date` response headers only have 1-SECOND resolution. This means
 * this check can catch gross clock drift (e.g. your PC's clock being
 * several seconds or minutes off) but cannot give millisecond-level
 * precision on its own.
 *
 * For the sub-second precision that actually matters at the midnight
 * rollover, we rely primarily on your PC's own NTP-synced clock (Windows
 * syncs periodically via time.windows.com) rather than this check.
 *
 * This function is a safety net: if it finds your local clock is off by
 * more than ~1.5s from the server, it logs a warning so you know to fix
 * your system clock sync before relying on the precise-fire logic.
 */
async function checkClockDrift(sampleCount = 5) {
  const offsets = [];

  for (let i = 0; i < sampleCount; i++) {
    const t0 = Date.now();
    let res;
    try {
      // Any endpoint that returns a Date header works; loginCheck without
      // a body will 400 but still returns headers, which is all we need.
      res = await fetch(`${BASE_URL}/login/loginCheck`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
    } catch (err) {
      log(`Clock drift check request failed: ${err.message}`);
      continue;
    }
    const t1 = Date.now();

    const dateHeader = res.headers.get('date');
    if (dateHeader) {
      const serverTime = new Date(dateHeader).getTime();
      const rtt = t1 - t0;
      const localMidpoint = t0 + rtt / 2;
      offsets.push(serverTime - localMidpoint);
    }

    await sleep(150);
  }

  if (offsets.length === 0) {
    log('Clock drift check: no samples succeeded, skipping drift warning.');
    return 0;
  }

  offsets.sort((a, b) => a - b);
  const median = offsets[Math.floor(offsets.length / 2)];

  if (Math.abs(median) > 1500) {
    log(
      `WARNING: local clock appears to be off from the server by ~${median}ms ` +
        `(beyond the ~1s resolution of the Date header). Check your PC's time sync.`
    );
  } else {
    log(`Clock drift check: local clock within ~${median}ms of server (in line with Date header resolution).`);
  }

  return median;
}

/**
 * Measures round-trip latency to the API using a lightweight authenticated
 * GET call, so we can fire the actual booking request slightly early to
 * compensate (aiming for the request to *arrive* at the target time, not
 * just *leave* your PC at the target time).
 */
async function measureLatency(token, sampleCount = 5) {
  const rtts = [];

  for (let i = 0; i < sampleCount; i++) {
    const t0 = Date.now();
    try {
      await fetch(`${BASE_URL}/authenticated/home/facilities/facilityRead`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'wy-user-agent': process.env.WY_USER_AGENT,
        },
      });
    } catch (err) {
      continue;
    }
    rtts.push(Date.now() - t0);
    await sleep(150);
  }

  if (rtts.length === 0) return 0;

  rtts.sort((a, b) => a - b);
  const median = rtts[Math.floor(rtts.length / 2)];
  log(`Measured median RTT to API: ${median}ms`);
  return median;
}

module.exports = { checkClockDrift, measureLatency };
