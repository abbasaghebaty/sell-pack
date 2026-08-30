import {
  sendMessage,
  answerCallbackQuery,
  editMessageText,
} from '../api/telegram.js';

import {
  BOT_ADMINS,
  ADMIN_APPLICATION_CHANNEL_ID,
} from '../config/admins.js';

import {
  getAdminApplicationById,
  updateAdminApplicationStatus,
} from '../database/adminApplications.js';

import {
  createAdmin,
} from '../database/adminVerifications.js';

import {
  setUserState,
  clearUserState,
  USER_STATES,
} from '../database/userStates.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getReviewKeyboard(applicationId) {
  return {
    inline_keyboard: [
      [
        {
          text: 'Accept',
          callback_data:
            `admin_accept:${applicationId}`,
          style: 'success',
        },
        {
          text: 'Reject',
          callback_data:
            `admin_reject:${applicationId}`,
          style: 'danger',
        },
      ],
    ],
  };
}

export async function sendApplicationToChannel(
  botToken,
  applicationId,
  application,
) {
  const username =
    application.username
      ? `@${escapeHtml(application.username)}`
      : 'ندارد';

  const text =
    `🔔 <b>New Admin Application</b>\n\n` +
    `🆔 <b>Application:</b> <code>#${applicationId}</code>\n\n` +
    `👤 <b>Name:</b> ` +
    `${escapeHtml(application.first_name)} ` +
    `${escapeHtml(application.last_name)}\n` +
    `📱 <b>Phone:</b> ${escapeHtml(application.phone)}\n` +
    `🔗 <b>Username:</b> ${username}\n` +
    `🆔 <b>Telegram ID:</b> ` +
    `<code>${application.telegram_id}</code>\n\n` +
    `📌 <b>Status:</b> Pending`;

  return sendMessage(
    botToken,
    ADMIN_APPLICATION_CHANNEL_ID,
    text,
    getReviewKeyboard(applicationId),
  );
}

export async function approveApplication(
  db,
  botToken,
  applicationId,
  reviewerId,
  callbackQuery,
) {
  const application =
    await getAdminApplicationById(
      db,
      applicationId,
    );

  if (!application) {
    throw new Error(
      'Application not found.',
    );
  }

  if (application.status !== 'pending') {
    throw new Error(
      `Already ${application.status}`,
    );
  }

  await createAdmin(
    db,
    {
      telegram_id:
        application.telegram_id,

      username:
        application.username,

      first_name:
        application.first_name,

      last_name:
        application.last_name,
    },
  );

  await updateAdminApplicationStatus(
    db,
    applicationId,
    'approved',
    reviewerId,
  );

  try {
    await sendMessage(
      botToken,
      application.telegram_id,
      `✅ <b>درخواست ادمینی شما تأیید شد.</b>\n\n` +
        `درخواست شما توسط تیم EndMark تأیید شد و حساب ادمینی شما فعال شد.`,
    );
  } catch (error) {
    console.error(
      'Failed to notify approved user:',
      error.message,
    );
  }

  const channelMessage =
    callbackQuery.message;

  try {
    await editMessageText(
      botToken,
      channelMessage.chat.id,
      channelMessage.message_id,
      `✅ <b>Admin Application Approved</b>\n\n` +
        `🆔 Application: ` +
        `<code>#${application.id}</code>\n` +
        `👤 ${escapeHtml(application.first_name)} ` +
        `${escapeHtml(application.last_name)}\n` +
        `🔗 @${escapeHtml(application.username || 'none')}\n\n` +
        `📌 <b>Status:</b> Approved\n` +
        `👮 <b>Reviewed by:</b> ` +
        `<code>${reviewerId}</code>`,
      {
        inline_keyboard: [],
      },
    );
  } catch (error) {
    console.error(
      'Failed to edit channel message:',
      error.message,
    );
  }
}

export async function beginRejection(
  db,
  botToken,
  applicationId,
  adminId,
  callbackQuery,
) {
  const channelMessage =
    callbackQuery.message;

  await setUserState(
    db,
    adminId,
    USER_STATES.WAITING_FOR_ADMIN_REJECTION_REASON,
    {
      application_id:
        applicationId,

      channel_chat_id:
        channelMessage.chat.id,

      channel_message_id:
        channelMessage.message_id,
    },
  );

  await sendMessage(
    botToken,
    adminId,

    `❌ <b>Reject application #${applicationId}</b>\n\n` +
      `دلیل رد درخواست را در پیام بعدی ارسال کن.`,

    {
      force_reply: true,
      input_field_placeholder:
        'Write rejection reason',
    },
  );
}

