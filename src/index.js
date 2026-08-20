/**
 * Telegram Bot - Main Worker
 *
 * مسیر:
 * src/index.js
 *
 * نقطه ورود Cloudflare Worker
 */

import handleCommand from './handlers/commandHandler.js';
import handleMessage from './handlers/messageHandler.js';

async function processUpdate(update, env, db) {
  try {
    /*
     * پیام معمولی
     */
    const message = update.message;

    if (message?.chat) {
      if (!message.from) {
        console.log('⚠️ No sender information in message');
        return;
      }

      const text = message.text || '';

      console.log(
        `📨 Processing message from ${message.chat.id}:`,
        text || '[non-text message]'
      );

      if (text.startsWith('/')) {
        console.log(`🎯 Command detected: ${text}`);
        await handleCommand(message, env, db);
      } else {
        console.log('💬 Regular message detected');
        await handleMessage(message, env, db);
      }

      return;
    }

    /*
     * پیام فورواردی هم داخل update.message می‌آید.
     * بنابراین همان handleMessage آن را پردازش می‌کند.
     */

    /*
     * اگر بعداً Callback Query اضافه شد،
     * اینجا می‌توانیم جداگانه مدیریت کنیم.
     */

    console.log('⚠️ Unsupported update type');

  } catch (error) {
    console.error(
      '❌ Error in processUpdate:',
      error.message,
      error.stack
    );
  }
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
          console.warn(
            '❌ Invalid HTTP method for webhook:',
            request.method
          );

          return new Response(
            'Method Not Allowed',
            { status: 405 }
          );
        }

        try {
          /*
           * بررسی Token
           */
          if (!env.TELEGRAM_BOT_TOKEN) {
            console.error(
              '❌ TELEGRAM_BOT_TOKEN not set!'
            );

            return new Response(
              'OK',
              { status: 200 }
            );
          }

          /*
           * دریافت Update
           */
          let update;

          try {
            update = await request.json();
          } catch (parseError) {
            console.error(
              '❌ Failed to parse request JSON:',
              parseError.message
            );

            return new Response(
              'OK',
              { status: 200 }
            );
          }

          console.log(
            '✅ Update received:',
            JSON.stringify(update, null, 2)
          );

          /*
           * اتصال به D1
           */
          const db = env.DB;

          if (!db) {
            console.warn(
              '⚠️ Database not available'
            );
          }

          /*
           * پردازش Update
           */
          await processUpdate(
            update,
            env,
            db
          );

          /*
           * همیشه 200
           */
          return new Response(
            'OK',
            { status: 200 }
          );

        } catch (error) {
          console.error(
            '❌ Webhook processing error:',
            error.message,
            error.stack
          );

          return new Response(
            'OK',
            { status: 200 }
          );
        }
      }

      /*
       * Root
       */
      if (url.pathname === '/') {
        return Response.json({
          success: true,
          service: 'telegram-bot-adminx',
          status: 'online',
          bot_token_set:
            !!env.TELEGRAM_BOT_TOKEN,
          timestamp:
            new Date().toISOString(),
        });
      }

      /*
       * Health Check
       */
      if (url.pathname === '/health') {
        return Response.json({
          ok: true,
          message: 'Worker is running',
        });
      }

      /*
       * Route not found
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
        '❌ FATAL ERROR in fetch:',
        error.message,
        error.stack
      );

      return new Response(
        JSON.stringify({
          error: 'Internal server error',
          message: error.message,
        }),
        {
          status: 500,
          headers: {
            'Content-Type':
              'application/json',
          },
        }
      );
    }
  },
};
