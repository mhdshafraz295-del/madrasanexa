/**
 * MadrasaNexa Phase 02 – Secure Crypto Utility for Student Scan Tokens
 *
 * Implements:
 * - Cryptographically secure random token generation: Canonical format `MNX1_<32 lowercase hex>` (37 ASCII chars)
 * - SHA-256 token hashing for fast indexed lookup
 * - AES-256-GCM authenticated encryption & decryption
 * - Timing-safe token hash verification
 * - Key validation and rotation support
 * - Token format validator helper
 *
 * Security Invariants:
 * - Zero secret leakage in logs, errors, or persistent storage.
 * - AES-256-GCM requires 32-byte (256-bit) keys and 12-byte (96-bit) random IVs.
 * - Integrity is verified via 16-byte (128-bit) GCM authentication tags.
 * - Raw tokens are never logged or stored in plaintext.
 */

import crypto from 'crypto';

export const GCM_IV_LENGTH_BYTES = 12;
export const GCM_AUTH_TAG_LENGTH_BYTES = 16;
export const TOKEN_ENTROPY_BYTES = 16;
export const DEFAULT_KEY_VERSION = 1;
export const DEFAULT_TOKEN_PREFIX = 'MNX1_';
export const TOKEN_TOTAL_LENGTH = 37;
export const TOKEN_FORMAT_REGEX = /^MNX1_[0-9a-f]{32}$/;

/**
 * Validates that an encryption key is a valid 64-character hexadecimal string (32 bytes).
 * Throws an explicit error without echoing the key content if invalid.
 *
 * @param {string} keyHex - Hexadecimal key string
 * @returns {boolean} True if valid
 */
export function validateEncryptionKey(keyHex) {
  if (!keyHex || typeof keyHex !== 'string') {
    throw new TypeError('Encryption key must be a non-empty string');
  }

  const trimmed = keyHex.trim();
  if (trimmed.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    throw new Error('Encryption key must be exactly 64 hexadecimal characters (32 bytes / 256 bits)');
  }

  return true;
}

/**
 * Converts a validated 64-character hex key into a 32-byte Buffer.
 *
 * @param {string} keyHex - Hexadecimal key string
 * @returns {Buffer} 32-byte binary key Buffer
 */
export function getKeyBuffer(keyHex) {
  validateEncryptionKey(keyHex);
  return Buffer.from(keyHex.trim(), 'hex');
}

/**
 * Generates a cryptographically secure random token in canonical format.
 * Canonical output: "MNX1_" + 32 lowercase hex characters (total exactly 37 ASCII characters, 128 bits entropy).
 *
 * @param {string} [prefix=DEFAULT_TOKEN_PREFIX] - Token namespace prefix
 * @returns {string} Canonical high-entropy raw token string (37 characters)
 */
export function generateRawToken(prefix = DEFAULT_TOKEN_PREFIX) {
  const safePrefix = (typeof prefix === 'string' && prefix.trim().length > 0)
    ? prefix.trim()
    : DEFAULT_TOKEN_PREFIX;

  const entropy = crypto.randomBytes(TOKEN_ENTROPY_BYTES).toString('hex').toLowerCase();
  const token = safePrefix.endsWith('_') ? `${safePrefix}${entropy}` : `${safePrefix}_${entropy}`;
  return token;
}

/**
 * Validates whether a given string strictly adheres to the approved 37-character token format.
 * Canonical specification: "MNX1_" + 32 lowercase hex characters.
 *
 * @param {string} rawToken - Plaintext raw token string
 * @returns {boolean} True if format strictly matches canonical specification
 */
export function isValidTokenFormat(rawToken) {
  if (!rawToken || typeof rawToken !== 'string') {
    return false;
  }
  return TOKEN_FORMAT_REGEX.test(rawToken.trim());
}

/**
 * Derives a non-sensitive operator display hint from a raw token (max 16 characters).
 * Example: "MNX1_0123456789abcdef0123456789abcdef" -> "MNX1...cdef" (9 chars, fits VARCHAR(16)).
 *
 * @param {string} rawToken - Raw token string
 * @returns {string} Truncated non-sensitive hint suitable for database VARCHAR(16)
 */
export function deriveTokenHint(rawToken) {
  if (!rawToken || typeof rawToken !== 'string') {
    throw new TypeError('Raw token must be a non-empty string');
  }

  const trimmed = rawToken.trim();
  const delimiterIndex = trimmed.indexOf('_') !== -1 ? trimmed.indexOf('_') : trimmed.indexOf('-');
  const prefix = delimiterIndex !== -1 ? trimmed.slice(0, delimiterIndex) : 'MNX1';
  const suffix = trimmed.slice(-4);

  return `${prefix}...${suffix}`;
}

/**
 * Computes deterministic SHA-256 hash of a raw token for indexed database lookup.
 *
 * @param {string} rawToken - Raw token string
 * @returns {string} 64-character lowercase hex hash
 */
export function hashToken(rawToken) {
  if (!rawToken || typeof rawToken !== 'string') {
    throw new TypeError('Raw token must be a non-empty string');
  }

  return crypto.createHash('sha256').update(rawToken.trim(), 'utf8').digest('hex');
}

