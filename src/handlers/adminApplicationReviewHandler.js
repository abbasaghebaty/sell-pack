/**
 * Admin Application Review Handler
 *
 * مسیر:
 * src/handlers/adminApplicationReviewHandler.js
 */

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
  USER_STATES,
  setUserState,
  clearUserState,
} from '../database/userStates.js';

import {
  getAdminApplicationById,
  updateAdminApplicationStatus,
} from '../database/adminApplications.js';

import {
  createAdmin,
} from '../database/adminVerifications.js';


function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


/*
 * دکمه‌های کانال
 */
function getReviewKeyboard(
  applicationId
) {
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


/*
 * ارسال درخواست به کانال
 */
export async function sendApplicationToChannel(
  botToken,
  applicationId,
  application
) {
  const username =
    application.username
      ? `@${escapeHtml(application.username)}`
      : 'ندارد';

  const text =
    `🔔 <b>New Admin Application</b>\n\n` +

    `🆔 <b>Application:</b> ` +
    `<code>#${applicationId}</code>\n\n` +

    `👤 <b>Name:</b> ` +
    `${escapeHtml(application.first_name)} ` +
    `${escapeHtml(application.last_name)}\n` +

    `📱 <b>Phone:</b> ` +
    `${escapeHtml(application.phone)}\n` +

    `🔗 <b>Username:</b> ` +
    `${username}\n` +

    `🆔 <b>Telegram ID:</b> ` +
    `<code>${application.telegram_id}</code>\n\n` +

    `📌 <b>Status:</b> Pending`;

  return await sendMessage(
    botToken,
    ADMIN_APPLICATION_CHANNEL_ID,
    text,
    getReviewKeyboard(applicationId)
  );
}


/*
 * Callback Query
 */
export async function handleAdminApplicationCallback(
  callbackQuery,
  env,
  db
) {
  const botToken =
    env.TELEGRAM_BOT_TOKEN;

  const adminId =
    Number(callbackQuery.from?.id);

  const data =
    callbackQuery.data || '';

  /*
   * فقط مدیر اصلی
   */
  if (
    !BOT_ADMINS.includes(adminId)
  ) {
    await answerCallbackQuery(
      botToken,
      callbackQuery.id,
      'Access denied',
      true
    );

    return;
  }


  const [action, idText] =
    data.split(':');

  const applicationId =
    Number(idText);

  if (
    !Number.isInteger(applicationId)
  ) {
    await answerCallbackQuery(
      botToken,
      callbackQuery.id,
      'Invalid application',
      true
    );

    return;
  }


  const application =
    await getAdminApplicationById(
      db,
      applicationId
    );

  if (!application) {
    await answerCallbackQuery(
      botToken,
      callbackQuery.id,
      'Application not found',
      true
    );

    return;
  }


  /*
   * قبلاً تعیین تکلیف شده
   */
  if (
    application.status !== 'pending'
  ) {
    await answerCallbackQuery(
      botToken,
      callbackQuery.id,
      `Already ${application.status}`,
      true
    );

    return;
  }


  /*
   * ACCEPT
   */
  if (
    action === 'admin_accept'
  ) {
    try {
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
        }
      );

      await updateAdminApplicationStatus(
        db,
        applicationId,
        'approved',
        adminId
      );

    } catch (error) {
      console.error(
        '❌ Accept application error:',
        error.message,
        error.stack
      );

      await answerCallbackQuery(
        botToken,
        callbackQuery.id,
        'Failed to accept',
        true
      );

      return;
    }


    /*
     * پیام به کاربر
     */
    try {
      await sendMessage(
        botToken,
        application.telegram_id,

        `✅ <b>درخواست ادمینی شما تأیید شد.</b>\n\n` +
        `درخواست شما توسط تیم EndMark تأیید شد و حساب ادمینی شما فعال شد.`
      );
    } catch (error) {
      console.error(
        '❌ Failed to notify approved user:',
        error.message
      );
    }


    /*
     * تغییر پیام کانال
     */
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
        `<code>${adminId}</code>`,

        {
          inline_keyboard: [],
        }
      );

    } catch (error) {
      console.error(
        '❌ Failed to edit channel message:',
        error.message
      );
    }


    await answerCallbackQuery(
      botToken,
      callbackQuery.id,
      'Application accepted'
    );

    return;
  }


  /*
   * REJECT
   */
  if (
    action === 'admin_reject'
  ) {
    const channelMessage =
      callbackQuery.message;

    try {
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
        }
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
        }
      );

    } catch (error) {
      console.error(
        '❌ Failed to start rejection:',
        error.message,
        error.stack
      );

      await clearUserState(
        db,
        adminId
      );

      await answerCallbackQuery(
        botToken,
        callbackQuery.id,
        'Could not open rejection form',
        true
      );

      return;
    }


    await answerCallbackQuery(
      botToken,
      callbackQuery.id,
      'Send the rejection reason'
    );

    return;
  }


  await answerCallbackQuery(
    botToken,
    callbackQuery.id
  );
}


/*
 * دریافت دلیل رد
 */
export async function handleAdminRejectionReason(
  message,
  env,
  db,
  state
) {
  const botToken =
    env.TELEGRAM_BOT_TOKEN;

  const adminId =
    Number(message.from.id);

  const reason =
    message.text?.trim();

  const data =
    state?.data || {};


  if (
    !reason
  ) {
    return await sendMessage(
      botToken,
      adminId,
      '❌ لطفاً دلیل رد درخواست را بنویس.'
    );
  }


  const applicationId =
    Number(data.application_id);

  const application =
    await getAdminApplicationById(
      db,
      applicationId
    );

  if (!application) {
    await clearUserState(
      db,
      adminId
    );

    return await sendMessage(
      botToken,
      adminId,
      '❌ درخواست پیدا نشد.'
    );
  }


  if (
    application.status !== 'pending'
  ) {
    await clearUserState(
      db,
      adminId
    );

    return await sendMessage(
      botToken,
      adminId,
      '⚠️ این درخواست قبلاً تعیین تکلیف شده است.'
    );
  }


  /*
   * ثبت Reject
   */
  await updateAdminApplicationStatus(
    db,
    applicationId,
    'rejected',
    adminId
  );


  /*
   * ارسال دلیل برای کاربر
   */
  try {
    await sendMessage(
      botToken,
      application.telegram_id,

      `❌ <b>درخواست ادمینی شما رد شد.</b>\n\n` +

      `📝 <b>دلیل رد:</b>\n` +
      `${escapeHtml(reason)}`
    );

  } catch (error) {
    console.error(
      '❌ Failed to notify rejected user:',
      error.message
    );
  }


  /*
   * آپدیت پیام کانال
   */
  if (
    data.channel_chat_id &&
    data.channel_message_id
  ) {
    try {
      await editMessageText(
        botToken,
        data.channel_chat_id,
        data.channel_message_id,

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
        }
      );

    } catch (error) {
      console.error(
        '❌ Failed to update channel message:',
        error.message
      );
    }
  }


  await clearUserState(
    db,
    adminId
  );


  return await sendMessage(
    botToken,
    adminId,
    `✅ درخواست #${applicationId} رد شد.`
  );
}
