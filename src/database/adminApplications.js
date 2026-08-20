/**
 * Admin Applications Database
 *
 * مسیر:
 * src/database/adminApplications.js
 *
 * مسئول:
 * - ثبت درخواست ادمین
 * - دریافت درخواست
 * - تغییر وضعیت درخواست
 * - ثبت بررسی‌کننده
 */

export async function createAdminApplication(
  db,
  {
    userId,
    firstName,
    lastName,
    phoneNumber,
    adminUsername,
  }
) {
  if (!db) {
    throw new Error('Database is not available');
  }

  const result = await db
    .prepare(`
      INSERT INTO admin_applications (
        user_id,
        first_name,
        last_name,
        phone_number,
        admin_username
      )
      VALUES (?, ?, ?, ?, ?)
    `)
    .bind(
      userId,
      firstName,
      lastName,
      phoneNumber,
      adminUsername
    )
    .run();

  return result;
}


/**
 * دریافت یک درخواست با ID
 */
export async function getAdminApplicationById(
  db,
  applicationId
) {
  if (!db || !applicationId) {
    return null;
  }

  return await db
    .prepare(`
      SELECT
        id,
        user_id,
        first_name,
        last_name,
        phone_number,
        admin_username,
        status,
        reviewed_by,
        reviewed_at,
        created_at
      FROM admin_applications
      WHERE id = ?
      LIMIT 1
    `)
    .bind(applicationId)
    .first();
}


/**
 * دریافت درخواست در انتظار بررسی یک کاربر
 */
export async function getPendingAdminApplicationByUserId(
  db,
  userId
) {
  if (!db || !userId) {
    return null;
  }

  return await db
    .prepare(`
      SELECT
        id,
        user_id,
        first_name,
        last_name,
        phone_number,
        admin_username,
        status,
        reviewed_by,
        reviewed_at,
        created_at
      FROM admin_applications
      WHERE user_id = ?
        AND status = 'pending'
      ORDER BY id DESC
      LIMIT 1
    `)
    .bind(userId)
    .first();
}


/**
 * تغییر وضعیت درخواست
 */
export async function updateAdminApplicationStatus(
  db,
  applicationId,
  status,
  reviewedBy
) {
  if (!db || !applicationId || !status || !reviewedBy) {
    throw new Error('Invalid application status data');
  }

  return await db
    .prepare(`
      UPDATE admin_applications
      SET
        status = ?,
        reviewed_by = ?,
        reviewed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)
    .bind(
      status,
      reviewedBy,
      applicationId
    )
    .run();
}
