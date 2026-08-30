/**
 * Message router.
 */

import {
  sendMessage,
} from '../api/telegram.js';

import {
  MAIN_MENU_BUTTONS,
  getMainMenuKeyboard,
} from '../../keyboards/mainMenu.js';

import {
  COURSE_MENU_BUTTONS,
} from '../../keyboards/courseMenu.js';

import {
  ACCOUNT_BUTTONS,
} from '../../keyboards/account.js';

import {
  showAccount,
} from './accountHandler.js';

import {
  handleWalletTopupAmount,
} from './walletTopupHandler.js';

import {
  EARN_MONEY_BUTTONS,
  getAdminApplicationStartKeyboard,
  getEarnMoneyKeyboard,
} from '../../keyboards/earnMoney.js';

import {
  USER_STATES,
  setUserState,
  getUserState,
  clearUserState,
} from '../database/userStates.js';

import {
  startAdminApplication,
  handleAdminApplication,
} from './adminApplicationHandler.js';

import {
  handleAdminRejectionReason,
} from './adminApplicationReviewHandler.js';

import {
  startAdminVerification,
  handleAdminVerificationInput,
} from './adminVerificationHandler.js';

import {
  showMainMenu,
  showCourseMenu,
  showEarnMoneyMenu,
  showSupportMenu,
} from './menuHandler.js';

const APPLICATION_STATES =
  new Set([
    USER_STATES.WAITING_FOR_ADMIN_APPLICATION_CONFIRMATION,
    USER_STATES.WAITING_FOR_ADMIN_APPLICATION_FIRST_NAME,
    USER_STATES.WAITING_FOR_ADMIN_APPLICATION_LAST_NAME,
    USER_STATES.WAITING_FOR_ADMIN_APPLICATION_PHONE,
  ]);

async function clearStateSafely(
  db,
  telegramId,
) {
  if (!db) return;

  try {
    await clearUserState(
      db,
      telegramId,
    );
  } catch (error) {
    console.error(
      'Failed to clear state:',
      error.message,
    );
  }
}

export default async function handleMessage(
  message,
  env,
  db,
) {
  if (
    !message?.chat ||
    !message?.from
  ) {
    return;
  }

  const botToken =
    env?.TELEGRAM_BOT_TOKEN;

  const chatId =
    message.chat.id;

  const userId =
    message.from.id;

  const text =
    message.text?.trim();

  if (!botToken) {
    console.error(
      'TELEGRAM_BOT_TOKEN missing',
    );
    return;
  }

  if (
    text === '/start' ||
    text?.startsWith('/start ')
  ) {
    await clearStateSafely(
      db,
      userId,
    );

    return showMainMenu(
      message,
      env,
    );
  }

  /*
   * Back عمومی
   *
   * هم "🔙"
   * هم "🔙 بازگشت" قدیمی را قبول می‌کنیم.
   */
  if (
    text === ACCOUNT_BUTTONS.BACK ||
    text === COURSE_MENU_BUTTONS.BACK
  ) {
    await clearStateSafely(
      db,
      userId,
    );

    return showMainMenu(
      message,
      env,
    );
  }

  let userState = null;

  if (db) {
    try {
      userState =
        await getUserState(
          db,
          userId,
        );
    } catch (error) {
      console.error(
        'Failed to read user state:',
        error.message,
      );
    }
  }

  const currentState =
    userState?.state ??
    null;

  const currentData =
    userState?.data ??
    {};

  /*
   * Wallet top-up input
   */
  if (
    currentState ===
    USER_STATES.WAITING_FOR_WALLET_TOPUP_AMOUNT
  ) {
    return handleWalletTopupAmount(
      message,
      env,
      db,
    );
  }

  if (
    currentState ===
    USER_STATES.WAITING_FOR_ADMIN_REJECTION_REASON
  ) {
    return handleAdminRejectionReason(
      message,
      env,
      db,
      userState,
    );
  }

  if (
    APPLICATION_STATES.has(
      currentState,
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
        return startAdminApplication(
          message,
          env,
          db,
        );
      }

      return sendMessage(
        botToken,
        chatId,
        `لطفاً ابتدا گزینه <b>دوره را خریداری کرده‌ام</b> را انتخاب کنید.`,
        getAdminApplicationStartKeyboard(),
      );
    }

    return handleAdminApplication(
      message,
      env,
      db,
      currentState,
      currentData,
    );
  }

  if (
    currentState ===
    USER_STATES.WAITING_FOR_ADMIN_VERIFICATION
  ) {
    return handleAdminVerificationInput(
      message,
      env,
      db,
    );
  }

  if (
    text ===
    MAIN_MENU_BUTTONS.BUY_COURSE
  ) {
    return showCourseMenu(
      message,
      env,
    );
  }

  if (
    text ===
    COURSE_MENU_BUTTONS.VERIFY_ADMIN
  ) {
    return startAdminVerification(
      message,
      env,
      db,
    );
  }

  if (
    text ===
    MAIN_MENU_BUTTONS.EARN_MONEY
  ) {
    return showEarnMoneyMenu(
      message,
      env,
    );
  }

  if (
    text ===
    MAIN_MENU_BUTTONS.ACCOUNT
  ) {
    return showAccount(
      message,
      env,
      db,
    );
  }

  if (
    text ===
    EARN_MONEY_BUTTONS.APPLY_ADMIN
  ) {
    if (!db) {
      return sendMessage(
        botToken,
        chatId,
        '❌ دیتابیس در دسترس نیست. ثبت درخواست فعلاً امکان‌پذیر نیست.',
        getEarnMoneyKeyboard(),
      );
    }

    try {
      await setUserState(
        db,
        userId,
        USER_STATES.WAITING_FOR_ADMIN_APPLICATION_CONFIRMATION,
        {},
      );
    } catch (error) {
      console.error(
        'Failed to save application state:',
        error.message,
      );

      return sendMessage(
        botToken,
        chatId,
        '❌ در ذخیره وضعیت فرم مشکلی پیش آمد. لطفاً دوباره تلاش کنید.',
        getEarnMoneyKeyboard(),
      );
    }

    return sendMessage(
      botToken,
      chatId,
      `📝 <b>ثبت درخواست حساب ادمینی</b>\n\n` +
        `برای ثبت درخواست همکاری با EndMark، ابتدا باید دوره را خریداری کرده باشید.\n\n` +
        `اگر دوره را خریداری کرده‌اید، گزینه زیر را انتخاب کنید.`,
      getAdminApplicationStartKeyboard(),
    );
  }

  if (
    text ===
    MAIN_MENU_BUTTONS.SUPPORT
  ) {
    return showSupportMenu(
      message,
      env,
    );
  }

  return sendMessage(
    botToken,
    chatId,
    'لطفاً یکی از گزینه‌های موجود در منو را انتخاب کنید.',
    getMainMenuKeyboard(),
  );
}
