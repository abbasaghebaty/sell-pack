/**
 * Telegram API Helper
 *
 * مسیر:
 * src/api/telegram.js
 *
 * این فایل فقط برای ارسال درخواست‌های API به تلگرام است.
 */

const API_URL = 'https://api.telegram.org';

async function sendRequest(botToken, method, data) {
  const url = `${API_URL}/bot${botToken}/${method}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!result.ok) {
    throw new Error(`Telegram API error: ${result.description}`);
  }

  return result;
}

export async function sendMessage(botToken, chatId, text, keyboard = null) {
  const data = {
    chat_id: chatId,
    text: text,
    parse_mode: 'HTML',
  };

  if (keyboard) {
    data.reply_markup = keyboard;
  }

  return sendRequest(botToken, 'sendMessage', data);
}

export async function answerCallbackQuery(botToken, callbackQueryId, text = null, showAlert = false) {
  const data = {
    callback_query_id: callbackQueryId,
  };

  if (text) {
    data.text = text;
    data.show_alert = showAlert;
  }

  return sendRequest(botToken, 'answerCallbackQuery', data);
}

export default {
  sendMessage,
  answerCallbackQuery,
};
