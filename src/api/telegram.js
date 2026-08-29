/**
 * Telegram API Helper
 */

const TELEGRAM_API = 'https://api.telegram.org';
const REQUEST_TIMEOUT = 10000;

async function telegramRequest(botToken, method, payload = {}) {
  if (typeof botToken !== 'string' || !botToken.trim()) {
    throw new Error('Telegram bot token is required');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await fetch(`${TELEGRAM_API}/bot${botToken}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const responseText = await response.text();
    let result;

    try {
      result = JSON.parse(responseText);
    } catch {
      throw new Error(`Invalid Telegram response. HTTP ${response.status}`);
    }

    if (!response.ok) {
      throw new Error(
        `Telegram HTTP ${response.status}: ${result?.description || 'Unknown error'}`
      );
    }

    if (!result?.ok) {
      throw new Error(`Telegram API error: ${result?.description || 'Unknown error'}`);
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

export async function sendMessage(botToken, chatId, text, replyMarkup = null) {
  const payload = { chat_id: chatId, text, parse_mode: 'HTML' };
  if (replyMarkup) payload.reply_markup = replyMarkup;
  return telegramRequest(botToken, 'sendMessage', payload);
}

export async function answerCallbackQuery(botToken, callbackQueryId, text = null, showAlert = false) {
  if (!callbackQueryId) throw new Error('Callback query ID is required');

  const payload = { callback_query_id: callbackQueryId };
  if (typeof text === 'string' && text.trim()) {
    payload.text = text;
    payload.show_alert = Boolean(showAlert);
  }

  return telegramRequest(botToken, 'answerCallbackQuery', payload);
}

export async function editMessageText(botToken, chatId, messageId, text, replyMarkup = null) {
  const payload = { chat_id: chatId, message_id: messageId, text, parse_mode: 'HTML' };
  if (replyMarkup) payload.reply_markup = replyMarkup;
  return telegramRequest(botToken, 'editMessageText', payload);
}

export async function deleteMessage(botToken, chatId, messageId) {
  return telegramRequest(botToken, 'deleteMessage', {
    chat_id: chatId,
    message_id: messageId,
  });
}

export async function createChatInviteLink(botToken, chatId, { name, expireDate }) {
  const result = await telegramRequest(botToken, 'createChatInviteLink', {
    chat_id: chatId,
    name,
    expire_date: expireDate,
    creates_join_request: true,
  });

  return result.result;
}

export async function revokeChatInviteLink(botToken, chatId, inviteLink) {
  return telegramRequest(botToken, 'revokeChatInviteLink', {
    chat_id: chatId,
    invite_link: inviteLink,
  });
}

export async function approveChatJoinRequest(botToken, chatId, userId) {
  return telegramRequest(botToken, 'approveChatJoinRequest', {
    chat_id: chatId,
    user_id: userId,
  });
}

export async function declineChatJoinRequest(botToken, chatId, userId) {
  return telegramRequest(botToken, 'declineChatJoinRequest', {
    chat_id: chatId,
    user_id: userId,
  });
}

export async function unbanChatMember(botToken, chatId, userId) {
  return telegramRequest(botToken, 'unbanChatMember', {
    chat_id: chatId,
    user_id: userId,
    only_if_banned: false,
  });
}

export default {
  sendMessage,
  answerCallbackQuery,
  editMessageText,
  deleteMessage,
  createChatInviteLink,
  revokeChatInviteLink,
  approveChatJoinRequest,
  declineChatJoinRequest,
  unbanChatMember,
};
