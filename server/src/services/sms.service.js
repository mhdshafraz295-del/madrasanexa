/**
 * MadrasaNexa SMS Delivery Service
 * Integrates with Text.lk REST API v3 for Sri Lankan mobile SMS alerts.
 * Provides resilient non-blocking dispatch, mock verification for testing, and strict error guards.
 */

// In-memory array for test inspection and verification
export const sentSmsMessages = [];

export function clearSentSmsMessages() {
  sentSmsMessages.length = 0;
}

export function getSentSmsMessages() {
  return [...sentSmsMessages];
}

/**
 * Checks if production SMS provider credentials are configured.
 * Checks TEXTLK_API_TOKEN or legacy SMS_API_KEY.
 * @returns {boolean}
 */
export function isSmsConfigured() {
  if (process.env.NODE_ENV === 'test' || process.env.MOCK_SMS === 'true') {
    return true;
  }
  const token = process.env.TEXTLK_API_TOKEN || process.env.SMS_API_KEY;
  return Boolean(token && token.trim() !== '');
}

/**
 * Normalizes a phone number for Sri Lankan SMS delivery.
 * Strips whitespace, hyphens, brackets, and international plus sign.
 * Converts:
 *  - 07XXXXXXXX (10 digits starting with 0) -> 947XXXXXXXX
 *  - +947XXXXXXXX or 00947XXXXXXXX -> 947XXXXXXXX
 *  - 7XXXXXXXX (9 digits starting with 7) -> 947XXXXXXXX
 * Returns '947XXXXXXXX' (or valid international E.164 without '+') if valid, or null if invalid/empty.
 *
 * @param {string} phone
 * @returns {string|null}
 */
export function normalizePhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') return null;
  const digits = phone.replace(/[^0-9]/g, '');
  if (!digits) return null;

  let cleaned = digits;
  if (cleaned.startsWith('0094')) {
    cleaned = cleaned.slice(2);
  }
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    cleaned = '94' + cleaned.slice(1);
  } else if (cleaned.length === 9 && cleaned.startsWith('7')) {
    cleaned = '94' + cleaned;
  }

  // Strict Sri Lankan mobile check: 947 followed by 8 digits (total 11 digits)
  if (/^947\d{8}$/.test(cleaned)) {
    return cleaned;
  }

  // Generic valid international number (10 to 15 digits)
  if (/^\d{10,15}$/.test(cleaned)) {
    return cleaned;
  }

  return null;
}

/**
 * Masks a phone number for sanitized audit logs (e.g. 9477***1234).
 * @param {string} phone
 * @returns {string}
 */
export function maskPhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') return 'N/A';
  const clean = phone.trim();
  if (clean.length <= 4) return '***';
  const start = clean.slice(0, Math.min(4, Math.floor(clean.length / 2)));
  const end = clean.slice(-3);
  return `${start}***${end}`;
}

/**
 * Dispatches an SMS message using the Text.lk REST API v3.
 *
 * @param {object} params
 * @param {string} params.to - Recipient phone number (normalized automatically)
 * @param {string} params.message - Plain-text message content
 * @param {string} [params.madrasaId] - Optional tenant identifier for multi-tenant tracing
 * @returns {Promise<{ success?: boolean, skipped?: boolean, messageId?: string, error?: string, reason?: string, data?: any }>}
 */
export async function sendSms({ to, message, madrasaId = null }) {
  const normalizedPhone = normalizePhoneNumber(to);
  if (!normalizedPhone) {
    console.warn(`[SmsService] Skipping SMS dispatch: Invalid or missing phone number (${to ?? 'empty'}).`);
    return { skipped: true, reason: 'INVALID_PHONE_NUMBER' };
  }

  if (!message || typeof message !== 'string' || message.trim() === '') {
    console.warn('[SmsService] Skipping SMS dispatch: Message content is empty.');
    return { skipped: true, reason: 'EMPTY_MESSAGE' };
  }

  // Test or mock environment: record delivery safely without calling external gateway
  if (process.env.NODE_ENV === 'test' || process.env.MOCK_SMS === 'true') {
    const mockMessageId = `mock_sms_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const record = {
      messageId: mockMessageId,
      to: normalizedPhone,
      message,
      madrasaId,
      sentAt: new Date(),
    };
    sentSmsMessages.push(record);
    console.log(`[SmsService] [MOCK] SMS recorded to ${maskPhoneNumber(normalizedPhone)} (ID: ${mockMessageId})`);
    return {
      success: true,
      messageId: mockMessageId,
    };
  }

  const apiToken = (process.env.TEXTLK_API_TOKEN || process.env.SMS_API_KEY || '').trim();
  if (!apiToken) {
    console.warn('[SmsService] Skipping SMS dispatch: TEXTLK_API_TOKEN is not configured.');
    return { skipped: true, reason: 'TEXTLK_API_TOKEN_MISSING' };
  }

  const senderId = process.env.TEXTLK_SENDER_ID || process.env.SMS_SENDER_ID || 'TextLKDemo';
  const apiUrl = process.env.TEXTLK_API_URL || 'https://app.text.lk/api/v3/sms/send';

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        recipient: normalizedPhone,
        sender_id: senderId,
        type: 'plain',
        message: message.trim(),
      }),
      signal: AbortSignal.timeout(8000),
    });

    const responseText = await response.text();
    let responseData = null;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    if (!response.ok) {
      const errorMsg = `Text.lk HTTP ${response.status}: ${responseText.slice(0, 150)}`;
      console.error(
        `[SmsService] Text.lk SMS error: HTTP ${response.status} to ${maskPhoneNumber(normalizedPhone)}:`,
        responseText.slice(0, 200)
      );
      return {
        success: false,
        error: errorMsg,
      };
    }

    const messageId =
      responseData?.data?.uid ||
      responseData?.uid ||
      responseData?.message_id ||
      `textlk_${Date.now()}`;

    console.log(`[SmsService] SMS dispatched successfully to ${maskPhoneNumber(normalizedPhone)} (ID: ${messageId})`);
    return {
      success: true,
      messageId,
      data: responseData,
    };
  } catch (err) {
    const isTimeout = err?.name === 'TimeoutError' || err?.code === 23;
    const errorMsg = isTimeout ? 'Text.lk request timed out after 8000ms' : (err?.message || 'Network error');
    console.error(`[SmsService] SMS delivery failed to ${maskPhoneNumber(normalizedPhone)}: ${errorMsg}`);
    return {
      success: false,
      error: errorMsg,
    };
  }
}
