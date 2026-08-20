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
  USER_STATES,
  setUserState,
  getUserState,
  clearUserState,
} from '../database/userStates.js';


/*
 * Username
 */
function extractUsername(text) {
  if (!text) {
    return null;
  }

  const value =
    text.trim();

  if (
    /^@?[a-zA-Z0-9_]{5,32}$/.test(
      value
    )
  ) {
    return value.replace(
      /^@/,
      ''
    );
  }

  return null;
}


/*
 * Telegram ID
 */
function extractTelegramId(text) {
  if (!text) {
    return null;
  }

  const value =
    text.trim();

  if (
    /^\d{5,15}$/.test(value)
  ) {
    return Number(value);
  }

  return null;
}


/*
 * HTML escape
 */
function escapeHtml(value) {
  return String(value ?? '')
    .replace(
      /&/g,
      '&amp;'
    )
    .replace(
      /</g,
      '&lt;'
    )
    .replace(
      />/g,
      '&gt;'
    )
    .replace(
      /"/g,
      '&quot;'
    )
    .replace(
      /'/g,
      '&#039;'
    );
}


/*
 * Main menu
 */
async function showMainMenu(
  message,
  env
) {
  const firstName =
    escapeHtml(
      message.from?.first_name ||
      'دوست عزیز'
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


/*
 * Course menu
 */
async function showCourseMenu(
  message,
  env
) {
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


/*
 * Start admin verification
 */
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


/*
 * Verification input
 */
async function handleAdminVerificationInput(
  message,
  env,
  db
) {
  const botToken =
    env.TELEGRAM_BOT_TOKEN;

  const chatId =
    message.chat.id;

  const userId =
    message.from.id;

  const text =
    message.text?.trim();

  if (!db) {
    return await sendMessage(
      botToken,
      chatId,

      '❌ دیتابیس در دسترس نیست.',

      getAdminVerificationKeyboard()
    );
  }


  /*
   * Back
   */
  if (
    text ===
    COURSE_MENU_BUTTONS.BACK
  ) {
    await clearUserState(
      db,
      userId
    );

    return await showMainMenu(
      message,
      env
    );
  }


  /*
   * Forwarded message
   */
  if (message.forward_origin) {
    const origin =
      message.forward_origin;

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


  /*
   * Telegram ID
   */
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


  /*
   * Username
   */
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


/*
 * Main message handler
 */
export default async function handleMessage(
  message,
  env,
  db
) {
  if (
    !message?.chat ||
    !message?.from
  ) {
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
    await clearUserState(
      db,
      userId
    );

    return await showMainMenu(
      message,
      env
    );
  }


  /*
   * Back
   */
  if (
    text ===
    COURSE_MENU_BUTTONS.BACK
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
   * Read state
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
   *
   * این بخش باید قبل از فرم‌های معمولی بررسی شود.
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

    /*
     * Purchase confirmation
     */
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
   * Admin verification state
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

      `برای ثبت درخواست، ابتدا باید دوره آموزشی را خریداری کرده باشید.\n\n` +

      `پس از ارسال درخواست، اطلاعات شما توسط تیم EndMark بررسی خواهد شد.\n\n` +

      `برای شروع، گزینه زیر را انتخاب کنید.`,

      getEarnMoneyKeyboard()
    );
  }


  /*
   * Apply as admin
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
   * Unknown text
   */
  return await sendMessage(
    botToken,
    chatId,

    'لطفاً یکی از گزینه‌های موجود در منو را انتخاب کنید.',

    getMainMenuKeyboard()
  );
}
