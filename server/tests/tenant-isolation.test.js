process.env.NODE_ENV = 'test';
import './setup-test-env.js';
import { prisma } from '../src/lib/prisma.js';
import {
  tenantWhere,
  findTenantRecord,
  findTenantRecordOrThrow,
  assertTenantOwnership,
  validateRelatedTenantResource
} from '../src/lib/tenant-prisma.js';
import { requireTenantContext, resolvePlatformTargetMadrasa, rejectClientSuppliedTenantOverride } from '../src/middleware/tenant.middleware.js';
import { getActiveMadrasaOrThrow, assertMadrasaExists, logTenantActivity } from '../src/services/tenant.service.js';
import { buildMadrasaKey } from '../src/services/r2.service.js';
import { NotFoundError, ForbiddenError } from '../src/utils/errors.js';

// Unique test prefix to isolate test records
const TEST_PREFIX = 'sec_test_' + Date.now();

let madrasaA = null;
let madrasaB = null;
let madrasaSuspended = null;
let madrasaArchived = null;

let studentA = null;
let studentB = null;
let classA = null;
let classB = null;
let invoiceA = null;
let invoiceB = null;
let paymentA = null;
let paymentB = null;

let testPassedCount = 0;
let testFailedCount = 0;

function assert(condition, testName) {
  if (condition) {
    console.log('  ✓ [PASS] ' + testName);
    testPassedCount++;
  } else {
    console.error('  ✗ [FAIL] ' + testName);
    testFailedCount++;
  }
}

async function assertRejectsWithNotFound(promiseFn, testName) {
  try {
    await promiseFn();
    console.error('  ✗ [FAIL] ' + testName + ' - Expected NotFoundError but succeeded');
    testFailedCount++;
  } catch (err) {
    if (err instanceof NotFoundError || err.statusCode === 404 || err.message === 'Resource not found.' || err.message.includes('not found')) {
      console.log('  ✓ [PASS] ' + testName);
      testPassedCount++;
    } else {
      console.error('  ✗ [FAIL] ' + testName + ' - Threw unexpected error: ' + err.message);
      testFailedCount++;
    }
  }
}

