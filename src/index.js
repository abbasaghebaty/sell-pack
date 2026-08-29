/**
 * EndMark Telegram Bot
 *
 * Cloudflare Worker
 */

import handleCommand from './handlers/commandHandler.js';

import handleMessage from './handlers/subscriptionMessageHandler.js';

import {
  handleAdminApplicationCallback,
} from './handlers/adminApplicationReviewHandler.js';

import {
  handleBlupalWebhook,
} from './handlers/blupalWebhookHandler.js';

import {
  handleCourseJoinRequest,
  expireCourses,
} from './handlers/courseAccessHandler.js';

async function processUpdate(
  update,
  env,
  db
) {
  if (
    !update ||
    typeof update !==
      'object'
  ) {
    return;
  }

  /*
   * Join Request
   */
  if (
    update.chat_join_request
  ) {
    try {
      await handleCourseJoinRequest(
        update.chat_join_request,
        env,
        db
      );
    } catch (error) {
      console.error(
        '❌ Chat join request error:',
        error.message,
        error.stack
      );
    }

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
  if (
    update.message
  ) {
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
      text ||
        '[non-text message]'
    );

    if (
      text.startsWith('/')
    ) {
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

  if (
    update.edited_message
  ) {
    return;
  }

  console.log(
    'ℹ️ Unsupported update:',
    Object.keys(update)
  );
}

export default {
  async fetch(
    request,
    env
  ) {
    try {
      const url =
        new URL(
          request.url
        );

      /*
       * Blupal Webhook
       */
      if (
        url.pathname ===
        '/blupal/webhook'
      ) {
        return handleBlupalWebhook(
          request,
          env,
          env.DB || null
        );
      }

      /*
       * Telegram Webhook
       */
      if (
        url.pathname ===
        '/webhook'
      ) {
        if (
          request.method !==
          'POST'
        ) {
          return new Response(
            'Method Not Allowed',
            {
              status: 405,
            }
          );
        }

        let update;

        try {
          update =
            await request.json();
        } catch (error) {
          console.error(
            '❌ Invalid Telegram JSON:',
            error.message
          );

          return new Response(
            'OK',
            {
              status: 200,
            }
          );
        }

        if (
          !env.TELEGRAM_BOT_TOKEN
        ) {
          console.error(
            '❌ TELEGRAM_BOT_TOKEN missing'
          );

          return new Response(
            'OK',
            {
              status: 200,
            }
          );
        }

        try {
          await processUpdate(
            update,
            env,
            env.DB || null
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
          {
            status: 200,
          }
        );
      }

      /*
       * Health
       */
      if (
        url.pathname === '/'
      ) {
        return Response.json({
          success: true,

          service:
            'telegram-bot-endmark',

          status:
            'online',

          database:
            Boolean(env.DB),

          bot_token_set:
            Boolean(
              env.TELEGRAM_BOT_TOKEN
            ),

          blupal_key_set:
            Boolean(
              env.BLUPAL_API_KEY
            ),

          channel_id:
            env.COURSE_CHANNEL_ID ||
            '-1004412265336',

          timestamp:
            new Date().toISOString(),
        });
      }

      if (
        url.pathname ===
        '/health'
      ) {
        return Response.json({
          ok: true,

          service:
            'endmark-bot',

          database:
            Boolean(env.DB),

          telegram:
            Boolean(
              env.TELEGRAM_BOT_TOKEN
            ),

          blupal:
            Boolean(
              env.BLUPAL_API_KEY
            ),
        });
      }

      return Response.json(
        {
          success: false,
          error:
            'Route not found',
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

  /*
   * Subscription expiration
   */
  async scheduled(
    controller,
    env,
    ctx
  ) {
    if (
      !env.DB ||
      !env.TELEGRAM_BOT_TOKEN
    ) {
      console.error(
        '❌ Cron skipped: DB or Telegram token missing'
      );

      return;
    }

    ctx.waitUntil(
      (async () => {
        await expireCourses(
          env.DB,
          env
        );

        console.log(
          `✅ Subscription cron completed: ${controller.cron}`
        );
      })().catch(
        (error) => {
          console.error(
            '❌ Subscription cron failed:',
            error.message,
            error.stack
          );
        }
      )
    );
  },
};
