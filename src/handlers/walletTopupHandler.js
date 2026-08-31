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
  updateUserStateData,
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
  getAccountBackReplyKeyboard,
} from '../../keyboards/account.js';

import {
  createCancelTopupKeyboard,
} from '../../keyboards/walletTopup.js';

const MIN_TOPUP_TOMAN =
  10_000;

const MAX_TOPUP_TOMAN =
  50_000_000;

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
      getAccountBackReplyKeyboard(),
    );
  }

  /*
   * اطلاعات پیام اصلی حساب را
   * برای ویرایش‌های بعدی ذخیره می‌کنیم.
   */
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

  const promptText =
    `💳 <b>شارژ کیف پول</b>\n\n` +
    `مبلغی که می‌خواهید کیف پولتان را شارژ کنید، به تومان و <b>بدون سه صفر</b> وارد کنید.\n\n` +
    `مثلاً برای شارژ <b>۲۰,۰۰۰ تومان</b> فقط بنویسید:\n\n` +
    `<code>20</code>\n\n` +
    `حداقل مبلغ شارژ: <b>۱۰,۰۰۰ تومان</b>`;

  /*
   * خود پیام حساب را ویرایش می‌کنیم.
   */
  if (sourceMessageId) {
    await editMessageText(
      botToken,
      chatId,
      sourceMessageId,
      promptText,
      createCancelTopupKeyboard(),
    );
  } else {
    await sendMessage(
      botToken,
      chatId,
      promptText,
      createCancelTopupKeyboard(),
    );
  }

  /*
   * Reply Keyboard فقط یک دکمه:
   * 🔙
   */
  return sendMessage(
    botToken,
    chatId,
    'مبلغ را ارسال کنید.',
    getAccountBackReplyKeyboard(),
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

  const amount =
    parseAmount(
      message?.text,
    );

  if (!amount) {
    return editPrompt(
      botToken,
      message.chat.id,
      promptMessageId,
      `❌ <b>مبلغ واردشده معتبر نیست.</b>\n\n` +
        `برای ۲۰,۰۰۰ تومان فقط بنویسید:\n\n` +
        `<code>20</code>`,
    );
  }

  if (
    amount <
    MIN_TOPUP_TOMAN
  ) {
    return editPrompt(
      botToken,
      message.chat.id,
      promptMessageId,
      `❌ حداقل مبلغ شارژ <b>۱۰,۰۰۰ تومان</b> است.`,
    );
  }

  if (
    amount >
    MAX_TOPUP_TOMAN
  ) {
    return editPrompt(
      botToken,
      message.chat.id,
      promptMessageId,
      `❌ حداکثر مبلغ هر شارژ <b>۵۰,۰۰۰,۰۰۰ تومان</b> است.`,
    );
  }

  try {
    const topup =
      await createWalletTopup(
        db,
        message.from.id,
        amount,
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
          '❌ لغو فاکتور',
        callback_data:
          `wallet_topup_cancel:${topup.id}`,
      },
    ]);

    const invoiceText =
      `💳 <b>فاکتور شارژ کیف پول</b>\n\n` +
      `مبلغ شارژ: <b>${amount.toLocaleString(
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
      `پس از تأیید پرداخت، مبلغ <b>${amount.toLocaleString(
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

    await answerCallbackQuery(
      botToken,
      callbackQuery.id,
    );

    return sendMessage(
      botToken,
      chatId,
      '❌ عملیات شارژ کیف پول لغو شد.',
      getAccountBackReplyKeyboard(),
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

  await answerCallbackQuery(
    botToken,
    callbackQuery.id,
  );

  return sendMessage(
    botToken,
    chatId,
    '❌ فاکتور شارژ کیف پول لغو شد.',
    getAccountBackReplyKeyboard(),
  );
}
