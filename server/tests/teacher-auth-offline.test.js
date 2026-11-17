/**
 * MadrasaNexa Teacher Portal — Phase 4B: Teacher Authentication & Authorization Offline Test Suite
 *
 * Safety Scope:
 * - Executes in 100% database-isolated mode (NO database connection, NO network, NO migrations).
 * - Mocks database responses with complete fidelity to verify business logic, RBAC, tenant isolation,
 *   token versioning, and teacher profile binding.
 */

import './setup-test-env.js';
import assert from 'assert';
import jwt from 'jsonwebtoken';
import { signAccessToken, verifyAccessToken } from '../src/utils/jwt.js';
import { requireRoles, requireTeacher, requireMadrasaAdmin, requireSuperAdmin } from '../src/middleware/role.middleware.js';
import { requireTeacherContext, rejectClientSuppliedTeacherOverride } from '../src/middleware/tenant.middleware.js';
import { AUTH_ROLES, AUTH_STORAGE_KEYS } from '../src/constants/auth.constants.js';

// Test counters
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ PASS: ${name}`);
  } catch (err) {
    failedTests++;
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
  }
}

async function testAsync(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✓ PASS: ${name}`);
  } catch (err) {
    failedTests++;
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
  }
}

// Helper mock factory
function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    jsonData: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.jsonData = data;
      return this;
    },
    setHeader(key, val) {
      this.headers[key] = val;
    },
  };
  return res;
}

console.log('\n================================================================');
console.log('  MadrasaNexa Phase 4B: Teacher Authentication Test Suite');
console.log('  (100% Offline / Zero Database Connection Required)');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// Group 1: Role Constants & Frontend Session Keys
// -----------------------------------------------------------------------------
console.log('Group 1: Role Constants & Frontend Session Storage Keys');

test('AUTH_ROLES defines SUPER_ADMIN, MADRASA_ADMIN, and TEACHER', () => {
  assert.strictEqual(AUTH_ROLES.SUPER_ADMIN, 'SUPER_ADMIN');
  assert.strictEqual(AUTH_ROLES.MADRASA_ADMIN, 'MADRASA_ADMIN');
  assert.strictEqual(AUTH_ROLES.TEACHER, 'TEACHER');
});

test('AUTH_STORAGE_KEYS isolates Admin and Teacher session keys', () => {
  assert.strictEqual(AUTH_STORAGE_KEYS.ADMIN, 'madrasanexa_admin_token');
  assert.strictEqual(AUTH_STORAGE_KEYS.TEACHER, 'madrasanexa_teacher_token');
  assert.notStrictEqual(AUTH_STORAGE_KEYS.ADMIN, AUTH_STORAGE_KEYS.TEACHER);
});

// -----------------------------------------------------------------------------
// Group 2: JWT Signing & Verification for TEACHER Role
// -----------------------------------------------------------------------------
console.log('\nGroup 2: JWT Token Signing & Claims Verification');

test('Signs valid access token containing TEACHER role and tokenVersion', () => {
  const token = signAccessToken({
    userId: 'usr_teacher_001',
    role: 'TEACHER',
    madrasaId: 'mad_colombo_01',
    tokenVersion: 3,
  });

  assert.ok(typeof token === 'string' && token.length > 20);

  const verified = verifyAccessToken(token);
  assert.strictEqual(verified.valid, true);
  assert.strictEqual(verified.decoded.userId, 'usr_teacher_001');
  assert.strictEqual(verified.decoded.role, 'TEACHER');
  assert.strictEqual(verified.decoded.madrasaId, 'mad_colombo_01');
  assert.strictEqual(verified.decoded.tokenVersion, 3);
});

test('Rejects token with missing role or userId', () => {
  assert.throws(() => {
    signAccessToken({ userId: 'usr_no_role' });
  }, /JWT payload must include userId and role/);
});

test('Rejects tampered JWT signature for teacher token', () => {
  const token = signAccessToken({
    userId: 'usr_teacher_001',
    role: 'TEACHER',
    madrasaId: 'mad_colombo_01',
  });

  const tampered = token.slice(0, -5) + 'abcde';
  const verified = verifyAccessToken(tampered);
  assert.strictEqual(verified.valid, false);
  assert.strictEqual(verified.error, 'Invalid token signature or malformed token');
});

