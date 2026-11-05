import './setup-test-env.js';
import sharp from 'sharp';
import { prisma } from '../src/lib/prisma.js';
import { hashPassword } from '../src/utils/password.js';
import { signAccessToken } from '../src/utils/jwt.js';
import {
  enableTestMode,
  getTestEmails,
  clearTestEmails,
} from '../src/services/email.service.js';
import { setTestStorageAdapter } from '../src/services/r2.service.js';
import { createStudentQualification } from '../src/services/student-records.service.js';
import {
  processNotificationJobs,
  processFollowUpReminders,
} from '../src/jobs/notification-worker.job.js';
import app from '../src/app.js';

const TEST_PREFIX = `stud_rec_${Date.now()}`;
const SLUG_BASE = `sr${Date.now().toString().slice(-8)}`;

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

let testServer = null;
let baseUrl = '';

// R2 Mock Storage State
const uploadedR2Objects = new Map();
const deletedR2ObjectKeys = [];

let madrasaA = null;
let adminA = null;
let tokenA = '';
let sectionA = null;
let classA = null;
let studentA = null;
let ustadhA = null;

let madrasaB = null;
let adminB = null;
let tokenB = '';
let sectionB = null;
let classB = null;
let studentB = null;
let ustadhB = null;

let sampleJpegBuffer = null;
let samplePngBuffer = null;
let samplePdfBuffer = null;

