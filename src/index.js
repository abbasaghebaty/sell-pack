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
      console.log('⚠️ No message or chat in update');
      return;
    }

    const text = message.text || '';
    const chatId = message.chat.id;

    // ✅ اینجا message.from رو چک میکنیم
    if (!message.from) {
      console.log('⚠️ No sender information in message');
      return;
    }

    console.log(`📨 Processing message: "${text}" from chat ${chatId}`);

    // شناسایی دستور یا پیام عادی
    if (text.startsWith('/')) {
      // دستور
      console.log(`🎯 Command detected: ${text}`);
      // ✅ await اضافه کردیم
      await handleCommand(message, env, db);
    } else if (text) {
      // پیام عادی یا کلیک دکمه
      console.log(`💬 Regular message detected`);
      // ✅ await اضافه کردیم
      await handleMessage(message, env, db);
    }
  } catch (error) {
    console.error('❌ Error in processUpdate:', error.message, error.stack);
    // ✅ خطا رو log میکنیم ولی به Telegram نمی‌فرستیم (avoid infinite loops)
  }
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);

      // فقط POST برای Webhook
      if (url.pathname === '/webhook') {
        if (request.method !== 'POST') {
          console.warn('❌ Invalid HTTP method for webhook:', request.method);
          return new Response('Method Not Allowed', { status: 405 });
        }

        try {
          // بررسی توکن
          if (!env.TELEGRAM_BOT_TOKEN) {
            console.error('❌ TELEGRAM_BOT_TOKEN not set!');
            return new Response('OK', { status: 200 });
          }

          let update;
          try {
            update = await request.json();
          } catch (parseError) {
            console.error('❌ Failed to parse request JSON:', parseError.message);
            return new Response('OK', { status: 200 });
          }

          console.log('✅ Update received:', JSON.stringify(update, null, 2));

          // اتصال به دیتابیس D1
          const db = env.DB;
          if (!db) {
            console.warn('⚠️ Database not available');
          }

          // ✅ await اضافه کردیم
          await processUpdate(update, env, db);

          // همیشه 200 برگردانیم تا تلگرام خوشحال باشد
          return new Response('OK', { status: 200 });
        } catch (error) {
          console.error('❌ Webhook processing error:', error.message, error.stack);
          // حتی اگر خطا باشد، 200 برگردانیم تا تلگرام دوباره تلاش نکند
          return new Response('OK', { status: 200 });
        }
      }

      // تست ساده Worker
      if (url.pathname === '/') {
        return Response.json({
          success: true,
          service: 'telegram-bot-sell-pack',
          status: 'online ✅',
          bot_token_set: !!env.TELEGRAM_BOT_TOKEN,
          timestamp: new Date().toISOString(),
        });
      }

      // Health check
      if (url.pathname === '/health') {
        return Response.json({
          ok: true,
          message: 'Worker is running',
        });
      }

      return Response.json(
        { success: false, error: 'Route not found' },
        { status: 404 },
      );
    } catch (error) {
      console.error('❌ FATAL ERROR in fetch:', error.message, error.stack);
      return new Response(
        JSON.stringify({
          error: 'Internal server error',
          message: error.message,
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  },
};
