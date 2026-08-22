MESSAGE HANDLER CHANGES
=======================

1) Add these imports near the existing imports:

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


2) Add these functions before the final `export default async function handleMessage(...)`:

async function startDirectCoursePurchase(message, env, db) {
  const botToken = env.TELEGRAM_BOT_TOKEN;
  const chatId = message.chat.id;
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
    const telegramUser = message.from;
    const user = await ensureUser(db, telegramUser);

    if (!user?.id) {
      throw new Error('Could not resolve internal user id');
    }

    const approvedPurchase = await getApprovedPurchase(
      db,
      user.id
    );

    if (approvedPurchase) {
      return await sendMessage(
        botToken,
        chatId,
        '✅ شما قبلاً دوره را خریداری کرده‌اید و خریدتان در سیستم ثبت شده است.',
        getCourseMenuKeyboard()
      );
    }

    const pendingPurchase = await getPendingBlupalPurchase(
      db,
      user.id
    );

    if (
      pendingPurchase?.blupal_payment_link
    ) {
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

    // مبلغ ورودی سیستم: 200 = 200,000 تومان.
    // این تبدیل در createPurchase انجام می‌شود:
    // 200 × 1000 = 200,000 تومان
    // 200,000 × 10 = 2,000,000 ریال
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

      const baseToman =
        Math.floor(invoice.amount / 10);

      const finalToman =
        Math.floor(invoice.final_amount / 10);

      const expiresText = invoice.expires_at
        ? `\n⏳ اعتبار فاکتور: <b>${invoice.expires_at}</b>`
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
      await cancelWaitingPurchase(
        db,
        purchase.id
      );

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


3) Inside `handleMessage`, after the existing `Verify admin` block, add:

  if (
    text ===
    COURSE_MENU_BUTTONS.BUY_DIRECT
  ) {
    return await startDirectCoursePurchase(
      message,
      env,
      db
    );
  }


IMPORTANT:
- Do NOT put BLUPAL_API_KEY in this file.
- Do NOT put the key in wrangler.toml.
- The amount input stays in "thousand tomans": 200 means 200,000 toman.
- createPurchase converts it to IRR before the Blupal API call.
