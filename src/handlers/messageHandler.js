/**
 * Message Handler
 *
 * مسیر:
 * src/handlers/messageHandler.js
 *
 * مسئول:
 * - منوی اصلی
 * - خرید دوره
 * - استعلام ادمین
 * - کسب درآمد
 * - درخواست ثبت حساب ادمینی
 * - پردازش Stateهای کاربر
 */

import {
  startAdminApplication,
  handleAdminApplication,
} from './adminApplicationHandler.js';

import {
  EARN_MONEY_BUTTONS,
  getEarnMoneyKeyboard,
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


/**
 * استخراج Username
 */
function extractUsername(
  text
) {
  if (!text) {
    return null;
  }

  const value =
    text.trim();


  if (
    /^@?[a-zA-Z0-9_]{5,32}$/
      .test(value)
  ) {
    return value
      .replace(/^@/, '');
  }

  return null;
}


/**
 * استخراج Telegram ID
 */
function extractTelegramId(
  text
) {
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


/**
 * نمایش منوی اصلی
 */
async function showMainMenu(
  message,
  env
) {
  const firstName =
    message.from?.first_name ||
    'دوست عزیز';

  return await sendMessage(
    env.TELEGRAM_BOT_TOKEN,
    message.chat.id,

    `سلام <b>${escapeHtml(firstName)}</b>

به <b>آکادمی AdminX</b> خوش آمدید.

از منوی زیر گزینه موردنظر خود را انتخاب کنید.`,

    getMainMenuKeyboard()
  );
}


/**
 * نمایش منوی خرید
 */
async function showCourseMenu(
  message,
  env
) {
  return await sendMessage(
    env.TELEGRAM_BOT_TOKEN,
    message.chat.id,

    `🛍 <b>خرید دوره</b>

قبل از هرگونه خرید یا پرداخت، ابتدا از معتبر بودن ادمینی که قصد همکاری با او را دارید مطمئن شوید.

برای جلوگیری از همکاری با ادمین‌های جعلی و افراد کلاهبردار، می‌توانید اطلاعات ادمین را از طریق سیستم AdminX استعلام بگیرید.

🔎 از دکمه زیر برای استعلام ادمین استفاده کنید.`,

    getCourseMenuKeyboard()
  );
}


/**
 * شروع استعلام ادمین
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

      '❌ در حال حاضر امکان استعلام وجود ندارد. لطفاً بعداً دوباره تلاش کنید.'
    );
  }


  await setUserState(
    db,
    message.from.id,
    USER_STATES.WAITING_FOR_ADMIN_VERIFICATION
  );


  return await sendMessage(
    env.TELEGRAM_BOT_TOKEN,
    message.chat.id,

    `🔎 <b>استعلام معتبر بودن ادمین</b>

جهت استعلام معتبر بودن ادمین، یکی از موارد زیر را ارسال کنید:

• آیدی عددی ادمین
• یوزرنیم ادمین
• یا یک پیام از طرف همان ادمین را برای ربات فوروارد کنید.

سیستم پس از دریافت اطلاعات، معتبر بودن ادمین را بررسی می‌کند.`,

    getAdminVerificationKeyboard()
  );
}


/**
 * پردازش استعلام
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


  /*
   * بازگشت
   */
  if (
    message.text ===
    COURSE_MENU_BUTTONS.BACK
  ) {
    await clearUserState(
      db,
      message.from.id
    );

    return await showMainMenu(
      message,
      env
    );
  }


  if (!db) {
    return await sendMessage(
      botToken,
      chatId,

      '❌ در حال حاضر امکان استعلام وجود ندارد. لطفاً بعداً دوباره تلاش کنید.',

      getAdminVerificationKeyboard()
    );
  }


  /*
   * Forward
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

          `✅ <b>ادمین معتبر است</b>

این ادمین توسط AdminX تأیید شده است.

👤 ادمین:
<b>@${escapeHtml(admin.admin_username)}</b>

با اطمینان می‌توانید با این ادمین همکاری کنید.`,

          getAdminVerificationKeyboard()
        );
      }


      return await sendMessage(
        botToken,
        chatId,

        `❌ <b>این ادمین در سیستم AdminX تأیید نشده است.</b>

اطلاعات این ادمین در لیست ادمین‌های معتبر ما پیدا نشد.

⚠️ قبل از هرگونه پرداخت، حتماً از معتبر بودن ادمین اطمینان حاصل کنید.`,

        getAdminVerificationKeyboard()
      );
    }


    return await sendMessage(
      botToken,
      chatId,

      `⚠️ <b>امکان شناسایی فرستنده اصلی این پیام وجود ندارد.</b>

لطفاً آیدی عددی یا یوزرنیم ادمین را به صورت مستقیم ارسال کنید.`,

      getAdminVerificationKeyboard()
    );
  }


  /*
   * Telegram ID
   */
  const telegramId =
    extractTelegramId(
      message.text
    );


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

        `✅ <b>ادمین معتبر است</b>

این ادمین توسط AdminX تأیید شده است.

👤 ادمین:
<b>@${escapeHtml(admin.admin_username)}</b>

با اطمینان می‌توانید با این ادمین همکاری کنید.`,

        getAdminVerificationKeyboard()
      );
    }


    return await sendMessage(
      botToken,
      chatId,

      `❌ <b>این ادمین معتبر نیست</b>

این آیدی در لیست ادمین‌های تأییدشده AdminX پیدا نشد.`,

      getAdminVerificationKeyboard()
    );
  }


  /*
   * Username
   */
  const username =
    extractUsername(
      message.text
    );


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

        `✅ <b>ادمین معتبر است</b>

این ادمین توسط AdminX تأیید شده است.

👤 ادمین:
<b>@${escapeHtml(admin.admin_username)}</b>

با اطمینان می‌توانید با این ادمین همکاری کنید.`,

        getAdminVerificationKeyboard()
      );
    }


    return await sendMessage(
      botToken,
      chatId,

      `❌ <b>این ادمین معتبر نیست</b>

این یوزرنیم در لیست ادمین‌های تأییدشده AdminX پیدا نشد.`,

      getAdminVerificationKeyboard()
    );
  }


  return await sendMessage(
    botToken,
    chatId,

    `❌ <b>فرمت واردشده صحیح نیست.</b>

لطفاً یکی از موارد زیر را ارسال کنید:

• آیدی عددی ادمین
• یوزرنیم ادمین
• پیام فورواردشده از ادمین`,

    getAdminVerificationKeyboard()
  );
}


