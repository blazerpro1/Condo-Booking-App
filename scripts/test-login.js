require('dotenv').config();
const { login } = require('../src/auth');

(async () => {
  try {
    const token = await login();
    console.log('Login succeeded (loginCheck with master token).');
    console.log('Fresh session token (truncated):', token.slice(0, 20) + '...');
  } catch (err) {
    console.error('Auth flow failed:', err.message);
    process.exit(1);
  }
})();
