/**
 * MadrasaNexa Phase 02 – Gate E, Step 3: Scan Verification & Attendance Ingestion Unit Tests
 *
 * Requirements:
 * - Validates canonical 37-character format validation prior to DB lookup.
 * - Validates cryptographic verification using existing scan-token-crypto utility.
 * - Validates tenant isolation, anti-enumeration IDOR safety, and status verification.
 * - Validates duplicate scan detection and prevention of silent attendance overwriting.
 * - Validates ingestion transaction and manual attendance compatibility.
 * - Enforces zero leakage of raw tokens, hashes, ciphertext, or keys.
 * - Uses hermetic in-memory mock engine with exact Prisma relational models and constraints.
 * - Strictly zero fake records inserted in live database.
 */

import {
  verifyScanTokenForAttendance,
  ingestScannedAttendanceRecord,
  getClassDailyAttendance,
  saveClassDailyAttendance,
} from '../src/services/attendance.service.js';
import {
  verifyScanTokenSchema,
  ingestScannedAttendanceSchema,
} from '../src/validations/attendance.validation.js';
import {
  generateRawToken,
  hashToken,
  deriveTokenHint,
  encryptToken,
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

const TEST_KEY_HEX = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

/**
 * Creates an in-memory mock Prisma client modeling classes, students, tokens, sessions, and records.
 */
function createMockPrismaClient() {
  const classes = [
    { id: 'cls_1', madrasaId: 'mda_tenant_A', name: 'Class 1A', code: 'C1A' },
    { id: 'cls_2', madrasaId: 'mda_tenant_A', name: 'Class 2A', code: 'C2A' },
    { id: 'cls_b', madrasaId: 'mda_tenant_B', name: 'Tenant B Class', code: 'TB1' },
  ];

  const students = [
    {
      id: 'stud_101',
      madrasaId: 'mda_tenant_A',
      classId: 'cls_1',
      admissionNo: 'ADM-001',
      fullName: 'Zayd Ali',
      status: 'ACTIVE',
      admissionDate: new Date('2026-01-01'),
      class: classes[0],
    },
    {
      id: 'stud_102',
      madrasaId: 'mda_tenant_A',
      classId: 'cls_1',
      admissionNo: 'ADM-002',
      fullName: 'Bilal Umar',
      status: 'ACTIVE',
      admissionDate: new Date('2026-01-01'),
      class: classes[0],
    },
    {
      id: 'stud_103',
      madrasaId: 'mda_tenant_A',
      classId: 'cls_2',
      admissionNo: 'ADM-003',
      fullName: 'Tariq Hassan',
      status: 'ACTIVE',
      admissionDate: new Date('2026-01-01'),
      class: classes[1],
    },
    {
      id: 'stud_inactive',
      madrasaId: 'mda_tenant_A',
      classId: 'cls_1',
      admissionNo: 'ADM-004',
      fullName: 'Withdrawn Student',
      status: 'INACTIVE',
      admissionDate: new Date('2026-01-01'),
      class: classes[0],
    },
    {
      id: 'stud_future',
      madrasaId: 'mda_tenant_A',
      classId: 'cls_1',
      admissionNo: 'ADM-005',
      fullName: 'Future Student',
      status: 'ACTIVE',
      admissionDate: new Date('2026-12-01'), // Admitted after test session date (2026-11-13)
      class: classes[0],
    },
    {
      id: 'stud_tenant_b',
      madrasaId: 'mda_tenant_B',
      classId: 'cls_b',
      admissionNo: 'ADM-B-01',
      fullName: 'Foreign Student',
      status: 'ACTIVE',
      admissionDate: new Date('2026-01-01'),
      class: classes[2],
    },
  ];

  let scanTokens = [];
  let attendanceSessions = [];
  let attendanceRecords = [];
  let activityLogs = [];
  let sessionIdCounter = 1;
  let recordIdCounter = 1;
  let logIdCounter = 1;

  const mock = {
    class: {
      findFirst: async ({ where }) => {
        return classes.find((c) => {
          if (where.id && c.id !== where.id) return false;
          if (where.madrasaId && c.madrasaId !== where.madrasaId) return false;
          return true;
        }) || null;
      },
    },

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
          if (where.status && s.status !== where.status) return false;
          if (where.admissionDate?.lte) {
            if (new Date(s.admissionDate) > new Date(where.admissionDate.lte)) return false;
          }
          return true;
        });
        if (orderBy?.admissionNo === 'asc') {
          list = [...list].sort((a, b) => a.admissionNo.localeCompare(b.admissionNo));
        }
        return list;
      },
    },

    studentScanToken: {
      findFirst: async ({ where, include }) => {
        const found = scanTokens.find((t) => {
          if (where.id && t.id !== where.id) return false;
          if (where.tokenHash && t.tokenHash !== where.tokenHash) return false;
          if (where.madrasaId && t.madrasaId !== where.madrasaId) return false;
          if (where.studentId && t.studentId !== where.studentId) return false;
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

      update: async ({ where, data }) => {
        const record = scanTokens.find((t) => t.id === where.id);
        if (!record) throw new Error('Token record not found');
        if (data.scanCount?.increment) {
          record.scanCount = (record.scanCount || 0) + data.scanCount.increment;
        }
        if (data.lastScannedAt) {
          record.lastScannedAt = data.lastScannedAt;
        }
        if (data.isActive !== undefined) record.isActive = data.isActive;
        if (data.activeStudentId !== undefined) record.activeStudentId = data.activeStudentId;
        return record;
      },
    },

    attendanceSession: {
      findUnique: async ({ where, include }) => {
        let session = null;
        if (where.madrasaId_classId_attendanceDate) {
          const { madrasaId, classId, attendanceDate } = where.madrasaId_classId_attendanceDate;
          const dateStr = attendanceDate instanceof Date ? attendanceDate.toISOString().slice(0, 10) : String(attendanceDate).slice(0, 10);
          session = attendanceSessions.find((s) => {
            const sDateStr = s.attendanceDate instanceof Date
              ? s.attendanceDate.toISOString().slice(0, 10)
              : String(s.attendanceDate).slice(0, 10);
            return s.madrasaId === madrasaId &&
              s.classId === classId &&
              sDateStr === dateStr;
          });
        } else if (where.id) {
          session = attendanceSessions.find((s) => s.id === where.id);
        }

        if (!session) return null;
        const res = { ...session };
        if (include?.records) {
          let recs = attendanceRecords.filter((r) => r.sessionId === session.id);
          if (include.records.where?.studentId) {
            recs = recs.filter((r) => r.studentId === include.records.where.studentId);
          }
          res.records = recs.map((r) => ({
            ...r,
            student: students.find((s) => s.id === r.studentId) || null,
          }));
        }
        return res;
      },

      create: async ({ data }) => {
        const newSession = {
          id: `session_${sessionIdCounter++}`,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        attendanceSessions.push(newSession);
        return newSession;
      },

      upsert: async ({ where, create, update }) => {
        let existing = null;
        if (where.madrasaId_classId_attendanceDate) {
          const { madrasaId, classId, attendanceDate } = where.madrasaId_classId_attendanceDate;
          const dateStr = attendanceDate instanceof Date ? attendanceDate.toISOString().slice(0, 10) : String(attendanceDate).slice(0, 10);
          existing = attendanceSessions.find((s) => {
            const sDateStr = s.attendanceDate instanceof Date
              ? s.attendanceDate.toISOString().slice(0, 10)
              : String(s.attendanceDate).slice(0, 10);
            return s.madrasaId === madrasaId &&
              s.classId === classId &&
              sDateStr === dateStr;
          });
        }
        if (existing) {
          Object.assign(existing, update, { updatedAt: new Date() });
          return existing;
        }
        const created = {
          id: `session_${sessionIdCounter++}`,
          ...create,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        attendanceSessions.push(created);
        return created;
      },
    },

    attendanceRecord: {
      findUnique: async ({ where }) => {
        if (where.sessionId_studentId) {
          const { sessionId, studentId } = where.sessionId_studentId;
          const found = attendanceRecords.find((r) => r.sessionId === sessionId && r.studentId === studentId);
          return found ? { ...found } : null;
        }
        return null;
      },

      create: async ({ data }) => {
        const newRecord = {
          id: `rec_${recordIdCounter++}`,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        attendanceRecords.push(newRecord);
        return newRecord;
      },

      update: async ({ where, data }) => {
        const record = attendanceRecords.find((r) => r.id === where.id);
        if (!record) throw new Error('Attendance record not found');
        Object.assign(record, data, { updatedAt: new Date() });
        return record;
      },

      upsert: async ({ where, create, update }) => {
        let existing = null;
        if (where.sessionId_studentId) {
          const { sessionId, studentId } = where.sessionId_studentId;
          existing = attendanceRecords.find((r) => r.sessionId === sessionId && r.studentId === studentId);
        }
        if (existing) {
          Object.assign(existing, update, { updatedAt: new Date() });
          return existing;
        }
        const created = {
          id: `rec_${recordIdCounter++}`,
          ...create,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        attendanceRecords.push(created);
        return created;
      },
    },

    activityLog: {
      create: async ({ data }) => {
        const log = {
          id: `log_${logIdCounter++}`,
          createdAt: new Date(),
          ...data,
        };
        activityLogs.push(log);
        return log;
      },
    },

    $transaction: async (txFn) => {
      // Snapshot state for atomic rollback simulation
      const sessionSnapshot = JSON.parse(JSON.stringify(attendanceSessions));
      const recordSnapshot = JSON.parse(JSON.stringify(attendanceRecords));
      const tokenSnapshot = JSON.parse(JSON.stringify(scanTokens));
      const activitySnapshot = JSON.parse(JSON.stringify(activityLogs));
      try {
        return await txFn(mock);
      } catch (err) {
        attendanceSessions = sessionSnapshot;
        attendanceRecords = recordSnapshot;
        scanTokens = tokenSnapshot;
        activityLogs = activitySnapshot;
        throw err;
      }
    },

    // Helper to register synthetic tokens in mock
    _addToken: (tokenData) => {
      scanTokens.push({
        id: `tok_${scanTokens.length + 1}`,
        scanCount: 0,
        lastScannedAt: null,
        isActive: true,
        version: 1,
        ...tokenData,
      });
    },

    // Helper to register synthetic students in mock
    _addStudent: (studentData) => {
      const classObj = classes.find((c) => c.id === studentData.classId) || classes[0];
      const newStudent = {
        class: classObj,
        ...studentData,
      };
      students.push(newStudent);
      return newStudent;
    },

    _inspectRecords: () => attendanceRecords,
    _inspectSessions: () => attendanceSessions,
    _inspectTokens: () => scanTokens,
    _inspectActivityLogs: () => activityLogs,
  };

  return mock;
}

/**
 * Creates and registers a valid encrypted scan token in the mock for a student.
 */
function stageStudentToken(mockPrisma, { studentId, madrasaId, prefix = 'MNX1_' }) {
  const rawToken = generateRawToken(prefix);
  const tokenHash = hashToken(rawToken);
  const tokenHint = deriveTokenHint(rawToken);
  const { tokenEncrypted, tokenIv, tokenAuthTag, keyVersion } = encryptToken(rawToken, TEST_KEY_HEX, { keyVersion: 1 });

  mockPrisma._addToken({
    madrasaId,
    studentId,
    tokenHash,
    tokenEncrypted,
    tokenIv,
    tokenAuthTag,
    tokenHint,
    keyVersion,
    activeStudentId: studentId,
  });

  return { rawToken, tokenHash, tokenHint };
}

async function runScanVerificationTests() {
  console.log('================================================================');
  console.log('  MadrasaNexa Gate E, Step 3: Scan Verification & Ingestion Tests ');
  console.log('================================================================\n');

  // --- Suite 1: Canonical Token Format Pre-Validation ---
  console.log('--- Suite 1: Canonical Token Format Pre-Validation ---');
  {
    const mockPrisma = createMockPrismaClient();

    // 1. Non-canonical format: Hyphenated 36-char
    await assertThrowsAsync(
      () => verifyScanTokenForAttendance({
        madrasaId: 'mda_tenant_A',
        token: 'MNX-0123456789abcdef0123456789abcdef',
        prismaClient: mockPrisma,
      }),
      BadRequestError,
      /Invalid token format.*canonical MNX1_ format/,
      'Rejects legacy 36-char hyphenated format before DB lookup'
    );

    // 2. Non-canonical format: Uppercase hex
    await assertThrowsAsync(
      () => verifyScanTokenForAttendance({
        madrasaId: 'mda_tenant_A',
        token: 'MNX1_0123456789ABCDEF0123456789ABCDEF',
        prismaClient: mockPrisma,
      }),
      BadRequestError,
      /Invalid token format/,
      'Rejects uppercase hexadecimal tokens'
    );

    // 3. Truncated or empty token
    await assertThrowsAsync(
      () => verifyScanTokenForAttendance({
        madrasaId: 'mda_tenant_A',
        token: 'MNX1_short',
        prismaClient: mockPrisma,
      }),
      BadRequestError,
      /Invalid token format/,
      'Rejects short/truncated token'
    );

    await assertThrowsAsync(
      () => verifyScanTokenForAttendance({
        madrasaId: 'mda_tenant_A',
        token: '',
        prismaClient: mockPrisma,
      }),
      BadRequestError,
      /Scan token is required/,
      'Rejects empty token string'
    );
  }

  // --- Suite 2: Valid Scan Verification & Metric Increment ---
  console.log('\n--- Suite 2: Valid Scan Verification & Metric Increment ---');
  {
    const mockPrisma = createMockPrismaClient();
    const { rawToken } = stageStudentToken(mockPrisma, { studentId: 'stud_101', madrasaId: 'mda_tenant_A' });

    const result = await verifyScanTokenForAttendance({
      madrasaId: 'mda_tenant_A',
      token: rawToken,
      classId: 'cls_1',
      date: '2026-11-13',
      academicYear: '2026-2027',
      prismaClient: mockPrisma,
    });

    assert(result.verified === true, 'Token verified successfully');
    assert(result.student.id === 'stud_101', 'Returns correct student ID');
    assert(result.student.admissionNo === 'ADM-001', 'Returns correct student admissionNo');
    assert(result.student.fullName === 'Zayd Ali', 'Returns correct student fullName');
    assert(result.student.classId === 'cls_1', 'Returns correct student classId');
    assert(result.student.className === 'Class 1A', 'Returns correct student className');
    assert(result.tokenHint.startsWith('MNX1...'), 'Returns operator display hint');
    assert(result.scanCount === 1, 'Scan count incremented to 1');
    assert(typeof result.scannedAt === 'string', 'Returns scannedAt timestamp');
    assert(result.duplicateScan === false, 'Not marked as duplicate scan');
    assert(result.alreadyMarked === false, 'Not marked as already recorded in session');
    assert(result.suggestedStatus === 'PRESENT', 'Suggested attendance status is PRESENT');

    // Security Invariant Check: Verify NO secrets or raw token details are exposed in response
    assert(result.token === undefined, 'Raw token is NOT exposed in result payload');
    assert(result.rawToken === undefined, 'rawToken key is NOT exposed in result payload');
    assert(result.tokenHash === undefined, 'tokenHash is NOT exposed in result payload');
    assert(result.tokenEncrypted === undefined, 'tokenEncrypted is NOT exposed in result payload');
    assert(result.tokenIv === undefined, 'tokenIv is NOT exposed in result payload');
    assert(result.tokenAuthTag === undefined, 'tokenAuthTag is NOT exposed in result payload');
    assert(result.keyHex === undefined, 'encryption key is NOT exposed in result payload');

    // Second scan increments scanCount again
    const secondScan = await verifyScanTokenForAttendance({
      madrasaId: 'mda_tenant_A',
      token: rawToken,
      prismaClient: mockPrisma,
    });
    assert(secondScan.scanCount === 2, 'Subsequent scan increments scanCount to 2');
  }

  // --- Suite 3: Anti-Enumeration & Tenant Isolation (IDOR Safe) ---
  console.log('\n--- Suite 3: Anti-Enumeration & Tenant Isolation Enforcement ---');
  {
    const mockPrisma = createMockPrismaClient();

    // 1. Stage a token for Tenant B
    const { rawToken: tenantBToken } = stageStudentToken(mockPrisma, {
      studentId: 'stud_tenant_b',
      madrasaId: 'mda_tenant_B',
    });

    // 2. Tenant A attempts to verify Tenant B's token
    await assertThrowsAsync(
      () => verifyScanTokenForAttendance({
        madrasaId: 'mda_tenant_A',
        token: tenantBToken,
        prismaClient: mockPrisma,
      }),
      NotFoundError,
      /Unrecognized or invalid scan token/,
      'Cross-tenant scan returns generic NotFoundError (anti-enumeration / IDOR protection)'
    );

    // 3. Unknown non-existent token with valid canonical format
    const unknownToken = generateRawToken('MNX1_');
    await assertThrowsAsync(
      () => verifyScanTokenForAttendance({
        madrasaId: 'mda_tenant_A',
        token: unknownToken,
        prismaClient: mockPrisma,
      }),
      NotFoundError,
      /Unrecognized or invalid scan token/,
      'Unknown valid-format token returns generic NotFoundError'
    );
  }

  // --- Suite 4: Revoked Token Rejection ---
  console.log('\n--- Suite 4: Revoked Token Rejection ---');
  {
    const mockPrisma = createMockPrismaClient();
    const { rawToken } = stageStudentToken(mockPrisma, { studentId: 'stud_101', madrasaId: 'mda_tenant_A' });

    // Mark token as revoked in mock DB
    const tokens = mockPrisma._inspectTokens();
    tokens[0].isActive = false;
    tokens[0].activeStudentId = null;
    tokens[0].revokedAt = new Date();
    tokens[0].revokeReason = 'REPORTED_LOST_CARD';

    await assertThrowsAsync(
      () => verifyScanTokenForAttendance({
        madrasaId: 'mda_tenant_A',
        token: rawToken,
        prismaClient: mockPrisma,
      }),
      BadRequestError,
      /Scan token has been revoked.*REPORTED_LOST_CARD/,
      'Revoked token rejected with explicit audit reason'
    );
  }

  // --- Suite 5: Ineligible & Mismatched Student Protection ---
  console.log('\n--- Suite 5: Ineligible & Mismatched Student Protection ---');
  {
    const mockPrisma = createMockPrismaClient();

    // 1. Student in Class 1 scanned in Class 2 session
    const { rawToken: tokenClass1 } = stageStudentToken(mockPrisma, { studentId: 'stud_101', madrasaId: 'mda_tenant_A' });

    await assertThrowsAsync(
      () => verifyScanTokenForAttendance({
        madrasaId: 'mda_tenant_A',
        token: tokenClass1,
        classId: 'cls_2', // Class mismatch!
        prismaClient: mockPrisma,
      }),
      BadRequestError,
      /Class mismatch.*Class 1A.*not the selected attendance session/,
      'Rejects student from a different class than the current session'
    );

    // 2. Inactive/withdrawn student
    const { rawToken: tokenInactive } = stageStudentToken(mockPrisma, { studentId: 'stud_inactive', madrasaId: 'mda_tenant_A' });

    await assertThrowsAsync(
      () => verifyScanTokenForAttendance({
        madrasaId: 'mda_tenant_A',
        token: tokenInactive,
        classId: 'cls_1',
        prismaClient: mockPrisma,
      }),
      BadRequestError,
      /is currently INACTIVE and ineligible for attendance/,
      'Rejects inactive/withdrawn student'
    );

    // 3. Admission date after attendance session date
    const { rawToken: tokenFuture } = stageStudentToken(mockPrisma, { studentId: 'stud_future', madrasaId: 'mda_tenant_A' });

    await assertThrowsAsync(
      () => verifyScanTokenForAttendance({
        madrasaId: 'mda_tenant_A',
        token: tokenFuture,
        classId: 'cls_1',
        date: '2026-11-13', // Student admitted 2026-12-01!
        prismaClient: mockPrisma,
      }),
      BadRequestError,
      /was admitted on.*after the attendance date/,
      'Rejects student admitted after the attendance session date'
    );
  }

  // --- Suite 6: Duplicate Scan & Ingestion Without Silent Overwrite ---
  console.log('\n--- Suite 6: Duplicate Scan & Ingestion Protection ---');
  {
    const mockPrisma = createMockPrismaClient();
    const { rawToken } = stageStudentToken(mockPrisma, { studentId: 'stud_101', madrasaId: 'mda_tenant_A' });

    // 1. First scan ingestion for stud_101: records attendance
    const firstIngest = await ingestScannedAttendanceRecord({
      madrasaId: 'mda_tenant_A',
      userId: 'user_ustadh_1',
      token: rawToken,
      classId: 'cls_1',
      date: '2026-11-13',
      academicYear: '2026-2027',
      status: 'PRESENT',
      overwrite: false,
      prismaClient: mockPrisma,
    });

    assert(firstIngest.recorded === true, 'Initial scan ingested successfully');
    assert(firstIngest.duplicateScan === false, 'Not a duplicate scan on initial ingest');
    assert(firstIngest.status === 'PRESENT', 'Status recorded as PRESENT');

    // Verify session and record exist in mock DB
    assert(mockPrisma._inspectSessions().length === 1, 'Attendance session created');
    assert(mockPrisma._inspectRecords().length === 1, 'Attendance record created');

    // 2. Scan verification for same student on same date now detects duplicate scan
    const verifyDuplicate = await verifyScanTokenForAttendance({
      madrasaId: 'mda_tenant_A',
      token: rawToken,
      classId: 'cls_1',
      date: '2026-11-13',
      academicYear: '2026-2027',
      prismaClient: mockPrisma,
    });

    assert(verifyDuplicate.duplicateScan === true, 'verifyScanToken flags duplicateScan = true');
    assert(verifyDuplicate.alreadyMarked === true, 'verifyScanToken flags alreadyMarked = true');
    assert(verifyDuplicate.existingStatus === 'PRESENT', 'verifyScanToken reports existing status');

    // 3. Second ingestion with overwrite: false MUST NOT overwrite silently
    const secondIngest = await ingestScannedAttendanceRecord({
      madrasaId: 'mda_tenant_A',
      userId: 'user_ustadh_1',
      token: rawToken,
      classId: 'cls_1',
      date: '2026-11-13',
      academicYear: '2026-2027',
      status: 'ABSENT', // Attempting to change to ABSENT without overwrite flag
      overwrite: false,
      prismaClient: mockPrisma,
    });

    assert(secondIngest.recorded === false, 'Duplicate scan without overwrite=true is NOT recorded');
    assert(secondIngest.duplicateScan === true, 'Flagged as duplicate scan');
    assert(secondIngest.status === 'PRESENT', 'Original status PRESENT is preserved');
    assert(/Silent overwrite prohibited/.test(secondIngest.message), 'Clear message prohibiting silent overwrite');

    // Record in DB is still PRESENT
    const records = mockPrisma._inspectRecords();
    assert(records[0].status === 'PRESENT', 'Database record remained PRESENT without silent overwrite');

    // 4. Ingestion with explicit overwrite: true updates record
    const overwriteIngest = await ingestScannedAttendanceRecord({
      madrasaId: 'mda_tenant_A',
      userId: 'user_ustadh_1',
      token: rawToken,
      classId: 'cls_1',
      date: '2026-11-13',
      academicYear: '2026-2027',
      status: 'ABSENT',
      overwrite: true,
      reason: 'Correction by authorized teacher',
      prismaClient: mockPrisma,
    });

    assert(overwriteIngest.recorded === true, 'Ingestion with overwrite=true succeeds');
    assert(overwriteIngest.overwritten === true, 'Flagged as overwritten');
    assert(overwriteIngest.status === 'ABSENT', 'Status updated to ABSENT');
    assert(records[0].status === 'ABSENT', 'Database record updated to ABSENT');
  }

  // --- Suite 7: Manual Attendance Workflow Preservation ---
  console.log('\n--- Suite 7: Manual Attendance Workflow Preservation ---');
  {
    const mockPrisma = createMockPrismaClient();

    // 1. Check getClassDailyAttendance for new session
    const dailyGrid = await getClassDailyAttendance('mda_tenant_A', {
      classId: 'cls_1',
      academicYear: '2026-2027',
      date: '2026-11-13',
    }, mockPrisma);

    assert(dailyGrid.isSaved === false, 'Unsaved session returns isSaved = false');
    assert(dailyGrid.classId === 'cls_1', 'Returns requested classId');
    // Eligible active students admitted on/before 2026-11-13 are stud_101 and stud_102 (stud_inactive is inactive, stud_future is admitted in Dec)
    assert(dailyGrid.students.length === 2, 'Returns exactly 2 eligible active students for Class 1');

    // 2. Save manual attendance via saveClassDailyAttendance
    const saved = await saveClassDailyAttendance('mda_tenant_A', 'user_admin', {
      classId: 'cls_1',
      academicYear: '2026-2027',
      date: '2026-11-13',
      records: [
        { studentId: 'stud_101', status: 'PRESENT' },
        { studentId: 'stud_102', status: 'ABSENT' },
      ],
    }, mockPrisma);

    assert(saved.isSaved === true, 'saveClassDailyAttendance completes successfully');
    assert(saved.summary.presentCount === 1, 'Manual attendance present count is 1');
    assert(saved.summary.absentCount === 1, 'Manual attendance absent count is 1');
    assert(saved.summary.attendanceRate === 50.0, 'Manual attendance rate is 50.0%');
  }

  // --- Suite 8: Roster Integrity & Incomplete Session Merging (Fix A – MNX-AUDIT-01) ---
  console.log('\n--- Suite 8: Roster Integrity & Incomplete Session Merging (Fix A - MNX-AUDIT-01) ---');
  {
    const mockPrisma = createMockPrismaClient();

    // 1. Existing session with all student records (complete roster)
    await saveClassDailyAttendance('mda_tenant_A', 'user_admin', {
      classId: 'cls_1',
      academicYear: '2026-2027',
      date: '2026-11-13',
      records: [
        { studentId: 'stud_101', status: 'PRESENT' },
        { studentId: 'stud_102', status: 'ABSENT' },
      ],
    }, mockPrisma);

    const fullSession = await getClassDailyAttendance('mda_tenant_A', {
      classId: 'cls_1',
      academicYear: '2026-2027',
      date: '2026-11-13',
    }, mockPrisma);

    assert(fullSession.isSaved === true, 'Full existing session returns isSaved = true');
    assert(fullSession.students.length === 2, 'Returns both students in complete session');
    assert(fullSession.students[0].status === 'PRESENT', 'Preserves stud_101 PRESENT status');
    assert(fullSession.students[1].status === 'ABSENT', 'Preserves stud_102 ABSENT status');
    assert(fullSession.summary.totalStudents === 2, 'Summary total is 2');
    assert(fullSession.summary.presentCount === 1, 'Summary present count is 1');
    assert(fullSession.summary.absentCount === 1, 'Summary absent count is 1');
    assert(fullSession.summary.attendanceRate === 50.0, 'Summary attendance rate is 50.0%');

    // 2. Existing session with only one recorded student (e.g. created via scan-ingest)
    const mockPartial = createMockPrismaClient();
    const { rawToken } = stageStudentToken(mockPartial, { studentId: 'stud_101', madrasaId: 'mda_tenant_A' });

    // Ingest only stud_101 on 2026-11-14
    await ingestScannedAttendanceRecord({
      madrasaId: 'mda_tenant_A',
      userId: 'user_ustadh_1',
      token: rawToken,
      classId: 'cls_1',
      date: '2026-11-14',
      academicYear: '2026-2027',
      status: 'PRESENT',
      overwrite: false,
      prismaClient: mockPartial,
    });

    assert(mockPartial._inspectRecords().length === 1, 'Database contains exactly 1 recorded student before GET');

    const recordsBeforeGet = mockPartial._inspectRecords().length;
    const partialSession = await getClassDailyAttendance('mda_tenant_A', {
      classId: 'cls_1',
      academicYear: '2026-2027',
      date: '2026-11-14',
    }, mockPartial);
    const recordsAfterGet = mockPartial._inspectRecords().length;

    assert(recordsBeforeGet === recordsAfterGet, 'GET operation creates zero database records');
    assert(partialSession.isSaved === true, 'Partial session returns isSaved = true');
    assert(partialSession.students.length === 2, 'Returns full class roster (2 students) even when session has only 1 record');

    const stud101 = partialSession.students.find((s) => s.studentId === 'stud_101');
    const stud102 = partialSession.students.find((s) => s.studentId === 'stud_102');

    assert(stud101 !== undefined, 'Recorded student stud_101 is included in roster');
    assert(stud101.status === 'PRESENT', 'Recorded student preserves PRESENT status');
    assert(stud102 !== undefined, 'Unrecorded student stud_102 is included in roster');
    assert(stud102.status === null, 'Unrecorded student has status = null (unmarked)');

    // No duplicate IDs
    const studentIds = partialSession.students.map((s) => s.studentId);
    assert(new Set(studentIds).size === studentIds.length, 'No duplicate student IDs in merged roster');

    // Ordering by admissionNo
    assert(partialSession.students[0].admissionNo === 'ADM-001', 'First student is ADM-001');
    assert(partialSession.students[1].admissionNo === 'ADM-002', 'Second student is ADM-002');

    // Summary calculation over full roster
    assert(partialSession.summary.totalStudents === 2, 'Summary total reflects full roster (2)');
    assert(partialSession.summary.presentCount === 1, 'Summary present count is 1');
    assert(partialSession.summary.absentCount === 0, 'Summary absent count is 0');
    assert(partialSession.summary.attendanceRate === 50.0, 'Summary attendance rate reflects present / total (50.0%)');

    // Inactive and future students excluded
    assert(!partialSession.students.some((s) => s.studentId === 'stud_inactive'), 'Inactive student excluded from roster');
    assert(!partialSession.students.some((s) => s.studentId === 'stud_future'), 'Future admitted student excluded from roster');

    // 3. Existing session with several missing students (3 active students in class)
    const mockMulti = createMockPrismaClient();
    mockMulti._addStudent({
      id: 'stud_104',
      madrasaId: 'mda_tenant_A',
      classId: 'cls_1',
      admissionNo: 'ADM-003B',
      fullName: 'Usman Farooq',
      status: 'ACTIVE',
      admissionDate: new Date('2026-01-01'),
    });

    const { rawToken: rawToken101 } = stageStudentToken(mockMulti, { studentId: 'stud_101', madrasaId: 'mda_tenant_A' });
    await ingestScannedAttendanceRecord({
      madrasaId: 'mda_tenant_A',
      userId: 'user_ustadh_1',
      token: rawToken101,
      classId: 'cls_1',
      date: '2026-11-14',
      academicYear: '2026-2027',
      status: 'PRESENT',
      overwrite: false,
      prismaClient: mockMulti,
    });

    const multiSession = await getClassDailyAttendance('mda_tenant_A', {
      classId: 'cls_1',
      academicYear: '2026-2027',
      date: '2026-11-14',
    }, mockMulti);

    assert(multiSession.students.length === 3, 'Returns all 3 eligible active students when 2 are missing');
    assert(multiSession.students.filter((s) => s.status === null).length === 2, 'Exactly 2 missing students have status = null');
    assert(multiSession.summary.totalStudents === 3, 'Summary total is 3 for multi-student class');
    assert(multiSession.summary.attendanceRate === 33.33, 'Summary attendance rate is 33.33% (1/3)');

    // 4. Existing ABSENT status preservation
    const mockAbsent = createMockPrismaClient();
    const { rawToken: rawTokenAbsent } = stageStudentToken(mockAbsent, { studentId: 'stud_101', madrasaId: 'mda_tenant_A' });
    await ingestScannedAttendanceRecord({
      madrasaId: 'mda_tenant_A',
      userId: 'user_ustadh_1',
      token: rawTokenAbsent,
      classId: 'cls_1',
      date: '2026-11-14',
      academicYear: '2026-2027',
      status: 'ABSENT',
      overwrite: false,
      prismaClient: mockAbsent,
    });

    const absentSession = await getClassDailyAttendance('mda_tenant_A', {
      classId: 'cls_1',
      academicYear: '2026-2027',
      date: '2026-11-14',
    }, mockAbsent);

    assert(absentSession.students[0].status === 'ABSENT', 'Preserves ABSENT status on recorded student');
    assert(absentSession.students[1].status === null, 'Unrecorded student remains status = null');
    assert(absentSession.summary.absentCount === 1, 'Summary absent count is 1');
    assert(absentSession.summary.presentCount === 0, 'Summary present count is 0');

    // 5. Full roster compatibility with manual save workflow after partial scan ingestion
    const completeManualSave = await saveClassDailyAttendance('mda_tenant_A', 'user_admin', {
      classId: 'cls_1',
      academicYear: '2026-2027',
      date: '2026-11-14',
      records: [
        { studentId: 'stud_101', status: 'PRESENT' },
        { studentId: 'stud_102', status: 'PRESENT' },
      ],
    }, mockPartial);

    assert(completeManualSave.isSaved === true, 'Manual save succeeds on partially ingested session');
    assert(completeManualSave.students.length === 2, 'Saved session contains both students');
    assert(completeManualSave.students.every((s) => s.status === 'PRESENT'), 'Both students updated to PRESENT');
    assert(completeManualSave.summary.presentCount === 2, 'Present count updated to 2');
    assert(completeManualSave.summary.attendanceRate === 100.0, 'Attendance rate updated to 100.0%');
    assert(mockPartial._inspectRecords().length === 2, 'Database now contains 2 saved records');
  }

  // --- Suite 9: Academic Year Validation on Existing Session (Fix B – MNX-AUDIT-07) ---
  console.log('\n--- Suite 9: Academic Year Validation (Fix B - MNX-AUDIT-07) ---');
  {
    const mockPrisma = createMockPrismaClient();
    const { rawToken: token101 } = stageStudentToken(mockPrisma, { studentId: 'stud_101', madrasaId: 'mda_tenant_A' });
    const { rawToken: token102 } = stageStudentToken(mockPrisma, { studentId: 'stud_102', madrasaId: 'mda_tenant_A' });

    // 1. Initial ingestion creates session with academicYear '2026-2027'
    const initialIngest = await ingestScannedAttendanceRecord({
      madrasaId: 'mda_tenant_A',
      userId: 'user_ustadh_1',
      token: token101,
      classId: 'cls_1',
      date: '2026-11-14',
      academicYear: '2026-2027',
      status: 'PRESENT',
      overwrite: false,
      prismaClient: mockPrisma,
    });

    assert(initialIngest.recorded === true, 'Initial ingestion with academicYear 2026-2027 succeeds');
    const sessions = mockPrisma._inspectSessions();
    assert(sessions.length === 1, 'Exactly one session created');
    assert(sessions[0].academicYear === '2026-2027', 'Session has academicYear 2026-2027');

    // 2. Ingestion targeting same session with matching academicYear succeeds
    const matchingIngest = await ingestScannedAttendanceRecord({
      madrasaId: 'mda_tenant_A',
      userId: 'user_ustadh_1',
      token: token102,
      classId: 'cls_1',
      date: '2026-11-14',
      academicYear: '2026-2027',
      status: 'PRESENT',
      overwrite: false,
      prismaClient: mockPrisma,
    });

    assert(matchingIngest.recorded === true, 'Matching academicYear ingestion succeeds');
    assert(mockPrisma._inspectRecords().length === 2, 'Both attendance records recorded');

    // 3. Ingestion targeting existing session with mismatching academicYear throws ConflictError
    const recordsBeforeMismatch = mockPrisma._inspectRecords().length;
    await assertThrowsAsync(
      () => ingestScannedAttendanceRecord({
        madrasaId: 'mda_tenant_A',
        userId: 'user_ustadh_1',
        token: token101,
        classId: 'cls_1',
        date: '2026-11-14',
        academicYear: '2025-2026', // Mismatching academic year
        status: 'PRESENT',
        overwrite: true,
        reason: 'Correction test for academic year',
        prismaClient: mockPrisma,
      }),
      ConflictError,
      /Academic year mismatch/,
      'Ingestion with mismatching academicYear is rejected with ConflictError'
    );

    // 4. Verify no new record inserted and session unchanged
    const recordsAfterMismatch = mockPrisma._inspectRecords().length;
    assert(recordsBeforeMismatch === recordsAfterMismatch, 'No attendance records inserted or modified on mismatch');
    assert(sessions[0].academicYear === '2026-2027', 'Session academicYear remained untouched at 2026-2027');
    assert(sessions.length === 1, 'No duplicate or bypass session created');

    // 5. Verification endpoint with mismatching academicYear also rejects with ConflictError
    await assertThrowsAsync(
      () => verifyScanTokenForAttendance({
        madrasaId: 'mda_tenant_A',
        token: token101,
        classId: 'cls_1',
        date: '2026-11-14',
        academicYear: '2025-2026', // Mismatch
        prismaClient: mockPrisma,
      }),
      ConflictError,
      /Academic year mismatch/,
      'Verification with mismatching academicYear is rejected with ConflictError'
    );

    // 6. Verification with matching academicYear succeeds
    const validVerify = await verifyScanTokenForAttendance({
      madrasaId: 'mda_tenant_A',
      token: token101,
      classId: 'cls_1',
      date: '2026-11-14',
      academicYear: '2026-2027', // Matching
      prismaClient: mockPrisma,
    });

    assert(validVerify.verified === true, 'Verification with matching academicYear succeeds');

    // 7. Tenant isolation: Tenant B cannot access or collide with Tenant A's session
    const { rawToken: tokenTenantB } = stageStudentToken(mockPrisma, { studentId: 'stud_tenant_b', madrasaId: 'mda_tenant_B' });
    const tenantBIngest = await ingestScannedAttendanceRecord({
      madrasaId: 'mda_tenant_B',
      userId: 'user_b',
      token: tokenTenantB,
      classId: 'cls_b',
      date: '2026-11-14',
      academicYear: '2025-2026', // Different academic year for Tenant B
      status: 'PRESENT',
      overwrite: false,
      prismaClient: mockPrisma,
    });

    assert(tenantBIngest.recorded === true, 'Tenant B creates separate session with its own academicYear');
    assert(mockPrisma._inspectSessions().length === 2, 'Two isolated tenant sessions exist in mock database');
    assert(mockPrisma._inspectSessions()[0].academicYear === '2026-2027', 'Tenant A session preserved at 2026-2027');
    assert(mockPrisma._inspectSessions()[1].academicYear === '2025-2026', 'Tenant B session created at 2025-2026');
  }

  // --- Suite 10: Mandatory Overwrite Reason & Audit Logging (AUDIT-02) ---
  console.log('\n--- Suite 10: Mandatory Overwrite Reason & Audit Logging (AUDIT-02) ---');
  {
    const mockPrisma = createMockPrismaClient();
    const { rawToken } = stageStudentToken(mockPrisma, { studentId: 'stud_101', madrasaId: 'mda_tenant_A' });

    // Initial ingestion as PRESENT
    await ingestScannedAttendanceRecord({
      madrasaId: 'mda_tenant_A',
      userId: 'user_ustadh_1',
      token: rawToken,
      classId: 'cls_1',
      date: '2026-11-15',
      academicYear: '2026-2027',
      status: 'PRESENT',
      overwrite: false,
      prismaClient: mockPrisma,
    });

    // 1. Overwrite = true without reason throws BadRequestError
    await assertThrowsAsync(
      () => ingestScannedAttendanceRecord({
        madrasaId: 'mda_tenant_A',
        userId: 'user_ustadh_1',
        token: rawToken,
        classId: 'cls_1',
        date: '2026-11-15',
        academicYear: '2026-2027',
        status: 'ABSENT',
        overwrite: true,
        prismaClient: mockPrisma,
      }),
      BadRequestError,
      /mandatory reason.*minimum 3 characters/i,
      'Overwrite without reason throws BadRequestError'
    );

    // 2. Overwrite = true with short reason (< 3 chars) throws BadRequestError
    await assertThrowsAsync(
      () => ingestScannedAttendanceRecord({
        madrasaId: 'mda_tenant_A',
        userId: 'user_ustadh_1',
        token: rawToken,
        classId: 'cls_1',
        date: '2026-11-15',
        academicYear: '2026-2027',
        status: 'ABSENT',
        overwrite: true,
        reason: 'no',
        prismaClient: mockPrisma,
      }),
      BadRequestError,
      /mandatory reason.*minimum 3 characters/i,
      'Overwrite with short reason (< 3 chars) throws BadRequestError'
    );

    // 3. Overwrite = true with valid reason succeeds
    const overwriteResult = await ingestScannedAttendanceRecord({
      madrasaId: 'mda_tenant_A',
      userId: 'user_ustadh_1',
      token: rawToken,
      classId: 'cls_1',
      date: '2026-11-15',
      academicYear: '2026-2027',
      status: 'ABSENT',
      overwrite: true,
      reason: 'Physical head count confirmed absent',
      prismaClient: mockPrisma,
    });

    assert(overwriteResult.recorded === true, 'Overwrite with valid reason succeeds');
    assert(overwriteResult.overwritten === true, 'Flagged as overwritten');
    assert(overwriteResult.status === 'ABSENT', 'Status flipped to ABSENT');

    // 4. Verify activity log is created with non-sensitive audit metadata
    const activityLogs = mockPrisma._inspectActivityLogs();
    assert(activityLogs.length === 1, 'Exactly one activity log record created for overwrite');
    const log = activityLogs[0];
    assert(log.action === 'ATTENDANCE_RECORD_OVERWRITTEN', 'Audit action is ATTENDANCE_RECORD_OVERWRITTEN');
    assert(log.entityType === 'AttendanceRecord', 'Audit entityType is AttendanceRecord');
    assert(log.metadata.previousStatus === 'PRESENT', 'Audit log records previous status PRESENT');
    assert(log.metadata.newStatus === 'ABSENT', 'Audit log records new status ABSENT');
    assert(log.metadata.reason === 'Physical head count confirmed absent', 'Audit log records valid reason');
    assert(log.metadata.studentId === 'stud_101', 'Audit log records studentId');

    // Verify ZERO secret leakage in activity log
    assert(log.metadata.token === undefined, 'No raw token in audit metadata');
    assert(log.metadata.tokenHash === undefined, 'No tokenHash in audit metadata');
    assert(log.metadata.tokenEncrypted === undefined, 'No ciphertext in audit metadata');
    assert(log.metadata.key === undefined, 'No key in audit metadata');
  }

  // --- Suite 11: TOCTOU Consistency & Scan Count Deduplication (AUDIT-03 & AUDIT-04) ---
  console.log('\n--- Suite 11: TOCTOU Consistency & Scan Count Deduplication (AUDIT-03 & AUDIT-04) ---');
  {
    const mockPrisma = createMockPrismaClient();
    const { rawToken } = stageStudentToken(mockPrisma, { studentId: 'stud_101', madrasaId: 'mda_tenant_A' });

    // 1. Step 1: verifyScanTokenForAttendance increments scanCount to 1
    const verifyResult = await verifyScanTokenForAttendance({
      madrasaId: 'mda_tenant_A',
      token: rawToken,
      classId: 'cls_1',
      date: '2026-11-15',
      academicYear: '2026-2027',
      prismaClient: mockPrisma,
    });

    assert(verifyResult.verified === true, 'Initial verification succeeds');
    assert(verifyResult.scanCount === 1, 'Verification increments scanCount to 1');
    const tokenInDb = mockPrisma._inspectTokens().find((t) => t.studentId === 'stud_101');
    assert(tokenInDb.scanCount === 1, 'Token in DB has scanCount = 1 after verify');

    // 2. Step 2: ingestScannedAttendanceRecord immediately following verify does NOT double-increment scanCount
    const ingestResult = await ingestScannedAttendanceRecord({
      madrasaId: 'mda_tenant_A',
      userId: 'user_ustadh_1',
      token: rawToken,
      classId: 'cls_1',
      date: '2026-11-15',
      academicYear: '2026-2027',
      status: 'PRESENT',
      overwrite: false,
      prismaClient: mockPrisma,
    });

    assert(ingestResult.recorded === true, 'Ingestion immediately following verification succeeds');
    assert(tokenInDb.scanCount === 1, 'scanCount remains 1 (prevented double-increment upon verify -> ingest)');

    // 3. Standalone ingest without prior verify DOES increment scanCount
    const { rawToken: token102 } = stageStudentToken(mockPrisma, { studentId: 'stud_102', madrasaId: 'mda_tenant_A' });
    const token102InDb = mockPrisma._inspectTokens().find((t) => t.studentId === 'stud_102');
    assert(token102InDb.scanCount === 0, 'New token starts with scanCount = 0');

    await ingestScannedAttendanceRecord({
      madrasaId: 'mda_tenant_A',
      userId: 'user_ustadh_1',
      token: token102,
      classId: 'cls_1',
      date: '2026-11-15',
      academicYear: '2026-2027',
      status: 'PRESENT',
      overwrite: false,
      prismaClient: mockPrisma,
    });

    assert(token102InDb.scanCount === 1, 'Standalone ingestion increments scanCount to 1');

    // 4. Transactional rollback test: failure inside transaction rolls back token metrics (TOCTOU protection)
    const { rawToken: tokenFail } = stageStudentToken(mockPrisma, { studentId: 'stud_103', madrasaId: 'mda_tenant_A' });
    const tokenFailInDb = mockPrisma._inspectTokens().find((t) => t.studentId === 'stud_103');
    assert(tokenFailInDb.scanCount === 0, 'Fail-test token starts with scanCount = 0');

    const originalUpsert = mockPrisma.attendanceSession.upsert;
    mockPrisma.attendanceSession.upsert = async () => {
      throw new Error('Simulated database write failure');
    };

    try {
      await assertThrowsAsync(
        () => ingestScannedAttendanceRecord({
          madrasaId: 'mda_tenant_A',
          userId: 'user_ustadh_1',
          token: tokenFail,
          classId: 'cls_2',
          date: '2026-11-15',
          academicYear: '2026-2027', // Target class 2
          prismaClient: mockPrisma,
        }),
        Error,
        /Simulated database write failure/,
        'Transaction failure propagates error'
      );
    } finally {
      mockPrisma.attendanceSession.upsert = originalUpsert;
    }

    // Verify token metric was rolled back
    const tokenAfterFail = mockPrisma._inspectTokens().find((t) => t.studentId === 'stud_103');
    assert(tokenAfterFail.scanCount === 0, 'scanCount rolled back to 0 on transaction failure');
  }

  // --- Suite 12: Graceful Prisma P2002 Concurrent Duplicate Handling (AUDIT-05) ---
  console.log('\n--- Suite 12: Graceful Prisma P2002 Concurrent Duplicate Handling (AUDIT-05) ---');
  {
    const mockPrisma = createMockPrismaClient();
    const { rawToken } = stageStudentToken(mockPrisma, { studentId: 'stud_101', madrasaId: 'mda_tenant_A' });

    // Initial ingestion
    await ingestScannedAttendanceRecord({
      madrasaId: 'mda_tenant_A',
      userId: 'user_ustadh_1',
      token: rawToken,
      classId: 'cls_1',
      date: '2026-11-15',
      academicYear: '2026-2027',
      status: 'PRESENT',
      overwrite: false,
      prismaClient: mockPrisma,
    });

    // Create a client that simulates a concurrent race condition by throwing P2002 on attendanceRecord.create
    const raceClient = {
      ...mockPrisma,
      $transaction: async (txFn) => {
        // Simulate race condition: findUnique returns null as if record did not exist yet,
        // but create throws P2002 unique constraint violation
        const customTx = {
          ...mockPrisma,
          attendanceRecord: {
            ...mockPrisma.attendanceRecord,
            findUnique: async () => null, // Race window: hasn't seen the record yet
            create: async () => {
              const p2002 = new Error('Unique constraint failed on the fields: (sessionId, studentId)');
              p2002.code = 'P2002';
              throw p2002;
            },
          },
        };
        return await txFn(customTx);
      },
    };

    const duplicateRaceResult = await ingestScannedAttendanceRecord({
      madrasaId: 'mda_tenant_A',
      userId: 'user_ustadh_2',
      token: rawToken,
      classId: 'cls_1',
      date: '2026-11-15',
      academicYear: '2026-2027',
      status: 'PRESENT',
      overwrite: false,
      prismaClient: raceClient,
    });

    assert(duplicateRaceResult.recorded === false, 'Concurrent P2002 race does not record new row');
    assert(duplicateRaceResult.duplicateScan === true, 'Concurrent P2002 race returns duplicateScan = true');
    assert(duplicateRaceResult.alreadyMarked === true, 'Concurrent P2002 race returns alreadyMarked = true');
    assert(duplicateRaceResult.status === 'PRESENT', 'Concurrent P2002 race returns winning status PRESENT');
    assert(/Concurrent duplicate scan detected/.test(duplicateRaceResult.message), 'Graceful duplicate scan message returned');
  }

  // --- Suite 13: Zod HTTP Schema Pre-Validation (AUDIT-06) ---
  console.log('\n--- Suite 13: Zod HTTP Schema Pre-Validation (AUDIT-06) ---');
  {
    const validCanonicalToken = 'MNX1_0123456789abcdef0123456789abcdef';
    const legacyHyphenatedToken = 'MNX1-01234567-89ab-cdef-0123-456789abcdef';
    const shortToken = 'MNX1_abc123';
    const nonHexToken = 'MNX1_0123456789zzzzzz0123456789zzzz';

    // 1. verifyScanTokenSchema token format validation
    assert(verifyScanTokenSchema.safeParse({ token: validCanonicalToken }).success === true, 'verifyScanTokenSchema accepts canonical token');
    assert(verifyScanTokenSchema.safeParse({ token: legacyHyphenatedToken }).success === false, 'verifyScanTokenSchema rejects legacy hyphenated token');
    assert(verifyScanTokenSchema.safeParse({ token: shortToken }).success === false, 'verifyScanTokenSchema rejects short token');
    assert(verifyScanTokenSchema.safeParse({ token: nonHexToken }).success === false, 'verifyScanTokenSchema rejects non-hex token');
    assert(verifyScanTokenSchema.safeParse({ token: '' }).success === false, 'verifyScanTokenSchema rejects empty token');

    // 2. ingestScannedAttendanceSchema token format validation
    const baseIngestPayload = {
      token: validCanonicalToken,
      classId: 'cls_1',
      date: '2026-11-15',
      academicYear: '2026-2027',
      status: 'PRESENT',
      overwrite: false,
    };

    assert(ingestScannedAttendanceSchema.safeParse(baseIngestPayload).success === true, 'ingestScannedAttendanceSchema accepts valid payload');
    assert(ingestScannedAttendanceSchema.safeParse({ ...baseIngestPayload, token: legacyHyphenatedToken }).success === false, 'ingestScannedAttendanceSchema rejects legacy hyphenated token');
    assert(ingestScannedAttendanceSchema.safeParse({ ...baseIngestPayload, token: shortToken }).success === false, 'ingestScannedAttendanceSchema rejects short token');

    // 3. Overwrite reason validation in schema
    assert(ingestScannedAttendanceSchema.safeParse({ ...baseIngestPayload, overwrite: true }).success === false, 'Schema rejects overwrite = true without reason');
    assert(ingestScannedAttendanceSchema.safeParse({ ...baseIngestPayload, overwrite: true, reason: 'ab' }).success === false, 'Schema rejects overwrite = true with reason < 3 chars');
    assert(ingestScannedAttendanceSchema.safeParse({ ...baseIngestPayload, overwrite: true, reason: 'Valid teacher override' }).success === true, 'Schema accepts overwrite = true with valid reason');
  }

  // --- Suite 14: Activity Logger Isolation Verification (AUDIT-08) ---
  console.log('\n--- Suite 14: Activity Logger Isolation Verification (AUDIT-08) ---');
  {
    const mockPrisma = createMockPrismaClient();

    // Verify saveClassDailyAttendance creates activity log in mock without offline Prisma warning
    await saveClassDailyAttendance('mda_tenant_A', 'user_admin', {
      classId: 'cls_1',
      academicYear: '2026-2027',
      date: '2026-11-15',
      records: [
        { studentId: 'stud_101', status: 'PRESENT' },
        { studentId: 'stud_102', status: 'PRESENT' },
      ],
    }, mockPrisma);

    const logs = mockPrisma._inspectActivityLogs();
    assert(logs.length >= 1, 'saveClassDailyAttendance routed activity log to mock activityLog store');
    assert(logs.some((l) => l.action === 'ATTENDANCE_CREATED' || l.action === 'ATTENDANCE_UPDATED'), 'ATTENDANCE activity logged to mock');
  }

  // --- Suite 15: Atomic ActivityLog Overwrite & Transaction Rollback (Fix A - Step 0.7) ---
  console.log('\n--- Suite 15: Atomic ActivityLog Overwrite & Transaction Rollback (Fix A - Step 0.7) ---');
  {
    const mockPrisma = createMockPrismaClient();
    const { rawToken } = stageStudentToken(mockPrisma, { studentId: 'stud_101', madrasaId: 'mda_tenant_A' });

    // 1. Initial ingestion as PRESENT
    await ingestScannedAttendanceRecord({
      madrasaId: 'mda_tenant_A',
      userId: 'user_ustadh_1',
      token: rawToken,
      classId: 'cls_1',
      date: '2026-11-16',
      academicYear: '2026-2027',
      status: 'PRESENT',
      overwrite: false,
      prismaClient: mockPrisma,
    });

    const initialRecord = mockPrisma._inspectRecords().find((r) => r.studentId === 'stud_101');
    assert(initialRecord.status === 'PRESENT', 'Initial status recorded as PRESENT');

    // 2. Successful overwrite commits status update AND creates ActivityLog inside transaction
    const overwriteResult = await ingestScannedAttendanceRecord({
      madrasaId: 'mda_tenant_A',
      userId: 'user_ustadh_1',
      token: rawToken,
      classId: 'cls_1',
      date: '2026-11-16',
      academicYear: '2026-2027',
      status: 'ABSENT',
      overwrite: true,
      reason: 'Physical head count confirmed absent',
      prismaClient: mockPrisma,
    });

    assert(overwriteResult.recorded === true, 'Overwrite succeeds');
    assert(overwriteResult.status === 'ABSENT', 'Status updated to ABSENT');
    const updatedRecord = mockPrisma._inspectRecords().find((r) => r.studentId === 'stud_101');
    assert(updatedRecord.status === 'ABSENT', 'Database record confirmed ABSENT');

    const activityLogs = mockPrisma._inspectActivityLogs();
    assert(activityLogs.length === 1, 'Exactly one ActivityLog created inside transaction');
    const log = activityLogs[0];
    assert(log.action === 'ATTENDANCE_RECORD_OVERWRITTEN', 'Audit action matches ATTENDANCE_RECORD_OVERWRITTEN');
    assert(log.metadata.previousStatus === 'PRESENT', 'Audit log records previousStatus PRESENT');
    assert(log.metadata.newStatus === 'ABSENT', 'Audit log records newStatus ABSENT');
    assert(log.metadata.studentId === 'stud_101', 'Audit log records studentId');
    assert(log.metadata.admissionNo === 'ADM-001', 'Audit log records admissionNo');
    assert(log.metadata.reason === 'Physical head count confirmed absent', 'Audit log records reason');

    // Sensitive data check
    assert(log.metadata.token === undefined, 'Zero raw token in audit metadata');
    assert(log.metadata.tokenHash === undefined, 'Zero tokenHash in audit metadata');
    assert(log.metadata.tokenEncrypted === undefined, 'Zero ciphertext in audit metadata');

    // 3. Rollback test: If ActivityLog creation fails, the entire transaction rolls back
    const originalLogCreate = mockPrisma.activityLog.create;
    mockPrisma.activityLog.create = async () => {
      throw new Error('Database audit log disk failure');
    };

    try {
      await assertThrowsAsync(
        () => ingestScannedAttendanceRecord({
          madrasaId: 'mda_tenant_A',
          userId: 'user_ustadh_1',
          token: rawToken,
          classId: 'cls_1',
          date: '2026-11-16',
          academicYear: '2026-2027',
          status: 'PRESENT', // Attempting to flip back to PRESENT
          overwrite: true,
          reason: 'Correction attempt during audit failure',
          prismaClient: mockPrisma,
        }),
        Error,
        /Database audit log disk failure/,
        'ActivityLog failure aborts overwrite transaction and propagates error'
      );
    } finally {
      mockPrisma.activityLog.create = originalLogCreate;
    }

    // Verify rollback: status in DB MUST still be ABSENT (was NOT overwritten without audit log)
    const recordAfterRollback = mockPrisma._inspectRecords().find((r) => r.studentId === 'stud_101');
    assert(recordAfterRollback.status === 'ABSENT', 'Attendance status rolled back: remains ABSENT without un-audited change');
  }

  // --- Suite 16: Concurrency-Safe AttendanceSession Upsert (Fix B - Step 0.7) ---
  console.log('\n--- Suite 16: Concurrency-Safe AttendanceSession Upsert (Fix B - Step 0.7) ---');
  {
    const mockPrisma = createMockPrismaClient();
    const { rawToken: token101 } = stageStudentToken(mockPrisma, { studentId: 'stud_101', madrasaId: 'mda_tenant_A' });
    const { rawToken: token102 } = stageStudentToken(mockPrisma, { studentId: 'stud_102', madrasaId: 'mda_tenant_A' });

    // 1. Two different students concurrently initialize the same class/date session
    const [res1, res2] = await Promise.all([
      ingestScannedAttendanceRecord({
        madrasaId: 'mda_tenant_A',
        userId: 'user_ustadh_1',
        token: token101,
        classId: 'cls_1',
        date: '2026-11-17',
        academicYear: '2026-2027',
        status: 'PRESENT',
        overwrite: false,
        prismaClient: mockPrisma,
      }),
      ingestScannedAttendanceRecord({
        madrasaId: 'mda_tenant_A',
        userId: 'user_ustadh_2',
        token: token102,
        classId: 'cls_1',
        date: '2026-11-17',
        academicYear: '2026-2027',
        status: 'PRESENT',
        overwrite: false,
        prismaClient: mockPrisma,
      }),
    ]);

    assert(res1.recorded === true, 'First student recorded successfully during concurrent initialization');
    assert(res2.recorded === true, 'Second student recorded successfully during concurrent initialization');

    // 2. Exactly one AttendanceSession exists in database
    const sessions = mockPrisma._inspectSessions().filter((s) => s.classId === 'cls_1' && s.madrasaId === 'mda_tenant_A');
    assert(sessions.length === 1, 'Exactly one AttendanceSession created despite concurrent scan initialization');
    assert(sessions[0].academicYear === '2026-2027', 'AttendanceSession preserves academicYear 2026-2027');

    // 3. Both student records are recorded in the single session
    const records = mockPrisma._inspectRecords().filter((r) => r.sessionId === sessions[0].id);
    assert(records.length === 2, 'Both student attendance records exist in the session');
    assert(records.some((r) => r.studentId === 'stud_101'), 'Student 101 recorded');
    assert(records.some((r) => r.studentId === 'stud_102'), 'Student 102 recorded');

    // 4. Same-student duplicate scan remains protected against duplicate insert
    const duplicateRes = await ingestScannedAttendanceRecord({
      madrasaId: 'mda_tenant_A',
      userId: 'user_ustadh_1',
      token: token101,
      classId: 'cls_1',
      date: '2026-11-17',
      academicYear: '2026-2027',
      status: 'PRESENT',
      overwrite: false,
      prismaClient: mockPrisma,
    });

    assert(duplicateRes.recorded === false, 'Same-student duplicate scan is NOT recorded as new entry');
    assert(duplicateRes.duplicateScan === true, 'Flagged duplicateScan = true');
    assert(duplicateRes.alreadyMarked === true, 'Flagged alreadyMarked = true');
    assert(mockPrisma._inspectRecords().length === 2, 'Database row count remains unchanged at 2');

    // 5. Academic-year mismatch on existing session remains rejected (AUDIT-07 ConflictError)
    await assertThrowsAsync(
      () => ingestScannedAttendanceRecord({
        madrasaId: 'mda_tenant_A',
        userId: 'user_ustadh_1',
        token: token101,
        classId: 'cls_1',
        date: '2026-11-17',
        academicYear: '2025-2026', // Mismatch against 2026-2027
        status: 'PRESENT',
        overwrite: true,
        reason: 'Testing academic year mismatch on existing session',
        prismaClient: mockPrisma,
      }),
      ConflictError,
      /Academic year mismatch/,
      'Academic year mismatch on upserted session throws ConflictError'
    );

    // 6. Tenant isolation: Tenant B cannot collide with or alter Tenant A's session
    const { rawToken: tokenTenantB } = stageStudentToken(mockPrisma, { studentId: 'stud_tenant_b', madrasaId: 'mda_tenant_B' });
    const tenantBRes = await ingestScannedAttendanceRecord({
      madrasaId: 'mda_tenant_B',
      userId: 'user_tenant_b_ustadh',
      token: tokenTenantB,
      classId: 'cls_b',
      date: '2026-11-17',
      academicYear: '2025-2026',
      status: 'PRESENT',
      overwrite: false,
      prismaClient: mockPrisma,
    });

    assert(tenantBRes.recorded === true, 'Tenant B records attendance in isolated session');
    assert(mockPrisma._inspectSessions().length === 2, 'Two isolated tenant sessions exist');
    assert(mockPrisma._inspectSessions()[0].madrasaId === 'mda_tenant_A', 'Tenant A session intact');
    assert(mockPrisma._inspectSessions()[1].madrasaId === 'mda_tenant_B', 'Tenant B session intact');
  }

  console.log('\n================================================================');
  console.log(`  All Test Suites Completed: ${passed} PASSED, ${failed} FAILED  `);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runScanVerificationTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
