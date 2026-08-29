/**
 * Telegram update router.
 *
 * مسئول این فایل فقط تشخیص نوع Update و تحویل آن به handler مناسب است.
 */

import handleCommand from '../handlers/commandHandler.js';
import handleMessage from '../handlers/subscriptionMessageHandler.js';
import { handleAdminApplicationCallback } from '../handlers/adminApplicationReviewHandler.js';
import { handleCourseJoinRequest } from '../handlers/courseAccessHandler.js';

export async function routeTelegramUpdate(update, env, db) {
  if (!update || typeof update !== 'object') {
    return;
  }

  if (update.chat_join_request) {
    try {
      await handleCourseJoinRequest(update.chat_join_request, env, db);
    } catch (error) {
      console.error('Chat join request error:', error.message, error.stack);
    }
    return;
  }

  if (update.callback_query) {
    await handleAdminApplicationCallback(update.callback_query, env, db);
    return;
  }

  if (update.message) {
    const message = update.message;

    if (!message.chat || !message.from) {
      return;
    }

    const text = message.text || '';
    console.log(`Message from ${message.chat.id}:`, text || '[non-text message]');

    if (text.startsWith('/')) {
      await handleCommand(message, env, db);
    } else {
      await handleMessage(message, env, db);
    }
    return;
  }

  if (update.edited_message) {
    return;
  }

  console.log('Unsupported update:', Object.keys(update));
}

export default routeTelegramUpdate;
