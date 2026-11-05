import sharp from 'sharp';
import { prisma } from '../src/lib/prisma.js';
import { hashPassword } from '../src/utils/password.js';
import { signAccessToken } from '../src/utils/jwt.js';
import app from '../src/app.js';
import http from 'http';

const TEST_PREFIX = 'adm_test_' + Date.now();

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

let madrasaA = null;
let adminA = null;
let tokenA = '';
let classA1 = null;

let madrasaB = null;
let adminB = null;
let tokenB = '';

async function setup() {
  console.log('\n--- Setting up Admissions Test Fixtures ---');
  const now = new Date();

  // 1. Subscription Plan
  const plan = await prisma.plan.upsert({
    where: { code: 'PRO_ADMISSIONS_TEST' },
    update: {},
    create: {
      name: 'Pro Admissions Test Plan',
      code: 'PRO_ADMISSIONS_TEST',
      description: 'Admissions Test Plan',
      durationMonths: 12,
      price: 15000,
      isActive: true,
    },
  });

  // 2. Tenant A
  madrasaA = await prisma.madrasa.create({
    data: {
      code: `${TEST_PREFIX}_MDA`,
      name: 'Al-Huda Admissions Academy',
      slug: `${TEST_PREFIX}-alhuda`,
      status: 'ACTIVE',
      phone: '+94771234567',
      email: 'admissions@alhuda.edu',
      address: '100 Knowledge Way, Colombo',
      settings: {
        create: {
          currency: 'LKR',
          academicYear: '2026',
        },
      },
      profile: {
        create: {
          isPublished: true,
          heroTitle: 'Welcome to Al-Huda Admissions Academy',
          heroSubtitle: 'Nurturing Islamic scholarship and excellence',
        },
      },
      subscriptions: {
        create: {
          planId: plan.id,
          startsAt: now,
          endsAt: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
          priceAtPurchase: 15000,
          durationMonthsAtPurchase: 12,
          status: 'ACTIVE',
        },
      },
    },
  });

  const pwdA = await hashPassword('SecurePass123!');
  adminA = await prisma.user.create({
    data: {
      name: 'Admin A',
      email: `${TEST_PREFIX}_adminA@test.com`,
      passwordHash: pwdA,
      role: 'MADRASA_ADMIN',
      madrasaId: madrasaA.id,
      isActive: true,
      mustChangePassword: false,
    },
  });
  tokenA = signAccessToken({
    userId: adminA.id,
    role: adminA.role,
    madrasaId: madrasaA.id,
  });

  // Class in Madrasa A
  classA1 = await prisma.class.create({
    data: {
      madrasaId: madrasaA.id,
      name: 'Hifz Grade 1',
      code: `${TEST_PREFIX}_HIFZ1`,
      defaultMonthlyFee: 2500,
      isActive: true,
    },
  });

  // 3. Tenant B
  madrasaB = await prisma.madrasa.create({
    data: {
      code: `${TEST_PREFIX}_MDB`,
      name: 'Noor Academy B',
      slug: `${TEST_PREFIX}-noor`,
      status: 'ACTIVE',
      phone: '+94779876543',
      email: 'info@noor.edu',
      address: '200 Lake Road, Kandy',
      settings: {
        create: {
          currency: 'LKR',
          academicYear: '2026',
        },
      },
      profile: {
        create: {
          isPublished: true,
          heroTitle: 'Welcome to Al-Huda Admissions Academy',
          heroSubtitle: 'Nurturing Islamic scholarship and excellence',
        },
      },
      subscriptions: {
        create: {
          planId: plan.id,
          startsAt: now,
          endsAt: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
          priceAtPurchase: 15000,
          durationMonthsAtPurchase: 12,
          status: 'ACTIVE',
        },
      },
    },
  });

  const pwdB = await hashPassword('SecurePass123!');
  adminB = await prisma.user.create({
    data: {
      name: 'Admin B',
      email: `${TEST_PREFIX}_adminB@test.com`,
      passwordHash: pwdB,
      role: 'MADRASA_ADMIN',
      madrasaId: madrasaB.id,
      isActive: true,
      mustChangePassword: false,
    },
  });
  tokenB = signAccessToken({
    userId: adminB.id,
    role: adminB.role,
    madrasaId: madrasaB.id,
  });

  // Start HTTP server
  testServer = http.createServer(app);
  await new Promise((resolve) => {
    testServer.listen(0, () => {
      const port = testServer.address().port;
      baseUrl = `http://localhost:${port}`;
      resolve();
    });
  });

  console.log(`Test server running at ${baseUrl}`);
}