async function setup() {
  console.log('\n--- Setting up Student Records & Follow-Up Test Fixtures ---');
  enableTestMode(true);
  clearTestEmails();

  setTestStorageAdapter({
    uploadBuffer: async (key, buffer, contentType) => {
      uploadedR2Objects.set(key, {
        size: buffer.length,
        contentType,
      });
    },
    deleteObject: async (key) => {
      uploadedR2Objects.delete(key);
      deletedR2ObjectKeys.push(key);
    },
    resolveDocumentUrl: async (key, options = {}) => {
      const mode = options.mode === 'download' ? 'attachment' : 'inline';
      return `https://r2-private.madrasanexa.test/${key}?X-Amz-Expires=${options.expiresIn || 120}&disposition=${mode}`;
    },
  });

  sampleJpegBuffer = await sharp({
    create: { width: 16, height: 16, channels: 3, background: { r: 20, g: 120, b: 80 } },
  }).jpeg().toBuffer();

  samplePngBuffer = await sharp({
    create: { width: 16, height: 16, channels: 3, background: { r: 40, g: 80, b: 180 } },
  }).png().toBuffer();

  samplePdfBuffer = Buffer.from(
    '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 612 792]>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000010 00000 n \n0000000060 00000 n \n0000000117 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF'
  );

  const plan = await prisma.plan.upsert({
    where: { code: `PLN_${TEST_PREFIX.slice(-6).toUpperCase()}` },
    create: {
      name: `Plan ${TEST_PREFIX}`,
      code: `PLN_${TEST_PREFIX.slice(-6).toUpperCase()}`,
      description: 'Test subscription plan',
      price: 15000,
      durationMonths: 12,
      isActive: true,
    },
    update: {},
  });

  const now = new Date();

  // Create Tenant A
  madrasaA = await prisma.madrasa.create({
    data: {
      name: 'Madrasa Al-Huda A',
      code: `${TEST_PREFIX.slice(-5).toUpperCase()}A`,
      slug: `${SLUG_BASE}-a`,
      email: `${TEST_PREFIX}_a@example.com`,
      phone: '+94771112233',
      status: 'ACTIVE',
    },
  });

  await prisma.subscription.create({
    data: {
      madrasaId: madrasaA.id,
      planId: plan.id,
      status: 'ACTIVE',
      startsAt: new Date(now.getTime() - 30 * 86400000),
      endsAt: new Date(now.getTime() + 300 * 86400000),
      priceAtPurchase: 15000,
      durationMonthsAtPurchase: 12,
    },
  });

  await prisma.madrasaSetting.create({
    data: {
      madrasaId: madrasaA.id,
      timezone: 'Asia/Colombo',
      currency: 'LKR',
      feeReminderSendTime: '23:59', // Intentionally late to prove follow-up reminders do NOT use feeReminderSendTime
    },
  });

  adminA = await prisma.user.create({
    data: {
      madrasaId: madrasaA.id,
      name: 'Principal A',
      email: `${TEST_PREFIX}_admin_a@example.com`,
      passwordHash: await hashPassword('Pass123!'),
      role: 'MADRASA_ADMIN',
      isActive: true,
      mustChangePassword: false,
    },
  });

  tokenA = signAccessToken({
    userId: adminA.id,
    role: adminA.role,
    madrasaId: madrasaA.id,
    email: adminA.email,
  });

  classA = await prisma.class.create({
    data: {
      madrasaId: madrasaA.id,
      name: 'Hifz Class 1',
      code: `HC1_${Date.now().toString().slice(-4)}`,
      defaultMonthlyFee: 2500,
      isActive: true,
    },
  });

  studentA = await prisma.student.create({
    data: {
      madrasaId: madrasaA.id,
      classId: classA.id,
      admissionNo: `ADM-A-${Date.now().toString().slice(-5)}`,
      fullName: 'Zaid Ibn Thabit',
      admissionDate: new Date('2025-01-15T00:00:00.000Z'),
      status: 'ACTIVE',
      guardianName: 'Thabit Al-Ansari',
      guardianPhone: '+94771234567',
      guardianEmail: `${TEST_PREFIX}_guardian_a@example.com`,
      monthlyFee: 2500,
    },
  });

  ustadhA = await prisma.ustadh.create({
    data: {
      madrasaId: madrasaA.id,
      ustadhCode: `UST-A-${Date.now().toString().slice(-4)}`,
      fullName: 'Qari Abdul Basit',
      phoneNumber: '+94772223344',
      email: `${TEST_PREFIX}_ustadh_a@example.com`,
      staffType: 'USTADH',
      joinDate: new Date('2024-01-01T00:00:00.000Z'),
      baseMonthlySalary: 45000,
      isActive: true,
    },
  });

  // Create Tenant B
  madrasaB = await prisma.madrasa.create({
    data: {
      name: 'Madrasa Darul Uloom B',
      code: `${TEST_PREFIX.slice(-5).toUpperCase()}B`,
      slug: `${SLUG_BASE}-b`,
      email: `${TEST_PREFIX}_b@example.com`,
      phone: '+94779998877',
      status: 'ACTIVE',
    },
  });

  await prisma.subscription.create({
    data: {
      madrasaId: madrasaB.id,
      planId: plan.id,
      status: 'ACTIVE',
      startsAt: new Date(now.getTime() - 30 * 86400000),
      endsAt: new Date(now.getTime() + 300 * 86400000),
      priceAtPurchase: 15000,
      durationMonthsAtPurchase: 12,
    },
  });

  await prisma.madrasaSetting.create({
    data: {
      madrasaId: madrasaB.id,
      timezone: 'Asia/Colombo',
      currency: 'LKR',
    },
  });

  adminB = await prisma.user.create({
    data: {
      madrasaId: madrasaB.id,
      name: 'Principal B',
      email: `${TEST_PREFIX}_admin_b@example.com`,
      passwordHash: await hashPassword('Pass123!'),
      role: 'MADRASA_ADMIN',
      isActive: true,
      mustChangePassword: false,
    },
  });

  tokenB = signAccessToken({
    userId: adminB.id,
    role: adminB.role,
    madrasaId: madrasaB.id,
    email: adminB.email,
  });

  classB = await prisma.class.create({
    data: {
      madrasaId: madrasaB.id,
      name: 'Class B1',
      code: `CB1_${Date.now().toString().slice(-4)}`,
      defaultMonthlyFee: 2000,
      isActive: true,
    },
  });

  studentB = await prisma.student.create({
    data: {
      madrasaId: madrasaB.id,
      classId: classB.id,
      admissionNo: `ADM-B-${Date.now().toString().slice(-5)}`,
      fullName: 'Student B',
      admissionDate: new Date('2025-02-01T00:00:00.000Z'),
      status: 'ACTIVE',
      guardianName: 'Guardian B',
      guardianPhone: '+94778889900',
      monthlyFee: 2000,
    },
  });

  ustadhB = await prisma.ustadh.create({
    data: {
      madrasaId: madrasaB.id,
      ustadhCode: `UST-B-${Date.now().toString().slice(-4)}`,
      fullName: 'Ustadh B',
      phoneNumber: '+94775556677',
      email: `${TEST_PREFIX}_ustadh_b@example.com`,
      staffType: 'USTADH',
      joinDate: new Date('2024-01-01T00:00:00.000Z'),
      baseMonthlySalary: 40000,
      isActive: true,
    },
  });

  await new Promise((resolve) => {
    testServer = app.listen(0, () => {
      const port = testServer.address().port;
      baseUrl = `http://localhost:${port}/api/madrasa-admin`;
      console.log(`Test server listening at ${baseUrl}`);
      resolve();
    });
  });
}

async function teardown() {
  if (testServer) {
    await new Promise((resolve) => testServer.close(resolve));
  }
  setTestStorageAdapter(null);
}

