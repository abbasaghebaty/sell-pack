/**
 * Telegram API Helper
 *
 * مسیر:
 * src/api/telegram.js
 */

const API_URL = 'https://api.telegram.org';
const REQUEST_TIMEOUT = 10000;

function createTimeoutError() {
  return new Error('Telegram request timeout');
}

async function sendRequest(
  botToken,
  method,
  data
) {
  if (
    typeof botToken !== 'string' ||
    !botToken.trim()
  ) {
    throw new Error('Bot token is required');
  }

  const url =
    `${API_URL}/bot${botToken}/${method}`;

  const controller =
    new AbortController();

  const timeoutId =
    setTimeout(() => {
      controller.abort();
    }, REQUEST_TIMEOUT);

  try {
    console.log(
      `🔄 Telegram API: ${method}`
    );

    const response = await fetch(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        signal: controller.signal,
      }
    );

    const rawText =
      await response.text();

    let result;

    try {
      result =
        JSON.parse(rawText);
    } catch {
      throw new Error(
        `Telegram returned invalid JSON. HTTP ${response.status}`
      );
    }

    if (!response.ok) {
      throw new Error(
        `Telegram HTTP ${response.status}: ${
          result?.description ||
          'Unknown error'
        }`
      );
    }

    if (!result?.ok) {
      throw new Error(
        `Telegram API error: ${
          result?.description ||
          'Unknown Telegram error'
        }`
      );
    }

    console.log(
      `✅ Telegram API success: ${method}`
    );

    return result;

  } catch (error) {

    if (
      error?.name === 'AbortError'
    ) {
      throw createTimeoutError();
    }

    console.error(
      `❌ Telegram API failed (${method}):`,
      error.message
    );

    throw error;

  } finally {
    clearTimeout(timeoutId);
  }
}

export async function sendMessage(
  botToken,
  chatId,
  text,
  keyboard = null
) {
  if (
    chatId === undefined ||
    chatId === null
  ) {
    throw new Error('Chat ID is required');
  }

  if (
    typeof text !== 'string' ||
    !text.trim()
  ) {
    throw new Error('Message text is required');
  }

  const data = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
  };

  if (keyboard) {
    data.reply_markup = keyboard;
  }

  return await sendRequest(
    botToken,
    'sendMessage',
    data
  );
}

export async function answerCallbackQuery(
  botToken,
  callbackQueryId,
  text = null,
  showAlert = false
) {
  if (!callbackQueryId) {
    throw new Error(
      'Callback query ID is required'
    );
  }

  const data = {
    callback_query_id:
      callbackQueryId,
  };

  if (
    typeof text === 'string' &&
    text.trim()
  ) {
    data.text = text;
    data.show_alert = Boolean(
      showAlert
    );
  }

  return await sendRequest(
    botToken,
    'answerCallbackQuery',
    data
  );
}

export default {
  sendMessage,
  answerCallbackQuery,
};
