import './setup-test-env.js';
import assert from 'assert';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma.js';

// Ensure prisma.classroom mock holder exists in offline environment
prisma.classroom = prisma.classroom || {};
prisma.madrasa = prisma.madrasa || {};
prisma.activityLog = prisma.activityLog || {};
prisma.activityLog.create = async () => ({});

import {
  generateRoomToken,
  listClassrooms,
  getClassroomById,
  createClassroom,
  updateClassroom,
  regenerateClassroomQr,
  revokeClassroomQr,
  activateClassroom,
  getClassroomQrPrintData,
} from '../src/services/classroom.service.js';
import { createPortalAccountForUstadh } from '../src/services/ustadh.service.js';
import {
  createSchedule,
  updateSchedule,
  listSchedules,
  formatScheduleResponse,
} from '../src/services/ustadh-schedule.service.js';
import {
  createClassroomSchema,
  updateClassroomSchema,
} from '../src/validations/classroom.validation.js';
import {
  createPortalAccountSchema,
} from '../src/validations/ustadh.validation.js';

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

console.log('\n================================================================');
console.log('  MadrasaNexa Phase 4E-4: Admin Integration Offline Unit Tests');
console.log('  (Classroom QR Service, Portal Provisioning, Schedule Room Links)');
console.log('================================================================\n');

// =============================================================================
// Group 1: Classroom Validations & Token Generation
// =============================================================================
console.log('Group 1: Classroom Validations & Token Generation');

test('generateRoomToken generates well-formed tokens with approved 74-char crypto format', () => {
  const token = generateRoomToken('tenant_colombo_123');
  assert.ok(token.startsWith('mnx_rm_v1_'));
  assert.strictEqual(token.length, 74);
  assert.ok(/^mnx_rm_v1_[0-9a-f]{64}$/.test(token));
});

test('createClassroomSchema accepts valid classroom data', () => {
  const valid = createClassroomSchema.parse({
    name: 'Main Lecture Hall A',
    roomNumber: '101',
    facilities: 'Projector, Whiteboard, AC',
    capacity: 45,
  });
  assert.strictEqual(valid.roomNumber, '101');
  assert.strictEqual(valid.capacity, 45);
});

test('createClassroomSchema rejects missing name or roomNumber', () => {
  assert.throws(() => {
    createClassroomSchema.parse({ facilities: 'AC only' });
  });
});

test('updateClassroomSchema allows partial updates and nullable facilities', () => {
  const parsed = updateClassroomSchema.parse({
    name: 'Updated Name',
    facilities: null,
    capacity: 50,
  });
  assert.strictEqual(parsed.name, 'Updated Name');
  assert.strictEqual(parsed.facilities, null);
  assert.strictEqual(parsed.capacity, 50);
});

// =============================================================================
// Group 2: Classroom Service Lifecycle & Tenant Boundaries
// =============================================================================
console.log('\nGroup 2: Classroom Service Lifecycle & Tenant Boundaries');

await testAsync('createClassroom creates classroom with active status and unique roomToken', async () => {
  const origFind = prisma.classroom.findFirst;
  const origCreate = prisma.classroom.create;

  prisma.classroom.findFirst = async () => null; // No duplicate roomNumber
  let createdData = null;
  prisma.classroom.create = async ({ data, include }) => {
    createdData = data;
    return {
      id: 'cr_new_1',
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
      _count: { schedules: 0 },
    };
  };

  try {
    const res = await createClassroom('madrasa_alpha', 'admin_1', {
      name: 'Hifz Room 1',
      roomNumber: 'H1',
      capacity: 25,
    });

    assert.strictEqual(res.name, 'Hifz Room 1');
    assert.strictEqual(res.roomNumber, 'H1');
    assert.strictEqual(res.isActive, true);
    assert.ok(res.roomToken.startsWith('mnx_rm_v1_'));
    assert.strictEqual(res.roomToken.length, 74);
    assert.strictEqual(createdData.madrasaId, 'madrasa_alpha');
  } finally {
    prisma.classroom.findFirst = origFind;
    prisma.classroom.create = origCreate;
  }
});

await testAsync('createClassroom prevents duplicate room numbers in same tenant', async () => {
  const origFind = prisma.classroom.findFirst;
  prisma.classroom.findFirst = async () => ({ id: 'cr_existing', roomNumber: '101' });

  try {
    await assert.rejects(
      async () => {
        await createClassroom('madrasa_alpha', 'admin_1', {
          name: 'Another Hall',
          roomNumber: '101',
        });
      },
      /already exists in this institution/
    );
  } finally {
    prisma.classroom.findFirst = origFind;
  }
});