export async function rejectApplication(
  db,
  botToken,
  applicationId,
  adminId,
  reason,
  state,
) {
  const application =
    await getAdminApplicationById(
      db,
      applicationId,
    );

  if (!application) {
    throw new Error(
      'Application not found.',
    );
  }

  if (application.status !== 'pending') {
    throw new Error(
      'This application has already been reviewed.',
    );
  }

  await updateAdminApplicationStatus(
    db,
    applicationId,
    'rejected',
    adminId,
  );

  try {
    await sendMessage(
      botToken,
      application.telegram_id,

      `❌ <b>درخواست ادمینی شما رد شد.</b>\n\n` +
        `📝 <b>دلیل رد:</b>\n` +
        escapeHtml(reason),
    );
  } catch (error) {
    console.error(
      'Failed to notify rejected user:',
      error.message,
    );
  }

  if (
    state?.data?.channel_chat_id &&
    state?.data?.channel_message_id
  ) {
    try {
      await editMessageText(
        botToken,
        state.data.channel_chat_id,
        state.data.channel_message_id,

        `❌ <b>Admin Application Rejected</b>\n\n` +
          `🆔 Application: ` +
          `<code>#${application.id}</code>\n` +
          `👤 ${escapeHtml(application.first_name)} ` +
          `${escapeHtml(application.last_name)}\n` +
          `🔗 @${escapeHtml(application.username || 'none')}\n\n` +
          `📌 <b>Status:</b> Rejected\n\n` +
          `📝 <b>Reason:</b>\n` +
          `${escapeHtml(reason)}\n\n` +
          `👮 <b>Reviewed by:</b> ` +
          `<code>${adminId}</code>`,

        {
          inline_keyboard: [],
        },
      );
    } catch (error) {
      console.error(
        'Failed to update channel message:',
        error.message,
      );
    }
  }

  await clearUserState(
    db,
    adminId,
  );
}

export function isBotAdmin(
  telegramId,
) {
  return BOT_ADMINS.includes(
    Number(telegramId),
  );
}

export async function handleAdminApplicationCallbackService(
  callbackQuery,
  env,
  db,
) {
  const botToken =
    env.TELEGRAM_BOT_TOKEN;

  const adminId =
    Number(
      callbackQuery.from?.id,
    );

  if (!isBotAdmin(adminId)) {
    await answerCallbackQuery(
      botToken,
      callbackQuery.id,
      'Access denied',
      true,
    );

    return;
  }

  const [action, idText] =
    (callbackQuery.data || '')
      .split(':');

  const applicationId =
    Number(idText);

  if (
    !Number.isInteger(
      applicationId,
    )
  ) {
    await answerCallbackQuery(
      botToken,
      callbackQuery.id,
      'Invalid application',
      true,
    );

    return;
  }

  const application =
    await getAdminApplicationById(
      db,
      applicationId,
    );

  if (!application) {
    await answerCallbackQuery(
      botToken,
      callbackQuery.id,
      'Application not found',
      true,
    );

    return;
  }

  if (
    application.status !==
    'pending'
  ) {
    await answerCallbackQuery(
      botToken,
      callbackQuery.id,
      `Already ${application.status}`,
      true,
    );

    return;
  }

  if (
    action === 'admin_accept'
  ) {
    try {
      await approveApplication(
        db,
        botToken,
        applicationId,
        adminId,
        callbackQuery,
      );

      await answerCallbackQuery(
        botToken,
        callbackQuery.id,
        'Application accepted',
      );
    } catch (error) {
      console.error(
        'Accept application error:',
        error.message,
        error.stack,
      );

      await answerCallbackQuery(
        botToken,
        callbackQuery.id,
        'Failed to accept',
        true,
      );
    }

    return;
  }

  if (
    action === 'admin_reject'
  ) {
    try {
      await beginRejection(
        db,
        botToken,
        applicationId,
        adminId,
        callbackQuery,
      );

      await answerCallbackQuery(
        botToken,
        callbackQuery.id,
        'Send the rejection reason',
      );
    } catch (error) {
      console.error(
        'Failed to start rejection:',
        error.message,
        error.stack,
      );

      await clearUserState(
        db,
        adminId,
      );

      await answerCallbackQuery(
        botToken,
        callbackQuery.id,
        'Could not open rejection form',
        true,
      );
    }

    return;
  }

  await answerCallbackQuery(
    botToken,
    callbackQuery.id,
  );
}
