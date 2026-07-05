const { DateTime } = require('luxon');
const { login } = require('./auth');
const { createBooking } = require('./bookingClient');
const { checkClockDrift, measureLatency } = require('./timeSync');
const { notify } = require('./notify');
const { log } = require('./logger');

const ZONE = 'Asia/Kuala_Lumpur';

const BOOKING_TYPE_IDS = (process.env.BOOKING_TYPE_IDS || process.env.BOOKING_TYPE_ID || '5')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const ADVANCE_DAYS = parseInt(process.env.ADVANCE_DAYS || '14', 10);
const TARGET_WEEKDAY = parseInt(process.env.TARGET_WEEKDAY || '1', 10); // luxon: 1=Monday
const BOOKED_FROM_HOUR = parseInt(process.env.BOOKED_FROM_HOUR || '20', 10);
const BOOKED_TO_HOUR = parseInt(process.env.BOOKED_TO_HOUR || '22', 10);
const BURST_INTERVAL_MS = parseInt(process.env.BURST_INTERVAL_MS || '200', 10);
const BURST_MAX_DURATION_MS = parseInt(process.env.BURST_MAX_DURATION_MS || '8000', 10);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Classifies a booking API response into a known outcome based on the
 * message shapes we reverse-engineered:
 *   - success
 *   - not_open_yet   ("Invalid Value. Please try again!")
 *   - slot_taken     ("...already been taken...")
 *   - auth_error     ("Access Denied." or HTTP 403)
 *   - unknown        (anything else - treat cautiously)
 */
function classify(httpStatus, body) {
  if (body.status === 'Success') {
    return { success: true, bookingID: body.data?.bookingID };
  }

  const msg = body.message || '';

  if (msg.includes('already been taken')) {
    return { success: false, reason: 'slot_taken', message: msg };
  }
  if (msg.includes('Invalid Value')) {
    return { success: false, reason: 'not_open_yet', message: msg };
  }
  if (msg.includes('Access Denied') || httpStatus === 403) {
    return { success: false, reason: 'auth_error', message: msg || `HTTP ${httpStatus}` };
  }
  return { success: false, reason: 'unknown', message: msg || `HTTP ${httpStatus}` };
}

async function attemptBooking(token, payload) {
  const { httpStatus, body } = await createBooking(token, payload);
  return classify(httpStatus, body);
}

/**
 * Sleeps until close to the target time, then busy-waits the final
 * stretch using high-resolution timing for sub-millisecond precision.
 * The busy-wait intentionally blocks the event loop for ~1s - acceptable
 * since this process does nothing else during that window.
 */
async function waitUntilPrecise(targetEpochMs) {
  const coarseRemaining = targetEpochMs - Date.now() - 1000;
  if (coarseRemaining > 0) {
    await sleep(coarseRemaining);
  }
  while (Date.now() < targetEpochMs) {
    // tight spin for final sub-second precision
  }
}

async function burstFallback(token, payload) {
  const start = Date.now();
  let lastResult;
  let currentToken = token;

  while (Date.now() - start < BURST_MAX_DURATION_MS) {
    lastResult = await attemptBooking(currentToken, payload);

    if (lastResult.success || lastResult.reason === 'slot_taken') {
      return lastResult;
    }

    if (lastResult.reason === 'auth_error') {
      log(`Burst fallback (bookingTypeID ${payload.bookingTypeID}) hit an auth error, re-logging in.`);
      try {
        currentToken = await login();
      } catch (err) {
        log(`Re-login during burst fallback failed: ${err.message}`);
      }
    }

    await sleep(BURST_INTERVAL_MS);
  }

  return lastResult;
}

/**
 * Runs the full attempt -> (optional burst fallback) sequence for a single
 * court, independently of the others, so one court's retries don't block
 * or interfere with another's.
 */
