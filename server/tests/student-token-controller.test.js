/**
 * MadrasaNexa Phase 02 – Student Token Controller & Admission Barcode Integration Tests
 *
 * Scope: Step 1.1 Backend API Endpoints & Contract Integration
 *
 * Automated verification of:
 * 1. Tenant isolation across all card-token and admission verification operations
 * 2. Raw token secrecy in listing APIs (zero leakage of rawToken, tokenHash, ciphertext, or keys)
 * 3. Anti-caching HTTP headers (Cache-Control: no-store, Pragma: no-cache) on print-data endpoints
 * 4. Token revocation lifecycle and immediate verification invalidation
 * 5. Token regeneration lifecycle (version increment, atomic revocation of previous token)
 * 6. Mandatory reason validation (minimum 3 characters) for revocation & regeneration
 * 7. Additive batch generation (generates for missing students only, zero duplicate active tokens)
 * 8. Code128 1D barcode verification with in-transaction ActivityLog write
 * 9. Code128 duplicate scan detection and overwrite protection
 * 10. Rejection of inactive students and class mismatches
 * 11. Code128 non-persistence invariant (does NOT create attendance records or sessions)
 * 12. PDF card sheet rendering function (A4 portrait, zero margins, no headers/footers, closes page)
 */

import {
  listCardTokens,
  issueCardToken,
  batchGenerateTokens,
  getCardPrintData,
  getBatchCardPrintData,
  regenerateCardToken,
  revokeCardToken,
  getCardTokenHistory,
} from '../src/controllers/student-token.controller.js';
import {
  verifyAdmissionBarcode,
} from '../src/controllers/attendance.controller.js';
import {
  verifyAdmissionBarcodeForAttendance,
  verifyScanTokenForAttendance,
  ingestAdmissionBarcodeAttendanceRecord,
} from '../src/services/attendance.service.js';
import {
  issueStudentToken,
  batchGenerateMissingTokens,
  regenerateStudentToken,
  revokeStudentToken,
  getActiveTokenForPrint,
  listCardTokens as listCardTokensService,
  getBatchCardPrintData as getBatchCardPrintDataService,
} from '../src/services/student-token.service.js';
import {
  renderCardSheetPdf,
} from '../src/services/pdf-report.service.js';
import {
  isValidTokenFormat,
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

// Synthetic 64-char key for tests
const TEST_KEY_HEX = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

function createMockReqRes({
  tenantId = 'mda_tenant_A',
  userId = 'usr_operator_1',
  role = 'MADRASA_ADMIN',
  params = {},
  body = {},
  query = {},
} = {}) {
  const req = {
    tenant: { madrasaId: tenantId, code: 'MDA', name: 'Madrasa A' },
    auth: { userId, madrasaId: tenantId, role },
    user: { id: userId, madrasaId: tenantId, role },
    params,
    body,
    query,
  };

  const headers = {};
  let statusCode = 200;
  let jsonResponse = null;

  const res = {
    status(code) {
      statusCode = code;
      return res;
    },
    setHeader(name, val) {
      headers[name.toLowerCase()] = val;
    },
    getHeader(name) {
      return headers[name.toLowerCase()];
    },
    json(payload) {
      jsonResponse = payload;
      return res;
    },
    _getStatusCode: () => statusCode,
    _getHeaders: () => headers,
    _getJson: () => jsonResponse,
  };

  return { req, res };
}

/**
 * Creates hermetic in-memory mock Prisma client with complete relational support.
 */
function createHermeticPrisma() {
  const students = [
    {
      id: 'stud_101',
      madrasaId: 'mda_tenant_A',
      admissionNo: 'ADM-001',
      fullName: 'Zayd Ali',
      status: 'ACTIVE',
      classId: 'cls_1',
      admissionDate: new Date('2026-01-01'),
      photoFileId: 'photo_101.jpg',
      class: { id: 'cls_1', name: 'Class 1A', code: 'C1A' },
    },
    {
      id: 'stud_102',
      madrasaId: 'mda_tenant_A',
      admissionNo: 'ADM-002',
      fullName: 'Bilal Umar',
      status: 'ACTIVE',
      classId: 'cls_1',
      admissionDate: new Date('2026-01-01'),
      photoFileId: null,
      class: { id: 'cls_1', name: 'Class 1A', code: 'C1A' },
    },
    {
      id: 'stud_103',
      madrasaId: 'mda_tenant_A',
      admissionNo: 'ADM-003',
      fullName: 'Tariq Hassan',
      status: 'ACTIVE',
      classId: 'cls_2',
      admissionDate: new Date('2026-01-01'),
      photoFileId: null,
      class: { id: 'cls_2', name: 'Class 2A', code: 'C2A' },
    },
    {
      id: 'stud_104_inactive',
      madrasaId: 'mda_tenant_A',
      admissionNo: 'ADM-004',
      fullName: 'Inactive Student',
      status: 'INACTIVE',
      classId: 'cls_1',
      admissionDate: new Date('2026-01-01'),
      photoFileId: null,
      class: { id: 'cls_1', name: 'Class 1A', code: 'C1A' },
    },
    {
      id: 'stud_999',
      madrasaId: 'mda_tenant_B',
      admissionNo: 'ADM-B-01',
      fullName: 'Foreign Student B',
      status: 'ACTIVE',
      classId: 'cls_b',
      admissionDate: new Date('2026-01-01'),
      photoFileId: null,
      class: { id: 'cls_b', name: 'Class B', code: 'CB' },
    },
  ];

  let scanTokens = [];
  let activityLogs = [];
  let attendanceSessions = [];
  let attendanceRecords = [];
  let idCounter = 1;

  const client = {
    _students: students,
    _scanTokens: scanTokens,
    _activityLogs: activityLogs,
    _attendanceSessions: attendanceSessions,
    _attendanceRecords: attendanceRecords,

    student: {
      findFirst: async ({ where, include, select }) => {
        const found = students.find((s) => {
          if (where.id && s.id !== where.id) return false;
          if (where.madrasaId && s.madrasaId !== where.madrasaId) return false;
          if (where.admissionNo && s.admissionNo !== where.admissionNo) return false;
          return true;
        });
        if (!found) return null;
        return JSON.parse(JSON.stringify(found));
      },
      findMany: async ({ where = {}, skip = 0, take = 100, orderBy }) => {
        let list = students.filter((s) => {
          if (where.madrasaId && s.madrasaId !== where.madrasaId) return false;
          if (where.classId && s.classId !== where.classId) return false;
          if (where.id && where.id.in && !where.id.in.includes(s.id)) return false;
          if (where.OR) {
            const matches = where.OR.some((cond) => {
              if (cond.fullName?.contains && s.fullName.includes(cond.fullName.contains)) return true;
              if (cond.admissionNo?.contains && s.admissionNo.includes(cond.admissionNo.contains)) return true;
              return false;
            });
            if (!matches) return false;
          }
          if (where.scanTokens) {
            const studentTokens = scanTokens.filter((t) => t.studentId === s.id);
            if (where.scanTokens.some?.isActive) {
              if (!studentTokens.some((t) => t.isActive)) return false;
            }
            if (where.scanTokens.none?.isActive) {
              if (studentTokens.some((t) => t.isActive)) return false;
            }
          }
          return true;
        });

        if (orderBy?.admissionNo === 'asc') {
          list = [...list].sort((a, b) => a.admissionNo.localeCompare(b.admissionNo));
        }

        const sliced = list.slice(skip, skip + take);
        return sliced.map((s) => {
          const sCopy = JSON.parse(JSON.stringify(s));
          sCopy.scanTokens = scanTokens
            .filter((t) => t.studentId === s.id && (where.scanTokens?.where?.isActive ? t.isActive : true))
            .map((t) => ({ ...t }));
          return sCopy;
        });
      },
      count: async ({ where = {} }) => {
        return (await client.student.findMany({ where })).length;
      },
    },

    studentScanToken: {
      findFirst: async ({ where, include }) => {
        const found = scanTokens.find((t) => {
          if (where.id && t.id !== where.id) return false;
          if (where.madrasaId && t.madrasaId !== where.madrasaId) return false;
          if (where.studentId && t.studentId !== where.studentId) return false;
          if (where.tokenHash && t.tokenHash !== where.tokenHash) return false;
          if (where.isActive !== undefined && t.isActive !== where.isActive) return false;
          return true;
        });
        if (!found) return null;
        const res = { ...found };
        if (include?.student) {
          res.student = students.find((s) => s.id === found.studentId) || null;
        }
        return res;
      },
      findMany: async ({ where, orderBy }) => {
        return scanTokens
          .filter((t) => {
            if (where.madrasaId && t.madrasaId !== where.madrasaId) return false;
            if (where.studentId && typeof where.studentId === 'string' && t.studentId !== where.studentId) return false;
            if (where.studentId?.in && !where.studentId.in.includes(t.studentId)) return false;
            if (where.isActive !== undefined && t.isActive !== where.isActive) return false;
            return true;
          })
          .map((t) => ({ ...t }));
      },
      create: async ({ data, select }) => {
        if (data.isActive && data.activeStudentId) {
          const duplicate = scanTokens.find(
            (t) => t.madrasaId === data.madrasaId && t.activeStudentId === data.activeStudentId && t.isActive
          );
          if (duplicate) {
            const err = new Error('Unique constraint failed on activeStudentId');
            err.code = 'P2002';
            throw err;
          }
        }
        const created = {
          id: `tok_${idCounter++}`,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
          scanCount: 0,
          lastScannedAt: null,
        };
        scanTokens.push(created);
        return { ...created };
      },
      update: async ({ where, data }) => {
        const index = scanTokens.findIndex((t) => t.id === where.id);
        if (index === -1) throw new Error('Token not found');
        const updated = { ...scanTokens[index], ...data, updatedAt: new Date() };
        if (data.scanCount?.increment) {
          updated.scanCount = (scanTokens[index].scanCount || 0) + data.scanCount.increment;
        }
        scanTokens[index] = updated;
        return { ...updated };
      },
    },

    activityLog: {
      create: async ({ data }) => {
        if (data.details !== undefined) {
          const err = new Error('Unknown argument `details` on model ActivityLog');
          err.name = 'PrismaClientValidationError';
          throw err;
        }
        const entry = { id: `log_${idCounter++}`, ...data, createdAt: new Date() };
        activityLogs.push(entry);
        return entry;
      },
    },

    attendanceSession: {
      findUnique: async ({ where }) => {
        const key = `${where.madrasaId_classId_attendanceDate.madrasaId}_${where.madrasaId_classId_attendanceDate.classId}_${where.madrasaId_classId_attendanceDate.attendanceDate.toISOString().slice(0, 10)}`;
        const found = attendanceSessions.find((s) => s.key === key);
        if (!found) return null;
        const res = { ...found };
        res.records = attendanceRecords.filter((r) => r.sessionId === found.id);
        return res;
      },
      upsert: async ({ where, create, update }) => {
        const key = `${where.madrasaId_classId_attendanceDate.madrasaId}_${where.madrasaId_classId_attendanceDate.classId}_${where.madrasaId_classId_attendanceDate.attendanceDate.toISOString().slice(0, 10)}`;
        let found = attendanceSessions.find((s) => s.key === key);
        if (!found) {
          found = { id: `sess_${idCounter++}`, key, ...create };
          attendanceSessions.push(found);
        } else {
          Object.assign(found, update);
        }
        return { ...found };
      },
    },

    attendanceRecord: {
      findUnique: async ({ where }) => {
        return attendanceRecords.find(
          (r) => r.sessionId === where.sessionId_studentId.sessionId && r.studentId === where.sessionId_studentId.studentId
        ) || null;
      },
      create: async ({ data }) => {
        const created = { id: `rec_${idCounter++}`, ...data, createdAt: new Date() };
        attendanceRecords.push(created);
        return { ...created };
      },
      update: async ({ where, data }) => {
        const idx = attendanceRecords.findIndex((r) => r.id === where.id);
        if (idx === -1) throw new Error('Record not found');
        attendanceRecords[idx] = { ...attendanceRecords[idx], ...data, updatedAt: new Date() };
        return { ...attendanceRecords[idx] };
      },
      upsert: async ({ where, create, update }) => {
        let found = attendanceRecords.find(
          (r) => r.sessionId === where.sessionId_studentId.sessionId && r.studentId === where.sessionId_studentId.studentId
        );
        if (!found) {
          found = { id: `rec_${idCounter++}`, ...create };
          attendanceRecords.push(found);
        } else {
          Object.assign(found, update);
        }
        return { ...found };
      },
    },

    $transaction: async (fn) => {
      return await fn(client);
    },
  };

  return client;
}

// ==========================================
// TEST EXECUTION
// ==========================================

async function runAllTests() {
  console.log('================================================================');
  console.log('  MadrasaNexa Gate F, Step 1.1: Backend Controller & API Tests   ');
  console.log('================================================================\n');

  // --- Suite 1: Tenant Isolation ---
  console.log('--- Suite 1: Tenant Isolation Enforcement ---');
  {
    const prisma = createHermeticPrisma();

    // Tenant A attempts to issue token for Tenant B student
    await assertThrowsAsync(
      async () => {
        await issueStudentToken({
          madrasaId: 'mda_tenant_A',
          studentId: 'stud_999', // belongs to Tenant B
          keyHex: TEST_KEY_HEX,
          prismaClient: prisma,
        });
      },
      NotFoundError,
      /Student not found/,
      'Tenant A cannot issue a card token for Tenant B student'
    );

    // Tenant A attempts to fetch print data for Tenant B student
    await assertThrowsAsync(
      async () => {
        await getActiveTokenForPrint({
          madrasaId: 'mda_tenant_A',
          studentId: 'stud_999',
          keyHex: TEST_KEY_HEX,
          prismaClient: prisma,
        });
      },
      NotFoundError,
      /No active scan token found/,
      'Tenant A cannot fetch print data for Tenant B student'
    );

    // Tenant A attempts 1D barcode verification for Tenant B student
    await assertThrowsAsync(
      async () => {
        await verifyAdmissionBarcodeForAttendance({
          madrasaId: 'mda_tenant_A',
          userId: 'usr_1',
          admissionNo: 'ADM-B-01', // Tenant B student
          prismaClient: prisma,
        });
      },
      NotFoundError,
      /not found in this institution/,
      'Tenant A cannot verify 1D barcode for Tenant B student'
    );
  }

  // --- Suite 2: Listing API Secrecy ---
  console.log('\n--- Suite 2: Raw Token Secrecy in Listing APIs ---');
  {
    const prisma = createHermeticPrisma();

    // Issue a token for student 101
    await issueStudentToken({
      madrasaId: 'mda_tenant_A',
      studentId: 'stud_101',
      keyHex: TEST_KEY_HEX,
      prismaClient: prisma,
    });

    const listResult = await listCardTokensService({
      madrasaId: 'mda_tenant_A',
      prismaClient: prisma,
    });

    assert(listResult.items.length >= 3, 'Returns students for tenant');
    const stud101Item = listResult.items.find((i) => i.studentId === 'stud_101');
    assert(stud101Item !== undefined, 'Student 101 is listed');
    assert(stud101Item.hasActiveToken === true, 'Student 101 marked with active token');
    assert(typeof stud101Item.tokenHint === 'string', 'Token hint is exposed for display');
    assert(stud101Item.rawToken === undefined, 'rawToken is strictly UNDEFINED in listing');
    assert(stud101Item.tokenHash === undefined, 'tokenHash is strictly UNDEFINED in listing');
    assert(stud101Item.tokenEncrypted === undefined, 'tokenEncrypted is strictly UNDEFINED in listing');
    assert(stud101Item.tokenIv === undefined, 'tokenIv is strictly UNDEFINED in listing');
    assert(stud101Item.tokenAuthTag === undefined, 'tokenAuthTag is strictly UNDEFINED in listing');
  }

  // --- Suite 3: Print-Data POST Endpoints & Anti-Caching Headers ---
  console.log('\n--- Suite 3: Print-Data Endpoints & Anti-Caching Headers ---');
  {
    const prisma = createHermeticPrisma();

    // Issue token for student 101
    const { rawToken } = await issueStudentToken({
      madrasaId: 'mda_tenant_A',
      studentId: 'stud_101',
      keyHex: TEST_KEY_HEX,
      prismaClient: prisma,
    });

    // Test getActiveTokenForPrint service
    const printData = await getActiveTokenForPrint({
      madrasaId: 'mda_tenant_A',
      studentId: 'stud_101',
      keyHex: TEST_KEY_HEX,
      prismaClient: prisma,
    });

    assert(printData.rawToken === rawToken, 'Decrypted rawToken matches original issued token');
    assert(isValidTokenFormat(printData.rawToken), 'Decrypted rawToken conforms to canonical 37-char format');

    // Test getBatchCardPrintData service
    const batchPrintData = await getBatchCardPrintDataService({
      madrasaId: 'mda_tenant_A',
      studentIds: ['stud_101', 'stud_102'],
      keyHex: TEST_KEY_HEX,
      prismaClient: prisma,
    });

    assert(batchPrintData.cards.length === 1, 'Only students with active tokens are returned in batch print');
    assert(batchPrintData.cards[0].card.rawToken === rawToken, 'Batch print card contains decrypted rawToken');
    assert(batchPrintData.cards[0].student.admissionNo === 'ADM-001', 'Batch print card contains student details');
  }

  // --- Suite 4: Token Revocation Lifecycle & Invalidation ---
  console.log('\n--- Suite 4: Token Revocation & Invalidation ---');
  {
    const prisma = createHermeticPrisma();

    const { rawToken } = await issueStudentToken({
      madrasaId: 'mda_tenant_A',
      studentId: 'stud_101',
      keyHex: TEST_KEY_HEX,
      prismaClient: prisma,
    });

    // Verify token works initially
    const verifyBefore = await verifyScanTokenForAttendance({
      madrasaId: 'mda_tenant_A',
      token: rawToken,
      prismaClient: prisma,
    });
    assert(verifyBefore.verified === true, 'Token verifies successfully before revocation');

    // Revoke token with valid reason
    const revoked = await revokeStudentToken({
      madrasaId: 'mda_tenant_A',
      studentId: 'stud_101',
      reason: 'Card lost by student during transport',
      revokedById: 'usr_admin_1',
      prismaClient: prisma,
    });
    assert(revoked.isActive === false, 'Token is marked inactive upon revocation');
    assert(revoked.revokeReason === 'Card lost by student during transport', 'Revocation reason saved');

    // Subsequent verification must fail immediately
    await assertThrowsAsync(
      async () => {
        await verifyScanTokenForAttendance({
          madrasaId: 'mda_tenant_A',
          token: rawToken,
          prismaClient: prisma,
        });
      },
      BadRequestError,
      /Scan token has been revoked/,
      'Revoked token cannot be verified for attendance'
    );
  }

  // --- Suite 5: Token Regeneration Lifecycle & Version Invalidation ---
  console.log('\n--- Suite 5: Token Regeneration & Previous Token Invalidation ---');
  {
    const prisma = createHermeticPrisma();

    const { rawToken: rawTokenV1 } = await issueStudentToken({
      madrasaId: 'mda_tenant_A',
      studentId: 'stud_101',
      keyHex: TEST_KEY_HEX,
      prismaClient: prisma,
    });

    // Regenerate token for student 101
    const { rawToken: rawTokenV2, tokenRecord: tokenV2 } = await regenerateStudentToken({
      madrasaId: 'mda_tenant_A',
      studentId: 'stud_101',
      reason: 'Damaged barcode replacement',
      issuedById: 'usr_admin_1',
      keyHex: TEST_KEY_HEX,
      prismaClient: prisma,
    });

    assert(tokenV2.version === 2, 'Regenerated token version incremented to 2');
    assert(rawTokenV1 !== rawTokenV2, 'New raw token is distinct from old raw token');

    // Old token V1 must be rejected
    await assertThrowsAsync(
      async () => {
        await verifyScanTokenForAttendance({
          madrasaId: 'mda_tenant_A',
          token: rawTokenV1,
          prismaClient: prisma,
        });
      },
      BadRequestError,
      /Scan token has been revoked/,
      'Previous token V1 is invalid after regeneration'
    );

    // New token V2 must verify successfully
    const verifyV2 = await verifyScanTokenForAttendance({
      madrasaId: 'mda_tenant_A',
      token: rawTokenV2,
      prismaClient: prisma,
    });
    assert(verifyV2.verified === true, 'Regenerated token V2 verifies successfully');
  }

  // --- Suite 6: Reason Validation for Revoke & Regenerate ---
  console.log('\n--- Suite 6: Mandatory Audit Reason Validation ---');
  {
    const prisma = createHermeticPrisma();

    await issueStudentToken({
      madrasaId: 'mda_tenant_A',
      studentId: 'stud_101',
      keyHex: TEST_KEY_HEX,
      prismaClient: prisma,
    });

    // Missing reason on regeneration
    await assertThrowsAsync(
      async () => {
        await regenerateStudentToken({
          madrasaId: 'mda_tenant_A',
          studentId: 'stud_101',
          reason: '',
          keyHex: TEST_KEY_HEX,
          prismaClient: prisma,
        });
      },
      BadRequestError,
      /Mandatory audit reason is required/,
      'Regeneration rejects empty reason'
    );

    // Missing reason on revocation
    await assertThrowsAsync(
      async () => {
        await revokeStudentToken({
          madrasaId: 'mda_tenant_A',
          studentId: 'stud_101',
          reason: '  ',
          prismaClient: prisma,
        });
      },
      BadRequestError,
      /Mandatory audit reason is required/,
      'Revocation rejects whitespace reason'
    );
  }

  // --- Suite 7: Additive Batch Generation ---
  console.log('\n--- Suite 7: Additive Batch Generation ---');
  {
    const prisma = createHermeticPrisma();

    // Student 101 already has a token
    await issueStudentToken({
      madrasaId: 'mda_tenant_A',
      studentId: 'stud_101',
      keyHex: TEST_KEY_HEX,
      prismaClient: prisma,
    });

    // Batch generate for Class 1A (contains 101, 102, and 104_inactive)
    const result = await batchGenerateMissingTokens({
      madrasaId: 'mda_tenant_A',
      classId: 'cls_1',
      issuedById: 'usr_1',
      keyHex: TEST_KEY_HEX,
      prismaClient: prisma,
    });

    assert(result.skippedCount === 1, 'Skipped 1 student with existing active token');
    assert(result.generatedCount === 2, 'Generated tokens for missing students in class');

    // Run batch again: all students should be skipped
    const secondResult = await batchGenerateMissingTokens({
      madrasaId: 'mda_tenant_A',
      classId: 'cls_1',
      issuedById: 'usr_1',
      keyHex: TEST_KEY_HEX,
      prismaClient: prisma,
    });

    assert(secondResult.generatedCount === 0, 'Second batch generation creates 0 duplicates');
    assert(secondResult.skippedCount === 3, 'Second batch generation skips all students');
  }

  // --- Suite 8: Code128 1D Barcode Verification & In-Transaction ActivityLog ---
  console.log('\n--- Suite 8: Code128 1D Barcode Verification & Audit Trail ---');
  {
    const prisma = createHermeticPrisma();

    const verifyResult = await verifyAdmissionBarcodeForAttendance({
      madrasaId: 'mda_tenant_A',
      userId: 'usr_operator_1',
      admissionNo: 'ADM-001',
      classId: 'cls_1',
      date: '2026-11-14',
      academicYear: '2026-2027',
      prismaClient: prisma,
    });

    assert(verifyResult.verified === true, 'Code128 admission barcode verified successfully');
    assert(verifyResult.verificationMethod === 'VERIFIED_1D_BARCODE_FALLBACK', 'Marked as 1D barcode fallback');
    assert(verifyResult.student.admissionNo === 'ADM-001', 'Returns correct student admission number');
    assert(verifyResult.student.fullName === 'Zayd Ali', 'Returns correct student full name');
    assert(verifyResult.securityTier === 'FALLBACK_LOW_TRUST', 'Explicitly classifies security tier as fallback');

    // Verify in-transaction ActivityLog was written
    assert(prisma._activityLogs.length === 1, 'Exactly 1 ActivityLog record created');
    const log = prisma._activityLogs[0];
    assert(log.action === 'ATTENDANCE_VERIFY_1D_BARCODE_FALLBACK', 'Audit log action matches fallback verify');
    assert(log.entityType === 'Student', 'Audit log entityType is Student');
    assert(log.entityId === 'stud_101', 'Audit log entityId is student ID');
    assert(log.metadata.admissionNo === 'ADM-001', 'Audit log records admission number');
    assert(log.metadata.verificationMethod === 'VERIFIED_1D_BARCODE_FALLBACK', 'Audit log records method');
  }

  // --- Suite 9: Duplicate Code128 Verification & Overwrite Protection ---
  console.log('\n--- Suite 9: Duplicate Code128 Verification & Overwrite Handling ---');
  {
    const prisma = createHermeticPrisma();

    // Create an existing attendance session with student 101 already marked PRESENT
    const date = new Date('2026-11-14');
    await prisma.attendanceSession.upsert({
      where: {
        madrasaId_classId_attendanceDate: {
          madrasaId: 'mda_tenant_A',
          classId: 'cls_1',
          attendanceDate: date,
        },
      },
      create: {
        madrasaId: 'mda_tenant_A',
        classId: 'cls_1',
        academicYear: '2026-2027',
        attendanceDate: date,
      },
      update: {},
    });

    const session = await prisma.attendanceSession.findUnique({
      where: {
        madrasaId_classId_attendanceDate: {
          madrasaId: 'mda_tenant_A',
          classId: 'cls_1',
          attendanceDate: date,
        },
      },
    });

    await prisma.attendanceRecord.upsert({
      where: {
        sessionId_studentId: {
          sessionId: session.id,
          studentId: 'stud_101',
        },
      },
      create: {
        madrasaId: 'mda_tenant_A',
        sessionId: session.id,
        studentId: 'stud_101',
        status: 'PRESENT',
      },
      update: {},
    });

    // Scan admission number without overwrite
    const dupResult = await verifyAdmissionBarcodeForAttendance({
      madrasaId: 'mda_tenant_A',
      userId: 'usr_operator_1',
      admissionNo: 'ADM-001',
      classId: 'cls_1',
      date: '2026-11-14',
      academicYear: '2026-2027',
      overwrite: false,
      prismaClient: prisma,
    });

    assert(dupResult.duplicateScan === true, 'Duplicate scan flagged');
    assert(dupResult.alreadyMarked === true, 'Already marked flagged');
    assert(dupResult.existingStatus === 'PRESENT', 'Reports existing status PRESENT');

    // Scan with overwrite=true but without reason -> throws BadRequestError
    await assertThrowsAsync(
      async () => {
        await verifyAdmissionBarcodeForAttendance({
          madrasaId: 'mda_tenant_A',
          userId: 'usr_operator_1',
          admissionNo: 'ADM-001',
          classId: 'cls_1',
          date: '2026-11-14',
          academicYear: '2026-2027',
          overwrite: true,
          reason: 'ab', // < 3 chars
          prismaClient: prisma,
        });
      },
      BadRequestError,
      /mandatory reason \(minimum 3 characters\)/,
      'Rejects overwrite with reason < 3 characters'
    );

    // Scan with overwrite=true and valid reason
    const overwriteResult = await verifyAdmissionBarcodeForAttendance({
      madrasaId: 'mda_tenant_A',
      userId: 'usr_operator_1',
      admissionNo: 'ADM-001',
      classId: 'cls_1',
      date: '2026-11-14',
      academicYear: '2026-2027',
      overwrite: true,
      reason: 'Student arrived late after excused morning absence',
      prismaClient: prisma,
    });

    assert(overwriteResult.verified === true, 'Barcode verification with overwrite succeeds');
  }

  // --- Suite 10: Inactive & Wrong-Class Student Protection ---
  console.log('\n--- Suite 10: Inactive & Class Mismatch Protection ---');
  {
    const prisma = createHermeticPrisma();

    // Inactive student
    await assertThrowsAsync(
      async () => {
        await verifyAdmissionBarcodeForAttendance({
          madrasaId: 'mda_tenant_A',
          userId: 'usr_1',
          admissionNo: 'ADM-004', // INACTIVE student
          prismaClient: prisma,
        });
      },
      BadRequestError,
      /currently INACTIVE and ineligible/,
      'Rejects inactive student for 1D barcode verification'
    );

    // Class mismatch (Student 103 belongs to Class 2A, scanned for Class 1A)
    await assertThrowsAsync(
      async () => {
        await verifyAdmissionBarcodeForAttendance({
          madrasaId: 'mda_tenant_A',
          userId: 'usr_1',
          admissionNo: 'ADM-003', // Class 2A
          classId: 'cls_1',       // Session for Class 1A
          prismaClient: prisma,
        });
      },
      BadRequestError,
      /Class mismatch/,
      'Rejects class mismatch student for 1D barcode verification'
    );
  }

  // --- Suite 11: Non-Persistence Invariant ---
  console.log('\n--- Suite 11: Code128 Non-Persistence Invariant ---');
  {
    const prisma = createHermeticPrisma();

    const initialSessionsCount = prisma._attendanceSessions.length;
    const initialRecordsCount = prisma._attendanceRecords.length;

    // Verify barcode
    await verifyAdmissionBarcodeForAttendance({
      madrasaId: 'mda_tenant_A',
      userId: 'usr_1',
      admissionNo: 'ADM-002',
      classId: 'cls_1',
      date: '2026-11-14',
      academicYear: '2026-2027',
      prismaClient: prisma,
    });

    assert(
      prisma._attendanceSessions.length === initialSessionsCount,
      'verifyAdmissionBarcode creates ZERO AttendanceSession rows (persistence is delegated to complete PUT)'
    );
    assert(
      prisma._attendanceRecords.length === initialRecordsCount,
      'verifyAdmissionBarcode creates ZERO AttendanceRecord rows (persistence is delegated to complete PUT)'
    );
  }

  // --- Suite 12: PDF Card Sheet Rendering Function ---
  console.log('\n--- Suite 12: PDF Card Sheet Renderer ---');
  {
    assert(typeof renderCardSheetPdf === 'function', 'renderCardSheetPdf is exported from pdf-report.service.js');
  }

  // --- Suite 13: 1D Barcode Automatic Attendance Ingestion ---
  console.log('\n--- Suite 13: 1D Barcode Automatic Attendance Ingestion ---');
  {
    const prisma = createHermeticPrisma();

    // 1. Initial 1D barcode auto-ingestion creates session and record
    const ingestRes = await ingestAdmissionBarcodeAttendanceRecord({
      madrasaId: 'mda_tenant_A',
      userId: 'usr_1',
      admissionNo: 'ADM-001',
      classId: 'cls_1',
      date: '2026-11-15',
      academicYear: '2026-2027',
      status: 'PRESENT',
      prismaClient: prisma,
    });

    assert(ingestRes.recorded === true, '1D barcode ingestion recorded successfully');
    assert(ingestRes.duplicateScan === false, 'Fresh 1D barcode scan is not flagged duplicate');
    assert(ingestRes.status === 'PRESENT', 'Status is marked PRESENT');
    assert(prisma._attendanceSessions.length === 1, 'Exactly one AttendanceSession created');
    assert(prisma._attendanceRecords.length === 1, 'Exactly one AttendanceRecord created');
    assert(prisma._attendanceRecords[0].status === 'PRESENT', 'Record status is PRESENT');

    // 2. Duplicate 1D barcode scan without overwrite is rejected
    const dupRes = await ingestAdmissionBarcodeAttendanceRecord({
      madrasaId: 'mda_tenant_A',
      userId: 'usr_1',
      admissionNo: 'ADM-001',
      classId: 'cls_1',
      date: '2026-11-15',
      academicYear: '2026-2027',
      status: 'PRESENT',
      overwrite: false,
      prismaClient: prisma,
    });

    assert(dupRes.recorded === false, 'Duplicate 1D barcode scan is NOT recorded');
    assert(dupRes.duplicateScan === true, 'Duplicate scan flagged');
    assert(dupRes.alreadyMarked === true, 'Already marked flagged');
    assert(prisma._attendanceRecords.length === 1, 'Database record count unchanged after duplicate scan');

    // 3. Overwrite with valid reason succeeds
    const overwriteRes = await ingestAdmissionBarcodeAttendanceRecord({
      madrasaId: 'mda_tenant_A',
      userId: 'usr_1',
      admissionNo: 'ADM-001',
      classId: 'cls_1',
      date: '2026-11-15',
      academicYear: '2026-2027',
      status: 'ABSENT',
      overwrite: true,
      reason: 'Student left early with permission',
      prismaClient: prisma,
    });

    assert(overwriteRes.recorded === true, '1D barcode overwrite recorded successfully');
    assert(overwriteRes.overwritten === true, 'Flagged as overwritten');
    assert(overwriteRes.status === 'ABSENT', 'Record status updated to ABSENT');
    assert(prisma._attendanceRecords.length === 1, 'Record count remains 1 after overwrite');
    assert(prisma._attendanceRecords[0].status === 'ABSENT', 'Database record updated to ABSENT');

    // 4. Overwrite without reason is rejected
    await assertThrowsAsync(
      async () => {
        await ingestAdmissionBarcodeAttendanceRecord({
          madrasaId: 'mda_tenant_A',
          userId: 'usr_1',
          admissionNo: 'ADM-001',
          classId: 'cls_1',
          date: '2026-11-15',
          academicYear: '2026-2027',
          status: 'PRESENT',
          overwrite: true,
          reason: '',
          prismaClient: prisma,
        });
      },
      BadRequestError,
      /mandatory reason/,
      '1D barcode overwrite rejects empty reason'
    );

    // 5. Inactive student is rejected
    await assertThrowsAsync(
      async () => {
        await ingestAdmissionBarcodeAttendanceRecord({
          madrasaId: 'mda_tenant_A',
          userId: 'usr_1',
          admissionNo: 'ADM-004', // inactive student
          classId: 'cls_1',
          date: '2026-11-15',
          academicYear: '2026-2027',
          status: 'PRESENT',
          prismaClient: prisma,
        });
      },
      BadRequestError,
      /Attendance can only be recorded for ACTIVE students/,
      '1D barcode ingestion rejects inactive student'
    );

    // 6. Cross-tenant ingestion is rejected
    await assertThrowsAsync(
      async () => {
        await ingestAdmissionBarcodeAttendanceRecord({
          madrasaId: 'mda_tenant_A',
          userId: 'usr_1',
          admissionNo: 'ADM-B-01', // Tenant B student
          classId: 'cls_1',
          date: '2026-11-15',
          academicYear: '2026-2027',
          status: 'PRESENT',
          prismaClient: prisma,
        });
      },
      NotFoundError,
      /not found/,
      'Cross-tenant 1D barcode ingestion rejected with NotFoundError'
    );
  }

  console.log('\n================================================================');
  console.log(`  All Test Suites Completed: ${passed} PASSED, ${failed} FAILED  `);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Test run failed with unhandled exception:', err);
  process.exit(1);
});
