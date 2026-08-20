/**
 * Admin Application Handler
 *
 * مسیر:
 * src/handlers/adminApplicationHandler.js
 *
 * مسئول:
 * - ثبت درخواست حساب ادمینی
 * - دریافت نام
 * - دریافت نام خانوادگی
 * - دریافت شماره تلفن
 * - ذخیره درخواست در admin_applications
 * - نگهداری State فرم در user_states
 */

import {
  sendMessage,
} from '../api/telegram.js';

import {
  EARN_MONEY_BUTTONS,
  getAdminApplicationStartKeyboard,
  getAdminApplicationBackKeyboard,
  getAdminApplicationPhoneKeyboard,
} from '../../keyboards/earnMoney.js';

import {
  USER_STATES,
  setUserState,
  clearUserState,
} from '../database/userStates.js';

import {
  createAdminApplication,
} from '../database/adminApplications.js';


/**
 * شروع فرم ثبت درخواست
 */
export async function startAdminApplication(
  message,
  env,
  db
) {
  const botToken =
    env.TELEGRAM_BOT_TOKEN;

  const chatId =
    message.chat.id;

  const telegramUser =
    message.from;

  if (!db) {
    return await sendMessage(
      botToken,
      chatId,
      '❌ دیتابیس در دسترس نیست. لطفاً بعداً دوباره تلاش کنید.'
    );
  }

  try {
    /*
     * شروع State
     */
    await setUserState(
      db,
      telegramUser.id,
      USER_STATES.WAITING_FOR_ADMIN_APPLICATION_FIRST_NAME,
      {}
    );

    return await sendMessage(
      botToken,
      chatId,

      `📝 <b>ثبت درخواست ادمینی</b>\n\n` +
      `لطفاً <b>نام</b> خود را وارد کنید.`,

      getAdminApplicationBackKeyboard()
    );

  } catch (error) {
    console.error(
      '❌ Failed to start admin application:',
      error.message,
      error.stack
    );

    return await sendMessage(
      botToken,
      chatId,

      `❌ در شروع فرم مشکلی پیش آمد.\n\n` +
      `لطفاً دوباره تلاش کنید.`,

      getAdminApplicationStartKeyboard()
    );
  }
}


/**
 * مدیریت مراحل فرم
 */