/**
 * Handler اصلی
 */
export default async function handleMessage(
  message,
  env,
  db
) {
  if (
    !message ||
    !message.chat ||
    !message.from
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
      '❌ TELEGRAM_BOT_TOKEN is missing'
    );

    return;
  }


  /*
   * /start
   *
   * معمولاً از commandHandler می‌آید،
   * اما برای اطمینان اینجا هم مدیریت می‌کنیم.
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
   * دریافت State
   */
  const userState =
    await getUserState(
      db,
      userId
    );


  const currentState =
    userState?.state ?? null;

  const currentData =
    userState?.data ?? {};


  /*
   * بازگشت عمومی
   *
   * باید قبل از Stateهای فرم بررسی شود.
   */
  if (
    text === COURSE_MENU_BUTTONS.BACK
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
   * State فرم ثبت حساب ادمینی
   */
  const adminApplicationStates =
    new Set([
      USER_STATES.WAITING_FOR_ADMIN_APPLICATION_CONFIRMATION,
      USER_STATES.WAITING_FOR_ADMIN_APPLICATION_FIRST_NAME,
      USER_STATES.WAITING_FOR_ADMIN_APPLICATION_LAST_NAME,
      USER_STATES.WAITING_FOR_ADMIN_APPLICATION_PHONE,
    ]);


  if (
    adminApplicationStates.has(
      currentState
    )
  ) {

    /*
     * مرحله تأیید خرید
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

        {
          keyboard: [
            [
              {
                text:
                  EARN_MONEY_BUTTONS.COURSE_PURCHASED,
              },
            ],
            [
              {
                text:
                  COURSE_MENU_BUTTONS.BACK,
              },
            ],
          ],
          resize_keyboard: true,
        }
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
   * State استعلام ادمین
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
   * خرید دوره
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
   * استعلام ادمین
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
   * کسب درآمد
   */
  if (
    text ===
    MAIN_MENU_BUTTONS.EARN_MONEY
  ) {

    return await sendMessage(
      botToken,
      chatId,

      `💰 <b>کسب درآمد با AdminX</b>

اگر قصد دارید به عنوان ادمین با AdminX همکاری کنید، می‌توانید درخواست ثبت حساب ادمینی خود را ارسال کنید.

برای ثبت درخواست، ابتدا باید دوره آموزشی AdminX را خریداری کرده باشید.

پس از ارسال درخواست، اطلاعات شما توسط تیم AdminX بررسی می‌شود و در صورت تأیید، حساب ادمینی شما در سیستم ثبت خواهد شد.

برای شروع فرآیند ثبت درخواست، گزینه زیر را انتخاب کنید.`,

      getEarnMoneyKeyboard()
    );
  }


  /*
   * شروع درخواست حساب ادمینی
   */
  if (
    text ===
    EARN_MONEY_BUTTONS.APPLY_ADMIN
  ) {

    if (!db) {
      return await sendMessage(
        botToken,
        chatId,

        '❌ در حال حاضر امکان ثبت درخواست وجود ندارد. لطفاً بعداً دوباره تلاش کنید.',

        getEarnMoneyKeyboard()
      );
    }


    await setUserState(
      db,
      userId,
      USER_STATES.WAITING_FOR_ADMIN_APPLICATION_CONFIRMATION,
      {}
    );


    return await sendMessage(
      botToken,
      chatId,

      `📝 <b>ثبت درخواست حساب ادمینی</b>

برای ثبت درخواست همکاری با AdminX، ابتدا باید دوره را خریداری کرده باشید.

اگر دوره را خریداری کرده‌اید، گزینه زیر را انتخاب کنید.`,

      {
        keyboard: [
          [
            {
              text:
                EARN_MONEY_BUTTONS.COURSE_PURCHASED,
            },
          ],
          [
            {
              text:
                COURSE_MENU_BUTTONS.BACK,
            },
          ],
        ],
        resize_keyboard: true,
      }
    );
  }


  /*
   * پشتیبانی
   */
  if (
    text ===
    MAIN_MENU_BUTTONS.SUPPORT
  ) {

    return await sendMessage(
      botToken,
      chatId,

      `❓ <b>راهنما و پشتیبانی</b>

در صورت نیاز به راهنمایی، از طریق پشتیبانی AdminX اقدام کنید.`,

      getMainMenuKeyboard()
    );
  }


  /*
   * پیام ناشناخته
   */
  return await sendMessage(
    botToken,
    chatId,

    'لطفاً یکی از گزینه‌های موجود در منو را انتخاب کنید.',

    getMainMenuKeyboard()
  );
}


/**
 * Escape HTML
 */
function escapeHtml(
  value
) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
