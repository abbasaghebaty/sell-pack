const TELEGRAM_API =
  'https://api.telegram.org';

const REQUEST_TIMEOUT =
  15_000;

async function telegramRequest(
  botToken,
  method,
  payload = {}
) {
  if (
    typeof botToken !==
      'string' ||
    !botToken.trim()
  ) {
    throw new Error(
      'Telegram bot token is required.'
    );
  }

  const controller =
    new AbortController();

  const timeoutId =
    setTimeout(
      () =>
        controller.abort(),
      REQUEST_TIMEOUT
    );

  try {
    const response =
      await fetch(
        `${TELEGRAM_API}/bot${botToken}/${method}`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body:
            JSON.stringify(
              payload
            ),

          signal:
            controller.signal,
        }
      );

    const text =
      await response.text();

    let result;

    try {
      result = text
        ? JSON.parse(text)
        : {};
    } catch {
      throw new Error(
        `Invalid Telegram response. HTTP ${response.status}`
      );
    }

    if (
      !response.ok ||
      !result?.ok
    ) {
      throw new Error(
        `Telegram ${method} failed: HTTP ${response.status}: ${
          result?.description ||
          'Unknown error'
        }`
      );
    }

    return result;
  } catch (error) {
    if (
      error?.name ===
      'AbortError'
    ) {
      throw new Error(
        `Telegram ${method} timed out.`
      );
    }

    throw error;
  } finally {
    clearTimeout(
      timeoutId
    );
  }
}

export function sendMessage(
  botToken,
  chatId,
  text,
  replyMarkup = null
) {
  const payload = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
  };

  if (replyMarkup) {
    payload.reply_markup =
      replyMarkup;
  }

  return telegramRequest(
    botToken,
    'sendMessage',
    payload
  );
}

export function answerCallbackQuery(
  botToken,
  callbackQueryId,
  text = null,
  showAlert = false
) {
  const payload = {
    callback_query_id:
      callbackQueryId,
  };

  if (
    typeof text ===
      'string' &&
    text.trim()
  ) {
    payload.text = text;
    payload.show_alert =
      Boolean(showAlert);
  }

  return telegramRequest(
    botToken,
    'answerCallbackQuery',
    payload
  );
}

export function editMessageText(
  botToken,
  chatId,
  messageId,
  text,
  replyMarkup = null
) {
  const payload = {
    chat_id: chatId,
    message_id:
      messageId,
    text,
    parse_mode: 'HTML',
  };

  if (replyMarkup) {
    payload.reply_markup =
      replyMarkup;
  }

  return telegramRequest(
    botToken,
    'editMessageText',
    payload
  );
}

export function deleteMessage(
  botToken,
  chatId,
  messageId
) {
  return telegramRequest(
    botToken,
    'deleteMessage',
    {
      chat_id:
        chatId,

      message_id:
        messageId,
    }
  );
}

export async function createChatInviteLink(
  botToken,
  chatId,
  {
    name,
    expireDate,
  }
) {
  const result =
    await telegramRequest(
      botToken,
      'createChatInviteLink',
      {
        chat_id:
          chatId,

        name:
          name ?? null,

        expire_date:
          expireDate,

        creates_join_request:
          true,
      }
    );

  return result.result;
}

export function revokeChatInviteLink(
  botToken,
  chatId,
  inviteLink
) {
  return telegramRequest(
    botToken,
    'revokeChatInviteLink',
    {
      chat_id:
        chatId,

      invite_link:
        inviteLink,
    }
  );
}

export function approveChatJoinRequest(
  botToken,
  chatId,
  userId
) {
  return telegramRequest(
    botToken,
    'approveChatJoinRequest',
    {
      chat_id:
        chatId,

      user_id:
        userId,
    }
  );
}

export function declineChatJoinRequest(
  botToken,
  chatId,
  userId
) {
  return telegramRequest(
    botToken,
    'declineChatJoinRequest',
    {
      chat_id:
        chatId,

      user_id:
        userId,
    }
  );
}

export function unbanChatMember(
  botToken,
  chatId,
  userId
) {
  return telegramRequest(
    botToken,
    'unbanChatMember',
    {
      chat_id:
        chatId,

      user_id:
        userId,

      only_if_banned:
        false,
    }
  );
}

export function getChatMember(
  botToken,
  chatId,
  userId
) {
  return telegramRequest(
    botToken,
    'getChatMember',
    {
      chat_id:
        chatId,

      user_id:
        userId,
    }
  );
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
  getChatMember,
};
