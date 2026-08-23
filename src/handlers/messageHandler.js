/**
 * Message Handler
 *
 * مسیر:
 * src/handlers/messageHandler.js
 */

import {
  startAdminApplication,
  handleAdminApplication,
} from './adminApplicationHandler.js';

import {
  buildPaymentMessage,
  buildPaymentKeyboard,
} from '../utils/paymentMessage.js';

import {
  handleAdminRejectionReason,
} from './adminApplicationReviewHandler.js';

import {
  EARN_MONEY_BUTTONS,
  getEarnMoneyKeyboard,
  getAdminApplicationStartKeyboard,
} from '../../keyboards/earnMoney.js';

import {
  sendMessage,
} from '../api/telegram.js';

import {
  MAIN_MENU_BUTTONS,
  getMainMenuKeyboard,
} from '../../keyboards/mainMenu.js';

import {
  COURSE_MENU_BUTTONS,
  getCourseMenuKeyboard,
  getAdminVerificationKeyboard,
} from '../../keyboards/courseMenu.js';

import {
  checkAdminValidity,
  checkAdminValidityByTelegramId,
} from '../database/adminVerifications.js';

import {
  ensureUser,
} from '../database/users.js';

import {
  createPurchase,
  getApprovedPurchase,
  getPendingBlupalPurchase,
  attachBlupalInvoice,
  cancelWaitingPurchase,
} from '../database/coursePurchases.js';

import {
  createBlupalInvoice,
} from '../api/blupal.js';

import {
  BLUPAL_CONFIG,
} from '../config/blupal.js';

import {
  USER_STATES,
  setUserState,
  getUserState,
  clearUserState,
} from '../database/userStates.js';


function extractUsername(text) {
  if (!text) {
    return null;
  }

  const value = text.trim();

  if (/^@?[a-zA-Z0-9_]{5,32}$/.test(value)) {
    return value.replace(/^@/, '');
  }

  return null;
}


function extractTelegramId(text) {
  if (!text) {
    return null;
  }

  const value = text.trim();

  if (/^\d{5,15}$/.test(value)) {
    return Number(value);
  }

  return null;
}


function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


async function showMainMenu(message, env) {
  const firstName = escapeHtml(
    message.from?.first_name || 'دوست عزیز'
  );

  return await sendMessage(
    env.TELEGRAM_BOT_TOKEN,
    message.chat.id,
    `سلام <b>${firstName}</b>\n\n` +
    `به <b>آکادمی EndMark</b> خوش آمدید.\n\n` +
    `از منوی زیر گزینه موردنظر خود را انتخاب کنید.`,
    getMainMenuKeyboard()
  );
}


async function showCourseMenu(message, env) {
  return await sendMessage(
    env.TELEGRAM_BOT_TOKEN,
    message.chat.id,
    `🛍 <b>خرید دوره</b>\n\n` +
    `قبل از هرگونه خرید یا پرداخت، ابتدا از معتبر بودن ادمینی که قصد همکاری با او را دارید مطمئن شوید.\n\n` +
    `برای جلوگیری از همکاری با افراد جعلی، می‌توانید اطلاعات ادمین را از طریق سیستم <b>EndMark</b> استعلام بگیرید.\n\n` +
    `🔎 از دکمه زیر برای استعلام ادمین استفاده کنید.`,
    getCourseMenuKeyboard()
  );
}


async function startAdminVerification(
  message,
  env,
  db
) {
  if (!db) {
    return await sendMessage(
      env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      '❌ دیتابیس در دسترس نیست. لطفاً بعداً دوباره تلاش کنید.'
    );
  }

  try {
    await setUserState(
      db,
      message.from.id,
      USER_STATES.WAITING_FOR_ADMIN_VERIFICATION,
      {}
    );
  } catch (error) {
    console.error(
      '❌ Failed to set verification state:',
      error.message
    );

    return await sendMessage(
      env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      '❌ در ذخیره وضعیت درخواست مشکلی پیش آمد. لطفاً دوباره تلاش کنید.'
    );
  }

  return await sendMessage(
    env.TELEGRAM_BOT_TOKEN,
    message.chat.id,
    `🔎 <b>استعلام معتبر بودن ادمین</b>\n\n` +
    `یکی از موارد زیر را ارسال کنید:\n\n` +
    `• آیدی عددی ادمین\n` +
    `• یوزرنیم ادمین\n` +
    `• یا یک پیام از طرف همان ادمین را فوروارد کنید.\n\n` +
    `سیستم EndMark پس از دریافت اطلاعات، وضعیت ادمین را بررسی می‌کند.`,
    getAdminVerificationKeyboard()
  );
}


