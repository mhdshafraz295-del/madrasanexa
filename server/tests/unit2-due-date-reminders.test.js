import './setup-test-env.js';
import { prisma } from '../src/lib/prisma.js';
import { hashPassword } from '../src/utils/password.js';
import {
  processDueDateReminders,
  processNotificationJobs,
} from '../src/jobs/notification-worker.job.js';
import { enableTestMode, clearTestEmails } from '../src/services/email.service.js';
import { clearSentSmsMessages } from '../src/services/sms.service.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  ✗ [FAIL] ${message}`);
    failed++;
  }
}

const TEST_PREFIX = `due_rem_test_${Date.now()}`;

let madrasaA = null;
let madrasaB = null;
let adminA = null;
let plan = null;
let studentWithContact = null;
let studentNoContact = null;
let invoiceDueOn10th = null;
let invoiceNoDueDate = null;
let invoicePaid = null;

async function setup() {
  console.log('\n--- Setting up Unit 2 Due Date Reminders Test Fixtures ---');
  enableTestMode(true);
  clearTestEmails();
  clearSentSmsMessages();

  // Create Subscription Plan
  plan = await prisma.plan.upsert({
    where: { code: 'PRO_DUE_TEST' },
    create: {
      name: 'Pro Due Test Plan',
      code: 'PRO_DUE_TEST',
      price: 1500,
      durationMonths: 12,
      isActive: true,
    },
    update: {},
  });

  const pwd = await hashPassword('Password123!');
  const now = new Date();

  // 1. Madrasa A (reminders enabled, Asia/Colombo)
  madrasaA = await prisma.madrasa.create({
    data: {
      name: `${TEST_PREFIX} Madrasa A`,
      code: `MDA_${Date.now().toString().slice(-6)}_${Math.random().toString(36).slice(2, 6)}`,
      slug: `mda-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      status: 'ACTIVE',
      email: `${TEST_PREFIX}_a@example.com`,
    },
  });

  adminA = await prisma.user.create({
    data: {
      madrasaId: madrasaA.id,
      name: 'Admin A',
      email: `${TEST_PREFIX}_adminA@example.com`,
      passwordHash: pwd,
      role: 'MADRASA_ADMIN',
      isActive: true,
      mustChangePassword: false,
    },
  });

  await prisma.subscription.create({
    data: {
      madrasaId: madrasaA.id,
      planId: plan.id,
      status: 'ACTIVE',
      startsAt: new Date(now.getTime() - 60 * 86400000),
      endsAt: new Date(now.getTime() + 300 * 86400000),
      priceAtPurchase: 1500,
      durationMonthsAtPurchase: 12,
    },
  });

  await prisma.madrasaSetting.create({
    data: {
      madrasaId: madrasaA.id,
      autoFeeReminderSmsEnabled: true,
      autoFeeReminderEmailEnabled: true,
      feeReminderSendTime: '09:00',
      timezone: 'Asia/Colombo',
    },
  });

  // 2. Madrasa B (reminders disabled)
  madrasaB = await prisma.madrasa.create({
    data: {
      name: `${TEST_PREFIX} Madrasa B`,
      code: `MDB_${Date.now().toString().slice(-6)}_${Math.random().toString(36).slice(2, 6)}`,
      slug: `mdb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      status: 'ACTIVE',
      email: `${TEST_PREFIX}_b@example.com`,
    },
  });

  await prisma.subscription.create({
    data: {
      madrasaId: madrasaB.id,
      planId: plan.id,
      status: 'ACTIVE',
      startsAt: new Date(now.getTime() - 60 * 86400000),
      endsAt: new Date(now.getTime() + 300 * 86400000),
      priceAtPurchase: 1500,
      durationMonthsAtPurchase: 12,
    },
  });

  await prisma.madrasaSetting.create({
    data: {
      madrasaId: madrasaB.id,
      autoFeeReminderSmsEnabled: false,
      autoFeeReminderEmailEnabled: false,
      feeReminderSendTime: '09:00',
      timezone: 'Asia/Colombo',
    },
  });

  // Students in Madrasa A
  studentWithContact = await prisma.student.create({
    data: {
      madrasaId: madrasaA.id,
      admissionNo: `ADMA_${Date.now().toString().slice(-5)}_1`,
      admissionDate: new Date('2026-01-01'),
      fullName: 'Student With Contact',
      guardianName: 'Guardian One',
      guardianPhone: '+94771122334',
      guardianEmail: 'guardian1@example.com',
      status: 'ACTIVE',
    },
  });

  studentNoContact = await prisma.student.create({
    data: {
      madrasaId: madrasaA.id,
      admissionNo: `ADMA_${Date.now().toString().slice(-5)}_2`,
      admissionDate: new Date('2026-01-01'),
      fullName: 'Student No Contact',
      guardianName: 'Guardian Two',
      guardianPhone: null,
      guardianEmail: null,
      status: 'ACTIVE',
    },
  });

  // Invoices:
  // Target Due Date: 2026-11-10
  // 3 days prior: 2026-11-07
  invoiceDueOn10th = await prisma.invoice.create({
    data: {
      madrasaId: madrasaA.id,
      studentId: studentWithContact.id,
      invoiceNo: `INV_DUE_${Date.now().toString().slice(-6)}`,
      issueDate: new Date('2026-11-01T00:00:00.000Z'),
      dueDate: new Date('2026-11-10T00:00:00.000Z'),
      billingYear: 2026,
      billingMonth: 11,
      subtotal: 3500,
      totalAmount: 3500,
      paidAmount: 0,
      balanceAmount: 3500,
      status: 'PENDING',
    },
  });

  // Invoice without due date
  invoiceNoDueDate = await prisma.invoice.create({
    data: {
      madrasaId: madrasaA.id,
      studentId: studentWithContact.id,
      invoiceNo: `INV_NODUE_${Date.now().toString().slice(-6)}`,
      issueDate: new Date('2026-10-01T00:00:00.000Z'),
      dueDate: null,
      billingYear: 2026,
      billingMonth: 10,
      subtotal: 2000,
      totalAmount: 2000,
      paidAmount: 0,
      balanceAmount: 2000,
      status: 'PENDING',
    },
  });

  // Fully paid invoice
  invoicePaid = await prisma.invoice.create({
    data: {
      madrasaId: madrasaA.id,
      studentId: studentWithContact.id,
      invoiceNo: `INV_PAID_${Date.now().toString().slice(-6)}`,
      issueDate: new Date('2026-09-01T00:00:00.000Z'),
      dueDate: new Date('2026-11-10T00:00:00.000Z'),
      billingYear: 2026,
      billingMonth: 9,
      subtotal: 1000,
      totalAmount: 1000,
      paidAmount: 1000,
      balanceAmount: 0,
      status: 'PAID',
    },
  });
}

