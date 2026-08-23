/**
 * Blupal API
 *
 * مسیر:
 * src/api/blupal.js
 */

const BLUPAL_BASE_URL = 'https://blupal.net/api';


function getApiKey(env) {
  const apiKey = env?.BLUPAL_API_KEY?.trim();

  if (!apiKey) {
    throw new Error(
      'BLUPAL_API_KEY is missing. Add BLUPAL_API_KEY as a Cloudflare Worker Secret.'
    );
  }

  if (
    !apiKey.startsWith('blu_test_') &&
    !apiKey.startsWith('blu_live_')
  ) {
    throw new Error(
      'BLUPAL_API_KEY has an invalid format. Expected blu_test_... or blu_live_...'
    );
  }

  return apiKey;
}


function getModeFromApiKey(apiKey) {
  if (apiKey.startsWith('blu_test_')) {
    return 'sandbox';
  }

  if (apiKey.startsWith('blu_live_')) {
    return 'live';
  }

  return null;
}


async function parseResponse(response) {
  const text = await response.text();

  let payload = {};

  try {
    payload = text
      ? JSON.parse(text)
      : {};
  } catch {
    throw new Error(
      `Blupal returned invalid JSON. HTTP ${response.status}. Response: ${text || '[empty]'}`
    );
  }

  return payload;
}


export async function createBlupalInvoice(
  env,
  rialAmount
) {
  const apiKey = getApiKey(env);
  const mode = getModeFromApiKey(apiKey);

  if (!Number.isInteger(rialAmount)) {
    throw new Error(
      `Invalid Blupal amount: ${rialAmount}. Amount must be an integer in IRR.`
    );
  }

  if (rialAmount < 100_000) {
    throw new Error(
      `Blupal amount is too low: ${rialAmount} IRR. Minimum is 100000 IRR.`
    );
  }

  const endpoint =
    `${BLUPAL_BASE_URL}/v1/invoices/create`;

  console.log(
    'Blupal create invoice request:',
    {
      endpoint,
      amount: rialAmount,
      mode,
    }
  );

  let response;

  try {
    response = await fetch(
      endpoint,
      {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
          Accept: 'application/json',
        },

        body: JSON.stringify({
          amount: rialAmount,
        }),
      }
    );
  } catch (error) {
    throw new Error(
      `Blupal network request failed: ${error?.message || error}`
    );
  }

  const payload =
    await parseResponse(response);

  console.log(
    'Blupal create invoice response:',
    {
      httpStatus: response.status,
      payload,
    }
  );

  if (!response.ok) {
    throw new Error(
      `Blupal HTTP ${response.status}: ${
        payload?.message ||
        payload?.error ||
        'Unknown API error'
      }`
    );
  }

  if (payload?.success !== true) {
    throw new Error(
      `Blupal API rejected invoice creation: ${
        payload?.message ||
        payload?.error ||
        'Unknown Blupal error'
      }`
    );
  }

  const invoiceId =
    Number(payload.invoice_id);

  const amount =
    Number(payload.amount);

  const finalAmount =
    Number(payload.final_amount);

  if (
    !Number.isInteger(invoiceId) ||
    invoiceId <= 0
  ) {
    throw new Error(
      'Blupal returned an invalid invoice_id.'
    );
  }

  if (
    !Number.isInteger(amount) ||
    amount <= 0
  ) {
    throw new Error(
      'Blupal returned an invalid amount.'
    );
  }

  if (
    !Number.isInteger(finalAmount) ||
    finalAmount <= 0
  ) {
    throw new Error(
      'Blupal returned an invalid final_amount.'
    );
  }

  if (finalAmount < amount) {
    throw new Error(
      'Blupal returned final_amount lower than amount.'
    );
  }

  return {
    invoice_id: invoiceId,

    amount,

    final_amount: finalAmount,

    status:
      payload.status ||
      'PENDING',

    /*
     * دیگر برای پرداخت مستقیم ربات اجباری نیست.
     * فقط برای سازگاری با کدهای قدیمی نگه داشته شده.
     */
    payment_link:
      payload.payment_link ??
      null,

    card_number:
      payload.card_number ??
      null,

    mode:
      payload.mode ??
      mode,

    expires_at:
      payload.expires_at ??
      null,
  };
}


export async function getBlupalInvoice(
  env,
  invoiceId
) {
  const apiKey =
    getApiKey(env);

  if (!invoiceId) {
    throw new Error(
      'Blupal invoice ID is required.'
    );
  }

  const endpoint =
    `${BLUPAL_BASE_URL}/v1/invoices/${encodeURIComponent(invoiceId)}`;

  const response =
    await fetch(
      endpoint,
      {
        method: 'GET',

        headers: {
          'X-API-Key': apiKey,
          Accept: 'application/json',
        },
      }
    );

  const payload =
    await parseResponse(response);

  if (!response.ok) {
    throw new Error(
      `Blupal HTTP ${response.status}: ${
        payload?.message ||
        payload?.error ||
        'Unknown API error'
      }`
    );
  }

  if (payload?.success !== true) {
    throw new Error(
      `Blupal invoice lookup failed: ${
        payload?.message ||
        payload?.error ||
        'Unknown error'
      }`
    );
  }

  return payload;
}