await testAsync('revokeClassroomQr soft-deactivates classroom (isActive = false)', async () => {
  const origFind = prisma.classroom.findFirst;
  const origUpdate = prisma.classroom.update;

  prisma.classroom.findFirst = async () => ({
    id: 'cr_revoke_me',
    madrasaId: 'madrasa_alpha',
    roomNumber: '102',
    name: 'Kitab Hall',
    isActive: true,
  });

  let updateArg = null;
  prisma.classroom.update = async ({ where, data }) => {
    updateArg = data;
    return {
      id: 'cr_revoke_me',
      madrasaId: 'madrasa_alpha',
      roomNumber: '102',
      name: 'Kitab Hall',
      isActive: data.isActive,
      roomToken: 'MNX-RM-REVOKED',
      _count: { schedules: 3 },
    };
  };

  try {
    const res = await revokeClassroomQr('madrasa_alpha', 'cr_revoke_me', 'admin_1');
    assert.strictEqual(updateArg.isActive, false);
    assert.strictEqual(res.isActive, false);
  } finally {
    prisma.classroom.findFirst = origFind;
    prisma.classroom.update = origUpdate;
  }
});

await testAsync('regenerateClassroomQr generates fresh roomToken and updates classroom', async () => {
  const origFind = prisma.classroom.findFirst;
  const origUpdate = prisma.classroom.update;

  prisma.classroom.findFirst = async () => ({
    id: 'cr_regen',
    madrasaId: 'madrasa_alpha',
    roomNumber: '103',
    name: 'Lecture Hall 3',
    roomToken: 'OLD-TOKEN-1234',
    isActive: true,
  });

  let updateData = null;
  prisma.classroom.update = async ({ where, data }) => {
    updateData = data;
    return {
      id: 'cr_regen',
      madrasaId: 'madrasa_alpha',
      roomNumber: '103',
      name: 'Lecture Hall 3',
      roomToken: data.roomToken,
      isActive: true,
      _count: { schedules: 1 },
    };
  };

  try {
    const res = await regenerateClassroomQr('madrasa_alpha', 'cr_regen', 'admin_1');
    assert.notStrictEqual(res.roomToken, 'OLD-TOKEN-1234');
    assert.ok(res.roomToken.startsWith('mnx_rm_v1_'));
    assert.strictEqual(res.roomToken.length, 74);
    assert.strictEqual(updateData.roomToken, res.roomToken);
  } finally {
    prisma.classroom.findFirst = origFind;
    prisma.classroom.update = origUpdate;
  }
});

await testAsync('getClassroomQrPrintData returns structured plaque payload and architectural disclaimer', async () => {
  const origFind = prisma.classroom.findFirst;
  const origFindMadrasa = prisma.madrasa.findUnique;

  prisma.classroom.findFirst = async () => ({
    id: 'cr_print_1',
    madrasaId: 'madrasa_alpha',
    roomNumber: '201',
    name: 'Primary Hall',
    facilities: 'Sound system, Carpeted',
    roomToken: 'MNX-RM-PLAQUE-TOKEN-99',
    isActive: true,
    _count: { schedules: 2 },
  });

  prisma.madrasa.findUnique = async () => ({
    id: 'madrasa_alpha',
    name: 'Madrasa Al-Hikmah',
    code: 'HIKMAH',
    address: 'Colombo 10, Sri Lanka',
    phone: '+94112345678',
  });

  try {
    const printData = await getClassroomQrPrintData('madrasa_alpha', 'cr_print_1');
    assert.strictEqual(printData.classroom.roomNumber, '201');
    assert.strictEqual(printData.classroom.roomToken, 'MNX-RM-PLAQUE-TOKEN-99');
    assert.strictEqual(printData.institution.name, 'Madrasa Al-Hikmah');
    assert.strictEqual(printData.plaqueStandard.type, 'PERMANENT_VENUE_PLAQUE');
    assert.ok(printData.plaqueStandard.securityNotice.includes('Static QR codes do not certify continuous attendance'));
  } finally {
    prisma.classroom.findFirst = origFind;
    prisma.madrasa.findUnique = origFindMadrasa;
  }
});

// =============================================================================
// Group 3: Ustadh Portal Account Provisioning Invariants
// =============================================================================
console.log('\nGroup 3: Ustadh Portal Account Provisioning Invariants');

test('createPortalAccountSchema validates email and password constraints', () => {
  const valid = createPortalAccountSchema.parse({
    email: 'ustadh.test@madrasanexa.lk',
    password: 'SecurePassword123!',
    mustChangePassword: true,
  });
  assert.strictEqual(valid.email, 'ustadh.test@madrasanexa.lk');
  assert.strictEqual(valid.mustChangePassword, true);
});