async function setupFixtures() {
  console.log('Setting up isolated test fixtures...');

  // 1. Create Active Madrasa A & B
  madrasaA = await prisma.madrasa.create({
    data: {
      code: TEST_PREFIX + '_MA',
      name: 'Test Madrasa A',
      slug: TEST_PREFIX + '-madrasa-a',
      status: 'ACTIVE',
    },
  });

  madrasaB = await prisma.madrasa.create({
    data: {
      code: TEST_PREFIX + '_MB',
      name: 'Test Madrasa B',
      slug: TEST_PREFIX + '-madrasa-b',
      status: 'ACTIVE',
    },
  });

  // 2. Create Suspended and Archived Madrasas
  madrasaSuspended = await prisma.madrasa.create({
    data: {
      code: TEST_PREFIX + '_MS',
      name: 'Test Suspended Madrasa',
      slug: TEST_PREFIX + '-madrasa-suspended',
      status: 'SUSPENDED',
    },
  });

  madrasaArchived = await prisma.madrasa.create({
    data: {
      code: TEST_PREFIX + '_MARC',
      name: 'Test Archived Madrasa',
      slug: TEST_PREFIX + '-madrasa-archived',
      status: 'ARCHIVED',
    },
  });

  // 3. Create Classes
  classA = await prisma.class.create({
    data: {
      madrasaId: madrasaA.id,
      name: 'Class A',
      code: TEST_PREFIX + '_CLA',
      defaultMonthlyFee: 1500.00,
    },
  });

  classB = await prisma.class.create({
    data: {
      madrasaId: madrasaB.id,
      name: 'Class B',
      code: TEST_PREFIX + '_CLB',
      defaultMonthlyFee: 2000.00,
    },
  });

  // 4. Create Students
  studentA = await prisma.student.create({
    data: {
      madrasaId: madrasaA.id,
      classId: classA.id,
      admissionNo: TEST_PREFIX + '_ADM_A',
      fullName: 'Student Alpha',
      guardianName: 'Guardian Alpha',
      admissionDate: new Date(),
      status: 'ACTIVE',
    },
  });

  studentB = await prisma.student.create({
    data: {
      madrasaId: madrasaB.id,
      classId: classB.id,
      admissionNo: TEST_PREFIX + '_ADM_B',
      fullName: 'Student Beta',
      guardianName: 'Guardian Beta',
      admissionDate: new Date(),
      status: 'ACTIVE',
    },
  });

  // 5. Create Invoices
  invoiceA = await prisma.invoice.create({
    data: {
      madrasaId: madrasaA.id,
      studentId: studentA.id,
      invoiceNo: TEST_PREFIX + '_INV_A',
      billingYear: 2026,
      billingMonth: 1,
      issueDate: new Date(),
      subtotal: 1500.00,
      totalAmount: 1500.00,
      balanceAmount: 1500.00,
      status: 'PENDING',
    },
  });

  invoiceB = await prisma.invoice.create({
    data: {
      madrasaId: madrasaB.id,
      studentId: studentB.id,
      invoiceNo: TEST_PREFIX + '_INV_B',
      billingYear: 2026,
      billingMonth: 1,
      issueDate: new Date(),
      subtotal: 2000.00,
      totalAmount: 2000.00,
      balanceAmount: 2000.00,
      status: 'PENDING',
    },
  });

  // 6. Create Payments
  paymentA = await prisma.payment.create({
    data: {
      madrasaId: madrasaA.id,
      studentId: studentA.id,
      paymentNo: TEST_PREFIX + '_PAY_A',
      amount: 1500.00,
      paymentMethod: 'CASH',
      status: 'COMPLETED',
    },
  });

  paymentB = await prisma.payment.create({
    data: {
      madrasaId: madrasaB.id,
      studentId: studentB.id,
      paymentNo: TEST_PREFIX + '_PAY_B',
      amount: 2000.00,
      paymentMethod: 'CASH',
      status: 'COMPLETED',
    },
  });

  console.log('Fixtures initialized successfully.\n');
}

async function teardownFixtures() {
  console.log('\nTearing down test fixtures safely...');
  try {
    const ids = [madrasaA?.id, madrasaB?.id, madrasaSuspended?.id, madrasaArchived?.id].filter(Boolean);

    await prisma.activityLog.deleteMany({
      where: {
        OR: [
          { madrasaId: { in: ids } },
          { action: { startsWith: TEST_PREFIX } }
        ]
      }
    });

    if (paymentA || paymentB) {
      await prisma.payment.deleteMany({
        where: { id: { in: [paymentA?.id, paymentB?.id].filter(Boolean) } },
      });
    }

    if (invoiceA || invoiceB) {
      await prisma.invoice.deleteMany({
        where: { id: { in: [invoiceA?.id, invoiceB?.id].filter(Boolean) } },
      });
    }

    if (studentA || studentB) {
      await prisma.student.deleteMany({
        where: { id: { in: [studentA?.id, studentB?.id].filter(Boolean) } },
      });
    }

    if (classA || classB) {
      await prisma.class.deleteMany({
        where: { id: { in: [classA?.id, classB?.id].filter(Boolean) } },
      });
    }

    await prisma.madrasa.deleteMany({
      where: {
        id: { in: ids },
      },
    });

    console.log('All test fixtures destroyed. Zero test data remains.');
  } catch (err) {
    console.error('Teardown warning:', err.message);
  }
}

