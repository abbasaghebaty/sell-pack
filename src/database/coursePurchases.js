/**
 * Course Purchases Database
 * Compatible with the current sell-pack D1 schema.
 */

export async function getUserByTelegramId(db, telegramId) {
  return db.prepare(`
    SELECT id, telegram_id
    FROM users
    WHERE telegram_id = ?
    LIMIT 1
  `).bind(telegramId).first();
}

export async function getActivePurchase(db, userId) {
  return db.prepare(`
    SELECT *
    FROM course_purchases
    WHERE user_id = ?
      AND status = 'approved'
      AND COALESCE(access_status, 'active') = 'active'
      AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
    ORDER BY id DESC
    LIMIT 1
  `).bind(userId).first();
}

export async function getApprovedPurchase(db, userId) {
  return getActivePurchase(db, userId);
}

export async function getActivePurchaseByTelegramId(db, telegramId) {
  return db.prepare(`
    SELECT
      cp.*,
      u.telegram_id,
      u.username,
      u.first_name,
      u.last_name
    FROM course_purchases cp
    INNER JOIN users u ON u.id = cp.user_id
    INNER JOIN course_buyers cb ON cb.telegram_id = u.telegram_id
    WHERE u.telegram_id = ?
      AND cb.is_active = 1
      AND (cb.expires_at IS NULL OR cb.expires_at > CURRENT_TIMESTAMP)
      AND cp.status = 'approved'
      AND COALESCE(cp.access_status, 'active') = 'active'
      AND (cp.expires_at IS NULL OR cp.expires_at > CURRENT_TIMESTAMP)
    ORDER BY cp.id DESC
    LIMIT 1
  `).bind(telegramId).first();
}

export async function getPurchaseByInviteLink(db, inviteLink) {
  if (!inviteLink) return null;

  return db.prepare(`
    SELECT
      cp.*,
      u.telegram_id,
      u.username,
      u.first_name,
      u.last_name
    FROM course_purchases cp
    INNER JOIN users u ON u.id = cp.user_id
    WHERE cp.invite_link = ?
    LIMIT 1
  `).bind(inviteLink).first();
}

export async function getPendingBlupalPurchase(db, userId) {
  return db.prepare(`
    SELECT *
    FROM course_purchases
    WHERE user_id = ?
      AND status = 'waiting_payment'
      AND blupal_invoice_id IS NOT NULL
      AND blupal_final_amount IS NOT NULL
    ORDER BY id DESC
    LIMIT 1
  `).bind(userId).first();
}

/**
 * planOrLegacy:
 * - subscription plan object: { code, durationDays, priceRial, priceToman }
 * - integer: legacy amount input kept for backward compatibility.
 */
export async function createPurchase(db, userId, planOrLegacy) {
  let coursePlan = null;
  let durationDays = null;
  let rialAmount = null;
  let amountInput = null;
  let tomanAmount = null;

  if (typeof planOrLegacy === 'object' && planOrLegacy) {
    coursePlan = planOrLegacy.code ?? null;
    durationDays = planOrLegacy.durationDays ?? null;
    rialAmount = Number(planOrLegacy.priceRial);
    tomanAmount = Number(planOrLegacy.priceToman);
    amountInput = Math.floor(tomanAmount / 10_000);
  } else {
    amountInput = Number(planOrLegacy);

    if (!Number.isInteger(amountInput) || amountInput <= 0) {
      throw new Error(`Invalid amount input: ${planOrLegacy}`);
    }

    tomanAmount = amountInput * 10_000;
    rialAmount = tomanAmount * 10;
    coursePlan = 'legacy';
  }

  if (!Number.isInteger(rialAmount) || rialAmount <= 0) {
    throw new Error(`Invalid purchase amount: ${rialAmount}`);
  }

  const result = await db.prepare(`
    INSERT INTO course_purchases (
      user_id,
      amount,
      status,
      course_plan,
      duration_days,
      access_status
    )
    VALUES (?, ?, 'waiting_payment', ?, ?, 'inactive')
  `).bind(
    userId,
    rialAmount,
    coursePlan,
    durationDays,
  ).run();

  const purchaseId = result?.meta?.last_row_id;
  if (!purchaseId) {
    throw new Error('Failed to create course purchase record.');
  }

  return {
    id: purchaseId,
    amountInput,
    tomanAmount,
    rialAmount,
    coursePlan,
    durationDays,
  };
}

