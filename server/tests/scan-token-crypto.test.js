/**
 * MadrasaNexa Phase 02 – Isolated Unit Tests for Secure Crypto Utility
 *
 * Scope: Gate E, Step 1 & 2 Canonical Token Format Verification.
 * - Enforces canonical 37-character format: `MNX1_<32 lowercase hex characters>`.
 * - Zero database access or dependency.
 * - Zero fake database records.
 * - Strict verification of AES-256-GCM, SHA-256 hashing, IV uniqueness, tamper resistance, and key rotation.
 */

import crypto from 'crypto';
import {
  validateEncryptionKey,
  getKeyBuffer,
  generateRawToken,
  isValidTokenFormat,
  deriveTokenHint,
  hashToken,
  verifyTokenMatch,
  encryptToken,
  decryptToken,
  rotateTokenEncryption,
  GCM_IV_LENGTH_BYTES,
  GCM_AUTH_TAG_LENGTH_BYTES,
  TOKEN_ENTROPY_BYTES,
  TOKEN_TOTAL_LENGTH,
  TOKEN_FORMAT_REGEX,
} from '../src/utils/scan-token-crypto.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  ✗ [FAIL] ${message}`);
    failed++;
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertThrows(fn, expectedPattern, message) {
  let threw = false;
  try {
    fn();
  } catch (err) {
    threw = true;
    if (expectedPattern && !expectedPattern.test(err.message)) {
      throw new Error(`Expected error matching ${expectedPattern}, but got: "${err.message}"`);
    }
  }
  assert(threw, message);
}

// Synthetic test keys for isolated testing (never used in production)
const TEST_KEY_HEX_1 = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const TEST_KEY_HEX_2 = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';
const INVALID_SHORT_KEY = '0123456789abcdef0123456789abcdef';
const INVALID_NON_HEX_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdeg';

