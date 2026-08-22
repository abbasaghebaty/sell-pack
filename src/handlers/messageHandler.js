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

async function startAdminVerification(message, env, db) {
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

async function handleAdminVerificationInput(message, env, db) {
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
    return await showMainMenu(message, env);
  }

  if (message.forward_origin) {
    const origin = message.forward_origin;

    if (origin.type === 'user' && origin.sender_user) {
      const originalUserId = origin.sender_user.id;
      const admin = await checkAdminValidityByTelegramId(
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

  const telegramId = extractTelegramId(text);

  if (telegramId) {
    const admin = await checkAdminValidityByTelegramId(db, telegramId);

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

  const username = extractUsername(text);

  if (username) {
    const admin = await checkAdminValidity(db, username);

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

async function startDirectCoursePurchase(message, env, db) {
  const botToken = env.TELEGRAM_BOT_TOKEN;
  const chatId = message.chat.id;

  // مبلغ داخل ربات بر مبنای «ده‌هزار تومان» است:
  // 2 => 20,000 تومان => 200,000 ریال
  // 200 => 2,000,000 تومان => 20,000,000 ریال
  const amountInput = 200;

  if (!db) {
    return await sendMessage(
      botToken,
      chatId,
      '❌ دیتابیس در دسترس نیست. لطفاً بعداً دوباره تلاش کنید.',
      getCourseMenuKeyboard()
    );
  }

  try {
    const user = await ensureUser(db, message.from);

    if (!user?.id) {
      throw new Error('Could not resolve internal user id');
    }

    const approvedPurchase = await getApprovedPurchase(db, user.id);

    if (approvedPurchase) {
      return await sendMessage(
        botToken,
        chatId,
        '✅ شما قبلاً دوره را خریداری کرده‌اید و خریدتان در سیستم ثبت شده است.',
        getCourseMenuKeyboard()
      );
    }

    const pendingPurchase = await getPendingBlupalPurchase(db, user.id);

    if (pendingPurchase?.blupal_payment_link) {
      const amountToman = Math.floor(Number(pendingPurchase.amount) / 10);
      const finalToman = Math.floor(Number(pendingPurchase.blupal_final_amount) / 10);

      return await sendMessage(
        botToken,
        chatId,
        `💳 <b>پرداخت دوره</b>\n\n` +
        `مبلغ پایه: <b>${amountToman.toLocaleString('fa-IR')}</b> تومان\n` +
        `مبلغ نهایی جهت واریز: <b>${finalToman.toLocaleString('fa-IR')}</b> تومان\n\n` +
        `فاکتور قبلی شما هنوز معتبر است. برای پرداخت از دکمه زیر استفاده کنید.`,
        {
          inline_keyboard: [
            [
              {
                text: '💳 پرداخت / مشاهده فاکتور',
                url: pendingPurchase.blupal_payment_link,
              },
            ],
          ],
        }
      );
    }

    const purchase = await createPurchase(
      db,
      user.id,
      amountInput
    );

    try {
      const invoice = await createBlupalInvoice(
        env,
        purchase.rialAmount
      );

      await attachBlupalInvoice(
        db,
        purchase.id,
        invoice
      );

      const baseToman = Math.floor(invoice.amount / 10);
      const finalToman = Math.floor(invoice.final_amount / 10);

      const expiresText = invoice.expires_at
        ? `\n⏳ اعتبار فاکتور: <b>${escapeHtml(invoice.expires_at)}</b>`
        : '';

      return await sendMessage(
        botToken,
        chatId,
        `💳 <b>خرید مستقیم دوره</b>\n\n` +
        `مبلغ دوره: <b>${baseToman.toLocaleString('fa-IR')}</b> تومان\n` +
        `مبلغ نهایی پرداخت: <b>${finalToman.toLocaleString('fa-IR')}</b> تومان\n\n` +
        `مبلغ نهایی را دقیقاً طبق فاکتور واریز کنید.` +
        expiresText,
        {
          inline_keyboard: [
            [
              {
                text: '💳 پرداخت / مشاهده فاکتور',
                url: invoice.payment_link,
              },
            ],
          ],
        }
      );
    } catch (invoiceError) {
      await cancelWaitingPurchase(db, purchase.id);
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

export default async function handleMessage(message, env, db) {
  if (!message?.chat || !message?.from) {
    return;
  }

  const botToken = env.TELEGRAM_BOT_TOKEN;
  const chatId = message.chat.id;
  const userId = message.from.id;
  const text = message.text?.trim();

  if (!botToken) {
    console.error('❌ TELEGRAM_BOT_TOKEN missing');
    return;
  }

  if (text === '/start' || text?.startsWith('/start ')) {
    if (db) {
      await clearUserState(db, userId);
    }

    return await showMainMenu(message, env);
  }

  if (text === COURSE_MENU_BUTTONS.BACK) {
    if (db) {
      try {
        await clearUserState(db, userId);
      } catch (error) {
        console.error('❌ Failed to clear state:', error.message);
      }
    }

    return await showMainMenu(message, env);
  }

  let userState = null;

  if (db) {
    try {
      userState = await getUserState(db, userId);
    } catch (error) {
      console.error('❌ Failed to read user state:', error.message);
      userState = null;
    }
  }

  const currentState = userState?.state ?? null;
  const currentData = userState?.data ?? {};

  if (currentState === USER_STATES.WAITING_FOR_ADMIN_REJECTION_REASON) {
    return await handleAdminRejectionReason(
      message,
      env,
      db,
      userState
    );
  }

  const applicationStates = new Set([
    USER_STATES.WAITING_FOR_ADMIN_APPLICATION_CONFIRMATION,
    USER_STATES.WAITING_FOR_ADMIN_APPLICATION_FIRST_NAME,
    USER_STATES.WAITING_FOR_ADMIN_APPLICATION_LAST_NAME,
    USER_STATES.WAITING_FOR_ADMIN_APPLICATION_PHONE,
  ]);

  if (applicationStates.has(currentState)) {
    if (currentState === USER_STATES.WAITING_FOR_ADMIN_APPLICATION_CONFIRMATION) {
      if (text === EARN_MONEY_BUTTONS.COURSE_PURCHASED) {
        return await startAdminApplication(message, env, db);
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

  if (currentState === USER_STATES.WAITING_FOR_ADMIN_VERIFICATION) {
    return await handleAdminVerificationInput(message, env, db);
  }

  if (text === MAIN_MENU_BUTTONS.BUY_COURSE) {
    return await showCourseMenu(message, env);
  }

  if (text === COURSE_MENU_BUTTONS.VERIFY_ADMIN) {
    return await startAdminVerification(message, env, db);
  }

  if (text === COURSE_MENU_BUTTONS.BUY_DIRECT) {
    return await startDirectCoursePurchase(message, env, db);
  }

  if (text === MAIN_MENU_BUTTONS.EARN_MONEY) {
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

  if (text === EARN_MONEY_BUTTONS.APPLY_ADMIN) {
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
      console.error('❌ Failed to save application state:', error.message);

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

  if (text === MAIN_MENU_BUTTONS.SUPPORT) {
    return await sendMessage(
      botToken,
      chatId,
      `❓ <b>راهنما و پشتیبانی</b>\n\n` +
      `برای دریافت راهنمایی و پشتیبانی، با تیم EndMark در ارتباط باشید.`,
      getMainMenuKeyboard()
    );
  }

  return await sendMessage(
    botToken,
    chatId,
    'لطفاً یکی از گزینه‌های موجود در منو را انتخاب کنید.',
    getMainMenuKeyboard()
  );
}
