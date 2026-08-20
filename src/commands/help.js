/**
 * Help Command
 *
 * مسیر:
 * src/commands/help.js
 */

import {
  sendMessage,
} from '../api/telegram.js';

export async function handleHelpCommand(
  chatId,
  env
) {
  const botToken =
    env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    console.error(
      '❌ Bot token not available'
    );
    return;
  }

  try {
    const helpText =
      `<b>🆘 راهنمای EndMark</b>\n\n` +

      `<b>🛒 خرید دوره</b>\n` +
      `مشاهده و پیگیری مسیر خرید دوره.\n\n` +

      `<b>💰 کسب درآمد</b>\n` +
      `اطلاعات همکاری و ثبت درخواست ادمینی.\n\n` +

      `<b>🔎 استعلام ادمین</b>\n` +
      `بررسی معتبر بودن ادمین‌ها.\n\n` +

      `<b>❓ پشتیبانی</b>\n` +
      `دریافت راهنمایی و پشتیبانی.\n\n` +

      `<b>دستورات:</b>\n` +
      `/start - شروع ربات\n` +
      `/help - راهنما`;

    return await sendMessage(
      botToken,
      chatId,
      helpText
    );

  } catch (error) {
    console.error(
      '❌ Help command error:',
      error.message
    );
  }
}

export default handleHelpCommand;
