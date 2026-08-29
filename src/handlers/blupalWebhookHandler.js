/**
 * Blupal Webhook Handler
 */

import {
  sendMessage,
} from '../api/telegram.js';

import {
  approveBlupalPurchase,
  findPurchaseByInvoiceId,
} from '../database/coursePurchases.js';

import {
  activateCoursePurchase,
} from './courseAccessHandler.js';

import {
  getCoursePlan,
} from '../config/coursePlans.js';

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

export async function handleBlupalWebhook(
  request,
  env,
  db
) {
  if (
    request.method !==
    'POST'
  ) {
    return Response.json(
      {
        error:
          'Method Not Allowed',
      },
      {
        status: 405,
      }
    );
  }

  if (!db) {
    return Response.json(
      {
        error:
          'Database unavailable',
      },
      {
        status: 500,
      }
    );
  }

  let payload;

  try {
    payload =
      await request.json();
  } catch {
    return Response.json(
      {
        error:
          'Invalid JSON',
      },
      {
        status: 400,
      }
    );
  }

  console.log(
    'Blupal webhook received:',
    {
      event:
        payload?.event,

      status:
        payload?.status,

      invoice_id:
        payload?.invoice_id,

      amount:
        payload?.amount,

      final_amount:
        payload?.final_amount,

      mode:
        payload?.mode,
    }
  );

  /*
   * فقط پرداخت تکمیل‌شده
   */
  if (
    payload?.event !==
      'payment.completed' ||
    payload?.status !==
      'PAID'
  ) {
    return Response.json(
      {
        received: true,
        ignored: true,
      },
      {
        status: 200,
      }
    );
  }

  const invoiceId =
    Number(
      payload.invoice_id
    );

  const amount =
    Number(
      payload.amount
    );

  const finalAmount =
    Number(
      payload.final_amount ??
      payload.amount
    );

  if (
    !Number.isInteger(
      invoiceId
    ) ||
    !Number.isInteger(
      amount
    ) ||
    !Number.isInteger(
      finalAmount
    )
  ) {
    return Response.json(
      {
        error:
          'Invalid payment payload',
      },
      {
        status: 400,
      }
    );
  }

  const purchase =
    await findPurchaseByInvoiceId(
      db,
      invoiceId
    );

  if (!purchase) {
    console.error(
      `Invoice ${invoiceId} not found.`
    );

    return Response.json(
      {
        error:
          'Invoice not found',
      },
      {
        status: 404,
      }
    );
  }

  /*
   * جلوگیری از جعل مبلغ
   */
  if (
    Number(
      purchase.amount
    ) !== amount
  ) {
    console.error(
      'Webhook amount mismatch:',
      {
        invoiceId,
        expected:
          purchase.amount,
        received:
          amount,
      }
    );

    return Response.json(
      {
        error:
          'Amount mismatch',
      },
      {
        status: 400,
      }
    );
  }

  /*
   * mode validation
   */
  const apiKey =
    env.BLUPAL_API_KEY?.trim() ||
    '';

  const expectedMode =
    apiKey.startsWith(
      'blu_test_'
    )
      ? 'sandbox'
      : apiKey.startsWith(
          'blu_live_'
        )
        ? 'live'
        : null;

  if (
    expectedMode &&
    payload.mode &&
    payload.mode !==
      expectedMode
  ) {
    return Response.json(
      {
        error:
          'Mode mismatch',
      },
      {
        status: 400,
      }
    );
  }

  /*
   * اگر قبلاً فعال شده
   * دوباره کاری نکن.
   */
  if (
    purchase.status ===
      'approved' &&
    purchase.access_status ===
      'active'
  ) {
    return Response.json(
      {
        received: true,
        duplicate: true,
      },
      {
        status: 200,
      }
    );
  }

  /*
   * تایید خرید
   */
  const approvedPurchase =
    await approveBlupalPurchase(
      db,

      invoiceId,

      payload.transaction_id ??
        null,

      finalAmount,

      payload.mode ??
        expectedMode
    );

  if (!approvedPurchase) {
    return Response.json(
      {
        error:
          'Could not approve purchase',
      },
      {
        status: 500,
      }
    );
  }

  /*
   * فعال‌سازی دوره
   */
  let activated;

  try {
    activated =
      await activateCoursePurchase(
        db,
        env,
        approvedPurchase
      );
  } catch (error) {
    console.error(
      'Course activation failed:',
      error.message,
      error.stack
    );

    return Response.json(
      {
        error:
          'Payment approved but course activation failed',
      },
      {
        status: 500,
      }
    );
  }

  const plan =
    getCoursePlan(
      activated.purchase.course_plan
    );

  const planTitle =
    plan?.title ||
    'دائمی';

  const expiryText =
    activated.purchase.expires_at
      ? new Date(
          activated.purchase.expires_at
        ).toLocaleString(
          'fa-IR'
        )
      : 'بدون تاریخ انقضا';

  try {
    await sendMessage(
      env.TELEGRAM_BOT_TOKEN,

      activated.purchase.telegram_id,

      `✅ <b>پرداخت با موفقیت تأیید شد</b>\n\n` +

      `اشتراک <b>${escapeHtml(
        planTitle
      )}</b> برای حساب شما فعال شد.\n\n` +

      `مبلغ پرداختی: <b>${Math.floor(
        finalAmount / 10
      ).toLocaleString(
        'fa-IR'
      )} تومان</b>\n` +

      `اعتبار تا: <b>${escapeHtml(
        expiryText
      )}</b>\n\n` +

      `لینک زیر فقط برای همین حساب Telegram صادر شده است:\n\n` +

      `<a href="${escapeHtml(
        activated.inviteLink
      )}">ورود به کانال خصوصی</a>`
    );
  } catch (error) {
    console.error(
      'Failed to send purchase notification:',
      error.message
    );
  }

  return Response.json(
    {
      received: true,
    },
    {
      status: 200,
    }
  );
}
