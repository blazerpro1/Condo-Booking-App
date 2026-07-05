const { authHeaders } = require('./httpHeaders');

const BASE_URL = process.env.BASE_URL || 'https://api.advelsoft.my';

/**
 * Read the rolling 14-day availability window for a given bookingTypeID.
 * Mainly useful for sanity-checking / dry runs, not required for the
 * actual booking call itself.
 */
async function getFacilityDetail(token, bookingTypeID) {
  const res = await fetch(
    `${BASE_URL}/authenticated/home/facilities/facilityDetailedRead?bookingTypeID=${bookingTypeID}`,
    { headers: authHeaders(token) }
  );
  return { httpStatus: res.status, body: await res.json().catch(() => ({})) };
}

/**
 * Fire the actual booking request.
 * Returns the raw HTTP status + parsed body - classification of
 * success/failure happens one level up in scheduler.js.
 */
async function createBooking(token, payload) {
  const res = await fetch(`${BASE_URL}/authenticated/home/facilities/booking`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  return { httpStatus: res.status, body: await res.json().catch(() => ({})) };
}

module.exports = { getFacilityDetail, createBooking };