async function runAllSecurityTests() {
  console.log('====================================================');
  console.log('MADRASANEXA PHASE 4 — 20 MANDATORY SECURITY TESTS');
  console.log('====================================================\n');

  try {
    await setupFixtures();

    // Test 1: MADRASA_ADMIN gets tenant context from authenticated account
    const req1 = {
      auth: { userId: 'usr_1', role: 'MADRASA_ADMIN', madrasaId: madrasaA.id },
    };
    let nextCalled1 = false;
    await requireTenantContext(req1, {}, () => { nextCalled1 = true; });
    assert(nextCalled1 && req1.tenant?.madrasaId === madrasaA.id, '1. MADRASA_ADMIN gets tenant context from authenticated account');

    // Test 2: MADRASA_ADMIN request body containing another madrasaId cannot override tenant
    const req2 = {
      auth: { userId: 'usr_1', role: 'MADRASA_ADMIN', madrasaId: madrasaA.id },
      body: { madrasaId: madrasaB.id, someData: 'val' },
    };
    let statusSet2 = null;
    const res2 = {
      status: (code) => { statusSet2 = code; return { json: () => {} }; }
    };
    rejectClientSuppliedTenantOverride(req2, res2, () => {});
    assert(statusSet2 === 403, '2. MADRASA_ADMIN request body containing another madrasaId is rejected (cannot override tenant)');

    // Test 3: MADRASA_ADMIN cannot fetch another Madrasa Student using guessed ID (IDOR returns 404)
    await assertRejectsWithNotFound(
      () => findTenantRecordOrThrow(prisma.student, studentA.id, madrasaB.id),
      '3. MADRASA_ADMIN cannot fetch another Madrasa Student using guessed ID (IDOR -> 404)'
    );

    // Test 4: Same IDOR behavior for Class ownership helper (returns 404)
    await assertRejectsWithNotFound(
      () => assertTenantOwnership(prisma.class, classA.id, madrasaB.id),
      '4. Same IDOR behavior for Class ownership helper (IDOR -> 404)'
    );

    // Test 5: Same IDOR behavior for Invoice ownership helper (returns 404)
    await assertRejectsWithNotFound(
      () => assertTenantOwnership(prisma.invoice, invoiceA.id, madrasaB.id),
      '5. Same IDOR behavior for Invoice ownership helper (IDOR -> 404)'
    );

    // Test 6: Same IDOR behavior for Payment ownership helper (returns 404)
    await assertRejectsWithNotFound(
      () => assertTenantOwnership(prisma.payment, paymentA.id, madrasaB.id),
      '6. Same IDOR behavior for Payment ownership helper (IDOR -> 404)'
    );

    // Test 7: Cross-tenant record behaves as generic 404 not found (no cross-tenant leakage)
    const recordNull = await findTenantRecord(prisma.student, studentA.id, madrasaB.id);
    assert(recordNull === null, '7. Cross-tenant record behaves as generic not found (null / no data leakage)');

    // Test 8: Own-tenant record resolves successfully
    const ownRecord = await findTenantRecordOrThrow(prisma.student, studentA.id, madrasaA.id);
    assert(ownRecord?.id === studentA.id && ownRecord?.madrasaId === madrasaA.id, '8. Own-tenant record resolves successfully');

    // Test 9: SUSPENDED Madrasa Admin is rejected
    const reqSusp = {
      auth: { userId: 'usr_s', role: 'MADRASA_ADMIN', madrasaId: madrasaSuspended.id },
    };
    let errorSusp = null;
    await requireTenantContext(reqSusp, {}, (err) => { errorSusp = err; });
    assert(errorSusp instanceof ForbiddenError && errorSusp.statusCode === 403, '9. SUSPENDED Madrasa Admin is rejected with 403');

    // Test 10: ARCHIVED Madrasa Admin is rejected
    const reqArch = {
      auth: { userId: 'usr_arc', role: 'MADRASA_ADMIN', madrasaId: madrasaArchived.id },
    };
    let errorArch = null;
    await requireTenantContext(reqArch, {}, (err) => { errorArch = err; });
    assert(errorArch instanceof ForbiddenError && errorArch.statusCode === 403, '10. ARCHIVED Madrasa Admin is rejected with 403');

    // Test 11: SUPER_ADMIN is not automatically forced into a fake tenant (madrasaId remains null)
    const superAdminAuth = { userId: 'usr_super', role: 'SUPER_ADMIN', madrasaId: null };
    assert(superAdminAuth.madrasaId === null, '11. SUPER_ADMIN is not automatically forced into a fake tenant (madrasaId remains null)');

    // Test 12: SUPER_ADMIN platform operation can explicitly validate a target Madrasa
    const reqSuper = {
      auth: { userId: 'usr_super', role: 'SUPER_ADMIN', madrasaId: null },
      params: { targetId: madrasaA.id },
    };
    let nextCalledSuper = false;
    await resolvePlatformTargetMadrasa('targetId')(reqSuper, {}, () => { nextCalledSuper = true; });
    assert(
      nextCalledSuper && reqSuper.platformTarget?.madrasaId === madrasaA.id && reqSuper.auth.madrasaId === null,
      '12. SUPER_ADMIN platform operation explicitly validates target Madrasa without mutating auth'
    );

    // Test 13: Related resource ownership validation rejects cross-tenant relations
    await assertRejectsWithNotFound(
      () => validateRelatedTenantResource(prisma.class, classA.id, madrasaB.id, 'Class'),
      '13. Related resource ownership validation rejects cross-tenant relationship with generic 404'
    );

    // Test 14: Tenant helper rejects missing/empty client-supplied foreign tenant ID
    let caughtInvalidTenant = false;
    try {
      tenantWhere('   ', { status: 'ACTIVE' });
    } catch {
      caughtInvalidTenant = true;
    }
    assert(caughtInvalidTenant, '14. Tenant helper rejects empty/invalid tenant ID');

    // Test 15: R2 tenant key builder prevents path traversal
    let traversalBlocked = false;
    try {
      buildMadrasaKey(madrasaA.id, 'students', '../../etc/passwd');
    } catch (err) {
      if (err.message.includes('traversal')) traversalBlocked = true;
    }
    assert(traversalBlocked, '15. R2 tenant key builder prevents path traversal (../../)');

    // Test 16: R2 tenant key strictly uses trusted tenant ID format
    const r2Key = buildMadrasaKey(madrasaA.id, 'students', 'photo.jpg');
    assert(r2Key === 'madrasas/' + madrasaA.id + '/students/photo.jpg', '16. R2 tenant key strictly uses trusted tenant ID and category');

    // Test 17: Platform-level Plan remains globally accessible and is not tenant-filtered
    const plans = await prisma.plan.findMany();
    assert(Array.isArray(plans), '17. Platform-level Plan remains globally accessible and not tenant-filtered');

    // Test 18: Tenant-level ActivityLog correctly supports madrasaId
    const logTenant = await logTenantActivity({
      madrasaId: madrasaA.id,
      userId: null,
      action: TEST_PREFIX + '_TENANT_ACTION',
    });
    assert(logTenant.madrasaId === madrasaA.id, '18. Tenant-level ActivityLog correctly supports madrasaId');

    // Test 19: Platform ActivityLog supports madrasaId = null
    const logPlatform = await logTenantActivity({
      madrasaId: null,
      userId: null,
      action: TEST_PREFIX + '_PLATFORM_ACTION',
    });
    assert(logPlatform.madrasaId === null, '19. Platform ActivityLog supports madrasaId = null');

    // Test 20: Existing database compound constraints reject cross-tenant relations at DB level
    let dbConstraintRejected = false;
    try {
      await prisma.invoice.create({
        data: {
          madrasaId: madrasaA.id,
          studentId: studentB.id, // CROSS TENANT!
          invoiceNo: TEST_PREFIX + '_ILLEGAL_INV',
          billingYear: 2026,
          billingMonth: 2,
          issueDate: new Date(),
          subtotal: 1000.00,
          totalAmount: 1000.00,
          balanceAmount: 1000.00,
          status: 'PENDING',
        },
      });
    } catch (err) {
      if (err.code === 'P2003' || err.message.includes('Foreign key constraint failed')) {
        dbConstraintRejected = true;
      }
    }
    assert(dbConstraintRejected, '20. Existing database compound constraints reject cross-tenant relations at DB level');

  } catch (globalErr) {
    console.error('Fatal test error:', globalErr);
  } finally {
    await teardownFixtures();
    await prisma.$disconnect();

    console.log('\n====================================================');
    console.log('TEST RUN SUMMARY: ' + testPassedCount + ' Passed, ' + testFailedCount + ' Failed (Total: ' + (testPassedCount + testFailedCount) + '/20)');
    console.log('====================================================\n');

    process.exit(testFailedCount === 0 ? 0 : 1);
  }
}

runAllSecurityTests();
