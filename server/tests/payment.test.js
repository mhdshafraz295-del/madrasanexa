process.env.NODE_ENV = 'test';
import { prisma } from '../src/lib/prisma.js';
import { hashPassword } from '../src/utils/password.js';
import { signAccessToken } from '../src/utils/jwt.js';
import app from '../src/app.js';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import {
  generatePaymentNumber,
  generateReceiptNumber,
  isPaymentNoCollision,
  isReceiptNoCollision,
  isIdempotencyCollision,
} from '../src/services/payment.service.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const TEST_PREFIX = 'p10_test_' + Date.now();

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

let testServer = null;
let baseUrl = '';

// Fixtures
let madrasaA = null;
let adminA = null;
let tokenA = '';
let classA = null;
let studentA1 = null;
let studentA2 = null;
let studentA_future = null;
let invoiceJan = null;
let invoiceFeb = null;
let invoiceMar = null;
let invoiceVoid = null;

let madrasaB = null;
let adminB = null;
let tokenB = '';
let classB = null;
let studentB1 = null;
let invoiceB1 = null;

async function setup() {
  console.log('\n--- Setting up Phase 10 Test Fixtures ---');
  const now = new Date();

  // 1. Madrasa A (Colombo timezone, custom prefixes)
  madrasaA = await prisma.madrasa.create({
    data: {
      name: 'Madrasa A Fee Test',
      code: `${TEST_PREFIX.slice(-6).toUpperCase()}A1`,
      slug: `${TEST_PREFIX}-m-a`,
      email: `${TEST_PREFIX}_ma@example.com`,
      status: 'ACTIVE',
      settings: {
        create: {
          invoicePrefix: 'INV-A-',
          receiptPrefix: 'REC-A-',
          timezone: 'Asia/Colombo',
          currency: 'LKR',
          receiptHeader: 'Official Fee Receipt - Madrasa A',
          receiptFooter: 'Thank you for your timely payment.',
        },
      },
    },
  });

  adminA = await prisma.user.create({
    data: {
      name: 'Admin A Fee POS',
      email: `${TEST_PREFIX}_admin_a@example.com`,
      passwordHash: await hashPassword('SecurePassword123!'),
      role: 'MADRASA_ADMIN',
      madrasaId: madrasaA.id,
      isActive: true,
      mustChangePassword: false,
    },
  });

  tokenA = signAccessToken({
    userId: adminA.id,
    email: adminA.email,
    role: adminA.role,
    madrasaId: madrasaA.id,
  });

  // Active Subscription for Madrasa A
  const planA = await prisma.plan.create({
    data: {
      name: `${TEST_PREFIX} Plan A`,
      code: `${TEST_PREFIX}_PLAN_A`,
      durationMonths: 12,
      price: 10000.0,
      isActive: true,
    },
  });

  await prisma.subscription.create({
    data: {
      madrasaId: madrasaA.id,
      planId: planA.id,
      status: 'ACTIVE',
      startsAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      endsAt: new Date(now.getTime() + 335 * 24 * 60 * 60 * 1000),
      priceAtPurchase: 10000.0,
      durationMonthsAtPurchase: 12,
    },
  });

  // Class for Madrasa A
  classA = await prisma.class.create({
    data: {
      madrasaId: madrasaA.id,
      name: 'Hifz Advanced A',
      code: 'HIFZ-A',
      defaultMonthlyFee: 2500.0,
    },
  });

  // Student A1: Admitted Jan 1, 2026
  studentA1 = await prisma.student.create({
    data: {
      madrasaId: madrasaA.id,
      classId: classA.id,
      admissionNo: `${TEST_PREFIX.slice(-4)}_A1`,
      fullName: 'Ahmed Farooq',
      guardianName: 'Farooq Mohammed',
      guardianPhone: '0771234567',
      whatsappNumber: '0771234567',
      admissionDate: new Date('2026-01-01T00:00:00.000Z'),
      status: 'ACTIVE',
    },
  });

  // Student A2: Admitted Jan 1, 2026
  studentA2 = await prisma.student.create({
    data: {
      madrasaId: madrasaA.id,
      classId: classA.id,
      admissionNo: `${TEST_PREFIX.slice(-4)}_A2`,
      fullName: 'Bilal Kareem',
      guardianName: 'Kareem Abdul',
      guardianPhone: '0779876543',
      admissionDate: new Date('2026-01-01T00:00:00.000Z'),
      status: 'ACTIVE',
    },
  });

  // Student A Future: Admitted September 1, 2026 (for Pre-admission ledger test)
  studentA_future = await prisma.student.create({
    data: {
      madrasaId: madrasaA.id,
      classId: classA.id,
      admissionNo: `${TEST_PREFIX.slice(-4)}_FUT`,
      fullName: 'Hamza Tariq (Admitted Sep)',
      guardianName: 'Tariq Jameel',
      admissionDate: new Date('2026-09-01T00:00:00.000Z'),
      status: 'ACTIVE',
    },
  });

  // Invoices for Student A1:
  // Jan 2026: Total 2500
  invoiceJan = await prisma.invoice.create({
    data: {
      madrasaId: madrasaA.id,
      studentId: studentA1.id,
      invoiceNo: `INV-A-202601-${TEST_PREFIX.slice(-4)}01`,
      billingYear: 2026,
      billingMonth: 1,
      issueDate: new Date('2026-01-01T00:00:00.000Z'),
      dueDate: new Date('2026-01-15T18:29:59.999Z'),
      subtotal: 2500.0,
      totalAmount: 2500.0,
      paidAmount: 0.0,
      balanceAmount: 2500.0,
      status: 'PENDING',
      items: {
        create: {
          description: 'Monthly Tuition Fee - January 2026',
          quantity: 1,
          unitAmount: 2500.0,
          totalAmount: 2500.0,
        },
      },
    },
  });

  // Feb 2026: Total 2500
  invoiceFeb = await prisma.invoice.create({
    data: {
      madrasaId: madrasaA.id,
      studentId: studentA1.id,
      invoiceNo: `INV-A-202602-${TEST_PREFIX.slice(-4)}02`,
      billingYear: 2026,
      billingMonth: 2,
      issueDate: new Date('2026-02-01T00:00:00.000Z'),
      dueDate: new Date('2026-02-15T18:29:59.999Z'),
      subtotal: 2500.0,
      totalAmount: 2500.0,
      paidAmount: 0.0,
      balanceAmount: 2500.0,
      status: 'PENDING',
      items: {
        create: {
          description: 'Monthly Tuition Fee - February 2026',
          quantity: 1,
          unitAmount: 2500.0,
          totalAmount: 2500.0,
        },
      },
    },
  });

  // Mar 2026: Total 2500 (Overdue: due in past)
  invoiceMar = await prisma.invoice.create({
    data: {
      madrasaId: madrasaA.id,
      studentId: studentA1.id,
      invoiceNo: `INV-A-202603-${TEST_PREFIX.slice(-4)}03`,
      billingYear: 2026,
      billingMonth: 3,
      issueDate: new Date('2026-03-01T00:00:00.000Z'),
      dueDate: new Date('2026-03-10T18:29:59.999Z'),
      subtotal: 2500.0,
      totalAmount: 2500.0,
      paidAmount: 0.0,
      balanceAmount: 2500.0,
      status: 'PENDING',
      items: {
        create: {
          description: 'Monthly Tuition Fee - March 2026',
          quantity: 1,
          unitAmount: 2500.0,
          totalAmount: 2500.0,
        },
      },
    },
  });

  // April 2026: VOID invoice
  invoiceVoid = await prisma.invoice.create({
    data: {
      madrasaId: madrasaA.id,
      studentId: studentA1.id,
      invoiceNo: `INV-A-202604-${TEST_PREFIX.slice(-4)}04`,
      billingYear: 2026,
      billingMonth: 4,
      issueDate: new Date('2026-04-01T00:00:00.000Z'),
      dueDate: new Date('2026-04-10T18:29:59.999Z'),
      subtotal: 2500.0,
      totalAmount: 2500.0,
      paidAmount: 0.0,
      balanceAmount: 2500.0,
      status: 'VOID',
      notes: 'Waived by Board',
      items: {
        create: {
          description: 'Monthly Tuition Fee - April 2026',
          quantity: 1,
          unitAmount: 2500.0,
          totalAmount: 2500.0,
        },
      },
    },
  });

  // 2. Madrasa B (Tenant Isolation checks)
  madrasaB = await prisma.madrasa.create({
    data: {
      name: 'Madrasa B Isolation Test',
      code: `${TEST_PREFIX.slice(-6).toUpperCase()}B1`,
      slug: `${TEST_PREFIX}-m-b`,
      email: `${TEST_PREFIX}_mb@example.com`,
      status: 'ACTIVE',
      settings: {
        create: {
          invoicePrefix: 'INV-B-',
          receiptPrefix: 'REC-B-',
          timezone: 'Asia/Colombo',
        },
      },
    },
  });

  adminB = await prisma.user.create({
    data: {
      name: 'Admin B Fee',
      email: `${TEST_PREFIX}_admin_b@example.com`,
      passwordHash: await hashPassword('SecurePassword123!'),
      role: 'MADRASA_ADMIN',
      madrasaId: madrasaB.id,
      isActive: true,
      mustChangePassword: false,
    },
  });

  tokenB = signAccessToken({
    userId: adminB.id,
    email: adminB.email,
    role: adminB.role,
    madrasaId: madrasaB.id,
  });

  const planB = await prisma.plan.create({
    data: {
      name: `${TEST_PREFIX} Plan B`,
      code: `${TEST_PREFIX}_PLAN_B`,
      durationMonths: 12,
      price: 10000.0,
      isActive: true,
    },
  });

  await prisma.subscription.create({
    data: {
      madrasaId: madrasaB.id,
      planId: planB.id,
      status: 'ACTIVE',
      startsAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      endsAt: new Date(now.getTime() + 335 * 24 * 60 * 60 * 1000),
      priceAtPurchase: 10000.0,
      durationMonthsAtPurchase: 12,
    },
  });

  classB = await prisma.class.create({
    data: {
      madrasaId: madrasaB.id,
      name: 'Class B Primary',
      defaultMonthlyFee: 3000.0,
    },
  });

  studentB1 = await prisma.student.create({
    data: {
      madrasaId: madrasaB.id,
      classId: classB.id,
      admissionNo: `${TEST_PREFIX.slice(-4)}_B1`,
      fullName: 'Yusuf Ismail',
      guardianName: 'Ismail Yusuf',
      admissionDate: new Date('2026-01-01T00:00:00.000Z'),
      status: 'ACTIVE',
    },
  });

  invoiceB1 = await prisma.invoice.create({
    data: {
      madrasaId: madrasaB.id,
      studentId: studentB1.id,
      invoiceNo: `INV-B-202601-${TEST_PREFIX.slice(-4)}01`,
      billingYear: 2026,
      billingMonth: 1,
      issueDate: new Date('2026-01-01T00:00:00.000Z'),
      dueDate: new Date('2026-01-15T18:29:59.999Z'),
      subtotal: 3000.0,
      totalAmount: 3000.0,
      paidAmount: 0.0,
      balanceAmount: 3000.0,
      status: 'PENDING',
      items: {
        create: {
          description: 'Monthly Tuition Fee - January 2026',
          quantity: 1,
          unitAmount: 3000.0,
          totalAmount: 3000.0,
        },
      },
    },
  });

  // Start HTTP server for testing
  await new Promise((resolve) => {
    testServer = app.listen(0, () => {
      const port = testServer.address().port;
      baseUrl = `http://localhost:${port}/api`;
      resolve();
    });
  });

  console.log(`Test server running at ${baseUrl}`);
}

