import { prisma } from "../src/lib/prisma.js";
import { hashPassword } from "../src/utils/password.js";
import { signAccessToken } from "../src/utils/jwt.js";
import app from "../src/app.js";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
import {
  isInvoiceNoCollision,
  isMonthlyDuplicateCollision,
  calculateBillingBoundaries,
} from "../src/services/invoice.service.js";

dayjs.extend(utc);
dayjs.extend(timezone);

const TEST_PREFIX = "p9_test_" + Date.now();

let testPassedCount = 0;
let testFailedCount = 0;

function assert(condition, testName) {
  if (condition) {
    console.log("  ✓ [PASS] " + testName);
    testPassedCount++;
  } else {
    console.error("  ✗ [FAIL] " + testName);
    testFailedCount++;
  }
}

let testServer = null;
let baseUrl = "";

// Fixtures
let superAdminUser = null;
let superAdminToken = "";

let madrasaA = null;
let adminA = null;
let tokenA = "";
let planA = null;
let subA = null;
let classA1 = null;
let classA2 = null;
let studentA1 = null;
let studentA2 = null;
let studentA3 = null;
let studentA4 = null;
let studentA_noFee = null;
let studentA_inactive = null;
let studentA_archived = null;
let studentA_future = null;

let madrasaB = null;
let adminB = null;
let tokenB = "";
let planB = null;
let subB = null;
let classB1 = null;
let studentB1 = null;

let expiredMadrasa = null;
let expiredAdmin = null;
let expiredToken = "";
let expiredSub = null;