export async function handleAdminApplication(
  message,
  env,
  db,
  currentState,
  currentData = {}
) {
  const botToken =
    env.TELEGRAM_BOT_TOKEN;

  const chatId =
    message.chat.id;

  const telegramUser =
    message.from;

  const text =
    message.text?.trim();

  if (!db) {
    return await sendMessage(
      botToken,
      chatId,
      '❌ دیتابیس در دسترس نیست.'
    );
  }

  /*
   * بازگشت
   */
  if (
    text === EARN_MONEY_BUTTONS.BACK
  ) {
    await clearUserState(
      db,
      telegramUser.id
    );

    return await sendMessage(
      botToken,
      chatId,

      `عملیات لغو شد.`,

      {
        keyboard: [
          [
            {
              text: '💰 کسب درآمد',
              style: 'success',
            },
          ],
          [
            {
              text: '🔙 بازگشت',
              style: 'danger',
            },
          ],
        ],
        resize_keyboard: true,
        is_persistent: false,
      }
    );
  }


  /*
   * مرحله اول: نام
   */
  if (
    currentState ===
    USER_STATES.WAITING_FOR_ADMIN_APPLICATION_FIRST_NAME
  ) {
    if (!text) {
      return await sendMessage(
        botToken,
        chatId,
        '❌ لطفاً نام خود را به صورت متنی وارد کنید.',
        getAdminApplicationBackKeyboard()
      );
    }

    await setUserState(
      db,
      telegramUser.id,
      USER_STATES.WAITING_FOR_ADMIN_APPLICATION_LAST_NAME,
      {
        ...currentData,
        first_name: text,
      }
    );

    return await sendMessage(
      botToken,
      chatId,

      `نام ثبت شد.\n\n` +
      `لطفاً <b>نام خانوادگی</b> خود را وارد کنید.`,

      getAdminApplicationBackKeyboard()
    );
  }


  /*
   * مرحله دوم: نام خانوادگی
   */
  if (
    currentState ===
    USER_STATES.WAITING_FOR_ADMIN_APPLICATION_LAST_NAME
  ) {
    if (!text) {
      return await sendMessage(
        botToken,
        chatId,
        '❌ لطفاً نام خانوادگی خود را وارد کنید.',
        getAdminApplicationBackKeyboard()
      );
    }

    await setUserState(
      db,
      telegramUser.id,
      USER_STATES.WAITING_FOR_ADMIN_APPLICATION_PHONE,
      {
        ...currentData,
        last_name: text,
      }
    );

    return await sendMessage(
      botToken,
      chatId,

      `نام خانوادگی ثبت شد.\n\n` +
      `حالا شماره تلفن خود را با استفاده از دکمه زیر ارسال کنید.`,

      getAdminApplicationPhoneKeyboard()
    );
  }


  /*
   * مرحله سوم: شماره تلفن
   */
  if (
    currentState ===
    USER_STATES.WAITING_FOR_ADMIN_APPLICATION_PHONE
  ) {
    let phone = null;

    /*
     * شماره‌ای که با Contact ارسال شده
     */
    if (
      message.contact?.phone_number
    ) {
      phone =
        message.contact.phone_number;
    }

    /*
     * اگر کاربر شماره را دستی نوشت
     */
    if (
      !phone &&
      text
    ) {
      phone = text;
    }

    if (!phone) {
      return await sendMessage(
        botToken,
        chatId,

        `❌ شماره تلفن دریافت نشد.\n\n` +
        `لطفاً با دکمه <b>ارسال شماره همین حساب</b> شماره خود را ارسال کنید.`,

        getAdminApplicationPhoneKeyboard()
      );
    }

    /*
     * اطلاعات نهایی درخواست
     */
    const application = {
      telegram_id:
        telegramUser.id,

      username:
        telegramUser.username ??
        null,

      first_name:
        currentData.first_name ??
        telegramUser.first_name ??
        null,

      last_name:
        currentData.last_name ??
        telegramUser.last_name ??
        null,

      phone,
    };


    /*
     * ثبت در admin_applications
     */
    try {
      const result =
        await createAdminApplication(
          db,
          application
        );

      console.log(
        '✅ Admin application created:',
        result
      );

    } catch (error) {
      console.error(
        '❌ Failed to create admin application:',
        error.message,
        error.stack
      );

      return await sendMessage(
        botToken,
        chatId,

        `❌ در ثبت درخواست مشکلی پیش آمد.\n\n` +
        `لطفاً چند لحظه بعد دوباره تلاش کنید.`,

        getAdminApplicationBackKeyboard()
      );
    }


    /*
     * فرم تمام شد
     */
    await clearUserState(
      db,
      telegramUser.id
    );


    /*
     * پیام موفقیت
     */
    return await sendMessage(
      botToken,
      chatId,

      `✅ <b>درخواست شما با موفقیت ثبت شد.</b>\n\n` +

      `👤 نام: ` +
      `<b>${escapeHtml(application.first_name)}</b>\n` +

      `👤 نام خانوادگی: ` +
      `<b>${escapeHtml(application.last_name)}</b>\n` +

      `📱 شماره: ` +
      `<b>${escapeHtml(application.phone)}</b>\n\n` +

      `⏳ وضعیت درخواست: <b>در حال بررسی</b>\n\n` +

      `درخواست شما برای تیم EndMark ارسال شد و پس از بررسی نتیجه اعلام خواهد شد.`,

      {
        keyboard: [
          [
            {
              text: '💰 کسب درآمد',
              style: 'success',
            },
          ],
          [
            {
              text: '🔙 بازگشت',
              style: 'danger',
            },
          ],
        ],
        resize_keyboard: true,
        is_persistent: false,
      }
    );
  }


  /*
   * State ناشناخته
   */
  await clearUserState(
    db,
    telegramUser.id
  );

  return await sendMessage(
    botToken,
    chatId,

    `❌ وضعیت فرم نامعتبر بود.\n\n` +
    `لطفاً دوباره از ابتدا شروع کنید.`,

    getAdminApplicationStartKeyboard()
  );
}


/**
 * Escape HTML
 */
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


export default handleAdminApplication;
