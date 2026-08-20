/**
 * Admin Application Handler
 *
 * مسیر:
 * src/handlers/adminApplicationHandler.js
 *
 * مسئول:
 * - شروع فرم ثبت حساب ادمینی
 * - دریافت نام
 * - دریافت نام خانوادگی
 * - دریافت شماره تلفن
 * - ذخیره موقت اطلاعات
 * - ثبت Application در D1
 * - ارسال اعلان برای ادمین‌های اصلی
 */

import { sendMessage } from '../api/telegram.js';

import {
  EARN_MONEY_BUTTONS,
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
  getPendingAdminApplicationByUserId,
} from '../database/adminApplications.js';

import {
  ensureUser,
} from '../database/users.js';

import {
  BOT_ADMINS,
} from '../config/admins.js';


/**
 * شروع ثبت درخواست
 */
export async function startAdminApplication(
  message,
  env,
  db
) {
  if (!db) {
    return await sendMessage(
      env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      '❌ در حال حاضر امکان ثبت درخواست وجود ندارد. لطفاً بعداً دوباره تلاش کنید.'
    );
  }


  await setUserState(
    db,
    message.from.id,
    USER_STATES.WAITING_FOR_ADMIN_APPLICATION_FIRST_NAME,
    {}
  );


  return await sendMessage(
    env.TELEGRAM_BOT_TOKEN,
    message.chat.id,

    `📝 <b>ثبت درخواست حساب ادمینی</b>

برای شروع فرآیند ثبت درخواست، لطفاً <b>نام واقعی</b> خود را وارد کنید.

⚠️ اطلاعات واردشده باید واقعی و متعلق به خودتان باشد.`,

    getAdminApplicationBackKeyboard()
  );
}


/**
 * اعتبارسنجی نام
 */
function validateName(
  value,
  fieldName
) {
  if (!value) {
    return `${fieldName} وارد نشده است.`;
  }

  if (value.length < 2) {
    return `${fieldName} باید حداقل ۲ کاراکتر داشته باشد.`;
  }

  if (value.length > 100) {
    return `${fieldName} بیش از حد طولانی است.`;
  }

  return null;
}


/**
 * نرمال‌سازی شماره
 */
function normalizePhone(
  value
) {
  if (!value) {
    return null;
  }

  let phone =
    String(value)
      .trim()
      .replace(/[^\d+]/g, '');


  /*
   * اجازه فقط یک + در ابتدای شماره
   */
  if (
    phone.includes('+') &&
    !phone.startsWith('+')
  ) {
    phone =
      phone.replace(/\+/g, '');
  }


  /*
   * حذف +های اضافی
   */
  if (phone.startsWith('+')) {
    phone =
      '+' +
      phone
        .slice(1)
        .replace(/\+/g, '');
  } else {
    phone =
      phone.replace(/\+/g, '');
  }


  if (
    phone.length < 8 ||
    phone.length > 16
  ) {
    return null;
  }

  return phone;
}


/**
 * فرار دادن HTML
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


/**
 * مخفی کردن بخشی از شماره تلفن
 */
function maskPhone(
  phone
) {
  if (!phone) {
    return 'نامشخص';
  }

  if (phone.length <= 7) {
    return phone;
  }

  return (
    phone.slice(0, 4) +
    '****' +
    phone.slice(-3)
  );
}


/**
 * ارسال درخواست برای ادمین‌های اصلی
 */
