import { sendMessage } from "../api/telegram.js";
import { ensureUser } from "../database/users.js";
import { clearUserState } from "../database/userStates.js";
import { registerReferral } from "../database/referrals.js";
import { showMainMenu } from "../handlers/menuHandler.js";

const REFERRAL_PAYLOAD = /^\d{5,15}$/;

// Only brand-new users can be attached to a referrer, and only once.
async function trackReferral(db, env, telegramUser, payload) {
  const referrerId = String(payload ?? "").trim();
  if (!REFERRAL_PAYLOAD.test(referrerId)) return;

  const result = await registerReferral(db, referrerId, telegramUser.id);
  if (!result.registered) {
    console.log(`Referral ignored (${result.reason}) referrer=${referrerId}`);
    return;
  }
  try {
    await sendMessage(
      env.TELEGRAM_BOT_TOKEN,
      referrerId,
      "🎉 <b>زیرمجموعه جدید</b>\n\nیک نفر با لینک دعوت شما وارد ربات شد."
    );
  } catch (error) {
    console.warn("Referrer notification failed:", error.message);
  }
}

export async function handleStartCommand(chatId, telegramUser, env, db, payload = "") {
  const botToken = env?.TELEGRAM_BOT_TOKEN;
  if (!botToken || !telegramUser?.id) {
    console.error("Start command prerequisites missing");
    return;
  }
  try {
    if (db) {
      try {
        await clearUserState(db, telegramUser.id);
      } catch (error) {
        console.error("Failed to clear user state:", error.message);
      }
      try {
        const user = await ensureUser(db, telegramUser);
        if (user.isNew && payload) {
          await trackReferral(db, env, telegramUser, payload);
        }
      } catch (error) {
        console.error("Failed to ensure user / track referral:", error.message);
      }
    }
    return showMainMenu({ chat: { id: chatId }, from: telegramUser }, env);
  } catch (error) {
    console.error("Start command error:", error.message, error.stack);
    try {
      return await sendMessage(botToken, chatId, "متأسفانه خطایی رخ داد. لطفاً دوباره تلاش کنید.");
    } catch (sendError) {
      console.error("Failed to send error:", sendError.message);
    }
  }
}
