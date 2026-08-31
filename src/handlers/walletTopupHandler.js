import {
  sendMessage,
  editMessageText,
  deleteMessage,
  answerCallbackQuery,
} from '../api/telegram.js';

import {
  createBlupalInvoice,
} from '../api/blupal.js';

import {
  USER_STATES,
  setUserState,
  clearUserState,
  getUserState,
} from '../database/userStates.js';

import {
  createWalletTopup,
  attachWalletTopupInvoice,
  cancelWalletTopup,
  getWalletTopupById,
} from '../database/walletTopups.js';

import {
  createCancelTopupKeyboard,
} from '../../keyboards/walletTopup.js';

import {
  showMainMenu,
} from './menuHandler.js';

/*
 * واحد ورودی کاربر:
 *
 * 20 = 20,000 تومان
 *
 * بنابراین:
 * 10 = حداقل 10,000 تومان
 * 50,000 = حداکثر 50,000,000 تومان
 */
const TOPUP_INPUT_MULTIPLIER =
  1_000;

const MIN_TOPUP_INPUT =
  10;

const MAX_TOPUP_INPUT =
  50_000;

function parseAmount(value) {
  const normalized =
    String(value ?? '')
      .replace(/[,٬\u066C]/g, '')
      .replace(
        /[۰-۹]/g,
        (digit) =>
          String(
            '۰۱۲۳۴۵۶۷۸۹'.indexOf(
              digit,
            ),
          ),
      )
      .trim();

  if (
    !/^\d+$/.test(
      normalized,
    )
  ) {
    return null;
  }

  const amount =
    Number(normalized);

  if (
    !Number.isSafeInteger(
      amount,
    )
  ) {
    return null;
  }

  return amount;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getTelegramUserId(source) {
  return (
    source?.from?.id ??
    source?.message?.from?.id ??
    null
  );
}

function getChatId(source) {
  return (
    source?.chat?.id ??
    source?.message?.chat?.id ??
    null
  );
}

/*
 * حذف کیبورد Reply قبلی.
 *
 * چون کیبورد Home متعلق به پیام قبلی است،
 * صرفاً ویرایش پیام یا حذف پیام فاکتور
 * آن را حذف نمی‌کند.
 *
 * این پیام موقت کیبورد را حذف می‌کند،
 * سپس خود پیام موقت هم پاک می‌شود.
 */
async function hideReplyKeyboard(
  botToken,
  chatId,
) {
  try {
    const result =
      await sendMessage(
        botToken,
        chatId,
        '\u2060',
        {
          remove_keyboard: true,
        },
      );

    const messageId =
      result?.result?.message_id ??
      null;

    if (messageId) {
      try {
        await deleteMessage(
          botToken,
          chatId,
          messageId,
        );
      } catch (error) {
        console.warn(
          'Could not delete temporary keyboard message:',
          error.message,
        );
      }
    }
  } catch (error) {
    console.warn(
      'Could not hide reply keyboard:',
      error.message,
    );
  }
}

async function goToHome(
  botToken,
  callbackQuery,
  env,
) {
  const chatId =
    callbackQuery?.message?.chat?.id ??
    null;

  const user =
    callbackQuery?.from ??
    null;

  if (
    callbackQuery?.message?.message_id &&
    chatId
  ) {
    try {
      await deleteMessage(
        botToken,
        chatId,
        callbackQuery.message.message_id,
      );
    } catch (error) {
      console.warn(
        'Could not delete wallet top-up message:',
        error.message,
      );
    }
  }

  await answerCallbackQuery(
    botToken,
    callbackQuery.id,
  );

  return showMainMenu(
    {
      chat: {
        id: chatId,
      },
      from: {
        id: user?.id,
        first_name:
          user?.first_name,
        last_name:
          user?.last_name,
      },
    },
    env,
  );
}

export async function startWalletTopup(
  source,
  env,
  db,
) {
  const botToken =
    env?.TELEGRAM_BOT_TOKEN;

  const userId =
    getTelegramUserId(source);

  const chatId =
    getChatId(source);

  const sourceMessageId =
    source?.message_id ??
    source?.message?.message_id ??
    null;

  if (
    !botToken ||
    !userId ||
    !chatId
  ) {
    return;
  }

  if (!db) {
    return sendMessage(
      botToken,
      chatId,
      '❌ دیتابیس در دسترس نیست.',
    );
  }

  await setUserState(
    db,
    userId,
    USER_STATES.WAITING_FOR_WALLET_TOPUP_AMOUNT,
    {
      promptMessageId:
        sourceMessageId,
    },
  );

  if (source?.id) {
    await answerCallbackQuery(
      botToken,
      source.id,
    );
  }

  /*
   * حذف کیبورد Home
   * قبل از ورود به مرحله وارد کردن مبلغ.
   */
  await hideReplyKeyboard(
    botToken,
    chatId,
  );

  const promptText =
    `💳 <b>شارژ کیف پول</b>\n\n` +
    `مبلغ موردنظر را به هزار تومان وارد کنید.\n\n` +
    `مثلاً برای شارژ <b>۲۰,۰۰۰ تومان</b> فقط بنویسید:\n\n` +
    `<code>20</code>\n\n` +
    `حداقل مبلغ شارژ: <b>۱۰,۰۰۰ تومان</b>\n` +
    `حداکثر مبلغ شارژ: <b>۵۰,۰۰۰,۰۰۰ تومان</b>`;

  if (sourceMessageId) {
    return editMessageText(
      botToken,
      chatId,
      sourceMessageId,
      promptText,
      createCancelTopupKeyboard(),
    );
  }

  return sendMessage(
    botToken,
    chatId,
    promptText,
    createCancelTopupKeyboard(),
  );
}

async function editPrompt(
  botToken,
  chatId,
  promptMessageId,
  text,
) {
  if (!promptMessageId) {
    return sendMessage(
      botToken,
      chatId,
      text,
      createCancelTopupKeyboard(),
    );
  }

  return editMessageText(
    botToken,
    chatId,
    promptMessageId,
    text,
    createCancelTopupKeyboard(),
  );
}

export async function handleWalletTopupAmount(
  message,
  env,
  db,
) {
  const botToken =
    env?.TELEGRAM_BOT_TOKEN;

  const state =
    await getUserState(
      db,
      message.from.id,
    );

  const promptMessageId =
    state?.data?.promptMessageId ??
    null;

  const inputAmount =
    parseAmount(
      message?.text,
    );

  if (!inputAmount) {
    return editPrompt(
      botToken,
      message.chat.id,
      promptMessageId,
      `❌ <b>مبلغ واردشده معتبر نیست.</b>\n\n` +
        `مثلاً برای <b>۲۰,۰۰۰ تومان</b> فقط بنویسید:\n\n` +
        `<code>20</code>`,
    );
  }

  if (
    inputAmount <
    MIN_TOPUP_INPUT
  ) {
    return editPrompt(
      botToken,
      message.chat.id,
      promptMessageId,
      `❌ حداقل مبلغ شارژ <b>۱۰,۰۰۰ تومان</b> است.`,
    );
  }

  if (
    inputAmount >
    MAX_TOPUP_INPUT
  ) {
    return editPrompt(
      botToken,
      message.chat.id,
      promptMessageId,
      `❌ حداکثر مبلغ هر شارژ <b>۵۰,۰۰۰,۰۰۰ تومان</b> است.`,
    );
  }

  /*
   * تبدیل ورودی:
   *
   * 20
   * ↓
   * 20,000 تومان
   * ↓
   * createWalletTopup
   * ↓
   * 200,000 ریال
   */
  const amountToman =
    inputAmount *
    TOPUP_INPUT_MULTIPLIER;

  /*
   * حذف پیام کاربر بعد از معتبر بودن مبلغ.
   */
  if (message?.message_id) {
    try {
      await deleteMessage(
        botToken,
        message.chat.id,
        message.message_id,
      );
    } catch (error) {
      console.warn(
        'Could not delete wallet top-up amount message:',
        error.message,
      );
    }
  }

  try {
    const topup =
      await createWalletTopup(
        db,
        message.from.id,
        amountToman,
      );

    let invoice;

    try {
      invoice =
        await createBlupalInvoice(
          env,
          topup.amountRial,
        );
    } catch (error) {
      await cancelWalletTopup(
        db,
        topup.id,
      );

      throw error;
    }

    await attachWalletTopupInvoice(
      db,
      topup.id,
      invoice,
    );

    await clearUserState(
      db,
      message.from.id,
    );

    const expiry =
      new Date(
        topup.expiresAt,
      ).toLocaleString(
        'fa-IR',
      );

    const paymentRows = [];

    if (
      invoice.payment_link
    ) {
      paymentRows.push([
        {
          text:
            '💳 پرداخت فاکتور',
          url:
            invoice.payment_link,
        },
      ]);
    }

    paymentRows.push([
      {
        text:
          '❌ لغو شارژ',
        callback_data:
          `wallet_topup_cancel:${topup.id}`,
      },
    ]);

    const invoiceText =
      `💳 <b>فاکتور شارژ کیف پول</b>\n\n` +
      `مبلغ شارژ: <b>${amountToman.toLocaleString(
        'fa-IR',
      )} تومان</b>\n` +
      `مبلغ قابل پرداخت: <b>${Math.floor(
        invoice.final_amount / 10,
      ).toLocaleString(
        'fa-IR',
      )} تومان</b>\n` +
      `اعتبار فاکتور تا: <b>${escapeHtml(
        expiry,
      )}</b>\n\n` +
      `لطفاً مبلغ دقیق فاکتور را پرداخت کنید.\n\n` +
      `پس از تأیید پرداخت، مبلغ <b>${amountToman.toLocaleString(
        'fa-IR',
      )} تومان</b> به کیف پول شما اضافه می‌شود.`;

    if (
      promptMessageId
    ) {
      await editMessageText(
        botToken,
        message.chat.id,
        promptMessageId,
        invoiceText,
        {
          inline_keyboard:
            paymentRows,
        },
      );

      return;
    }

    return sendMessage(
      botToken,
      message.chat.id,
      invoiceText,
      {
        inline_keyboard:
          paymentRows,
      },
    );
  } catch (error) {
    console.error(
      'Wallet top-up creation failed:',
      error.message,
      error.stack,
    );

    return editPrompt(
      botToken,
      message.chat.id,
      promptMessageId,
      `❌ <b>ساخت فاکتور شارژ انجام نشد.</b>\n\n` +
        `<code>${escapeHtml(
          error.message,
        )}</code>`,
    );
  }
}

export async function cancelWalletTopupFromCallback(
  callbackQuery,
  env,
  db,
) {
  const botToken =
    env?.TELEGRAM_BOT_TOKEN;

  const data =
    String(
      callbackQuery?.data ?? '',
    );

  const userId =
    callbackQuery?.from?.id;

  const chatId =
    callbackQuery?.message?.chat?.id;

  if (
    !botToken ||
    !userId ||
    !chatId
  ) {
    return;
  }

  if (
    data ===
    'wallet_topup_cancel_current'
  ) {
    await clearUserState(
      db,
      userId,
    );

    return goToHome(
      botToken,
      callbackQuery,
      env,
    );
  }

  const topupId =
    Number(
      data.split(':')[1],
    );

  if (
    !Number.isInteger(topupId) ||
    topupId <= 0
  ) {
    await answerCallbackQuery(
      botToken,
      callbackQuery.id,
      'شناسه فاکتور نامعتبر است.',
      true,
    );

    return;
  }

  const topup =
    await getWalletTopupById(
      db,
      topupId,
    );

  if (
    !topup ||
    String(topup.telegram_id) !==
      String(userId)
  ) {
    await answerCallbackQuery(
      botToken,
      callbackQuery.id,
      'این فاکتور متعلق به شما نیست.',
      true,
    );

    return;
  }

  await cancelWalletTopup(
    db,
    topupId,
  );

  await clearUserState(
    db,
    userId,
  );

  return goToHome(
    botToken,
    callbackQuery,
    env,
  );
}
