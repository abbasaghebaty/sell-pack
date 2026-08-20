/**
 * Admin Application Handler
 *
 * مسیر:
 * src/handlers/adminApplicationHandler.js
 */

import {
  getMainMenuKeyboard,
} from '../../keyboards/mainMenu.js';

import {
  sendApplicationToChannel,
} from './adminApplicationReviewHandler.js';

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
  getLatestPendingApplicationByTelegramId,
  deletePendingApplicationsByTelegramId,
} from '../database/adminApplications.js';

import {
  ADMIN_APPLICATION_CHANNEL_ID,
} from '../config/admins.js';


/**
 * شروع فرم
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
 * ارسال درخواست به کانال خصوصی
 */
async function notifyApplicationChannel(
  botToken,
  application,
  applicationId
) {
  const username =
    application.username
      ? `@${escapeHtml(application.username)}`
      : 'ندارد';

  const text =
    `🔔 <b>درخواست جدید ثبت ادمینی</b>\n\n` +

    `🆔 <b>شناسه درخواست:</b>\n` +
    `<code>#${applicationId}</code>\n\n` +

    `👤 <b>نام:</b>\n` +
    `${escapeHtml(application.first_name)}\n\n` +

    `👤 <b>نام خانوادگی:</b>\n` +
    `${escapeHtml(application.last_name)}\n\n` +

    `📱 <b>شماره:</b>\n` +
    `${escapeHtml(application.phone)}\n\n` +

    `🔗 <b>Username:</b>\n` +
    `${username}\n\n` +

    `🆔 <b>Telegram ID:</b>\n` +
    `<code>${application.telegram_id}</code>\n\n` +

    `📌 <b>وضعیت:</b>\n` +
    `در انتظار بررسی`;

  return await sendMessage(
    botToken,
    ADMIN_APPLICATION_CHANNEL_ID,
    text
  );
}


/**
 * پردازش فرم
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
      'عملیات لغو شد.',
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
   * نام
   */
  if (
    currentState ===
    USER_STATES.WAITING_FOR_ADMIN_APPLICATION_FIRST_NAME
  ) {
    if (!text) {
      return await sendMessage(
        botToken,
        chatId,
        '❌ لطفاً نام خود را وارد کنید.',
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
   * نام خانوادگی
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
   * شماره
   */
  if (
    currentState ===
    USER_STATES.WAITING_FOR_ADMIN_APPLICATION_PHONE
  ) {
    let phone = null;

    if (
      message.contact?.phone_number
    ) {
      phone =
        message.contact.phone_number;
    }

    if (!phone && text) {
      phone = text;
    }

    if (!phone) {
      return await sendMessage(
        botToken,
        chatId,

        `❌ شماره تلفن دریافت نشد.\n\n` +
        `لطفاً شماره خود را ارسال کنید.`,

        getAdminApplicationPhoneKeyboard()
      );
    }


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
     * آیا کاربر قبلاً درخواست pending دارد؟
     */
    let oldPending = null;

    try {
      oldPending =
        await getLatestPendingApplicationByTelegramId(
          db,
          telegramUser.id
        );
    } catch (error) {
      console.error(
        '❌ Failed to check pending application:',
        error.message
      );
    }


    /*
     * اگر درخواست قبلی دارد،
     * قبل از ثبت درخواست جدید حذفش می‌کنیم.
     */
    if (oldPending) {
      try {
        await deletePendingApplicationsByTelegramId(
          db,
          telegramUser.id
        );

        console.log(
          `♻️ Previous pending application #${oldPending.id} replaced`
        );

      } catch (error) {
        console.error(
          '❌ Failed to replace old application:',
          error.message
        );

        return await sendMessage(
          botToken,
          chatId,

          `❌ درخواست قبلی شما قابل جایگزینی نبود.\n\n` +
          `لطفاً دوباره تلاش کنید.`,

          getAdminApplicationBackKeyboard()
        );
      }
    }


    /*
     * ثبت درخواست جدید
     */
    let result;

    try {
      result =
        await createAdminApplication(
          db,
          application
        );

    } catch (error) {
      console.error(
        '❌ Failed to create application:',
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


    const applicationId =
      result?.meta?.last_row_id ??
      null;


    /*
     * ارسال درخواست به کانال
     */
    try {
      await notifyApplicationChannel(
        botToken,
        application,
        applicationId
      );

    } catch (error) {
      /*
       * درخواست در DB ثبت شده،
       * بنابراین خطای کانال نباید به کاربر
       * پیام شکست ثبت درخواست بدهد.
       */
      console.error(
        '❌ Failed to send application to channel:',
        error.message,
        error.stack
      );
    }


    /*
     * پاک کردن State
     */
    await clearUserState(
      db,
      telegramUser.id
    );


    /*
     * پیام کاربر
     */
    let successText =
      `✅ <b>درخواست شما با موفقیت ثبت شد.</b>\n\n`;

    if (oldPending) {
      successText +=
        `♻️ درخواست قبلی شما حذف شد و درخواست جدیدتان در <b>انتهای صف</b> قرار گرفت.\n\n`;
    }

    successText +=
      `⏳ وضعیت: <b>در حال بررسی</b>\n\n` +
      `پس از بررسی درخواست، نتیجه اعلام خواهد شد.`;

    return await sendMessage(
      botToken,
      chatId,
      successText,
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
   * State نامعتبر
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