await testAsync('createPortalAccountForUstadh creates TEACHER User and links Ustadh profile in transaction', async () => {
  const origFindUstadh = prisma.ustadh.findFirst;
  const origFindUser = prisma.user.findFirst;
  const origTx = prisma.$transaction;

  prisma.ustadh.findFirst = async () => ({
    id: 'ustadh_123',
    madrasaId: 'madrasa_alpha',
    ustadhCode: 'UST-015',
    fullName: 'Mawlana Tariq',
    email: 'tariq@madrasanexa.lk',
    phoneNumber: '+94771234567',
    baseMonthlySalary: 55000,
    isActive: true,
    userId: null,
  });

  prisma.user.findFirst = async () => null; // Email available

  let txCreatedUser = null;
  let txUpdatedUstadh = null;

  prisma.$transaction = async (cb) => {
    const fakeTx = {
      user: {
        create: async ({ data }) => {
          txCreatedUser = data;
          return {
            id: 'user_new_456',
            ...data,
            role: 'TEACHER',
            isActive: true,
          };
        },
      },
      ustadh: {
        update: async ({ where, data }) => {
          txUpdatedUstadh = data;
          return {
            id: 'ustadh_123',
            madrasaId: 'madrasa_alpha',
            ustadhCode: 'UST-015',
            fullName: 'Mawlana Tariq',
            email: 'tariq@madrasanexa.lk',
            phoneNumber: '+94771234567',
            baseMonthlySalary: 55000,
            isActive: true,
            userId: data.userId,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        },
      },
    };
    return cb(fakeTx);
  };

  try {
    const res = await createPortalAccountForUstadh('madrasa_alpha', 'ustadh_123', 'admin_1', {
      email: 'tariq@madrasanexa.lk',
      mustChangePassword: true,
    });

    assert.strictEqual(res.user.role, 'TEACHER');
    assert.strictEqual(res.user.email, 'tariq@madrasanexa.lk');
    assert.strictEqual(res.user.mustChangePassword, true);
    assert.strictEqual(txCreatedUser.role, 'TEACHER');
    assert.strictEqual(txCreatedUser.madrasaId, 'madrasa_alpha');
    assert.strictEqual(txUpdatedUstadh.userId, 'user_new_456');
    assert.strictEqual(res.ustadh.hasPortalAccess, true);
    assert.ok(res.user.temporaryPassword); // Auto-generated temporary password
  } finally {
    prisma.ustadh.findFirst = origFindUstadh;
    prisma.user.findFirst = origFindUser;
    prisma.$transaction = origTx;
  }
});

await testAsync('createPortalAccountForUstadh blocks duplicate creation if portal account already exists', async () => {
  const origFindUstadh = prisma.ustadh.findFirst;

  prisma.ustadh.findFirst = async () => ({
    id: 'ustadh_already_linked',
    madrasaId: 'madrasa_alpha',
    ustadhCode: 'UST-001',
    fullName: 'Ustadh Existing',
    userId: 'user_already_linked_999',
  });

  try {
    await assert.rejects(
      async () => {
        await createPortalAccountForUstadh('madrasa_alpha', 'ustadh_already_linked', 'admin_1', {});
      },
      /already has a linked portal user account/
    );
  } finally {
    prisma.ustadh.findFirst = origFindUstadh;
  }
});

// =============================================================================
// Group 4: Ustadh Schedule Classroom Integration
// =============================================================================
console.log('\nGroup 4: Ustadh Schedule Classroom Integration');

test('formatScheduleResponse maps classroomId and classroom object cleanly', () => {
  const scheduleRow = {
    id: 'sch_1',
    madrasaId: 'tenant_1',
    ustadhId: 'ustadh_1',
    classId: 'class_1',
    subjectId: 'sub_1',
    classroomId: 'room_101',
    dayOfWeek: 'MONDAY',
    startMinutes: 540,
    endMinutes: 600,
    effectiveFrom: new Date('2026-01-01'),
    effectiveTo: null,
    isActive: true,
    ustadh: { fullName: 'Ustadh Ali' },
    class: { name: 'Grade 10' },
    subject: { name: 'Fiqh' },
    classroom: { id: 'room_101', name: 'Main Hall', roomNumber: '101', facilities: 'AC' },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const formatted = formatScheduleResponse(scheduleRow);
  assert.strictEqual(formatted.classroomId, 'room_101');
  assert.strictEqual(formatted.classroom.name, 'Main Hall');
  assert.strictEqual(formatted.classroom.roomNumber, '101');
});

console.log('\n================================================================');
console.log(`  Tests execution finished: ${passedTests} / ${totalTests} passed (${failedTests} failed)`);
console.log('================================================================\n');

if (failedTests > 0) {
  process.exit(1);
}
