/**
 * Telegram Bot - Main Worker
 *
 * مسیر:
 * src/index.js
 *
 * نقطه ورود Cloudflare Worker - دریافت و پردازش webhook تلگرام
 */

import handleCommand from './handlers/commandHandler.js';
import handleMessage from './handlers/messageHandler.js';

async function processUpdate(update, env, db) {
  const message = update.message;

  if (!message || !message.chat) {
    return;
  }

  const text = message.text || '';
  const chatId = message.chat.id;

  // شناسایی دستور یا پیام عادی
  if (text.startsWith('/')) {
    // دستور
    await handleCommand(message, env, db);
  } else {
    // پیام عادی یا کلیک دکمه
    await handleMessage(message, env, db);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // فقط POST برای Webhook
    if (url.pathname === '/webhook') {
      if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
      }

      try {
        const update = await request.json();

        // اتصال به دیتابیس D1
        const db = env.DB;

        // پردازش update
        await processUpdate(update, env, db);

        return new Response('OK', { status: 200 });
      } catch (error) {
        console.error('Webhook error:', error);
        return new Response('Bad Request', { status: 400 });
      }
    }

    // تست ساده Worker
    if (url.pathname === '/') {
      return Response.json({
        success: true,
        service: 'telegram-bot-sell-pack',
        status: 'online',
      });
    }

    return Response.json(
      { success: false, error: 'Route not found' },
      { status: 404 },
    );
  },
};
