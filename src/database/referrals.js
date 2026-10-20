function toId(value) {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

export async function registerReferral(db, referrerTelegramId, referredTelegramId) {
  const referrerId = toId(referrerTelegramId);
  const referredId = toId(referredTelegramId);
  if (!referrerId || !referredId) return { registered: false, reason: "invalid" };
  if (referrerId === referredId) return { registered: false, reason: "self" };

  const referrer = await db
    .prepare("SELECT id FROM users WHERE telegram_id = ? LIMIT 1")
    .bind(referrerId)
    .first();
  if (!referrer) return { registered: false, reason: "unknown_referrer" };

  const result = await db
    .prepare(
      "INSERT OR IGNORE INTO referrals (referrer_telegram_id, referred_telegram_id) VALUES (?, ?)"
    )
    .bind(referrerId, referredId)
    .run();

  return result?.meta?.changes
    ? { registered: true, reason: null }
    : { registered: false, reason: "already_referred" };
}

export async function getReferrerTelegramId(db, referredTelegramId) {
  const row = await db
    .prepare("SELECT referrer_telegram_id FROM referrals WHERE referred_telegram_id = ? LIMIT 1")
    .bind(Number(referredTelegramId))
    .first();
  return row?.referrer_telegram_id ?? null;
}

export async function insertReferralCommission(db, { purchaseId, referrerId, referredId, amountToman }) {
  const result = await db
    .prepare(
      `INSERT OR IGNORE INTO referral_commissions
         (purchase_id, referrer_telegram_id, referred_telegram_id, amount_toman)
       VALUES (?, ?, ?, ?)`
    )
    .bind(purchaseId, Number(referrerId), Number(referredId), amountToman)
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