async function runTests() {
  console.log('\n=============================================');
  console.log('UNIT 2: DUE-DATE FEE REMINDERS TEST SUITE');
  console.log('=============================================');

  // TEST 1: Date before 3-day boundary (e.g. 4 days before dueDate: 2026-11-06)
  console.log('\n[TEST 1] Date before 3-day window generates 0 reminder jobs');
  const dayBeforeRes = await processDueDateReminders(new Date('2026-11-06T09:30:00.000Z'));
  assert(dayBeforeRes.createdCount === 0, 'No jobs created 4 days before due date');

  // TEST 2: Exactly 3 days before dueDate (2026-11-07 at 09:30:00 UTC = 15:00:00 Asia/Colombo)
  console.log('\n[TEST 2] Exactly 3 days before dueDate triggers reminder jobs');
  const triggerDate = new Date('2026-11-07T09:30:00.000Z');
  const triggerRes = await processDueDateReminders(triggerDate);
  assert(triggerRes.createdCount === 2, 'Created exactly 2 jobs (1 SMS + 1 EMAIL) for active student with contact');

  // Verify created jobs in DB
  const jobs = await prisma.notificationJob.findMany({
    where: { relatedEntityId: invoiceDueOn10th.id },
  });
  assert(jobs.length === 2, '2 notification jobs recorded for eligible invoice');

  const smsJob = jobs.find((j) => j.channel === 'SMS');
  const emailJob = jobs.find((j) => j.channel === 'EMAIL');
  assert(Boolean(smsJob && smsJob.status === 'PENDING'), 'SMS job is PENDING');
  assert(Boolean(emailJob && emailJob.status === 'PENDING'), 'EMAIL job is PENDING');
  assert(smsJob?.dedupeKey?.startsWith('FEE_DUE_REMINDER:'), 'SMS dedupeKey starts with FEE_DUE_REMINDER:');
  assert(emailJob?.dedupeKey?.startsWith('FEE_DUE_REMINDER:'), 'EMAIL dedupeKey starts with FEE_DUE_REMINDER:');
  assert(smsJob?.payloadJson?.reminderType === 'DUE_DATE_3_DAYS_PRIOR', 'Payload marks reminderType = DUE_DATE_3_DAYS_PRIOR');

  // TEST 3: Idempotency - running again on same day creates 0 duplicate jobs
  console.log('\n[TEST 3] Idempotency: repeated run on same date produces 0 duplicate jobs');
  const repeatRes = await processDueDateReminders(triggerDate);
  assert(repeatRes.createdCount === 0, 'Second run creates 0 duplicate jobs');

  // TEST 4: Non-due-date invoice & paid invoice exclusion
  console.log('\n[TEST 4] Null dueDate and settled invoices are excluded');
  const noDueDateJob = await prisma.notificationJob.findFirst({
    where: { relatedEntityId: invoiceNoDueDate.id },
  });
  assert(noDueDateJob === null, 'Invoices with null dueDate generate no reminder jobs');

  const paidJob = await prisma.notificationJob.findFirst({
    where: { relatedEntityId: invoicePaid.id },
  });
  assert(paidJob === null, 'Paid invoices generate no reminder jobs');

  // TEST 5: Student without contacts creates SKIPPED_NO_RECIPIENT jobs
  console.log('\n[TEST 5] Student with missing contact creates SKIPPED_NO_RECIPIENT');
  const invNoContact = await prisma.invoice.create({
    data: {
      madrasaId: madrasaA.id,
      studentId: studentNoContact.id,
      invoiceNo: `INV_NOCON_${Date.now().toString().slice(-6)}`,
      issueDate: new Date('2026-11-01T00:00:00.000Z'),
      dueDate: new Date('2026-11-10T00:00:00.000Z'),
      billingYear: 2026,
      billingMonth: 11,
      subtotal: 2500,
      totalAmount: 2500,
      paidAmount: 0,
      balanceAmount: 2500,
      status: 'PENDING',
    },
  });

  const skipRes = await processDueDateReminders(triggerDate);
  assert(skipRes.skippedCount === 2, 'Skipped count incremented for missing SMS & Email contacts');

  const skippedJobs = await prisma.notificationJob.findMany({
    where: { relatedEntityId: invNoContact.id },
  });
  assert(
    skippedJobs.length === 2 && skippedJobs.every((j) => j.status === 'SKIPPED_NO_RECIPIENT'),
    'Both jobs marked SKIPPED_NO_RECIPIENT'
  );
  assert(
    skippedJobs.every((j) => j.dedupeKey.endsWith(':NO_RECIPIENT')),
    'Dedupe keys end with :NO_RECIPIENT'
  );

  // TEST 6: Pre-delivery revalidation cancels job if paid before worker dispatch
  console.log('\n[TEST 6] Pre-delivery revalidation cancels job if settled before dispatch');
  // Update invoiceDueOn10th to PAID
  await prisma.invoice.update({
    where: { id: invoiceDueOn10th.id },
    data: {
      status: 'PAID',
      paidAmount: 3500,
      balanceAmount: 0,
    },
  });

  // Run worker dispatch
  await processNotificationJobs({ limit: 10 });

  const revalidatedJobs = await prisma.notificationJob.findMany({
    where: { relatedEntityId: invoiceDueOn10th.id },
  });
  assert(
    revalidatedJobs.every((j) => j.status === 'CANCELLED' && j.lastError === 'FEE_ALREADY_SETTLED'),
    'Pre-delivery revalidation cancelled settled invoice reminders with FEE_ALREADY_SETTLED'
  );

  // TEST 7: Tenant isolation - Madrasa B has reminders disabled
  console.log('\n[TEST 7] Disabled reminder channels strictly suppressed');
  const studentB = await prisma.student.create({
    data: {
      madrasaId: madrasaB.id,
      admissionNo: `ADMB_${Date.now().toString().slice(-5)}`,
      admissionDate: new Date('2026-01-01'),
      fullName: 'Student Madrasa B',
      guardianName: 'Guardian B',
      guardianPhone: '+94779998800',
      guardianEmail: 'b_guard@example.com',
      status: 'ACTIVE',
    },
  });

  const invB = await prisma.invoice.create({
    data: {
      madrasaId: madrasaB.id,
      studentId: studentB.id,
      invoiceNo: `INV_B_${Date.now().toString().slice(-6)}`,
      issueDate: new Date('2026-11-01T00:00:00.000Z'),
      dueDate: new Date('2026-11-10T00:00:00.000Z'),
      billingYear: 2026,
      billingMonth: 11,
      subtotal: 5000,
      totalAmount: 5000,
      paidAmount: 0,
      balanceAmount: 5000,
      status: 'PENDING',
    },
  });

  await processDueDateReminders(triggerDate);
  const jobsB = await prisma.notificationJob.findMany({
    where: { madrasaId: madrasaB.id },
  });
  assert(jobsB.length === 0, 'Tenant with disabled reminder settings creates exactly 0 jobs');
}

