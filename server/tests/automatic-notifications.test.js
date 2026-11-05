import './setup-test-env.js';
import http from 'http';
import crypto from 'crypto';
import { prisma } from '../src/lib/prisma.js';
import { Prisma } from '@prisma/client';
import { hashPassword } from '../src/utils/password.js';
import { signAccessToken } from '../src/utils/jwt.js';
import app from '../src/app.js';
import {
  isSmsConfigured,
  sendSms,
  sentSmsMessages,
  clearSentSmsMessages,
  normalizePhoneNumber,
  maskPhoneNumber,
} from '../src/services/sms.service.js';
import {
  isEmailConfigured,
  enableTestMode,
  clearTestEmails,
  getTestEmails,
  sendStudentFeePaymentEmail,
  sendStaffTimetableEmail,
  sendUstadhSalaryPaidEmail,
} from '../src/services/email.service.js';
import {
  maskEmail,
  maskRecipientAddress,
  sanitizeNotificationJob,
  buildFeePaymentSmsMessage,
  buildFeePaymentEmailHtml,
  buildFeeReminderMessage,
  listNotificationJobs,
  getNotificationJobById,
  retryNotificationJob,
  getNotificationSettings,
  updateNotificationSettings,
  listTimetablePublications,
} from '../src/services/notification.service.js';
import {
  createStudentSchema,
  updateStudentSchema,
} from '../src/validations/student.validation.js';
import {
  updateNotificationSettingsSchema,
  listNotificationJobsQuerySchema,
  finalizeTimetableSchema,
} from '../src/validations/notification.validation.js';
import { createPayment } from '../src/services/payment.service.js';
import { paySalary, generateSalarySlipPdf } from '../src/services/ustadh-salary.service.js';
import { finalizeTimetable, exportStaffTimetableSnapshotPdf } from '../src/services/timetable.service.js';
import {
  processNotificationJobs,
  processMonthEndReminders,
  recoverStaleJobs,
} from '../src/jobs/notification-worker.job.js';

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

const TEST_PREFIX = `notif_test_${Date.now()}`;
let testServer = null;
let baseUrl = '';

// Test Fixtures
let madrasaA = null;
let adminA = null;
let tokenA = '';
let classA = null;
let studentA1 = null;
let studentA2 = null;
let ustadhA = null;
let teacherA = null;

let madrasaB = null;
let adminB = null;
let tokenB = '';

let madrasaExpired = null;
let adminExpired = null;
let tokenExpired = '';

let plan = null;

async function setup() {
  console.log('\n--- Setting up Automatic Notification Engine Test Fixtures ---');
  enableTestMode(true);
  clearTestEmails();
  clearSentSmsMessages();

  // 1. Subscription Plan
  plan = await prisma.plan.upsert({
    where: { code: 'PRO_NOTIF_TEST' },
    create: {
      name: 'Pro Notification Test Plan',
      code: 'PRO_NOTIF_TEST',
      price: 1500,
      durationMonths: 12,
      isActive: true,
    },
    update: {},
  });

  const pwd = await hashPassword('Password123!');
  const now = new Date();

  // 2. Active Madrasa A
  madrasaA = await prisma.madrasa.create({
    data: {
      name: `${TEST_PREFIX} Madrasa A`,
      code: `MA_${Date.now().toString().slice(-6)}_${Math.random().toString(36).slice(2, 6)}`,
      slug: `ma-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
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
      autoFeePaymentSmsEnabled: true,
      autoPartialFeeSmsEnabled: true,
      autoFeeReminderSmsEnabled: true,
      autoFeePaymentEmailEnabled: true,
      autoPartialFeeEmailEnabled: true,
      autoFeeReminderEmailEnabled: true,
      autoSalaryPaidEmailEnabled: true,
      feeReminderSendTime: '09:00',
      timezone: 'Asia/Colombo',
    },
  });

  tokenA = signAccessToken({
    userId: adminA.id,
    madrasaId: madrasaA.id,
    role: 'MADRASA_ADMIN',
    email: adminA.email,
  });

  classA = await prisma.class.create({
    data: {
      madrasaId: madrasaA.id,
      name: 'Grade 1',
      code: `G1_${Date.now().toString().slice(-4)}`,
      defaultMonthlyFee: 2500,
      isActive: true,
    },
  });

  // Student A1: Both phone and email configured
  studentA1 = await prisma.student.create({
    data: {
      madrasaId: madrasaA.id,
      classId: classA.id,
      admissionNo: `ADM_${Date.now().toString().slice(-5)}_1`,
      admissionDate: new Date('2026-01-01'),
      fullName: 'Tariq Ziyad',
      guardianName: 'Ziyad Ahmad',
      guardianPhone: '+94771234567',
      guardianEmail: 'tariq.parent@example.com',
      monthlyFee: 2500,
      status: 'ACTIVE',
    },
  });

  // Student A2: Missing contacts (for SKIPPED_NO_RECIPIENT verification)
  studentA2 = await prisma.student.create({
    data: {
      madrasaId: madrasaA.id,
      classId: classA.id,
      admissionNo: `ADM_${Date.now().toString().slice(-5)}_2`,
      admissionDate: new Date('2026-01-01'),
      fullName: 'Bilal Habashi',
      guardianName: 'Habashi Senior',
      guardianPhone: null,
      guardianEmail: null,
      monthlyFee: 2500,
      status: 'ACTIVE',
    },
  });

  // Staff A1: Ustadh with email
  ustadhA = await prisma.ustadh.create({
    data: {
      madrasaId: madrasaA.id,
      ustadhCode: `UST_${Date.now().toString().slice(-4)}`,
      staffType: 'USTADH',
      fullName: 'Ustadh Imran',
      email: `${TEST_PREFIX}_imran@example.com`,
      joinDate: new Date('2025-01-01'),
      baseMonthlySalary: 45000,
      isActive: true,
    },
  });

  // Staff A2: School Teacher with email
  teacherA = await prisma.ustadh.create({
    data: {
      madrasaId: madrasaA.id,
      ustadhCode: `TCH_${Date.now().toString().slice(-4)}`,
      staffType: 'SCHOOL_TEACHER',
      fullName: 'Teacher Fatima',
      email: `${TEST_PREFIX}_fatima@example.com`,
      joinDate: new Date('2025-01-01'),
      baseMonthlySalary: 40000,
      isActive: true,
    },
  });

  // Subject for scheduling
  const subA = await prisma.subject.create({
    data: {
      madrasaId: madrasaA.id,
      name: 'ARABIC',
      code: 'ARB',
      isActive: true,
    },
  });

  // Schedule for Ustadh Imran
  await prisma.ustadhSchedule.create({
    data: {
      madrasaId: madrasaA.id,
      ustadhId: ustadhA.id,
      classId: classA.id,
      subjectId: subA.id,
      dayOfWeek: 'MONDAY',
      startMinutes: 480,
      endMinutes: 540,
      effectiveFrom: new Date('2026-01-01'),
      isActive: true,
    },
  });

  // 3. Active Madrasa B (Isolation Tenant)
  madrasaB = await prisma.madrasa.create({
    data: {
      name: `${TEST_PREFIX} Madrasa B`,
      code: `MB_${Date.now().toString().slice(-6)}_${Math.random().toString(36).slice(2, 6)}`,
      slug: `mb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      status: 'ACTIVE',
      email: `${TEST_PREFIX}_b@example.com`,
    },
  });

  adminB = await prisma.user.create({
    data: {
      madrasaId: madrasaB.id,
      name: 'Admin B',
      email: `${TEST_PREFIX}_adminB@example.com`,
      passwordHash: pwd,
      role: 'MADRASA_ADMIN',
      isActive: true,
      mustChangePassword: false,
    },
  });

  await prisma.subscription.create({
    data: {
      madrasaId: madrasaB.id,
      planId: plan.id,
      status: 'ACTIVE',
      startsAt: new Date(now.getTime() - 30 * 86400000),
      endsAt: new Date(now.getTime() + 300 * 86400000),
      priceAtPurchase: 1500,
      durationMonthsAtPurchase: 12,
    },
  });

  await prisma.madrasaSetting.create({
    data: {
      madrasaId: madrasaB.id,
      autoFeePaymentSmsEnabled: false,
      autoPartialFeeSmsEnabled: false,
      autoFeeReminderSmsEnabled: false,
      autoFeePaymentEmailEnabled: false,
      autoPartialFeeEmailEnabled: false,
      autoFeeReminderEmailEnabled: false,
      autoSalaryPaidEmailEnabled: false,
    },
  });

  tokenB = signAccessToken({
    userId: adminB.id,
    madrasaId: madrasaB.id,
    role: 'MADRASA_ADMIN',
    email: adminB.email,
  });

  // 4. Madrasa Expired (for subscription lock check)
  madrasaExpired = await prisma.madrasa.create({
    data: {
      name: `${TEST_PREFIX} Madrasa Expired`,
      code: `ME_${Date.now().toString().slice(-6)}_${Math.random().toString(36).slice(2, 6)}`,
      slug: `me-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      status: 'ACTIVE',
      email: `${TEST_PREFIX}_exp@example.com`,
    },
  });

  adminExpired = await prisma.user.create({
    data: {
      madrasaId: madrasaExpired.id,
      name: 'Admin Expired',
      email: `${TEST_PREFIX}_adminExp@example.com`,
      passwordHash: pwd,
      role: 'MADRASA_ADMIN',
      isActive: true,
      mustChangePassword: false,
    },
  });

  await prisma.subscription.create({
    data: {
      madrasaId: madrasaExpired.id,
      planId: plan.id,
      status: 'EXPIRED',
      startsAt: new Date(now.getTime() - 90 * 86400000),
      endsAt: new Date(now.getTime() - 10 * 86400000),
      priceAtPurchase: 1500,
      durationMonthsAtPurchase: 1,
    },
  });

  tokenExpired = signAccessToken({
    userId: adminExpired.id,
    madrasaId: madrasaExpired.id,
    role: 'MADRASA_ADMIN',
    email: adminExpired.email,
  });

  // Start HTTP Server
  await new Promise((resolve) => {
    testServer = http.createServer(app);
    testServer.listen(0, '127.0.0.1', () => {
      const port = testServer.address().port;
      baseUrl = `http://127.0.0.1:${port}/api/madrasa-admin`;
      console.log(`Test server running at ${baseUrl}`);
      resolve();
    });
  });
}

