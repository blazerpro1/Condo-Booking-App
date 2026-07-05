const { log } = require('./logger');

function getChatIds() {
  return (process.env.TELEGRAM_CHAT_ID || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function sendToChat(token, chatId, message) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message }),
    });
    if (!res.ok) {
      const body = await res.text();
      log(`Telegram notification to ${chatId} failed (HTTP ${res.status}): ${body}`);
    }
  } catch (err) {
    log(`Telegram notification to ${chatId} error: ${err.message}`);
  }
}

async function notify(message) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatIds = getChatIds();

  if (!token || chatIds.length === 0) {
    log(`Telegram not configured - would have sent: ${message}`);
    return;
  }

  await Promise.all(chatIds.map((chatId) => sendToChat(token, chatId, message)));
}

module.exports = { notify };