async function runTests() {
  await setup();

  try {
    // =========================================================================
    // GROUP 1: QUALIFICATIONS, ACHIEVEMENTS, QIRAATH & CERTIFICATE VERIFICATION
    // =========================================================================
    console.log('\n--- Group 1: Qualifications, Achievements, QIRAATH & Certificate Verification ---');

    // 1. Create a QIRAATH qualification with IN_PROGRESS status and PENDING verification + PDF certificate
    const qForm1 = new FormData();
    qForm1.append('recordType', 'QUALIFICATION');
    qForm1.append('category', 'QIRAATH');
    qForm1.append('title', 'Sab’ah Qiraath Track — Level 1');
    qForm1.append('issuingAuthority', 'Madrasa Al-Huda Board');
    qForm1.append('certificateNumber', 'QIR-2026-001');
    qForm1.append('progressStatus', 'IN_PROGRESS');
    qForm1.append('verificationStatus', 'PENDING');
    qForm1.append('achievedDate', '2026-05-10');
    qForm1.append('gradeOrScore', 'Mumtaz (96%)');
    qForm1.append('description', 'Completed Riwayat Hafs and Warsh modules.');
    qForm1.append('examinerUstadhId', ustadhA.id);
    qForm1.append('certificate', new Blob([samplePdfBuffer], { type: 'application/pdf' }), 'qiraath-cert.pdf');

    const createQ1Res = await fetch(`${baseUrl}/students/${studentA.id}/qualifications`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: qForm1,
    });
    assert(createQ1Res.status === 201, '1. Create QIRAATH qualification with PDF certificate returns HTTP 201');
    const createQ1Json = await createQ1Res.json();
    const qual1 = createQ1Json.data;
    assert(qual1.category === 'QIRAATH', '2. Qualification category is QIRAATH');
    assert(qual1.progressStatus === 'IN_PROGRESS', '3. Qualification progressStatus is IN_PROGRESS');
    assert(qual1.verificationStatus === 'PENDING', '4. Certificate verificationStatus is PENDING');
    assert(qual1.hasCertificateFile === true, '5. Certificate file is attached');

    // Verify FileObject in DB has publicUrl === null and tenant-isolated key
    const certFileObj = await prisma.fileObject.findUnique({ where: { id: qual1.certificateFileId } });
    assert(certFileObj && certFileObj.publicUrl === null, '6. Certificate FileObject has publicUrl === null (strictly private)');
    assert(
      certFileObj.objectKey.startsWith(`madrasas/${madrasaA.id}/documents/cert-${studentA.id}-`),
      '7. Certificate objectKey follows madrasas/{madrasaId}/documents/ convention'
    );

    // 2. Rejecting certificate without rejectionReason must fail with 400
    const rejectNoReasonRes = await fetch(
      `${baseUrl}/students/${studentA.id}/qualifications/${qual1.id}/verify`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          verificationStatus: 'REJECTED',
        }),
      }
    );
    assert(rejectNoReasonRes.status === 400, '8. Rejecting certificate without rejectionReason fails with HTTP 400');

    // 3. Rejecting certificate with rejectionReason records reviewer, timestamp, and reason while preserving progressStatus
    const rejectWithReasonRes = await fetch(
      `${baseUrl}/students/${studentA.id}/qualifications/${qual1.id}/verify`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          verificationStatus: 'REJECTED',
          rejectionReason: 'Seal of examiner is missing on page 2.',
        }),
      }
    );
    assert(rejectWithReasonRes.status === 200, '9. Rejecting certificate with reason returns HTTP 200');
    const rejectedQual = (await rejectWithReasonRes.json()).data;
    assert(rejectedQual.verificationStatus === 'REJECTED', '10. verificationStatus is REJECTED');
    assert(rejectedQual.progressStatus === 'IN_PROGRESS', '11. progressStatus remains IN_PROGRESS independently');
    assert(rejectedQual.reviewedByUserId === adminA.id, '12. reviewedByUserId recorded as Madrasa Admin');
    assert(Boolean(rejectedQual.reviewedAt), '13. reviewedAt timestamp recorded');
    assert(
      rejectedQual.rejectionReason === 'Seal of examiner is missing on page 2.',
      '14. rejectionReason stored accurately'
    );

    // 4. Verify certificate and update progressStatus to COMPLETED
    const updateProgRes = await fetch(
      `${baseUrl}/students/${studentA.id}/qualifications/${qual1.id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          progressStatus: 'COMPLETED',
          verificationStatus: 'VERIFIED',
        }),
      }
    );
    assert(updateProgRes.status === 200, '15. Updating progressStatus to COMPLETED and verificationStatus to VERIFIED succeeds');
    const verifiedQual = (await updateProgRes.json()).data;
    assert(verifiedQual.progressStatus === 'COMPLETED', '16. progressStatus updated to COMPLETED');
    assert(verifiedQual.verificationStatus === 'VERIFIED', '17. verificationStatus updated to VERIFIED');
    assert(verifiedQual.rejectionReason === null, '18. rejectionReason cleared when VERIFIED');

    // 5. Secure Presigned URL access for certificate (inline & download)
    const certInlineRes = await fetch(
      `${baseUrl}/students/${studentA.id}/qualifications/${qual1.id}/certificate?mode=inline`,
      {
        headers: { Authorization: `Bearer ${tokenA}` },
      }
    );
    assert(certInlineRes.status === 200, '19. Authorized Madrasa Admin gets presigned certificate URL (HTTP 200)');
    const certInlineData = (await certInlineRes.json()).data;
    assert(
      certInlineData.url.includes('X-Amz-Expires=120') && certInlineData.url.includes('disposition=inline'),
      '20. Presigned certificate URL has 120s expiry and inline disposition'
    );

    const certDownloadRes = await fetch(
      `${baseUrl}/students/${studentA.id}/qualifications/${qual1.id}/certificate?mode=download`,
      {
        headers: { Authorization: `Bearer ${tokenA}` },
      }
    );
    const certDownloadData = (await certDownloadRes.json()).data;
    assert(
      certDownloadData.url.includes('disposition=attachment'),
      '21. Download mode returns attachment disposition URL'
    );

    // 6. Create an ACHIEVEMENT record
    const achRes = await fetch(`${baseUrl}/students/${studentA.id}/qualifications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        recordType: 'ACHIEVEMENT',
        category: 'AWARD_ACHIEVEMENT',
        title: '1st Place — National Qiraath Competition',
        progressStatus: 'COMPLETED',
        verificationStatus: 'VERIFIED',
        achievedDate: '2026-06-01',
      }),
    });
    assert(achRes.status === 201, '22. Creating ACHIEVEMENT record succeeds (HTTP 201)');

    // 7. Reject invalid file types (SVG) on certificate upload
    const badCertForm = new FormData();
    badCertForm.append('title', 'Invalid Cert Upload');
    badCertForm.append('category', 'TAJWEED');
    badCertForm.append('certificate', new Blob(['<svg><script>alert(1)</script></svg>'], { type: 'image/svg+xml' }), 'bad.svg');
    const badCertRes = await fetch(`${baseUrl}/students/${studentA.id}/qualifications`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: badCertForm,
    });
    assert(badCertRes.status === 400, '23. Malicious SVG certificate upload rejected with HTTP 400');

    // 8. Test R2 Orphan Cleanup if DB persistence fails after R2 upload succeeds
    const r2CountBeforeFailure = uploadedR2Objects.size;
    const deletedCountBeforeFailure = deletedR2ObjectKeys.length;
    let dbFailedAsExpected = false;
    try {
      await createStudentQualification(
        madrasaA.id,
        studentA.id,
        { title: 'Orphan Cleanup Test', category: 'HIFZ_JUZ' },
        { buffer: sampleJpegBuffer, originalname: 'orphan-test.jpg' },
        { userId: 'non_existent_user_id_fk_fail' }
      );
    } catch {
      dbFailedAsExpected = true;
    }
    assert(dbFailedAsExpected === true, '24. DB persistence failure after R2 upload throws as expected');
    assert(
      uploadedR2Objects.size === r2CountBeforeFailure && deletedR2ObjectKeys.length === deletedCountBeforeFailure + 1,
      '25. Orphaned R2 object was automatically cleaned up when DB transaction failed'
    );

    // =========================================================================
    // GROUP 2: STUDENT DISCIPLINE & INCIDENT RECORDS
    // =========================================================================
    console.log('\n--- Group 2: Discipline & Incident Records (Date/Time, Evidence & Unconfirmed vs Confirmed vs Dismissed) ---');

    // 1. Create an unconfirmed incident report with full date+time and private PNG evidence
    const incForm1 = new FormData();
    incForm1.append('title', 'Late return from break');
    incForm1.append('category', 'ATTENDANCE_TARDINESS');
    incForm1.append('severity', 'LOW');
    incForm1.append('occurredAt', '2026-07-12T10:45:30.000Z');
    incForm1.append('location', 'Courtyard Gate');
    incForm1.append('reportedDescription', 'Student arrived 15 minutes after break bell.');
    incForm1.append('reportedByUstadhId', ustadhA.id);
    incForm1.append('verificationStatus', 'REPORTED');
    incForm1.append('evidence', new Blob([samplePngBuffer], { type: 'image/png' }), 'gate-log.png');

    const inc1Res = await fetch(`${baseUrl}/students/${studentA.id}/incidents`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: incForm1,
    });
    assert(inc1Res.status === 201, '26. Create REPORTED incident with full occurredAt timestamp and PNG evidence returns HTTP 201');
    const inc1 = (await inc1Res.json()).data;
    assert(inc1.occurredAt === '2026-07-12T10:45:30.000Z', '27. Full incident date and time (occurredAt) preserved accurately');
    assert(inc1.verificationStatus === 'REPORTED', '28. Initial incident status is REPORTED');
    assert(inc1.isUnconfirmedReport === true && inc1.isConfirmedMisconduct === false, '29. Unconfirmed report flags are accurate');
    assert(inc1.hasEvidenceFile === true, '30. Incident private evidence file attached');

    // 2. Secure presigned URL access for incident evidence
    const evUrlRes = await fetch(
      `${baseUrl}/students/${studentA.id}/incidents/${inc1.id}/evidence?mode=inline`,
      {
        headers: { Authorization: `Bearer ${tokenA}` },
      }
    );
    assert(evUrlRes.status === 200, '31. Authorized admin gets presigned URL for incident evidence');
    const evUrlData = (await evUrlRes.json()).data;
    assert(evUrlData.url.includes('X-Amz-Expires=120'), '32. Incident evidence URL has 120s expiry');

    // 3. Attempting to mark CONFIRMED without investigatedFindings must fail with 400
    const confirmNoFindingsRes = await fetch(
      `${baseUrl}/students/${studentA.id}/incidents/${inc1.id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          verificationStatus: 'CONFIRMED',
        }),
      }
    );
    assert(
      confirmNoFindingsRes.status === 400,
      '33. Marking incident CONFIRMED without investigatedFindings is rejected with HTTP 400'
    );

    // 4. Confirm incident with investigatedFindings and actionTaken (preserving original reportedDescription)
    const confirmRes = await fetch(
      `${baseUrl}/students/${studentA.id}/incidents/${inc1.id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          verificationStatus: 'CONFIRMED',
          investigatedFindings: 'Verified with gate register; student was delayed by 15 minutes.',
          actionTaken: 'Verbal reminder issued by Ustadh.',
          guardianNotified: true,
        }),
      }
    );
    assert(confirmRes.status === 200, '34. Confirming incident with investigatedFindings succeeds');
    const confirmedInc = (await confirmRes.json()).data;
    assert(
      confirmedInc.reportedDescription === 'Student arrived 15 minutes after break bell.',
      '35. Original reportedDescription is preserved separately'
    );
    assert(
      confirmedInc.investigatedFindings === 'Verified with gate register; student was delayed by 15 minutes.',
      '36. Investigated findings stored separately from original report'
    );
    assert(
      confirmedInc.actionTaken === 'Verbal reminder issued by Ustadh.',
      '37. Action taken stored separately'
    );
    assert(
      confirmedInc.isConfirmedMisconduct === true &&
        confirmedInc.isResolved === false &&
        confirmedInc.isUnconfirmedReport === false,
      '38. Confirmed incident is marked as confirmed misconduct (and isResolved === false)'
    );

    // 5. Attempting to mark incident as DISMISSED without explicit dismissalReason must fail with 400
    const dismissNoReasonRes = await fetch(`${baseUrl}/students/${studentA.id}/incidents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        title: 'Noise complaint with no dismissal reason',
        category: 'BEHAVIOR_CONDUCT',
        severity: 'LOW',
        occurredAt: '2026-07-14T10:00:00.000Z',
        reportedDescription: 'Reported noise in hall.',
        verificationStatus: 'DISMISSED',
      }),
    });
    assert(
      dismissNoReasonRes.status === 400,
      '39. Creating DISMISSED incident without explicit dismissalReason fails with HTTP 400'
    );

    // 6. Create a second incident and DISMISS it with explicit dismissalReason; verify dismissed incident is NEVER counted as confirmed misconduct
    const inc2CreateRes = await fetch(`${baseUrl}/students/${studentA.id}/incidents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        title: 'Alleged classroom noise',
        category: 'BEHAVIOR_CONDUCT',
        severity: 'LOW',
        occurredAt: '2026-07-15T14:20:00.000Z',
        reportedDescription: 'Reported noise from back row.',
        verificationStatus: 'DISMISSED',
        dismissalReason: 'Mistaken identity; student was in the library at 14:20.',
      }),
    });
    assert(inc2CreateRes.status === 201, '40. Creating DISMISSED incident with dismissalReason succeeds');
    const dismissedInc = (await inc2CreateRes.json()).data;
    assert(
      dismissedInc.isDismissed === true &&
        dismissedInc.isConfirmedMisconduct === false &&
        dismissedInc.isResolved === false &&
        dismissedInc.isUnconfirmedReport === false,
      '41. Dismissed incident has isConfirmedMisconduct === false, isResolved === false, and isDismissed === true'
    );

    // 7. Attempting to update incident to DISMISSED without dismissalReason must fail with 400
    const updateDismissNoReasonRes = await fetch(
      `${baseUrl}/students/${studentA.id}/incidents/${inc1.id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          verificationStatus: 'DISMISSED',
          dismissalReason: '',
        }),
      }
    );
    assert(
      updateDismissNoReasonRes.status === 400,
      '42. Updating incident to DISMISSED without dismissalReason is rejected with HTTP 400'
    );

    // 8. Create a 3rd incident left as UNDER_REVIEW
    await fetch(`${baseUrl}/students/${studentA.id}/incidents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        title: 'Missing homework notebook',
        category: 'OTHER',
        severity: 'LOW',
        occurredAt: '2026-07-16T09:00:00.000Z',
        reportedDescription: 'Student forgot notebook.',
        verificationStatus: 'UNDER_REVIEW',
      }),
    });

    // 9. Create a 4th incident with verificationStatus: RESOLVED; verify RESOLVED alone never implies proven misconduct!
    const inc4CreateRes = await fetch(`${baseUrl}/students/${studentA.id}/incidents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        title: 'Dispute over library seat',
        category: 'BEHAVIOR_CONDUCT',
        severity: 'LOW',
        occurredAt: '2026-07-17T11:00:00.000Z',
        reportedDescription: 'Two students argued over desk assignment.',
        verificationStatus: 'RESOLVED',
        actionTaken: 'Mediated by Ustadh; mutual apology agreed.',
      }),
    });
    assert(inc4CreateRes.status === 201, '43. Creating RESOLVED incident succeeds with HTTP 201');
    const resolvedInc = (await inc4CreateRes.json()).data;
    assert(
      resolvedInc.verificationStatus === 'RESOLVED' &&
        resolvedInc.isResolved === true &&
        resolvedInc.isConfirmedMisconduct === false &&
        resolvedInc.isDismissed === false,
      '44. RESOLVED incident has isResolved === true and isConfirmedMisconduct === false (never implies proven misconduct)'
    );

    const listIncRes = await fetch(`${baseUrl}/students/${studentA.id}/incidents`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const listIncData = (await listIncRes.json()).data;
    assert(listIncData.summary.confirmedCount === 1, '45. Summary confirmedCount includes ONLY confirmed misconduct (1)');
    assert(listIncData.summary.resolvedCount === 1, '46. Summary resolvedCount tracks RESOLVED incidents separately (1)');
    assert(listIncData.summary.unconfirmedCount === 1, '47. Summary unconfirmedCount includes REPORTED/UNDER_REVIEW (1)');
    assert(listIncData.summary.dismissedCount === 1, '48. Summary dismissedCount is tracked separately (1) and excluded from misconduct');
    assert(listIncData.summary.total === 4, '49. Summary total matches all 4 logged incidents');

    // =========================================================================
    // GROUP 3: STUDENT & GUARDIAN MEETINGS
    // =========================================================================
    console.log('\n--- Group 3: Student & Guardian Meetings ---');

    const meetCreateRes = await fetch(`${baseUrl}/students/${studentA.id}/meetings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        meetingType: 'GUARDIAN_CONFERENCE',
        title: 'Mid-Year Qiraath & Conduct Review with Guardian',
        meetingAt: '2026-07-18T11:30:00.000Z',
        location: 'Principal Office',
        participantsSummary: 'Guardian Thabit Al-Ansari, Qari Abdul Basit, Principal A',
        ustadhId: ustadhA.id,
        incidentId: inc1.id,
        discussionNotes: 'Reviewed Qiraath progress and punctuality after break.',
        outcomeSummary: 'Guardian agreed to reinforce morning and break-time punctuality.',
      }),
    });
    assert(meetCreateRes.status === 201, '44. Creating StudentMeeting returns HTTP 201');
    const meeting1 = (await meetCreateRes.json()).data;
    assert(meeting1.meetingAt === '2026-07-18T11:30:00.000Z', '45. Meeting date/time preserved');
    assert(meeting1.ustadh?.id === ustadhA.id, '46. Participating Ustadh linked');
    assert(meeting1.incident?.id === inc1.id, '47. Linked incident attached to meeting');

    // =========================================================================
    // GROUP 4: FOLLOW-UPS, REMINDERS, DEDUPLICATION, RESCHEDULING & CANCELLATION
    // =========================================================================
    console.log('\n--- Group 4: Follow-Ups, Reminders, Rescheduling & Dashboard Summary ---');
    clearTestEmails();

    // 1. Create a follow-up assigned to Ustadh A with a future reminderAt timestamp
    const futureReminder = new Date(Date.now() + 2 * 3600 * 1000).toISOString();
    const fu1CreateRes = await fetch(`${baseUrl}/students/${studentA.id}/follow-ups`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        title: 'Review 2-week punctuality log',
        notes: 'Check gate attendance for 14 consecutive days.',
        dueDate: '2026-07-25',
        reminderAt: futureReminder,
        priority: 'HIGH',
        incidentId: inc1.id,
        meetingId: meeting1.id,
        assignedToUstadhId: ustadhA.id,
      }),
    });
    assert(fu1CreateRes.status === 201, '48. Creating StudentFollowUp returns HTTP 201');
    const fu1 = (await fu1CreateRes.json()).data;
    assert(fu1.reminderAt === futureReminder, '49. Follow-up reminderAt timestamp stored');

    // Verify immediate FOLLOW_UP_ASSIGNED NotificationJob was created
    const assignJobs = await prisma.notificationJob.findMany({
      where: {
        madrasaId: madrasaA.id,
        relatedEntityType: 'StudentFollowUp',
        relatedEntityId: fu1.id,
        eventType: 'FOLLOW_UP_ASSIGNED',
      },
    });
    assert(assignJobs.length === 1, '50. FOLLOW_UP_ASSIGNED notification job created on assignment');

    // Process worker jobs to deliver FOLLOW_UP_ASSIGNED email
    await processNotificationJobs();
    const sentAfterAssign = getTestEmails();
    assert(
      sentAfterAssign.some((e) => e.to === ustadhA.email && e.subject.includes('Follow-Up Assigned')),
      '51. FOLLOW_UP_ASSIGNED email delivered to assigned Ustadh'
    );

    // 2. Verify future reminder is NOT enqueued before reminderAt arrives (even if processFollowUpReminders runs now)
    const beforeDueScan = await processFollowUpReminders(new Date());
    const reminderJobsBeforeDue = await prisma.notificationJob.findMany({
      where: {
        madrasaId: madrasaA.id,
        relatedEntityType: 'StudentFollowUp',
        relatedEntityId: fu1.id,
        eventType: 'FOLLOW_UP_REMINDER',
      },
    });
    assert(
      reminderJobsBeforeDue.length === 0 && beforeDueScan.enqueuedCount === 0,
      '52. Future-dated reminder is NOT sent before its actual reminderAt timestamp'
    );

    // 3. Advance referenceDate to reminderAt (note: MadrasaA has feeReminderSendTime = 23:59, proving reminderAt is used directly!)
    clearTestEmails();
    const atReminderTime = new Date(new Date(futureReminder).getTime() + 1000);
    const dueScan = await processFollowUpReminders(atReminderTime);
    assert(dueScan.enqueuedCount === 1, '53. processFollowUpReminders enqueues job when reminderAt <= referenceDate');

    // Verify duplicate scan at same timestamp does not create duplicate job
    const duplicateScan = await processFollowUpReminders(atReminderTime);
    assert(duplicateScan.enqueuedCount === 0, '54. Deduplication key prevents duplicate reminder jobs for the same schedule');

    // Dispatch reminder email and verify reminderSentAt is stamped
    await processNotificationJobs();
    const fuAfterReminder = await prisma.studentFollowUp.findUnique({ where: { id: fu1.id } });
    assert(
      Boolean(fuAfterReminder.reminderSentAt),
      '55. StudentFollowUp.reminderSentAt is stamped after reminder email delivery'
    );
    assert(
      getTestEmails().some((e) => e.to === ustadhA.email && e.subject.includes('Follow-Up Reminder')),
      '56. FOLLOW_UP_REMINDER email delivered to assigned Ustadh'
    );

    // 4. Reschedule reminderAt to a new timestamp -> must reset reminderSentAt and allow new reminder without suppression
    clearTestEmails();
    const rescheduledReminder = new Date(Date.now() + 4 * 3600 * 1000).toISOString();
    const reschedRes = await fetch(
      `${baseUrl}/students/${studentA.id}/follow-ups/${fu1.id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          reminderAt: rescheduledReminder,
        }),
      }
    );
    assert(reschedRes.status === 200, '57. Rescheduling follow-up reminderAt succeeds');
    const reschedFu = (await reschedRes.json()).data;
    assert(
      reschedFu.reminderAt === rescheduledReminder && reschedFu.reminderSentAt === null,
      '58. Rescheduling updates reminderAt and resets reminderSentAt to null'
    );

    const secondReminderScan = await processFollowUpReminders(
      new Date(new Date(rescheduledReminder).getTime() + 1000)
    );
    assert(
      secondReminderScan.enqueuedCount === 1,
      '59. Rescheduled reminderAt generates a new deduplication key and is not suppressed by previous schedule'
    );

    // 5. Complete follow-up BEFORE worker dispatches the second reminder job -> pre-delivery cancellation must cancel the pending job!
    const completeFuRes = await fetch(
      `${baseUrl}/students/${studentA.id}/follow-ups/${fu1.id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          status: 'COMPLETED',
          outcomeNotes: 'Student maintained 100% punctuality over 2 weeks.',
        }),
      }
    );
    assert(completeFuRes.status === 200, '60. Completing follow-up returns HTTP 200');
    const completedFu = (await completeFuRes.json()).data;
    assert(
      completedFu.status === 'COMPLETED' &&
        Boolean(completedFu.completedAt) &&
        completedFu.completedByUserId === adminA.id,
      '61. Completed follow-up records completedAt and completedByUserId'
    );

    await processNotificationJobs();
    const cancelledJobs = await prisma.notificationJob.findMany({
      where: {
        madrasaId: madrasaA.id,
        relatedEntityType: 'StudentFollowUp',
        relatedEntityId: fu1.id,
        status: 'CANCELLED',
      },
    });
    assert(
      cancelledJobs.length >= 1 && getTestEmails().length === 0,
      '62. Completing follow-up cancels pending reminder job and prevents stale email delivery'
    );

    // 6. Test Dashboard Follow-Up Summary (Overdue, Due Today, Upcoming)
    await fetch(`${baseUrl}/students/${studentA.id}/follow-ups`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        title: 'Overdue Task',
        dueDate: '2020-01-01',
        priority: 'URGENT',
      }),
    });

    await fetch(`${baseUrl}/students/${studentA.id}/follow-ups`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        title: 'Upcoming Task',
        dueDate: '2099-12-31',
        priority: 'NORMAL',
      }),
    });

    const summaryRes = await fetch(`${baseUrl}/students-follow-ups/summary`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(summaryRes.status === 200, '63. Dashboard follow-ups summary endpoint returns HTTP 200');
    const summaryData = (await summaryRes.json()).data;
    assert(
      summaryData.overdueCount >= 1 &&
        summaryData.upcomingCount >= 1 &&
        summaryData.overdueItems[0].navigationUrl.includes(`/madrasa-admin/students/${studentA.id}`),
      '64. Dashboard follow-ups summary accurately counts overdue/upcoming items and includes navigation links'
    );

    // =========================================================================
    // GROUP 5: UNIFIED STUDENT CHRONOLOGICAL TIMELINE
    // =========================================================================
    console.log('\n--- Group 5: Unified Student Chronological Timeline ---');

    const timelineRes = await fetch(`${baseUrl}/students/${studentA.id}/timeline`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(timelineRes.status === 200, '65. Student timeline endpoint returns HTTP 200');
    const timelineData = (await timelineRes.json()).data;
    const eventTypes = new Set(timelineData.items.map((i) => i.type));
    assert(
      eventTypes.has('ENROLLMENT') &&
        eventTypes.has('QUALIFICATION') &&
        eventTypes.has('ACHIEVEMENT') &&
        eventTypes.has('INCIDENT') &&
        eventTypes.has('MEETING') &&
        eventTypes.has('FOLLOW_UP'),
      '66. Timeline aggregates Enrollment, Qualification, Achievement, Incident, Meeting, and Follow-Up events'
    );

    const dismissedTimelineEvent = timelineData.items.find(
      (i) => i.type === 'INCIDENT' && i.entityId === dismissedInc.id
    );
    assert(
      dismissedTimelineEvent &&
        dismissedTimelineEvent.subtitle.includes('Dismissed — Not Proven Misconduct') &&
        dismissedTimelineEvent.metadata.isConfirmedMisconduct === false &&
        dismissedTimelineEvent.metadata.isDismissed === true,
      'Timeline explicitly labels dismissed incident as "Dismissed — Not Proven Misconduct"'
    );

    const resolvedTimelineEvent = timelineData.items.find(
      (i) => i.type === 'INCIDENT' && i.entityId === resolvedInc.id
    );
    assert(
      resolvedTimelineEvent &&
        resolvedTimelineEvent.subtitle.includes('Resolved Incident') &&
        resolvedTimelineEvent.metadata.isConfirmedMisconduct === false &&
        resolvedTimelineEvent.metadata.isResolved === true,
      'Timeline explicitly labels resolved incident as "Resolved Incident" without implying misconduct'
    );

    const confirmedTimelineEvent = timelineData.items.find(
      (i) => i.type === 'INCIDENT' && i.entityId === confirmedInc.id
    );
    assert(
      confirmedTimelineEvent &&
        confirmedTimelineEvent.subtitle.includes('Confirmed Finding') &&
        confirmedTimelineEvent.metadata.isConfirmedMisconduct === true &&
        confirmedTimelineEvent.metadata.isResolved === false,
      'Timeline explicitly labels confirmed incident as "Confirmed Finding"'
    );

    // =========================================================================
    // GROUP 6: STRICT TENANT ISOLATION (MADRASA B CANNOT ACCESS MADRASA A)
    // =========================================================================
    console.log('\n--- Group 6: Multi-Tenant Isolation ---');

    // 1. Madrasa B cannot list Madrasa A student qualifications
    const crossListQualRes = await fetch(`${baseUrl}/students/${studentA.id}/qualifications`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(crossListQualRes.status === 404, '68. Madrasa B listing Madrasa A qualifications returns HTTP 404');

    // 2. Madrasa B cannot get Madrasa A certificate presigned URL (even using its own studentB in URL with qual1.id)
    const crossCertUrlRes = await fetch(
      `${baseUrl}/students/${studentB.id}/qualifications/${qual1.id}/certificate`,
      {
        headers: { Authorization: `Bearer ${tokenB}` },
      }
    );
    assert(crossCertUrlRes.status === 404, '69. Madrasa B requesting Madrasa A certificate URL returns HTTP 404');

    // 3. Madrasa B cannot get Madrasa A incident evidence URL
    const crossEvUrlRes = await fetch(
      `${baseUrl}/students/${studentB.id}/incidents/${inc1.id}/evidence`,
      {
        headers: { Authorization: `Bearer ${tokenB}` },
      }
    );
    assert(crossEvUrlRes.status === 404, '70. Madrasa B requesting Madrasa A incident evidence URL returns HTTP 404');

    // 4. Madrasa A cannot link Madrasa B's Ustadh as examiner or follow-up assignee
    const crossUstadhRes = await fetch(`${baseUrl}/students/${studentA.id}/follow-ups`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        title: 'Cross-Tenant Ustadh Attempt',
        dueDate: '2026-08-01',
        assignedToUstadhId: ustadhB.id,
      }),
    });
    assert(crossUstadhRes.status === 404, '71. Assigning follow-up to another tenant Ustadh returns HTTP 404');

    // 5. Madrasa B dashboard follow-up summary shows 0 items from Madrasa A
    const summaryBRes = await fetch(`${baseUrl}/students-follow-ups/summary`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    const summaryBData = (await summaryBRes.json()).data;
    assert(
      summaryBData.totalOpenCount === 0,
      '72. Madrasa B follow-up summary is strictly isolated from Madrasa A follow-ups'
    );
  } finally {
    await teardown();
  }

  console.log(`\n========================================`);
  console.log(`Student Records Tests Complete: ${passed} passed, ${failed} failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runTests().catch(async (err) => {
  console.error('Unhandled error in student-records.test.js:', err);
  await teardown();
  process.exit(1);
});
