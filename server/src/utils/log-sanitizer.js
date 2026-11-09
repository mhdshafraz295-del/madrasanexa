/**
 * Log Sanitizer Utility for MadrasaNexa Request Logging
 *
 * Prevents sensitive tokens, credentials, and secrets in URL query parameters
 * from leaking into server access logs (Morgan, STDOUT, reverse proxies, APM).
 */

const SENSITIVE_QUERY_PATTERNS = [
  /^token$/i,
  /^access_?token$/i,
  /^refresh_?token$/i,
  /^setup_?token$/i,
  /^password_?token$/i,
  /^reset_?token$/i,
  /^verification_?token$/i,
  /^auth_?token$/i,
  /^id_?token$/i,
  /^secret$/i,
  /^api_?key$/i,
  /^password$/i,
  /token$/i,
];

/**
 * Checks whether a given query parameter key represents sensitive authentication/secret data.
 *
 * @param {string} key Query parameter name
 * @returns {boolean} True if parameter is sensitive and must be redacted
 */
export function isSensitiveQueryParam(key) {
  if (!key || typeof key !== 'string') return false;
  const normalized = key.trim().toLowerCase();
  return SENSITIVE_QUERY_PATTERNS.some((pattern) => pattern.test(normalized));
}

/**
 * Redacts sensitive query parameters in a request URL while preserving:
 * - The original path and non-sensitive query parameters (e.g. search, page, limit, status, district)
 * - Hash fragments
 * - Exact non-sensitive values
 *
 * Example:
 * /api/auth/setup-password/verify?token=abc12345&page=1
 * -> /api/auth/setup-password/verify?token=[REDACTED]&page=1
 *
 * @param {string} rawUrl The incoming request URL
 * @returns {string} Sanitized URL safe for server logging
 */
export function sanitizeLogUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return rawUrl || '';

  const qIndex = rawUrl.indexOf('?');
  if (qIndex === -1) return rawUrl;

  const pathname = rawUrl.slice(0, qIndex);
  const search = rawUrl.slice(qIndex + 1);
  if (!search) return rawUrl;

  const hashIndex = search.indexOf('#');
  const queryPart = hashIndex !== -1 ? search.slice(0, hashIndex) : search;
  const hashPart = hashIndex !== -1 ? search.slice(hashIndex) : '';

  const pairs = queryPart.split('&');
  let modified = false;

  const sanitizedPairs = pairs.map((pair) => {
    if (!pair) return pair;
    const eqIndex = pair.indexOf('=');
    const rawKey = eqIndex !== -1 ? pair.slice(0, eqIndex) : pair;
    let key = rawKey;
    try {
      key = decodeURIComponent(rawKey).trim();
    } catch (_) {
      key = rawKey.trim();
    }

    if (isSensitiveQueryParam(key)) {
      modified = true;
      return `${rawKey}=[REDACTED]`;
    }
    return pair;
  });

  if (!modified) return rawUrl;

  return `${pathname}?${sanitizedPairs.join('&')}${hashPart}`;
}
