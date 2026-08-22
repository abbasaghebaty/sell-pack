/**
 * Blupal API
 *
 * مسیر:
 * src/api/blupal.js
 */

const BLUPAL_BASE_URL = 'https://blupal.net/api';

function getApiKey(env) {
  const apiKey = env.BLUPAL_API_KEY?.trim();

  if (!apiKey) {
    throw new Error('BLUPAL_API_KEY is missing');
  }

  return apiKey;
}

function getMode(apiKey) {
  if (apiKey.startsWith('blu_test_')) return 'sandbox';
  if (apiKey.startsWith('blu_live_')) return 'live';
  return null;
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

export async function createBlupalInvoice(env, rialAmount) {
  const apiKey = getApiKey(env);

  if (!Number.isInteger(rialAmount) || rialAmount < 100000) {
    throw new Error('Blupal amount must be at least 100000 IRR');
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
      }),
    }
  );

  const payload = await parseJson(response);

  if (!response.ok || payload.success !== true) {
    const message =
      payload.message ||
      payload.error ||
      `Blupal invoice creation failed (${response.status})`;

    throw new Error(`Blupal API error: ${message}`);
  }

  return {
    invoice_id: Number(payload.invoice_id),
    amount: Number(payload.amount),
    final_amount: Number(payload.final_amount),
    status: payload.status,
    payment_link: payload.payment_link,
    card_number: payload.card_number ?? null,
    mode: payload.mode ?? getMode(apiKey),
    expires_at: payload.expires_at ?? null,
  };
}

export async function getBlupalInvoice(env, invoiceId) {
  const apiKey = getApiKey(env);

  const response = await fetch(
    `${BLUPAL_BASE_URL}/v1/invoices/${encodeURIComponent(invoiceId)}`,
    {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey,
      },
    }
  );

  const payload = await parseJson(response);

  if (!response.ok || payload.success !== true) {
    const message =
      payload.message ||
      payload.error ||
      `Blupal invoice lookup failed (${response.status})`;

    throw new Error(`Blupal API error: ${message}`);
  }

  return payload;
}
