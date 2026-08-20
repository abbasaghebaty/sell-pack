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
 * - نگهداری State فرم
 */

import { sendMessage } from '../api/telegram.js';

import {
  EARN_MONEY_BUTTONS,
  getAdminApplicationStartKeyboard,
  getAdminApplicationBackKeyboard,
  getAdminApplicationPhoneKeyboard,
} from '../../keyboards/earnMoney.js';

import {
  USER_STATES,
  setUserState,
} from '../database/userStates.js';


/**
 * =====================================================
 * شروع درخواست
 * =====================================================
 */

export async function startAdminApplication(
  message,
  env,
  db
) {

  await setUserState(
    db,
    message.from.id,
    USER_STATES.WAITING_FOR_ADMIN_APPLICATION_FIRST_NAME
  );

  return await sendMessage(
    env.TELEGRAM_BOT_TOKEN,
    message.chat.id,

    `📝 <b>ثبت درخواست حساب ادمینی</b>

برای شروع فرآیند ثبت درخواست، لطفاً <b>نام واقعی</b> خود را وارد کنید.

⚠️ نام و نام خانوادگی باید واقعی و متعلق به خودتان باشد.
در صورت وارد کردن اطلاعات نادرست، درخواست شما ممکن است رد شود.`,

    getAdminApplicationBackKeyboard()
  );
}


/**
 * =====================================================
 * پردازش فرم
 * =====================================================
 */

export async function handleAdminApplication(
  message,
  env,
  db,
  currentState
) {

  const botToken =
    env.TELEGRAM_BOT_TOKEN;

  const chatId =
    message.chat.id;

  const userId =
    message.from.id;

  const text =
    message.text?.trim();


  /**
   * =====================================================
   * مرحله نام
   * =====================================================
   */

  if (
    currentState ===
    USER_STATES.WAITING_FOR_ADMIN_APPLICATION_FIRST_NAME
  ) {

    if (!text) {

      return await sendMessage(
        botToken,
        chatId,

        `❌ <b>نام وارد نشده است.</b>

لطفاً نام واقعی خود را وارد کنید.`,

        getAdminApplicationBackKeyboard()
      );
    }


    await setUserState(
      db,
      userId,
      USER_STATES.WAITING_FOR_ADMIN_APPLICATION_LAST_NAME
    );


    return await sendMessage(
      botToken,
      chatId,

      `✅ نام دریافت شد.

حالا لطفاً <b>نام خانوادگی واقعی</b> خود را وارد کنید.

⚠️ لطفاً از نام مستعار یا اطلاعات غیرواقعی استفاده نکنید.`,

      getAdminApplicationBackKeyboard()
    );
  }


  /**
   * =====================================================
   * مرحله نام خانوادگی
   * =====================================================
   */

  if (
    currentState ===
    USER_STATES.WAITING_FOR_ADMIN_APPLICATION_LAST_NAME
  ) {

    if (!text) {

      return await sendMessage(
        botToken,
        chatId,

        `❌ <b>نام خانوادگی وارد نشده است.</b>

لطفاً نام خانوادگی واقعی خود را وارد کنید.`,

        getAdminApplicationBackKeyboard()
      );
    }


    await setUserState(
      db,
      userId,
      USER_STATES.WAITING_FOR_ADMIN_APPLICATION_PHONE
    );


    return await sendMessage(
      botToken,
      chatId,

      `📱 <b>شماره تلفن</b>

لطفاً شماره تلفن خود را ارسال کنید.

می‌توانید شماره را به صورت دستی وارد کنید یا با استفاده از دکمه زیر، شماره تلفن همین حساب تلگرام را ارسال کنید.

⚠️ شماره تلفن باید متعلق به خودتان باشد.`,

      getAdminApplicationPhoneKeyboard()
    );
  }


  /**
   * =====================================================
   * مرحله شماره تلفن
   * =====================================================
   */

  if (
    currentState ===
    USER_STATES.WAITING_FOR_ADMIN_APPLICATION_PHONE
  ) {

    let phoneNumber = null;


    /**
     * شماره ارسال‌شده توسط Contact
     */

    if (message.contact) {

      /**
       * اگر Telegram مشخص کرده باشد
       * که Contact متعلق به کاربر دیگری است
       */

      if (
        message.contact.user_id &&
        Number(message.contact.user_id) !==
          Number(message.from.id)
      ) {

        return await sendMessage(
          botToken,
          chatId,

          `❌ <b>این شماره متعلق به حساب شما نیست.</b>

لطفاً از دکمه «ارسال شماره همین حساب» استفاده کنید.`,

          getAdminApplicationPhoneKeyboard()
        );
      }


      phoneNumber =
        message.contact.phone_number;
    }


    /**
     * شماره واردشده به صورت دستی
     */

    else if (text) {

      const normalizedPhone =
        text.replace(/[^\d+]/g, '');


      if (
        normalizedPhone.length < 8 ||
        normalizedPhone.length > 15
      ) {

        return await sendMessage(
          botToken,
          chatId,

          `❌ <b>شماره تلفن صحیح نیست.</b>

لطفاً یک شماره تلفن معتبر وارد کنید.`,

          getAdminApplicationPhoneKeyboard()
        );
      }


      phoneNumber =
        normalizedPhone;
    }


    /**
     * شماره دریافت نشده
     */

    if (!phoneNumber) {

      return await sendMessage(
        botToken,
        chatId,

        `❌ <b>شماره تلفن دریافت نشد.</b>

لطفاً شماره تلفن خود را وارد کنید یا از دکمه ارسال شماره همین حساب استفاده کنید.`,

        getAdminApplicationPhoneKeyboard()
      );
    }


    /**
     * فعلاً اینجا متوقف می‌شویم.
     *
     * مرحله بعد:
     * ذخیره اطلاعات در دیتابیس
     * و ارسال درخواست برای مدیران.
     */

    return await sendMessage(
      botToken,
      chatId,

      `✅ <b>شماره تلفن دریافت شد.</b>

اطلاعات اولیه شما دریافت شد.

مرحله بعد، ثبت اطلاعات درخواست و ارسال آن برای مدیران AdminX است.`,

      getAdminApplicationBackKeyboard()
    );
  }


  return;
}