export async function attachBlupalInvoice(db, purchaseId, invoice) {
  if (!purchaseId) throw new Error('Purchase ID is required.');
  if (!invoice?.invoice_id) throw new Error('Blupal invoice ID is missing.');
  if (!Number.isInteger(Number(invoice.amount))) throw new Error('Blupal invoice amount is missing.');
  if (!Number.isInteger(Number(invoice.final_amount))) throw new Error('Blupal final amount is missing.');

  const result = await db.prepare(`
    UPDATE course_purchases
    SET
      blupal_invoice_id = ?,
      blupal_final_amount = ?,
      blupal_payment_link = ?,
      blupal_expires_at = ?,
      payment_mode = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(
    Number(invoice.invoice_id),
    Number(invoice.final_amount),
    invoice.payment_link ?? null,
    invoice.expires_at ?? null,
    invoice.mode ?? null,
    purchaseId,
  ).run();

  if (!result?.meta?.changes) {
    throw new Error(`Failed to attach Blupal invoice to purchase ${purchaseId}.`);
  }
}

export async function cancelWaitingPurchase(db, purchaseId) {
  await db.prepare(`
    UPDATE course_purchases
    SET
      status = 'canceled',
      access_status = 'inactive',
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
      AND status = 'waiting_payment'
  `).bind(purchaseId).run();
}

export async function approveBlupalPurchase(db, invoiceId, transactionId, finalAmount, mode) {
  const purchase = await db.prepare(`
    SELECT
      cp.*,
      u.telegram_id
    FROM course_purchases cp
    INNER JOIN users u ON u.id = cp.user_id
    WHERE cp.blupal_invoice_id = ?
    LIMIT 1
  `).bind(invoiceId).first();

  if (!purchase) return null;
  if (purchase.status === 'approved') return purchase;

  await db.prepare(`
    UPDATE course_purchases
    SET
      status = 'approved',
      access_status = 'active',
      blupal_final_amount = ?,
      transaction_id = ?,
      payment_mode = ?,
      paid_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
      AND status != 'approved'
  `).bind(
    finalAmount ?? null,
    transactionId ?? null,
    mode ?? null,
    purchase.id,
  ).run();

  return db.prepare(`
    SELECT
      cp.*,
      u.telegram_id,
      u.username,
      u.first_name,
      u.last_name
    FROM course_purchases cp
    INNER JOIN users u ON u.id = cp.user_id
    WHERE cp.id = ?
    LIMIT 1
  `).bind(purchase.id).first();
}

export async function setPurchaseActivation(db, purchaseId, expiresAt) {
  const purchase = await db.prepare(`
    SELECT cp.*, u.telegram_id
    FROM course_purchases cp
    INNER JOIN users u ON u.id = cp.user_id
    WHERE cp.id = ?
    LIMIT 1
  `).bind(purchaseId).first();

  if (!purchase) throw new Error(`Purchase ${purchaseId} not found.`);

  await db.prepare(`
    UPDATE course_purchases
    SET
      expires_at = ?,
      access_status = 'active',
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(expiresAt ?? null, purchaseId).run();

  await db.prepare(`
    INSERT INTO course_buyers (
      telegram_id,
      access_type,
      purchased_at,
      expires_at,
      is_active
    )
    VALUES (?, ?, CURRENT_TIMESTAMP, ?, 1)
    ON CONFLICT(telegram_id) DO UPDATE SET
      access_type = excluded.access_type,
      purchased_at = excluded.purchased_at,
      expires_at = excluded.expires_at,
      is_active = 1
  `).bind(
    purchase.telegram_id,
    purchase.course_plan ?? 'legacy',
    expiresAt ?? null,
  ).run();
}

export async function savePurchaseInviteLink(db, purchaseId, inviteLink, inviteLinkExpiresAt) {
  await db.prepare(`
    UPDATE course_purchases
    SET
      invite_link = ?,
      invite_link_created_at = CURRENT_TIMESTAMP,
      invite_link_used_at = NULL,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(
    inviteLink ?? null,
    purchaseId,
  ).run();

  // invite_link_expires_at is added by the small follow-up migration.
  await db.prepare(`
    UPDATE course_purchases
    SET invite_link_expires_at = ?
    WHERE id = ?
  `).bind(
    inviteLinkExpiresAt ?? null,
    purchaseId,
  ).run();
}

export async function markPurchaseJoined(db, purchaseId) {
  await db.prepare(`
    UPDATE course_purchases
    SET
      channel_joined_at = CURRENT_TIMESTAMP,
      invite_link_used_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(purchaseId).run();
}

export async function clearPurchaseInviteLink(db, purchaseId) {
  await db.prepare(`
    UPDATE course_purchases
    SET
      invite_link = NULL,
      invite_link_used_at = COALESCE(invite_link_used_at, CURRENT_TIMESTAMP),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(purchaseId).run();
}

export async function markPurchaseExpired(db, purchaseId) {
  const purchase = await db.prepare(`
    SELECT cp.*, u.telegram_id
    FROM course_purchases cp
    INNER JOIN users u ON u.id = cp.user_id
    WHERE cp.id = ?
    LIMIT 1
  `).bind(purchaseId).first();

  if (!purchase) return;

  await db.prepare(`
    UPDATE course_purchases
    SET
      status = 'expired',
      access_status = 'expired',
      invite_link = NULL,
      channel_removed_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
      AND status = 'approved'
  `).bind(purchaseId).run();

  await db.prepare(`
    UPDATE course_buyers
    SET is_active = 0
    WHERE telegram_id = ?
      AND expires_at IS NOT NULL
      AND expires_at <= CURRENT_TIMESTAMP
  `).bind(purchase.telegram_id).run();
}

export async function getExpiredPurchases(db) {
  const result = await db.prepare(`
    SELECT
      cp.*,
      u.telegram_id,
      u.first_name,
      u.username
    FROM course_purchases cp
    INNER JOIN users u ON u.id = cp.user_id
    WHERE cp.status = 'approved'
      AND cp.expires_at IS NOT NULL
      AND cp.expires_at <= CURRENT_TIMESTAMP
      AND COALESCE(cp.access_status, 'active') = 'active'
    ORDER BY cp.id ASC
    LIMIT 100
  `).all();

  return result?.results ?? [];
}

export async function getActivePurchasesWithoutInviteLink(db) {
  const result = await db.prepare(`
    SELECT
      cp.*,
      u.telegram_id,
      u.first_name,
      u.username
    FROM course_purchases cp
    INNER JOIN users u ON u.id = cp.user_id
    WHERE cp.status = 'approved'
      AND COALESCE(cp.access_status, 'active') = 'active'
      AND (cp.expires_at IS NULL OR cp.expires_at > CURRENT_TIMESTAMP)
      AND (
        cp.invite_link IS NULL
        OR cp.invite_link = ''
        OR cp.invite_link_expires_at IS NULL
        OR cp.invite_link_expires_at <= CURRENT_TIMESTAMP
      )
      AND cp.channel_joined_at IS NULL
    ORDER BY cp.id ASC
    LIMIT 100
  `).all();

  return result?.results ?? [];
}

export async function findPurchaseByInvoiceId(db, invoiceId) {
  return db.prepare(`
    SELECT
      cp.*,
      u.telegram_id,
      u.username,
      u.first_name,
      u.last_name
    FROM course_purchases cp
    INNER JOIN users u ON u.id = cp.user_id
    WHERE cp.blupal_invoice_id = ?
    LIMIT 1
  `).bind(invoiceId).first();
}
