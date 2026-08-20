/**
 * Telegram API Helper
 *
 * مسیر:
 * src/api/telegram.js
 */

const TELEGRAM_API = 'https://api.telegram.org';
const REQUEST_TIMEOUT = 10000;

async function telegramRequest(
  botToken,
  method,
  payload = {}
) {
  if (
    typeof botToken !== 'string' ||
    !botToken.trim()
  ) {
    throw new Error('Telegram bot token is required');
  }

  const controller = new AbortController();

  const timeoutId = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT
  );

  try {
    const response = await fetch(
      `${TELEGRAM_API}/bot${botToken}/${method}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      }
    );

    const responseText = await response.text();

    let result;

    try {
      result = JSON.parse(responseText);
    } catch {
      throw new Error(
        `Invalid Telegram response. HTTP ${response.status}`
      );
    }

    if (!response.ok) {
      throw new Error(
        `Telegram HTTP ${response.status}: ${
          result?.description || 'Unknown error'
        }`
      );
    }

    if (!result?.ok) {
      throw new Error(
        `Telegram API error: ${
          result?.description || 'Unknown error'
        }`
      );
    }

    return result;
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('Telegram API request timed out');
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}


export async function sendMessage(
  botToken,
  chatId,
  text,
  replyMarkup = null
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

  const payload = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
  };

  if (replyMarkup) {
    payload.reply_markup = replyMarkup;
  }

  return await telegramRequest(
    botToken,
    'sendMessage',
    payload
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

  const payload = {
    callback_query_id: callbackQueryId,
  };

  if (
    typeof text === 'string' &&
    text.trim()
  ) {
    payload.text = text;
    payload.show_alert = Boolean(showAlert);
  }

  return await telegramRequest(
    botToken,
    'answerCallbackQuery',
    payload
  );
}


export async function editMessageText(
  botToken,
  chatId,
  messageId,
  text,
  replyMarkup = null
) {
  const payload = {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: 'HTML',
  };

  if (replyMarkup) {
    payload.reply_markup = replyMarkup;
  }

  return await telegramRequest(
    botToken,
    'editMessageText',
    payload
  );
}


export async function deleteMessage(
  botToken,
  chatId,
  messageId
) {
  return await telegramRequest(
    botToken,
    'deleteMessage',
    {
      chat_id: chatId,
      message_id: messageId,
    }
  );
}


export default {
  sendMessage,
  answerCallbackQuery,
  editMessageText,
  deleteMessage,
};
