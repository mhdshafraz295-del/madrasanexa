import './setup-test-env.js';
import assert from 'assert';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { resolveTrustProxySetting } from '../src/app.js';

let totalTests = 0;
let passedTests = 0;

function it(description, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ [PASS] ${description}`);
  } catch (err) {
    console.error(`  ✗ [FAIL] ${description}`);
    console.error(`    ${err.message}`);
    throw err;
  }
}

async function itAsync(description, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✓ [PASS] ${description}`);
  } catch (err) {
    console.error(`  ✗ [FAIL] ${description}`);
    console.error(`    ${err.message}`);
    throw err;
  }
}

console.log('======================================================');
console.log(' TRUST PROXY & RATE LIMITING REGRESSION TESTS');
console.log('======================================================\n');

// -----------------------------------------------------------
// 1. UNIT TESTS: resolveTrustProxySetting
// -----------------------------------------------------------
console.log('[UNIT TESTS] Trust Proxy Resolution & Safety Gates');

it('Rejects TRUST_PROXY="true" (trust-all) with fatal error', () => {
  assert.throws(
    () => resolveTrustProxySetting('true'),
    /Fatal Configuration Error: TRUST_PROXY=true \(trust-all\) is strictly prohibited/
  );
});

it('Resolves TRUST_PROXY="false" to boolean false', () => {
  const result = resolveTrustProxySetting('false');
  assert.strictEqual(result, false);
});

it('Resolves TRUST_PROXY="1" to number 1', () => {
  const result = resolveTrustProxySetting('1');
  assert.strictEqual(result, 1);
});

it('Resolves TRUST_PROXY="2" to number 2', () => {
  const result = resolveTrustProxySetting('2');
  assert.strictEqual(result, 2);
});

it('Resolves approved subnets (loopback, linklocal, uniquelocal)', () => {
  const result = resolveTrustProxySetting('loopback, linklocal');
  assert.strictEqual(result, 'loopback, linklocal');
});

it('Rejects arbitrary invalid string values with fatal error', () => {
  assert.throws(
    () => resolveTrustProxySetting('some-arbitrary-invalid-value'),
    /Fatal Configuration Error: Invalid TRUST_PROXY value/
  );
});

it('Defaults to false when not on Railway and TRUST_PROXY is unset', () => {
  const original = { ...process.env };
  delete process.env.RAILWAY_ENVIRONMENT_NAME;
  delete process.env.RAILWAY_ENVIRONMENT;
  delete process.env.RAILWAY_SERVICE_ID;
  delete process.env.RAILWAY_PROJECT_ID;
  delete process.env.RAILWAY_PUBLIC_DOMAIN;
  delete process.env.RAILWAY_STATIC_URL;
  delete process.env.RAILWAY_DEPLOYMENT_ID;

  const result = resolveTrustProxySetting(undefined);
  assert.strictEqual(result, false);

  Object.assign(process.env, original);
});

it('Auto-detects Railway environment and defaults to 1 hop', () => {
  const original = { ...process.env };
  process.env.RAILWAY_ENVIRONMENT_NAME = 'production';

  const result = resolveTrustProxySetting(undefined);
  assert.strictEqual(result, 1, 'Railway environment should default to 1 proxy hop');

  delete process.env.RAILWAY_ENVIRONMENT_NAME;
  Object.assign(process.env, original);
});

// -----------------------------------------------------------
// 2. INTEGRATION TESTS: express-rate-limit & Railway Topology
// -----------------------------------------------------------
console.log('\n[INTEGRATION TESTS] express-rate-limit & Railway 1-Hop Topology');

await itAsync('trust proxy: false triggers ERR_ERL_UNEXPECTED_X_FORWARDED_FOR warning on forwarded request', async () => {
  const testApp = express();
  testApp.set('trust proxy', false);

  const limiter = rateLimit({
    windowMs: 60000,
    max: 10,
  });
  testApp.use(limiter);
  testApp.get('/probe', (req, res) => res.json({ ip: req.ip }));

  const server = testApp.listen(0);
  const port = server.address().port;

  const originalConsoleError = console.error;
  let capturedWarning = null;
  console.error = (err) => {
    if (err && (err.code === 'ERR_ERL_UNEXPECTED_X_FORWARDED_FOR' || String(err).includes('ERR_ERL_UNEXPECTED_X_FORWARDED_FOR'))) {
      capturedWarning = err;
    }
  };

  try {
    const res = await fetch(`http://127.0.0.1:${port}/probe`, {
      headers: { 'X-Forwarded-For': '203.0.113.195' },
    });
    assert.strictEqual(res.status, 200);
    assert(capturedWarning !== null, 'express-rate-limit must log ERR_ERL_UNEXPECTED_X_FORWARDED_FOR when trust proxy is false');
    assert.strictEqual(capturedWarning.code, 'ERR_ERL_UNEXPECTED_X_FORWARDED_FOR');
  } finally {
    console.error = originalConsoleError;
    server.close();
  }
});