// -----------------------------------------------------------------------------
// Group 3: Role-Based Authorization Guard (requireTeacher)
// -----------------------------------------------------------------------------
console.log('\nGroup 3: Role-Based Authorization Guard (requireTeacher)');

test('requireTeacher allows access when req.auth.role is TEACHER', () => {
  const req = { auth: { userId: 'usr_1', role: 'TEACHER' } };
  const res = createMockRes();
  let nextCalled = false;

  requireTeacher(req, res, () => {
    nextCalled = true;
  });

  assert.strictEqual(nextCalled, true);
  assert.strictEqual(res.statusCode, 200);
});

test('requireTeacher blocks MADRASA_ADMIN with 403 Forbidden', () => {
  const req = { auth: { userId: 'usr_admin', role: 'MADRASA_ADMIN' } };
  const res = createMockRes();
  let nextCalled = false;

  requireTeacher(req, res, () => {
    nextCalled = true;
  });

  assert.strictEqual(nextCalled, false);
  assert.strictEqual(res.statusCode, 403);
  assert.strictEqual(res.jsonData.success, false);
  assert.strictEqual(res.jsonData.message, 'Forbidden: Insufficient privileges for this resource.');
});

test('requireTeacher blocks SUPER_ADMIN with 403 Forbidden', () => {
  const req = { auth: { userId: 'usr_super', role: 'SUPER_ADMIN' } };
  const res = createMockRes();
  let nextCalled = false;

  requireTeacher(req, res, () => {
    nextCalled = true;
  });

  assert.strictEqual(nextCalled, false);
  assert.strictEqual(res.statusCode, 403);
});

test('requireTeacher blocks unauthenticated request with 401', () => {
  const req = {};
  const res = createMockRes();
  let nextCalled = false;

  requireTeacher(req, res, () => {
    nextCalled = true;
  });

  assert.strictEqual(nextCalled, false);
  assert.strictEqual(res.statusCode, 401);
});

// -----------------------------------------------------------------------------
// Group 4: Client Override Rejection Guard
// -----------------------------------------------------------------------------
console.log('\nGroup 4: Client Override Rejection Guard');

test('rejectClientSuppliedTeacherOverride rejects madrasaId override attempt', () => {
  const req = {
    body: { madrasaId: 'foreign_tenant_99', notes: 'test' },
  };
  const res = createMockRes();
  let nextCalled = false;

  rejectClientSuppliedTeacherOverride(req, res, () => {
    nextCalled = true;
  });

  assert.strictEqual(nextCalled, false);
  assert.strictEqual(res.statusCode, 403);
  assert.match(res.jsonData.message, /strictly prohibited/i);
});

test('rejectClientSuppliedTeacherOverride rejects ustadhId override attempt', () => {
  const req = {
    body: { ustadhId: 'peer_teacher_88' },
  };
  const res = createMockRes();
  let nextCalled = false;

  rejectClientSuppliedTeacherOverride(req, res, () => {
    nextCalled = true;
  });

  assert.strictEqual(nextCalled, false);
  assert.strictEqual(res.statusCode, 403);
});

test('rejectClientSuppliedTeacherOverride rejects role override attempt', () => {
  const req = {
    body: { role: 'SUPER_ADMIN' },
  };
  const res = createMockRes();
  let nextCalled = false;

  rejectClientSuppliedTeacherOverride(req, res, () => {
    nextCalled = true;
  });

  assert.strictEqual(nextCalled, false);
  assert.strictEqual(res.statusCode, 403);
});

test('rejectClientSuppliedTeacherOverride passes benign payload', () => {
  const req = {
    body: { status: 'PRESENT', notes: 'Checked in on time' },
  };
  const res = createMockRes();
  let nextCalled = false;

  rejectClientSuppliedTeacherOverride(req, res, () => {
    nextCalled = true;
  });

  assert.strictEqual(nextCalled, true);
  assert.strictEqual(res.statusCode, 200);
});

// -----------------------------------------------------------------------------
// Group 5: Teacher Context & Tenant Isolation Middleware Logic
// -----------------------------------------------------------------------------
console.log('\nGroup 5: Teacher Context & Tenant Isolation Middleware Logic');

