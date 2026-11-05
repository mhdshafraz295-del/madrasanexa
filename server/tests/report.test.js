process.env.NODE_ENV = 'test';
import { prisma } from '../src/lib/prisma.js';
import { hashPassword } from '../src/utils/password.js';
import { signAccessToken } from '../src/utils/jwt.js';
import app from '../src/app.js';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { escapeCsvCell, generateCsvString } from '../src/services/csv-report.service.js';
import { sanitizeFilename } from '../src/controllers/report.controller.js';
import { escapeHtml, generateReportPdf } from '../src/services/pdf-report.service.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const TEST_PREFIX = 'rep_test_' + Date.now();

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

// Test Fixtures
let madrasaA = null;
let adminA = null;
let tokenA = '';
let sectionA1 = null;
let sectionA2 = null;
let classA1 = null;
let classA2 = null;
let classUnassigned = null;
let studentPaid = null;
let studentPartial = null;
let studentUnpaid = null;
let studentOverdue = null;
let studentFuture = null;
let studentVoidInv = null;
let invPaid = null;
let invPartial = null;
let invUnpaid = null;
let invOverdue = null;
let invVoid = null;

let madrasaB = null;
let adminB = null;
let tokenB = '';

async function setup() {
  console.log('\n--- Setting up Fee Reports & Export Center Test Fixtures ---');
  const now = new Date();

  // 1. Setup Tenant A
  madrasaA = await prisma.madrasa.create({
    data: {
      name: `${TEST_PREFIX} Madrasa Al-Huda`,
      code: `${TEST_PREFIX}_A`.toUpperCase(),
      slug: `${TEST_PREFIX}_a`.toLowerCase(),
      status: 'ACTIVE',
      settings: {
        create: {
          currency: 'LKR',
          timezone: 'Asia/Colombo',
          invoicePrefix: 'INV-A-',
          receiptPrefix: 'REC-A-',
        },
      },
    },
  });

  const pwHash = await hashPassword('Password123!');
  adminA = await prisma.user.create({
    data: {
      madrasa: { connect: { id: madrasaA.id } },
      email: `${TEST_PREFIX}_adminA@test.com`,
      passwordHash: pwHash,
      name: 'Admin Tenant A',
      role: 'MADRASA_ADMIN',
      isActive: true,
      mustChangePassword: false,
    },
  });
  tokenA = signAccessToken({
    userId: adminA.id,
    madrasaId: madrasaA.id,
    role: adminA.role,
  });

  const plan = await prisma.plan.findFirst({ where: { isActive: true } });
  await prisma.subscription.create({
    data: {
      madrasaId: madrasaA.id,
      planId: plan.id,
      status: 'ACTIVE',
      startsAt: now,
      endsAt: dayjs(now).add(365, 'day').toDate(),
      priceAtPurchase: plan.price,
      durationMonthsAtPurchase: plan.durationMonths,
    },
  });

  // Sections
  sectionA1 = await prisma.academicSection.create({
    data: {
      madrasaId: madrasaA.id,
      name: 'Kitab Division',
      code: `${TEST_PREFIX}_KITAB`,
      sortOrder: 1,
    },
  });
  sectionA2 = await prisma.academicSection.create({
    data: {
      madrasaId: madrasaA.id,
      name: 'Hifz Division',
      code: `${TEST_PREFIX}_HIFZ`,
      sortOrder: 2,
    },
  });

  // Classes
  classA1 = await prisma.class.create({
    data: {
      madrasaId: madrasaA.id,
      academicSectionId: sectionA1.id,
      name: 'Class 1 Kitab',
      code: `${TEST_PREFIX}_C1K`,
      defaultMonthlyFee: '2500.00',
    },
  });
  classA2 = await prisma.class.create({
    data: {
      madrasaId: madrasaA.id,
      academicSectionId: sectionA2.id,
      name: 'Class 1 Hifz',
      code: `${TEST_PREFIX}_C1H`,
      defaultMonthlyFee: '3000.00',
    },
  });
  classUnassigned = await prisma.class.create({
    data: {
      madrasaId: madrasaA.id,
      academicSectionId: null, // Legacy unassigned class
      name: 'General Studies Legacy',
      code: `${TEST_PREFIX}_GEN`,
      defaultMonthlyFee: '2000.00',
    },
  });

  // Students
  studentPaid = await prisma.student.create({
    data: {
      madrasaId: madrasaA.id,
      classId: classA1.id,
      admissionNo: `${TEST_PREFIX}-001`,
      fullName: 'Ahmed Ali (Paid)',
      admissionDate: new Date('2026-01-01'),
      status: 'ACTIVE',
      guardianName: 'Ali Farooq',
      guardianPhone: '+94771234567',
    },
  });

  studentPartial = await prisma.student.create({
    data: {
      madrasaId: madrasaA.id,
      classId: classA1.id,
      admissionNo: `${TEST_PREFIX}-002`,
      fullName: 'Fatima Zahra (Partial)',
      admissionDate: new Date('2026-01-01'),
      status: 'ACTIVE',
      guardianName: 'Zahra Senior',
      guardianPhone: '+94779876543',
    },
  });

  studentUnpaid = await prisma.student.create({
    data: {
      madrasaId: madrasaA.id,
      classId: classA2.id,
      admissionNo: `${TEST_PREFIX}-003`,
      fullName: 'Hassan Bilal (Unpaid)',
      admissionDate: new Date('2026-01-01'),
      status: 'ACTIVE',
      guardianName: 'Bilal Senior',
      guardianPhone: '+94775556666',
    },
  });

  studentOverdue = await prisma.student.create({
    data: {
      madrasaId: madrasaA.id,
      classId: classUnassigned.id,
      admissionNo: `${TEST_PREFIX}-004`,
      fullName: 'Zayd Kareem (Overdue)',
      admissionDate: new Date('2026-01-01'),
      status: 'ACTIVE',
      guardianName: 'Kareem Senior',
      guardianPhone: '+94774443333',
    },
  });

  studentFuture = await prisma.student.create({
    data: {
      madrasaId: madrasaA.id,
      classId: classA1.id,
      admissionNo: `${TEST_PREFIX}-005`,
      fullName: 'Future Student Pre-Admission',
      guardianName: 'Guardian Future',
      admissionDate: new Date('2026-12-01'), // Future enrollment
      status: 'ACTIVE',
    },
  });

  studentVoidInv = await prisma.student.create({
    data: {
      madrasaId: madrasaA.id,
      classId: classA1.id,
      admissionNo: `${TEST_PREFIX}-006`,
      fullName: 'Student With Voided Invoice',
      guardianName: 'Guardian Void',
      admissionDate: new Date('2026-01-01'),
      status: 'ACTIVE',
    },
  });

  // Invoices for September 2026 (billingYear: 2026, billingMonth: 9)
  // 1. Paid Invoice
  invPaid = await prisma.invoice.create({
    data: {
      madrasaId: madrasaA.id,
      studentId: studentPaid.id,
      invoiceNo: `INV-${TEST_PREFIX}-001`,
      billingYear: 2026,
      billingMonth: 9,
      issueDate: new Date('2026-09-01'),
      dueDate: new Date('2026-09-25'),
      subtotal: '2500.00',
      totalAmount: '2500.00',
      paidAmount: '2500.00',
      balanceAmount: '0.00',
      status: 'PAID',
    },
  });
  const pay1 = await prisma.payment.create({
    data: {
      madrasaId: madrasaA.id,
      studentId: studentPaid.id,
      paymentNo: `PAY-${TEST_PREFIX}-001`,
      amount: '2500.00',
      paymentMethod: 'CASH',
      status: 'COMPLETED',
      paidAt: new Date('2026-09-05T10:00:00Z'),
      receipt: {
        create: {
          receiptNo: `REC-${TEST_PREFIX}-001`,
        },
      },
    },
  });
  await prisma.paymentAllocation.create({
    data: {
      madrasaId: madrasaA.id,
      paymentId: pay1.id,
      invoiceId: invPaid.id,
      amount: '2500.00',
    },
  });

  // 2. Partial Invoice
  invPartial = await prisma.invoice.create({
    data: {
      madrasaId: madrasaA.id,
      studentId: studentPartial.id,
      invoiceNo: `INV-${TEST_PREFIX}-002`,
      billingYear: 2026,
      billingMonth: 9,
      issueDate: new Date('2026-09-01'),
      dueDate: new Date('2026-09-25'),
      subtotal: '2500.00',
      totalAmount: '2500.00',
      paidAmount: '1000.00',
      balanceAmount: '1500.00',
      status: 'PARTIAL',
    },
  });
  const pay2 = await prisma.payment.create({
    data: {
      madrasaId: madrasaA.id,
      studentId: studentPartial.id,
      paymentNo: `PAY-${TEST_PREFIX}-002`,
      amount: '1000.00',
      paymentMethod: 'BANK_TRANSFER',
      status: 'COMPLETED',
      paidAt: new Date('2026-09-06T11:00:00Z'),
      receipt: {
        create: {
          receiptNo: `REC-${TEST_PREFIX}-002`,
        },
      },
    },
  });
  await prisma.paymentAllocation.create({
    data: {
      madrasaId: madrasaA.id,
      paymentId: pay2.id,
      invoiceId: invPartial.id,
      amount: '1000.00',
    },
  });

  // 3. Unpaid Pending Invoice
  invUnpaid = await prisma.invoice.create({
    data: {
      madrasaId: madrasaA.id,
      studentId: studentUnpaid.id,
      invoiceNo: `INV-${TEST_PREFIX}-003`,
      billingYear: 2026,
      billingMonth: 9,
      issueDate: new Date('2026-09-01'),
      dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // Future due date relative to runtime
      subtotal: '3000.00',
      totalAmount: '3000.00',
      paidAmount: '0.00',
      balanceAmount: '3000.00',
      status: 'PENDING',
    },
  });

  // 4. Overdue Invoice (Past due date)
  invOverdue = await prisma.invoice.create({
    data: {
      madrasaId: madrasaA.id,
      studentId: studentOverdue.id,
      invoiceNo: `INV-${TEST_PREFIX}-004`,
      billingYear: 2026,
      billingMonth: 9,
      issueDate: new Date('2026-09-01'),
      dueDate: new Date('2026-09-10'), // Past due date relative to Sept 13
      subtotal: '2000.00',
      totalAmount: '2000.00',
      paidAmount: '0.00',
      balanceAmount: '2000.00',
      status: 'OVERDUE',
    },
  });

  // 5. VOID Invoice
  invVoid = await prisma.invoice.create({
    data: {
      madrasaId: madrasaA.id,
      studentId: studentVoidInv.id,
      invoiceNo: `INV-${TEST_PREFIX}-005-VOID`,
      billingYear: 2026,
      billingMonth: 9,
      issueDate: new Date('2026-09-01'),
      dueDate: new Date('2026-09-25'),
      subtotal: '2500.00',
      totalAmount: '2500.00',
      paidAmount: '0.00',
      balanceAmount: '0.00',
      status: 'VOID',
    },
  });

  // 6. Setup Tenant B (Strict isolation target)
  madrasaB = await prisma.madrasa.create({
    data: {
      name: `${TEST_PREFIX} Madrasa B`,
      code: `${TEST_PREFIX}_B`.toUpperCase(),
      slug: `${TEST_PREFIX}_b`.toLowerCase(),
      status: 'ACTIVE',
      settings: {
        create: {
          currency: 'USD',
          timezone: 'America/New_York',
        },
      },
    },
  });
  adminB = await prisma.user.create({
    data: {
      madrasa: { connect: { id: madrasaB.id } },
      email: `${TEST_PREFIX}_adminB@test.com`,
      passwordHash: pwHash,
      name: 'Admin Tenant B',
      role: 'MADRASA_ADMIN',
      isActive: true,
      mustChangePassword: false,
    },
  });
  tokenB = signAccessToken({
    userId: adminB.id,
    madrasaId: madrasaB.id,
    role: adminB.role,
  });

  await prisma.subscription.create({
    data: {
      madrasaId: madrasaB.id,
      planId: plan.id,
      status: 'ACTIVE',
      startsAt: now,
      endsAt: dayjs(now).add(365, 'day').toDate(),
      priceAtPurchase: plan.price,
      durationMonthsAtPurchase: plan.durationMonths,
    },
  });

  // Start express server on random port
  testServer = app.listen(0);
  const port = testServer.address().port;
  baseUrl = `http://localhost:${port}/api/madrasa-admin`;
  console.log(`Test server running at ${baseUrl}`);
}

