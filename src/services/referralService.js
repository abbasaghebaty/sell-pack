import { sendMessage } from "../api/telegram.js";
import { creditWallet } from "./walletService.js";
import { getReferrerTelegramId, insertReferralCommission } from "../database/referrals.js";

export const REFERRAL_COMMISSION_PERCENT = 20;

export function calculateCommissionToman(purchaseAmountRial) {
  const toman = Math.floor(Number(purchaseAmountRial) / 10);
  if (!Number.isFinite(toman) || toman <= 0) return 0;
  return Math.floor((toman * REFERRAL_COMMISSION_PERCENT) / 100);
}

// Safe to call more than once for the same purchase (wallet credit and the
// commission row are both keyed by purchase id).
export async function awardReferralCommission(db, env, purchase) {
  if (!db || !env?.WALLET_DB || !purchase?.id || !purchase?.telegram_id) return null;

  const referrerId = await getReferrerTelegramId(db, purchase.telegram_id);
  if (!referrerId) return null;

  const amountToman = calculateCommissionToman(purchase.amount);
  if (amountToman <= 0) return null;

  await creditWallet(env.WALLET_DB, referrerId, amountToman, {
    type: "referral_commission",
    referenceType: "referral_commission",
    referenceId: String(purchase.id),
    description: "کمیسیون معرفی"
  });

  const inserted = await insertReferralCommission(db, {
    purchaseId: purchase.id,
    referrerId,
    referredId: purchase.telegram_id,
    amountToman
  });

  if (inserted) {
    try {
      await sendMessage(
        env.TELEGRAM_BOT_TOKEN,
        referrerId,
        `🎉 <b>کمیسیون جدید</b>\n\nیکی از دعوت‌شدگان شما اشتراک خرید و مبلغ <b>${amountToman.toLocaleString("fa-IR")} تومان</b> به کیف پول شما اضافه شد.`
      );
    } catch (error) {
      console.warn("Referral notification failed:", error.message);
    }
  }
  return { referrerId, amountToman, inserted };
}
