/**
 * Admin Verification Database
 *
 * مسیر:
 * src/database/adminVerifications.js
 *
 * جدول:
 * admins
 */

export async function checkAdminValidity(
  db,
  username
) {
  if (!db) {
    throw new Error(
      'D1 database is not available'
    );
  }

  if (!username) {
    return null;
  }

  const cleanUsername =
    String(username)
      .trim()
      .replace(/^@/, '');

  const result = await db
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
      WHERE LOWER(username) = LOWER(?)
        AND status = 'active'
      LIMIT 1
    `)
    .bind(cleanUsername)
    .first();

  return result || null;
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

  if (!telegramId) {
    return null;
  }

  const result = await db
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

  return result || null;
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

  const result = await db
    .prepare(`
      INSERT INTO admins (
        telegram_id,
        username,
        first_name,
        last_name,
        status
      )
      VALUES (?, ?, ?, ?, ?)
    `)
    .bind(
      admin.telegram_id,
      admin.username ?? null,
      admin.first_name ?? null,
      admin.last_name ?? null,
      admin.status ?? 'active'
    )
    .run();

  return result;
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
    !['active', 'suspended']
      .includes(status)
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
