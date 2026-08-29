import handleMessage from './messageHandler.js';

import {
  sendMessage,
} from '../api/telegram.js';

import {
  ensureUser,
} from '../database/users.js';

import {
  createPurchase,
  getPendingBlupalPurchase,
  attachBlupalInvoice,
  cancelWaitingPurchase,
  getActivePurchase,
} from '../database/coursePurchases.js';

import {
  createBlupalInvoice,
} from '../api/blupal.js';

import {
  buildPaymentMessage,
  buildPaymentKeyboard,
} from '../utils/paymentMessage.js';

import {
  COURSE_MENU_BUTTONS,
  getCourseMenuKeyboard,
} from '../../keyboards/courseMenu.js';

import {
  getCoursePlansKeyboard,
  getPlanFromButton,
} from '../../keyboards/coursePlans.js';

import {
  formatToman,
} from '../config/coursePlans.js';

import {
  issueFreshInviteLink,
} from './courseAccessHandler.js';


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
 * هر دو متن را پشتیبانی می‌کنیم:
 *
 * متن جدید:
 * 💳 خرید اشتراک
 *
 * متن قدیمی:
 * 💳 خرید مستقیم دوره
 *
 * این کار باعث می‌شود Reply Keyboard
 * قدیمی هم وارد مسیر جدید شود.
 */
const OLD_BUY_BUTTON =
  '💳 خرید مستقیم دوره';


function isBuySubscriptionButton(
  text
) {
  return (
    text ===
      COURSE_MENU_BUTTONS.BUY_DIRECT ||
    text ===
      OLD_BUY_BUTTON
  );
}


function getPlanTitle(plan) {
  return (
    plan?.title ||
    'اشتراک'
  );
}


async function showPlans(
  message,
  env
) {
  return sendMessage(
    env.TELEGRAM_BOT_TOKEN,

    message.chat.id,

    `💳 <b>انتخاب اشتراک</b>\n\n` +

    `مدت اشتراک موردنظر خود را انتخاب کنید.\n\n` +

    `• ۷ روز — <b>۴۰٬۰۰۰ تومان</b>\n` +
    `• ۳۰ روز — <b>۱۲۰٬۰۰۰ تومان</b>\n` +
    `• ۹۰ روز — <b>۲۴۰٬۰۰۰ تومان</b>\n` +
    `• ۱۸۰ روز — <b>۳۵۰٬۰۰۰ تومان</b>\n` +
    `• دائمی — <b>۴۵۰٬۰۰۰ تومان</b>\n\n` +

    `پس از تأیید پرداخت، اشتراک فقط برای همین حساب Telegram فعال می‌شود.`,

    getCoursePlansKeyboard()
  );
}


async function sendActiveStatus(
  message,
  env,
  db,
  purchase
) {
  const inviteLink =
    await issueFreshInviteLink(
      db,
      env,
      purchase
    );

  const expiryText =
    purchase.expires_at
      ? new Date(
          purchase.expires_at
        ).toLocaleString(
          'fa-IR'
        )
      : 'بدون تاریخ انقضا';

  const planTitle =
    purchase.course_plan === '7d'
      ? '۷ روز'
      : purchase.course_plan === '30d'
        ? '۳۰ روز'
        : purchase.course_plan === '90d'
          ? '۹۰ روز'
          : purchase.course_plan === '180d'
            ? '۱۸۰ روز'
            : 'دائمی';

  return sendMessage(
    env.TELEGRAM_BOT_TOKEN,

    message.chat.id,

    `✅ <b>اشتراک شما فعال است</b>\n\n` +

    `نوع اشتراک: <b>${escapeHtml(
      planTitle
    )}</b>\n` +

    `اعتبار تا: <b>${escapeHtml(
      expiryText
    )}</b>\n\n` +

    `این اشتراک فقط برای حساب Telegram شما فعال شده است.\n\n` +

    `<a href="${escapeHtml(
      inviteLink
    )}">ورود به کانال خصوصی</a>`,

    getCourseMenuKeyboard()
  );
}


