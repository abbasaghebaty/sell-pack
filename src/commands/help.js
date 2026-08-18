/**
 * Help Command
 *
 * مسیر:
 * src/commands/help.js
 *
 * این فایل دستور /help را هندل می‌کند.
 */

import { sendMessage } from '../api/telegram.js';

export async function handleHelpCommand(chatId, env) {
  const botToken = env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    console.error('Bot token not available in help command');
    return;
  }

  try {
    const helpText = `<b>🆘 راهنما</b>

اینجا راهنمایی برای استفاده از ربات:

<b>🛒 خرید دوره</b>
برای خریداری دوره‌های آنلاین اینجا رو بزنید

<b>📚 دوره‌های من</b>
دوره‌هایی که خریداری کرده‌اید را ببینید

<b>💰 کسب درآمد</b>
اطلاعات برنامه همکاری و کسب درآمد

<b>👤 حساب کاربری</b>
مشاهده و ویرایش اطلاعات حساب

<b>❓ راهنما و پشتیبانی</b>
تماس با تیم پشتیبانی

<b>دستورات:</b>
/start - شروع ربات
/help - این راهنما`;

    return sendMessage(
      botToken,
      chatId,
      helpText,
    );
  } catch (error) {
    console.error('Help command error:', error.message);
  }
}

export default handleHelpCommand;