async function runAllTests() {
  console.log('================================================================');
  console.log('  MadrasaNexa Gate E: Canonical 37-Char Crypto Unit Tests       ');
  console.log('================================================================\n');

  // --- Suite 1: Key Validation & Buffer Conversion ---
  console.log('--- Suite 1: Encryption Key Validation ---');
  {
    assert(validateEncryptionKey(TEST_KEY_HEX_1) === true, 'Accepts valid 64-character hex key');
    assert(validateEncryptionKey(TEST_KEY_HEX_2) === true, 'Accepts secondary valid 64-character hex key');

    assertThrows(() => validateEncryptionKey(INVALID_SHORT_KEY), /64 hexadecimal characters/, 'Rejects short key');
    assertThrows(() => validateEncryptionKey(INVALID_SHORT_KEY + '00'), /64 hexadecimal characters/, 'Rejects 34-character key');
    assertThrows(() => validateEncryptionKey(INVALID_NON_HEX_KEY), /64 hexadecimal characters/, 'Rejects non-hex characters');
    assertThrows(() => validateEncryptionKey(''), /non-empty string/, 'Rejects empty string');
    assertThrows(() => validateEncryptionKey(null), /non-empty string/, 'Rejects null key');
    assertThrows(() => validateEncryptionKey(12345), /non-empty string/, 'Rejects non-string key');

    const keyBuf = getKeyBuffer(TEST_KEY_HEX_1);
    assert(Buffer.isBuffer(keyBuf), 'getKeyBuffer returns a Node.js Buffer');
    assert(keyBuf.length === 32, 'Key buffer is exactly 32 bytes (256 bits)');
  }

  // --- Suite 2: Canonical 37-Character Token Generation & Format Validation ---
  console.log('\n--- Suite 2: Canonical 37-Char Token Generation & Format Validation ---');
  {
    const token1 = generateRawToken();
    assert(typeof token1 === 'string', 'Generated token is a string');
    assert(token1.startsWith('MNX1_'), 'Default token begins with canonical "MNX1_" prefix');
    assert(token1.length === 37, `Token length is exactly 37 ASCII chars (5 prefix + 32 lowercase hex)`);
    assert(token1.length === TOKEN_TOTAL_LENGTH, 'Token length matches TOKEN_TOTAL_LENGTH constant');
    assert(TOKEN_FORMAT_REGEX.test(token1), 'Token matches canonical regex /^MNX1_[0-9a-f]{32}$/');
    assert(isValidTokenFormat(token1) === true, 'isValidTokenFormat returns true for generated token');

    // Format validator edge cases
    assert(isValidTokenFormat('MNX1_0123456789abcdef0123456789abcdef') === true, 'Valid canonical 37-char token passes validator');
    assert(isValidTokenFormat('MNX-0123456789abcdef0123456789abcdef') === false, 'Old 36-char hyphenated format is rejected');
    assert(isValidTokenFormat('MNX1_0123456789ABCDEF0123456789ABCDEF') === false, 'Uppercase hex characters are rejected');
    assert(isValidTokenFormat('MNX1_0123456789abcdef') === false, 'Truncated token is rejected');
    assert(isValidTokenFormat('MNX2_0123456789abcdef0123456789abcdef') === false, 'Non-V1 prefix is rejected');
    assert(isValidTokenFormat('') === false, 'Empty string is rejected');
    assert(isValidTokenFormat(null) === false, 'Null token is rejected');

    const hint1 = deriveTokenHint(token1);
    assert(hint1.startsWith('MNX1...'), 'Hint starts with "MNX1..." prefix');
    assert(hint1.endsWith(token1.slice(-4)), 'Hint exposes only the last 4 characters');
    assert(hint1.length === 11, `Hint length (${hint1.length}) is exactly 11 characters ('MNX1...' + 4 chars)`);
    assert(hint1.length <= 16, `Hint length conforms to database VARCHAR(16)`);

    // Entropy & collision check: generate 5,000 tokens
    const sampleSize = 5000;
    const tokenSet = new Set();
    for (let i = 0; i < sampleSize; i++) {
      const t = generateRawToken();
      if (!isValidTokenFormat(t)) {
        throw new Error(`Generated token at index ${i} failed format validation: ${t}`);
      }
      tokenSet.add(t);
    }
    assert(tokenSet.size === sampleSize, `Zero collisions detected across ${sampleSize} generated tokens (all verified canonical)`);
  }

  // --- Suite 3: SHA-256 Hashing & Timing-Safe Verification ---
  console.log('\n--- Suite 3: SHA-256 Hashing & Timing-Safe Verification ---');
  {
    const rawToken = 'MNX1_4f6b2e1a8d9c0e3f5a7b9c1d3e5f7a9b';
    assert(isValidTokenFormat(rawToken), 'Synthetic test token conforms to 37-char canonical format');

    const hash1 = hashToken(rawToken);
    const hash2 = hashToken(rawToken);

    assert(hash1 === hash2, 'hashToken is deterministic');
    assert(hash1.length === 64, 'SHA-256 digest is exactly 64 hexadecimal characters');
    assert(/^[0-9a-f]{64}$/.test(hash1), 'Digest contains only lowercase hex characters');

    const differentToken = 'MNX1_4f6b2e1a8d9c0e3f5a7b9c1d3e5f7a9c';
    const hashDiff = hashToken(differentToken);
    assert(hash1 !== hashDiff, 'Distinct tokens yield distinct SHA-256 hashes');

    // Timing-safe verification
    assert(verifyTokenMatch(rawToken, hash1) === true, 'verifyTokenMatch returns true for matching token');
    assert(verifyTokenMatch(differentToken, hash1) === false, 'verifyTokenMatch returns false for mismatched token');
    assert(verifyTokenMatch(rawToken, 'invalid-hash') === false, 'verifyTokenMatch returns false for invalid hash string');
    assert(verifyTokenMatch(null, hash1) === false, 'verifyTokenMatch handles null safely');
  }

  // --- Suite 4: AES-256-GCM Encryption & Decryption Roundtrip ---
  console.log('\n--- Suite 4: AES-256-GCM Authenticated Encryption & Decryption ---');
  {
    const rawToken = generateRawToken();
    const encrypted = encryptToken(rawToken, TEST_KEY_HEX_1, { keyVersion: 1 });

    assert(typeof encrypted.tokenEncrypted === 'string', 'Ciphertext is a string');
    assert(encrypted.tokenEncrypted.length > 0, 'Ciphertext is non-empty');
    assert(encrypted.tokenIv.length === GCM_IV_LENGTH_BYTES * 2, `IV is ${GCM_IV_LENGTH_BYTES * 2} hex chars (12 bytes)`);
    assert(encrypted.tokenAuthTag.length === GCM_AUTH_TAG_LENGTH_BYTES * 2, `AuthTag is ${GCM_AUTH_TAG_LENGTH_BYTES * 2} hex chars (16 bytes)`);
    assert(encrypted.keyVersion === 1, 'Key version is recorded correctly');

    // Decrypt
    const decrypted = decryptToken(encrypted, TEST_KEY_HEX_1);
    assert(decrypted === rawToken, 'Decrypted token matches original raw token byte-for-byte');
    assert(isValidTokenFormat(decrypted) === true, 'Decrypted token preserves canonical 37-char format');
  }

  // --- Suite 5: IV Uniqueness & Ciphertext Indistinguishability ---
  console.log('\n--- Suite 5: Initialization Vector (IV) Uniqueness ---');
  {
    const rawToken = 'MNX1_0123456789abcdef0123456789abcdef';
    const enc1 = encryptToken(rawToken, TEST_KEY_HEX_1);
    const enc2 = encryptToken(rawToken, TEST_KEY_HEX_1);

    assert(enc1.tokenIv !== enc2.tokenIv, 'Two encryptions generate distinct random IVs');
    assert(enc1.tokenEncrypted !== enc2.tokenEncrypted, 'Identical plaintexts produce distinct ciphertexts under distinct IVs');
    assert(enc1.tokenAuthTag !== enc2.tokenAuthTag, 'Identical plaintexts produce distinct GCM authentication tags');

    // Both decrypt to the same original plaintext
    assert(decryptToken(enc1, TEST_KEY_HEX_1) === rawToken, 'First encryption decrypts correctly');
    assert(decryptToken(enc2, TEST_KEY_HEX_1) === rawToken, 'Second encryption decrypts correctly');
  }

  // --- Suite 6: Tamper Protection & GCM Authentication Failure ---
  console.log('\n--- Suite 6: Authenticated Decryption Tamper Protection ---');
  {
    const rawToken = generateRawToken();
    const original = encryptToken(rawToken, TEST_KEY_HEX_1);

    // 1. Tamper with ciphertext (flip one hex character)
    const tamperedCiphertext = original.tokenEncrypted.slice(0, -1) + (original.tokenEncrypted.endsWith('a') ? 'b' : 'a');
    assertThrows(
      () => decryptToken({ ...original, tokenEncrypted: tamperedCiphertext }, TEST_KEY_HEX_1),
      /authentication failed or payload tampered/,
      'Tampered ciphertext fails authentication'
    );

    // 2. Tamper with IV (flip one character)
    const tamperedIv = original.tokenIv.slice(0, -1) + (original.tokenIv.endsWith('0') ? '1' : '0');
    assertThrows(
      () => decryptToken({ ...original, tokenIv: tamperedIv }, TEST_KEY_HEX_1),
      /authentication failed or payload tampered/,
      'Tampered IV fails authentication'
    );

    // 3. Tamper with Auth Tag (flip one character)
    const tamperedTag = original.tokenAuthTag.slice(0, -1) + (original.tokenAuthTag.endsWith('c') ? 'd' : 'c');
    assertThrows(
      () => decryptToken({ ...original, tokenAuthTag: tamperedTag }, TEST_KEY_HEX_1),
      /authentication failed or payload tampered/,
      'Tampered AuthTag fails authentication'
    );

    // 4. Decrypt with wrong key
    assertThrows(
      () => decryptToken(original, TEST_KEY_HEX_2),
      /authentication failed or payload tampered/,
      'Decryption with incorrect key fails authentication'
    );
  }

  // --- Suite 7: Key Rotation Workflow ---
  console.log('\n--- Suite 7: Key Rotation Workflow ---');
  {
    const rawToken = generateRawToken();
    const encryptedV1 = encryptToken(rawToken, TEST_KEY_HEX_1, { keyVersion: 1 });

    // Rotate from Key 1 to Key 2 (Version 2)
    const encryptedV2 = rotateTokenEncryption(encryptedV1, TEST_KEY_HEX_1, TEST_KEY_HEX_2, 2);

    assert(encryptedV2.keyVersion === 2, 'Rotated payload has keyVersion = 2');
    assert(encryptedV2.tokenIv !== encryptedV1.tokenIv, 'Rotated payload has a new, fresh IV');
    assert(encryptedV2.tokenEncrypted !== encryptedV1.tokenEncrypted, 'Rotated payload has new ciphertext');

    // Decrypting rotated payload with old key MUST fail
    assertThrows(
      () => decryptToken(encryptedV2, TEST_KEY_HEX_1),
      /authentication failed or payload tampered/,
      'Rotated token cannot be decrypted with retired Key V1'
    );

    // Decrypting rotated payload with new key MUST succeed
    const decryptedV2 = decryptToken(encryptedV2, TEST_KEY_HEX_2);
    assert(decryptedV2 === rawToken, 'Rotated token decrypts successfully with Key V2');
    assert(isValidTokenFormat(decryptedV2) === true, 'Rotated decrypted token preserves canonical 37-char format');
  }

  console.log('\n================================================================');
  console.log(`  All Test Suites Completed: ${passed} PASSED, ${failed} FAILED  `);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
