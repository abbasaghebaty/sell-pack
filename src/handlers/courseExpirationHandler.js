import { sendMessage, revokeChatInviteLink, unbanChatMember } from "../api/telegram.js";
import { COURSE_CHANNEL_ID } from "../services/courseAccessService.js";
import {
  getExpiredPurchases,
  markPurchaseExpired
} from "../database/coursePurchasesQueries.js";
import { deactivateCourseBuyer } from "../database/courseBuyers.js";

function getChannelId(env) {
  return String(env?.COURSE_CHANNEL_ID || COURSE_CHANNEL_ID);
}

export async function expireCourses(db, env) {
  const botToken = env?.TELEGRAM_BOT_TOKEN;
  if (!botToken || !db) return;

  const channelId = getChannelId(env);
  const expiredPurchases = await getExpiredPurchases(db);

  for (const purchase of expiredPurchases) {
    try {
      if (purchase.invite_link) {
        try {
          await revokeChatInviteLink(botToken, channelId, purchase.invite_link);
        } catch (error) {
          console.warn(`Could not revoke expired invite ${purchase.id}:`, error.message);
        }
      }

      // Remove from the channel. If this fails (e.g. bot lost admin rights) we
      // must NOT mark the purchase expired, otherwise the user stays in the
      // channel for free and the cron never retries.
      try {
        await unbanChatMember(botToken, channelId, purchase.telegram_id);
      } catch (error) {
        console.error(`Could not remove ${purchase.telegram_id}, will retry:`, error.message);
        continue;
      }

      await markPurchaseExpired(db, purchase.id);
      await deactivateCourseBuyer(db, purchase.telegram_id);

      try {
        await sendMessage(
          botToken,
          purchase.telegram_id,
          `⏳ <b>اشتراک شما به پایان رسید</b>

اشتراک شما به پایان رسیده و دسترسی شما به کانال خصوصی حذف شده است.

برای ادامه استفاده از محتوا، می‌توانید اشتراک خود را تمدید کرده یا یک اشتراک جدید تهیه کنید.

برای خرید اشتراک، از گزینه «خرید اشتراک» استفاده کنید.`
        );
      } catch (error) {
        console.warn(`Could not notify ${purchase.telegram_id}:`, error.message);
      }
    } catch (error) {
      console.error(`Failed to expire purchase ${purchase.id}:`, error.message, error.stack);
    }
  }
}