async function teardown() {
  console.log('\n--- Cleaning up test fixtures ---');
  if (testServer) testServer.close();

  try {
    if (madrasaA) {
      await prisma.paymentAllocation.deleteMany({ where: { madrasaId: madrasaA.id } });
      await prisma.receipt.deleteMany({ where: { madrasaId: madrasaA.id } });
      await prisma.payment.deleteMany({ where: { madrasaId: madrasaA.id } });
      await prisma.invoiceItem.deleteMany({ where: { madrasaId: madrasaA.id } });
      await prisma.invoice.deleteMany({ where: { madrasaId: madrasaA.id } });
      await prisma.studentFeeSetting.deleteMany({ where: { madrasaId: madrasaA.id } });
      await prisma.student.deleteMany({ where: { madrasaId: madrasaA.id } });
      await prisma.class.deleteMany({ where: { madrasaId: madrasaA.id } });
      await prisma.academicSection.deleteMany({ where: { madrasaId: madrasaA.id } });
      await prisma.subscription.deleteMany({ where: { madrasaId: madrasaA.id } });
      await prisma.user.deleteMany({ where: { madrasaId: madrasaA.id } });
      await prisma.madrasaSetting.deleteMany({ where: { madrasaId: madrasaA.id } });
      await prisma.madrasa.delete({ where: { id: madrasaA.id } });
    }

    if (madrasaB) {
      await prisma.subscription.deleteMany({ where: { madrasaId: madrasaB.id } });
      await prisma.user.deleteMany({ where: { madrasaId: madrasaB.id } });
      await prisma.madrasaSetting.deleteMany({ where: { madrasaId: madrasaB.id } });
      await prisma.madrasa.delete({ where: { id: madrasaB.id } });
    }
  } catch (err) {
    console.error('Teardown error:', err.message);
  }
}

