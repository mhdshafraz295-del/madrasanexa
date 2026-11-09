import './setup-test-env.js';
import http from 'http';
import express from 'express';
import morgan from 'morgan';
import app from '../src/app.js';
import { sanitizeLogUrl, isSensitiveQueryParam } from '../src/utils/log-sanitizer.js';

let passedCount = 0;
let failedCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ [PASS] ${message}`);
    passedCount++;
  } else {
    console.error(`  ✗ [FAIL] ${message}`);
    failedCount++;
  }
}

async function runUnitTests() {
  console.log('\n[UNIT TESTS] URL Query Sanitizer Functionality');

  // 1. isSensitiveQueryParam validation
  assert(isSensitiveQueryParam('token') === true, 'Identifies "token" as sensitive');
  assert(isSensitiveQueryParam('access_token') === true, 'Identifies "access_token" as sensitive');
  assert(isSensitiveQueryParam('accessToken') === true, 'Identifies "accessToken" as sensitive');
  assert(isSensitiveQueryParam('refresh_token') === true, 'Identifies "refresh_token" as sensitive');
  assert(isSensitiveQueryParam('refreshToken') === true, 'Identifies "refreshToken" as sensitive');
  assert(isSensitiveQueryParam('setup_token') === true, 'Identifies "setup_token" as sensitive');
  assert(isSensitiveQueryParam('setupToken') === true, 'Identifies "setupToken" as sensitive');
  assert(isSensitiveQueryParam('password') === true, 'Identifies "password" as sensitive');
  assert(isSensitiveQueryParam('secret') === true, 'Identifies "secret" as sensitive');
  assert(isSensitiveQueryParam('api_key') === true, 'Identifies "api_key" as sensitive');
  assert(isSensitiveQueryParam('apiKey') === true, 'Identifies "apiKey" as sensitive');

  // Non-sensitive params must NOT be flagged
  assert(isSensitiveQueryParam('search') === false, '"search" is not sensitive');
  assert(isSensitiveQueryParam('page') === false, '"page" is not sensitive');
  assert(isSensitiveQueryParam('limit') === false, '"limit" is not sensitive');
  assert(isSensitiveQueryParam('status') === false, '"status" is not sensitive');
  assert(isSensitiveQueryParam('district') === false, '"district" is not sensitive');
  assert(isSensitiveQueryParam('code') === false, '"code" is not sensitive');
  assert(isSensitiveQueryParam('madrasaCode') === false, '"madrasaCode" is not sensitive');
  assert(isSensitiveQueryParam('planId') === false, '"planId" is not sensitive');

  // 2. sanitizeLogUrl unit tests
  const rawSecret = '0112711c09c3ac5f408d8b596ec7ebceaad98a198f249ad0341e6ea5c8e104f2';
  const setupUrl = `/api/auth/setup-password/verify?token=${rawSecret}`;
  const sanitizedSetup = sanitizeLogUrl(setupUrl);
  assert(!sanitizedSetup.includes(rawSecret), 'Sanitized setup URL does NOT contain raw secret');
  assert(sanitizedSetup === '/api/auth/setup-password/verify?token=[REDACTED]', 'Sanitized setup URL replaces token with [REDACTED]');

  const mixedUrl = `/api/test?access_token=secret_jwt_123&search=Al-Huda&refresh_token=secret_refresh_456&page=2&limit=10`;
  const sanitizedMixed = sanitizeLogUrl(mixedUrl);
  assert(!sanitizedMixed.includes('secret_jwt_123'), 'Sanitized mixed URL does not contain access_token secret');
  assert(!sanitizedMixed.includes('secret_refresh_456'), 'Sanitized mixed URL does not contain refresh_token secret');
  assert(sanitizedMixed.includes('search=Al-Huda'), 'Sanitized mixed URL preserves non-sensitive search parameter');
  assert(sanitizedMixed.includes('page=2'), 'Sanitized mixed URL preserves non-sensitive page parameter');
  assert(sanitizedMixed.includes('limit=10'), 'Sanitized mixed URL preserves non-sensitive limit parameter');

  const noQueryUrl = '/api/health';
  assert(sanitizeLogUrl(noQueryUrl) === '/api/health', 'URL without query parameters remains untouched');

  const nonSensitiveOnly = '/api/super-admin/onboarding?search=Kandy&page=1&status=APPROVED';
  assert(sanitizeLogUrl(nonSensitiveOnly) === nonSensitiveOnly, 'URL with only non-sensitive query parameters remains untouched');

  const withHash = `/api/setup?setupToken=xyz123#step2`;
  assert(sanitizeLogUrl(withHash) === '/api/setup?setupToken=[REDACTED]#step2', 'Hash fragment preserved after query redaction');
}