async function teardown() {
  console.log('\n--- Tearing Down Phase 10 Test Fixtures ---');
  if (testServer) {
    await new Promise((resolve) => testServer.close(resolve));
  }

  const madrasaIds = [madrasaA?.id, madrasaB?.id].filter(Boolean);
  const userIds = [adminA?.id, adminB?.id].filter(Boolean);

  if (madrasaIds.length > 0) {
    await prisma.activityLog.deleteMany({ where: { OR: [{ madrasaId: { in: madrasaIds } }, { userId: { in: userIds } }] } });
    await prisma.receipt.deleteMany({ where: { madrasaId: { in: madrasaIds } } });
    await prisma.paymentAllocation.deleteMany({ where: { madrasaId: { in: madrasaIds } } });
    await prisma.payment.deleteMany({ where: { madrasaId: { in: madrasaIds } } });
    await prisma.invoiceItem.deleteMany({ where: { madrasaId: { in: madrasaIds } } });
    await prisma.invoice.deleteMany({ where: { madrasaId: { in: madrasaIds } } });
    await prisma.student.deleteMany({ where: { madrasaId: { in: madrasaIds } } });
    await prisma.class.deleteMany({ where: { madrasaId: { in: madrasaIds } } });
    await prisma.subscription.deleteMany({ where: { madrasaId: { in: madrasaIds } } });
    await prisma.madrasaSetting.deleteMany({ where: { madrasaId: { in: madrasaIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.madrasa.deleteMany({ where: { id: { in: madrasaIds } } });
  }

  await prisma.plan.deleteMany({ where: { code: { startsWith: TEST_PREFIX } } });
  console.log('Teardown complete. Zero test fixtures remain.');
}

async function runTests() {
  await setup();

  try {
    // ==========================================
    // GROUP 1: Student Monthly Ledger
    // ==========================================
    console.log('\n[GROUP 1] Student Monthly Ledger (Mandatory Corrections 7, 8, 9, 10)');

    // 1.1 Jan-Dec structure returned
    const resLedger = await fetch(`${baseUrl}/madrasa-admin/students/${studentA1.id}/monthly-fees?year=2026`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(resLedger.status === 200, 'Student monthly ledger returns 200 OK');
    const ledgerData = await resLedger.json();
    assert(ledgerData.data.months.length === 12, 'Returns exactly 12 months (January–December)');
    assert(ledgerData.data.year === 2026, 'Ledger year is 2026');

    // 1.2 Invoices map correctly
    const mJan = ledgerData.data.months.find((m) => m.month === 1);
    assert(mJan.status === 'PENDING', 'January has status PENDING');
    assert(mJan.expected === '2500.00', 'January expected is 2500.00');
    assert(mJan.paid === '0.00', 'January paid is 0.00');
    assert(mJan.balance === '2500.00', 'January balance is 2500.00');

    // 1.3 Missing month is NOT_GENERATED
    const mMay = ledgerData.data.months.find((m) => m.month === 5);
    assert(mMay.status === 'NOT_GENERATED', 'May without invoice returns NOT_GENERATED');
    assert(mMay.invoiceId === null, 'May invoiceId is null');
    assert(mMay.expected === null, 'May expected is null');

    // 1.4 VOID invoice shows VOID (Mandatory Correction 7)
    const mApr = ledgerData.data.months.find((m) => m.month === 4);
    assert(mApr.status === 'VOID', 'April VOID invoice shows status VOID (not hidden as NOT_GENERATED)');

    // 1.5 Pre-admission months show NOT_ADMITTED (Mandatory Correction 8)
    const resFut = await fetch(`${baseUrl}/madrasa-admin/students/${studentA_future.id}/monthly-fees?year=2026`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const futLedger = await resFut.json();
    const futJan = futLedger.data.months.find((m) => m.month === 1);
    assert(futJan.status === 'NOT_ADMITTED', 'Pre-admission month (Jan for Sep admission) returns NOT_ADMITTED');

    // ==========================================
    // GROUP 2: Full Payment & Instant Receipt
    // ==========================================
    console.log('\n[GROUP 2] Full Payment & Instant Receipt Creation');

    const payKey1 = `idemp_full_${Date.now()}`;
    const resPay1 = await fetch(`${baseUrl}/madrasa-admin/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        studentId: studentA1.id,
        amount: '2500.00',
        paymentMethod: 'CASH',
        paidAt: '2026-01-10',
        idempotencyKey: payKey1,
        reference: 'CASH-001',
        allocations: [{ invoiceId: invoiceJan.id, amount: '2500.00' }],
      }),
    });

    assert(resPay1.status === 201, 'Full payment returns 201 Created');
    const pay1Json = await resPay1.json();
    const payment1 = pay1Json.data;

    assert(payment1.status === 'COMPLETED', 'Payment status is COMPLETED');
    assert(payment1.amount === '2500.00', 'Payment amount is 2500.00');
    assert(payment1.receipt !== null, 'Receipt was created');
    assert(payment1.receipt.receiptNo.startsWith('REC-A-'), 'Receipt number has Madrasa prefix REC-A-');
    assert(payment1.allocations.length === 1, 'Payment has exactly 1 allocation');

    // Verify Invoice projection after payment
    const dbInvJan = await prisma.invoice.findUnique({ where: { id: invoiceJan.id } });
    assert(Number(dbInvJan.paidAmount) === 2500.0, 'Invoice Jan paidAmount updated to 2500.00');
    assert(Number(dbInvJan.balanceAmount) === 0.0, 'Invoice Jan balanceAmount updated to 0.00');
    assert(dbInvJan.status === 'PAID', 'Invoice Jan status transitioned to PAID');

    // ==========================================
    // GROUP 3: Partial Payment & Multiple Payments against Single Invoice
    // ==========================================
    console.log('\n[GROUP 3] Partial Payment & Multiple Payments against Single Invoice');

    // Part 1: Pay 1000 on Feb (total 2500)
    const payKeyFeb1 = `idemp_feb1_${Date.now()}`;
    const resPayFeb1 = await fetch(`${baseUrl}/madrasa-admin/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        studentId: studentA1.id,
        amount: '1000.00',
        paymentMethod: 'BANK_TRANSFER',
        idempotencyKey: payKeyFeb1,
        reference: 'TXN-FEB-1',
        allocations: [{ invoiceId: invoiceFeb.id, amount: '1000.00' }],
      }),
    });

    assert(resPayFeb1.status === 201, 'First partial payment returns 201 Created');
    const dbInvFebPart1 = await prisma.invoice.findUnique({ where: { id: invoiceFeb.id } });
    assert(Number(dbInvFebPart1.paidAmount) === 1000.0, 'Invoice Feb paidAmount is 1000.00');
    assert(Number(dbInvFebPart1.balanceAmount) === 1500.0, 'Invoice Feb balanceAmount is 1500.00');
    assert(dbInvFebPart1.status === 'PARTIAL', 'Invoice Feb status transitioned to PARTIAL');

    // Part 2: Pay remaining 1500 on Feb
    const payKeyFeb2 = `idemp_feb2_${Date.now()}`;
    const resPayFeb2 = await fetch(`${baseUrl}/madrasa-admin/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        studentId: studentA1.id,
        amount: '1500.00',
        paymentMethod: 'CASH',
        idempotencyKey: payKeyFeb2,
        allocations: [{ invoiceId: invoiceFeb.id, amount: '1500.00' }],
      }),
    });

    assert(resPayFeb2.status === 201, 'Second partial payment returns 201 Created');
    const dbInvFebPart2 = await prisma.invoice.findUnique({ where: { id: invoiceFeb.id } });
    assert(Number(dbInvFebPart2.paidAmount) === 2500.0, 'Invoice Feb paidAmount updated to 2500.00');
    assert(Number(dbInvFebPart2.balanceAmount) === 0.0, 'Invoice Feb balanceAmount updated to 0.00');
    assert(dbInvFebPart2.status === 'PAID', 'Invoice Feb status transitioned from PARTIAL to PAID');

    // Multiple receipts check on Feb in monthly ledger (Mandatory Correction 9)
    const resLedgerAfterFeb = await fetch(`${baseUrl}/madrasa-admin/students/${studentA1.id}/monthly-fees?year=2026`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const ledgerFebData = await resLedgerAfterFeb.json();
    const mFeb = ledgerFebData.data.months.find((m) => m.month === 2);
    assert(mFeb.payments.length === 2, 'Feb invoice has multiple (2) payment records and receipts');

    // ==========================================
    // GROUP 4: Multi-Month Single Payment & Transactional Atomicity
    // ==========================================
    console.log('\n[GROUP 4] Multi-Month Single Payment & Transactional Atomicity');

    // Create 2 new invoices for Student A2: May (2500) and Jun (2500)
    const invA2May = await prisma.invoice.create({
      data: {
        madrasaId: madrasaA.id,
        studentId: studentA2.id,
        invoiceNo: `INV-A-202605-${TEST_PREFIX.slice(-4)}05`,
        billingYear: 2026,
        billingMonth: 5,
        issueDate: new Date('2026-05-01T00:00:00.000Z'),
        dueDate: new Date('2026-05-15T18:29:59.999Z'),
        subtotal: 2500.0,
        totalAmount: 2500.0,
        balanceAmount: 2500.0,
        status: 'PENDING',
      },
    });

    const invA2Jun = await prisma.invoice.create({
      data: {
        madrasaId: madrasaA.id,
        studentId: studentA2.id,
        invoiceNo: `INV-A-202606-${TEST_PREFIX.slice(-4)}06`,
        billingYear: 2026,
        billingMonth: 6,
        issueDate: new Date('2026-06-01T00:00:00.000Z'),
        dueDate: new Date('2026-06-15T18:29:59.999Z'),
        subtotal: 2500.0,
        totalAmount: 2500.0,
        balanceAmount: 2500.0,
        status: 'PENDING',
      },
    });

    // Pay 5000: 2500 to May, 2500 to Jun
    const payKeyMulti = `idemp_multi_${Date.now()}`;
    const resMulti = await fetch(`${baseUrl}/madrasa-admin/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        studentId: studentA2.id,
        amount: '5000.00',
        paymentMethod: 'CARD',
        reference: 'CARD-AUTH-999',
        idempotencyKey: payKeyMulti,
        allocations: [
          { invoiceId: invA2May.id, amount: '2500.00' },
          { invoiceId: invA2Jun.id, amount: '2500.00' },
        ],
      }),
    });

    assert(resMulti.status === 201, 'Multi-month payment returns 201 Created');
    const multiJson = await resMulti.json();
    assert(multiJson.data.amount === '5000.00', 'Single payment recorded for total 5000.00');
    assert(multiJson.data.allocations.length === 2, 'Exactly 2 allocations recorded');
    assert(multiJson.data.receipt !== null, 'Single receipt created for multi-month payment');

    const dbMay = await prisma.invoice.findUnique({ where: { id: invA2May.id } });
    const dbJun = await prisma.invoice.findUnique({ where: { id: invA2Jun.id } });
    assert(dbMay.status === 'PAID' && Number(dbMay.balanceAmount) === 0, 'May invoice settled to PAID');
    assert(dbJun.status === 'PAID' && Number(dbJun.balanceAmount) === 0, 'Jun invoice settled to PAID');

    // ==========================================
    // GROUP 5: Validation & Overallocation Prevention
    // ==========================================
    console.log('\n[GROUP 5] Validation & Overallocation Prevention');

    // 5.1 Reject duplicate invoice IDs in request (Mandatory Correction 4)
    const resDupInv = await fetch(`${baseUrl}/madrasa-admin/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        studentId: studentA1.id,
        amount: '1000.00',
        paymentMethod: 'CASH',
        idempotencyKey: `idemp_dup_${Date.now()}`,
        allocations: [
          { invoiceId: invoiceMar.id, amount: '500.00' },
          { invoiceId: invoiceMar.id, amount: '500.00' },
        ],
      }),
    });
    assert(resDupInv.status === 400, 'Duplicate invoice IDs in allocation array rejected with 400');

    // 5.2 Overallocation rejected (balance = 2500, request = 3000)
    const resOver = await fetch(`${baseUrl}/madrasa-admin/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        studentId: studentA1.id,
        amount: '3000.00',
        paymentMethod: 'CASH',
        idempotencyKey: `idemp_over_${Date.now()}`,
        allocations: [{ invoiceId: invoiceMar.id, amount: '3000.00' }],
      }),
    });
    assert(resOver.status === 400, 'Allocation exceeding invoice balance rejected with 400');

    // 5.3 Cannot pay already PAID invoice
    const resPaidInv = await fetch(`${baseUrl}/madrasa-admin/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        studentId: studentA1.id,
        amount: '500.00',
        paymentMethod: 'CASH',
        idempotencyKey: `idemp_alreadypaid_${Date.now()}`,
        allocations: [{ invoiceId: invoiceJan.id, amount: '500.00' }],
      }),
    });
    assert(resPaidInv.status === 400, 'Payment against already PAID invoice rejected with 400');

    // 5.4 Cannot pay VOID invoice
    const resVoidInv = await fetch(`${baseUrl}/madrasa-admin/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        studentId: studentA1.id,
        amount: '500.00',
        paymentMethod: 'CASH',
        idempotencyKey: `idemp_payvoid_${Date.now()}`,
        allocations: [{ invoiceId: invoiceVoid.id, amount: '500.00' }],
      }),
    });
    assert(resVoidInv.status === 400, 'Payment against VOID invoice rejected with 400');

    // 5.5 Allocation sum must equal payment amount
    const resMismatchedSum = await fetch(`${baseUrl}/madrasa-admin/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        studentId: studentA1.id,
        amount: '2000.00',
        paymentMethod: 'CASH',
        idempotencyKey: `idemp_mismatch_${Date.now()}`,
        allocations: [{ invoiceId: invoiceMar.id, amount: '1500.00' }],
      }),
    });
    assert(resMismatchedSum.status === 400, 'Allocation sum not matching payment amount rejected with 400');

    // ==========================================
    // GROUP 6: Idempotency Protection
    // ==========================================
    console.log('\n[GROUP 6] Idempotency Protection (Mandatory Corrections 1 & 2)');

    // 6.1 Idempotency key required
    const resNoKey = await fetch(`${baseUrl}/madrasa-admin/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        studentId: studentA1.id,
        amount: '500.00',
        paymentMethod: 'CASH',
        allocations: [{ invoiceId: invoiceMar.id, amount: '500.00' }],
      }),
    });
    assert(resNoKey.status === 400, 'Missing idempotencyKey rejected with 400');

    // 6.2 Retry with same idempotency key and same payload returns existing payment
    const resRetrySame = await fetch(`${baseUrl}/madrasa-admin/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        studentId: studentA1.id,
        amount: '2500.00',
        paymentMethod: 'CASH',
        paidAt: '2026-01-10',
        idempotencyKey: payKey1,
        reference: 'CASH-001',
        allocations: [{ invoiceId: invoiceJan.id, amount: '2500.00' }],
      }),
    });
    assert(resRetrySame.status === 200 || resRetrySame.status === 201, 'Idempotent retry returns success');
    const retrySameJson = await resRetrySame.json();
    assert(retrySameJson.data.id === payment1.id, 'Returns the exact same payment ID');

    // 6.3 Same idempotency key with different payload returns 409 Conflict
    const resDiffPayload = await fetch(`${baseUrl}/madrasa-admin/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        studentId: studentA1.id,
        amount: '1000.00', // Different amount!
        paymentMethod: 'CASH',
        idempotencyKey: payKey1,
        allocations: [{ invoiceId: invoiceMar.id, amount: '1000.00' }],
      }),
    });
    assert(resDiffPayload.status === 409, 'Reusing idempotency key with different payload rejected with 409 Conflict');

    // ==========================================
    // GROUP 7: Concurrency & Invariant Enforcement
    // ==========================================
    console.log('\n[GROUP 7] Concurrency & Invariant Enforcement (Mandatory Correction 3)');

    // Attempt two simultaneous full payments on Invoice Mar (balance = 2500)
    const p1Promise = fetch(`${baseUrl}/madrasa-admin/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        studentId: studentA1.id,
        amount: '2500.00',
        paymentMethod: 'CASH',
        idempotencyKey: `concurrent_p1_${Date.now()}`,
        allocations: [{ invoiceId: invoiceMar.id, amount: '2500.00' }],
      }),
    });

    const p2Promise = fetch(`${baseUrl}/madrasa-admin/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        studentId: studentA1.id,
        amount: '2500.00',
        paymentMethod: 'BANK_TRANSFER',
        idempotencyKey: `concurrent_p2_${Date.now()}`,
        allocations: [{ invoiceId: invoiceMar.id, amount: '2500.00' }],
      }),
    });

    const [p1Res, p2Res] = await Promise.all([p1Promise, p2Promise]);
    const statuses = [p1Res.status, p2Res.status].sort();

    // Exactly one should succeed (201), the other must be rejected (400 or 409)
    assert(statuses.includes(201), 'At least one concurrent payment succeeded');
    assert(statuses.some((s) => s === 400 || s === 409), 'Second concurrent payment was rejected without overallocating');

    // Verify DB invariant: completed allocations <= totalAmount
    const allocationsMar = await prisma.paymentAllocation.findMany({
      where: { invoiceId: invoiceMar.id, payment: { status: 'COMPLETED' } },
    });
    const totalPaidMar = allocationsMar.reduce((acc, a) => acc + Number(a.amount), 0);
    assert(totalPaidMar === 2500.0, 'Total allocated to Invoice Mar is exactly 2500.00 (invariant preserved)');

    // ==========================================
    // GROUP 8: Payment Void Workflow & Invoice Reversal
    // ==========================================
    console.log('\n[GROUP 8] Payment Void Workflow & Invoice Reversal (Mandatory Corrections 6, 11, 12, 16)');

    // Void the first payment on Jan (payment1)
    const resVoidPay1 = await fetch(`${baseUrl}/madrasa-admin/payments/${payment1.id}/void`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ reason: 'Duplicate test payment entered in error' }),
    });

    assert(resVoidPay1.status === 200, 'Void payment returns 200 OK');
    const voidJson = await resVoidPay1.json();
    assert(voidJson.data.status === 'VOID', 'Payment status is updated to VOID');
    assert(voidJson.data.voidMetadata !== null, 'Void metadata returned');

    // Verify Invoice Jan was reversed back to PENDING with 2500 balance
    const dbInvJanAfterVoid = await prisma.invoice.findUnique({ where: { id: invoiceJan.id } });
    assert(Number(dbInvJanAfterVoid.paidAmount) === 0.0, 'Invoice Jan paidAmount reverted to 0.00');
    assert(Number(dbInvJanAfterVoid.balanceAmount) === 2500.0, 'Invoice Jan balanceAmount restored to 2500.00');
    assert(dbInvJanAfterVoid.status === 'PENDING', 'Invoice Jan status reverted to PENDING');

    // Verify receipt still exists and is marked isVoid (Mandatory Correction 16)
    const resReceipt = await fetch(`${baseUrl}/madrasa-admin/receipts/${payment1.receipt.id}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(resReceipt.status === 200, 'Receipt still exists after voiding payment');
    const receiptData = await resReceipt.json();
    assert(receiptData.data.isVoid === true, 'Receipt isVoid flag is true (derived safely from payment)');

    // Cannot void an already voided payment (409 Conflict)
    const resVoidAgain = await fetch(`${baseUrl}/madrasa-admin/payments/${payment1.id}/void`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ reason: 'Try to void again' }),
    });
    assert(resVoidAgain.status === 409, 'Voiding already voided payment returns 409 Conflict');

    // ==========================================
    // GROUP 9: Tenant Isolation & IDOR Defense
    // ==========================================
    console.log('\n[GROUP 9] Tenant Isolation & IDOR Defense (Section 8 & 109)');

    // 9.1 Admin A cannot pay for Madrasa B student/invoice
    const resCrossPay = await fetch(`${baseUrl}/madrasa-admin/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        studentId: studentB1.id,
        amount: '1000.00',
        paymentMethod: 'CASH',
        idempotencyKey: `idemp_cross_${Date.now()}`,
        allocations: [{ invoiceId: invoiceB1.id, amount: '1000.00' }],
      }),
    });
    assert(resCrossPay.status === 404, 'Cross-tenant payment rejected with 404 Not Found');

    // 9.2 Admin A cannot view Madrasa B payment or receipt
    // Create a payment in Madrasa B first
    const resPayB = await fetch(`${baseUrl}/madrasa-admin/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({
        studentId: studentB1.id,
        amount: '3000.00',
        paymentMethod: 'CASH',
        idempotencyKey: `idemp_b_${Date.now()}`,
        allocations: [{ invoiceId: invoiceB1.id, amount: '3000.00' }],
      }),
    });
    assert(resPayB.status === 201, 'Madrasa B payment created successfully');
    const payBJson = await resPayB.json();
    const payBId = payBJson.data.id;
    const receiptBId = payBJson.data.receipt.id;

    // Admin A attempts to read Madrasa B payment
    const resAViewPayB = await fetch(`${baseUrl}/madrasa-admin/payments/${payBId}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(resAViewPayB.status === 404, 'Admin A cannot read Madrasa B payment (404 Not Found)');

    // Admin A attempts to read Madrasa B receipt
    const resAViewRecB = await fetch(`${baseUrl}/madrasa-admin/receipts/${receiptBId}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(resAViewRecB.status === 404, 'Admin A cannot read Madrasa B receipt (404 Not Found)');

    // Admin A attempts to void Madrasa B payment
    const resAVoidPayB = await fetch(`${baseUrl}/madrasa-admin/payments/${payBId}/void`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ reason: 'Malicious void attempt' }),
    });
    assert(resAVoidPayB.status === 404, 'Admin A cannot void Madrasa B payment (404 Not Found)');

    // ==========================================
    // GROUP 10: POS Endpoints (Search & Unpaid Invoices)
    // ==========================================
    console.log('\n[GROUP 10] POS Search & Unpaid Invoices (Sections 21, 32, 34)');

    // Search by student name
    const resSearch = await fetch(`${baseUrl}/madrasa-admin/pos/search?q=Ahmed`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(resSearch.status === 200, 'POS search returns 200 OK');
    const searchJson = await resSearch.json();
    assert(searchJson.data.length > 0, 'Finds student Ahmed');
    assert(searchJson.data[0].admissionNo === studentA1.admissionNo, 'Student admission number matches');

    // Unpaid invoices for Student A1
    const resUnpaid = await fetch(`${baseUrl}/madrasa-admin/students/${studentA1.id}/unpaid-invoices`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(resUnpaid.status === 200, 'Unpaid invoices endpoint returns 200 OK');
    const unpaidJson = await resUnpaid.json();
    assert(unpaidJson.data.invoices.length > 0, 'Returns list of outstanding invoices');
    // VOID invoice (April) must NOT be present in unpaid invoices
    const hasVoid = unpaidJson.data.invoices.some((inv) => inv.id === invoiceVoid.id);
    assert(!hasVoid, 'VOID invoice is strictly excluded from unpaid invoices');

    // ==========================================
    // GROUP 11: List Payments & Summary KPIs
    // ==========================================
    console.log('\n[GROUP 11] List Payments & Summary KPIs (Mandatory Correction 13, 14)');

    const resListPay = await fetch(`${baseUrl}/madrasa-admin/payments`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(resListPay.status === 200, 'List payments returns 200 OK');
    const listPayJson = await resListPay.json();
    assert(listPayJson.data.summary !== undefined, 'Summary KPIs returned');
    assert(listPayJson.data.summary.voidedCount >= 1, 'Summary reflects voided payment count');
    // Total collected must exclude void payments
    assert(Number(listPayJson.data.summary.totalCollected) > 0, 'Total collected includes active completed payments');

    // Student payments list
    const resStudPay = await fetch(`${baseUrl}/madrasa-admin/students/${studentA1.id}/payments`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(resStudPay.status === 200, 'Student payment history returns 200 OK');
    const studPayJson = await resStudPay.json();
    assert(studPayJson.data.items.length > 0, 'Student payments list populated');

    // ==========================================
    // GROUP 12: Collision & Idempotency Detection Units
    // ==========================================
    console.log('\n[GROUP 12] Collision Detection Units (Mandatory Correction 5)');

    assert(isPaymentNoCollision({ code: 'P2002', meta: { target: ['paymentNo'] } }), 'isPaymentNoCollision detects paymentNo');
    assert(isReceiptNoCollision({ code: 'P2002', meta: { target: ['receiptNo'] } }), 'isReceiptNoCollision detects receiptNo');
    assert(isIdempotencyCollision({ code: 'P2002', meta: { target: ['idempotencyKey'] } }), 'isIdempotencyCollision detects idempotencyKey');
    assert(!isPaymentNoCollision({ code: 'P2002', meta: { target: ['idempotencyKey'] } }), 'isPaymentNoCollision returns false for idempotencyKey');
  } finally {
    await teardown();
  }

  console.log('\n=============================================');
  console.log(`Phase 10 Test Results: ${testPassedCount} Passed, ${testFailedCount} Failed`);
  console.log('=============================================\n');

  if (testFailedCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
