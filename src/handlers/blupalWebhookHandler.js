/**
 * Blupal Webhook Handler
 */

import {
  approveBlupalPurchase,
  findPurchaseByInvoiceId,
} from '../database/coursePurchases.js';

import { sendMessage } from '../api/telegram.js';

import {
  activateCoursePurchase,
} from './courseAccessHandler.js';

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

  if (!Number.isInteger(invoiceId) || !Number.isInteger(amount) || !Number.isInteger(finalAmount)) {
    return Response.json({ error: 'Invalid payment payload' }, { status: 400 });
  }

  const existingPurchase = await findPurchaseByInvoiceId(db, invoiceId);
  if (!existingPurchase) {
    console.error(`Blupal webhook: invoice ${invoiceId} not found in DB`);
    return Response.json({ error: 'Invoice not found' }, { status: 404 });
  }

  if (Number(existingPurchase.amount) !== amount) {
    console.error(`Blupal webhook amount mismatch for invoice ${invoiceId}`, {
      expected: existingPurchase.amount,
      received: amount,
    });
    return Response.json({ error: 'Amount mismatch' }, { status: 400 });
  }

  const apiKey = env.BLUPAL_API_KEY?.trim() || '';
  const expectedMode = apiKey.startsWith('blu_test_')
    ? 'sandbox'
    : apiKey.startsWith('blu_live_')
      ? 'live'
      : null;

  if (expectedMode && payload.mode && payload.mode !== expectedMode) {
    console.error(`Blupal webhook mode mismatch for invoice ${invoiceId}`);
    return Response.json({ error: 'Mode mismatch' }, { status: 400 });
  }

  const wasAlreadyApproved = existingPurchase.status === 'approved';

  const approvedPurchase = await approveBlupalPurchase(
    db,
    invoiceId,
    payload.transaction_id ?? null,
    finalAmount,
    payload.mode ?? expectedMode,
  );

  if (!approvedPurchase) {
    return Response.json({ error: 'Could not approve purchase' }, { status: 500 });
  }

  let activated;
  try {
    activated = await activateCoursePurchase(db, env, approvedPurchase);
  } catch (error) {
    console.error(`Course activation failed for purchase ${approvedPurchase.id}:`, error.message, error.stack);
    return Response.json({ error: 'Payment approved but course activation failed' }, { status: 500 });
  }

  if (!wasAlreadyApproved || !existingPurchase.invite_link) {
    try {
      const expiryText = activated.purchase.expires_at
        ? new Date(activated.purchase.expires_at).toLocaleString('fa-IR')
        : 'بدون تاریخ انقضا';

      const planTitle = activated.purchase.plan_code === '7d'
        ? '۷ روز'
        : activated.purchase.plan_code === '30d'
          ? '۳۰ روز'
          : activated.purchase.plan_code === '90d'
            ? '۹۰ روز'
            : activated.purchase.plan_code === '180d'
              ? '۱۸۰ روز'
              : 'دائمی';

      await sendMessage(
        env.TELEGRAM_BOT_TOKEN,
        activated.purchase.telegram_id,
        `✅ <b>پرداخت با موفقیت تأیید شد</b>\n\n` +
        `اشتراک <b>${escapeHtml(planTitle)}</b> برای حساب Telegram شما فعال شد.\n\n` +
        `مبلغ پرداختی: <b>${Math.floor(finalAmount / 10).toLocaleString('fa-IR')}</b> تومان\n` +
        `اعتبار تا: <b>${escapeHtml(expiryText)}</b>\n\n` +
        `لینک زیر فقط برای حساب شما صادر شده است:\n\n` +
        `<a href="${escapeHtml(activated.inviteLink)}">ورود به کانال خصوصی</a>`,
      );
    } catch (error) {
      console.error('Course access notification failed:', error.message);
    }
  }

  return Response.json({ received: true }, { status: 200 });
}