async function startSubscriptionPurchase(
  message,
  env,
  db,
  plan
) {
  const botToken =
    env.TELEGRAM_BOT_TOKEN;

  const chatId =
    message.chat.id;

  if (!db) {
    return sendMessage(
      botToken,
      chatId,

      '❌ دیتابیس در دسترس نیست.',

      getCourseMenuKeyboard()
    );
  }

  try {
    /*
     * ثبت کاربر
     */
    const user =
      await ensureUser(
        db,
        message.from
      );

    if (!user?.id) {
      throw new Error(
        'Could not resolve internal user id.'
      );
    }


    /*
     * بررسی اشتراک فعال
     */
    const activePurchase =
      await getActivePurchase(
        db,
        user.id
      );

    if (activePurchase) {
      return sendActiveStatus(
        message,
        env,
        db,
        activePurchase
      );
    }


    /*
     * بررسی Invoice قبلی
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

          paymentLink:
            pendingPurchase.blupal_payment_link ??
            null,
        });

      const paymentKeyboard =
        buildPaymentKeyboard({
          finalAmountRial:
            Number(
              pendingPurchase.blupal_final_amount
            ),

          paymentLink:
            pendingPurchase.blupal_payment_link ??
            null,
        });

      return sendMessage(
        botToken,
        chatId,

        `⚠️ <b>فاکتور قبلی شما هنوز معتبر است.</b>\n\n` +
        paymentMessage,

        paymentKeyboard
      );
    }


    /*
     * ایجاد Purchase
     *
     * بسیار مهم:
     *
     * مبلغ از plan می‌آید.
     * هیچ مبلغ ثابتی اینجا نداریم.
     */
    const purchase =
      await createPurchase(
        db,
        user.id,
        plan
      );


    let invoice;

    try {
      /*
       * ارسال دقیق مبلغ پلن به Blupal
       */
      invoice =
        await createBlupalInvoice(
          env,
          purchase.rialAmount
        );


      /*
       * ذخیره Invoice
       */
      await attachBlupalInvoice(
        db,
        purchase.id,
        invoice
      );


      /*
       * پیام پرداخت
       */
      const paymentMessage =
        buildPaymentMessage({
          baseAmountRial:
            Number(
              invoice.amount
            ),

          finalAmountRial:
            Number(
              invoice.final_amount
            ),

          expiresAt:
            invoice.expires_at ??
            null,

          paymentLink:
            invoice.payment_link ??
            null,

          cardNumber:
            invoice.card_number ??
            null,
        });


      /*
       * دکمه پرداخت
       */
      const paymentKeyboard =
        buildPaymentKeyboard({
          finalAmountRial:
            Number(
              invoice.final_amount
            ),

          paymentLink:
            invoice.payment_link ??
            null,

          cardNumber:
            invoice.card_number ??
            null,
        });


      return sendMessage(
        botToken,
        chatId,

        `🛒 <b>اشتراک ${escapeHtml(
          getPlanTitle(plan)
        )}</b>\n\n` +

        `مبلغ اشتراک: <b>${formatToman(
          plan.priceToman
        )} تومان</b>\n\n` +

        paymentMessage,

        paymentKeyboard
      );

    } catch (error) {

      /*
       * اگر ساخت Invoice شکست خورد،
       * Purchase ناقص باقی نماند.
       */
      await cancelWaitingPurchase(
        db,
        purchase.id
      );

      throw error;
    }

  } catch (error) {

    console.error(
      '❌ Subscription purchase error:',
      error.message,
      error.stack
    );

    return sendMessage(
      botToken,
      chatId,

      `❌ <b>ساخت فاکتور انجام نشد.</b>\n\n` +

      `<code>${escapeHtml(
        error.message
      )}</code>`,

      getCourseMenuKeyboard()
    );
  }
}


export default async function handleSubscriptionMessage(
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

  const text =
    message.text?.trim();


  /*
   * هم دکمه جدید
   * هم دکمه قدیمی
   *
   * هیچ‌کدام دیگر خرید 200k
   * انجام نمی‌دهند.
   */
  if (
    isBuySubscriptionButton(
      text
    )
  ) {
    return showPlans(
      message,
      env
    );
  }


  /*
   * انتخاب پلن
   */
  const plan =
    getPlanFromButton(
      text
    );

  if (plan) {
    return startSubscriptionPurchase(
      message,
      env,
      db,
      plan
    );
  }


  /*
   * سایر امکانات ربات
   */
  return handleMessage(
    message,
    env,
    db
  );
}