async function handleAdminVerificationInput(
  message,
  env,
  db
) {
  const botToken = env.TELEGRAM_BOT_TOKEN;
  const chatId = message.chat.id;
  const userId = message.from.id;
  const text = message.text?.trim();

  if (!db) {
    return await sendMessage(
      botToken,
      chatId,
      '❌ دیتابیس در دسترس نیست.',
      getAdminVerificationKeyboard()
    );
  }

  if (text === COURSE_MENU_BUTTONS.BACK) {
    await clearUserState(db, userId);

    return await showMainMenu(
      message,
      env
    );
  }

  if (message.forward_origin) {
    const origin = message.forward_origin;

    if (
      origin.type === 'user' &&
      origin.sender_user
    ) {
      const originalUserId =
        origin.sender_user.id;

      const admin =
        await checkAdminValidityByTelegramId(
          db,
          originalUserId
        );

      if (admin) {
        return await sendMessage(
          botToken,
          chatId,
          `✅ <b>ادمین معتبر است</b>\n\n` +
          `این ادمین توسط <b>EndMark</b> تأیید شده است.\n\n` +
          `👤 ادمین:\n` +
          `<b>@${escapeHtml(admin.username || 'ندارد')}</b>\n\n` +
          `با اطمینان بیشتری می‌توانید با این ادمین همکاری کنید.`,
          getAdminVerificationKeyboard()
        );
      }

      return await sendMessage(
        botToken,
        chatId,
        `❌ <b>این ادمین تأیید نشده است</b>\n\n` +
        `اطلاعات این ادمین در فهرست ادمین‌های معتبر EndMark پیدا نشد.\n\n` +
        `⚠️ قبل از هرگونه پرداخت، حتماً از معتبر بودن فرد اطمینان حاصل کنید.`,
        getAdminVerificationKeyboard()
      );
    }

    return await sendMessage(
      botToken,
      chatId,
      `⚠️ <b>امکان شناسایی فرستنده اصلی وجود ندارد.</b>\n\n` +
      `لطفاً آیدی عددی یا یوزرنیم ادمین را مستقیم ارسال کنید.`,
      getAdminVerificationKeyboard()
    );
  }

  const telegramId =
    extractTelegramId(text);

  if (telegramId) {
    const admin =
      await checkAdminValidityByTelegramId(
        db,
        telegramId
      );

    if (admin) {
      return await sendMessage(
        botToken,
        chatId,
        `✅ <b>ادمین معتبر است</b>\n\n` +
        `این ادمین توسط <b>EndMark</b> تأیید شده است.\n\n` +
        `👤 ادمین:\n` +
        `<b>@${escapeHtml(admin.username || 'ندارد')}</b>`,
        getAdminVerificationKeyboard()
      );
    }

    return await sendMessage(
      botToken,
      chatId,
      `❌ <b>این ادمین معتبر نیست</b>\n\n` +
      `این آیدی در فهرست ادمین‌های تأییدشده EndMark پیدا نشد.`,
      getAdminVerificationKeyboard()
    );
  }

  const username =
    extractUsername(text);

  if (username) {
    const admin =
      await checkAdminValidity(
        db,
        username
      );

    if (admin) {
      return await sendMessage(
        botToken,
        chatId,
        `✅ <b>ادمین معتبر است</b>\n\n` +
        `این ادمین توسط <b>EndMark</b> تأیید شده است.\n\n` +
        `👤 ادمین:\n` +
        `<b>@${escapeHtml(admin.username || 'ندارد')}</b>`,
        getAdminVerificationKeyboard()
      );
    }

    return await sendMessage(
      botToken,
      chatId,
      `❌ <b>این ادمین معتبر نیست</b>\n\n` +
      `این یوزرنیم در فهرست ادمین‌های تأییدشده EndMark پیدا نشد.`,
      getAdminVerificationKeyboard()
    );
  }

  return await sendMessage(
    botToken,
    chatId,
    `❌ <b>فرمت واردشده صحیح نیست.</b>\n\n` +
    `لطفاً یکی از موارد زیر را ارسال کنید:\n\n` +
    `• آیدی عددی ادمین\n` +
    `• یوزرنیم ادمین\n` +
    `• پیام فورواردشده از ادمین`,
    getAdminVerificationKeyboard()
  );
}


