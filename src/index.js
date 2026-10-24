import routeTelegramUpdate from "./app/updateRouter.js";
import { handleBlupalWebhook } from "./handlers/blupalWebhookHandler.js";
import { expireCourses } from "./handlers/courseExpirationHandler.js";

// Optional secrets. If a secret is not set the check is skipped, so deploying
// this file alone does not break anything; set them to lock the endpoints.
function safeEqual(a, b) {
  const x = String(a ?? "");
  const y = String(b ?? "");
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);

      if (url.pathname === "/blupal/webhook") {
        if (env.BLUPAL_WEBHOOK_SECRET && !safeEqual(url.searchParams.get("secret"), env.BLUPAL_WEBHOOK_SECRET)) {
          return new Response("Forbidden", { status: 403 });
        }
        return handleBlupalWebhook(request, env, env.DB || null);
      }

      if (url.pathname === "/webhook") {
        if (request.method !== "POST") {
          return new Response("Method Not Allowed", { status: 405 });
        }
        if (
          env.TELEGRAM_WEBHOOK_SECRET &&
          !safeEqual(request.headers.get("X-Telegram-Bot-Api-Secret-Token"), env.TELEGRAM_WEBHOOK_SECRET)
        ) {
          return new Response("Forbidden", { status: 403 });
        }

        let update;
        try {
          update = await request.json();
        } catch (error) {
          console.error("Invalid Telegram JSON:", error.message);
          return new Response("OK", { status: 200 });
        }
        if (!env.TELEGRAM_BOT_TOKEN) {
          console.error("TELEGRAM_BOT_TOKEN missing");
          return new Response("OK", { status: 200 });
        }
        try {
          await routeTelegramUpdate(update, env, env.DB || null);
        } catch (error) {
          console.error("Update processing error:", error.message, error.stack);
        }
        return new Response("OK", { status: 200 });
      }

      if (url.pathname === "/" || url.pathname === "/health") {
        return Response.json({
          ok: true,
          service: "endmark-bot",
          database: Boolean(env.DB),
          telegram: Boolean(env.TELEGRAM_BOT_TOKEN),
          blupal: Boolean(env.BLUPAL_API_KEY)
        });
      }

      return Response.json({ success: false, error: "Route not found" }, { status: 404 });
    } catch (error) {
      console.error("FATAL WORKER ERROR:", error.message, error.stack);
      return Response.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
  },

  async scheduled(controller, env, ctx) {
    if (!env.DB || !env.TELEGRAM_BOT_TOKEN) {
      console.error("Cron skipped: DB or Telegram token missing");
      return;
    }
    ctx.waitUntil(
      (async () => {
        await expireCourses(env.DB, env);
        console.log(`Subscription cron completed: ${controller.cron}`);
      })().catch((error) => {
        console.error("Subscription cron failed:", error.message, error.stack);
      })
    );
  }
};
