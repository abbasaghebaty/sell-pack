import { getCoursePlan } from "../config/coursePlans.js";
import {
  findPurchaseByInvoiceId,
  cancelWaitingPurchase,
  approveBlupalPurchase
} from "../database/coursePurchasesQueries.js";
import { activateCoursePurchase } from "./courseAccessService.js";
import { settleCoursePaymentToWallet } from "./walletService.js";
import { awardReferralCommission } from "./referralService.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getExpectedBlupalMode(apiKey) {
  const key = apiKey?.trim() || "";
  if (key.startsWith("blu_test_")) return "sandbox";
  if (key.startsWith("blu_live_")) return "live";
  return null;
}

export function parseWebhookPayload(payload) {
  const invoiceId = Number(payload?.invoice_id);
  const amount = Number(payload?.amount);
  const finalAmount = Number(payload?.final_amount ?? payload?.amount);
  if (
    !Number.isInteger(invoiceId) || invoiceId <= 0 ||
    !Number.isInteger(amount) || amount <= 0 ||
    !Number.isInteger(finalAmount) || finalAmount <= 0
  ) {
    throw new Error("Invalid payment payload");
  }
  return {
    invoiceId,
    amount,
    finalAmount,
    transactionId: payload?.transaction_id ?? null,
    mode: payload?.mode ?? null
  };
}

function httpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function validatePurchaseWebhook(db, env, parsed) {
  const purchase = await findPurchaseByInvoiceId(db, parsed.invoiceId);
  if (!purchase) throw httpError("Invoice not found", 404);

  if (purchase.status === "waiting_payment") {
    const expiry = purchase.blupal_expires_at ? new Date(purchase.blupal_expires_at).getTime() : NaN;
    if (!Number.isFinite(expiry) || expiry <= Date.now()) {
      await cancelWaitingPurchase(db, purchase.id);
      return { purchase: null, ignoredReason: "invoice_expired" };
    }
  }

  if (Number(purchase.amount) !== parsed.amount) throw httpError("Amount mismatch", 400);
  if (
    purchase.blupal_final_amount !== null &&
    purchase.blupal_final_amount !== undefined &&
    Number(purchase.blupal_final_amount) !== parsed.finalAmount
  ) {
    throw httpError("Final amount mismatch", 400);
  }

  const expectedMode = getExpectedBlupalMode(env.BLUPAL_API_KEY);
  if (expectedMode && parsed.mode && parsed.mode !== expectedMode) throw httpError("Mode mismatch", 400);

  if (purchase.status === "approved" && purchase.access_status === "active") {
    return { purchase, duplicate: true };
  }
  if (purchase.status === "approved") {
    return { purchase, duplicate: false, alreadyApproved: true };
  }
  if (purchase.status !== "waiting_payment") {
    return { purchase: null, ignoredReason: "purchase_not_pending" };
  }
  return { purchase, duplicate: false, alreadyApproved: false };
}

export async function processPaymentWebhook(db, env, parsed) {
  const validation = await validatePurchaseWebhook(db, env, parsed);
  if (!validation.purchase) return validation;
  if (validation.duplicate) return validation;

  let approvedPurchase = validation.purchase;
  if (!validation.alreadyApproved) {
    approvedPurchase = await approveBlupalPurchase(
      db,
      parsed.invoiceId,
      parsed.transactionId,
      parsed.finalAmount,
      parsed.mode ?? getExpectedBlupalMode(env.BLUPAL_API_KEY)
    );
    if (!approvedPurchase) throw httpError("Could not approve purchase", 500);
  }

  // 1) Access first: the customer already paid, nothing below may block this.
  const activated = await activateCoursePurchase(db, env, approvedPurchase);

  // 2) Wallet ledger entry (bookkeeping only).
  try {
    const walletAmountToman = Number(approvedPurchase.amount) / 10;
    if (env.WALLET_DB && Number.isInteger(walletAmountToman) && walletAmountToman > 0) {
      await settleCoursePaymentToWallet(
        env.WALLET_DB,
        approvedPurchase.telegram_id,
        walletAmountToman,
        parsed.invoiceId
      );
    }
  } catch (error) {
    console.error("Wallet settlement failed:", error.message, error.stack);
  }

  // 3) Referral commission (20%) for whoever invited this buyer.
  try {
    await awardReferralCommission(db, env, activated.purchase);
  } catch (error) {
    console.error("Referral commission failed:", error.message, error.stack);
  }

  return {
    ...validation,
    purchase: activated.purchase,
    inviteLink: activated.inviteLink,
    activated: true
  };
}

export function buildPurchaseNotification(finalAmount, activatedPurchase, inviteLink) {
  const plan = getCoursePlan(activatedPurchase.course_plan);
  const planTitle = plan?.title || "دائمی";
  const expiryText = activatedPurchase.expires_at
    ? new Date(activatedPurchase.expires_at).toLocaleString("fa-IR")
    : "بدون تاریخ انقضا";

  return {
    telegramId: activatedPurchase.telegram_id,
    text: `✅ <b>پرداخت با موفقیت تأیید شد</b>

اشتراک <b>${escapeHtml(planTitle)}</b> برای حساب شما فعال شد.

مبلغ پرداختی: <b>${Math.floor(finalAmount / 10).toLocaleString("fa-IR")} تومان</b>
اعتبار تا: <b>${escapeHtml(expiryText)}</b>

لینک زیر فقط برای همین حساب Telegram صادر شده است:

<a href="${escapeHtml(inviteLink)}">ورود به کانال خصوصی</a>`
  };
}