async function teardown() {
  console.log('\n--- Tearing Down Test Fixtures ---');
  try {
    if (madrasaA) {
      await prisma.notificationJob.deleteMany({ where: { madrasaId: madrasaA.id } });
      await prisma.invoiceItem.deleteMany({ where: { madrasaId: madrasaA.id } });
      await prisma.invoice.deleteMany({ where: { madrasaId: madrasaA.id } });
      await prisma.student.deleteMany({ where: { madrasaId: madrasaA.id } });
      await prisma.user.deleteMany({ where: { madrasaId: madrasaA.id } });
      await prisma.subscription.deleteMany({ where: { madrasaId: madrasaA.id } });
      await prisma.madrasaSetting.deleteMany({ where: { madrasaId: madrasaA.id } });
      await prisma.madrasa.delete({ where: { id: madrasaA.id } });
    }
    if (madrasaB) {
      await prisma.notificationJob.deleteMany({ where: { madrasaId: madrasaB.id } });
      await prisma.invoiceItem.deleteMany({ where: { madrasaId: madrasaB.id } });
      await prisma.invoice.deleteMany({ where: { madrasaId: madrasaB.id } });
      await prisma.student.deleteMany({ where: { madrasaId: madrasaB.id } });
      await prisma.subscription.deleteMany({ where: { madrasaId: madrasaB.id } });
      await prisma.madrasaSetting.deleteMany({ where: { madrasaId: madrasaB.id } });
      await prisma.madrasa.delete({ where: { id: madrasaB.id } });
    }
    if (plan) {
      await prisma.plan.delete({ where: { id: plan.id } });
    }
  } catch (err) {
    console.warn('[Teardown Warning]:', err.message);
  }
}

async function main() {
  try {
    await setup();
    await runTests();
  } catch (err) {
    console.error('Fatal error during test run:', err);
    failed++;
  } finally {
    await teardown();
    console.log('\n=============================================');
    console.log(`Unit 2 Results: ${passed} Passed, ${failed} Failed`);
    console.log('=============================================\n');
    process.exit(failed > 0 ? 1 : 0);
  }
}

main();
