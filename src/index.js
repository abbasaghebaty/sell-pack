INDEX.JS CHANGES
================

Add this import near the existing handler imports:

import {
  handleBlupalWebhook,
} from './handlers/blupalWebhookHandler.js';


Inside `fetch(request, env)`, before the existing `/webhook` Telegram route, add:

      if (url.pathname === '/blupal/webhook') {
        return await handleBlupalWebhook(
          request,
          env,
          env.DB || null
        );
      }


The existing Telegram `/webhook` route stays unchanged.
