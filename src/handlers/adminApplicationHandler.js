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
  getMainMenuKeyboard,
} from '../../keyboards/mainMenu.js';

import {
  USER_STATES,
  setUserState,
  clearUserState,
} from '../database/userStates.js';

import {
  startAdminApplicationFlow,
  saveAdminApplicationFlow,
  buildAdminApplication,
} from '../services/adminApplicationService.js';

export async function startAdminApplication(
  message,
  env,
  db,
) {
  const botToken =
    env.TELEGRAM_BOT_TOKEN;

  const chatId =
    message.chat.id;

  if (!db) {
    return sendMessage(
      botToken,
      chatId,
      '❌ دیتابیس در دسترس نیست. لطفاً بعداً دوباره تلاش کنید.',
    );
  }

  try {
    await startAdminApplicationFlow(
      db,
      message.from.id,
    );

    return sendMessage(
      botToken,
      chatId,
      `📝 <b>ثبت درخواست ادمینی</b>\n\n` +
        `لطفاً <b>نام</b> خود را وارد کنید.`,
      getAdminApplicationBackKeyboard(),
    );
  } catch (error) {
    console.error(
      'Failed to start admin application:',
      error.message,
      error.stack,
    );

    return sendMessage(
      botToken,
      chatId,
      `❌ در شروع فرم مشکلی پیش آمد.\n\n` +
        `لطفاً دوباره تلاش کنید.`,
      getAdminApplicationStartKeyboard(),
    );
  }
}

export async function handleAdminApplication(
  message,
  env,
  db,
  currentState,
  currentData = {},
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
    return sendMessage(
      botToken,
      chatId,
      '❌ دیتابیس در دسترس نیست.',
    );
  }

  if (
    text ===
    EARN_MONEY_BUTTONS.BACK
  ) {
    await clearUserState(
      db,
      telegramUser.id,
    );

    return sendMessage(
      botToken,
      chatId,
      'عملیات لغو شد.',
      getMainMenuKeyboard(),
    );
  }

  if (
    currentState ===
    USER_STATES.WAITING_FOR_ADMIN_APPLICATION_FIRST_NAME
  ) {
    if (!text) {
      return sendMessage(
        botToken,
        chatId,
        '❌ لطفاً نام خود را وارد کنید.',
        getAdminApplicationBackKeyboard(),
      );
    }

    await setUserState(
      db,
      telegramUser.id,
      USER_STATES.WAITING_FOR_ADMIN_APPLICATION_LAST_NAME,
      {
        ...currentData,
        first_name: text,
      },
    );

    return sendMessage(
      botToken,
      chatId,
      `نام ثبت شد.\n\n` +
        `لطفاً <b>نام خانوادگی</b> خود را وارد کنید.`,
      getAdminApplicationBackKeyboard(),
    );
  }

  if (
    currentState ===
    USER_STATES.WAITING_FOR_ADMIN_APPLICATION_LAST_NAME
  ) {
    if (!text) {
      return sendMessage(
        botToken,
        chatId,
        '❌ لطفاً نام خانوادگی خود را وارد کنید.',
        getAdminApplicationBackKeyboard(),
      );
    }

    await setUserState(
      db,
      telegramUser.id,
      USER_STATES.WAITING_FOR_ADMIN_APPLICATION_PHONE,
      {
        ...currentData,
        last_name: text,
      },
    );

    return sendMessage(
      botToken,
      chatId,
      `نام خانوادگی ثبت شد.\n\n` +
        `حالا شماره تلفن خود را با استفاده از دکمه زیر ارسال کنید.`,
      getAdminApplicationPhoneKeyboard(),
    );
  }

  if (
    currentState ===
    USER_STATES.WAITING_FOR_ADMIN_APPLICATION_PHONE
  ) {
    const application =
      buildAdminApplication(
        message,
        currentData,
      );

    if (!application.phone) {
      return sendMessage(
        botToken,
        chatId,
        `❌ شماره تلفن دریافت نشد.\n\n` +
          `لطفاً شماره خود را ارسال کنید.`,
        getAdminApplicationPhoneKeyboard(),
      );
    }

    try {
      const result =
        await saveAdminApplicationFlow(
          db,
          application,
          botToken,
        );

      let successText =
        `✅ <b>درخواست شما با موفقیت ثبت شد.</b>\n\n`;

      if (result.oldPending) {
        successText +=
          `♻️ درخواست قبلی شما حذف شد و درخواست جدیدتان در <b>انتهای صف</b> قرار گرفت.\n\n`;
      }

      successText +=
        `⏳ وضعیت: <b>در حال بررسی</b>\n\n` +
        `پس از بررسی درخواست، نتیجه اعلام خواهد شد.`;

      return sendMessage(
        botToken,
        chatId,
        successText,
        getMainMenuKeyboard(),
      );
    } catch (error) {
      console.error(
        'Failed to save application:',
        error.message,
        error.stack,
      );

      return sendMessage(
        botToken,
        chatId,
        `❌ در ثبت درخواست مشکلی پیش آمد.\n\n` +
          `لطفاً چند لحظه بعد دوباره تلاش کنید.`,
        getAdminApplicationBackKeyboard(),
      );
    }
  }

  await clearUserState(
    db,
    telegramUser.id,
  );

  return sendMessage(
    botToken,
    chatId,
    `❌ وضعیت فرم نامعتبر بود.\n\n` +
      `لطفاً دوباره از ابتدا شروع کنید.`,
    getAdminApplicationStartKeyboard(),
  );
}

export default handleAdminApplication;
