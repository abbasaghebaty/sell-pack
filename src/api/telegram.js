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
  if (!botToken) {
    throw new Error('Bot token is required');
  }

  const url = `${API_URL}/bot${botToken}/${method}`;

  console.log(`Sending Telegram request: ${method} to chat ${data.chat_id}`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!result.ok) {
      console.error(`Telegram API error: ${result.description}`, result);
      throw new Error(`Telegram API error: ${result.description}`);
    }

    console.log(`Telegram request successful: ${method}`);
    return result;
  } catch (error) {
    console.error(`Error sending Telegram request: ${error.message}`);
    throw error;
  }
}

export async function sendMessage(botToken, chatId, text, keyboard = null) {
  try {
    const data = {
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML',
    };

    if (keyboard) {
      data.reply_markup = keyboard;
    }

    return sendRequest(botToken, 'sendMessage', data);
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
}

export async function answerCallbackQuery(botToken, callbackQueryId, text = null, showAlert = false) {
  try {
    const data = {
      callback_query_id: callbackQueryId,
    };

    if (text) {
      data.text = text;
      data.show_alert = showAlert;
    }

    return sendRequest(botToken, 'answerCallbackQuery', data);
  } catch (error) {
    console.error('Error answering callback query:', error);
    throw error;
  }
}

export default {
  sendMessage,
  answerCallbackQuery,
};
