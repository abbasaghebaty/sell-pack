/**
 * Command Handler
 *
 * مسیر:
 * src/handlers/commandHandler.js
 *
 * این فایل دستورات دریافت شده را شناسایی و هدایت می‌کند.
 */

import { handleStartCommand } from '../commands/start.js';
import { handleHelpCommand } from '../commands/help.js';

export async function handleCommand(message, env, db) {
  try {
    const text = message.text || '';
    const chatId = message.chat.id;

    // حذف @ برای دستورات مثل /start@botname
    const command = text.split('@')[0].toLowerCase();

    console.log(`Command detected: ${command}`);

    switch (command) {
      case '/start':
        return handleStartCommand(chatId, message.from, env, db);

      case '/help':
        return handleHelpCommand(chatId, env);

      default:
        console.log(`Unknown command: ${command}`);
        return null;
    }
  } catch (error) {
    console.error('Command handler error:', error.message);
  }
}

export default handleCommand;
