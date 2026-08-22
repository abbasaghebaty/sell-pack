/**
 * Course Purchases Database
 *
 * مسیر:
 * src/database/coursePurchases.js
 */

export async function getUserByTelegramId(db, telegramId) {
  return await db
    .prepare(`
      SELECT id, telegram_id
      FROM users
      WHERE telegram_id = ?
      LIMIT 1
    `)
    .bind(telegramId)
    .first();
}

export async function getActivePurchase(db, userId) {
  return await db
    .prepare(`
      SELECT *
      FROM course_purchases
      WHERE user_id = ?
      AND status IN ('waiting_payment', 'waiting_receipt', 'pending_review', 'approved')
      ORDER BY id DESC
      LIMIT 1
    `)
    .bind(userId)
    .first();
}

export async function getApprovedPurchase(db, userId) {
  return await db
    .prepare(`
      SELECT *
      FROM course_purchases
      WHERE user_id = ?
      AND status = 'approved'
      ORDER BY id DESC
      LIMIT 1
    `)
    .bind(userId)
    .first();
}

export async function getPendingBlupalPurchase(db, userId) {
  return await db
    .prepare(`
      SELECT *
      FROM course_purchases
      WHERE user_id = ?
      AND status = 'waiting_payment'
      AND blupal_invoice_id IS NOT NULL
      ORDER BY id DESC
      LIMIT 1
    `)
    .bind(userId)
    .first();
}

/**
 * amountInput = مبلغ به واحد «ده‌هزار تومان».
 * مثال: 2 => 20,000 تومان => 200,000 ریال
 * مثال: 200 => 2,000,000 تومان => 20,000,000 ریال
 *
 * توجه: طبق قرارداد پروژه، ورودی ربات بدون سه صفر انتهاییِ تومان است.
 */
export async function createPurchase(
  db,
  userId,
  amountInput
) {
  if (!Number.isInteger(amountInput) || amountInput <= 0) {
    throw new Error('Invalid amount input');
  }

  const tomanAmount = amountInput * 10000;
  const rialAmount = tomanAmount * 10;

  const result = await db
    .prepare(`
      INSERT INTO course_purchases (
        user_id,
        amount,
        status
      )
      VALUES (?, ?, 'waiting_payment')
    `)
    .bind(
      userId,
      rialAmount
    )
    .run();

  return {
    id: result?.meta?.last_row_id ?? null,
    amountInput,
    tomanAmount,
    rialAmount,
  };
}

export async function attachBlupalInvoice(
  db,
  purchaseId,
  invoice
) {
  await db
    .prepare(`
      UPDATE course_purchases
      SET
        blupal_invoice_id = ?,
        blupal_final_amount = ?,
        blupal_payment_link = ?,
        payment_mode = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)
    .bind(
      invoice.invoice_id,
      invoice.final_amount,
      invoice.payment_link,
      invoice.mode,
      purchaseId
    )
    .run();
}

export async function cancelWaitingPurchase(db, purchaseId) {
  await db
    .prepare(`
      UPDATE course_purchases
      SET
        status = 'canceled',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      AND status = 'waiting_payment'
    `)
    .bind(purchaseId)
    .run();
}

export async function approveBlupalPurchase(
  db,
  invoiceId,
  transactionId,
  finalAmount,
  mode
) {
  const purchase = await db
    .prepare(`
      SELECT
        cp.*,
        u.telegram_id
      FROM course_purchases cp
      INNER JOIN users u
        ON u.id = cp.user_id
      WHERE cp.blupal_invoice_id = ?
      LIMIT 1
    `)
    .bind(invoiceId)
    .first();

  if (!purchase) {
    return null;
  }

  if (purchase.status === 'approved') {
    return purchase;
  }

  await db
    .prepare(`
      UPDATE course_purchases
      SET
        status = 'approved',
        blupal_final_amount = ?,
        transaction_id = ?,
        payment_mode = ?,
        paid_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      AND status != 'approved'
    `)
    .bind(
      finalAmount,
      transactionId ?? null,
      mode ?? null,
      purchase.id
    )
    .run();

  const approved = await db
    .prepare(`
      SELECT
        cp.*,
        u.telegram_id
      FROM course_purchases cp
      INNER JOIN users u
        ON u.id = cp.user_id
      WHERE cp.id = ?
      LIMIT 1
    `)
    .bind(purchase.id)
    .first();

  return approved;
}

export async function findPurchaseByInvoiceId(db, invoiceId) {
  return await db
    .prepare(`
      SELECT
        cp.*,
        u.telegram_id
      FROM course_purchases cp
      INNER JOIN users u
        ON u.id = cp.user_id
      WHERE cp.blupal_invoice_id = ?
      LIMIT 1
    `)
    .bind(invoiceId)
    .first();
}
