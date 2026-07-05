require('dotenv').config();
const { notify } = require('../src/notify');

(async () => {
  await notify('🔔 CSP NENE CSP from condo-booking-bot. If you see this, Telegram notifications are working.');
  console.log('Test notification sent (check Telegram).');
})();
