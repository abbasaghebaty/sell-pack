/**
 * Admin Applications Database
 *
 * مسیر:
 * src/database/adminApplications.js
 *
 * جدول:
 * admin_applications
 */

export const APPLICATION_STATUS =
  Object.freeze({
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
  });


export async function createAdminApplication(
  db,
  application
) {
  if (!db) {
    throw new Error(
      'D1 database is not available'
    );
  }

  const result = await db
    .prepare(`
      INSERT INTO admin_applications (
        telegram_id,
        username,
        first_name,
        last_name,
        phone,
        status
      )
      VALUES (?, ?, ?, ?, ?, 'pending')
    `)
    .bind(
      application.telegram_id,
      application.username ?? null,
      application.first_name ?? null,
      application.last_name ?? null,
      application.phone ?? null
    )
    .run();

  return result;
}


export async function getAdminApplicationById(
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
        phone,
        status,
        created_at,
        updated_at,
        reviewed_at,
        reviewed_by
      FROM admin_applications
      WHERE id = ?
      LIMIT 1
    `)
    .bind(id)
    .first();
}


export async function getPendingAdminApplications(
  db
) {
  if (!db) {
    throw new Error(
      'D1 database is not available'
    );
  }

  const result = await db
    .prepare(`
      SELECT
        id,
        telegram_id,
        username,
        first_name,
        last_name,
        phone,
        status,
        created_at,
        updated_at,
        reviewed_at,
        reviewed_by
      FROM admin_applications
      WHERE status = 'pending'
      ORDER BY created_at ASC
    `)
    .all();

  return result.results ?? [];
}


export async function getLatestPendingApplicationByTelegramId(
  db,
  telegramId
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
        phone,
        status,
        created_at,
        updated_at,
        reviewed_at,
        reviewed_by
      FROM admin_applications
      WHERE telegram_id = ?
        AND status = 'pending'
      ORDER BY created_at DESC
      LIMIT 1
    `)
    .bind(telegramId)
    .first();
}


export async function updateAdminApplicationStatus(
  db,
  applicationId,
  status,
  reviewedBy
) {
  if (!db) {
    throw new Error(
      'D1 database is not available'
    );
  }

  if (
    ![
      'approved',
      'rejected',
    ].includes(status)
  ) {
    throw new Error(
      'Invalid application status'
    );
  }

  return await db
    .prepare(`
      UPDATE admin_applications
      SET
        status = ?,
        reviewed_at = CURRENT_TIMESTAMP,
        reviewed_by = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)
    .bind(
      status,
      reviewedBy ?? null,
      applicationId
    )
    .run();
}


export async function deleteAdminApplication(
  db,
  applicationId
) {
  if (!db) {
    throw new Error(
      'D1 database is not available'
    );
  }

  return await db
    .prepare(`
      DELETE FROM admin_applications
      WHERE id = ?
    `)
    .bind(applicationId)
    .run();
}


export async function deleteResolvedApplications(
  db
) {
  if (!db) {
    throw new Error(
      'D1 database is not available'
    );
  }

  return await db
    .prepare(`
      DELETE FROM admin_applications
      WHERE status IN (
        'approved',
        'rejected'
      )
    `)
    .run();
}
