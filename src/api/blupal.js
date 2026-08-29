/**
 * Blupal API
 *
 * مسیر:
 * src/api/blupal.js
 *
 * مسئول:
 * - ساخت فاکتور
 * - دریافت وضعیت فاکتور
 * - مدیریت پاسخ‌های Blupal
 */

const BLUPAL_BASE_URL = 'https://blupal.net/api';

const REQUEST_TIMEOUT = 15000;


/**
 * دریافت API Key از Cloudflare Secret
 */
function getApiKey(env) {
  const apiKey =
    env?.BLUPAL_API_KEY?.trim();

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


/**
 * تشخیص محیط از روی API Key
 */
function getModeFromApiKey(apiKey) {
  if (apiKey.startsWith('blu_test_')) {
    return 'sandbox';
  }

  if (apiKey.startsWith('blu_live_')) {
    return 'live';
  }

  return null;
}


/**
 * پارس امن پاسخ Blupal
 */
async function parseResponse(response) {
  const text =
    await response.text();

  let payload = {};

  try {
    payload =
      text
        ? JSON.parse(text)
        : {};
  } catch {
    throw new Error(
      `Blupal returned invalid JSON. HTTP ${response.status}. Response: ${text || '[empty]'}`
    );
  }

  return payload;
}


/**
 * درخواست عمومی به Blupal
 */
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
      () => controller.abort(),
      REQUEST_TIMEOUT
    );

  try {
    const headers = {
      'X-API-Key': apiKey,
      Accept: 'application/json',
    };

    if (body !== null) {
      headers['Content-Type'] =
        'application/json';
    }

    console.log(
      'Blupal request:',
      {
        method,
        endpoint,
        mode: getModeFromApiKey(apiKey),
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
                : JSON.stringify(body),
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
          `Blupal request timed out after ${REQUEST_TIMEOUT}ms`
        );
      }

      throw new Error(
        `Blupal network request failed: ${
          error?.message || error
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
        method,
        endpoint,
        httpStatus:
          response.status,
        payload,
      }
    );

    if (!response.ok) {
      const apiError =
        payload?.message ||
        payload?.error ||
        payload?.detail ||
        `HTTP ${response.status}`;

      throw new Error(
        `Blupal API error: ${apiError}`
      );
    }

    return {
      payload,
      status:
        response.status,
    };

  } finally {
    clearTimeout(
      timeoutId
    );
  }
}


/**
 * ساخت فاکتور
 *
 * مبلغ ورودی:
 * ریال
 *
 * مثال:
 * 400000
 * =
 * 40,000 تومان
 */
export async function createBlupalInvoice(
  env,
  rialAmount
) {
  const numericAmount =
    Number(rialAmount);

  if (
    !Number.isInteger(
      numericAmount
    )
  ) {
    throw new Error(
      `Invalid Blupal amount: ${rialAmount}. Amount must be an integer in IRR.`
    );
  }

  if (
    numericAmount < 100_000
  ) {
    throw new Error(
      `Blupal amount is too low: ${numericAmount} IRR. Minimum is 100000 IRR.`
    );
  }

  if (
    numericAmount > 500_000_000
  ) {
    throw new Error(
      `Blupal amount is too high: ${numericAmount} IRR. Maximum is 500000000 IRR.`
    );
  }

  const {
    payload,
  } =
    await blupalRequest(
      env,
      'POST',
      '/v1/invoices/create',
      {
        amount:
          numericAmount,
      }
    );

  if (
    payload?.success !== true
  ) {
    throw new Error(
      `Blupal rejected invoice creation: ${
        payload?.message ||
        payload?.error ||
        'Unknown error'
      }`
    );
  }

  const invoiceId =
    Number(
      payload.invoice_id
    );

  const amount =
    Number(
      payload.amount
    );

  const finalAmount =
    Number(
      payload.final_amount
    );

  if (
    !Number.isInteger(
      invoiceId
    ) ||
    invoiceId <= 0
  ) {
    throw new Error(
      'Blupal returned an invalid invoice_id.'
    );
  }

  if (
    !Number.isInteger(
      amount
    ) ||
    amount <= 0
  ) {
    throw new Error(
      'Blupal returned an invalid amount.'
    );
  }

  if (
    !Number.isInteger(
      finalAmount
    ) ||
    finalAmount <= 0
  ) {
    throw new Error(
      'Blupal returned an invalid final_amount.'
    );
  }

  /*
   * مبلغ دریافتی از Blupal
   * باید با مبلغی که درخواست کرده‌ایم
   * برابر باشد.
   */
  if (
    amount !== numericAmount
  ) {
    throw new Error(
      `Blupal amount mismatch. Requested: ${numericAmount}, received: ${amount}`
    );
  }

  /*
   * final_amount باید حداقل برابر
   * amount باشد.
   */
  if (
    finalAmount < amount
  ) {
    throw new Error(
      `Blupal returned invalid final_amount: ${finalAmount}`
    );
  }

  const apiKey =
    getApiKey(env);

  const mode =
    payload.mode ??
    getModeFromApiKey(
      apiKey
    );

  return {
    invoice_id:
      invoiceId,

    amount:
      amount,

    final_amount:
      finalAmount,

    status:
      payload.status ??
      'PENDING',

    payment_link:
      payload.payment_link ??
      null,

    card_number:
      payload.card_number ??
      null,

    mode:
      mode,

    expires_at:
      payload.expires_at ??
      null,
  };
}


/**
 * دریافت وضعیت فاکتور
 */
export async function getBlupalInvoice(
  env,
  invoiceId
) {
  const numericInvoiceId =
    Number(invoiceId);

  if (
    !Number.isInteger(
      numericInvoiceId
    ) ||
    numericInvoiceId <= 0
  ) {
    throw new Error(
      `Invalid Blupal invoice ID: ${invoiceId}`
    );
  }

  const {
    payload,
  } =
    await blupalRequest(
      env,
      'GET',
      `/v1/invoices/${encodeURIComponent(numericInvoiceId)}`
    );

  if (
    payload?.success !== true
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


/**
 * شبیه‌سازی پرداخت در Sandbox
 *
 * فقط برای تست.
 *
 * scenario:
 * success
 * wrong_amount
 * expire
 * cancel
 */
export async function simulateBlupalPayment(
  env,
  invoiceId,
  scenario = 'success'
) {
  const apiKey =
    getApiKey(env);

  const mode =
    getModeFromApiKey(
      apiKey
    );

  if (
    mode !== 'sandbox'
  ) {
    throw new Error(
      'Blupal payment simulation is only available in sandbox mode.'
    );
  }

  const numericInvoiceId =
    Number(invoiceId);

  if (
    !Number.isInteger(
      numericInvoiceId
    ) ||
    numericInvoiceId <= 0
  ) {
    throw new Error(
      `Invalid Blupal invoice ID: ${invoiceId}`
    );
  }

  const validScenarios =
    new Set([
      'success',
      'wrong_amount',
      'expire',
      'cancel',
    ]);

  if (
    !validScenarios.has(
      scenario
    )
  ) {
    throw new Error(
      `Invalid sandbox scenario: ${scenario}`
    );
  }

  const {
    payload,
  } =
    await blupalRequest(
      env,
      'POST',
      `/v1/sandbox/invoices/${encodeURIComponent(numericInvoiceId)}/simulate`,
      {
        scenario,
      }
    );

  if (
    payload?.success !== true
  ) {
    throw new Error(
      `Blupal sandbox simulation failed: ${
        payload?.message ||
        payload?.error ||
        'Unknown error'
      }`
    );
  }

  return payload;
}


/**
 * خروجی پیش‌فرض
 */
export default {
  createBlupalInvoice,
  getBlupalInvoice,
  simulateBlupalPayment,
};
