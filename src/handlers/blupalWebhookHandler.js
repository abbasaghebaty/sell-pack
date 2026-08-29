/**
 * Blupal Webhook Handler
 */

import { sendMessage } from '../api/telegram.js';
import {
  approveBlupalPurchase,
  findPurchaseByInvoiceId,
} from '../database/coursePurchases.js';
import { activateCoursePurchase } from './courseAccessHandler.js';
import { getCoursePlan } from '../config/coursePlans.js';

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

  console.log('Blupal webhook received:', {
    event: payload?.event,
    status: payload?.status,
    invoice_id: payload?.invoice_id,
    amount: payload?.amount,
    mode: payload?.mode,
  });

  if (
    payload?.success !== true ||
    payload?.event !== 'payment.completed' ||
    payload?.status !== 'PAID'
  ) {
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

  const existingPurchase = await findPurchaseByInvoiceId(db, invoiceId);

  if (!existingPurchase) {
    console.error(`Blupal webhook: invoice ${invoiceId} not found.`);
    return Response.json({ error: 'Invoice not found' }, { status: 404 });
  }

  if (Number(existingPurchase.amount) !== amount) {
    console.error('Blupal webhook amount mismatch:', {
      invoiceId,
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
    return Response.json({ error: 'Mode mismatch' }, { status: 400 });
  }

  const wasAlreadyApproved = existingPurchase.status === 'approved';

  if (wasAlreadyApproved && existingPurchase.access_status === 'active') {
    return Response.json({ received: true, duplicate: true }, { status: 200 });
  }

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

  let activated = null;

  try {
    activated = await activateCoursePurchase(db, env, approvedPurchase);
  } catch (error) {
    console.error(
      `Course activation failed for purchase ${approvedPurchase.id}:`,
      error.message,
      error.stack,
    );
    return Response.json(
      { error: 'Payment approved but course activation failed' },
      { status: 500 },
    );
  }

  const plan = getCoursePlan(activated.purchase.course_plan);
  const planTitle = plan?.title || 'دائمی';
  const expiryText = activated.purchase.expires_at
    ? new Date(activated.purchase.expires_at).toLocaleString('fa-IR')
    : 'بدون تاریخ انقضا';

  if (!wasAlreadyApproved || !existingPurchase.invite_link) {
    try {
      await sendMessage(
        env.TELEGRAM_BOT_TOKEN,
        activated.purchase.telegram_id,
        `✅ <b>پرداخت با موفقیت تأیید شد</b>\n\n` +
        `اشتراک <b>${escapeHtml(planTitle)}</b> فعال شد.\n\n` +
        `مبلغ پرداختی: <b>${Math.floor(finalAmount / 10).toLocaleString('fa-IR')} تومان</b>\n` +
        `اعتبار تا: <b>${escapeHtml(expiryText)}</b>\n\n` +
        `لینک زیر فقط برای حساب Telegram شما صادر شده است:\n\n` +
        `<a href="${escapeHtml(activated.inviteLink)}">ورود به کانال خصوصی</a>`,
      );
    } catch (error) {
      console.error('Course access notification failed:', error.message);
    }
  }

  return Response.json({ received: true }, { status: 200 });
}
