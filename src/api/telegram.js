/**
 * Telegram API Helper
 *
 * مسیر:
 * src/api/telegram.js
 *
 * این فایل فقط برای ارسال درخواست‌های API به تلگرام است.
 */

const API_URL = 'https://api.telegram.org';
const REQUEST_TIMEOUT = 10000; // 10 seconds

// ✅ timeout برای requests
function createTimeoutPromise(timeoutMs) {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
  );
}

async function sendRequest(botToken, method, data) {
  if (!botToken) {
    throw new Error('Bot token is required');
  }

  if (!botToken.trim()) {
    throw new Error('Bot token is empty');
  }

  const url = `${API_URL}/bot${botToken}/${method}`;

  console.log(`🔄 Sending Telegram request: ${method} to chat ${data.chat_id}`);

  try {
    // ✅ timeout و better error handling
    const fetchPromise = fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const response = await Promise.race([
      fetchPromise,
      createTimeoutPromise(REQUEST_TIMEOUT),
    ]);

    if (!response || !response.ok) {
      console.error(`❌ HTTP error: ${response?.status || 'unknown'}`);
      throw new Error(`HTTP Error: ${response?.status || 'Unknown'}`);
    }

    const result = await response.json();

    if (!result.ok) {
      console.error(`❌ Telegram API error: ${result.description}`, result);
      throw new Error(`Telegram API error: ${result.description}`);
    }

    console.log(`✅ Telegram request successful: ${method}`);
    return result;
  } catch (error) {
    console.error(`❌ Error sending Telegram request (${method}):`, error.message);
    throw error;
  }
}

export async function sendMessage(botToken, chatId, text, keyboard = null) {
  try {
    if (!chatId) {
      throw new Error('Chat ID is required');
    }

    if (!text || !text.trim()) {
      throw new Error('Message text is required');
    }

    const data = {
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML',
    };

    if (keyboard) {
      data.reply_markup = keyboard;
    }

    return await sendRequest(botToken, 'sendMessage', data);
  } catch (error) {
    console.error('❌ Error sending message:', error.message);
    throw error;
  }
}

export async function answerCallbackQuery(botToken, callbackQueryId, text = null, showAlert = false) {
  try {
    if (!callbackQueryId) {
      throw new Error('Callback query ID is required');
    }

    const data = {
      callback_query_id: callbackQueryId,
    };

    if (text && text.trim()) {
      data.text = text;
      data.show_alert = showAlert;
    }

    return await sendRequest(botToken, 'answerCallbackQuery', data);
  } catch (error) {
    console.error('❌ Error answering callback query:', error.message);
    throw error;
  }
}

export default {
  sendMessage,
  answerCallbackQuery,
};
