/**
 * Admin Verification Database
 *
 * مسیر:
 * src/database/adminVerifications.js
 *
 * مسئول:
 * - ثبت درخواست ایجاد کد
 * - تأیید / رد درخواست
 * - استعلام Username
 * - استعلام Telegram ID از پیام Forward
 */

/**
 * نرمال‌سازی Username
 *
 * @Amozesh_adminx
 * Amozesh_adminx
 *
 * هر دو تبدیل می‌شوند به:
 *
 * amozesh_adminx
 */
export function normalizeUsername(username) {
  if (!username) {
    return null;
  }

  return username
    .trim()
    .replace(/^@+/, '')
    .toLowerCase();
}

/**
 * پیدا کردن کاربر داخلی از Telegram ID
 */
export async function getUserByTelegramId(db, telegramId) {
  if (!telegramId) {
    throw new Error('Telegram ID is required');
  }

  return await db
    .prepare(`
      SELECT
        id,
        telegram_id,
        username,
        first_name,
        last_name
      FROM users
      WHERE telegram_id = ?
      LIMIT 1
    `)
    .bind(telegramId)
    .first();
}

/**
 * ایجاد درخواست جدید برای تأیید ادمین
 */
export async function createAdminVerification(
  db,
  userId,
  adminUsername
) {
  const normalizedUsername = normalizeUsername(adminUsername);

  if (!normalizedUsername) {
    throw new Error('Admin username is required');
  }

  return await db
    .prepare(`
      INSERT INTO admin_verifications (
        user_id,
        admin_username,
        status
      )
      VALUES (?, ?, 'pending')
    `)
    .bind(
      userId,
      normalizedUsername
    )
    .run();
}

/**
 * آخرین درخواست کاربر
 */
export async function getUserAdminVerification(db, userId) {
  return await db
    .prepare(`
      SELECT *
      FROM admin_verifications
      WHERE user_id = ?
      ORDER BY id DESC
      LIMIT 1
    `)
    .bind(userId)
    .first();
}

/**
 * پیدا کردن درخواست بر اساس ID
 */
export async function getAdminVerificationById(
  db,
  verificationId
) {
  return await db
    .prepare(`
      SELECT
        av.*,
        u.telegram_id,
        u.username,
        u.first_name,
        u.last_name
      FROM admin_verifications av
      INNER JOIN users u
        ON u.id = av.user_id
      WHERE av.id = ?
      LIMIT 1
    `)
    .bind(verificationId)
    .first();
}

/**
 * تأیید درخواست
 */
export async function approveAdminVerification(
  db,
  verificationId,
  reviewerUserId
) {
  return await db
    .prepare(`
      UPDATE admin_verifications
      SET
        status = 'approved',
        reviewed_by = ?,
        reviewed_at = CURRENT_TIMESTAMP
      WHERE id = ?
      AND status = 'pending'
    `)
    .bind(
      reviewerUserId,
      verificationId
    )
    .run();
}

/**
 * رد درخواست
 */
export async function rejectAdminVerification(
  db,
  verificationId,
  reviewerUserId
) {
  return await db
    .prepare(`
      UPDATE admin_verifications
      SET
        status = 'rejected',
        reviewed_by = ?,
        reviewed_at = CURRENT_TIMESTAMP
      WHERE id = ?
      AND status = 'pending'
    `)
    .bind(
      reviewerUserId,
      verificationId
    )
    .run();
}

/**
 * استعلام با Username
 */
export async function checkAdminValidity(
  db,
  adminUsername
) {
  const normalizedUsername = normalizeUsername(adminUsername);

  if (!normalizedUsername) {
    return null;
  }

  return await db
    .prepare(`
      SELECT
        av.id,
        av.admin_username,
        av.status,
        u.telegram_id,
        u.username,
        u.first_name,
        u.last_name
      FROM admin_verifications av
      INNER JOIN users u
        ON u.id = av.user_id
      WHERE av.admin_username = ?
      AND av.status = 'approved'
      ORDER BY av.id DESC
      LIMIT 1
    `)
    .bind(normalizedUsername)
    .first();
}

/**
 * استعلام با Telegram ID
 *
 * این قسمت برای پیام‌های Forward شده استفاده می‌شود.
 */
export async function checkAdminValidityByTelegramId(
  db,
  telegramId
) {
  if (!telegramId) {
    return null;
  }

  return await db
    .prepare(`
      SELECT
        av.id,
        av.admin_username,
        av.status,
        u.telegram_id,
        u.username,
        u.first_name,
        u.last_name
      FROM admin_verifications av
      INNER JOIN users u
        ON u.id = av.user_id
      WHERE u.telegram_id = ?
      AND av.status = 'approved'
      ORDER BY av.id DESC
      LIMIT 1
    `)
    .bind(telegramId)
    .first();
}