async function startDirectCoursePurchase(
  message,
  env,
  db
) {
  const botToken =
    env.TELEGRAM_BOT_TOKEN;

  const chatId =
    message.chat.id;

  const amountInput =
    BLUPAL_CONFIG.COURSE_PRICE_INPUT;

  if (!db) {
    return await sendMessage(
      botToken,
      chatId,
      '❌ دیتابیس در دسترس نیست. لطفاً بعداً دوباره تلاش کنید.',
      getCourseMenuKeyboard()
    );
  }

  try {
    const user =
      await ensureUser(
        db,
        message.from
      );

    if (!user?.id) {
      throw new Error(
        'Could not resolve internal user id'
      );
    }

    /*
     * بررسی خرید تأییدشده
     */
    const approvedPurchase =
      await getApprovedPurchase(
        db,
        user.id
      );

    if (approvedPurchase) {
      return await sendMessage(
        botToken,
        chatId,
        '✅ شما قبلاً دوره را خریداری کرده‌اید و خریدتان در سیستم ثبت شده است.',
        getCourseMenuKeyboard()
      );
    }

    /*
     * بررسی فاکتور Pending قبلی
     */
    const pendingPurchase =
      await getPendingBlupalPurchase(
        db,
        user.id
      );

    if (
      pendingPurchase?.blupal_invoice_id &&
      pendingPurchase?.blupal_final_amount
    ) {
      const paymentMessage =
        buildPaymentMessage({
          baseAmountRial:
            Number(
              pendingPurchase.amount
            ),

          finalAmountRial:
            Number(
              pendingPurchase.blupal_final_amount
            ),

          expiresAt:
            pendingPurchase.blupal_expires_at ??
            null,
        });

      const paymentKeyboard =
        buildPaymentKeyboard(
          Number(
            pendingPurchase.blupal_final_amount
          )
        );

      return await sendMessage(
        botToken,
        chatId,
        `⚠️ <b>فاکتور قبلی شما هنوز در انتظار پرداخت است.</b>\n\n` +
        paymentMessage,
        paymentKeyboard
      );
    }

    /*
     * ایجاد Purchase جدید
     */
    const purchase =
      await createPurchase(
        db,
        user.id,
        amountInput
      );

    try {
      /*
       * ساخت فاکتور در Blupal
       */
      const invoice =
        await createBlupalInvoice(
          env,
          purchase.rialAmount
        );

      /*
       * ذخیره اطلاعات فاکتور
       */
      await attachBlupalInvoice(
        db,
        purchase.id,
        invoice
      );

      /*
       * ساخت پیام پرداخت
       */
      const paymentMessage =
        buildPaymentMessage({
          baseAmountRial:
            Number(invoice.amount),

          finalAmountRial:
            Number(invoice.final_amount),

          expiresAt:
            invoice.expires_at ??
            null,
        });

      /*
       * ساخت کیبورد پرداخت
       */
      const paymentKeyboard =
        buildPaymentKeyboard(
          Number(invoice.final_amount)
        );

      /*
       * ارسال مستقیم فاکتور داخل تلگرام
       */
      return await sendMessage(
        botToken,
        chatId,
        paymentMessage,
        paymentKeyboard
      );

    } catch (invoiceError) {
      await cancelWaitingPurchase(
        db,
        purchase.id
      );

      throw invoiceError;
    }

  } catch (error) {
    console.error(
      '❌ Direct course purchase error:',
      error.message,
      error.stack
    );

    return await sendMessage(
      botToken,
      chatId,
      `❌ ساخت فاکتور پرداخت انجام نشد.\n\n` +
      `لطفاً چند لحظه بعد دوباره تلاش کنید.`,
      getCourseMenuKeyboard()
    );
  }
}


