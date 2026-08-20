/**
 * EndMark Telegram Bot - Cloudflare Worker
 *
 * مسیر:
 * src/index.js
 */

import handleCommand from './handlers/commandHandler.js';
import handleMessage from './handlers/messageHandler.js';

import {
  handleAdminApplicationCallback,
} from './handlers/adminApplicationReviewHandler.js';


async function processUpdate(
  update,
  env,
  db
) {
  if (
    !update ||
    typeof update !== 'object'
  ) {
    return;
  }


  /*
   * Callback Query
   */
  if (
    update.callback_query
  ) {
    await handleAdminApplicationCallback(
      update.callback_query,
      env,
      db
    );

    return;
  }


  /*
   * Message
   */
  if (update.message) {
    const message =
      update.message;

    if (
      !message.chat ||
      !message.from
    ) {
      return;
    }

    const text =
      message.text || '';

    console.log(
      `📨 Message from ${message.chat.id}:`,
      text || '[non-text message]'
    );

    if (text.startsWith('/')) {
      await handleCommand(
        message,
        env,
        db
      );
    } else {
      await handleMessage(
        message,
        env,
        db
      );
    }

    return;
  }


  if (update.edited_message) {
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
      const url =
        new URL(request.url);


      if (
        url.pathname === '/webhook'
      ) {
        if (
          request.method !== 'POST'
        ) {
          return new Response(
            'Method Not Allowed',
            { status: 405 }
          );
        }

        let update;

        try {
          update =
            await request.json();
        } catch (error) {
          console.error(
            '❌ Invalid webhook JSON:',
            error.message
          );

          return new Response(
            'OK',
            { status: 200 }
          );
        }

        if (
          !env.TELEGRAM_BOT_TOKEN
        ) {
          console.error(
            '❌ TELEGRAM_BOT_TOKEN is missing'
          );

          return new Response(
            'OK',
            { status: 200 }
          );
        }

        const db =
          env.DB || null;

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

        return new Response(
          'OK',
          { status: 200 }
        );
      }


      if (url.pathname === '/') {
        return Response.json({
          success: true,
          service:
            'telegram-bot-endmark',
          status: 'online',
          database:
            Boolean(env.DB),
          bot_token_set:
            Boolean(
              env.TELEGRAM_BOT_TOKEN
            ),
          timestamp:
            new Date().toISOString(),
        });
      }


      if (
        url.pathname === '/health'
      ) {
        return Response.json({
          ok: true,
          service:
            'endmark-bot',
          database:
            Boolean(env.DB),
        });
      }


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
          error:
            'Internal server error',
        },
        {
          status: 500,
        }
      );
    }
  },
};
