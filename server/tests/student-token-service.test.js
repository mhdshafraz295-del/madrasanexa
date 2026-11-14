/**
 * MadrasaNexa Phase 02 – Student Token Service Isolated Unit & Business Rule Tests
 *
 * Scope: Gate E, Step 2 ONLY.
 * - Enforces canonical 37-character token format (`MNX1_<32 hex>`).
 * - Validates duplicate prevention, additive batch generation, single-student regeneration,
 *   individual revocation, tenant isolation, reprinting without re-issuance, and atomic rollback.
 * - Uses hermetic in-memory mock engine with exact database constraints (including @@unique([madrasaId, activeStudentId])).
 * - Zero database writes; strictly zero fake records inserted in live database.
 */

import {
  issueStudentToken,
  batchGenerateMissingTokens,
  regenerateStudentToken,
  revokeStudentToken,
  getActiveTokenForStudent,
  getActiveTokenForPrint,
  listStudentTokenHistory,
} from '../src/services/student-token.service.js';
import {
  isValidTokenFormat,
  decryptToken,
} from '../src/utils/scan-token-crypto.js';
import {
  BadRequestError,
  NotFoundError,
  ConflictError,
} from '../src/utils/errors.js';

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

async function assertThrowsAsync(fn, expectedType, expectedPattern, message) {
  let threw = false;
  try {
    await fn();
  } catch (err) {
    threw = true;
    if (expectedType && !(err instanceof expectedType)) {
      throw new Error(`Expected error instance of ${expectedType.name}, got ${err.constructor.name}: "${err.message}"`);
    }
    if (expectedPattern && !expectedPattern.test(err.message)) {
      throw new Error(`Expected error matching ${expectedPattern}, but got: "${err.message}"`);
    }
  }
  assert(threw, message);
}

// Synthetic 64-char hex key for isolated tests
const TEST_KEY_HEX = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

/**
 * Creates an in-memory hermetic Prisma mock enforcing exact relational & unique constraints.
 */