export default async function handleMessage(
  message,
  env,
  db
) {
  if (!message?.chat || !message?.from) {
    return;
  }

  const botToken =
    env.TELEGRAM_BOT_TOKEN;

  const chatId =
    message.chat.id;

  const userId =
    message.from.id;

  const text =
    message.text?.trim();

  if (!botToken) {
    console.error(
      '❌ TELEGRAM_BOT_TOKEN missing'
    );

    return;
  }

  /*
   * /start
   */
  if (
    text === '/start' ||
    text?.startsWith('/start ')
  ) {
    if (db) {
      await clearUserState(
        db,
        userId
      );
    }

    return await showMainMenu(
      message,
      env
    );
  }

  /*
   * Back
   */
  if (
    text === COURSE_MENU_BUTTONS.BACK
  ) {
    if (db) {
      try {
        await clearUserState(
          db,
          userId
        );
      } catch (error) {
        console.error(
          '❌ Failed to clear state:',
          error.message
        );
      }
    }

    return await showMainMenu(
      message,
      env
    );
  }

  /*
   * User state
   */
  let userState = null;

  if (db) {
    try {
      userState =
        await getUserState(
          db,
          userId
        );
    } catch (error) {
      console.error(
        '❌ Failed to read user state:',
        error.message
      );

      userState = null;
    }
  }

  const currentState =
    userState?.state ?? null;

  const currentData =
    userState?.data ?? {};

  /*
   * Admin rejection reason
   */
  if (
    currentState ===
    USER_STATES.WAITING_FOR_ADMIN_REJECTION_REASON
  ) {
    return await handleAdminRejectionReason(
      message,
      env,
      db,
      userState
    );
  }

  /*
   * Admin application states
   */
  const applicationStates =
    new Set([
      USER_STATES.WAITING_FOR_ADMIN_APPLICATION_CONFIRMATION,
      USER_STATES.WAITING_FOR_ADMIN_APPLICATION_FIRST_NAME,
      USER_STATES.WAITING_FOR_ADMIN_APPLICATION_LAST_NAME,
      USER_STATES.WAITING_FOR_ADMIN_APPLICATION_PHONE,
    ]);

  if (
    applicationStates.has(
      currentState
    )
  ) {
    if (
      currentState ===
      USER_STATES.WAITING_FOR_ADMIN_APPLICATION_CONFIRMATION
    ) {
      if (
        text ===
        EARN_MONEY_BUTTONS.COURSE_PURCHASED
      ) {
        return await startAdminApplication(
          message,
          env,
          db
        );
      }

      return await sendMessage(
        botToken,
        chatId,
        `لطفاً ابتدا گزینه <b>دوره را خریداری کرده‌ام</b> را انتخاب کنید.`,
        getAdminApplicationStartKeyboard()
      );
    }

    return await handleAdminApplication(
      message,
      env,
      db,
      currentState,
      currentData
    );
  }

  /*
   * Admin verification
   */
  if (
    currentState ===
    USER_STATES.WAITING_FOR_ADMIN_VERIFICATION
  ) {
    return await handleAdminVerificationInput(
      message,
      env,
      db
    );
  }

  /*
   * Buy course
   */
  if (
    text ===
    MAIN_MENU_BUTTONS.BUY_COURSE
  ) {
    return await showCourseMenu(
      message,
      env
    );
  }

  /*
   * Verify admin
   */
  if (
    text ===
    COURSE_MENU_BUTTONS.VERIFY_ADMIN
  ) {
    return await startAdminVerification(
      message,
      env,
      db
    );
  }

  /*
   * Direct course purchase
   */
  if (
    text ===
    COURSE_MENU_BUTTONS.BUY_DIRECT
  ) {
    return await startDirectCoursePurchase(
      message,
      env,
      db
    );
  }

  /*
   * Earn money
   */
  if (
    text ===
    MAIN_MENU_BUTTONS.EARN_MONEY
  ) {
    return await sendMessage(
      botToken,
      chatId,
      `💰 <b>کسب درآمد با EndMark</b>\n\n` +
      `اگر قصد دارید به عنوان ادمین با EndMark همکاری کنید، می‌توانید درخواست ثبت حساب ادمینی خود را ارسال کنید.\n\n` +
      `برای ثبت درخواست همکاری، ابتدا باید دوره آموزشی را خریداری کرده باشید.\n\n` +
      `پس از ارسال درخواست، اطلاعات شما توسط تیم EndMark بررسی خواهد شد.\n\n` +
      `برای شروع، گزینه زیر را انتخاب کنید.`,
      getEarnMoneyKeyboard()
    );
  }

  /*
   * Apply admin
   */
  if (
    text ===
    EARN_MONEY_BUTTONS.APPLY_ADMIN
  ) {
    if (!db) {
      return await sendMessage(
        botToken,
        chatId,
        '❌ دیتابیس در دسترس نیست. ثبت درخواست فعلاً امکان‌پذیر نیست.',
        getEarnMoneyKeyboard()
      );
    }

    try {
      await setUserState(
        db,
        userId,
        USER_STATES.WAITING_FOR_ADMIN_APPLICATION_CONFIRMATION,
        {}
      );
    } catch (error) {
      console.error(
        '❌ Failed to save application state:',
        error.message
      );

      return await sendMessage(
        botToken,
        chatId,
        '❌ در ذخیره وضعیت فرم مشکلی پیش آمد. لطفاً دوباره تلاش کنید.',
        getEarnMoneyKeyboard()
      );
    }

    return await sendMessage(
      botToken,
      chatId,
      `📝 <b>ثبت درخواست حساب ادمینی</b>\n\n` +
      `برای ثبت درخواست همکاری با EndMark، ابتدا باید دوره را خریداری کرده باشید.\n\n` +
      `اگر دوره را خریداری کرده‌اید، گزینه زیر را انتخاب کنید.`,
      getAdminApplicationStartKeyboard()
    );
  }

  /*
   * Support
   */
  if (
    text ===
    MAIN_MENU_BUTTONS.SUPPORT
  ) {
    return await sendMessage(
      botToken,
      chatId,
      `❓ <b>راهنما و پشتیبانی</b>\n\n` +
      `برای دریافت راهنمایی و پشتیبانی، با تیم EndMark در ارتباط باشید.`,
      getMainMenuKeyboard()
    );
  }

  /*
   * Unknown input
   */
  return await sendMessage(
    botToken,
    chatId,
    'لطفاً یکی از گزینه‌های موجود در منو را انتخاب کنید.',
    getMainMenuKeyboard()
  );
}