async function runIntegrationTests() {
  console.log('\n[INTEGRATION TESTS] Morgan Combined Request Logging & Sanitization');

  // Create an instrumentation server wrapping our app with a captured stream
  const capturedLogs = [];
  const testLoggerApp = express();

  // Custom Morgan logger capturing log lines directly using the same sanitized tokens
  testLoggerApp.use(
    morgan('combined', {
      stream: {
        write: (line) => {
          capturedLogs.push(line.trim());
        },
      },
    })
  );

  // Mount the main application routes onto testLoggerApp
  testLoggerApp.use(app);

  let testServer = null;
  let testPort = 0;

  await new Promise((resolve) => {
    testServer = testLoggerApp.listen(0, () => {
      testPort = testServer.address().port;
      resolve();
    });
  });

  try {
    const baseUrl = `http://127.0.0.1:${testPort}`;

    // Test 1: Setup Password Verification with sensitive token
    console.log('  Testing request with sensitive setup token in query...');
    const sensitiveSetupToken = '9999_raw_sensitive_setup_token_abcdef_012345';
    await fetch(`${baseUrl}/api/auth/setup-password/verify?token=${sensitiveSetupToken}`);

    const setupLogLine = capturedLogs.find((l) => l.includes('/api/auth/setup-password/verify'));
    assert(setupLogLine !== undefined, 'Request was logged by Morgan');
    assert(!setupLogLine.includes(sensitiveSetupToken), 'Sensitive setup token NEVER appears in captured log line');
    assert(setupLogLine.includes('token=[REDACTED]'), 'Setup token parameter is logged as token=[REDACTED]');
    assert(setupLogLine.includes('GET'), 'Morgan log line contains HTTP method GET');
    assert(setupLogLine.includes('HTTP/1.1'), 'Morgan log line contains HTTP version');

    // Test 2: Request with mixed sensitive & non-sensitive parameters
    console.log('  Testing request with mixed sensitive and non-sensitive query parameters...');
    const sensitiveAccessToken = 'bearer_access_token_xyz_88888';
    const sensitiveRefreshToken = 'refresh_token_secret_77777';
    await fetch(
      `${baseUrl}/api/health?access_token=${sensitiveAccessToken}&district=Galle&refresh_token=${sensitiveRefreshToken}&page=3`
    );

    const healthLogLine = capturedLogs.find((l) => l.includes('district=Galle'));
    assert(healthLogLine !== undefined, 'Request with non-sensitive parameters was logged');
    assert(!healthLogLine.includes(sensitiveAccessToken), 'Access token secret NEVER appears in log line');
    assert(!healthLogLine.includes(sensitiveRefreshToken), 'Refresh token secret NEVER appears in log line');
    assert(healthLogLine.includes('access_token=[REDACTED]'), 'access_token redacted in log');
    assert(healthLogLine.includes('refresh_token=[REDACTED]'), 'refresh_token redacted in log');
    assert(healthLogLine.includes('district=Galle'), 'Non-sensitive parameter district=Galle is preserved in log');
    assert(healthLogLine.includes('page=3'), 'Non-sensitive parameter page=3 is preserved in log');

    // Test 3: Normal request logging works without alteration
    console.log('  Testing normal request without query parameters...');
    await fetch(`${baseUrl}/api/health`);
    const plainHealthLog = capturedLogs.find((l) => l.includes('"GET /api/health HTTP/1.1"'));
    assert(plainHealthLog !== undefined, 'Normal request logged with standard Morgan combined format');
    assert(plainHealthLog.includes('200'), 'Status code 200 recorded in log');

    // Test 4: Verify request bodies and credentials are not logged
    console.log('  Testing POST request body credential isolation...');
    const rawPasswordInBody = 'SuperSecretBodyPassword999!';
    await fetch(`${baseUrl}/api/auth/setup-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: 'invalid_token_test',
        password: rawPasswordInBody,
      }),
    });

    const postLogLine = capturedLogs.find((l) => l.includes('"POST /api/auth/setup-password HTTP/1.1"'));
    assert(postLogLine !== undefined, 'POST request was logged');
    assert(!postLogLine.includes(rawPasswordInBody), 'Request body password is NEVER logged');

    // Test 5: Referer header sanitization
    console.log('  Testing Referer header query token sanitization...');
    const sensitiveInReferer = 'token_in_referer_header_secret_44444';
    await fetch(`${baseUrl}/api/health`, {
      headers: {
        Referer: `http://localhost:5173/setup-password?token=${sensitiveInReferer}&refPage=onboarding`,
      },
    });

    const refererLogLine = capturedLogs.find((l) => l.includes('refPage=onboarding'));
    assert(refererLogLine !== undefined, 'Request with Referer was logged');
    assert(!refererLogLine.includes(sensitiveInReferer), 'Sensitive token in Referer header is NEVER logged');
    assert(refererLogLine.includes('token=[REDACTED]'), 'Referer token parameter is redacted in log');
  } finally {
    if (testServer) {
      await new Promise((resolve) => testServer.close(resolve));
    }
  }
}

async function main() {
  console.log('======================================================');
  console.log(' REQUEST LOGGING QUERY-TOKEN SANITIZATION TESTS');
  console.log('======================================================');

  try {
    await runUnitTests();
    await runIntegrationTests();
  } catch (err) {
    console.error('Fatal test error:', err);
    failedCount++;
  }

  console.log('\n======================================================');
  console.log(`Log Sanitization Test Summary: ${passedCount} Passed, ${failedCount} Failed`);
  console.log('======================================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

main();