async function bookOneCourt(token, bookingTypeID, targetDate) {
  const payload = {
    bookingTypeID,
    bookedDate: targetDate.toISODate(),
    bookedFrom: BOOKED_FROM_HOUR,
    bookedTo: BOOKED_TO_HOUR,
  };

  log(`[court ${bookingTypeID}] Firing single precise attempt: ${JSON.stringify(payload)}`);
  let result = await attemptBooking(token, payload);
  log(`[court ${bookingTypeID}] First attempt result: ${JSON.stringify(result)}`);

  if (!result.success && result.reason === 'not_open_yet') {
    log(`[court ${bookingTypeID}] Not open yet on first attempt - entering burst fallback.`);
    result = await burstFallback(token, payload);
    log(`[court ${bookingTypeID}] Burst fallback result: ${JSON.stringify(result)}`);
  }

  return { bookingTypeID, payload, result };
}

async function run() {
  const runNow = process.argv.includes('--now') || process.env.RUN_NOW === '1';

  const nowMYT = DateTime.now().setZone(ZONE);

  // The booking fires at the UPCOMING midnight (unless --now). At that
  // moment the calendar date has rolled over to the next day, so the date
  // entering the booking window is (that next day) + ADVANCE_DAYS.
  // In --now mode we're firing immediately, so "today" is the reference.
  const fireDay = runNow ? nowMYT.startOf('day') : nowMYT.plus({ days: 1 }).startOf('day');
  const targetDate = fireDay.plus({ days: ADVANCE_DAYS }).startOf('day');

  if (targetDate.weekday !== TARGET_WEEKDAY) {
    log(
      `Target date ${targetDate.toISODate()} (weekday ${targetDate.weekday}) is not the ` +
        `configured target weekday (${TARGET_WEEKDAY}). Nothing to do tonight.`
    );
    return;
  }

  log(`Target date ${targetDate.toISODate()} matches configured weekday. Preparing booking run.`);

  await checkClockDrift();

  let token;
  try {
    token = await login();
    log('Login successful, token acquired.');
  } catch (err) {
    log(`Login failed: ${err.message}`);
    await notify(`❌ Booking bot: login failed before midnight run.\n${err.message}`);
    return;
  }

  const latencyMs = await measureLatency(token);

  if (runNow) {
    log('RUN NOW mode: skipping midnight wait, firing immediately.');
  } else {
    const nextMidnight = nowMYT.plus({ days: 1 }).startOf('day');
    const fireAtEpochMs = nextMidnight.toMillis() - Math.round(latencyMs / 2);

    log(
      `Waiting until ${new Date(fireAtEpochMs).toISOString()} ` +
        `(midnight MYT minus ${Math.round(latencyMs / 2)}ms latency compensation).`
    );

    await waitUntilPrecise(fireAtEpochMs);
  }

  log(`Firing precise attempts for courts: ${BOOKING_TYPE_IDS.join(', ')}`);

  // Fire all courts independently and in parallel, so a burst-fallback
  // retry loop on one court doesn't delay the others' first attempt.
  const outcomes = await Promise.all(
    BOOKING_TYPE_IDS.map((bookingTypeID) => bookOneCourt(token, bookingTypeID, targetDate))
  );

  const successes = outcomes.filter((o) => o.result.success);
  const failures = outcomes.filter((o) => !o.result.success);

  for (const o of successes) {
    log(`[court ${o.bookingTypeID}] Booking succeeded. bookingID=${o.result.bookingID}`);
  }
  for (const o of failures) {
    log(`[court ${o.bookingTypeID}] Booking failed. reason=${o.result.reason} message=${o.result.message}`);
  }

  const lines = [];
  if (successes.length > 0) {
    lines.push(
      `Booked ${successes.length}/${BOOKING_TYPE_IDS.length} court(s) for ${targetDate.toISODate()}, ` +
        `${BOOKED_FROM_HOUR}:00-${BOOKED_TO_HOUR}:00:`
    );
    for (const o of successes) {
      lines.push(`   - Court ${o.bookingTypeID}: booking ID ${o.result.bookingID}`);
    }
  }
  if (failures.length > 0) {
    lines.push(`Failed to book ${failures.length} court(s):`);
    for (const o of failures) {
      lines.push(`   - Court ${o.bookingTypeID}: ${o.result.message}`);
    }
  }

  await notify(lines.join('\n'));
}

module.exports = { run, classify };
