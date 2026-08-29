/**
 * Blupal API
 *
 * مسیر:
 * src/api/blupal.js
 */

const BLUPAL_BASE_URL =
  'https://blupal.net/api';

const REQUEST_TIMEOUT = 15_000;

function getApiKey(env) {
  const apiKey =
    env?.BLUPAL_API_KEY?.trim();

  if (!apiKey) {
    throw new Error(
      'BLUPAL_API_KEY is missing.'
    );
  }

  if (
    !apiKey.startsWith('blu_test_') &&
    !apiKey.startsWith('blu_live_')
  ) {
    throw new Error(
      'BLUPAL_API_KEY has an invalid format.'
    );
  }

  return apiKey;
}

function getModeFromApiKey(apiKey) {
  if (
    apiKey.startsWith('blu_test_')
  ) {
    return 'sandbox';
  }

  if (
    apiKey.startsWith('blu_live_')
  ) {
    return 'live';
  }

  return null;
}

async function parseResponse(response) {
  const text =
    await response.text();

  try {
    return text
      ? JSON.parse(text)
      : {};
  } catch {
    throw new Error(
      `Blupal returned invalid JSON. HTTP ${response.status}. Response: ${
        text || '[empty]'
      }`
    );
  }
}

async function blupalRequest(
  env,
  method,
  path,
  body = null
) {
  const apiKey =
    getApiKey(env);

  const endpoint =
    `${BLUPAL_BASE_URL}${path}`;

  const controller =
    new AbortController();

  const timeoutId =
    setTimeout(
      () =>
        controller.abort(),
      REQUEST_TIMEOUT
    );

  try {
    const headers = {
      Accept:
        'application/json',

      'X-API-Key':
        apiKey,
    };

    if (body !== null) {
      headers[
        'Content-Type'
      ] = 'application/json';
    }

    console.log(
      'Blupal request:',
      {
        method,
        endpoint,
        mode:
          getModeFromApiKey(
            apiKey
          ),
      }
    );

    let response;

    try {
      response =
        await fetch(
          endpoint,
          {
            method,
            headers,
            body:
              body === null
                ? undefined
                : JSON.stringify(
                    body
                  ),
            signal:
              controller.signal,
          }
        );
    } catch (error) {
      if (
        error?.name ===
        'AbortError'
      ) {
        throw new Error(
          `Blupal request timed out after ${REQUEST_TIMEOUT}ms.`
        );
      }

      throw new Error(
        `Blupal network request failed: ${
          error?.message ||
          error
        }`
      );
    }

    const payload =
      await parseResponse(
        response
      );

    console.log(
      'Blupal response:',
      {
        status:
          response.status,

        payload,
      }
    );

    if (!response.ok) {
      throw new Error(
        `Blupal HTTP ${
          response.status
        }: ${
          payload?.message ||
          payload?.error ||
          'Unknown error'
        }`
      );
    }

    return payload;
  } finally {
    clearTimeout(
      timeoutId
    );
  }
}

export async function createBlupalInvoice(
  env,
  rialAmount
) {
  const amount =
    Number(rialAmount);

  if (
    !Number.isInteger(amount)
  ) {
    throw new Error(
      `Invalid Blupal amount: ${rialAmount}`
    );
  }

  if (
    amount < 100_000
  ) {
    throw new Error(
      `Blupal amount is too low: ${amount} IRR.`
    );
  }

  if (
    amount > 500_000_000
  ) {
    throw new Error(
      `Blupal amount is too high: ${amount} IRR.`
    );
  }

  const apiKey =
    getApiKey(env);

  const defaultMode =
    getModeFromApiKey(
      apiKey
    );

  const payload =
    await blupalRequest(
      env,
      'POST',
      '/v1/invoices/create',
      {
        amount,
      }
    );

  /*
   * عمدتاً برای جلوگیری از خراب شدن
   * جریان پرداخت، فقط success را
   * در صورت وجود و false بودن رد می‌کنیم.
   */
  if (
    payload?.success === false
  ) {
    throw new Error(
      `Blupal invoice creation rejected: ${
        payload?.message ||
        payload?.error ||
        'Unknown error'
      }`
    );
  }

  const invoiceId =
    Number(
      payload?.invoice_id
    );

  const returnedAmount =
    Number(
      payload?.amount
    );

  const finalAmount =
    Number(
      payload?.final_amount ??
      payload?.amount
    );

  if (
    !Number.isInteger(
      invoiceId
    ) ||
    invoiceId <= 0
  ) {
    throw new Error(
      'Blupal returned invalid invoice_id.'
    );
  }

  if (
    !Number.isInteger(
      returnedAmount
    ) ||
    returnedAmount <= 0
  ) {
    throw new Error(
      'Blupal returned invalid amount.'
    );
  }

  if (
    !Number.isInteger(
      finalAmount
    ) ||
    finalAmount <= 0
  ) {
    throw new Error(
      'Blupal returned invalid final_amount.'
    );
  }

  if (
    returnedAmount !== amount
  ) {
    throw new Error(
      `Blupal amount mismatch. Requested ${amount}, received ${returnedAmount}.`
    );
  }

  if (
    finalAmount < returnedAmount
  ) {
    throw new Error(
      'Blupal returned invalid final_amount.'
    );
  }

  return {
    invoice_id:
      invoiceId,

    amount:
      returnedAmount,

    final_amount:
      finalAmount,

    status:
      payload?.status ||
      'PENDING',

    payment_link:
      payload?.payment_link ??
      null,

    card_number:
      payload?.card_number ??
      null,

    mode:
      payload?.mode ??
      defaultMode,

    expires_at:
      payload?.expires_at ??
      null,
  };
}

export async function getBlupalInvoice(
  env,
  invoiceId
) {
  const id =
    Number(invoiceId);

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    throw new Error(
      `Invalid invoice ID: ${invoiceId}`
    );
  }

  const payload =
    await blupalRequest(
      env,
      'GET',
      `/v1/invoices/${encodeURIComponent(
        id
      )}`
    );

  if (
    payload?.success === false
  ) {
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

export default {
  createBlupalInvoice,
  getBlupalInvoice,
};
