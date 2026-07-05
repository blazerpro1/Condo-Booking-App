require('dotenv').config();
const { log } = require('./src/logger');
const { run } = require('./src/scheduler');

run()
  .then(() => {
    log('Run complete.');
    process.exit(0);
  })
  .catch((err) => {
    log(`Unhandled error in scheduler run: ${err.stack || err.message}`);
    process.exit(1);
  });
