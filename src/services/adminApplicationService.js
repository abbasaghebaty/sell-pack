import {
  createAdminApplication,
  getLatestPendingApplicationByTelegramId,
  deletePendingApplicationsByTelegramId,
} from '../database/adminApplications.js';

import {
  setUserState,
  clearUserState,
  USER_STATES,
} from '../database/userStates.js';

import {
  sendApplicationToChannel,
} from './adminApplicationReviewService.js';

export function buildAdminApplication(
  message,
  currentData = {},
) {
  const telegramUser = message.from;

  return {
    telegram_id: telegramUser.id,

    username:
      telegramUser.username ??
      null,

    first_name:
      currentData.first_name ??
      telegramUser.first_name ??
      null,

    last_name:
      currentData.last_name ??
      telegramUser.last_name ??
      null,

    phone:
      message.contact?.phone_number ??
      message.text?.trim() ??
      null,
  };
}

export async function startAdminApplicationFlow(
  db,
  telegramUserId,
) {
  await setUserState(
    db,
    telegramUserId,
    USER_STATES.WAITING_FOR_ADMIN_APPLICATION_FIRST_NAME,
    {},
  );
}

export async function saveAdminApplicationFlow(
  db,
  application,
  botToken,
) {
  let oldPending = null;

  try {
    oldPending =
      await getLatestPendingApplicationByTelegramId(
        db,
        application.telegram_id,
      );
  } catch (error) {
    console.error(
      'Failed to check pending application:',
      error.message,
    );
  }

  if (oldPending) {
    try {
      await deletePendingApplicationsByTelegramId(
        db,
        application.telegram_id,
      );
    } catch (error) {
      throw new Error(
        `Previous application could not be replaced: ${error.message}`,
      );
    }
  }

  const result =
    await createAdminApplication(
      db,
      application,
    );

  const applicationId =
    result?.meta?.last_row_id ??
    null;

  try {
    await sendApplicationToChannel(
      botToken,
      applicationId,
      application,
    );
  } catch (error) {
    console.error(
      'Failed to send application to channel:',
      error.message,
      error.stack,
    );
  }

  await clearUserState(
    db,
    application.telegram_id,
  );

  return {
    applicationId,
    oldPending,
  };
}