function createMockPrismaClient() {
  const students = [
    { id: 'stud_101', madrasaId: 'mda_tenant_A', admissionNo: 'ADM-001', fullName: 'Zayd Ali', classId: 'cls_1' },
    { id: 'stud_102', madrasaId: 'mda_tenant_A', admissionNo: 'ADM-002', fullName: 'Bilal Umar', classId: 'cls_1' },
    { id: 'stud_103', madrasaId: 'mda_tenant_A', admissionNo: 'ADM-003', fullName: 'Tariq Hassan', classId: 'cls_2' },
    { id: 'stud_999', madrasaId: 'mda_tenant_B', admissionNo: 'ADM-B-01', fullName: 'Foreign Student', classId: 'cls_b' },
  ];

  let scanTokens = [];
  let idCounter = 1;

  const mock = {
    student: {
      findFirst: async ({ where }) => {
        return students.find((s) => {
          if (where.id && s.id !== where.id) return false;
          if (where.madrasaId && s.madrasaId !== where.madrasaId) return false;
          return true;
        }) || null;
      },
      findMany: async ({ where, orderBy }) => {
        let list = students.filter((s) => {
          if (where.madrasaId && s.madrasaId !== where.madrasaId) return false;
          if (where.classId && s.classId !== where.classId) return false;
          return true;
        });
        if (orderBy?.admissionNo === 'asc') {
          list = [...list].sort((a, b) => a.admissionNo.localeCompare(b.admissionNo));
        }
        return list;
      },
    },

    studentScanToken: {
      findFirst: async ({ where }) => {
        return scanTokens.find((t) => {
          if (where.id && t.id !== where.id) return false;
          if (where.madrasaId && t.madrasaId !== where.madrasaId) return false;
          if (where.studentId && t.studentId !== where.studentId) return false;
          if (where.isActive !== undefined && t.isActive !== where.isActive) return false;
          return true;
        }) || null;
      },

      findMany: async ({ where, orderBy }) => {
        let list = scanTokens.filter((t) => {
          if (where.madrasaId && t.madrasaId !== where.madrasaId) return false;
          if (where.studentId) {
            if (where.studentId.in) {
              if (!where.studentId.in.includes(t.studentId)) return false;
            } else if (t.studentId !== where.studentId) {
              return false;
            }
          }
          if (where.isActive !== undefined && t.isActive !== where.isActive) return false;
          return true;
        });

        if (orderBy?.version === 'desc') {
          list = [...list].sort((a, b) => b.version - a.version);
        }
        return list;
      },

      create: async ({ data, select }) => {
        // Enforce DB constraint: UNIQUE (madrasaId, activeStudentId)
        if (data.activeStudentId) {
          const duplicate = scanTokens.find(
            (t) => t.madrasaId === data.madrasaId && t.activeStudentId === data.activeStudentId
          );
          if (duplicate) {
            const err = new Error('Unique constraint failed on the fields: (`madrasaId`,`activeStudentId`)');
            err.code = 'P2002';
            throw err;
          }
        }

        const newRecord = {
          id: `token_${idCounter++}`,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        scanTokens.push(newRecord);

        if (select) {
          const selected = {};
          for (const key of Object.keys(select)) {
            if (select[key]) selected[key] = newRecord[key];
          }
          return selected;
        }
        return newRecord;
      },

      update: async ({ where, data, select }) => {
        const record = scanTokens.find((t) => t.id === where.id);
        if (!record) {
          throw new Error(`Record to update not found (id: ${where.id})`);
        }
        Object.assign(record, data, { updatedAt: new Date() });

        if (select) {
          const selected = {};
          for (const key of Object.keys(select)) {
            if (select[key]) selected[key] = record[key];
          }
          return selected;
        }
        return record;
      },
    },

    $transaction: async (txFn) => {
      // Snapshot state for atomic rollback simulation
      const snapshot = JSON.parse(JSON.stringify(scanTokens));
      try {
        return await txFn(mock);
      } catch (err) {
        scanTokens = snapshot; // Rollback
        throw err;
      }
    },

    // Helper for test assertions
    _inspectTokens: () => scanTokens,
  };

  return mock;
}

async function runServiceTests() {
  console.log('================================================================');
  console.log('  MadrasaNexa Gate E, Step 2: Student Token Service Unit Tests  ');
  console.log('================================================================\n');

  // --- Suite 1: Single Student Issuance & Canonical Format ---
  console.log('--- Suite 1: Single Student Issuance & Canonical Format ---');
  {
    const mockPrisma = createMockPrismaClient();

    const { tokenRecord, rawToken } = await issueStudentToken({
      madrasaId: 'mda_tenant_A',
      studentId: 'stud_101',
      issuedById: 'user_admin_1',
      keyHex: TEST_KEY_HEX,
      prismaClient: mockPrisma,
    });

    assert(typeof rawToken === 'string', 'Raw token is returned in memory');
    assert(rawToken.length === 37, 'Raw token length is exactly 37 ASCII characters');
    assert(rawToken.startsWith('MNX1_'), 'Raw token begins with canonical "MNX1_" prefix');
    assert(isValidTokenFormat(rawToken) === true, 'Raw token strictly passes canonical format validator');

    assert(tokenRecord.madrasaId === 'mda_tenant_A', 'Record belongs to tenant madrasa');
    assert(tokenRecord.studentId === 'stud_101', 'Record references target student');
    assert(tokenRecord.version === 1, 'Initial token version is 1');
    assert(tokenRecord.isActive === true, 'Token is marked active');
    assert(tokenRecord.tokenHint.startsWith('MNX1...'), 'Token hint format matches "MNX1...<suffix>"');

    // Verify database record has ciphertext, not raw token
    const dbTokens = mockPrisma._inspectTokens();
    assert(dbTokens.length === 1, 'Exactly one token record created in database');
    assert(dbTokens[0].tokenHash.length === 64, 'tokenHash is 64-char SHA-256 digest');
    assert(dbTokens[0].tokenEncrypted !== rawToken, 'tokenEncrypted is ciphertext, never raw plaintext');
    assert(dbTokens[0].tokenIv.length === 24, 'tokenIv is 12-byte hex IV');
    assert(dbTokens[0].tokenAuthTag.length === 32, 'tokenAuthTag is 16-byte hex tag');
    assert(dbTokens[0].activeStudentId === 'stud_101', 'activeStudentId is set to studentId for unique constraint');
  }

  // --- Suite 2: Tenant Isolation (IDOR Protection) ---
  console.log('\n--- Suite 2: Tenant Isolation Enforcement ---');
  {
    const mockPrisma = createMockPrismaClient();

    // Tenant A attempts to issue token for Tenant B's student ('stud_999')
    await assertThrowsAsync(
      () => issueStudentToken({
        madrasaId: 'mda_tenant_A',
        studentId: 'stud_999',
        keyHex: TEST_KEY_HEX,
        prismaClient: mockPrisma,
      }),
      NotFoundError,
      /Student not found/,
      'Cross-tenant issuance rejected with generic NotFoundError (prevents IDOR)'
    );

    // Non-existent student
    await assertThrowsAsync(
      () => issueStudentToken({
        madrasaId: 'mda_tenant_A',
        studentId: 'stud_non_existent',
        keyHex: TEST_KEY_HEX,
        prismaClient: mockPrisma,
      }),
      NotFoundError,
      /Student not found/,
      'Non-existent student issuance rejected with NotFoundError'
    );
  }

  // --- Suite 3: Duplicate Active Token Prevention ---
  console.log('\n--- Suite 3: Duplicate Active Token Prevention ---');
  {
    const mockPrisma = createMockPrismaClient();

    // 1. Initial issuance
    await issueStudentToken({
      madrasaId: 'mda_tenant_A',
      studentId: 'stud_101',
      keyHex: TEST_KEY_HEX,
      prismaClient: mockPrisma,
    });

    // 2. Second normal issuance attempt MUST fail with ConflictError
    await assertThrowsAsync(
      () => issueStudentToken({
        madrasaId: 'mda_tenant_A',
        studentId: 'stud_101',
        keyHex: TEST_KEY_HEX,
        prismaClient: mockPrisma,
      }),
      ConflictError,
      /already has an active scan token/,
      'Normal issuance strictly rejects overwriting an existing active token'
    );

    // Database still has only 1 token
    assert(mockPrisma._inspectTokens().length === 1, 'Database remains clean with only 1 token');
  }

  // --- Suite 4: Additive Batch Token Generation ---
  console.log('\n--- Suite 4: Additive Batch Token Generation ---');
  {
    const mockPrisma = createMockPrismaClient();

    // Pre-issue a token for stud_101
    await issueStudentToken({
      madrasaId: 'mda_tenant_A',
      studentId: 'stud_101',
      keyHex: TEST_KEY_HEX,
      prismaClient: mockPrisma,
    });

    // Run batch generation across tenant A (students: 101, 102, 103)
    const batchResult = await batchGenerateMissingTokens({
      madrasaId: 'mda_tenant_A',
      issuedById: 'batch_admin',
      keyHex: TEST_KEY_HEX,
      prismaClient: mockPrisma,
    });

    assert(batchResult.totalEligible === 3, 'Total eligible students is 3');
    assert(batchResult.generatedCount === 2, 'Generated tokens for exactly 2 missing students (102 and 103)');
    assert(batchResult.skippedCount === 1, 'Skipped exactly 1 student with existing active token (101)');
    assert(batchResult.tokens.length === 2, 'Returned 2 generated token payloads');

    for (const item of batchResult.tokens) {
      assert(isValidTokenFormat(item.rawToken), 'Batch generated token conforms to canonical 37-char format');
      assert(item.tokenRecord.version === 1, 'Batch generated token version is 1');
    }

    // Run batch generation again: should generate 0, skip 3
    const secondBatch = await batchGenerateMissingTokens({
      madrasaId: 'mda_tenant_A',
      keyHex: TEST_KEY_HEX,
      prismaClient: mockPrisma,
    });

    assert(secondBatch.generatedCount === 0, 'Second batch generates 0 tokens');
    assert(secondBatch.skippedCount === 3, 'Second batch skips all 3 existing active students');
    assert(secondBatch.tokens.length === 0, 'Empty tokens array when no missing cards exist');
  }

  // --- Suite 5: Single-Student Token Regeneration ---
  console.log('\n--- Suite 5: Single-Student Token Regeneration with Audit Trail ---');
  {
    const mockPrisma = createMockPrismaClient();

    // 1. Initial issuance
    const initial = await issueStudentToken({
      madrasaId: 'mda_tenant_A',
      studentId: 'stud_101',
      keyHex: TEST_KEY_HEX,
      prismaClient: mockPrisma,
    });
    const initialTokenId = initial.tokenRecord.id;

    // 2. Regeneration without audit reason MUST fail with BadRequestError
    await assertThrowsAsync(
      () => regenerateStudentToken({
        madrasaId: 'mda_tenant_A',
        studentId: 'stud_101',
        reason: '',
        keyHex: TEST_KEY_HEX,
        prismaClient: mockPrisma,
      }),
      BadRequestError,
      /Mandatory audit reason is required/,
      'Regeneration rejects empty audit reason'
    );

    await assertThrowsAsync(
      () => regenerateStudentToken({
        madrasaId: 'mda_tenant_A',
        studentId: 'stud_101',
        reason: '   ',
        keyHex: TEST_KEY_HEX,
        prismaClient: mockPrisma,
      }),
      BadRequestError,
      /Mandatory audit reason is required/,
      'Regeneration rejects whitespace audit reason'
    );

    // 3. Authorized regeneration with audit reason
    const regenerated = await regenerateStudentToken({
      madrasaId: 'mda_tenant_A',
      studentId: 'stud_101',
      reason: 'LOST_CARD_IN_TRANSIT',
      issuedById: 'admin_reissuer',
      keyHex: TEST_KEY_HEX,
      prismaClient: mockPrisma,
    });

    assert(regenerated.rawToken !== initial.rawToken, 'Regenerated token is distinct from prior token');
    assert(isValidTokenFormat(regenerated.rawToken), 'Regenerated token matches 37-char canonical format');
    assert(regenerated.tokenRecord.version === 2, 'Version incremented to 2');
    assert(regenerated.tokenRecord.isActive === true, 'New token is active');
    assert(regenerated.previousTokenId === initialTokenId, 'previousTokenId correctly tracks prior token');

    // Verify DB state: prior token is revoked and activeStudentId is nullified
    const allTokens = mockPrisma._inspectTokens();
    const oldToken = allTokens.find((t) => t.id === initialTokenId);
    const newToken = allTokens.find((t) => t.id === regenerated.tokenRecord.id);

    assert(oldToken.isActive === false, 'Prior token marked isActive = false');
    assert(oldToken.activeStudentId === null, 'Prior token activeStudentId nullified');
    assert(oldToken.revokeReason === 'LOST_CARD_IN_TRANSIT', 'Prior token audit reason recorded');
    assert(oldToken.revokedById === 'admin_reissuer', 'Prior token revokedById recorded');
    assert(oldToken.revokedAt instanceof Date, 'Prior token revokedAt recorded');

    assert(newToken.isActive === true, 'New token isActive = true');
    assert(newToken.activeStudentId === 'stud_101', 'New token holds activeStudentId unique constraint');
    assert(newToken.version === 2, 'New token version is 2');
  }

  // --- Suite 6: Reprinting Reuses Active Token ---
  console.log('\n--- Suite 6: Card Reprinting Reuses Active Token ---');
  {
    const mockPrisma = createMockPrismaClient();

    // 1. Initial issuance
    const initial = await issueStudentToken({
      madrasaId: 'mda_tenant_A',
      studentId: 'stud_101',
      keyHex: TEST_KEY_HEX,
      prismaClient: mockPrisma,
    });

    // 2. Fetch for print
    const printPayload = await getActiveTokenForPrint({
      madrasaId: 'mda_tenant_A',
      studentId: 'stud_101',
      keyHex: TEST_KEY_HEX,
      prismaClient: mockPrisma,
    });

    assert(printPayload.rawToken === initial.rawToken, 'Reprint decrypts exact original 37-char raw token');
    assert(printPayload.tokenRecord.id === initial.tokenRecord.id, 'Reprint references existing active token ID');
    assert(printPayload.tokenRecord.version === 1, 'Version is unchanged');

    // Confirm no new records were created
    assert(mockPrisma._inspectTokens().length === 1, 'Database row count unchanged upon reprint');
  }

  // --- Suite 7: Token Revocation ---
  console.log('\n--- Suite 7: Token Revocation Workflow ---');
  {
    const mockPrisma = createMockPrismaClient();

    const initial = await issueStudentToken({
      madrasaId: 'mda_tenant_A',
      studentId: 'stud_101',
      keyHex: TEST_KEY_HEX,
      prismaClient: mockPrisma,
    });

    // Revocation without reason fails
    await assertThrowsAsync(
      () => revokeStudentToken({
        madrasaId: 'mda_tenant_A',
        studentId: 'stud_101',
        reason: '',
        prismaClient: mockPrisma,
      }),
      BadRequestError,
      /Mandatory audit reason is required/,
      'Revocation requires mandatory reason'
    );

    // Authorized revocation
    const revoked = await revokeStudentToken({
      madrasaId: 'mda_tenant_A',
      studentId: 'stud_101',
      reason: 'STUDENT_WITHDRAWN',
      revokedById: 'registrar_1',
      prismaClient: mockPrisma,
    });

    assert(revoked.isActive === false, 'Token marked inactive');
    assert(revoked.revokeReason === 'STUDENT_WITHDRAWN', 'Revoke reason saved');
    assert(revoked.revokedById === 'registrar_1', 'Revoker ID saved');

    // Verify getActiveTokenForPrint now throws NotFoundError
    await assertThrowsAsync(
      () => getActiveTokenForPrint({
        madrasaId: 'mda_tenant_A',
        studentId: 'stud_101',
        keyHex: TEST_KEY_HEX,
        prismaClient: mockPrisma,
      }),
      NotFoundError,
      /No active scan token found/,
      'Reprinting fails when token is revoked'
    );

    // After revocation, normal issuance for stud_101 is allowed again because activeStudentId was nullified
    const newIssue = await issueStudentToken({
      madrasaId: 'mda_tenant_A',
      studentId: 'stud_101',
      keyHex: TEST_KEY_HEX,
      prismaClient: mockPrisma,
    });
    assert(newIssue.tokenRecord.isActive === true, 'New token successfully issued after revocation');
  }

  // --- Suite 8: Atomic Transaction Rollback on Failure ---
  console.log('\n--- Suite 8: Atomic Transaction Rollback on Failure ---');
  {
    const mockPrisma = createMockPrismaClient();

    await issueStudentToken({
      madrasaId: 'mda_tenant_A',
      studentId: 'stud_101',
      keyHex: TEST_KEY_HEX,
      prismaClient: mockPrisma,
    });

    // Force an error inside $transaction by tampering create method
    const originalCreate = mockPrisma.studentScanToken.create;
    mockPrisma.studentScanToken.create = async () => {
      throw new Error('Simulated database deadlock or network timeout');
    };

    await assertThrowsAsync(
      () => regenerateStudentToken({
        madrasaId: 'mda_tenant_A',
        studentId: 'stud_101',
        reason: 'REPLACE_CARD',
        keyHex: TEST_KEY_HEX,
        prismaClient: mockPrisma,
      }),
      Error,
      /Simulated database deadlock/,
      'Transaction error is propagated'
    );

    // Restore create method
    mockPrisma.studentScanToken.create = originalCreate;

    // Verify rollback: prior token must STILL be active
    const active = await getActiveTokenForStudent({
      madrasaId: 'mda_tenant_A',
      studentId: 'stud_101',
      prismaClient: mockPrisma,
    });
    assert(active !== null && active.isActive === true, 'Transaction rolled back: original token remains active');
    assert(mockPrisma._inspectTokens().length === 1, 'No orphaned or partially updated records exist');
  }

  console.log('\n================================================================');
  console.log(`  All Test Suites Completed: ${passed} PASSED, ${failed} FAILED  `);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runServiceTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
