import {
  handleAdminApplicationCallbackService,
  rejectApplication,
  sendApplicationToChannel as sendApplicationToChannelService,
} from '../services/adminApplicationReviewService.js';

import {
  sendMessage,
} from '../api/telegram.js';

export async function sendApplicationToChannel(
  botToken,
  applicationId,
  application,
) {
  return sendApplicationToChannelService(
    botToken,
    applicationId,
    application,
  );
}

export async function handleAdminApplicationCallback(
  callbackQuery,
  env,
  db,
) {
  return handleAdminApplicationCallbackService(
    callbackQuery,
    env,
    db,
  );
}

export async function handleAdminRejectionReason(
  message,
  env,
  db,
  state,
) {
  const botToken =
    env.TELEGRAM_BOT_TOKEN;

  const adminId =
    Number(message.from.id);

  const reason =
    message.text?.trim();

  if (!reason) {
    return sendMessage(
      botToken,
      adminId,
      '❌ لطفاً دلیل رد درخواست را بنویس.',
    );
  }

  const applicationId =
    Number(
      state?.data?.application_id,
    );

  if (
    !Number.isInteger(
      applicationId,
    )
  ) {
    return sendMessage(
      botToken,
      adminId,
      '❌ شناسه درخواست نامعتبر است.',
    );
  }

  try {
    await rejectApplication(
      db,
      botToken,
      applicationId,
      adminId,
      reason,
      state,
    );

    return sendMessage(
      botToken,
      adminId,
      `✅ درخواست #${applicationId} رد شد.`,
    );
  } catch (error) {
    console.error(
      'Reject application error:',
      error.message,
      error.stack,
    );

    return sendMessage(
      botToken,
      adminId,
      `❌ رد درخواست انجام نشد.\n\n` +
        `${error.message}`,
    );
  }
}

export default handleAdminApplicationCallback;
