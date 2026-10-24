// Default commission (percent of the purchase) for every referrer.
// Each user can get a different value later through
// users.referral_commission_percent.
export const DEFAULT_COMMISSION_PERCENT = 20;

function toId(value) {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

function normalizePercent(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 100 ? n : DEFAULT_COMMISSION_PERCENT;
}

// Invite code / active flag / commission percent of one user.
// The code is the user's own numeric Telegram id.
export async function getReferralProfile(db, telegramId) {
  const id = toId(telegramId);
  const fallback = {
    code: String(telegramId ?? ""),
    active: false,
    percent: DEFAULT_COMMISSION_PERCENT
  };
  if (!db || !id) return fallback;

  const row = await db
    .prepare(
      `SELECT referral_code, referral_active, referral_commission_percent
         FROM users WHERE telegram_id = ? LIMIT 1`
    )
    .bind(id)
    .first();
  if (!row) return fallback;

  return {
    code: String(row.referral_code || id),
    active: Number(row.referral_active) === 1,
    percent: normalizePercent(row.referral_commission_percent)
  };
}

// Attach a newly started user to the owner of the invite code.
// Stores the invited user's numeric id in the referrals table (once only).
export async function registerReferral(db, referralCode, referredTelegramId) {
  const code = String(referralCode ?? "").trim();
  const referredId = toId(referredTelegramId);
  if (!/^\d{1,20}$/.test(code) || !referredId) return { registered: false, reason: "invalid" };

  const referrer = await db
    .prepare("SELECT telegram_id, referral_active FROM users WHERE referral_code = ? LIMIT 1")
    .bind(code)
    .first();
  if (!referrer) return { registered: false, reason: "unknown_referrer" };
  if (Number(referrer.referral_active) !== 1) return { registered: false, reason: "inactive_referrer" };

  const referrerId = Number(referrer.telegram_id);
  if (referrerId === referredId) return { registered: false, reason: "self" };

  const result = await db
    .prepare(
      "INSERT OR IGNORE INTO referrals (referrer_telegram_id, referred_telegram_id) VALUES (?, ?)"
    )
    .bind(referrerId, referredId)
    .run();

  return result?.meta?.changes
    ? { registered: true, reason: null, referrerId }
    : { registered: false, reason: "already_referred" };
}

export async function getReferrerTelegramId(db, referredTelegramId) {
  const row = await db
    .prepare("SELECT referrer_telegram_id FROM referrals WHERE referred_telegram_id = ? LIMIT 1")
    .bind(Number(referredTelegramId))
    .first();
  return row?.referrer_telegram_id ?? null;
}

export async function insertReferralCommission(
  db,
  { purchaseId, referrerId, referredId, amountToman, commissionPercent = DEFAULT_COMMISSION_PERCENT }
) {
  const result = await db
    .prepare(
      `INSERT OR IGNORE INTO referral_commissions
         (purchase_id, referrer_telegram_id, referred_telegram_id, commission_percent, amount_toman)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(purchaseId, Number(referrerId), Number(referredId), commissionPercent, amountToman)
    .run();
  return Boolean(result?.meta?.changes);
}

export async function getReferralStats(db, referrerTelegramId) {
  const id = Number(referrerTelegramId);
  const invited = await db
    .prepare("SELECT COUNT(*) AS c FROM referrals WHERE referrer_telegram_id = ?")
    .bind(id)
    .first();
  const earned = await db
    .prepare(
      "SELECT COUNT(*) AS c, COALESCE(SUM(amount_toman), 0) AS s FROM referral_commissions WHERE referrer_telegram_id = ?"
    )
    .bind(id)
    .first();
  return {
    invited: Number(invited?.c || 0),
    purchases: Number(earned?.c || 0),
    totalToman: Number(earned?.s || 0)
  };
}
