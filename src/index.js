/**
 * Telegram Bot - Main Worker
 *
 * این فایل نقطه ورود Cloudflare Worker است.
 * فعلاً فقط Webhook تلگرام را دریافت و اعتبارسنجی اولیه می‌کند.
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // فقط POST برای Webhook
    if (url.pathname === '/webhook') {
      if (request.method !== 'POST') {
        return new Response('Method Not Allowed', {
          status: 405,
        });
      }

      try {
        const update = await request.json();

        console.log('Telegram update received:', update);

        return new Response('OK', {
          status: 200,
        });
      } catch (error) {
        console.error('Webhook error:', error);

        return new Response('Bad Request', {
          status: 400,
        });
      }
    }

    // تست ساده Worker
    if (url.pathname === '/') {
      return Response.json({
        success: true,
        service: 'telegram-bot',
        status: 'online',
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
  },
};