async function runTests() {
  await setup();

  try {
    console.log('\n=== SUITE 1: Authoritative Financial Calculations & Status ===');

    // Test 1: Paid Students Report
    {
      const res = await fetch(`${baseUrl}/reports/paid?billingYear=2026&billingMonth=9`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert(res.status === 200, 'GET /reports/paid returns HTTP 200');
      const json = await res.json();
      assert(json.success === true, 'Response indicates success: true');
      assert(json.data.reportType === 'PAID_STUDENTS', 'Report type is PAID_STUDENTS');
      assert(json.data.summary.totalStudents === 1, 'Exactly 1 paid student found');
      assert(json.data.summary.totalExpected === '2500.00', 'Summary expected is 2500.00');
      assert(json.data.summary.totalCollected === '2500.00', 'Summary collected is 2500.00');
      assert(json.data.summary.totalBalance === '0.00', 'Summary balance is 0.00');
      assert(json.data.records[0].studentName === 'Ahmed Ali (Paid)', 'Correct student in paid list');
      assert(json.data.records[0].receiptNo.includes(`REC-${TEST_PREFIX}-001`), 'Receipt number is populated');
    }

    // Test 2: Unpaid Students Report
    {
      const res = await fetch(`${baseUrl}/reports/unpaid?billingYear=2026&billingMonth=9`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert(res.status === 200, 'GET /reports/unpaid returns HTTP 200');
      const json = await res.json();
      assert(json.data.reportType === 'UNPAID_STUDENTS', 'Report type is UNPAID_STUDENTS');
      // Unpaid includes invUnpaid (3000) and invOverdue (2000), total = 2. Partial (1500) is excluded!
      assert(json.data.summary.totalUnpaid === 2, 'Exactly 2 unpaid students (partial excluded)');
      assert(json.data.summary.pendingCount === 1, '1 pending student');
      assert(json.data.summary.overdueCount === 1, '1 overdue student');
      assert(json.data.summary.totalOutstanding === '5000.00', 'Total unpaid outstanding is 5000.00');
      const names = json.data.records.map((r) => r.studentName);
      assert(!names.includes('Fatima Zahra (Partial)'), 'Partial payment student excluded from unpaid report');
      assert(!names.includes('Ahmed Ali (Paid)'), 'Paid student excluded from unpaid report');
    }

    // Test 3: Partial Payment Report
    {
      const res = await fetch(`${baseUrl}/reports/partial?billingYear=2026&billingMonth=9`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert(res.status === 200, 'GET /reports/partial returns HTTP 200');
      const json = await res.json();
      assert(json.data.reportType === 'PARTIAL_PAYMENTS', 'Report type is PARTIAL_PAYMENTS');
      assert(json.data.summary.totalPartial === 1, 'Exactly 1 partial payment invoice');
      assert(json.data.summary.totalPaid === '1000.00', 'Partial total paid is 1000.00');
      assert(json.data.summary.totalOutstanding === '1500.00', 'Partial outstanding is 1500.00');
      assert(json.data.records[0].studentName === 'Fatima Zahra (Partial)', 'Correct student in partial list');
    }

    // Test 4: Overdue Students Report
    {
      const res = await fetch(`${baseUrl}/reports/overdue?billingYear=2026&billingMonth=9`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert(res.status === 200, 'GET /reports/overdue returns HTTP 200');
      const json = await res.json();
      assert(json.data.reportType === 'OVERDUE_STUDENTS', 'Report type is OVERDUE_STUDENTS');
      assert(json.data.summary.totalOverdue >= 1, 'At least 1 overdue invoice found');
      const overdueRec = json.data.records.find((r) => r.studentName === 'Zayd Kareem (Overdue)');
      assert(Boolean(overdueRec), 'Overdue record found');
      assert(overdueRec.daysOverdue > 0, 'Days overdue computed as positive calendar days');
    }

    // Test 5: Outstanding Balance Report & Sorting
    {
      const res = await fetch(`${baseUrl}/reports/outstanding?billingYear=2026&billingMonth=9&sortBy=largest_balance`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert(res.status === 200, 'GET /reports/outstanding returns HTTP 200');
      const json = await res.json();
      assert(json.data.reportType === 'OUTSTANDING_BALANCE', 'Report type is OUTSTANDING_BALANCE');
      // Outstanding includes invPartial (1500), invUnpaid (3000), invOverdue (2000) = 3 total, 6500 outstanding
      assert(json.data.summary.totalInvoices === 3, 'Exactly 3 outstanding invoices');
      assert(json.data.summary.totalOutstanding === '6500.00', 'Total outstanding balance is 6500.00');
      // Largest balance first: 3000.00 > 2000.00 > 1500.00
      assert(Number(json.data.records[0].balanceAmount) >= Number(json.data.records[1].balanceAmount), 'Sorted largest balance first');
    }

    console.log('\n=== SUITE 2: Dynamic Sections & Legacy Unassigned Classes ===');

    // Test 6: Section-wise collection aggregation
    {
      const res = await fetch(`${baseUrl}/reports/section-collection?billingYear=2026&billingMonth=9`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert(res.status === 200, 'GET /reports/section-collection returns HTTP 200');
      const json = await res.json();
      assert(json.data.reportType === 'SECTION_COLLECTION', 'Report type is SECTION_COLLECTION');
      const sectionNames = json.data.records.map((r) => r.sectionName);
      assert(sectionNames.includes('Kitab Division'), 'Kitab Division included dynamically');
      assert(sectionNames.includes('Hifz Division'), 'Hifz Division included dynamically');
      assert(sectionNames.includes('Unassigned'), 'Legacy unassigned classes grouped under Unassigned');
    }

    // Test 7: Class filter & cross-section validation
    {
      // Valid filter: Section A1 and Class A1
      const resValid = await fetch(`${baseUrl}/reports/paid?billingYear=2026&billingMonth=9&academicSectionId=${sectionA1.id}&classId=${classA1.id}`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert(resValid.status === 200, 'Valid section & class filter succeeds with 200');

      // Invalid cross-section filter: Section A1 and Class A2 (which belongs to Section A2)
      const resMismatch = await fetch(`${baseUrl}/reports/paid?billingYear=2026&billingMonth=9&academicSectionId=${sectionA1.id}&classId=${classA2.id}`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert(resMismatch.status === 400, 'Cross-section class mismatch returns HTTP 400 Bad Request');
    }

    console.log('\n=== SUITE 3: Missing Monthly Invoices / Not Generated Report ===');

    // Test 8: Missing Invoices Report (Phase 9 Eligibility: A, B, C, D, E)
    {
      // Baseline check: students with existing normal invoices (D) and VOID invoice (E) are NOT missing
      const resBase = await fetch(`${baseUrl}/reports/missing-invoices?billingYear=2026&billingMonth=9`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert(resBase.status === 200, 'GET /reports/missing-invoices returns HTTP 200');
      const jsonBase = await resBase.json();
      assert(jsonBase.data.reportType === 'MISSING_INVOICES', 'Report type is MISSING_INVOICES');

      const missingNamesBase = jsonBase.data.records.map((r) => r.studentName);
      // Case D: Normal invoices are NOT missing
      assert(!missingNamesBase.includes(studentPaid.fullName), 'Case D: Student with existing normal PAID invoice is NOT missing');
      assert(!missingNamesBase.includes(studentPartial.fullName), 'Case D: Student with existing normal PARTIAL invoice is NOT missing');
      // Case E: VOID invoice is NOT missing
      assert(!missingNamesBase.includes(studentVoidInv.fullName), 'Case E: Student with existing VOID invoice is NOT missing');
      // Case C: Student admitted in December (studentFuture) is NOT missing for September
      assert(!missingNamesBase.includes(studentFuture.fullName), 'Case C: Student admitted after selected month (future) is NOT eligible');

      // Create test students for Cases A, B, and C
      // Case A: Student admitted BEFORE month (2026-08-15)
      const studentBefore = await prisma.student.create({
        data: {
          madrasaId: madrasaA.id,
          classId: classA1.id,
          admissionNo: `${TEST_PREFIX}-CASE-A`,
          fullName: 'Case A - Admitted Before Month',
          guardianName: 'Guardian A',
          admissionDate: new Date('2026-08-15'),
          status: 'ACTIVE',
        },
      });

      // Case B: Student admitted MID-MONTH (2026-09-15)
      const studentMid = await prisma.student.create({
        data: {
          madrasaId: madrasaA.id,
          classId: classA1.id,
          admissionNo: `${TEST_PREFIX}-CASE-B`,
          fullName: 'Case B - Admitted Mid Month',
          guardianName: 'Guardian B',
          admissionDate: new Date('2026-09-15'),
          status: 'ACTIVE',
        },
      });

      // Case C: Student admitted AFTER month (2026-10-05)
      const studentAfter = await prisma.student.create({
        data: {
          madrasaId: madrasaA.id,
          classId: classA1.id,
          admissionNo: `${TEST_PREFIX}-CASE-C`,
          fullName: 'Case C - Admitted After Month',
          guardianName: 'Guardian C',
          admissionDate: new Date('2026-10-05'),
          status: 'ACTIVE',
        },
      });

      // Fetch September 2026 missing invoices
      const resSept = await fetch(`${baseUrl}/reports/missing-invoices?billingYear=2026&billingMonth=9`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      const jsonSept = await resSept.json();
      const missingNamesSept = jsonSept.data.records.map((r) => r.studentName);

      assert(missingNamesSept.includes('Case A - Admitted Before Month'), 'Case A: Student admitted before month IS eligible and reported as missing');
      assert(missingNamesSept.includes('Case B - Admitted Mid Month'), 'Case B: Student admitted mid-month IS eligible and reported as missing');
      assert(!missingNamesSept.includes('Case C - Admitted After Month'), 'Case C: Student admitted after month is NOT eligible for September');

      // Now verify August 2026 for Case B: Student admitted in September must NOT be eligible for August
      const resAug = await fetch(`${baseUrl}/reports/missing-invoices?billingYear=2026&billingMonth=8`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      const jsonAug = await resAug.json();
      const missingNamesAug = jsonAug.data.records.map((r) => r.studentName);
      assert(!missingNamesAug.includes('Case B - Admitted Mid Month'), 'Pre-admission month (August) does not report September student as missing');

      // Clean up test students
      await prisma.student.deleteMany({
        where: { id: { in: [studentBefore.id, studentMid.id, studentAfter.id] } },
      });
    }

    console.log('\n=== SUITE 4: Cash Collection & Payment Method Summaries ===');

    // Test 9: Cash Collection vs Billing Period
    {
      const res = await fetch(`${baseUrl}/reports/cash-collection?startDate=2026-09-01&endDate=2026-09-30`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert(res.status === 200, 'GET /reports/cash-collection returns HTTP 200');
      const json = await res.json();
      assert(json.data.reportType === 'CASH_COLLECTION', 'Report type is CASH_COLLECTION');
      // Payments: pay1 (2500 CASH) + pay2 (1000 BANK_TRANSFER) = 3500.00
      assert(json.data.summary.totalCollected === '3500.00', 'Total cash collected matches completed payments (3500.00)');
      assert(json.data.summary.totalCash === '2500.00', 'Total Cash method is 2500.00');
      assert(json.data.summary.totalBankTransfer === '1000.00', 'Total Bank Transfer is 1000.00');
    }

    // Test 10: Payment Method Summary (Mandatory Correction #8)
    {
      const res = await fetch(`${baseUrl}/reports/payment-method-summary?startDate=2026-09-01&endDate=2026-09-30`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert(res.status === 200, 'GET /reports/payment-method-summary returns HTTP 200');
      const json = await res.json();
      assert(json.data.reportType === 'PAYMENT_METHOD_SUMMARY', 'Report type is PAYMENT_METHOD_SUMMARY');
      assert(json.data.summary.totalCompletedAmount === '3500.00', 'Payment method total completed amount is 3500.00');
      const cashRow = json.data.records.find((r) => r.paymentMethod === 'CASH');
      assert(cashRow.completedAmount === '2500.00', 'CASH completed amount is 2500.00');
      const bankRow = json.data.records.find((r) => r.paymentMethod === 'BANK_TRANSFER');
      assert(bankRow.completedAmount === '1000.00', 'BANK_TRANSFER completed amount is 1000.00');
    }

    // Test 11: VOID Payment Exclusion from Totals
    {
      // Create a voided payment
      const voidPayment = await prisma.payment.create({
        data: {
          madrasaId: madrasaA.id,
          studentId: studentPaid.id,
          paymentNo: `PAY-${TEST_PREFIX}-VOIDED`,
          amount: '5000.00',
          paymentMethod: 'CARD',
          status: 'VOID',
          voidedAt: new Date(),
          voidReason: 'Mistaken duplicate entry',
          paidAt: new Date('2026-09-07T12:00:00Z'),
        },
      });

      const resMethod = await fetch(`${baseUrl}/reports/payment-method-summary?startDate=2026-09-01&endDate=2026-09-30`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      const jsonMethod = await resMethod.json();
      assert(jsonMethod.data.summary.totalCompletedAmount === '3500.00', 'Completed total still 3500.00 (VOID payment excluded)');
      assert(jsonMethod.data.summary.totalVoidAmount === '5000.00', 'VOID total explicitly tracked as 5000.00');

      // Clean up void payment
      await prisma.payment.delete({ where: { id: voidPayment.id } });
    }

    console.log('\n=== SUITE 5: Student Fee Statement ===');

    // Test 12: Individual Student Statement with Audit Records
    {
      const res = await fetch(`${baseUrl}/reports/student/${studentPaid.id}/statement?year=2026`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert(res.status === 200, 'GET /reports/student/:id/statement returns HTTP 200');
      const json = await res.json();
      assert(json.data.reportType === 'STUDENT_STATEMENT', 'Report type is STUDENT_STATEMENT');
      assert(json.data.student.fullName === 'Ahmed Ali (Paid)', 'Student profile included');
      assert(json.data.billingLedger.length === 1, 'Billing ledger has 1 invoice');
      assert(json.data.paymentHistory.length === 1, 'Payment history has 1 payment');
      assert(json.data.summary.totalExpected === '2500.00', 'Statement expected total is 2500.00');
      assert(json.data.summary.totalPaid === '2500.00', 'Statement paid total is 2500.00');
      assert(json.data.summary.totalOutstanding === '0.00', 'Statement outstanding is 0.00');
    }

    console.log('\n=== SUITE 6: Multi-Tenant Isolation ===');

    // Test 13: Tenant Isolation & Anti-Enumeration
    {
      // Admin B tries to fetch Tenant A student statement -> 404
      const resCrossStudent = await fetch(`${baseUrl}/reports/student/${studentPaid.id}/statement`, {
        headers: { Authorization: `Bearer ${tokenB}` },
      });
      assert(resCrossStudent.status === 404, 'Cross-tenant student statement returns HTTP 404 Not Found');

      // Admin B requests paid report -> returns empty records for Tenant B
      const resTenantB = await fetch(`${baseUrl}/reports/paid?billingYear=2026&billingMonth=9`, {
        headers: { Authorization: `Bearer ${tokenB}` },
      });
      assert(resTenantB.status === 200, 'Tenant B paid report returns HTTP 200');
      const jsonB = await resTenantB.json();
      assert(jsonB.data.summary.totalStudents === 0, 'Tenant B sees 0 paid students from Tenant A');
      assert(jsonB.data.madrasa.currency === 'USD', 'Tenant B uses its own USD currency');
    }

    console.log('\n=== SUITE 7: CSV & PDF Security & Export Verification ===');

    // Test 14: CSV Formula Injection Protection & Escaping
    {
      assert(escapeCsvCell('=SUM(A1:A2)') === "'=SUM(A1:A2)", 'Formula starting with = is prefixed with single quote');
      assert(escapeCsvCell('+94771234567') === "'+94771234567", 'Phone number with + is prefixed with single quote');
      assert(escapeCsvCell('-CMD') === "'-CMD", 'String starting with - is prefixed with single quote');
      assert(escapeCsvCell('@evil') === "'@evil", 'String starting with @ is prefixed with single quote');
      assert(escapeCsvCell(2500.00) === '2500', 'Pure number is preserved without apostrophe');
      assert(escapeCsvCell('Simple Text') === 'Simple Text', 'Safe text preserved without apostrophe');
      assert(escapeCsvCell('Text, with comma') === '"Text, with comma"', 'Commas are quoted');
      assert(escapeCsvCell('Text "with" quotes') === '"Text ""with"" quotes"', 'Quotes are doubled');

      const csvString = generateCsvString({
        headers: ['Name', 'Formula'],
        rows: [['Ali', '=1+1']],
      });
      assert(csvString.startsWith('\uFEFF'), 'CSV string starts with UTF-8 BOM');
      assert(csvString.includes("Ali,'=1+1"), 'Formula escaped in CSV table');
    }

    // Test 15: HTML Escaping for PDF Safety
    {
      const maliciousInput = '<script>alert("XSS")</script>';
      const escaped = escapeHtml(maliciousInput);
      assert(!escaped.includes('<script>'), 'Script tag escaped');
      assert(escaped.includes('&lt;script&gt;'), 'HTML entities used for tags');
    }

    // Test 16: Filename Sanitization
    {
      const unsafe = 'Madrasa/..\\Nexa:Report*?|Test';
      const safe = sanitizeFilename(unsafe);
      assert(!safe.includes('/'), 'Path separators removed');
      assert(!safe.includes('..'), 'Directory traversal removed');
      assert(!safe.includes(':'), 'Colons removed');
    }

    // Test 17: CSV Export HTTP Endpoint
    {
      const resCsv = await fetch(`${baseUrl}/reports/paid?billingYear=2026&billingMonth=9&format=csv`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert(resCsv.status === 200, 'CSV export returns HTTP 200');
      const contentType = resCsv.headers.get('content-type');
      assert(contentType.includes('text/csv'), 'Content-Type is text/csv');
      const disposition = resCsv.headers.get('content-disposition');
      assert(disposition.includes('attachment; filename='), 'Content-Disposition has attachment header');
      const csvBuffer = await resCsv.arrayBuffer();
      const csvBytes = new Uint8Array(csvBuffer);
      const hasBom = csvBytes[0] === 0xef && csvBytes[1] === 0xbb && csvBytes[2] === 0xbf;
      assert(hasBom, 'Exported CSV body starts with UTF-8 BOM (0xEF, 0xBB, 0xBF)');
      const text = Buffer.from(csvBuffer).toString('utf8');
      assert(text.includes('Ahmed Ali (Paid)'), 'Exported CSV includes student data');
    }

    // Test 18: PDF Export HTTP Endpoint
    {
      const resPdf = await fetch(`${baseUrl}/reports/paid?billingYear=2026&billingMonth=9&format=pdf`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert(resPdf.status === 200, 'PDF export returns HTTP 200');
      const contentType = resPdf.headers.get('content-type');
      assert(contentType.includes('application/pdf'), 'Content-Type is application/pdf');
      const buffer = await resPdf.arrayBuffer();
      const uint8 = new Uint8Array(buffer);
      const pdfMagic = String.fromCharCode(uint8[0], uint8[1], uint8[2], uint8[3]);
      assert(pdfMagic === '%PDF', 'PDF binary has valid %PDF magic header');
      assert(buffer.byteLength > 1000, 'PDF buffer has legitimate non-empty size');
    }

    // Test 19: Preview Pagination vs Export Completeness (Mandatory Correction #12 & #13)
    {
      // Create 25 additional dummy paid invoices to test pagination
      const dummyStudents = [];
      const dummyInvoices = [];
      for (let i = 1; i <= 25; i++) {
        const s = await prisma.student.create({
          data: {
            madrasaId: madrasaA.id,
            classId: classA1.id,
            admissionNo: `${TEST_PREFIX}-DUMMY-${i}`,
            fullName: `Pagination Student ${i}`,
            guardianName: `Guardian Dummy ${i}`,
            admissionDate: new Date('2026-01-01'),
            status: 'ACTIVE',
          },
        });
        dummyStudents.push(s);

        const inv = await prisma.invoice.create({
          data: {
            madrasaId: madrasaA.id,
            studentId: s.id,
            invoiceNo: `INV-${TEST_PREFIX}-DUMMY-${i}`,
            billingYear: 2026,
            billingMonth: 9,
            issueDate: new Date('2026-09-01'),
            dueDate: new Date('2026-09-25'),
            subtotal: '100.00',
            totalAmount: '100.00',
            paidAmount: '100.00',
            balanceAmount: '0.00',
            status: 'PAID',
          },
        });
        dummyInvoices.push(inv);

        const pay = await prisma.payment.create({
          data: {
            madrasaId: madrasaA.id,
            studentId: s.id,
            paymentNo: `PAY-${TEST_PREFIX}-DUMMY-${i}`,
            amount: '100.00',
            paymentMethod: 'CASH',
            status: 'COMPLETED',
            paidAt: new Date('2026-09-05T10:00:00Z'),
          },
        });
        await prisma.paymentAllocation.create({
          data: {
            madrasaId: madrasaA.id,
            paymentId: pay.id,
            invoiceId: inv.id,
            amount: '100.00',
          },
        });
      }

      // Total paid records now = 1 original + 25 dummy = 26 records
      // 1. Fetch preview with limit = 10
      const resPreview = await fetch(`${baseUrl}/reports/paid?billingYear=2026&billingMonth=9&page=1&limit=10`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      const jsonPreview = await resPreview.json();
      assert(jsonPreview.data.records.length === 10, 'Preview paginated slice returns exactly 10 records');
      assert(jsonPreview.data.totalRecords === 26, 'Global totalRecords is 26');
      assert(jsonPreview.data.summary.totalStudents === 26, 'Global summary totalStudents is 26 (NOT just the 10 on preview page!)');

      // 2. Fetch CSV export: should export all 26 records, NOT just 10!
      const resCsvFull = await fetch(`${baseUrl}/reports/paid?billingYear=2026&billingMonth=9&page=1&limit=10&format=csv`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      const csvContent = await resCsvFull.text();
      // Count lines (header + 26 records)
      const lines = csvContent.trim().split('\r\n');
      assert(lines.length === 27, `CSV export exports all 26 data rows + header (got ${lines.length} lines)`);

      // Clean up dummy rows
      for (const s of dummyStudents) {
        await prisma.paymentAllocation.deleteMany({ where: { madrasaId: madrasaA.id, payment: { studentId: s.id } } });
        await prisma.payment.deleteMany({ where: { studentId: s.id } });
        await prisma.invoice.deleteMany({ where: { studentId: s.id } });
        await prisma.student.delete({ where: { id: s.id } });
      }
    }

  } finally {
    await teardown();
  }

  console.log('\n=============================================');
  console.log(`Report Suite Results: ${testPassedCount} Passed, ${testFailedCount} Failed`);
  console.log('=============================================\n');

  if (testFailedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