async function setup() {
  console.log("\n--- Setting up Phase 9 Test Fixtures ---");
  const now = new Date();

  // 1. Super Admin
  superAdminUser = await prisma.user.create({
    data: {
      name: "Super Admin Phase 9",
      email: `${TEST_PREFIX}_sadmin@example.com`,
      passwordHash: await hashPassword("SuperSecurePassword123!"),
      role: "SUPER_ADMIN",
      isActive: true,
      mustChangePassword: false,
    },
  });
  superAdminToken = signAccessToken({
    userId: superAdminUser.id,
    email: superAdminUser.email,
    role: superAdminUser.role,
    madrasaId: null,
  });

  // 2. Madrasa A (Active tenant with Colombo timezone)
  madrasaA = await prisma.madrasa.create({
    data: {
      name: "Madrasa A Invoice Test",
      code: `${TEST_PREFIX.slice(-6).toUpperCase()}01`,
      slug: `${TEST_PREFIX}-m-a`,
      email: `${TEST_PREFIX}_ma@example.com`,
      status: "ACTIVE",
      settings: {
        create: {
          invoicePrefix: "INV-A-",
          timezone: "Asia/Colombo",
          currency: "LKR",
        },
      },
    },
  });

  adminA = await prisma.user.create({
    data: {
      name: "Admin Madrasa A",
      email: `${TEST_PREFIX}_admina@example.com`,
      passwordHash: await hashPassword("SuperSecurePassword123!"),
      role: "MADRASA_ADMIN",
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

  planA = await prisma.plan.create({
    data: {
      name: "Plan A",
      code: `${TEST_PREFIX}_PLA`.slice(0, 30),
      durationMonths: 12,
      price: 15000.0,
      isActive: true,
    },
  });
  subA = await prisma.subscription.create({
    data: {
      madrasaId: madrasaA.id,
      planId: planA.id,
      status: "ACTIVE",
      startsAt: new Date(Date.now() - 30 * 86400000),
      endsAt: new Date(Date.now() + 300 * 86400000),
      priceAtPurchase: 250.0,
      durationMonthsAtPurchase: 12,
    },
  });

  // Classes for Madrasa A
  classA1 = await prisma.class.create({
    data: {
      madrasaId: madrasaA.id,
      name: "Class 1A (LKR 2000)",
      code: "1A",
      defaultMonthlyFee: 2000.0,
      isActive: true,
    },
  });
  classA2 = await prisma.class.create({
    data: {
      madrasaId: madrasaA.id,
      name: "Class 2A (LKR 3500)",
      code: "2A",
      defaultMonthlyFee: 3500.0,
      isActive: true,
    },
  });

  // Students for Madrasa A
  // Student A1: Class default fee (2000.00), admission Jan 2026
  studentA1 = await prisma.student.create({
    data: {
      madrasaId: madrasaA.id,
      classId: classA1.id,
      admissionNo: "001",
      fullName: "Student A1 Default Fee",
      guardianName: "Guardian One",
      guardianPhone: "0771112233",
      admissionDate: new Date("2026-01-10T00:00:00Z"),
      monthlyFee: 2000.0,
      status: "ACTIVE",
    },
  });

  // Student A2: Custom fee override (2500.00 effective from 2026-04-01)
  // Before April 1: fee was 1800. Override Jan-Apr = 1800, Apr onward = 2500.
  studentA2 = await prisma.student.create({
    data: {
      madrasaId: madrasaA.id,
      classId: classA1.id,
      admissionNo: "002",
      fullName: "Student A2 Historical Override",
      guardianName: "Guardian Two",
      guardianPhone: "0772223344",
      admissionDate: new Date("2026-01-01T00:00:00Z"),
      monthlyFee: 2500.0,
      status: "ACTIVE",
    },
  });
  await prisma.studentFeeSetting.createMany({
    data: [
      {
        madrasaId: madrasaA.id,
        studentId: studentA2.id,
        amount: 1800.0,
        effectiveFrom: new Date("2026-01-01T00:00:00Z"),
        effectiveTo: new Date("2026-04-01T00:00:00Z"),
        reason: "Initial scholarship rate",
      },
      {
        madrasaId: madrasaA.id,
        studentId: studentA2.id,
        amount: 2500.0,
        effectiveFrom: new Date("2026-04-01T00:00:00Z"),
        effectiveTo: null,
        reason: "Standard revised fee",
      },
    ],
  });

  // Student A3: Mid-month admission (Sep 15, 2026), Class default 3500.00
  studentA3 = await prisma.student.create({
    data: {
      madrasaId: madrasaA.id,
      classId: classA2.id,
      admissionNo: "003",
      fullName: "Student A3 Mid-Month Admission",
      guardianName: "Guardian Three",
      guardianPhone: "0773334455",
      admissionDate: new Date("2026-09-15T00:00:00Z"),
      monthlyFee: 3500.0,
      status: "ACTIVE",
    },
  });

  // Student A4: Configured zero fee (0.00 legitimate fee)
  studentA4 = await prisma.student.create({
    data: {
      madrasaId: madrasaA.id,
      classId: classA1.id,
      admissionNo: "004",
      fullName: "Student A4 Zero Fee",
      guardianName: "Guardian Four",
      guardianPhone: "0774445566",
      admissionDate: new Date("2026-01-01T00:00:00Z"),
      monthlyFee: 0.0,
      status: "ACTIVE",
    },
  });
  await prisma.studentFeeSetting.create({
    data: {
      madrasaId: madrasaA.id,
      studentId: studentA4.id,
      amount: 0.0,
      effectiveFrom: new Date("2026-01-01T00:00:00Z"),
      effectiveTo: null,
      reason: "100% full orphan grant",
    },
  });

  // Student A_noFee: No class assigned, no override -> UNCONFIGURED
  studentA_noFee = await prisma.student.create({
    data: {
      madrasaId: madrasaA.id,
      classId: null,
      admissionNo: "005",
      fullName: "Student A No Fee",
      guardianName: "Guardian Five",
      guardianPhone: "0775556677",
      admissionDate: new Date("2026-01-01T00:00:00Z"),
      monthlyFee: null,
      status: "ACTIVE",
    },
  });

  // Inactive & Archived Students
  studentA_inactive = await prisma.student.create({
    data: {
      madrasaId: madrasaA.id,
      classId: classA1.id,
      admissionNo: "006",
      fullName: "Student A Inactive",
      guardianName: "Guardian Six",
      admissionDate: new Date("2026-01-01T00:00:00Z"),
      monthlyFee: 2000.0,
      status: "INACTIVE",
    },
  });
  studentA_archived = await prisma.student.create({
    data: {
      madrasaId: madrasaA.id,
      classId: classA1.id,
      admissionNo: "007",
      fullName: "Student A Archived",
      guardianName: "Guardian Seven",
      admissionDate: new Date("2026-01-01T00:00:00Z"),
      monthlyFee: 2000.0,
      status: "ARCHIVED",
    },
  });

  // Student admitted in the future (November 2026)
  studentA_future = await prisma.student.create({
    data: {
      madrasaId: madrasaA.id,
      classId: classA1.id,
      admissionNo: "008",
      fullName: "Student A Future Admitted",
      guardianName: "Guardian Eight",
      admissionDate: new Date("2026-11-01T00:00:00Z"),
      monthlyFee: 2000.0,
      status: "ACTIVE",
    },
  });

  // 3. Madrasa B (Tenant Isolation Victim)
  madrasaB = await prisma.madrasa.create({
    data: {
      name: "Madrasa B Invoice Test",
      code: `${TEST_PREFIX.slice(-6).toUpperCase()}02`,
      slug: `${TEST_PREFIX}-m-b`,
      email: `${TEST_PREFIX}_mb@example.com`,
      status: "ACTIVE",
      settings: {
        create: {
          invoicePrefix: "INV-B-",
          timezone: "Asia/Colombo",
          currency: "LKR",
        },
      },
    },
  });
  adminB = await prisma.user.create({
    data: {
      name: "Admin Madrasa B",
      email: `${TEST_PREFIX}_adminb@example.com`,
      passwordHash: await hashPassword("SuperSecurePassword123!"),
      role: "MADRASA_ADMIN",
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
  subB = await prisma.subscription.create({
    data: {
      madrasaId: madrasaB.id,
      planId: planA.id,
      status: "ACTIVE",
      startsAt: new Date(Date.now() - 30 * 86400000),
      endsAt: new Date(Date.now() + 300 * 86400000),
      priceAtPurchase: 250.0,
      durationMonthsAtPurchase: 12,
    },
  });
  classB1 = await prisma.class.create({
    data: {
      madrasaId: madrasaB.id,
      name: "Class 1B",
      code: "1B",
      defaultMonthlyFee: 5000.0,
      isActive: true,
    },
  });
  studentB1 = await prisma.student.create({
    data: {
      madrasaId: madrasaB.id,
      classId: classB1.id,
      admissionNo: "B001",
      fullName: "Student B1",
      guardianName: "Guardian B",
      admissionDate: new Date("2026-01-01T00:00:00Z"),
      monthlyFee: 5000.0,
      status: "ACTIVE",
    },
  });

  // 4. Expired Madrasa (Subscription Gate Check)
  expiredMadrasa = await prisma.madrasa.create({
    data: {
      name: "Madrasa Expired",
      code: `${TEST_PREFIX.slice(-6).toUpperCase()}03`,
      slug: `${TEST_PREFIX}-m-exp`,
      email: `${TEST_PREFIX}_mexp@example.com`,
      status: "ACTIVE",
      settings: {
        create: {
          invoicePrefix: "INV-EXP-",
          timezone: "Asia/Colombo",
          currency: "LKR",
        },
      },
    },
  });
  expiredAdmin = await prisma.user.create({
    data: {
      name: "Admin Expired",
      email: `${TEST_PREFIX}_adminexp@example.com`,
      passwordHash: await hashPassword("SuperSecurePassword123!"),
      role: "MADRASA_ADMIN",
      madrasaId: expiredMadrasa.id,
      isActive: true,
      mustChangePassword: false,
    },
  });
  expiredToken = signAccessToken({
    userId: expiredAdmin.id,
    email: expiredAdmin.email,
    role: expiredAdmin.role,
    madrasaId: expiredMadrasa.id,
  });
  expiredSub = await prisma.subscription.create({
    data: {
      madrasaId: expiredMadrasa.id,
      planId: planA.id,
      status: "EXPIRED",
      startsAt: new Date(Date.now() - 60 * 86400000),
      endsAt: new Date(Date.now() - 10 * 86400000),
      priceAtPurchase: 250.0,
      durationMonthsAtPurchase: 12,
    },
  });

  // Start express server on ephemeral port
  testServer = app.listen(0);
  const port = testServer.address().port;
  baseUrl = `http://127.0.0.1:${port}/api/madrasa-admin`;
  console.log(`Test server listening on port ${port}`);
}

async function teardown() {
  console.log("\n--- Tearing Down Phase 9 Test Fixtures ---");
  if (testServer) {
    await new Promise((resolve) => testServer.close(resolve));
  }

  const madrasaIds = [madrasaA?.id, madrasaB?.id, expiredMadrasa?.id].filter(Boolean);
  const userIds = [superAdminUser?.id, adminA?.id, adminB?.id, expiredAdmin?.id].filter(Boolean);

  await prisma.activityLog.deleteMany({
    where: { OR: [{ madrasaId: { in: madrasaIds } }, { userId: { in: userIds } }] },
  });
  await prisma.invoiceItem.deleteMany({
    where: { madrasaId: { in: madrasaIds } },
  });
  await prisma.invoice.deleteMany({
    where: { madrasaId: { in: madrasaIds } },
  });
  await prisma.studentFeeSetting.deleteMany({
    where: { madrasaId: { in: madrasaIds } },
  });
  await prisma.student.deleteMany({
    where: { madrasaId: { in: madrasaIds } },
  });
  await prisma.class.deleteMany({
    where: { madrasaId: { in: madrasaIds } },
  });
  await prisma.subscription.deleteMany({
    where: { madrasaId: { in: madrasaIds } },
  });
  await prisma.madrasaSetting.deleteMany({
    where: { madrasaId: { in: madrasaIds } },
  });
  await prisma.user.deleteMany({
    where: { id: { in: userIds } },
  });
  await prisma.madrasa.deleteMany({
    where: { id: { in: madrasaIds } },
  });
  if (planA) {
    await prisma.plan.delete({ where: { id: planA.id } });
  }
  console.log("Teardown complete. Zero test data remains.");
}

async function runTests() {
  try {
    await setup();

    // ==========================================
    // GROUP 1: AUTHENTICATION & ACCESS GATES
    // ==========================================
    console.log("\n[GROUP 1] Authentication & Access Gates");

    // 1. Unauthenticated request rejected
    const unauthRes = await fetch(`${baseUrl}/invoices/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ billingYear: 2026, billingMonth: 9 }),
    });
    assert(unauthRes.status === 401, "Unauthenticated invoice preview rejected (401)");

    // 2. Super Admin rejected from tenant invoice workspace
    const superAdminRes = await fetch(`${baseUrl}/invoices/preview`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ billingYear: 2026, billingMonth: 9 }),
    });
    assert(superAdminRes.status === 403, "Super Admin rejected from tenant invoice preview (403)");

    // 3. Expired subscription rejected
    const expiredRes = await fetch(`${baseUrl}/invoices/preview`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${expiredToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ billingYear: 2026, billingMonth: 9 }),
    });
    assert(expiredRes.status === 403, "Expired subscription rejected from invoice preview (403)");

    // ==========================================
    // GROUP 2: INVOICE PREVIEW ENGINE
    // ==========================================
    console.log("\n[GROUP 2] Invoice Preview Engine");

    // 4. Preview for September 2026
    const prevRes = await fetch(`${baseUrl}/invoices/preview`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ billingYear: 2026, billingMonth: 9 }),
    });
    assert(prevRes.status === 200, "Preview POST returns 200 OK");
    const prevData = (await prevRes.json()).data;

    assert(prevData.billingYear === 2026 && prevData.billingMonth === 9, "Preview returns correct year/month");
    assert(prevData.monthName === "September", "Preview returns correct monthName");

    // Check student evaluations in preview:
    const itemA1 = prevData.items.find((i) => i.studentId === studentA1.id);
    assert(itemA1?.status === "READY", "Student A1 is READY");
    assert(itemA1?.feeSource === "CLASS_DEFAULT", "Student A1 resolved feeSource = CLASS_DEFAULT");
    assert(itemA1?.resolvedFee === "2000.00", "Student A1 resolvedFee = 2000.00");

    // Student A2: Historical override in Sep 2026 (override was 2500)
    const itemA2 = prevData.items.find((i) => i.studentId === studentA2.id);
    assert(itemA2?.status === "READY", "Student A2 is READY");
    assert(itemA2?.feeSource === "STUDENT_OVERRIDE", "Student A2 resolved feeSource = STUDENT_OVERRIDE");
    assert(itemA2?.resolvedFee === "2500.00", "Student A2 resolvedFee = 2500.00 (Apr onward)");

    // Student A3: Mid-month admission Sep 15 -> eligible for full fee 3500.00
    const itemA3 = prevData.items.find((i) => i.studentId === studentA3.id);
    assert(itemA3?.status === "READY", "Student A3 mid-month admission is READY");
    assert(itemA3?.resolvedFee === "3500.00", "Student A3 resolved full monthly fee 3500.00 without proration");

    // Student A4: 0.00 configured fee
    const itemA4 = prevData.items.find((i) => i.studentId === studentA4.id);
    assert(itemA4?.status === "READY", "Student A4 0.00 fee is READY (not UNCONFIGURED)");
    assert(itemA4?.resolvedFee === "0.00", "Student A4 resolvedFee = 0.00");

    // Student A_noFee: UNCONFIGURED fee
    const itemNoFee = prevData.items.find((i) => i.studentId === studentA_noFee.id);
    assert(itemNoFee?.status === "SKIPPED_NO_FEE", "Student without fee setting or class is SKIPPED_NO_FEE");
    assert(itemNoFee?.resolvedFee === null, "Student without fee has null resolvedFee");

    // Future student (Nov 2026) not included in September bulk preview
    const itemFuture = prevData.items.find((i) => i.studentId === studentA_future.id);
    assert(!itemFuture, "Future-admitted student excluded from September bulk preview");

    // Inactive & Archived students not included in standard bulk preview
    const itemInactive = prevData.items.find((i) => i.studentId === studentA_inactive.id);
    const itemArchived = prevData.items.find((i) => i.studentId === studentA_archived.id);
    assert(!itemInactive && !itemArchived, "INACTIVE and ARCHIVED students excluded from bulk preview");

    // Tenant isolation in preview: Zero Madrasa B students visible
    const itemB = prevData.items.find((i) => i.studentId === studentB1.id);
    assert(!itemB, "Zero Madrasa B students visible in Madrasa A preview");

    // Expected total summation: 2000 + 2500 + 3500 + 0 = 8000.00
    assert(prevData.totalExpectedAmount === "8000.00", "totalExpectedAmount = 8000.00 (Decimal precision)");

    // 5. Preview for March 2026: Historical override check (Student A2 should be 1800.00 in March)
    const prevMarRes = await fetch(`${baseUrl}/invoices/preview`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ billingYear: 2026, billingMonth: 3 }),
    });
    const prevMarData = (await prevMarRes.json()).data;
    const itemA2_Mar = prevMarData.items.find((i) => i.studentId === studentA2.id);
    assert(itemA2_Mar?.resolvedFee === "1800.00", "Student A2 resolved 1800.00 for March 2026 historical interval");

    // 6. Preview creates zero database invoice records (Read-only guarantee)
    const invoiceCountAfterPreview = await prisma.invoice.count({ where: { madrasaId: madrasaA.id } });
    assert(invoiceCountAfterPreview === 0, "Preview creates zero database Invoice records");

    // 7. Preview with Class filter
    const prevClassRes = await fetch(`${baseUrl}/invoices/preview`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ billingYear: 2026, billingMonth: 9, classId: classA2.id }),
    });
    const prevClassData = (await prevClassRes.json()).data;
    assert(prevClassData.readyCount === 1, "Class 2A preview contains only Class 2A students (readyCount = 1)");
    assert(prevClassData.items[0]?.studentId === studentA3.id, "Class 2A preview contains Student A3");

    // 8. Cross-tenant Class filter rejected (404)
    const foreignClassRes = await fetch(`${baseUrl}/invoices/preview`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ billingYear: 2026, billingMonth: 9, classId: classB1.id }),
    });
    assert(foreignClassRes.status === 404, "Foreign classId filter returns 404 Not Found");

    // 9. Explicit student selection: includes skipped reasons for inactive/archived/future
    const explicitPrevRes = await fetch(`${baseUrl}/invoices/preview`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        billingYear: 2026,
        billingMonth: 9,
        studentIds: [
          studentA1.id,
          studentA1.id, // Duplicate in input
          studentA_inactive.id,
          studentA_archived.id,
          studentA_future.id,
        ],
      }),
    });
    const explicitPrevData = (await explicitPrevRes.json()).data;
    assert(explicitPrevData.items.length === 4, "Duplicate studentIds de-duplicated to 4 distinct students");
    assert(explicitPrevData.items.find((i) => i.studentId === studentA_inactive.id)?.status === "SKIPPED_INACTIVE", "Explicit inactive student returned as SKIPPED_INACTIVE");
    assert(explicitPrevData.items.find((i) => i.studentId === studentA_archived.id)?.status === "SKIPPED_ARCHIVED", "Explicit archived student returned as SKIPPED_ARCHIVED");
    assert(explicitPrevData.items.find((i) => i.studentId === studentA_future.id)?.status === "SKIPPED_NOT_ADMITTED", "Explicit future student returned as SKIPPED_NOT_ADMITTED");

    // 10. Explicit student selection with foreign student ID -> 404
    const foreignStudentRes = await fetch(`${baseUrl}/invoices/preview`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        billingYear: 2026,
        billingMonth: 9,
        studentIds: [studentA1.id, studentB1.id],
      }),
    });
    assert(foreignStudentRes.status === 404, "Foreign studentId returns 404 Not Found");

    // 11. ClassId + mismatched selected student -> 400 Bad Request
    const mismatchedRes = await fetch(`${baseUrl}/invoices/preview`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        billingYear: 2026,
        billingMonth: 9,
        classId: classA1.id,
        studentIds: [studentA1.id, studentA3.id], // studentA3 belongs to classA2!
      }),
    });
    assert(mismatchedRes.status === 400, "ClassId with mismatched studentIds rejected with 400 Bad Request");

    // ==========================================
    // GROUP 3: INVOICE GENERATION ENGINE
    // ==========================================
    console.log("\n[GROUP 3] Invoice Generation Engine");

    // 12. Single student generation (Student A1, Sep 2026)
    const genSingleRes = await fetch(`${baseUrl}/invoices/generate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        billingYear: 2026,
        billingMonth: 9,
        dueDate: "2026-09-25",
        studentIds: [studentA1.id],
      }),
    });
    assert(genSingleRes.status === 201, "Generate single student returns 201 Created");
    const genSingleData = (await genSingleRes.json()).data;
    assert(genSingleData.generatedCount === 1, "generatedCount = 1");
    assert(genSingleData.totalGeneratedAmount === "2000.00", "totalGeneratedAmount = 2000.00");

    const createdInvA1 = await prisma.invoice.findFirst({
      where: { madrasaId: madrasaA.id, studentId: studentA1.id, billingYear: 2026, billingMonth: 9 },
      include: { items: true },
    });
    assert(Boolean(createdInvA1), "Invoice record created in database");
    assert(createdInvA1.invoiceNo.startsWith("INV-A-202609-"), "Invoice number uses prefix and YYYYMM format");
    assert(createdInvA1.items.length === 1, "InvoiceItem created atomically with Invoice");
    assert(createdInvA1.items[0].description === "Monthly Fee — September 2026", "InvoiceItem description is correct");

    // Initial financial state verification (Mandatory Correction 2)
    assert(Number(createdInvA1.totalAmount) === 2000, "totalAmount initialized to 2000.00");
    assert(Number(createdInvA1.paidAmount) === 0, "paidAmount initialized to 0.00");
    assert(Number(createdInvA1.balanceAmount) === 2000, "balanceAmount initialized to totalAmount (2000.00)");
    assert(createdInvA1.status === "PENDING", "Initial status is PENDING");

    // 13. Idempotent re-generation: Calling generate again reports ALREADY_INVOICED
    const genIdempotentRes = await fetch(`${baseUrl}/invoices/generate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        billingYear: 2026,
        billingMonth: 9,
        dueDate: "2026-09-25",
        studentIds: [studentA1.id],
      }),
    });
    const genIdempotentData = (await genIdempotentRes.json()).data;
    assert(genIdempotentData.generatedCount === 0, "Re-generation: generatedCount = 0");
    assert(genIdempotentData.alreadyExistingCount === 1, "Re-generation: alreadyExistingCount = 1");
    assert(genIdempotentData.items[0]?.status === "ALREADY_INVOICED", "Item reported as ALREADY_INVOICED");

    // 14. Bulk generation for remaining students in September 2026
    const genBulkRes = await fetch(`${baseUrl}/invoices/generate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        billingYear: 2026,
        billingMonth: 9,
        dueDate: "2026-09-25",
      }),
    });
    assert(genBulkRes.status === 201, "Bulk generation returns 201 Created");
    const genBulkData = (await genBulkRes.json()).data;
    assert(genBulkData.alreadyExistingCount === 1, "Bulk run identifies Student A1 as already existing");
    // Remaining generated: A2 (2500) + A3 (3500) + A4 (0.00) = 3 generated, 6000.00 total
    assert(genBulkData.generatedCount === 3, "Bulk run generated 3 new invoices (A2, A3, A4)");
    assert(genBulkData.skippedNoFeeCount === 1, "Bulk run skipped Student A_noFee (skippedNoFeeCount = 1)");
    assert(genBulkData.totalGeneratedAmount === "6000.00", "Bulk run totalGeneratedAmount = 6000.00");

    // 15. Activity Log generated for bulk run
    const activityLog = await prisma.activityLog.findFirst({
      where: { madrasaId: madrasaA.id, action: "INVOICE_BULK_GENERATED" },
      orderBy: { createdAt: "desc" },
    });
    assert(Boolean(activityLog), "ActivityLog INVOICE_BULK_GENERATED created");
    assert(activityLog.metadata?.generatedCount === 3, "ActivityLog records accurate generatedCount");

    // ==========================================
    // GROUP 4: HISTORICAL SNAPSHOT IMMUTABILITY
    // ==========================================
    console.log("\n[GROUP 4] Historical Snapshot Immutability");

    // 16. Mutate Class A1 defaultMonthlyFee to 5000.00
    await prisma.class.update({
      where: { id: classA1.id },
      data: { defaultMonthlyFee: 5000.0 },
    });

    // Check existing invoice for Student A1: Must REMAIN 2000.00
    const invA1AfterClassChange = await prisma.invoice.findUnique({
      where: { id: createdInvA1.id },
      include: { items: true },
    });
    assert(Number(invA1AfterClassChange.totalAmount) === 2000, "Old invoice totalAmount remains 2000.00 after Class fee increased to 5000");
    assert(Number(invA1AfterClassChange.items[0].unitAmount) === 2000, "Old invoice item unitAmount remains 2000.00");

    // Restore Class A1 fee
    await prisma.class.update({
      where: { id: classA1.id },
      data: { defaultMonthlyFee: 2000.0 },
    });

    // ==========================================
    // GROUP 5: TIMEZONE & OVERDUE EVALUATION
    // ==========================================
    console.log("\n[GROUP 5] Timezone & Overdue Evaluation");

    // 17. Create an invoice with dueDate in the past (e.g., 2 days ago)
    const pastDueDate = dayjs().tz("Asia/Colombo").subtract(2, "day").endOf("day").toDate();
    const pastInvoice = await prisma.invoice.create({
      data: {
        madrasaId: madrasaA.id,
        studentId: studentA1.id,
        invoiceNo: "INV-A-PAST-001",
        billingYear: 2026,
        billingMonth: 8,
        issueDate: new Date(),
        dueDate: pastDueDate,
        subtotal: 2000.0,
        discountAmount: 0.0,
        totalAmount: 2000.0,
        paidAmount: 0.0,
        balanceAmount: 2000.0,
        status: "PENDING",
      },
    });

    // Create an invoice with dueDate today (end of local day today)
    const todayDueDate = dayjs().tz("Asia/Colombo").endOf("day").toDate();
    const todayInvoice = await prisma.invoice.create({
      data: {
        madrasaId: madrasaA.id,
        studentId: studentA1.id,
        invoiceNo: "INV-A-TODAY-001",
        billingYear: 2026,
        billingMonth: 7,
        issueDate: new Date(),
        dueDate: todayDueDate,
        subtotal: 2000.0,
        discountAmount: 0.0,
        totalAmount: 2000.0,
        paidAmount: 0.0,
        balanceAmount: 2000.0,
        status: "PENDING",
      },
    });

    // Create a PAID past invoice: should NEVER be overdue
    const paidPastInvoice = await prisma.invoice.create({
      data: {
        madrasaId: madrasaA.id,
        studentId: studentA1.id,
        invoiceNo: "INV-A-PAID-001",
        billingYear: 2026,
        billingMonth: 6,
        issueDate: new Date(),
        dueDate: pastDueDate,
        subtotal: 2000.0,
        discountAmount: 0.0,
        totalAmount: 2000.0,
        paidAmount: 2000.0,
        balanceAmount: 0.0,
        status: "PAID",
      },
    });

    // Fetch invoice list to inspect overdue status
    const listOverdueRes = await fetch(`${baseUrl}/invoices?pageSize=50`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const listOverdueData = (await listOverdueRes.json()).data;

    const fetchedPast = listOverdueData.items.find((i) => i.id === pastInvoice.id);
    assert(fetchedPast?.isOverdue === true, "Invoice with past due date has isOverdue = true");
    assert(fetchedPast?.displayStatus === "OVERDUE", "Invoice with past due date has displayStatus = OVERDUE");

    const fetchedToday = listOverdueData.items.find((i) => i.id === todayInvoice.id);
    assert(fetchedToday?.isOverdue === false, "Invoice due today end-of-day is NOT yet overdue (isOverdue = false)");
    assert(fetchedToday?.displayStatus === "PENDING", "Invoice due today remains displayStatus = PENDING");

    const fetchedPaid = listOverdueData.items.find((i) => i.id === paidPastInvoice.id);
    assert(fetchedPaid?.isOverdue === false, "PAID invoice with past dueDate is NOT overdue");
    assert(fetchedPaid?.displayStatus === "PAID", "PAID invoice maintains displayStatus = PAID");

    // ==========================================
    // GROUP 6: INVOICE VOID WORKFLOW
    // ==========================================
    console.log("\n[GROUP 6] Invoice VOID Workflow");

    // 18. Void pastInvoice with notes preserved
    await prisma.invoice.update({
      where: { id: pastInvoice.id },
      data: { notes: "Original institutional remark that must be preserved." },
    });

    const voidRes = await fetch(`${baseUrl}/invoices/${pastInvoice.id}/void`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reason: "Duplicate billing entry error" }),
    });
    assert(voidRes.status === 200, "Void invoice returns 200 OK");
    const voidData = (await voidRes.json()).data;
    assert(voidData.status === "VOID", "Invoice status updated to VOID");
    assert(voidData.displayStatus === "VOID", "Invoice displayStatus is VOID");
    assert(voidData.isOverdue === false, "VOID invoice is never overdue (isOverdue = false)");
    assert(voidData.notes === "Original institutional remark that must be preserved.", "Original notes preserved without being overwritten by void reason");
    assert(voidData.voidMetadata?.reason === "Duplicate billing entry error", "Void reason returned in voidMetadata from audit trail");

    // Cannot void already-voided invoice (409 Conflict)
    const repeatVoidRes = await fetch(`${baseUrl}/invoices/${pastInvoice.id}/void`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reason: "Attempting to void again" }),
    });
    assert(repeatVoidRes.status === 409, "Voiding an already voided invoice returns 409 Conflict");

    // 19. Void safety: Completed payment allocation prevents void
    const payment = await prisma.payment.create({
      data: {
        madrasaId: madrasaA.id,
        studentId: studentA1.id,
        paymentNo: "PAY-TEST-001",
        amount: 500.0,
        paymentMethod: "CASH",
        status: "COMPLETED",
      },
    });
    await prisma.paymentAllocation.create({
      data: {
        madrasaId: madrasaA.id,
        paymentId: payment.id,
        invoiceId: todayInvoice.id,
        amount: 500.0,
      },
    });

    const voidAllocatedRes = await fetch(`${baseUrl}/invoices/${todayInvoice.id}/void`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reason: "Void allocated test" }),
    });
    assert(voidAllocatedRes.status === 400, "Voiding invoice with completed payment allocation rejected with 400 Bad Request");

    // Clean payment fixtures
    await prisma.paymentAllocation.deleteMany({ where: { madrasaId: madrasaA.id } });
    await prisma.payment.deleteMany({ where: { madrasaId: madrasaA.id } });

    // ==========================================
    // GROUP 7: INVOICE DIRECTORY & SEARCH
    // ==========================================
    console.log("\n[GROUP 7] Invoice Directory & Search");

    // 20. Search by Student Name
    const searchRes = await fetch(`${baseUrl}/invoices?search=Mid-Month`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const searchData = (await searchRes.json()).data;
    assert(searchData.items.length === 1, "Search by student name returns matching student");
    assert(searchData.items[0].student.fullName.includes("Mid-Month"), "Search result matches student name");

    // 21. Filter by Status = OVERDUE
    // Currently todayInvoice is PENDING (not overdue), pastInvoice is VOID.
    // Create one fresh overdue invoice:
    await prisma.invoice.create({
      data: {
        madrasaId: madrasaA.id,
        studentId: studentA1.id,
        invoiceNo: "INV-A-OVERDUE-TEST",
        billingYear: 2026,
        billingMonth: 5,
        issueDate: new Date(),
        dueDate: pastDueDate,
        subtotal: 1000.0,
        discountAmount: 0.0,
        totalAmount: 1000.0,
        paidAmount: 0.0,
        balanceAmount: 1000.0,
        status: "PENDING",
      },
    });

    const filterOverdueRes = await fetch(`${baseUrl}/invoices?status=OVERDUE`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const filterOverdueData = (await filterOverdueRes.json()).data;
    assert(filterOverdueData.items.every((i) => i.displayStatus === "OVERDUE"), "All items in status=OVERDUE query have displayStatus = OVERDUE");

    // Summary cards: VOID excluded from expectedAmount
    const summaryCheck = filterOverdueData.summary;
    assert(typeof summaryCheck.expectedAmount === "string", "Summary expectedAmount is formatted string");
    assert(summaryCheck.voidCount >= 1, "Summary voidCount reflects voided invoices");

    // ==========================================
    // GROUP 8: TENANT ISOLATION & IDOR DEFENSE
    // ==========================================
    console.log("\n[GROUP 8] Tenant Isolation & IDOR Defense");

    // 22. Generate invoice in Madrasa B for Student B1
    const genBRes = await fetch(`http://127.0.0.1:${testServer.address().port}/api/madrasa-admin/invoices/generate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenB}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        billingYear: 2026,
        billingMonth: 9,
        dueDate: "2026-09-30",
        studentIds: [studentB1.id],
      }),
    });
    assert(genBRes.status === 201, "Madrasa B generates invoice for Student B1 (201 Created)");
    const invBId = (await genBRes.json()).data.items[0].invoiceId;

    // Admin A attempts to view Madrasa B invoice -> 404
    const getForeignRes = await fetch(`${baseUrl}/invoices/${invBId}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(getForeignRes.status === 404, "Admin A cannot view Madrasa B invoice (404 Not Found)");

    // Admin A attempts to void Madrasa B invoice -> 404
    const voidForeignRes = await fetch(`${baseUrl}/invoices/${invBId}/void`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reason: "Malicious void attempt" }),
    });
    assert(voidForeignRes.status === 404, "Admin A cannot void Madrasa B invoice (404 Not Found)");

    // Admin A attempts to generate invoice for Student B1 -> 404
    const genForeignStudentRes = await fetch(`${baseUrl}/invoices/generate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        billingYear: 2026,
        billingMonth: 10,
        dueDate: "2026-10-25",
        studentIds: [studentB1.id],
      }),
    });
    assert(genForeignStudentRes.status === 404, "Admin A cannot generate invoice for Madrasa B student (404 Not Found)");

    // Admin A attempts to view Student B1 invoice history -> 404
    const histForeignRes = await fetch(`${baseUrl}/students/${studentB1.id}/invoices`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(histForeignRes.status === 404, "Admin A cannot fetch Madrasa B student invoice history (404 Not Found)");

    // ==========================================
    // GROUP 9: STUDENT INVOICE HISTORY
    // ==========================================
    console.log("\n[GROUP 9] Student Invoice History");

    const histRes = await fetch(`${baseUrl}/students/${studentA1.id}/invoices`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(histRes.status === 200, "Student invoice history returns 200 OK");
    const histData = (await histRes.json()).data;
    assert(histData.items.length >= 1, "Student A1 invoice history contains generated invoices");
    assert(histData.pagination.total >= 1, "Pagination metadata accurate");

    // ==========================================
    // GROUP 10: COLLISION DETECTION & TIMEZONE UNIT TESTS
    // ==========================================
    console.log("\n[GROUP 10] Collision Detection & Timezone Unit Tests");

    const p2002InvoiceNoErr = { code: "P2002", meta: { target: ["madrasaId", "invoiceNo"] } };
    const p2002MonthlyErr = { code: "P2002", meta: { target: ["madrasaId", "studentId", "billingYear", "billingMonth"] } };
    const genericErr = { code: "P2003", meta: { target: ["studentId"] } };

    assert(isInvoiceNoCollision(p2002InvoiceNoErr) === true, "isInvoiceNoCollision detects invoiceNo target array");
    assert(isInvoiceNoCollision(p2002MonthlyErr) === false, "isInvoiceNoCollision returns false for monthly composite collision");
    assert(isMonthlyDuplicateCollision(p2002MonthlyErr) === true, "isMonthlyDuplicateCollision detects monthly composite collision");
    assert(isMonthlyDuplicateCollision(p2002InvoiceNoErr) === false, "isMonthlyDuplicateCollision returns false for invoiceNo collision");
    assert(isInvoiceNoCollision(genericErr) === false, "isInvoiceNoCollision returns false for non-P2002 error");

    // Timezone boundaries: America/New_York (DST boundary in March)
    const nyBoundaries = calculateBillingBoundaries(2026, 3, "America/New_York");
    assert(nyBoundaries.periodStart.toISOString() === "2026-03-01T05:00:00.000Z", "America/New_York March 1 periodStart matches UTC offset (05:00:00Z)");
    assert(nyBoundaries.periodEndExclusive.toISOString() === "2026-04-01T04:00:00.000Z", "America/New_York April 1 periodEndExclusive handles DST transition (04:00:00Z)");

  } catch (err) {
    console.error("Test execution threw exception:", err);
    testFailedCount++;
  } finally {
    await teardown();
  }

  console.log(`\n=============================================`);
  console.log(`Phase 9 Test Results: ${testPassedCount} Passed, ${testFailedCount} Failed`);
  console.log(`=============================================\n`);

  if (testFailedCount > 0) {
    process.exit(1);
  }
}

runTests();
