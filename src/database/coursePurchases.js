/**
 * Course Purchases Database
 *
 * مسیر:
 * src/database/coursePurchases.js
 *
 * تمام ارتباطات دیتابیس مربوط به خرید دوره
 * فقط در این فایل انجام می‌شود.
 */

export async function getUserByTelegramId(db, telegramId) {
  return await db
    .prepare(`
      SELECT id
      FROM users
      WHERE telegram_id = ?
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
      AND status IN ('waiting_receipt', 'pending_review', 'approved')
      ORDER BY id DESC
      LIMIT 1
    `)
    .bind(userId)
    .first();
}

export async function createPurchase(db, userId) {
  const result = await db
    .prepare(`
      INSERT INTO course_purchases (
        user_id,
        amount,
        status
      )
      VALUES (?, 200000, 'waiting_receipt')
    `)
    .bind(userId)
    .run();

  return result;
}