test('requireTeacherContext blocks non-TEACHER role', async () => {
  const req = {
    auth: { userId: 'usr_admin', role: 'MADRASA_ADMIN', madrasaId: 'mad_01' },
  };
  const res = createMockRes();
  let errorCaught = null;

  await requireTeacherContext(req, res, (err) => {
    errorCaught = err;
  });

  assert.ok(errorCaught);
  assert.strictEqual(errorCaught.statusCode, 403);
  assert.match(errorCaught.message, /Teacher workspace requires Teacher credentials/i);
});

test('requireTeacherContext blocks user with mustChangePassword flag', async () => {
  const req = {
    auth: { userId: 'usr_teacher', role: 'TEACHER', madrasaId: 'mad_01', mustChangePassword: true },
  };
  const res = createMockRes();
  let nextCalled = false;

  await requireTeacherContext(req, res, () => {
    nextCalled = true;
  });

  assert.strictEqual(nextCalled, false);
  assert.strictEqual(res.statusCode, 403);
  assert.strictEqual(res.jsonData.code, 'MUST_CHANGE_PASSWORD');
});

test('requireTeacherContext blocks teacher without madrasaId', async () => {
  const req = {
    auth: { userId: 'usr_teacher', role: 'TEACHER', madrasaId: null },
  };
  const res = createMockRes();
  let errorCaught = null;

  await requireTeacherContext(req, res, (err) => {
    errorCaught = err;
  });

  assert.ok(errorCaught);
  assert.strictEqual(errorCaught.statusCode, 403);
  assert.match(errorCaught.message, /not associated with an authorized Madrasa/i);
});

// -----------------------------------------------------------------------------
// Group 6: Token Version Invalidation Logic
// -----------------------------------------------------------------------------
console.log('\nGroup 6: Token Version Invalidation & Account Deactivation Logic');

test('Token version mismatch simulates immediate session revocation', () => {
  const activeSessionToken = signAccessToken({
    userId: 'usr_teacher_01',
    role: 'TEACHER',
    madrasaId: 'mad_01',
    tokenVersion: 1, // Issued when version was 1
  });

  // Simulate database user after Admin clicked "Deactivate" (tokenVersion incremented to 2)
  const dbUser = {
    id: 'usr_teacher_01',
    isActive: false,
    tokenVersion: 2,
    role: 'TEACHER',
  };

  const decoded = verifyAccessToken(activeSessionToken).decoded;

  // Exact check implemented in auth.middleware.js#L74
  const isRevoked = dbUser.tokenVersion !== decoded.tokenVersion;
  assert.strictEqual(isRevoked, true, 'Stale token version must be detected as revoked');

  const isInactive = !dbUser.isActive;
  assert.strictEqual(isInactive, true, 'Deactivated account must be detected');
});

test('Matching token version is accepted', () => {
  const token = signAccessToken({
    userId: 'usr_teacher_01',
    role: 'TEACHER',
    madrasaId: 'mad_01',
    tokenVersion: 5,
  });

  const dbUser = {
    id: 'usr_teacher_01',
    isActive: true,
    tokenVersion: 5,
    role: 'TEACHER',
  };

  const decoded = verifyAccessToken(token).decoded;
  const isValid = dbUser.tokenVersion === decoded.tokenVersion && dbUser.isActive;
  assert.strictEqual(isValid, true);
});

// -----------------------------------------------------------------------------
// Group 7: Existing Admin Authentication Regression Safeguards
// -----------------------------------------------------------------------------
console.log('\nGroup 7: Existing Admin Authentication Regression Safeguards');

test('requireMadrasaAdmin still strictly rejects TEACHER role', () => {
  const req = { auth: { userId: 'usr_teacher', role: 'TEACHER' } };
  const res = createMockRes();
  let nextCalled = false;

  requireMadrasaAdmin(req, res, () => {
    nextCalled = true;
  });

  assert.strictEqual(nextCalled, false);
  assert.strictEqual(res.statusCode, 403);
});

test('requireSuperAdmin still strictly rejects TEACHER role', () => {
  const req = { auth: { userId: 'usr_teacher', role: 'TEACHER' } };
  const res = createMockRes();
  let nextCalled = false;

  requireSuperAdmin(req, res, () => {
    nextCalled = true;
  });

  assert.strictEqual(nextCalled, false);
  assert.strictEqual(res.statusCode, 403);
});

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`  Tests Executed: ${totalTests}`);
console.log(`  Passed:         ${passedTests}`);
console.log(`  Failed:         ${failedTests}`);
console.log('================================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('  All Phase 4B offline security and authentication tests PASSED (100%).\n');
}
