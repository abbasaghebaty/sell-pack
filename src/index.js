/**
 * EndMark Telegram Bot - Cloudflare Worker
 *
 * مسیر:
 * src/index.js
 */

import handleCommand from './handlers/commandHandler.js';
import handleMessage from './handlers/messageHandler.js';

async function processUpdate(update, env, db) {
  if (!update || typeof update !== 'object') {
    return;
  }

  /*
   * Message
   */
  if (update.message) {
    const message = update.message;

    if (!message.chat || !message.from) {
      return;
    }

    const text = message.text || '';

    console.log(
      `📨 Message from ${message.chat.id}:`,
      text || '[non-text message]'
    );

    if (text.startsWith('/')) {
      await handleCommand(message, env, db);
    } else {
      await handleMessage(message, env, db);
    }

    return;
  }

  /*
   * Edited message
   */
  if (update.edited_message) {
    console.log('ℹ️ Edited message ignored');
    return;
  }

  /*
   * Callback Query
   *
   * فعلاً ربات از Reply Keyboard استفاده می‌کند،
   * اما این مسیر را باز نگه می‌داریم تا اگر بعداً
   * Inline Keyboard اضافه شد، Update گم نشود.
   */
  if (update.callback_query) {
    console.log(
      'ℹ️ Callback query received:',
      update.callback_query.data
    );

    return;
  }

  console.log(
    'ℹ️ Unsupported update type:',
    Object.keys(update)
  );
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);

      /*
       * Webhook
       */
      if (url.pathname === '/webhook') {
        if (request.method !== 'POST') {
          return new Response(
            'Method Not Allowed',
            { status: 405 }
          );
        }

        let update;

        try {
          update = await request.json();
        } catch (error) {
          console.error(
            '❌ Invalid webhook JSON:',
            error.message
          );

          return new Response('OK', {
            status: 200,
          });
        }

        if (!env.TELEGRAM_BOT_TOKEN) {
          console.error(
            '❌ TELEGRAM_BOT_TOKEN is missing'
          );

          return new Response('OK', {
            status: 200,
          });
        }

        const db = env.DB || null;

        try {
          await processUpdate(
            update,
            env,
            db
          );
        } catch (error) {
          console.error(
            '❌ Update processing error:',
            error.message,
            error.stack
          );
        }

        /*
         * تلگرام باید همیشه 200 دریافت کند.
         */
        return new Response('OK', {
          status: 200,
        });
      }

      /*
       * Root
       */
      if (url.pathname === '/') {
        return Response.json({
          success: true,
          service: 'telegram-bot-endmark',
          status: 'online',
          database: Boolean(env.DB),
          bot_token_set:
            Boolean(env.TELEGRAM_BOT_TOKEN),
          timestamp:
            new Date().toISOString(),
        });
      }

      /*
       * Health
       */
      if (url.pathname === '/health') {
        return Response.json({
          ok: true,
          service: 'endmark-bot',
          database: Boolean(env.DB),
          timestamp:
            new Date().toISOString(),
        });
      }

      /*
       * Not found
       */
      return Response.json(
        {
          success: false,
          error: 'Route not found',
        },
        {
          status: 404,
        }
      );

    } catch (error) {
      console.error(
        '❌ FATAL WORKER ERROR:',
        error.message,
        error.stack
      );

      return Response.json(
        {
          success: false,
          error: 'Internal server error',
        },
        {
          status: 500,
        }
      );
    }
  },
};
