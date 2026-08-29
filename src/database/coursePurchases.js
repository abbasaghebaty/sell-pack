/**
 * Course Purchases Database
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
    WHERE u.telegram_id = ?
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
 * - subscription plan object: { code, durationDays, priceRial }
 * - legacy integer is kept only for backward compatibility.
 */
export async function createPurchase(db, userId, planOrLegacy) {
  let planCode = null;
  let durationDays = null;
  let rialAmount = null;
  let amountInput = null;
  let tomanAmount = null;

  if (typeof planOrLegacy === 'object' && planOrLegacy) {
    planCode = planOrLegacy.code ?? null;
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
    planCode = 'legacy';
  }

  if (!Number.isInteger(rialAmount) || rialAmount <= 0) {
    throw new Error(`Invalid purchase amount: ${rialAmount}`);
  }

  const result = await db.prepare(`
    INSERT INTO course_purchases (
      user_id,
      amount,
      status,
      plan_code,
      duration_days,
      access_status
    )
    VALUES (?, ?, 'waiting_payment', ?, ?, 'pending')
  `).bind(
    userId,
    rialAmount,
    planCode,
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
    planCode,
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
      access_status = 'canceled',
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
      activated_at = COALESCE(activated_at, CURRENT_TIMESTAMP),
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
      u.telegram_id
    FROM course_purchases cp
    INNER JOIN users u ON u.id = cp.user_id
    WHERE cp.id = ?
    LIMIT 1
  `).bind(purchase.id).first();
}

export async function setPurchaseActivation(db, purchaseId, expiresAt) {
  await db.prepare(`
    UPDATE course_purchases
    SET
      expires_at = ?,
      access_status = 'active',
      activated_at = COALESCE(activated_at, CURRENT_TIMESTAMP),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(expiresAt ?? null, purchaseId).run();
}

export async function savePurchaseInviteLink(db, purchaseId, inviteLink, inviteLinkExpiresAt) {
  await db.prepare(`
    UPDATE course_purchases
    SET
      invite_link = ?,
      invite_link_expires_at = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(inviteLink ?? null, inviteLinkExpiresAt ?? null, purchaseId).run();
}

export async function markPurchaseJoined(db, purchaseId) {
  await db.prepare(`
    UPDATE course_purchases
    SET
      channel_joined_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(purchaseId).run();
}

export async function clearPurchaseInviteLink(db, purchaseId) {
  await db.prepare(`
    UPDATE course_purchases
    SET
      invite_link = NULL,
      invite_link_expires_at = NULL,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(purchaseId).run();
}

export async function markPurchaseExpired(db, purchaseId) {
  await db.prepare(`
    UPDATE course_purchases
    SET
      status = 'expired',
      access_status = 'expired',
      invite_link = NULL,
      invite_link_expires_at = NULL,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
      AND status = 'approved'
  `).bind(purchaseId).run();
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
      u.telegram_id
    FROM course_purchases cp
    INNER JOIN users u ON u.id = cp.user_id
    WHERE cp.blupal_invoice_id = ?
    LIMIT 1
  `).bind(invoiceId).first();
}
