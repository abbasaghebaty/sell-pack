/**
 * Admin Verification Database
 *
 * مسیر:
 * src/database/adminVerifications.js
 *
 * جدول:
 * admins
 */


export function normalizeUsername(username) {
  if (!username) {
    return null;
  }

  return String(username)
    .trim()
    .replace(/^@+/, '')
    .toLowerCase();
}


export async function checkAdminValidity(
  db,
  username
) {
  if (!db) {
    throw new Error(
      'D1 database is not available'
    );
  }

  const normalizedUsername =
    normalizeUsername(username);

  if (!normalizedUsername) {
    return null;
  }

  return await db
    .prepare(`
      SELECT
        id,
        telegram_id,
        username,
        first_name,
        last_name,
        status,
        created_at,
        updated_at
      FROM admins
      WHERE LOWER(username) = ?
        AND status = 'active'
      LIMIT 1
    `)
    .bind(normalizedUsername)
    .first();
}


export async function checkAdminValidityByTelegramId(
  db,
  telegramId
) {
  if (!db) {
    throw new Error(
      'D1 database is not available'
    );
  }

  if (
    telegramId === undefined ||
    telegramId === null
  ) {
    return null;
  }

  return await db
    .prepare(`
      SELECT
        id,
        telegram_id,
        username,
        first_name,
        last_name,
        status,
        created_at,
        updated_at
      FROM admins
      WHERE telegram_id = ?
        AND status = 'active'
      LIMIT 1
    `)
    .bind(telegramId)
    .first();
}


export async function getAdminById(
  db,
  id
) {
  if (!db) {
    throw new Error(
      'D1 database is not available'
    );
  }

  return await db
    .prepare(`
      SELECT
        id,
        telegram_id,
        username,
        first_name,
        last_name,
        status,
        created_at,
        updated_at
      FROM admins
      WHERE id = ?
      LIMIT 1
    `)
    .bind(id)
    .first();
}


export async function createAdmin(
  db,
  admin
) {
  if (!db) {
    throw new Error(
      'D1 database is not available'
    );
  }

  return await db
    .prepare(`
      INSERT INTO admins (
        telegram_id,
        username,
        first_name,
        last_name,
        status
      )
      VALUES (?, ?, ?, ?, 'active')

      ON CONFLICT(telegram_id)
      DO UPDATE SET
        username = excluded.username,
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        status = 'active',
        updated_at = CURRENT_TIMESTAMP
    `)
    .bind(
      admin.telegram_id,
      normalizeUsername(admin.username),
      admin.first_name ?? null,
      admin.last_name ?? null
    )
    .run();
}


export async function updateAdminStatus(
  db,
  telegramId,
  status
) {
  if (!db) {
    throw new Error(
      'D1 database is not available'
    );
  }

  if (
    !['active', 'suspended'].includes(status)
  ) {
    throw new Error(
      'Invalid admin status'
    );
  }

  return await db
    .prepare(`
      UPDATE admins
      SET
        status = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE telegram_id = ?
    `)
    .bind(
      status,
      telegramId
    )
    .run();
}
