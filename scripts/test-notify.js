require('dotenv').config();
const { notify } = require('../src/notify');

(async () => {
  await notify('🔔 Test message from condo-booking-bot. If you see this, Telegram notifications are working.');
  console.log('Test notification sent (check Telegram).');
})();