async function teardown() {
  console.log('\n--- Tearing Down Admissions Test Fixtures ---');
  if (testServer) {
    await new Promise((resolve) => testServer.close(resolve));
  }

  try {
    const madrasaIds = [madrasaA?.id, madrasaB?.id].filter(Boolean);
    if (madrasaIds.length > 0) {
      await prisma.notificationJob.deleteMany({
        where: { madrasaId: { in: madrasaIds } },
      });
      await prisma.studentApplication.deleteMany({
        where: { madrasaId: { in: madrasaIds } },
      });
      await prisma.student.deleteMany({
        where: { madrasaId: { in: madrasaIds } },
      });
      await prisma.admissionPeriod.deleteMany({
        where: { madrasaId: { in: madrasaIds } },
      });
      await prisma.class.deleteMany({
        where: { madrasaId: { in: madrasaIds } },
      });
      await prisma.subscription.deleteMany({
        where: { madrasaId: { in: madrasaIds } },
      });
      await prisma.madrasaProfile.deleteMany({
        where: { madrasaId: { in: madrasaIds } },
      });
      await prisma.madrasaSetting.deleteMany({
        where: { madrasaId: { in: madrasaIds } },
      });
      await prisma.user.deleteMany({
        where: { madrasaId: { in: madrasaIds } },
      });
      await prisma.madrasa.deleteMany({
        where: { id: { in: madrasaIds } },
      });
    }
  } catch (err) {
    console.warn('Teardown cleanup error:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

async function runTests() {
  try {
    await setup();

    console.log('\n=== RUNNING ADMISSIONS END-TO-END & INTEGRATION TESTS ===\n');

    // TEST 1: Public admissions endpoint with no open intake
    console.log('[TEST 1] Public admissions endpoint when no period is active');
    const resPublicEmpty = await fetch(`${baseUrl}/api/public/madrasa/${madrasaA.slug}/admissions`);
    assert(resPublicEmpty.status === 200, 'GET /public/madrasa/:slug/admissions returns 200');
    const jsonPublicEmpty = await resPublicEmpty.json();
    assert(jsonPublicEmpty.success === true, 'Public response is success');
    assert(jsonPublicEmpty.data.activeAdmissionPeriods.length === 0, 'No open periods listed');

    // TEST 2: Admin creates an AdmissionPeriod
    console.log('\n[TEST 2] Admin creates an Admission Period');
    const now = new Date();
    const startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const resCreatePeriod = await fetch(`${baseUrl}/api/madrasa-admin/admissions/periods`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        academicYear: 2026,
        code: 'INTAKE-2026-A',
        name: 'Spring 2026 Admissions Intake',
        startDate,
        endDate,
        capacity: 50,
        instructions: 'Please submit applicant birth certificate and guardian ID copy.',
        isOpen: true,
      }),
    });
    assert(resCreatePeriod.status === 201, 'POST /admissions/periods returns 201 Created');
    const jsonCreatePeriod = await resCreatePeriod.json();
    const createdPeriod = jsonCreatePeriod.data;
    assert(createdPeriod.code === 'INTAKE-2026-A', 'Period code matches');
    assert(createdPeriod.isOpen === true, 'Period status is open');

    // TEST 3: Public admissions endpoint now shows open intake & classes
    console.log('\n[TEST 3] Public admissions endpoint reflects open intake');
    const resPublicActive = await fetch(`${baseUrl}/api/public/madrasa/${madrasaA.slug}/admissions`);
    assert(resPublicActive.status === 200, 'GET /public/madrasa/:slug/admissions returns 200');
    const jsonPublicActive = await resPublicActive.json();
    assert(jsonPublicActive.data.activeAdmissionPeriods.length === 1, '1 open period listed');
    assert(jsonPublicActive.data.activeAdmissionPeriods[0].id === createdPeriod.id, 'Active period matches created ID');
    assert(jsonPublicActive.data.availableClasses.length >= 1, 'Available classes returned for application');

    // TEST 4: Public document upload (PDF and PNG)
    console.log('\n[TEST 4] Public document upload with valid files');
    // PDF document with proper %PDF-1.4 header
    const samplePdfBuffer = Buffer.from(
      '%PDF-1.4\n1 0 obj\n<< /Title (Birth Certificate) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF'
    );
    const pdfFormData = new FormData();
    pdfFormData.append(
      'document',
      new Blob([samplePdfBuffer], { type: 'application/pdf' }),
      'birth_cert.pdf'
    );

    const resUploadPdf = await fetch(
      `${baseUrl}/api/public/madrasa/${madrasaA.slug}/admissions/upload-document`,
      {
        method: 'POST',
        body: pdfFormData,
      }
    );
    assert(resUploadPdf.status === 200, 'Upload PDF returns 200 OK');
    const jsonUploadPdf = await resUploadPdf.json();
    assert(jsonUploadPdf.success === true, 'PDF upload returned success');
    assert(jsonUploadPdf.data.mimeType === 'application/pdf', 'Uploaded document mimeType is application/pdf');
    assert(!!jsonUploadPdf.data.fileUrl, 'Uploaded document returned accessible fileUrl');

    // PNG document
    const samplePngBuffer = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 4,
        background: { r: 10, g: 100, b: 200, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const pngFormData = new FormData();
    pngFormData.append(
      'document',
      new Blob([samplePngBuffer], { type: 'image/png' }),
      'guardian_id.png'
    );

    const resUploadPng = await fetch(
      `${baseUrl}/api/public/madrasa/${madrasaA.slug}/admissions/upload-document`,
      {
        method: 'POST',
        body: pngFormData,
      }
    );
    assert(resUploadPng.status === 200, 'Upload PNG returns 200 OK');
    const jsonUploadPng = await resUploadPng.json();
    const uploadedDocs = [jsonUploadPdf.data, jsonUploadPng.data];

    // TEST 5: Document upload rejects fake/executable files
    console.log('\n[TEST 5] Document upload rejects invalid files');
    const badFormData = new FormData();
    badFormData.append(
      'document',
      new Blob(['<html><script>alert(1)</script></html>'], { type: 'text/html' }),
      'malicious.html'
    );
    const resBadUpload = await fetch(
      `${baseUrl}/api/public/madrasa/${madrasaA.slug}/admissions/upload-document`,
      {
        method: 'POST',
        body: badFormData,
      }
    );
    assert(resBadUpload.status === 400, 'Bad document rejected with 400 Bad Request');

    // TEST 6: Public application submission
    console.log('\n[TEST 6] Public online application submission');
    const appPayload = {
      admissionPeriodId: createdPeriod.id,
      applicantName: 'Yusuf Tariq',
      gender: 'MALE',
      dateOfBirth: '2016-05-15',
      address: '77 Galle Road, Colombo',
      appliedClassId: classA1.id,
      previousSchool: 'Al-Irfan Primary',
      guardianName: 'Tariq Mansoor',
      guardianRelationship: 'Father',
      guardianPhone: '+94775551122',
      guardianEmail: 'tariq.mansoor@example.com',
      documents: uploadedDocs,
    };

    const resSubmitApp = await fetch(`${baseUrl}/api/public/madrasa/${madrasaA.slug}/admissions/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(appPayload),
    });
    assert(resSubmitApp.status === 201, 'POST /admissions/apply returns 201 Created');
    const jsonSubmitApp = await resSubmitApp.json();
    assert(jsonSubmitApp.success === true, 'Submission success is true');
    assert(!!jsonSubmitApp.data.applicationNo, 'Returned valid application reference number');
    const submittedAppId = jsonSubmitApp.data.id;
    const applicationNo = jsonSubmitApp.data.applicationNo;
    console.log(`  -> Application Reference: ${applicationNo}`);

    // Verify NotificationJob was created for applicant via EMAIL ONLY
    const notificationJob = await prisma.notificationJob.findFirst({
      where: {
        madrasaId: madrasaA.id,
        eventType: 'APPLICATION_STATUS_UPDATE',
        channel: 'EMAIL',
        recipientAddress: 'tariq.mansoor@example.com',
      },
    });
    assert(!!notificationJob, 'Applicant confirmation EMAIL NotificationJob queued');

    // Strict safety check: verify 0 SMS jobs created for admissions
    const smsJob = await prisma.notificationJob.findFirst({
      where: {
        madrasaId: madrasaA.id,
        eventType: 'APPLICATION_STATUS_UPDATE',
        channel: 'SMS',
      },
    });
    assert(smsJob === null, 'Admissions strictly created 0 SMS jobs (EMAIL ONLY)');

    // TEST 7: Duplicate application prevention
    console.log('\n[TEST 7] Duplicate application prevention');
    const resDuplicateApp = await fetch(`${baseUrl}/api/public/madrasa/${madrasaA.slug}/admissions/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(appPayload),
    });
    assert(resDuplicateApp.status === 409, 'Duplicate submission rejected with 409 Conflict');

    // TEST 8: Closed intake application prevention
    console.log('\n[TEST 8] Closed intake submission prevention');
    // Admin toggles intake to CLOSED
    const resTogglePeriod = await fetch(
      `${baseUrl}/api/madrasa-admin/admissions/periods/${createdPeriod.id}/toggle`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tokenA}` },
      }
    );
    assert(resTogglePeriod.status === 200, 'Toggle intake period status returns 200');

    // Attempt submitting to closed intake
    const appPayloadClosed = {
      ...appPayload,
      applicantName: 'Zayd Tariq',
      dateOfBirth: '2017-08-20',
    };
    const resSubmitClosed = await fetch(`${baseUrl}/api/public/madrasa/${madrasaA.slug}/admissions/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(appPayloadClosed),
    });
    assert(resSubmitClosed.status === 400, 'Submitting to closed intake rejected with 400 Bad Request');

    // Re-open period for remaining tests
    await fetch(`${baseUrl}/api/madrasa-admin/admissions/periods/${createdPeriod.id}/toggle`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenA}` },
    });

    // TEST 8B: Invalid input validation
    console.log('\n[TEST 8B] Input validation rejects invalid fields');
    const invalidEmailPayload = {
      ...appPayload,
      applicantName: 'Bilal Farooq',
      guardianEmail: 'not-a-valid-email',
    };
    const resInvalidEmail = await fetch(`${baseUrl}/api/public/madrasa/${madrasaA.slug}/admissions/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidEmailPayload),
    });
    assert(resInvalidEmail.status === 400, 'Invalid email strictly rejected with 400 Bad Request');

    const futureDobPayload = {
      ...appPayload,
      applicantName: 'Bilal Farooq',
      dateOfBirth: '2099-01-01',
    };
    const resFutureDob = await fetch(`${baseUrl}/api/public/madrasa/${madrasaA.slug}/admissions/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(futureDobPayload),
    });
    assert(resFutureDob.status === 400, 'Future date of birth strictly rejected with 400 Bad Request');

    // TEST 9: Admin lists applications
    console.log('\n[TEST 9] Admin lists submitted applications');
    const resAdminList = await fetch(
      `${baseUrl}/api/madrasa-admin/admissions/applications?admissionPeriodId=${createdPeriod.id}`,
      {
        headers: { Authorization: `Bearer ${tokenA}` },
      }
    );
    assert(resAdminList.status === 200, 'GET /admissions/applications returns 200');
    const jsonAdminList = await resAdminList.json();
    assert(jsonAdminList.data.items.length === 1, 'Admin sees 1 submitted application');
    assert(jsonAdminList.data.items[0].applicationNo === applicationNo, 'Application number matches');

    // TEST 10: Admin gets single application detail
    console.log('\n[TEST 10] Admin gets application details');
    const resAdminGet = await fetch(
      `${baseUrl}/api/madrasa-admin/admissions/applications/${submittedAppId}`,
      {
        headers: { Authorization: `Bearer ${tokenA}` },
      }
    );
    assert(resAdminGet.status === 200, 'GET /admissions/applications/:id returns 200');
    const jsonAdminGet = await resAdminGet.json();
    assert(jsonAdminGet.data.applicantName === 'Yusuf Tariq', 'Applicant name matches');
    assert(Array.isArray(jsonAdminGet.data.documents), 'documents is array');
    assert(jsonAdminGet.data.documents.length === 2, '2 uploaded documents present');

    // TEST 11: Admin approves application
    console.log('\n[TEST 11] Admin reviews and approves application');
    const resReview = await fetch(
      `${baseUrl}/api/madrasa-admin/admissions/applications/${submittedAppId}/status`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          status: 'APPROVED',
          reviewRemarks: 'Application documents verified. Eligible for admission.',
        }),
      }
    );
    assert(resReview.status === 200, 'PATCH /admissions/applications/:id/status returns 200');
    const jsonReview = await resReview.json();
    assert(jsonReview.data.status === 'APPROVED', 'Application status updated to APPROVED');
    assert(jsonReview.data.reviewRemarks.includes('verified'), 'Review remarks saved');

    // TEST 12: Admin converts approved application into Student
    console.log('\n[TEST 12] Admin converts approved application into Student');
    const resConvert = await fetch(
      `${baseUrl}/api/madrasa-admin/admissions/applications/${submittedAppId}/convert`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          admissionNo: `${TEST_PREFIX}_STU_001`,
          classId: classA1.id,
          admissionDate: new Date().toISOString(),
        }),
      }
    );
    assert(resConvert.status === 200, 'POST /admissions/applications/:id/convert returns 200');
    const jsonConvert = await resConvert.json();
    assert(jsonConvert.success === true, 'Conversion succeeded');
    assert(jsonConvert.data.application.status === 'CONVERTED', 'Application status is CONVERTED');
    assert(!!jsonConvert.data.student.id, 'New Student record created');
    assert(jsonConvert.data.student.fullName === 'Yusuf Tariq', 'Student name matches applicant name');

    // Check Student in DB
    const studentDb = await prisma.student.findUnique({
      where: {
        madrasaId_admissionNo: {
          madrasaId: madrasaA.id,
          admissionNo: `${TEST_PREFIX}_STU_001`,
        },
      },
      include: { class: true },
    });
    assert(!!studentDb, 'Student verified in database');
    assert(studentDb.classId === classA1.id, 'Student assigned to requested class');
    assert(studentDb.guardianName === 'Tariq Mansoor', 'Guardian name matches');
    assert(studentDb.guardianPhone === '+94775551122', 'Guardian phone matches');

    // TEST 13: Prevent duplicate conversion
    console.log('\n[TEST 13] Duplicate student conversion prevention');
    const resDuplicateConvert = await fetch(
      `${baseUrl}/api/madrasa-admin/admissions/applications/${submittedAppId}/convert`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          admissionNo: `${TEST_PREFIX}_STU_002`,
        }),
      }
    );
    assert(resDuplicateConvert.status === 409, 'Duplicate conversion rejected with 409 Conflict');

    // TEST 14: Strict Multi-Tenant Isolation
    console.log('\n[TEST 14] Strict multi-tenant isolation');
    // Admin B attempts to access Admin A's application
    const resTenantBGet = await fetch(
      `${baseUrl}/api/madrasa-admin/admissions/applications/${submittedAppId}`,
      {
        headers: { Authorization: `Bearer ${tokenB}` },
      }
    );
    assert(resTenantBGet.status === 404, 'Cross-tenant application access blocked with 404 Not Found');

    const resTenantBReview = await fetch(
      `${baseUrl}/api/madrasa-admin/admissions/applications/${submittedAppId}/status`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenB}`,
        },
        body: JSON.stringify({ status: 'REJECTED' }),
      }
    );
    assert(resTenantBReview.status === 404, 'Cross-tenant status modification blocked with 404 Not Found');

    const resTenantBConvert = await fetch(
      `${baseUrl}/api/madrasa-admin/admissions/applications/${submittedAppId}/convert`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenB}`,
        },
        body: JSON.stringify({
          admissionNo: `${TEST_PREFIX}_STU_CROSS`,
        }),
      }
    );
    assert(resTenantBConvert.status === 404, 'Cross-tenant conversion blocked with 404 Not Found');

    // =========================================================================
    // Phase 3B: Admissions Document Upload Rate Limiter Test (Mock-Only Storage)
    // =========================================================================
    console.log('\n--- Phase 3B Security Verification: Admissions Upload Rate Limiter ---');
    const { setTestStorageAdapter } = await import('../src/services/r2.service.js');
    const mockUploadedDocs = new Map();
    setTestStorageAdapter({
      uploadBuffer: async (key, buffer, contentType) => {
        mockUploadedDocs.set(key, { size: buffer.length, contentType });
        return { success: true };
      },
    });

    try {
      // 1. Send legitimate uploads up to the limit of 15 (3 uploads were performed earlier in the suite)
      const priorUploads = 3;
      const remainingAllowed = 15 - priorUploads;
      let successfulUploads = 0;
      for (let i = 1; i <= remainingAllowed; i++) {
        const formData = new FormData();
        const fakeBlob = new Blob(['Test Document Content ' + i], { type: 'application/pdf' });
        formData.append('document', fakeBlob, `test_doc_${i}.pdf`);
        formData.append('category', 'SUPPORTING_DOC');

        const uploadRes = await fetch(`${baseUrl}/api/public/madrasa/${madrasaA.slug}/admissions/upload-document`, {
          method: 'POST',
          body: formData,
        });

        if (uploadRes.status === 200 || uploadRes.status === 201) {
          successfulUploads++;
        }
      }
      assert(priorUploads + successfulUploads === 15, `Total document uploads up to 15 within rate-limit window succeed (actual total: ${priorUploads + successfulUploads})`);

      // 2. The 16th upload must be blocked with HTTP 429
      const formDataExceed = new FormData();
      const fakeBlobExceed = new Blob(['Blocked Document Content'], { type: 'application/pdf' });
      formDataExceed.append('document', fakeBlobExceed, 'blocked_doc.pdf');
      formDataExceed.append('category', 'SUPPORTING_DOC');

      const exceedRes = await fetch(`${baseUrl}/api/public/madrasa/${madrasaA.slug}/admissions/upload-document`, {
        method: 'POST',
        body: formDataExceed,
      });

      assert(exceedRes.status === 429, `16th upload from same IP is blocked with 429 Too Many Requests (actual: ${exceedRes.status})`);
      const exceedBody = await exceedRes.json();
      assert(exceedBody.message && exceedBody.message.includes('Too many document uploads'), '429 response body contains rate limit message');
    } finally {
      mockUploadedDocs.clear();
      setTestStorageAdapter(null);
    }

    console.log('\n=============================================');
    console.log(`Admissions Tests Results: ${testPassedCount} Passed, ${testFailedCount} Failed`);
    console.log('=============================================');

    if (testFailedCount > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  } finally {
    await teardown();
  }
}

runTests();