/**
 * Verifies a raw token against an expected SHA-256 token hash using timing-safe comparison.
 *
 * @param {string} rawToken - Plaintext raw token
 * @param {string} expectedHashHex - Expected 64-character hex hash from database
 * @returns {boolean} True if rawToken matches expectedHashHex
 */
export function verifyTokenMatch(rawToken, expectedHashHex) {
  if (!rawToken || typeof rawToken !== 'string' || !expectedHashHex || typeof expectedHashHex !== 'string') {
    return false;
  }

  const computedHash = hashToken(rawToken);
  const computedBuffer = Buffer.from(computedHash, 'utf8');
  const expectedBuffer = Buffer.from(expectedHashHex.trim().toLowerCase(), 'utf8');

  if (computedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(computedBuffer, expectedBuffer);
}

/**
 * Encrypts a raw token string using AES-256-GCM.
 * Generates a fresh random 12-byte IV for each operation.
 *
 * @param {string} rawToken - Plaintext raw token to encrypt
 * @param {string} keyHex - 64-character hex encryption key (32 bytes)
 * @param {object} [options={}] - Optional encryption options
 * @param {number} [options.keyVersion=DEFAULT_KEY_VERSION] - Key version identifier
 * @returns {{ tokenEncrypted: string, tokenIv: string, tokenAuthTag: string, keyVersion: number }}
 */
export function encryptToken(rawToken, keyHex, options = {}) {
  if (!rawToken || typeof rawToken !== 'string') {
    throw new TypeError('Raw token must be a non-empty string');
  }

  const keyBuffer = getKeyBuffer(keyHex);
  const iv = crypto.randomBytes(GCM_IV_LENGTH_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);

  let ciphertextHex = cipher.update(rawToken.trim(), 'utf8', 'hex');
  ciphertextHex += cipher.final('hex');

  const authTagHex = cipher.getAuthTag().toString('hex');
  const keyVersion = typeof options.keyVersion === 'number' && options.keyVersion > 0
    ? options.keyVersion
    : DEFAULT_KEY_VERSION;

  return {
    tokenEncrypted: ciphertextHex,
    tokenIv: iv.toString('hex'),
    tokenAuthTag: authTagHex,
    keyVersion,
  };
}

/**
 * Decrypts an AES-256-GCM encrypted token.
 * Authenticates ciphertext and tag against the key and IV.
 * Throws a generic authentication error if ciphertext, IV, or AuthTag has been tampered with.
 *
 * @param {object} payload - Encrypted token record
 * @param {string} payload.tokenEncrypted - Hex ciphertext
 * @param {string} payload.tokenIv - Hex IV (24 characters = 12 bytes)
 * @param {string} payload.tokenAuthTag - Hex auth tag (32 characters = 16 bytes)
 * @param {string} keyHex - 64-character hex encryption key (32 bytes)
 * @returns {string} Decrypted plaintext raw token
 */
export function decryptToken(payload, keyHex) {
  if (!payload || typeof payload !== 'object') {
    throw new TypeError('Encrypted payload object is required');
  }

  const { tokenEncrypted, tokenIv, tokenAuthTag } = payload;

  if (!tokenEncrypted || typeof tokenEncrypted !== 'string') {
    throw new TypeError('Ciphertext (tokenEncrypted) must be a non-empty string');
  }
  if (!tokenIv || typeof tokenIv !== 'string' || !/^[0-9a-fA-F]{24}$/.test(tokenIv.trim())) {
    throw new Error('IV (tokenIv) must be a 24-character hexadecimal string (12 bytes)');
  }
  if (!tokenAuthTag || typeof tokenAuthTag !== 'string' || !/^[0-9a-fA-F]{32}$/.test(tokenAuthTag.trim())) {
    throw new Error('Auth tag (tokenAuthTag) must be a 32-character hexadecimal string (16 bytes)');
  }

  const keyBuffer = getKeyBuffer(keyHex);
  const ivBuffer = Buffer.from(tokenIv.trim(), 'hex');
  const authTagBuffer = Buffer.from(tokenAuthTag.trim(), 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, ivBuffer);
  decipher.setAuthTag(authTagBuffer);

  try {
    let decrypted = decipher.update(tokenEncrypted.trim(), 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    throw new Error('Failed to decrypt token: authentication failed or payload tampered.');
  }
}

/**
 * Rotates an encrypted token from an old key version to a new key version.
 * Decrypts with oldKeyHex and re-encrypts with newKeyHex, generating a fresh IV.
 *
 * @param {object} payload - Current encrypted token record
 * @param {string} oldKeyHex - Old 64-character hex key
 * @param {string} newKeyHex - New 64-character hex key
 * @param {number} newKeyVersion - New key version number
 * @returns {{ tokenEncrypted: string, tokenIv: string, tokenAuthTag: string, keyVersion: number }}
 */
export function rotateTokenEncryption(payload, oldKeyHex, newKeyHex, newKeyVersion) {
  if (typeof newKeyVersion !== 'number' || newKeyVersion <= 0) {
    throw new TypeError('New key version must be a positive integer');
  }

  const plaintext = decryptToken(payload, oldKeyHex);
  return encryptToken(plaintext, newKeyHex, { keyVersion: newKeyVersion });
}