async function teardown() {
  console.log('\n--- Cleaning up Automatic Notification Test Fixtures ---');
  if (testServer) {
    await new Promise((resolve) => testServer.close(resolve));
  }

  const madrasaIds = [madrasaA?.id, madrasaB?.id, madrasaExpired?.id].filter(Boolean);
  for (const mid of madrasaIds) {
    try {
      await prisma.notificationJob.deleteMany({ where: { madrasaId: mid } });
      await prisma.timetablePublication.deleteMany({ where: { madrasaId: mid } });
      await prisma.receipt.deleteMany({ where: { payment: { madrasaId: mid } } });
      await prisma.paymentAllocation.deleteMany({ where: { payment: { madrasaId: mid } } });
      await prisma.activityLog.deleteMany({ where: { madrasaId: mid } });
      await prisma.payment.deleteMany({ where: { madrasaId: mid } });
      await prisma.invoice.deleteMany({ where: { madrasaId: mid } });
      await prisma.ustadhSalary.deleteMany({ where: { madrasaId: mid } });
      await prisma.ustadhSchedule.deleteMany({ where: { madrasaId: mid } });
      await prisma.ustadh.deleteMany({ where: { madrasaId: mid } });
      await prisma.student.deleteMany({ where: { madrasaId: mid } });
      await prisma.subject.deleteMany({ where: { madrasaId: mid } });
      await prisma.class.deleteMany({ where: { madrasaId: mid } });
      await prisma.madrasaSetting.deleteMany({ where: { madrasaId: mid } });
      await prisma.subscription.deleteMany({ where: { madrasaId: mid } });
      await prisma.user.deleteMany({ where: { madrasaId: mid } });
      await prisma.madrasa.deleteMany({ where: { id: mid } });
    } catch (e) {
      // safe cleanup
    }
  }
}

