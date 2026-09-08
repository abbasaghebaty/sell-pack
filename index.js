/**
 * EndMark Telegram Bot - Cloudflare Worker entrypoint.
 *
 * این فایل فقط لایه HTTP/Worker را مدیریت می‌کند.
 */

import routeTelegramUpdate from './app/updateRouter.js';
import { handleBlupalWebhook } from './handlers/blupalWebhookHandler.js';
import { expireCourses } from './handlers/courseAccessHandler.js';

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);

      if (url.pathname === '/blupal/webhook') {
        return handleBlupalWebhook(request, env, env.DB || null);
      }

      if (url.pathname === '/webhook') {
        if (request.method !== 'POST') {
          return new Response('Method Not Allowed', { status: 405 });
        }

        let update;
        try {
          update = await request.json();
        } catch (error) {
          console.error('Invalid Telegram JSON:', error.message);
          return new Response('OK', { status: 200 });
        }

        if (!env.TELEGRAM_BOT_TOKEN) {
          console.error('TELEGRAM_BOT_TOKEN missing');
          return new Response('OK', { status: 200 });
        }

        try {
          await routeTelegramUpdate(update, env, env.DB || null);
        } catch (error) {
          console.error('Update processing error:', error.message, error.stack);
        }

        return new Response('OK', { status: 200 });
      }

      if (url.pathname === '/') {
        return Response.json({
          success: true,
          service: 'telegram-bot-endmark',
          status: 'online',
          database: Boolean(env.DB),
          bot_token_set: Boolean(env.TELEGRAM_BOT_TOKEN),
          blupal_key_set: Boolean(env.BLUPAL_API_KEY),
          channel_id: env.COURSE_CHANNEL_ID || '-1004412265336',
          timestamp: new Date().toISOString(),
        });
      }

      if (url.pathname === '/health') {
        return Response.json({
          ok: true,
          service: 'endmark-bot',
          database: Boolean(env.DB),
          telegram: Boolean(env.TELEGRAM_BOT_TOKEN),
          blupal: Boolean(env.BLUPAL_API_KEY),
        });
      }

      return Response.json(
        { success: false, error: 'Route not found' },
        { status: 404 },
      );
    } catch (error) {
      console.error('FATAL WORKER ERROR:', error.message, error.stack);

      return Response.json(
        { success: false, error: 'Internal server error' },
        { status: 500 },
      );
    }
  },

  async scheduled(controller, env, ctx) {
    if (!env.DB || !env.TELEGRAM_BOT_TOKEN) {
      console.error('Cron skipped: DB or Telegram token missing');
      return;
    }

    ctx.waitUntil(
      (async () => {
        await expireCourses(env.DB, env);
        console.log(`Subscription cron completed: ${controller.cron}`);
      })().catch((error) => {
        console.error('Subscription cron failed:', error.message, error.stack);
      }),
    );
  },
};
