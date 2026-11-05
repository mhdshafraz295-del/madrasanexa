import bcrypt from 'bcryptjs';

const BCRYPT_SALT_ROUNDS = 12;

/**
 * Validates password against platform security policy:
 * - At least 10 characters
 * - Contains at least one letter (a-z or A-Z)
 * - Contains at least one number (0-9) or symbol
 *
 * @param {string} password
 * @returns {{ valid: boolean, message?: string }}
 */
export const validatePasswordStrength = (password) => {
  if (!password || typeof password !== 'string') {
    return { valid: false, message: 'Password is required' };
  }

  if (password.length < 10) {
    return { valid: false, message: 'Password must be at least 10 characters long' };
  }

  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumberOrSymbol = /[\d!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);

  if (!hasLetter || !hasNumberOrSymbol) {
    return {
      valid: false,
      message: 'Password must contain at least one letter and at least one number or symbol',
    };
  }

  return { valid: true };
};

/**
 * Hashes a plaintext password using bcrypt with cost factor 12.
 *
 * @param {string} password
 * @returns {Promise<string>}
 */
export const hashPassword = async (password) => {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string');
  }
  return await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
};

/**
 * Compares a plaintext password against a stored bcrypt hash.
 *
 * @param {string} password
 * @param {string} passwordHash
 * @returns {Promise<boolean>}
 */
export const comparePassword = async (password, passwordHash) => {
  if (!password || !passwordHash) {
    return false;
  }
  return await bcrypt.compare(password, passwordHash);
};