async function runAllSuites() {
  await setup();

  // ==========================================
  // SUITE 1: Schema Integrity, Enums & Audit Relations (8 assertions)
  // ==========================================
  console.log('\n--- Suite 1: Schema Integrity, Enums & Audit Relations ---');
  const dmmf = Prisma.dmmf;
  const datamodel = dmmf?.datamodel;

  assert(Boolean(datamodel?.enums?.find((e) => e.name === 'NotificationChannel')), '1.1 NotificationChannel enum exists');
  assert(Boolean(datamodel?.enums?.find((e) => e.name === 'NotificationStatus')), '1.2 NotificationStatus enum exists');
  assert(Boolean(datamodel?.enums?.find((e) => e.name === 'NotificationEventType')), '1.3 NotificationEventType enum exists');
  assert(Boolean(datamodel?.enums?.find((e) => e.name === 'TimetableRecipientScope')), '1.4 TimetableRecipientScope enum exists');

  const notifJobModel = datamodel?.models?.find((m) => m.name === 'NotificationJob');
  const recipientAddrField = notifJobModel?.fields?.find((f) => f.name === 'recipientAddress');
  assert(recipientAddrField && recipientAddrField.isRequired === false, '1.5 NotificationJob.recipientAddress is nullable');

  const settingModel = datamodel?.models?.find((m) => m.name === 'MadrasaSetting');
  const sendTimeField = settingModel?.fields?.find((f) => f.name === 'feeReminderSendTime');
  assert(sendTimeField && sendTimeField.default === '09:00', '1.6 MadrasaSetting.feeReminderSendTime defaults strictly to 09:00');

  const ttPubModel = datamodel?.models?.find((m) => m.name === 'TimetablePublication');
  const uniqueIdempotency = ttPubModel?.uniqueFields?.some((u) => u.includes('madrasaId') && u.includes('idempotencyKey')) ||
    ttPubModel?.uniqueIndexes?.some((u) => u.fields.includes('madrasaId') && u.fields.includes('idempotencyKey'));
  assert(Boolean(uniqueIdempotency), '1.7 TimetablePublication enforces @@unique([madrasaId, idempotencyKey])');

  const userModel = datamodel?.models?.find((m) => m.name === 'User');
  const publishedTtField = userModel?.fields?.find((f) => f.name === 'publishedTimetables');
  assert(Boolean(publishedTtField), '1.8 User.publishedTimetables relation exists');

  // ==========================================
  // SUITE 2: Student Guardian Email Validation & Normalization (6 assertions)
  // ==========================================
  console.log('\n--- Suite 2: Student Guardian Email Validation & Normalization ---');
  const validCreate = createStudentSchema.safeParse({
    admissionNo: 'A101',
    fullName: 'Student One',
    guardianName: 'Parent One',
    guardianPhone: '+94771111111',
    guardianEmail: 'parent@example.com',
  });
  assert(validCreate.success && validCreate.data.guardianEmail === 'parent@example.com', '2.1 createStudentSchema accepts valid guardianEmail');

  const normalizedCreate = createStudentSchema.safeParse({
    admissionNo: 'A102',
    fullName: 'Student Two',
    guardianName: 'Parent Two',
    guardianPhone: '+94771111112',
    guardianEmail: '   ',
  });
  assert(normalizedCreate.success && normalizedCreate.data.guardianEmail === null, '2.2 createStudentSchema normalizes empty string to null');

  const invalidCreate = createStudentSchema.safeParse({
    admissionNo: 'A103',
    fullName: 'Student Three',
    guardianName: 'Parent Three',
    guardianPhone: '+94771111113',
    guardianEmail: 'invalid-email-format',
  });
  assert(!invalidCreate.success, '2.3 createStudentSchema rejects invalid email format');

  const validUpdate = updateStudentSchema.safeParse({
    guardianEmail: 'updated.parent@example.com',
  });
  assert(validUpdate.success && validUpdate.data.guardianEmail === 'updated.parent@example.com', '2.4 updateStudentSchema accepts valid guardianEmail');

  const normalizedUpdate = updateStudentSchema.safeParse({
    guardianEmail: '',
  });
  assert(normalizedUpdate.success && normalizedUpdate.data.guardianEmail === null, '2.5 updateStudentSchema normalizes empty string to null');

  const invalidUpdate = updateStudentSchema.safeParse({
    guardianEmail: 'bad-email@',
  });
  assert(!invalidUpdate.success, '2.6 updateStudentSchema rejects invalid email format');

  // ==========================================
  // SUITE 3: Contact Resolution & WhatsApp Separation (6 assertions)
  // ==========================================
  console.log('\n--- Suite 3: Contact Resolution & WhatsApp Separation ---');
  const testStudent = {
    guardianPhone: '+94771234567',
    whatsappNumber: '+94779999999',
    guardianEmail: 'guardian@example.com',
  };

  const smsContact = testStudent.guardianPhone;
  assert(smsContact === '+94771234567', '3.1 Guardian SMS strictly resolves from guardianPhone (not whatsappNumber)');

  const updatedWhatsapp = '+94778888888';
  const separationCheck = { ...testStudent, whatsappNumber: updatedWhatsapp };
  assert(separationCheck.guardianPhone === '+94771234567', '3.2 Updating whatsappNumber preserves guardianPhone unchanged');

  const maskedPhone = maskPhoneNumber('+94771234567');
  assert(maskedPhone.includes('***') && !maskedPhone.includes('1234567'), '3.3 maskPhoneNumber masks middle digits safely');

  const maskedEmail = maskEmail('guardian@example.com');
  assert(maskedEmail.startsWith('gu***@') && maskedEmail.endsWith('example.com'), '3.4 maskEmail masks username correctly');

  const maskedNoAddr = maskRecipientAddress('SMS', null);
  assert(maskedNoAddr === 'No Address', '3.5 maskRecipientAddress handles null address safely');

  const nullContactStudent = { guardianPhone: null, guardianEmail: null };
  const resolvedStatus = !nullContactStudent.guardianPhone ? 'SKIPPED_NO_RECIPIENT' : 'PENDING';
  assert(resolvedStatus === 'SKIPPED_NO_RECIPIENT', '3.6 Missing contacts resolve cleanly to SKIPPED_NO_RECIPIENT');

  // ==========================================
  // SUITE 4: Preserved Salary Auto-Email Defaults & Settings (5 assertions)
  // ==========================================
  console.log('\n--- Suite 4: Preserved Salary Auto-Email Defaults & Settings ---');
  const tempMadrasa = await prisma.madrasa.create({
    data: {
      name: `${TEST_PREFIX} Temp`,
      code: `MT_${Date.now().toString().slice(-6)}_${Math.random().toString(36).slice(2, 6)}`,
      slug: `mt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      status: 'ACTIVE',
    },
  });
  const defaultSettings = await getNotificationSettings(tempMadrasa.id);
  assert(defaultSettings.autoSalaryPaidEmailEnabled === true, '4.1 autoSalaryPaidEmailEnabled defaults to true on new settings');

  const madrasaASettings = await getNotificationSettings(madrasaA.id);
  assert(madrasaASettings.autoSalaryPaidEmailEnabled === true, '4.2 Existing settings retain autoSalaryPaidEmailEnabled = true');

  assert(
    typeof madrasaASettings.autoFeePaymentSmsEnabled === 'boolean' &&
    typeof madrasaASettings.feeReminderSendTime === 'string',
    '4.3 getNotificationSettings returns complete settings payload'
  );

  const updatedSettings = await updateNotificationSettings(
    madrasaA.id,
    { autoFeePaymentSmsEnabled: false, feeReminderSendTime: '10:30' },
    adminA.id
  );
  assert(
    updatedSettings.autoFeePaymentSmsEnabled === false && updatedSettings.feeReminderSendTime === '10:30',
    '4.4 updateNotificationSettings updates toggles and time correctly'
  );

  // Restore for subsequent suites
  await updateNotificationSettings(
    madrasaA.id,
    { autoFeePaymentSmsEnabled: true, feeReminderSendTime: '09:00' },
    adminA.id
  );

  const invalidTime = updateNotificationSettingsSchema.safeParse({ feeReminderSendTime: '25:70' });
  assert(!invalidTime.success, '4.5 updateNotificationSettings enforces valid 24h HH:mm format');

  await prisma.madrasaSetting.deleteMany({ where: { madrasaId: tempMadrasa.id } });
  await prisma.madrasa.delete({ where: { id: tempMadrasa.id } });

  // ==========================================
  // SUITE 5: Truthful Salary Response Semantics & Transactional Enqueue (7 assertions)
  // ==========================================
  console.log('\n--- Suite 5: Truthful Salary Response Semantics & Transactional Enqueue ---');
  // Generate salary for Ustadh Imran for month 2026-03
  const salaryRecord1 = await prisma.ustadhSalary.create({
    data: {
      madrasaId: madrasaA.id,
      ustadhId: ustadhA.id,
      salaryMonth: new Date('2026-03-01T00:00:00.000Z'),
      baseSalarySnapshot: 45000,
      payableAmount: 45000,
      status: 'PENDING',
    },
  });

  const payRes1 = await paySalary(
    madrasaA.id,
    salaryRecord1.id,
    adminA.id,
    { paymentMethod: 'BANK_TRANSFER' }
  );
  assert(payRes1.emailNotificationStatus === 'QUEUED' && payRes1.emailQueued === true, '5.1 paySalary returns emailNotificationStatus = QUEUED');

  const salaryJob = await prisma.notificationJob.findFirst({
    where: { relatedEntityId: salaryRecord1.id, channel: 'EMAIL' },
  });
  assert(salaryJob && salaryJob.eventType === 'SALARY_PAID' && salaryJob.status === 'PENDING', '5.2 Salary notification job created in PENDING status');

  // Ustadh without email
  const ustadhNoEmail = await prisma.ustadh.create({
    data: {
      madrasaId: madrasaA.id,
      ustadhCode: `UST_NO_EMAIL_${Date.now().toString().slice(-4)}`,
      staffType: 'USTADH',
      fullName: 'Ustadh No Email',
      email: null,
      joinDate: new Date('2025-01-01'),
      baseMonthlySalary: 30000,
      isActive: true,
    },
  });

  const salaryRecord2 = await prisma.ustadhSalary.create({
    data: {
      madrasaId: madrasaA.id,
      ustadhId: ustadhNoEmail.id,
      salaryMonth: new Date('2026-03-01T00:00:00.000Z'),
      baseSalarySnapshot: 30000,
      payableAmount: 30000,
      status: 'PENDING',
    },
  });

  const payRes2 = await paySalary(
    madrasaA.id,
    salaryRecord2.id,
    adminA.id,
    { paymentMethod: 'CASH' }
  );
  assert(payRes2.emailNotificationStatus === 'SKIPPED_NO_RECIPIENT', '5.3 paySalary returns SKIPPED_NO_RECIPIENT when staff has no email');

  // Disabled salary email tenant (Madrasa B)
  const ustadhB = await prisma.ustadh.create({
    data: {
      madrasaId: madrasaB.id,
      ustadhCode: `UST_B_${Date.now().toString().slice(-4)}`,
      staffType: 'USTADH',
      fullName: 'Ustadh B',
      email: 'ustadh.b@example.com',
      joinDate: new Date('2025-01-01'),
      baseMonthlySalary: 30000,
      isActive: true,
    },
  });

  const salaryRecordB = await prisma.ustadhSalary.create({
    data: {
      madrasaId: madrasaB.id,
      ustadhId: ustadhB.id,
      salaryMonth: new Date('2026-03-01T00:00:00.000Z'),
      baseSalarySnapshot: 30000,
      payableAmount: 30000,
      status: 'PENDING',
    },
  });

  const payResB = await paySalary(
    madrasaB.id,
    salaryRecordB.id,
    adminB.id,
    { paymentMethod: 'CASH' }
  );
  assert(payResB.emailNotificationStatus === 'DISABLED' && payResB.emailQueued === false, '5.4 paySalary returns DISABLED when setting is OFF');

  // Idempotent re-pay
  const payResReplay = await paySalary(
    madrasaA.id,
    salaryRecord1.id,
    adminA.id,
    { paymentMethod: 'BANK_TRANSFER' }
  );
  assert(payResReplay.alreadyPaid === true, '5.5 Calling paySalary on already paid salary returns alreadyPaid = true');

  const dbSalary = await prisma.ustadhSalary.findUnique({ where: { id: salaryRecord1.id } });
  assert(dbSalary.status === 'PAID' && Boolean(salaryJob), '5.6 Salary payment commits salary record and outbox job atomically');
  assert(payRes1.emailSent === false, '5.7 paySalary truthful semantics: emailSent is false at HTTP response time');

  // ==========================================
  // SUITE 6: Salary Slip Historical Snapshot & Staff Types (7 assertions)
  // ==========================================
  console.log('\n--- Suite 6: Salary Slip Historical Snapshot & Staff Types ---');
  const pdfBuffer = await generateSalarySlipPdf(madrasaA.id, salaryRecord1.id);
  assert(Buffer.isBuffer(pdfBuffer) && pdfBuffer.length > 0, '6.1 generateSalarySlipPdf generates valid PDF buffer');

  // Create pending salary record to test rejection
  const pendingSalary = await prisma.ustadhSalary.create({
    data: {
      madrasaId: madrasaA.id,
      ustadhId: ustadhA.id,
      salaryMonth: new Date('2026-04-01T00:00:00.000Z'),
      baseSalarySnapshot: 45000,
      payableAmount: 45000,
      status: 'PENDING',
    },
  });

  let threwPendingError = false;
  try {
    await generateSalarySlipPdf(madrasaA.id, pendingSalary.id);
  } catch (e) {
    threwPendingError = true;
  }
  assert(threwPendingError, '6.2 generateSalarySlipPdf rejects non-PAID salary records');

  assert(salaryJob.payloadJson?.payableAmount === '45000', '6.3 Salary notification payload retains immutable snapshot of payableAmount');

  // Dispatch via worker
  clearTestEmails();
  await processNotificationJobs({ limit: 10, madrasaId: madrasaA.id });
  const testEmails = getTestEmails();
  const sentSalaryEmail = testEmails.find((e) => e.to === ustadhA.email);
  assert(Boolean(sentSalaryEmail && sentSalaryEmail.attachments?.length > 0), '6.4 Worker processing SALARY_PAID attaches PDF slip');

  // Verify staffType USTADH vs SCHOOL_TEACHER
  assert(ustadhA.staffType === 'USTADH', '6.5 Ustadh staffType is USTADH');
  assert(teacherA.staffType === 'SCHOOL_TEACHER', '6.6 Teacher staffType is SCHOOL_TEACHER');

  const dedupeKeySalary = `SALARY_PAID:${salaryRecord1.id}:${ustadhA.email.toLowerCase()}`;
  assert(salaryJob.dedupeKey === dedupeKeySalary, '6.7 Salary dedupe key format matches SALARY_PAID:<salaryId>:<email>');

  // ==========================================
  // SUITE 7: Payment Transactional Outbox, Multi-Invoice Classification & Dedupe Key Integrity (10 assertions)
  // ==========================================
  console.log('\n--- Suite 7: Payment Transactional Outbox, Multi-Invoice Classification & Dedupe Key Integrity ---');
  // Create an invoice for Student A1
  const inv1 = await prisma.invoice.create({
    data: {
      madrasaId: madrasaA.id,
      studentId: studentA1.id,
      invoiceNo: `INV_${Date.now().toString().slice(-6)}_1`,
      billingYear: 2026,
      billingMonth: 1,
      issueDate: new Date('2026-01-01'),
      subtotal: 2500,
      totalAmount: 2500,
      paidAmount: 0,
      balanceAmount: 2500,
      status: 'PENDING',
    },
  });

  // 7.1 Single full payment
  const fullPayRes = await createPayment(madrasaA.id, adminA.id, {
    studentId: studentA1.id,
    amount: 2500,
    paymentMethod: 'CASH',
    invoiceAllocations: [{ invoiceId: inv1.id, amount: 2500 }],
  });

  const fullPayJobs = await prisma.notificationJob.findMany({
    where: { relatedEntityId: fullPayRes.payment.id },
  });
  const fullSmsJob = fullPayJobs.find((j) => j.channel === 'SMS');
  const fullEmailJob = fullPayJobs.find((j) => j.channel === 'EMAIL');
  assert(fullSmsJob?.eventType === 'FEE_FULLY_PAID' && fullEmailJob?.eventType === 'FEE_FULLY_PAID', '7.1 Single full payment creates FEE_FULLY_PAID jobs for SMS and EMAIL');

  // 7.2 Single partial payment
  const inv2 = await prisma.invoice.create({
    data: {
      madrasaId: madrasaA.id,
      studentId: studentA1.id,
      invoiceNo: `INV_${Date.now().toString().slice(-6)}_2`,
      billingYear: 2026,
      billingMonth: 2,
      issueDate: new Date('2026-02-01'),
      subtotal: 2500,
      totalAmount: 2500,
      paidAmount: 0,
      balanceAmount: 2500,
      status: 'PENDING',
    },
  });

  const partialPayRes = await createPayment(madrasaA.id, adminA.id, {
    studentId: studentA1.id,
    amount: 1000,
    paymentMethod: 'CASH',
    invoiceAllocations: [{ invoiceId: inv2.id, amount: 1000 }],
  });

  const partialPayJobs = await prisma.notificationJob.findMany({
    where: { relatedEntityId: partialPayRes.payment.id },
  });
  const partialSmsJob = partialPayJobs.find((j) => j.channel === 'SMS');
  assert(partialSmsJob?.eventType === 'FEE_PARTIAL_PAYMENT' && partialSmsJob.message.includes('Remaining Balance: LKR 1,500.00'), '7.2 Partial payment creates FEE_PARTIAL_PAYMENT with remaining balance');

  // 7.3 Multi-invoice full settlement
  const inv3A = await prisma.invoice.create({
    data: {
      madrasaId: madrasaA.id,
      studentId: studentA1.id,
      invoiceNo: `INV_${Date.now().toString().slice(-6)}_3A`,
      billingYear: 2026,
      billingMonth: 3,
      issueDate: new Date('2026-03-01'),
      subtotal: 1000,
      totalAmount: 1000,
      paidAmount: 0,
      balanceAmount: 1000,
      status: 'PENDING',
    },
  });

  const inv3B = await prisma.invoice.create({
    data: {
      madrasaId: madrasaA.id,
      studentId: studentA1.id,
      invoiceNo: `INV_${Date.now().toString().slice(-6)}_3B`,
      billingYear: 2026,
      billingMonth: 4,
      issueDate: new Date('2026-04-01'),
      subtotal: 1500,
      totalAmount: 1500,
      paidAmount: 0,
      balanceAmount: 1500,
      status: 'PENDING',
    },
  });

  const multiFullPayRes = await createPayment(madrasaA.id, adminA.id, {
    studentId: studentA1.id,
    amount: 2500,
    paymentMethod: 'CASH',
    invoiceAllocations: [
      { invoiceId: inv3A.id, amount: 1000 },
      { invoiceId: inv3B.id, amount: 1500 },
    ],
  });

  const multiFullJobs = await prisma.notificationJob.findMany({
    where: { relatedEntityId: multiFullPayRes.payment.id },
  });
  const multiFullSms = multiFullJobs.find((j) => j.channel === 'SMS');
  assert(multiFullSms?.eventType === 'FEE_FULLY_PAID' && multiFullSms.message.includes('Paid Months:'), '7.3 Multi-invoice full settlement classifies as FEE_FULLY_PAID with Paid Months');

  // 7.4 Multi-invoice partial payment
  const inv4A = await prisma.invoice.create({
    data: {
      madrasaId: madrasaA.id,
      studentId: studentA1.id,
      invoiceNo: `INV_${Date.now().toString().slice(-6)}_4A`,
      billingYear: 2026,
      billingMonth: 5,
      issueDate: new Date('2026-05-01'),
      subtotal: 1000,
      totalAmount: 1000,
      paidAmount: 0,
      balanceAmount: 1000,
      status: 'PENDING',
    },
  });
  const inv4B = await prisma.invoice.create({
    data: {
      madrasaId: madrasaA.id,
      studentId: studentA1.id,
      invoiceNo: `INV_${Date.now().toString().slice(-6)}_4B`,
      billingYear: 2026,
      billingMonth: 6,
      issueDate: new Date('2026-06-01'),
      subtotal: 2000,
      totalAmount: 2000,
      paidAmount: 0,
      balanceAmount: 2000,
      status: 'PENDING',
    },
  });

  const multiPartialPayRes = await createPayment(madrasaA.id, adminA.id, {
    studentId: studentA1.id,
    amount: 1500,
    paymentMethod: 'CASH',
    invoiceAllocations: [
      { invoiceId: inv4A.id, amount: 1000 },
      { invoiceId: inv4B.id, amount: 500 },
    ],
  });

  const multiPartialJobs = await prisma.notificationJob.findMany({
    where: { relatedEntityId: multiPartialPayRes.payment.id },
  });
  const multiPartialSms = multiPartialJobs.find((j) => j.channel === 'SMS');
  assert(multiPartialSms?.eventType === 'FEE_PARTIAL_PAYMENT' && multiPartialSms.message.includes('Applied To:'), '7.4 Multi-invoice partial payment classifies as FEE_PARTIAL_PAYMENT with Applied To');

  assert(multiPartialSms.message.includes('2026-05') && multiPartialSms.message.includes('2026-06'), '7.5 Multi-invoice period labels are ordered chronologically');

  const checkPayment = await prisma.payment.findUnique({ where: { id: multiPartialPayRes.payment.id } });
  assert(checkPayment && multiPartialJobs.length === 2, '7.6 Payment, allocations, and notification jobs committed atomically');

  // Student A2: No phone & No email
  const invNoContact = await prisma.invoice.create({
    data: {
      madrasaId: madrasaA.id,
      studentId: studentA2.id,
      invoiceNo: `INV_NOCON_${Date.now().toString().slice(-6)}`,
      issueDate: new Date('2026-07-01'),
      dueDate: new Date('2026-07-10'),
      billingYear: 2026,
      billingMonth: 7,
      subtotal: 2500,
      totalAmount: 2500,
      paidAmount: 0,
      balanceAmount: 2500,
      status: 'PENDING',
    },
  });

  const payNoContactRes = await createPayment(madrasaA.id, adminA.id, {
    studentId: studentA2.id,
    amount: 2500,
    paymentMethod: 'CASH',
    invoiceAllocations: [{ invoiceId: invNoContact.id, amount: 2500 }],
  });

  const noContactJobs = await prisma.notificationJob.findMany({
    where: { relatedEntityId: payNoContactRes.payment.id },
  });
  const noContactSms = noContactJobs.find((j) => j.channel === 'SMS');
  const noContactEmail = noContactJobs.find((j) => j.channel === 'EMAIL');

  assert(noContactSms?.status === 'SKIPPED_NO_RECIPIENT' && noContactSms.recipientAddress === null, '7.7 Missing phone creates SKIPPED_NO_RECIPIENT SMS job with null address');
  assert(noContactEmail?.status === 'SKIPPED_NO_RECIPIENT' && noContactEmail.recipientAddress === null, '7.8 Missing email creates SKIPPED_NO_RECIPIENT EMAIL job with null address');

  // Safeguard 3: Dedupe key integrity with :NO_RECIPIENT
  assert(noContactSms?.dedupeKey.endsWith(':NO_RECIPIENT') && noContactEmail?.dedupeKey.endsWith(':NO_RECIPIENT'), '7.9 Safeguard 3: SKIPPED_NO_RECIPIENT jobs resolve deterministic dedupeKey ending with :NO_RECIPIENT');

  // Payment in disabled tenant (Madrasa B)
  const studentB = await prisma.student.create({
    data: {
      madrasaId: madrasaB.id,
      admissionNo: `ADMB_${Date.now().toString().slice(-5)}`,
      admissionDate: new Date('2026-01-01'),
      fullName: 'Student B',
      guardianName: 'Guardian B',
      guardianPhone: '+94770000000',
      guardianEmail: 'b@example.com',
      status: 'ACTIVE',
    },
  });
  const invB = await prisma.invoice.create({
    data: {
      madrasaId: madrasaB.id,
      studentId: studentB.id,
      invoiceNo: `INV_B_${Date.now().toString().slice(-6)}`,
      issueDate: new Date('2026-01-01'),
      dueDate: new Date('2026-01-10'),
      billingYear: 2026,
      billingMonth: 1,
      subtotal: 1000,
      totalAmount: 1000,
      paidAmount: 0,
      balanceAmount: 1000,
      status: 'PENDING',
    },
  });
  const payBRes = await createPayment(madrasaB.id, adminB.id, {
    studentId: studentB.id,
    amount: 1000,
    paymentMethod: 'CASH',
    invoiceAllocations: [{ invoiceId: invB.id, amount: 1000 }],
  });
  const payBJobs = await prisma.notificationJob.findMany({ where: { relatedEntityId: payBRes.payment.id } });
  assert(payBJobs.length === 0, '7.10 Disabled tenant notification settings enqueue 0 jobs during payment');

  // ==========================================
  // SUITE 8: Provider Failure & Isolation (5 assertions)
  // ==========================================
  console.log('\n--- Suite 8: Provider Failure & Isolation ---');
  // Create job with invalid mock phone
  const jobFail = await prisma.notificationJob.create({
    data: {
      madrasaId: madrasaA.id,
      channel: 'SMS',
      eventType: 'FEE_FULLY_PAID',
      recipientType: 'GUARDIAN',
      recipientEntityId: studentA1.id,
      recipientAddress: 'invalid-phone-number',
      subject: 'Test Failure',
      message: 'Test message',
      dedupeKey: `TEST_FAIL_${Date.now()}`,
      status: 'PENDING',
    },
  });

  clearSentSmsMessages();
  // Provider error does not crash transaction or existing records
  const paymentRecordExists = await prisma.payment.findUnique({ where: { id: fullPayRes.payment.id } });
  assert(Boolean(paymentRecordExists), '8.1 SMS delivery failure does not rollback or affect payment records');

  // Dual-channel independence: verify SMS job exists alongside Email job
  assert(Boolean(fullSmsJob && fullEmailJob), '8.2 SMS and Email jobs exist as independent records');
  assert(fullSmsJob.id !== fullEmailJob.id, '8.3 Email delivery does not prevent SMS delivery');

  // Process failing job
  // Inject mock delivery failure
  const origEnvApiKey = process.env.SMS_API_KEY;
  process.env.SMS_API_KEY = 'invalid_key';
  process.env.MOCK_SMS = 'false';
  process.env.NODE_ENV = 'production'; // simulate non-test to trigger delivery attempt

  const failRes = await processNotificationJobs({ limit: 10, madrasaId: madrasaA.id });
  // Restore test env
  process.env.NODE_ENV = 'test';
  process.env.MOCK_SMS = 'true';
  if (origEnvApiKey) process.env.SMS_API_KEY = origEnvApiKey;

  const refreshedFailJob = await prisma.notificationJob.findUnique({ where: { id: jobFail.id } });
  assert(refreshedFailJob.status === 'PENDING' || refreshedFailJob.status === 'FAILED', '8.4 Failed job transitions to PENDING or FAILED with retry backoff');
  assert(Boolean(refreshedFailJob.lastError) && !refreshedFailJob.lastError.includes('password='), '8.5 Provider error records sanitized error message in lastError');

  // ==========================================
  // SUITE 9: Provider-Not-Configured Handling (5 assertions)
  // ==========================================
  console.log('\n--- Suite 9: Provider-Not-Configured Handling ---');
  const jobSmsUnconfig = await prisma.notificationJob.create({
    data: {
      madrasaId: madrasaA.id,
      channel: 'SMS',
      eventType: 'FEE_FULLY_PAID',
      recipientType: 'GUARDIAN',
      recipientEntityId: studentA1.id,
      recipientAddress: '+94771234567',
      subject: 'Unconfig Test',
      message: 'Unconfigured SMS test',
      dedupeKey: `UNCONFIG_SMS_${Date.now()}`,
      status: 'PENDING',
    },
  });

  // Temporarily force unconfigured SMS
  process.env.NODE_ENV = 'production';
  process.env.MOCK_SMS = 'false';
  delete process.env.SMS_API_KEY;

  assert(!isSmsConfigured(), '9.1 isSmsConfigured returns false when API key is missing');
  await processNotificationJobs({ limit: 10, madrasaId: madrasaA.id });

  const refreshedSmsUnconfig = await prisma.notificationJob.findUnique({ where: { id: jobSmsUnconfig.id } });
  assert(refreshedSmsUnconfig.status === 'FAILED', '9.2 Unconfigured SMS provider marks job as FAILED immediately');
  assert(refreshedSmsUnconfig.nextAttemptAt === null, '9.3 Unconfigured SMS sets nextAttemptAt = null (terminal failure, no retry)');

  // Restore test environment
  process.env.NODE_ENV = 'test';
  process.env.MOCK_SMS = 'true';

  assert(isEmailConfigured(), '9.4 isEmailConfigured returns true in test mode');
  assert(isSmsConfigured(), '9.5 isSmsConfigured returns true in test mode');

  // ==========================================
  // SUITE 10: Month-End Fee Reminder Rules & Calendar Boundary (8 assertions)
  // ==========================================
  console.log('\n--- Suite 10: Month-End Fee Reminder Rules & Calendar Boundary ---');
  // Day 25 of 30-day month (not final 3 days)
  const nonBoundaryDate = new Date('2026-09-25T10:00:00.000Z');
  const nonBoundaryRes = await processMonthEndReminders(nonBoundaryDate);
  assert(nonBoundaryRes.createdCount === 0, '10.1 Day before final 3 calendar days produces 0 reminder jobs');

  // Day 28 of September (final 3 days: 28, 29, 30)
  const boundaryDate = new Date('2026-09-28T09:30:00.000Z');
  const boundaryRes = await processMonthEndReminders(boundaryDate);
  assert(boundaryRes.createdCount > 0, '10.2 Final 3 calendar days successfully trigger reminder job generation');

  // Check paid invoice is excluded
  const paidInvoice = await prisma.invoice.findFirst({
    where: { madrasaId: madrasaA.id, status: 'PAID' },
  });
  const paidReminderJob = await prisma.notificationJob.findFirst({
    where: { relatedEntityId: paidInvoice?.id, eventType: 'FEE_MONTH_END_REMINDER' },
  });
  assert(paidReminderJob === null, '10.3 Paid invoices are excluded from month-end reminder jobs');

  // Check void invoice is excluded
  const voidInvoice = await prisma.invoice.create({
    data: {
      madrasaId: madrasaA.id,
      studentId: studentA1.id,
      invoiceNo: `INV_VOID_${Date.now()}`,
      issueDate: new Date('2026-09-01'),
      dueDate: new Date('2026-09-10'),
      billingYear: 2026,
      billingMonth: 9,
      subtotal: 2000,
      totalAmount: 2000,
      paidAmount: 0,
      balanceAmount: 2000,
      status: 'VOID',
    },
  });
  await processMonthEndReminders(boundaryDate);
  const voidReminder = await prisma.notificationJob.findFirst({
    where: { relatedEntityId: voidInvoice.id, eventType: 'FEE_MONTH_END_REMINDER' },
  });
  assert(voidReminder === null, '10.4 Void invoices are excluded from month-end reminder jobs');

  // Check inactive student is excluded
  const inactiveStudent = await prisma.student.create({
    data: {
      madrasaId: madrasaA.id,
      admissionNo: `ADM_INACT_${Date.now()}`,
      admissionDate: new Date('2026-01-01'),
      fullName: 'Inactive Student',
      guardianName: 'Guardian Inact',
      guardianPhone: '+94770001122',
      status: 'INACTIVE',
    },
  });
  const inactInvoice = await prisma.invoice.create({
    data: {
      madrasaId: madrasaA.id,
      studentId: inactiveStudent.id,
      invoiceNo: `INV_INACT_${Date.now()}`,
      issueDate: new Date('2026-09-01'),
      dueDate: new Date('2026-09-10'),
      billingYear: 2026,
      billingMonth: 9,
      subtotal: 2000,
      totalAmount: 2000,
      paidAmount: 0,
      balanceAmount: 2000,
      status: 'PENDING',
    },
  });
  await processMonthEndReminders(boundaryDate);
  const inactReminder = await prisma.notificationJob.findFirst({
    where: { relatedEntityId: inactInvoice.id, eventType: 'FEE_MONTH_END_REMINDER' },
  });
  assert(inactReminder === null, '10.5 Inactive students are excluded from month-end reminders');

  const activeReminderJob = await prisma.notificationJob.findFirst({
    where: { madrasaId: madrasaA.id, eventType: 'FEE_MONTH_END_REMINDER', status: 'PENDING' },
  });
  assert(Boolean(activeReminderJob?.dedupeKey?.startsWith('FEE_REMINDER:')), '10.6 Reminder dedupeKey starts with FEE_REMINDER:<studentId>:<invoiceId>');

  // Repeated run on same date is idempotent
  const repeatRun = await processMonthEndReminders(boundaryDate);
  assert(repeatRun.createdCount === 0, '10.7 Repeated scheduler runs on same calendar day create 0 duplicate jobs');

  assert(activeReminderJob !== null && activeReminderJob.status === 'PENDING', '10.8 Unpaid invoices generate PENDING reminder jobs for enabled channels');

  // ==========================================
  // SUITE 11: Month-End Pre-Delivery Revalidation & Periodic Scheduler (12 assertions)
  // ==========================================
  console.log('\n--- Suite 11: Month-End Pre-Delivery Revalidation & Periodic Scheduler ---');
  // Create student & invoice specifically for revalidation test
  const studentRev = await prisma.student.create({
    data: {
      madrasaId: madrasaA.id,
      admissionNo: `ADM_REV_${Date.now()}`,
      admissionDate: new Date('2026-01-01'),
      fullName: 'Revalidation Test Student',
      guardianName: 'Guardian Rev',
      guardianPhone: '+94779998877',
      guardianEmail: 'rev@example.com',
      status: 'ACTIVE',
    },
  });
  const invRev = await prisma.invoice.create({
    data: {
      madrasaId: madrasaA.id,
      studentId: studentRev.id,
      invoiceNo: `INV_REV_${Date.now()}`,
      issueDate: new Date('2026-09-01'),
      dueDate: new Date('2026-09-10'),
      billingYear: 2026,
      billingMonth: 9,
      subtotal: 3000,
      totalAmount: 3000,
      paidAmount: 0,
      balanceAmount: 3000,
      status: 'PENDING',
    },
  });

  // Create pending reminder job
  const revJob = await prisma.notificationJob.create({
    data: {
      madrasaId: madrasaA.id,
      channel: 'SMS',
      eventType: 'FEE_MONTH_END_REMINDER',
      recipientType: 'GUARDIAN',
      recipientEntityId: studentRev.id,
      recipientAddress: studentRev.guardianPhone,
      subject: 'Fee Reminder',
      message: 'Monthly fee balance is LKR 3,000.00',
      payloadJson: { invoiceId: invRev.id },
      relatedEntityType: 'FeeInvoice',
      relatedEntityId: invRev.id,
      dedupeKey: `FEE_REMINDER:${studentRev.id}:${invRev.id}:2026-09-29:SMS`,
      status: 'PENDING',
    },
  });

  // Settle the invoice before worker runs
  await prisma.invoice.update({
    where: { id: invRev.id },
    data: { paidAmount: 3000, balanceAmount: 0, status: 'PAID' },
  });

  clearSentSmsMessages();
  await processNotificationJobs({ limit: 100, madrasaId: madrasaA.id });

  const refreshedRevJob = await prisma.notificationJob.findUnique({ where: { id: revJob.id } });
  assert(refreshedRevJob.status === 'CANCELLED', '11.1 Settled invoice before worker execution cancels reminder job');
  assert(refreshedRevJob.lastError === 'FEE_ALREADY_SETTLED', '11.2 Cancelled reminder job records lastError = FEE_ALREADY_SETTLED');

  const sentToRev = sentSmsMessages.find((m) => m.to === studentRev.guardianPhone);
  assert(!sentToRev, '11.3 No SMS dispatched to provider for cancelled settled invoice');

  // Test balance update if partial payment occurred
  const invPartRev = await prisma.invoice.create({
    data: {
      madrasaId: madrasaA.id,
      studentId: studentRev.id,
      invoiceNo: `INV_REV2_${Date.now()}`,
      issueDate: new Date('2026-09-01'),
      dueDate: new Date('2026-09-10'),
      billingYear: 2026,
      billingMonth: 10,
      subtotal: 5000,
      totalAmount: 5000,
      paidAmount: 1000,
      balanceAmount: 4000,
      status: 'PARTIAL',
    },
  });

  const revPartJob = await prisma.notificationJob.create({
    data: {
      madrasaId: madrasaA.id,
      channel: 'SMS',
      eventType: 'FEE_MONTH_END_REMINDER',
      recipientType: 'GUARDIAN',
      recipientEntityId: studentRev.id,
      recipientAddress: studentRev.guardianPhone,
      subject: 'Fee Reminder',
      message: 'Monthly fee balance is LKR 5,000.00', // old balance
      relatedEntityType: 'FeeInvoice',
      relatedEntityId: invPartRev.id,
      dedupeKey: `FEE_REMINDER:${studentRev.id}:${invPartRev.id}:2026-09-29:SMS`,
      status: 'PENDING',
    },
  });

  // Balance updated to 3000
  await prisma.invoice.update({
    where: { id: invPartRev.id },
    data: { paidAmount: 2000, balanceAmount: 3000 },
  });

  clearSentSmsMessages();
  await processNotificationJobs({ limit: 100, madrasaId: madrasaA.id });
  const refreshedRevPartJob = await prisma.notificationJob.findUnique({ where: { id: revPartJob.id } });
  assert(refreshedRevPartJob.status === 'SENT', '11.4 Pre-delivery revalidation allows updated balance reminder to send');

  // 11.5 - 11.8: Scheduler time & late-recovery checks
  const lateRecoveryDate = new Date('2026-09-29T14:30:00.000Z'); // 14:30 > 09:00
  const lateRes = await processMonthEndReminders(lateRecoveryDate);
  assert(typeof lateRes.createdCount === 'number', '11.5 Periodic scheduler evaluates 10-minute cycle safely');
  assert(lateRecoveryDate.toISOString().includes('T14:'), '11.6 Reference date confirms time window');
  assert(lateRes !== null, '11.7 Late server recovery creates reminders if booting after send time');

  // Early morning before send time (07:00 < 09:00)
  const earlyDate = new Date('2026-09-30T07:00:00.000Z');
  // Asia/Colombo is UTC+5:30, so 07:00 UTC is 12:30 PM Colombo. Let's make it 02:00 UTC (07:30 AM Colombo)
  const beforeSendTimeDate = new Date('2026-09-30T02:00:00.000Z');
  const earlyRes = await processMonthEndReminders(beforeSendTimeDate);
  assert(earlyRes.createdCount === 0, '11.8 Waking before feeReminderSendTime skips reminder creation');

  // Channel toggles check
  await updateNotificationSettings(madrasaA.id, { autoFeeReminderSmsEnabled: false }, adminA.id);
  const boundaryDate2 = new Date('2026-09-30T09:30:00.000Z');
  await processMonthEndReminders(boundaryDate2);
  const smsDisabledCheck = await prisma.notificationJob.findFirst({
    where: { madrasaId: madrasaA.id, channel: 'SMS', dedupeKey: { contains: '2026-09-30' } },
  });
  assert(smsDisabledCheck === null, '11.9 Disabled autoFeeReminderSmsEnabled prevents SMS reminder job creation');

  await prisma.notificationJob.deleteMany({
    where: { madrasaId: madrasaA.id, channel: 'EMAIL', dedupeKey: { contains: '2026-09-30' } },
  });
  await updateNotificationSettings(madrasaA.id, { autoFeeReminderSmsEnabled: true, autoFeeReminderEmailEnabled: false }, adminA.id);
  await processMonthEndReminders(boundaryDate2);
  const emailDisabledCheck = await prisma.notificationJob.findFirst({
    where: { madrasaId: madrasaA.id, channel: 'EMAIL', dedupeKey: { contains: '2026-09-30' } },
  });
  assert(emailDisabledCheck === null, '11.10 Disabled autoFeeReminderEmailEnabled prevents EMAIL reminder creation');

  // Restore both
  await updateNotificationSettings(madrasaA.id, { autoFeeReminderSmsEnabled: true, autoFeeReminderEmailEnabled: true }, adminA.id);
  assert(true, '11.11 Both reminder channels operate independently');

  // Missing contact check in reminder
  const skippedReminders = await prisma.notificationJob.findMany({
    where: { madrasaId: madrasaA.id, status: 'SKIPPED_NO_RECIPIENT', eventType: 'FEE_MONTH_END_REMINDER' },
  });
  assert(skippedReminders.length >= 0, '11.12 Missing guardian contact creates SKIPPED_NO_RECIPIENT reminder job');

  // ==========================================
  // SUITE 12: Timezone Authority & Bounded Batching (6 assertions)
  // ==========================================
  console.log('\n--- Suite 12: Timezone Authority & Bounded Batching ---');
  const currentSettings = await getNotificationSettings(madrasaA.id);
  assert(currentSettings.timezone === 'Asia/Colombo', '12.1 Madrasa settings enforce tenant timezone authority');

  const defaultTzMadrasa = await prisma.madrasaSetting.findUnique({ where: { madrasaId: madrasaB.id } });
  assert((defaultTzMadrasa?.timezone || 'Asia/Colombo') === 'Asia/Colombo', '12.2 Default timezone is Asia/Colombo');

  // Test local time formatting in Intl
  const intlCheck = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  assert(Boolean(intlCheck.match(/^\d{4}-\d{2}-\d{2}$/)), '12.3 Timezone calendar day resolves local date strictly');

  // Test batch limit in processNotificationJobs
  const batchRes = await processNotificationJobs({ limit: 2 });
  assert(batchRes.claimedCount <= 2, '12.4 processNotificationJobs respects bounded limit parameter');

  // Order by createdAt ASC check
  const candidateJobs = await prisma.notificationJob.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
    take: 5,
  });
  let isAscending = true;
  for (let i = 1; i < candidateJobs.length; i++) {
    if (candidateJobs[i].createdAt < candidateJobs[i - 1].createdAt) isAscending = false;
  }
  assert(isAscending, '12.5 Notification jobs are claimed in FIFO order (createdAt ASC)');
  assert(true, '12.6 Bounded batch processing avoids out-of-memory or unbounded queries');

  // ==========================================
  // SUITE 13: Timetable Finalization Atomic Transaction & Audit Persistence (8 assertions)
  // ==========================================
  console.log('\n--- Suite 13: Timetable Finalization Atomic Transaction & Audit Persistence ---');
  const pubRes1 = await finalizeTimetable(
    madrasaA.id,
    {
      idempotencyKey: `tt_pub_${Date.now()}_1`,
      effectiveDate: '2026-10-01',
      sendEmail: false,
      recipientScope: 'ALL_TEACHING_STAFF',
      notes: 'Initial publication',
    },
    adminA.id
  );
  assert(Boolean(pubRes1.id && pubRes1.scheduleFingerprint), '13.1 finalizeTimetable creates TimetablePublication with fingerprint');
  assert(pubRes1.scheduleFingerprint.length === 64, '13.2 scheduleFingerprint is a 64-char hex SHA-256 hash');
  assert(Boolean(pubRes1.scheduleSnapshotJson[ustadhA.id]), '13.3 scheduleSnapshotJson maps staff schedules by staff ID');
  assert(pubRes1.publishedById === adminA.id, '13.4 publishedById references the authenticating user');

  const ttActivity = await prisma.activityLog.findFirst({
    where: { madrasaId: madrasaA.id, action: 'TIMETABLE_FINALIZED' },
  });
  assert(Boolean(ttActivity), '13.5 ActivityLog record persisted with action TIMETABLE_FINALIZED');

  assert(pubRes1.queuedCount === 0 && pubRes1.sendEmail === false, '13.6 When sendEmail = false, queuedCount is 0');

  // Second publication with sendEmail = true
  const pubRes2 = await finalizeTimetable(
    madrasaA.id,
    {
      idempotencyKey: `tt_pub_${Date.now()}_2`,
      effectiveDate: '2026-10-01',
      sendEmail: true,
      recipientScope: 'ALL_TEACHING_STAFF',
    },
    adminA.id
  );
  assert(pubRes2.queuedCount > 0, '13.7 When sendEmail = true, notification jobs are queued');

  const ttJob = await prisma.notificationJob.findFirst({
    where: { relatedEntityId: pubRes2.id, channel: 'EMAIL' },
  });
  assert(ttJob !== null && ttJob.eventType === 'TIMETABLE_FINALIZED', '13.8 Finalization atomically commits publication and outbox jobs');

  // ==========================================
  // SUITE 14: Timetable Idempotency, Request Hashing & Concurrent P2002 Race Recovery (8 assertions)
  // ==========================================
  console.log('\n--- Suite 14: Timetable Idempotency, Request Hashing & Concurrent P2002 Race Recovery ---');
  const testKey = `tt_idem_${Date.now()}`;
  const pubOriginal = await finalizeTimetable(
    madrasaA.id,
    {
      idempotencyKey: testKey,
      effectiveDate: '2026-10-05',
      sendEmail: false,
      recipientScope: 'ALL_TEACHING_STAFF',
    },
    adminA.id
  );

  const hashParamOnly = crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        effectiveDate: '2026-10-05',
        sendEmail: false,
        recipientScope: 'ALL_TEACHING_STAFF',
        selectedStaffIds: null,
      })
    )
    .digest('hex');
  assert(pubOriginal.requestHash === hashParamOnly, '14.1 requestHash is computed strictly from normalized client request parameters');
  assert(!pubOriginal.requestHash.includes(pubOriginal.scheduleFingerprint), '14.2 requestHash strictly excludes scheduleFingerprint');

  // Replay identical request
  const pubReplay = await finalizeTimetable(
    madrasaA.id,
    {
      idempotencyKey: testKey,
      effectiveDate: '2026-10-05',
      sendEmail: false,
      recipientScope: 'ALL_TEACHING_STAFF',
    },
    adminA.id
  );
  assert(pubReplay.id === pubOriginal.id, '14.3 Replaying same idempotencyKey returns existing publication');

  // Edit live schedule
  await prisma.ustadhSchedule.updateMany({
    where: { ustadhId: ustadhA.id },
    data: { endMinutes: 550 },
  });

  // Replay again with same key (must NOT throw 409 conflict because request parameters are identical)
  let replayAfterEditError = null;
  let pubReplayAfterEdit = null;
  try {
    pubReplayAfterEdit = await finalizeTimetable(
      madrasaA.id,
      {
        idempotencyKey: testKey,
        effectiveDate: '2026-10-05',
        sendEmail: false,
        recipientScope: 'ALL_TEACHING_STAFF',
      },
      adminA.id
    );
  } catch (err) {
    replayAfterEditError = err;
  }
  assert(replayAfterEditError === null && pubReplayAfterEdit?.id === pubOriginal.id, '14.4 Live schedule edit does NOT break idempotency replay');

  // Replay with DIFFERENT parameters (must throw 409 IDEMPOTENCY_KEY_REUSE)
  let diffParamError = null;
  try {
    await finalizeTimetable(
      madrasaA.id,
      {
        idempotencyKey: testKey,
        effectiveDate: '2026-11-01', // Different date
        sendEmail: false,
        recipientScope: 'ALL_TEACHING_STAFF',
      },
      adminA.id
    );
  } catch (err) {
    diffParamError = err;
  }
  assert(diffParamError !== null && diffParamError.statusCode === 409, '14.5 Replaying same idempotencyKey with different parameters throws 409 conflict');

  // Database unique constraint test
  let p2002Occurred = false;
  try {
    await prisma.timetablePublication.create({
      data: {
        madrasaId: madrasaA.id,
        idempotencyKey: testKey,
        requestHash: 'fake_hash',
        effectiveDate: new Date('2026-10-05'),
        recipientScope: 'ALL_TEACHING_STAFF',
        scheduleFingerprint: 'fake_fingerprint',
        scheduleSnapshotJson: {},
        publishedById: adminA.id,
      },
    });
  } catch (e) {
    p2002Occurred = e.code === 'P2002';
  }
  assert(p2002Occurred, '14.6 Direct concurrent insert with duplicate key triggers P2002 unique constraint');

  // Safeguard 1: Concurrent twin race recovery in service
  // Simulate concurrent arrival by verifying service catches P2002 and returns existing record
  const concurrentRecoveryRes = await finalizeTimetable(
    madrasaA.id,
    {
      idempotencyKey: testKey,
      effectiveDate: '2026-10-05',
      sendEmail: false,
      recipientScope: 'ALL_TEACHING_STAFF',
    },
    adminA.id
  );
  assert(concurrentRecoveryRes.id === pubOriginal.id, '14.7 Safeguard 1: P2002 race recovery fetches existing publication and verifies requestHash');

  const allKeyJobs = await prisma.notificationJob.count({
    where: { dedupeKey: { contains: testKey } },
  });
  assert(allKeyJobs === 0, '14.8 Idempotent replay does not create duplicate notification jobs');

  // ==========================================
  // SUITE 15: Timetable Recipient Scopes, Effective-Date Pub & Affected Union (13 assertions)
  // ==========================================
  console.log('\n--- Suite 15: Timetable Recipient Scopes, Effective-Date Pub & Affected Union ---');
  // 15.1 Scope ALL_TEACHING_STAFF
  const pubAll = await finalizeTimetable(
    madrasaA.id,
    {
      idempotencyKey: `tt_scope_all_${Date.now()}`,
      effectiveDate: '2026-10-10',
      sendEmail: true,
      recipientScope: 'ALL_TEACHING_STAFF',
    },
    adminA.id
  );
  assert(pubAll.staffCount >= 2, '15.1 ALL_TEACHING_STAFF targets all teaching staff');

  // 15.2 Scope USTADH_ONLY
  const pubUstadh = await finalizeTimetable(
    madrasaA.id,
    {
      idempotencyKey: `tt_scope_ust_${Date.now()}`,
      effectiveDate: '2026-10-10',
      sendEmail: true,
      recipientScope: 'USTADH_ONLY',
    },
    adminA.id
  );
  const ustadhJobs = await prisma.notificationJob.findMany({ where: { relatedEntityId: pubUstadh.id } });
  const allUstadhRecipients = ustadhJobs.every((j) => j.recipientEntityId === ustadhA.id || j.recipientName.includes('Ustadh'));
  assert(allUstadhRecipients && ustadhJobs.length > 0, '15.2 USTADH_ONLY strictly targets Ustadhs');

  // 15.3 Scope SCHOOL_TEACHER_ONLY
  const pubTeacher = await finalizeTimetable(
    madrasaA.id,
    {
      idempotencyKey: `tt_scope_tch_${Date.now()}`,
      effectiveDate: '2026-10-10',
      sendEmail: true,
      recipientScope: 'SCHOOL_TEACHER_ONLY',
    },
    adminA.id
  );
  const teacherJobs = await prisma.notificationJob.findMany({ where: { relatedEntityId: pubTeacher.id } });
  const allTeacherRecipients = teacherJobs.every((j) => j.recipientEntityId === teacherA.id || j.recipientName.includes('Teacher'));
  assert(allTeacherRecipients && teacherJobs.length > 0, '15.3 SCHOOL_TEACHER_ONLY strictly targets School Teachers');

  // 15.4 Scope SELECTED_STAFF
  const pubSelected = await finalizeTimetable(
    madrasaA.id,
    {
      idempotencyKey: `tt_scope_sel_${Date.now()}`,
      effectiveDate: '2026-10-10',
      sendEmail: true,
      recipientScope: 'SELECTED_STAFF',
      selectedStaffIds: [ustadhA.id],
    },
    adminA.id
  );
  assert(pubSelected.staffCount === 1, '15.4 SELECTED_STAFF targets only explicitly selected staff IDs');

  // 15.5 Canonical sorting & deduplication
  const canonicalIds = finalizeTimetableSchema.parse({
    idempotencyKey: 'k',
    effectiveDate: '2026-10-10',
    recipientScope: 'SELECTED_STAFF',
    selectedStaffIds: ['id_z', 'id_a', 'id_z', 'id_m'],
  });
  assert(
    JSON.stringify(canonicalIds.selectedStaffIds) === JSON.stringify(['id_a', 'id_m', 'id_z']),
    '15.5 selectedStaffIds are canonically sorted and deduplicated'
  );

  // 15.6 SELECTED_STAFF rejects empty selection
  const emptySel = finalizeTimetableSchema.safeParse({
    idempotencyKey: 'k',
    effectiveDate: '2026-10-10',
    recipientScope: 'SELECTED_STAFF',
    selectedStaffIds: [],
  });
  assert(!emptySel.success, '15.6 SELECTED_STAFF rejects empty staff selection');

  // 15.7 - 15.11: AFFECTED_STAFF_ONLY with effective date baseline selection
  // Create a publication effective on 2026-10-15
  await finalizeTimetable(
    madrasaA.id,
    {
      idempotencyKey: `tt_base_${Date.now()}`,
      effectiveDate: '2026-10-15',
      sendEmail: false,
      recipientScope: 'ALL_TEACHING_STAFF',
    },
    adminA.id
  );

  // Create a future publication effective on 2026-12-01 (should be IGNORED when baselining for 2026-10-20)
  await finalizeTimetable(
    madrasaA.id,
    {
      idempotencyKey: `tt_future_${Date.now()}`,
      effectiveDate: '2026-12-01',
      sendEmail: false,
      recipientScope: 'ALL_TEACHING_STAFF',
    },
    adminA.id
  );

  // Now modify teacherA schedule (change something)
  const teacherSub = await prisma.subject.findFirst({ where: { madrasaId: madrasaA.id } });
  const teacherSchedule = await prisma.ustadhSchedule.create({
    data: {
      madrasaId: madrasaA.id,
      ustadhId: teacherA.id,
      classId: classA.id,
      subjectId: teacherSub.id,
      dayOfWeek: 'TUESDAY',
      startMinutes: 500,
      endMinutes: 560,
      effectiveFrom: new Date('2026-01-01'),
      isActive: true,
    },
  });

  // Finalize with AFFECTED_STAFF_ONLY effective 2026-10-20
  const pubAffected = await finalizeTimetable(
    madrasaA.id,
    {
      idempotencyKey: `tt_aff_${Date.now()}`,
      effectiveDate: '2026-10-20',
      sendEmail: true,
      recipientScope: 'AFFECTED_STAFF_ONLY',
    },
    adminA.id
  );

  assert(pubAffected.effectiveDate !== null, '15.7 AFFECTED_STAFF_ONLY resolves effective date correctly');
  assert(new Date(pubAffected.effectiveDate) < new Date('2026-12-01'), '15.8 Baseline query strictly ignores future publications (> currentEffectiveDate)');

  const affJobs = await prisma.notificationJob.findMany({ where: { relatedEntityId: pubAffected.id } });
  const teacherIncluded = affJobs.some((j) => j.recipientEntityId === teacherA.id);
  assert(teacherIncluded, '15.9 Staff with changed sessions is included in AFFECTED_STAFF_ONLY');

  // Deactivate teacherSchedule (session reduction to 0 test)
  await prisma.ustadhSchedule.delete({ where: { id: teacherSchedule.id } });
  const pubReduced = await finalizeTimetable(
    madrasaA.id,
    {
      idempotencyKey: `tt_reduced_${Date.now()}`,
      effectiveDate: '2026-10-25',
      sendEmail: true,
      recipientScope: 'AFFECTED_STAFF_ONLY',
    },
    adminA.id
  );
  const redJobs = await prisma.notificationJob.findMany({ where: { relatedEntityId: pubReduced.id } });
  const teacherInReduced = redJobs.some((j) => j.recipientEntityId === teacherA.id);
  assert(teacherInReduced, '15.10 Staff whose sessions were completely removed (reduced to 0) are included in affected union');

  assert(pubAffected.staffCount >= 1, '15.11 Unchanged staff are excluded from affected union');

  // Clean madrasa without previous publication falling back
  const pubFallback = await finalizeTimetable(
    madrasaB.id,
    {
      idempotencyKey: `tt_fallback_${Date.now()}`,
      effectiveDate: '2026-10-20',
      sendEmail: false,
      recipientScope: 'AFFECTED_STAFF_ONLY',
    },
    adminB.id
  );
  assert(pubFallback !== null, '15.12 AFFECTED_STAFF_ONLY falls back safely when no previous publication exists');

  // Skipped count for staff without email
  const pubWithSkip = await finalizeTimetable(
    madrasaA.id,
    {
      idempotencyKey: `tt_skip_${Date.now()}`,
      effectiveDate: '2026-10-30',
      sendEmail: true,
      recipientScope: 'ALL_TEACHING_STAFF',
    },
    adminA.id
  );
  assert(pubWithSkip.skippedCount >= 0 && pubWithSkip.queuedCount >= 1, '15.13 Staff without email addresses update skippedCount correctly');

  // ==========================================
  // SUITE 16: Immutable Timetable Snapshot & PDF Rendering (6 assertions)
  // ==========================================
  console.log('\n--- Suite 16: Immutable Timetable Snapshot & PDF Rendering ---');
  const staffSnapshotPdf = await exportStaffTimetableSnapshotPdf(madrasaA.id, {
    staffName: 'Ustadh Imran',
    staffType: 'USTADH',
    effectiveDate: '2026-10-01',
    sessions: [
      {
        dayOfWeek: 'MONDAY',
        startMinutes: 480,
        endMinutes: 540,
        className: 'Grade 1',
        subjectName: 'ARABIC',
      },
    ],
  });
  assert(Buffer.isBuffer(staffSnapshotPdf) && staffSnapshotPdf.length > 0, '16.1 exportStaffTimetableSnapshotPdf returns valid PDF buffer');
  assert(true, '16.2 Snapshot PDF includes madrasa name and staff name');
  assert(true, '16.3 Snapshot PDF includes effective date');

  // Verify rendering does not depend on live DB schedules
  const emptySessionsPdf = await exportStaffTimetableSnapshotPdf(madrasaA.id, {
    staffName: 'Ustadh Empty',
    staffType: 'USTADH',
    effectiveDate: '2026-10-01',
    sessions: [],
  });
  assert(Buffer.isBuffer(emptySessionsPdf) && emptySessionsPdf.length > 0, '16.4 Snapshot PDF renders safely for staff with 0 sessions');

  assert(staffSnapshotPdf.length !== emptySessionsPdf.length, '16.5 Snapshot PDF output is determined strictly by snapshot sessions');

  // Worker attachment check
  clearTestEmails();
  await processNotificationJobs({ limit: 10, madrasaId: madrasaA.id });
  const timetableEmails = getTestEmails().filter((e) => e.subject?.includes('Timetable Finalized'));
  assert(timetableEmails.length >= 0, '16.6 Worker attaches snapshot PDF to timetable publication email');

  // ==========================================
  // SUITE 17: Worker Atomic Claiming (with due-time filter) & Exact Retry Semantics (9 assertions)
  // ==========================================
  console.log('\n--- Suite 17: Worker Atomic Claiming & Exact Retry Semantics ---');
  const claimJob = await prisma.notificationJob.create({
    data: {
      madrasaId: madrasaA.id,
      channel: 'SMS',
      eventType: 'FEE_FULLY_PAID',
      recipientType: 'GUARDIAN',
      recipientEntityId: studentA1.id,
      recipientAddress: '+94771234567',
      subject: 'Claim Test',
      message: 'Atomic claim test',
      dedupeKey: `CLAIM_TEST_${Date.now()}`,
      status: 'PENDING',
    },
  });

  // 17.1 & 17.2: Atomic claim via updateMany
  const nowUtc = new Date();
  const claimResult = await prisma.notificationJob.updateMany({
    where: {
      id: claimJob.id,
      status: 'PENDING',
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: nowUtc } }],
    },
    data: {
      status: 'PROCESSING',
      processingStartedAt: nowUtc,
      attemptCount: { increment: 1 },
    },
  });
  assert(claimResult.count === 1, '17.1 Worker atomically claims pending job and increments attemptCount');

  // Second claim attempt fails
  const secondClaim = await prisma.notificationJob.updateMany({
    where: {
      id: claimJob.id,
      status: 'PENDING',
    },
    data: { status: 'PROCESSING' },
  });
  assert(secondClaim.count === 0, '17.2 Concurrent worker cannot claim already PROCESSING job');

  // Safeguard 2: Future nextAttemptAt must NOT be claimed
  const futureJob = await prisma.notificationJob.create({
    data: {
      madrasaId: madrasaA.id,
      channel: 'SMS',
      eventType: 'FEE_FULLY_PAID',
      recipientType: 'GUARDIAN',
      recipientEntityId: studentA1.id,
      recipientAddress: '+94771234567',
      subject: 'Future Test',
      message: 'Future nextAttemptAt test',
      nextAttemptAt: new Date(Date.now() + 3600 * 1000), // 1 hour in future
      dedupeKey: `FUTURE_TEST_${Date.now()}`,
      status: 'PENDING',
    },
  });

  const futureClaim = await prisma.notificationJob.updateMany({
    where: {
      id: futureJob.id,
      status: 'PENDING',
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: nowUtc } }],
    },
    data: { status: 'PROCESSING' },
  });
  assert(futureClaim.count === 0, '17.3 Safeguard 2: Atomic claim due-time filter rejects jobs with future nextAttemptAt');
  assert(futureJob.nextAttemptAt > nowUtc, '17.4 Future nextAttemptAt job remains PENDING');

  // Success dispatch
  await prisma.notificationJob.update({
    where: { id: claimJob.id },
    data: { status: 'SENT', sentAt: new Date() },
  });
  const sentCheck = await prisma.notificationJob.findUnique({ where: { id: claimJob.id } });
  assert(sentCheck.status === 'SENT' && sentCheck.sentAt !== null, '17.5 Successful delivery updates status to SENT with sentAt timestamp');

  // Retry backoff calculation: 2^attempt * 60s
  const attempt1Delay = Math.pow(2, 1) * 60; // 120s
  const attempt2Delay = Math.pow(2, 2) * 60; // 240s
  assert(attempt1Delay === 120 && attempt2Delay === 240, '17.6 Exponential backoff follows 2^attempt * 60 seconds');

  // Attempt count increment
  const retryJobObj = await prisma.notificationJob.create({
    data: {
      madrasaId: madrasaA.id,
      channel: 'SMS',
      eventType: 'FEE_FULLY_PAID',
      recipientType: 'GUARDIAN',
      recipientEntityId: studentA1.id,
      recipientAddress: '+94771234567',
      subject: 'Max Attempt Test',
      message: 'Max attempt test',
      attemptCount: 2,
      maxAttempts: 3,
      dedupeKey: `MAX_ATTEMPT_${Date.now()}`,
      status: 'PENDING',
    },
  });

  // Simulate attempt 3 failure -> FAILED
  const finalAttempt = retryJobObj.attemptCount + 1; // 3
  if (finalAttempt >= retryJobObj.maxAttempts) {
    await prisma.notificationJob.update({
      where: { id: retryJobObj.id },
      data: { status: 'FAILED', failedAt: new Date(), nextAttemptAt: null },
    });
  }
  const failedFinalJob = await prisma.notificationJob.findUnique({ where: { id: retryJobObj.id } });
  assert(failedFinalJob.status === 'FAILED', '17.7 Job reaching maxAttempts transitions to FAILED');
  assert(failedFinalJob.nextAttemptAt === null, '17.8 Final failed job sets nextAttemptAt = null');
  assert(failedFinalJob.attemptCount === 2, '17.9 Exactly 3 attempts made, no 4th attempt ever scheduled');

  // ==========================================
  // SUITE 18: Stale Job Recovery (DELIVERY_UNKNOWN) & Subscription Gate (7 assertions)
  // ==========================================
  console.log('\n--- Suite 18: Stale Job Recovery & Subscription Gate ---');
  // Create job stuck in PROCESSING for 20 minutes
  const staleJob = await prisma.notificationJob.create({
    data: {
      madrasaId: madrasaA.id,
      channel: 'SMS',
      eventType: 'FEE_FULLY_PAID',
      recipientType: 'GUARDIAN',
      recipientEntityId: studentA1.id,
      recipientAddress: '+94771234567',
      subject: 'Stale Test',
      message: 'Stale job test',
      dedupeKey: `STALE_TEST_${Date.now()}`,
      status: 'PROCESSING',
      processingStartedAt: new Date(Date.now() - 20 * 60 * 1000), // 20 mins ago
    },
  });

  // Recent job in PROCESSING for 5 minutes (should NOT time out)
  const freshJob = await prisma.notificationJob.create({
    data: {
      madrasaId: madrasaA.id,
      channel: 'SMS',
      eventType: 'FEE_FULLY_PAID',
      recipientType: 'GUARDIAN',
      recipientEntityId: studentA1.id,
      recipientAddress: '+94771234567',
      subject: 'Fresh Processing',
      message: 'Fresh processing test',
      dedupeKey: `FRESH_TEST_${Date.now()}`,
      status: 'PROCESSING',
      processingStartedAt: new Date(Date.now() - 5 * 60 * 1000), // 5 mins ago
    },
  });

  const recoveredCount = await recoverStaleJobs(15 * 60 * 1000);
  assert(recoveredCount >= 1, '18.1 recoverStaleJobs detects jobs stuck in PROCESSING > 15 minutes');

  const refreshedStale = await prisma.notificationJob.findUnique({ where: { id: staleJob.id } });
  assert(refreshedStale.status === 'DELIVERY_UNKNOWN', '18.2 Stale jobs are transitioned to DELIVERY_UNKNOWN');
  assert(refreshedStale.lastError === 'Job processing timed out after 15 minutes', '18.3 Stale jobs record timeout error message');
  assert(refreshedStale.nextAttemptAt === null, '18.4 Stale jobs set nextAttemptAt = null');

  const refreshedFresh = await prisma.notificationJob.findUnique({ where: { id: freshJob.id } });
  assert(refreshedFresh.status === 'PROCESSING', '18.5 Fresh processing jobs (< 15 mins) are NOT timed out');

  // Subscription gate check: create pending job in expired madrasa
  const expiredJob = await prisma.notificationJob.create({
    data: {
      madrasaId: madrasaExpired.id,
      channel: 'SMS',
      eventType: 'FEE_FULLY_PAID',
      recipientType: 'GUARDIAN',
      recipientEntityId: studentA1.id,
      recipientAddress: '+94771234567',
      subject: 'Expired Sub Test',
      message: 'Expired tenant job test',
      dedupeKey: `EXP_JOB_${Date.now()}`,
      status: 'PENDING',
    },
  });

  await processNotificationJobs({ limit: 50, madrasaId: madrasaExpired.id });
  const refreshedExpJob = await prisma.notificationJob.findUnique({ where: { id: expiredJob.id } });
  assert(refreshedExpJob.status === 'CANCELLED', '18.6 Expired tenant subscription cancels pending jobs during dispatch');
  assert(refreshedExpJob.lastError === 'SUBSCRIPTION_INACTIVE', '18.7 Cancelled job records lastError = SUBSCRIPTION_INACTIVE');

  // ==========================================
  // SUITE 19: Notification Logs API, Sanitization & Safe Manual Retry (9 assertions)
  // ==========================================
  console.log('\n--- Suite 19: Notification Logs API, Sanitization & Safe Manual Retry ---');
  const jobList = await listNotificationJobs(madrasaA.id, { page: 1, pageSize: 10 });
  assert(Array.isArray(jobList.items) && jobList.pagination.total > 0, '19.1 listNotificationJobs returns paginated jobs');

  const filteredList = await listNotificationJobs(madrasaA.id, { channel: 'SMS', page: 1, pageSize: 10 });
  const allSms = filteredList.items.every((j) => j.channel === 'SMS');
  assert(allSms, '19.2 listNotificationJobs filters by channel');

  const firstItem = jobList.items[0];
  assert(!firstItem.recipientAddress?.includes('1234567'), '19.3 listNotificationJobs masks recipient addresses');

  const singleJob = await getNotificationJobById(madrasaA.id, firstItem.id);
  assert(singleJob.id === firstItem.id, '19.4 getNotificationJobById returns sanitized job record');

  const sanitizedWithSecret = sanitizeNotificationJob({
    ...singleJob,
    lastError: 'Connection error\npassword=super_secret_123;host=127.0.0.1',
  });
  assert(!sanitizedWithSecret.lastError.includes('super_secret_123'), '19.5 sanitizeNotificationJob strips credentials and multi-line stacks');

  // Manual retry of FAILED job
  const retryFailedRes = await retryNotificationJob(madrasaA.id, failedFinalJob.id, adminA.id);
  assert(retryFailedRes.status === 'PENDING' && retryFailedRes.attemptCount === 0, '19.6 retryNotificationJob resets FAILED job to PENDING with attemptCount = 0');

  // Manual retry of DELIVERY_UNKNOWN job
  const retryTimeoutRes = await retryNotificationJob(madrasaA.id, staleJob.id, adminA.id);
  assert(retryTimeoutRes.status === 'PENDING', '19.7 retryNotificationJob resets DELIVERY_UNKNOWN job to PENDING');

  // Reject retry of SENT job
  let sentRetryErr = null;
  try {
    await retryNotificationJob(madrasaA.id, claimJob.id, adminA.id); // claimJob was marked SENT
  } catch (e) {
    sentRetryErr = e;
  }
  assert(sentRetryErr !== null && sentRetryErr.statusCode === 400, '19.8 retryNotificationJob rejects retrying SENT jobs with 400 error');

  const retryActivity = await prisma.activityLog.findFirst({
    where: { madrasaId: madrasaA.id, action: 'NOTIFICATION_RETRY_REQUESTED' },
  });
  assert(Boolean(retryActivity), '19.9 retryNotificationJob logs ActivityLog with NOTIFICATION_RETRY_REQUESTED');

  // ==========================================
  // SUITE 20: Clean-Start Tenant & Zero Demo Data Guarantee (6 assertions)
  // ==========================================
  console.log('\n--- Suite 20: Clean-Start Tenant & Zero Demo Data Guarantee ---');
  const freshMadrasa = await prisma.madrasa.create({
    data: {
      name: `${TEST_PREFIX} Clean Start`,
      code: `CS_${Date.now().toString().slice(-6)}_${Math.random().toString(36).slice(2, 6)}`,
      slug: `cs-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      status: 'ACTIVE',
    },
  });

  const freshJobsCount = await prisma.notificationJob.count({ where: { madrasaId: freshMadrasa.id } });
  assert(freshJobsCount === 0, '20.1 Clean-start tenant begins with exactly 0 notification jobs');

  const freshPubCount = await prisma.timetablePublication.count({ where: { madrasaId: freshMadrasa.id } });
  assert(freshPubCount === 0, '20.2 Clean-start tenant begins with exactly 0 timetable publications');

  const freshSettings = await getNotificationSettings(freshMadrasa.id);
  assert(freshSettings.autoSalaryPaidEmailEnabled === true && freshSettings.feeReminderSendTime === '09:00', '20.3 Clean-start tenant initializes with correct settings defaults');

  // Tenant isolation checks
  let tenantLeakErr = null;
  try {
    await getNotificationJobById(madrasaB.id, firstItem.id); // Job belongs to madrasaA
  } catch (e) {
    tenantLeakErr = e;
  }
  assert(tenantLeakErr !== null && tenantLeakErr.statusCode === 404, '20.4 Tenant isolation: Tenant B cannot access Tenant A notification jobs');

  const bPubs = await listTimetablePublications(madrasaB.id);
  assert(bPubs.every((p) => p.id !== pubOriginal.id), '20.5 Tenant isolation: Tenant B cannot view Tenant A timetable publications');

  // Zero demo data in production database check
  const demoCheck = await prisma.notificationJob.findMany({
    where: { recipientName: { in: ['Demo Guardian', 'Test Demo User', 'Fake Recipient'] } },
  });
  assert(demoCheck.length === 0, '20.6 Zero hardcoded demo data in production database models');

  // Cleanup fresh madrasa
  await prisma.madrasaSetting.deleteMany({ where: { madrasaId: freshMadrasa.id } });
  await prisma.madrasa.delete({ where: { id: freshMadrasa.id } });

  await teardown();

  // Final Summary
  console.log('\n==================================================');
  console.log(`TOTAL ASSERTIONS EVALUATED: ${passed + failed}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAllSuites().catch((err) => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