async function notifyBotAdmins(
  message,
  env,
  application
) {
  if (!Array.isArray(BOT_ADMINS)) {
    return;
  }

  if (!BOT_ADMINS.length) {
    console.warn(
      '⚠️ BOT_ADMINS is empty'
    );

    return;
  }


  const username =
    message.from.username
      ? `@${escapeHtml(message.from.username)}`
      : 'ندارد';


  const adminUsername =
    application.adminUsername
      ? `@${escapeHtml(application.adminUsername)}`
      : 'ندارد';


  const text =
    `🔔 <b>درخواست جدید ثبت حساب ادمینی</b>

👤 <b>نام:</b>
${escapeHtml(application.firstName)}

👤 <b>نام خانوادگی:</b>
${escapeHtml(application.lastName)}

📱 <b>شماره:</b>
${escapeHtml(maskPhone(application.phoneNumber))}

🆔 <b>Telegram ID:</b>
<code>${escapeHtml(message.from.id)}</code>

🔗 <b>Username:</b>
${username}

👨‍💼 <b>ادمین معرفی‌شده:</b>
${adminUsername}

📌 <b>وضعیت:</b>
در انتظار بررسی`;


  for (const adminId of BOT_ADMINS) {
    try {
      await sendMessage(
        env.TELEGRAM_BOT_TOKEN,
        adminId,
        text
      );
    } catch (error) {
      console.error(
        `❌ Failed to notify admin ${adminId}:`,
        error.message
      );
    }
  }
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

  const userId =
    message.from.id;

  const text =
    message.text?.trim();


  /*
   * اگر کاربر دکمه بازگشت را بزند،
   * messageHandler قبل از رسیدن به اینجا
   * State را پاک می‌کند.
   */


  /**
   * مرحله نام
   */
  if (
    currentState ===
    USER_STATES.WAITING_FOR_ADMIN_APPLICATION_FIRST_NAME
  ) {

    const error =
      validateName(
        text,
        'نام'
      );

    if (error) {
      return await sendMessage(
        botToken,
        chatId,

        `❌ <b>${escapeHtml(error)}</b>

لطفاً نام واقعی خود را وارد کنید.`,

        getAdminApplicationBackKeyboard()
      );
    }


    await setUserState(
      db,
      userId,
      USER_STATES.WAITING_FOR_ADMIN_APPLICATION_LAST_NAME,
      {
        firstName: text,
      }
    );


    return await sendMessage(
      botToken,
      chatId,

      `✅ نام دریافت شد.

حالا لطفاً <b>نام خانوادگی واقعی</b> خود را وارد کنید.`,

      getAdminApplicationBackKeyboard()
    );
  }


  /**
   * مرحله نام خانوادگی
   */
  if (
    currentState ===
    USER_STATES.WAITING_FOR_ADMIN_APPLICATION_LAST_NAME
  ) {

    const error =
      validateName(
        text,
        'نام خانوادگی'
      );

    if (error) {
      return await sendMessage(
        botToken,
        chatId,

        `❌ <b>${escapeHtml(error)}</b>

لطفاً نام خانوادگی واقعی خود را وارد کنید.`,

        getAdminApplicationBackKeyboard()
      );
    }


    const firstName =
      currentData.firstName;


    if (!firstName) {
      await setUserState(
        db,
        userId,
        USER_STATES.WAITING_FOR_ADMIN_APPLICATION_FIRST_NAME,
        {}
      );

      return await sendMessage(
        botToken,
        chatId,

        '❌ اطلاعات مرحله قبل پیدا نشد. لطفاً نام خود را دوباره وارد کنید.',

        getAdminApplicationBackKeyboard()
      );
    }


    await setUserState(
      db,
      userId,
      USER_STATES.WAITING_FOR_ADMIN_APPLICATION_PHONE,
      {
        firstName,
        lastName: text,
      }
    );


    return await sendMessage(
      botToken,
      chatId,

      `📱 <b>شماره تلفن</b>

لطفاً شماره تلفن خود را ارسال کنید.

می‌توانید شماره را دستی وارد کنید یا از دکمه زیر برای ارسال شماره همین حساب تلگرام استفاده کنید.

⚠️ شماره باید متعلق به خودتان باشد.`,

      getAdminApplicationPhoneKeyboard()
    );
  }


  /**
   * مرحله شماره تلفن
   */
  if (
    currentState ===
    USER_STATES.WAITING_FOR_ADMIN_APPLICATION_PHONE
  ) {

    let phoneNumber =
      null;


    /*
     * Contact
     */
    if (message.contact) {

      if (
        message.contact.user_id &&
        Number(message.contact.user_id) !==
          Number(message.from.id)
      ) {
        return await sendMessage(
          botToken,
          chatId,

          `❌ <b>این شماره متعلق به حساب شما نیست.</b>

لطفاً شماره همین حساب تلگرام را ارسال کنید.`,

          getAdminApplicationPhoneKeyboard()
        );
      }


      phoneNumber =
        normalizePhone(
          message.contact.phone_number
        );
    }


    /*
     * شماره دستی
     */
    else if (text) {
      phoneNumber =
        normalizePhone(text);
    }


    if (!phoneNumber) {
      return await sendMessage(
        botToken,
        chatId,

        `❌ <b>شماره تلفن صحیح نیست.</b>

لطفاً یک شماره معتبر وارد کنید.`,

        getAdminApplicationPhoneKeyboard()
      );
    }


    const firstName =
      currentData.firstName;

    const lastName =
      currentData.lastName;


    if (!firstName || !lastName) {

      await setUserState(
        db,
        userId,
        USER_STATES.WAITING_FOR_ADMIN_APPLICATION_FIRST_NAME,
        {}
      );

      return await sendMessage(
        botToken,
        chatId,

        '❌ اطلاعات فرم ناقص شده است. لطفاً دوباره از وارد کردن نام شروع کنید.',

        getAdminApplicationBackKeyboard()
      );
    }


    /*
     * مطمئن شدن از وجود User
     * و گرفتن ID داخلی users
     */
    const user =
      await ensureUser(
        db,
        message.from
      );


    if (!user?.id) {
      throw new Error(
        'Could not resolve internal user ID'
      );
    }


    /*
     * جلوگیری از ثبت درخواست تکراری
     */
    const pending =
      await getPendingAdminApplicationByUserId(
        db,
        user.id
      );


    if (pending) {

      await clearUserState(
        db,
        userId
      );

      return await sendMessage(
        botToken,
        chatId,

        `⚠️ <b>شما یک درخواست در انتظار بررسی دارید.</b>

بعد از بررسی درخواست قبلی، امکان ثبت درخواست جدید برای شما فراهم خواهد شد.`,

        getAdminApplicationBackKeyboard()
      );
    }


    /*
     * ساخت درخواست
     */
    const application = {
      userId: user.id,

      firstName,

      lastName,

      phoneNumber,

      adminUsername:
        message.from.username ?? null,
    };


    const result =
      await createAdminApplication(
        db,
        application
      );


    const applicationId =
      result?.meta?.last_row_id ??
      null;


    /*
     * پاک کردن State
     */
    await clearUserState(
      db,
      userId
    );


    /*
     * اطلاع به ادمین‌ها
     */
    await notifyBotAdmins(
      message,
      env,
      {
        ...application,
        id: applicationId,
      }
    );


    return await sendMessage(
      botToken,
      chatId,

      `✅ <b>درخواست شما با موفقیت ثبت شد.</b>

درخواست شما برای تیم AdminX ارسال شد.

📌 <b>وضعیت:</b> در انتظار بررسی

پس از بررسی، نتیجه درخواست به شما اطلاع داده خواهد شد.`,

      getAdminApplicationBackKeyboard()
    );
  }


  return null;
}
