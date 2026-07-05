const { log } = require('./logger');

async function notify(message) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    log(`Telegram not configured - would have sent: ${message}`);
    return;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message }),
    });
    if (!res.ok) {
      const body = await res.text();
      log(`Telegram notification failed (HTTP ${res.status}): ${body}`);
    }
  } catch (err) {
    log(`Telegram notification error: ${err.message}`);
  }
}

module.exports = { notify };
