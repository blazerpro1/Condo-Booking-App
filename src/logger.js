const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function log(message) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}`;
  console.log(line);

  const fileName = `${timestamp.slice(0, 10)}.log`;
  const filePath = path.join(LOG_DIR, fileName);
  fs.appendFileSync(filePath, line + '\n');
}

module.exports = { log };
