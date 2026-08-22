/**
 * Blupal API
 *
 * مسیر:
 * src/api/blupal.js
 */

import {
  BLUPAL_CONFIG,
} from '../config/blupal.js';

const BLUPAL_BASE_URL = 'https://blupal.net/api';

function getApiKey(env) {
  const apiKey = env.BLUPAL_API_KEY?.trim();

  if (!apiKey) {
    throw new Error('BLUPAL_API_KEY is missing');
  }

  return apiKey;
}

async function parseJson(response) {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {
      success: false,
      error: 'invalid_json_response',
      message: text || 'Invalid response from Blupal',
    };
  }
}

export async function createBlupalInvoice(
  env,
  rialAmount
) {
  const apiKey = getApiKey(env);

  if (
    !Number.isInteger(rialAmount) ||
    rialAmount < BLUPAL_CONFIG.MIN_AMOUNT_RIAL
  ) {
    throw new Error(
      `Blupal amount must be at least ${BLUPAL_CONFIG.MIN_AMOUNT_RIAL} IRR`
    );
  }

  const response = await fetch(
    `${BLUPAL_BASE_URL}/v1/invoices/create`,
    {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },

      body: JSON.stringify({
        amount: rialAmount,
        back_url: BLUPAL_CONFIG.BACK_URL,
      }),
    }
  );

  const payload = await parseJson(response);

  if (
    !response.ok ||
    payload.success !== true
  ) {
    const message =
      payload.message ||
      payload.error ||
      `Blupal invoice creation failed (${response.status})`;

    throw new Error(message);
  }

  return {
    invoice_id:
      Number(payload.invoice_id),

    amount:
      Number(payload.amount),

    final_amount:
      Number(payload.final_amount),

    status:
      payload.status,

    payment_link:
      payload.payment_link,

    card_number:
      payload.card_number ?? null,

    mode:
      payload.mode ?? BLUPAL_CONFIG.MODE,

    expires_at:
      payload.expires_at ?? null,
  };
}
