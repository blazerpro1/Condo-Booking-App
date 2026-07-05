require('dotenv').config();
const { login } = require('../src/auth');

(async () => {
  try {
    const token = await login();
    console.log('Login succeeded. Token (truncated):', token.slice(0, 20) + '...');
  } catch (err) {
    console.error('Login failed:', err.message);
    process.exit(1);
  }
})();