await itAsync('trust proxy: 1 cleanly accepts forwarded request without ERR_ERL_UNEXPECTED_X_FORWARDED_FOR', async () => {
  const testApp = express();
  testApp.set('trust proxy', 1);

  const limiter = rateLimit({
    windowMs: 60000,
    max: 10,
  });
  testApp.use(limiter);
  testApp.get('/probe', (req, res) => res.json({ ip: req.ip }));

  const server = testApp.listen(0);
  const port = server.address().port;

  const originalConsoleError = console.error;
  let errorLogged = null;
  console.error = (err) => {
    if (err && String(err).includes('ERR_ERL_')) {
      errorLogged = err;
    }
  };

  try {
    const res = await fetch(`http://127.0.0.1:${port}/probe`, {
      headers: { 'X-Forwarded-For': '203.0.113.195' },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.ip, '203.0.113.195');
    assert.strictEqual(errorLogged, null, 'No ERR_ERL warning should be logged when trust proxy is 1');
  } finally {
    console.error = originalConsoleError;
    server.close();
  }
});

await itAsync('trust proxy: 1 strictly ignores spoofed IPs in X-Forwarded-For', async () => {
  const testApp = express();
  testApp.set('trust proxy', 1);

  testApp.get('/ip-check', (req, res) => res.json({ ip: req.ip, ips: req.ips }));

  const server = testApp.listen(0);
  const port = server.address().port;

  try {
    // Single spoof attempt: attacker sends '198.51.100.99', Railway appends real client IP '203.0.113.195'
    const res1 = await fetch(`http://127.0.0.1:${port}/ip-check`, {
      headers: { 'X-Forwarded-For': '198.51.100.99, 203.0.113.195' },
    });
    const body1 = await res1.json();
    assert.strictEqual(body1.ip, '203.0.113.195', 'Must resolve to rightmost client IP from 1-hop proxy');

    // Multi-spoof attempt: attacker sends multiple fake IPs
    const res2 = await fetch(`http://127.0.0.1:${port}/ip-check`, {
      headers: { 'X-Forwarded-For': '10.0.0.1, 172.16.0.1, 192.168.1.1, 203.0.113.195' },
    });
    const body2 = await res2.json();
    assert.strictEqual(body2.ip, '203.0.113.195', 'Must strictly resolve to real client IP, ignoring all spoofed prefixes');
  } finally {
    server.close();
  }
});

await itAsync('Rate limiting isolates different client IPs correctly', async () => {
  const testApp = express();
  testApp.set('trust proxy', 1);

  // Very strict rate limiter: 2 requests per window per IP
  const strictLimiter = rateLimit({
    windowMs: 60000,
    max: 2,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests' },
  });
  testApp.use('/limited', strictLimiter);
  testApp.get('/limited', (req, res) => res.json({ success: true, ip: req.ip }));

  const server = testApp.listen(0);
  const port = server.address().port;

  try {
    const clientA = '203.0.113.10';
    const clientB = '203.0.113.20';

    // Client A sends 2 requests -> both succeed
    const a1 = await fetch(`http://127.0.0.1:${port}/limited`, { headers: { 'X-Forwarded-For': clientA } });
    assert.strictEqual(a1.status, 200);
    const a2 = await fetch(`http://127.0.0.1:${port}/limited`, { headers: { 'X-Forwarded-For': clientA } });
    assert.strictEqual(a2.status, 200);

    // Client A sends 3rd request -> blocked (HTTP 429)
    const a3 = await fetch(`http://127.0.0.1:${port}/limited`, { headers: { 'X-Forwarded-For': clientA } });
    assert.strictEqual(a3.status, 429);

    // Client B sends request -> MUST SUCCEED (not blocked by Client A's activity!)
    const b1 = await fetch(`http://127.0.0.1:${port}/limited`, { headers: { 'X-Forwarded-For': clientB } });
    assert.strictEqual(b1.status, 200, 'Client B must NOT be throttled by Client A');
    const b1Body = await b1.json();
    assert.strictEqual(b1Body.ip, clientB);
  } finally {
    server.close();
  }
});

await itAsync('Direct internal request without X-Forwarded-For resolves to socket address without error', async () => {
  const testApp = express();
  testApp.set('trust proxy', 1);

  const limiter = rateLimit({
    windowMs: 60000,
    max: 10,
  });
  testApp.use(limiter);
  testApp.get('/direct', (req, res) => res.json({ ip: req.ip }));

  const server = testApp.listen(0);
  const port = server.address().port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/direct`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert(body.ip.includes('127.0.0.1') || body.ip.includes('::1'), 'Direct request should resolve to loopback socket');
  } finally {
    server.close();
  }
});

console.log('\n======================================================');
console.log(`Trust Proxy & Rate Limiting Tests: ${passedTests}/${totalTests} Passed`);
console.log('======================================================');
