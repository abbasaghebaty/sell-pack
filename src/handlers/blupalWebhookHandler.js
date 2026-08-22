/**
 * Blupal Webhook Handler
 *
 * مسیر:
 * src/handlers/blupalWebhookHandler.js
 */

import {
  approveBlupalPurchase,
  findPurchaseByInvoiceId,
} from '../database/coursePurchases.js';

import {
  sendMessage,
} from '../api/telegram.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function handleBlupalWebhook(request, env, db) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method Not Allowed' }, { status: 405 });
  }

  if (!db) {
    return Response.json({ error: 'Database unavailable' }, { status: 500 });
  }

  let payload;

  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (payload?.event !== 'payment.completed' || payload?.status !== 'PAID') {
    return Response.json({ received: true, ignored: true }, { status: 200 });
  }

  const invoiceId = Number(payload.invoice_id);
  const amount = Number(payload.amount);
  const finalAmount = Number(payload.final_amount);

  if (
    !Number.isInteger(invoiceId) ||
    !Number.isInteger(amount) ||
    !Number.isInteger(finalAmount)
  ) {
    return Response.json({ error: 'Invalid payment payload' }, { status: 400 });
  }

  const purchase = await findPurchaseByInvoiceId(db, invoiceId);

  if (!purchase) {
    console.error(`Blupal webhook: invoice ${invoiceId} not found in DB`);
    return Response.json({ error: 'Invoice not found' }, { status: 404 });
  }

  if (Number(purchase.amount) !== amount) {
    console.error(`Blupal webhook amount mismatch for invoice ${invoiceId}`, {
      expected: purchase.amount,
      received: amount,
    });
    return Response.json({ error: 'Amount mismatch' }, { status: 400 });
  }

  const apiKey = env.BLUPAL_API_KEY?.trim() || '';
  const expectedMode =
    apiKey.startsWith('blu_test_')
      ? 'sandbox'
      : apiKey.startsWith('blu_live_')
        ? 'live'
        : null;

  if (
    expectedMode &&
    payload.mode &&
    payload.mode !== expectedMode
  ) {
    console.error(`Blupal webhook mode mismatch for invoice ${invoiceId}`);
    return Response.json({ error: 'Mode mismatch' }, { status: 400 });
  }

  const approvedPurchase = await approveBlupalPurchase(
    db,
    invoiceId,
    payload.transaction_id ?? null,
    finalAmount,
    payload.mode ?? expectedMode
  );

  if (!approvedPurchase) {
    return Response.json({ error: 'Could not approve purchase' }, { status: 500 });
  }

  if (approvedPurchase.status === 'approved') {
    try {
      await sendMessage(
        env.TELEGRAM_BOT_TOKEN,
        approvedPurchase.telegram_id,
        `✅ <b>پرداخت با موفقیت تأیید شد</b>\n\n` +
        `خرید دوره شما با موفقیت ثبت شد.\n\n` +
        `مبلغ پایه: <b>${Math.floor(amount / 10).toLocaleString('fa-IR')}</b> تومان\n` +
        `مبلغ نهایی پرداخت: <b>${Math.floor(finalAmount / 10).toLocaleString('fa-IR')}</b> تومان\n\n` +
        `از این لحظه خرید شما در سیستم ثبت شده است.`,
        undefined
      );
    } catch (error) {
      console.error(
        'Blupal webhook Telegram notification failed:',
        error.message
      );
    }
  }

  return Response.json({ received: true }, { status: 200 });
}
