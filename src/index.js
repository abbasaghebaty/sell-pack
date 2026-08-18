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
  try {
    const message = update.message;

    if (!message || !message.chat) {
      console.log('No message or chat in update');
      return;
    }

    const text = message.text || '';
    const chatId = message.chat.id;

    console.log(`Processing message: "${text}" from chat ${chatId}`);

    // شناسایی دستور یا پیام عادی
    if (text.startsWith('/')) {
      // دستور
      console.log(`Command detected: ${text}`);
      await handleCommand(message, env, db);
    } else if (text) {
      // پیام عادی یا کلیک دکمه
      console.log(`Regular message detected`);
      await handleMessage(message, env, db);
    }
  } catch (error) {
    console.error('Error in processUpdate:', error.message, error.stack);
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
        // بررسی توکن
        if (!env.TELEGRAM_BOT_TOKEN) {
          console.error('TELEGRAM_BOT_TOKEN not set!');
          return new Response('OK', { status: 200 });
        }

        const update = await request.json();

        console.log('Update received:', JSON.stringify(update, null, 2));

        // اتصال به دیتابیس D1
        const db = env.DB;

        // پردازش update
        await processUpdate(update, env, db);

        // همیشه 200 برگردانیم تا تلگرام خوشحال باشد
        return new Response('OK', { status: 200 });
      } catch (error) {
        console.error('Webhook error:', error.message, error.stack);
        // حتی اگر خطا باشد، 200 برگردانیم
        return new Response('OK', { status: 200 });
      }
    }

    // تست ساده Worker
    if (url.pathname === '/') {
      return Response.json({
        success: true,
        service: 'telegram-bot-sell-pack',
        status: 'online',
        bot_token_set: !!env.TELEGRAM_BOT_TOKEN,
      });
    }

    return Response.json(
      { success: false, error: 'Route not found' },
      { status: 404 },
    );
  },
};
