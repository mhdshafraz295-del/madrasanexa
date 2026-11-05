/**
 * MadrasaNexa SMS Delivery Service
 * Provides SMS sending capabilities with test adapter and mock support.
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
 * @returns {boolean}
 */
export function isSmsConfigured() {
  if (process.env.NODE_ENV === 'test' || process.env.MOCK_SMS === 'true') {
    return true;
  }
  return Boolean(process.env.SMS_API_KEY && process.env.SMS_API_KEY.trim() !== '');
}

/**
 * Normalizes a phone number for SMS delivery.
 * @param {string} phone
 * @returns {string}
 */
export function normalizePhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') return '';
  return phone.replace(/[^0-9+]/g, '').trim();
}

/**
 * Masks a phone number for sanitized audit logs (e.g. +94 77 *** 1234).
 * @param {string} phone
 * @returns {string}
 */
export function maskPhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') return 'N/A';
  const clean = phone.trim();
  if (clean.length <= 4) return '***';
  const start = clean.slice(0, Math.min(6, Math.floor(clean.length / 2)));
  const end = clean.slice(-3);
  return `${start} *** ${end}`;
}

/**
 * Dispatches an SMS message.
 *
 * @param {object} params
 * @param {string} params.to
 * @param {string} params.message
 * @param {string} [params.madrasaId]
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
 */
export async function sendSms({ to, message, madrasaId }) {
  const normalizedTo = normalizePhoneNumber(to);
  if (!normalizedTo) {
    throw new Error('RECIPIENT_PHONE_REQUIRED');
  }

  if (!isSmsConfigured()) {
    throw new Error('SMS_PROVIDER_NOT_CONFIGURED');
  }

  // In test environment or mock mode, record delivery safely
  if (process.env.NODE_ENV === 'test' || process.env.MOCK_SMS === 'true' || !process.env.SMS_API_KEY) {
    const mockMessageId = `mock_sms_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const record = {
      messageId: mockMessageId,
      to: normalizedTo,
      message,
      madrasaId,
      sentAt: new Date(),
    };
    sentSmsMessages.push(record);
    return {
      success: true,
      messageId: mockMessageId,
    };
  }

  // Real provider integration (e.g. Dialog / Mobitel / Twilio HTTP gateway)
  try {
    // Standard gateway call placeholder
    const response = await fetch(process.env.SMS_GATEWAY_URL || 'https://api.sms-provider.com/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.SMS_API_KEY}`,
      },
      body: JSON.stringify({
        sender: process.env.SMS_SENDER_ID || 'MadrasaNexa',
        recipient: normalizedTo,
        content: message,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`SMS Provider error: HTTP ${response.status} - ${errBody.slice(0, 100)}`);
    }

    const data = await response.json();
    return {
      success: true,
      messageId: data.messageId || `provider_${Date.now()}`,
    };
  } catch (err) {
    throw new Error(`SMS delivery failed: ${err.message}`);
  }
}
