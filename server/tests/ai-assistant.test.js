import './setup-test-env.js';
import { prisma } from '../src/lib/prisma.js';
import { hashPassword } from '../src/utils/password.js';
import { signAccessToken } from '../src/utils/jwt.js';
import app from '../src/app.js';
import { extractTextFromPdfBuffer } from '../src/services/ai.service.js';

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

let superAdminUser = null;
let superAdminToken = '';

let madrasa = null;
let madrasaAdmin = null;
let madrasaAdminToken = '';

let teacherUser = null;
let ustadhProfile = null;
let teacherToken = '';

let sampleReceiptBuffer = null;
let samplePdfBuffer = null;

async function setup() {
  console.log('\n--- Setting up MadrasaNexa AI Assistant Test Fixtures ---');

  // Clean old AI subscription requests for clean start
  await prisma.aiSubscriptionRequest.deleteMany();

  // Create Super Admin
  const saPassword = await hashPassword('SuperAdmin@123456');
  superAdminUser = await prisma.user.create({
    data: {
      email: `sa_ai_${Date.now()}@madrasanexa.com`,
      passwordHash: saPassword,
      name: 'Super Admin AI Tester',
      role: 'SUPER_ADMIN',
      isActive: true,
      tokenVersion: 0,
    },
  });
  superAdminToken = signAccessToken({
    userId: superAdminUser.id,
    role: superAdminUser.role,
    tokenVersion: 0,
  });

  // Create Madrasa
  const madrasaCode = 'AI_' + Date.now().toString().slice(-6);
  madrasa = await prisma.madrasa.create({
    data: {
      code: madrasaCode,
      name: 'Darul Uloom AI Academy',
      slug: 'darul-uloom-ai-' + Date.now(),
      status: 'ACTIVE',
      aiEnabled: false,
    },
  });

  // Create Madrasa Admin
  const adminPassword = await hashPassword('MadrasaAdmin@123456');
  madrasaAdmin = await prisma.user.create({
    data: {
      email: `admin_${Date.now()}@darululoom.com`,
      passwordHash: adminPassword,
      name: 'Moulavi Admin',
      role: 'MADRASA_ADMIN',
      madrasaId: madrasa.id,
      isActive: true,
      tokenVersion: 0,
    },
  });
  madrasaAdminToken = signAccessToken({
    userId: madrasaAdmin.id,
    role: madrasaAdmin.role,
    madrasaId: madrasa.id,
    tokenVersion: 0,
  });

  // Create Ustadh User & Profile
  const teacherPassword = await hashPassword('Teacher@123456');
  teacherUser = await prisma.user.create({
    data: {
      email: `ustadh_${Date.now()}@darululoom.com`,
      passwordHash: teacherPassword,
      name: 'Ustadh Zaid',
      role: 'TEACHER',
      madrasaId: madrasa.id,
      isActive: true,
      tokenVersion: 0,
    },
  });
  ustadhProfile = await prisma.ustadh.create({
    data: {
      madrasaId: madrasa.id,
      userId: teacherUser.id,
      ustadhCode: 'UST_' + Date.now().toString().slice(-5),
      fullName: 'Ustadh Zaid',
      email: teacherUser.email,
      isActive: true,
      joinDate: new Date(),
      baseMonthlySalary: 50000,
    },
  });
  teacherToken = signAccessToken({
    userId: teacherUser.id,
    role: teacherUser.role,
    madrasaId: madrasa.id,
    tokenVersion: 0,
  });

  // Valid JPEG receipt buffer (SOI + APP0 marker)
  sampleReceiptBuffer = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x01, 0x00, 0x60, 0x00, 0x60, 0x00, 0x00, 0xff, 0xd9,
  ]);

  // Valid minimal PDF buffer
  const samplePdfContent =
    '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n5 0 obj\n<< /Length 44 >>\nstream\nBT /F1 12 Tf 72 712 Td (Surah Al-Baqarah Lesson Notes) Tj ET\nendstream\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000216 00000 n \n0000000293 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n386\n%%EOF';
  samplePdfBuffer = Buffer.from(samplePdfContent, 'utf-8');

  // Start test server on dynamic port
  await new Promise((resolve) => {
    testServer = app.listen(0, () => {
      const port = testServer.address().port;
      baseUrl = `http://127.0.0.1:${port}/api`;
      console.log(`Test server running at: ${baseUrl}`);
      resolve();
    });
  });
}

async function teardown() {
  console.log('\n--- Tearing Down Test Server ---');
  if (testServer) {
    await new Promise((resolve) => testServer.close(resolve));
  }
}

async function runTests() {
  await setup();

  try {
    console.log('\n=== SECTION 1: AI STATUS & LOCKED PREVIEW ===');

    // 1. Unauthenticated status request
    {
      const res = await fetch(`${baseUrl}/ai/status`);
      assert(res.status === 401, 'Unauthenticated GET /api/ai/status returns 401');
    }

    // 2. Madrasa Admin status check when AI is not yet enabled
    {
      const res = await fetch(`${baseUrl}/ai/status`, {
        headers: { Authorization: `Bearer ${madrasaAdminToken}` },
      });
      assert(res.status === 200, 'Madrasa Admin GET /api/ai/status returns 200');
      const body = await res.json();
      assert(body.success === true, 'Response success is true');
      assert(body.data.aiEnabled === false, 'Tenant aiEnabled is initially false');
      assert(body.data.settings?.monthlyPrice > 0, 'Returns configurable monthly price');
      assert(body.data.settings?.yearlyPrice > 0, 'Returns configurable yearly price');
      assert(Boolean(body.data.settings?.bankName), 'Returns platform bank name');
      assert(Boolean(body.data.settings?.accountNumber), 'Returns platform bank account number');
    }

    // 3. Teacher status check
    {
      const res = await fetch(`${baseUrl}/ai/status`, {
        headers: { Authorization: `Bearer ${teacherToken}` },
      });
      assert(res.status === 200, 'Teacher GET /api/ai/status returns 200');
      const body = await res.json();
      assert(body.data.aiEnabled === false, 'Teacher sees aiEnabled false before activation');
    }

    console.log('\n=== SECTION 2: BANK RECEIPT SUBMISSION & SECURITY ===');

    // 4. Non-admin attempting to submit receipt
    {
      const boundary = '----WebKitFormBoundary' + Date.now();
      const res = await fetch(`${baseUrl}/ai/subscription/submit-receipt`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${teacherToken}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body: `--${boundary}\r\nContent-Disposition: form-data; name="planName"\r\n\r\nMonthly Plan\r\n--${boundary}--\r\n`,
      });
      assert(res.status === 403, 'Teacher attempting to submit subscription receipt returns 403 Forbidden');
    }

    // 5. SVG upload security rejection
    {
      const boundary = '----WebKitFormBoundary' + Date.now();
      const svgBuffer = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
      const bodyParts = [
        `--${boundary}\r\nContent-Disposition: form-data; name="planName"\r\n\r\nYearly Plan\r\n`,
        `--${boundary}\r\nContent-Disposition: form-data; name="amount"\r\n\r\n25000\r\n`,
        `--${boundary}\r\nContent-Disposition: form-data; name="transactionRef"\r\n\r\nTXN_123456\r\n`,
        `--${boundary}\r\nContent-Disposition: form-data; name="receipt"; filename="fake_slip.svg"\r\nContent-Type: image/svg+xml\r\n\r\n`,
      ];
      const payload = Buffer.concat([
        Buffer.from(bodyParts.join('')),
        svgBuffer,
        Buffer.from(`\r\n--${boundary}--\r\n`),
      ]);

      const res = await fetch(`${baseUrl}/ai/subscription/submit-receipt`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${madrasaAdminToken}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body: payload,
      });
      assert(res.status === 400, 'SVG receipt upload is strictly rejected (400)');
    }

    // 6. Valid JPEG receipt upload
    let createdRequestId = '';
    {
      const boundary = '----WebKitFormBoundary' + Date.now();
      const bodyParts = [
        `--${boundary}\r\nContent-Disposition: form-data; name="planName"\r\n\r\nYearly Plan\r\n`,
        `--${boundary}\r\nContent-Disposition: form-data; name="amount"\r\n\r\n25000\r\n`,
        `--${boundary}\r\nContent-Disposition: form-data; name="transactionRef"\r\n\r\nBOC_TXN_884920\r\n`,
        `--${boundary}\r\nContent-Disposition: form-data; name="receipt"; filename="bank_deposit.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`,
      ];
      const payload = Buffer.concat([
        Buffer.from(bodyParts.join('')),
        sampleReceiptBuffer,
        Buffer.from(`\r\n--${boundary}--\r\n`),
      ]);

      const res = await fetch(`${baseUrl}/ai/subscription/submit-receipt`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${madrasaAdminToken}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body: payload,
      });
      assert(res.status === 201, 'Valid JPEG receipt submission returns 201 Created');
      const body = await res.json();
      assert(body.data.status === 'PENDING', 'Created request status is PENDING');
      assert(body.data.amount === 25000, 'Amount matches submitted plan');
      assert(body.data.transactionRef === 'BOC_TXN_884920', 'Transaction reference stored');
      createdRequestId = body.data.id;
    }

    // 7. Duplicate request prevention while PENDING
    {
      const boundary = '----WebKitFormBoundary' + Date.now();
      const bodyParts = [
        `--${boundary}\r\nContent-Disposition: form-data; name="planName"\r\n\r\nMonthly Plan\r\n`,
        `--${boundary}\r\nContent-Disposition: form-data; name="amount"\r\n\r\n2500\r\n`,
        `--${boundary}\r\nContent-Disposition: form-data; name="transactionRef"\r\n\r\nTXN_DUPLICATE\r\n`,
        `--${boundary}\r\nContent-Disposition: form-data; name="receipt"; filename="slip.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`,
      ];
      const payload = Buffer.concat([
        Buffer.from(bodyParts.join('')),
        sampleReceiptBuffer,
        Buffer.from(`\r\n--${boundary}--\r\n`),
      ]);

      const res = await fetch(`${baseUrl}/ai/subscription/submit-receipt`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${madrasaAdminToken}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body: payload,
      });
      assert(res.status === 409, 'Submitting second receipt while one is PENDING returns 409 Conflict');
    }

    // 8. Verify status returns PENDING badge for Madrasa Admin
    {
      const res = await fetch(`${baseUrl}/ai/status`, {
        headers: { Authorization: `Bearer ${madrasaAdminToken}` },
      });
      const body = await res.json();
      assert(body.data.latestRequest?.status === 'PENDING', 'Status includes pending request details');
      assert(body.data.latestRequest?.transactionRef === 'BOC_TXN_884920', 'Includes matching txn ref');
    }

    console.log('\n=== SECTION 3: SUPER ADMIN APPROVAL WORKFLOW ===');

    // 9. Unauthorized access to Super Admin AI endpoint
    {
      const res = await fetch(`${baseUrl}/ai/admin/subscriptions`, {
        headers: { Authorization: `Bearer ${madrasaAdminToken}` },
      });
      assert(res.status === 403, 'Madrasa Admin accessing Super Admin subscriptions endpoint returns 403');
    }

    // 10. Super Admin lists subscription requests
    {
      const res = await fetch(`${baseUrl}/ai/admin/subscriptions`, {
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });
      assert(res.status === 200, 'Super Admin GET /api/ai/admin/subscriptions returns 200');
      const body = await res.json();
      assert(body.data.requests.length >= 1, 'Lists incoming subscription requests');
      const item = body.data.requests.find((r) => r.id === createdRequestId);
      assert(Boolean(item), 'Finds newly submitted request by ID');
      assert(item.madrasa?.name === 'Darul Uloom AI Academy', 'Populates Madrasa tenant details');
      assert(Boolean(item.submittedByUser?.name), 'Populates submitting user details');
      assert(Boolean(item.receiptUrl), 'Populates clickable receipt URL');
    }

    // 11. Super Admin approves request & activates AI for tenant
    {
      const res = await fetch(`${baseUrl}/ai/admin/subscriptions/${createdRequestId}/approve`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${superAdminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminNote: 'Verified with BOC Corporate banking statement.',
        }),
      });
      assert(res.status === 200, 'Super Admin POST approve returns 200');
      const body = await res.json();
      assert(body.data.request.status === 'APPROVED', 'Request status updated to APPROVED');
      assert(body.data.madrasa.aiEnabled === true, 'Madrasa aiEnabled set to true');
      assert(Boolean(body.data.madrasa.aiExpiresAt), 'Madrasa aiExpiresAt set in future');
    }

    // 12. Verify status is now unlocked for both Admin and Ustadh
    {
      const adminRes = await fetch(`${baseUrl}/ai/status`, {
        headers: { Authorization: `Bearer ${madrasaAdminToken}` },
      });
      const adminBody = await adminRes.json();
      assert(adminBody.data.aiEnabled === true, 'Madrasa Admin status is now unlocked (aiEnabled === true)');
      assert(adminBody.data.daysRemaining > 0, 'Days remaining is positive');

      const teacherRes = await fetch(`${baseUrl}/ai/status`, {
        headers: { Authorization: `Bearer ${teacherToken}` },
      });
      const teacherBody = await teacherRes.json();
      assert(teacherBody.data.aiEnabled === true, 'Teacher status is now unlocked for approved Madrasa');
    }

    console.log('\n=== SECTION 4: IN-MEMORY ZERO-STORAGE PDF PROCESSING ===');

    // 13. Verify in-memory PDF extraction (0 MB saved to disk or cloud)
    {
      const extractedText = await extractTextFromPdfBuffer(samplePdfBuffer);
      assert(
        extractedText.includes('Surah Al-Baqarah Lesson Notes'),
        'extractTextFromPdfBuffer extracts text in RAM correctly'
      );
    }

    console.log('\n=== SECTION 5: SUPER ADMIN DIRECT TOGGLE & SETTINGS ===');

    // 14. Super Admin manual toggle (disable AI directly)
    {
      const res = await fetch(`${baseUrl}/ai/admin/madrasas/${madrasa.id}/toggle`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${superAdminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          enabled: false,
          note: 'Temporary administrative suspension',
        }),
      });
      assert(res.status === 200, 'Super Admin direct toggle returns 200');
      const body = await res.json();
      assert(body.data.aiEnabled === false, 'Madrasa aiEnabled toggled to false');
    }

    // 15. Verify lock takes immediate effect
    {
      const res = await fetch(`${baseUrl}/ai/status`, {
        headers: { Authorization: `Bearer ${madrasaAdminToken}` },
      });
      const body = await res.json();
      assert(body.data.aiEnabled === false, 'Tenant AI status is immediately locked when toggled off');
    }

    // 16. Re-enable AI via Super Admin direct toggle
    {
      const res = await fetch(`${baseUrl}/ai/admin/madrasas/${madrasa.id}/toggle`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${superAdminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          enabled: true,
          note: 'Re-enabled by Super Admin',
        }),
      });
      assert(res.status === 200, 'Re-enabling AI via direct toggle returns 200');
      const body = await res.json();
      assert(body.data.aiEnabled === true, 'Madrasa aiEnabled restored to true');
    }

    // 17. Super Admin update platform AI settings (pricing and bank)
    {
      const res = await fetch(`${baseUrl}/ai/admin/settings`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${superAdminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          monthlyPrice: 3000,
          yearlyPrice: 30000,
          bankName: 'Commercial Bank of Ceylon',
          accountNumber: '8910294102',
          branch: 'Kandy Main Branch',
        }),
      });
      assert(res.status === 200, 'Updating AI platform settings returns 200');
      const body = await res.json();
      assert(body.data.monthlyPrice === 3000, 'Monthly price updated');
      assert(body.data.yearlyPrice === 30000, 'Yearly price updated');
      assert(body.data.bankName === 'Commercial Bank of Ceylon', 'Bank name updated');
    }

    // 18. Verify tenant sees the updated pricing in LKR
    {
      const res = await fetch(`${baseUrl}/ai/status`, {
        headers: { Authorization: `Bearer ${madrasaAdminToken}` },
      });
      const body = await res.json();
      assert(body.data.settings.monthlyPrice === 3000, 'Tenant immediately reflects updated monthly price');
      assert(body.data.settings.yearlyPrice === 30000, 'Tenant immediately reflects updated yearly price');
    }
  } catch (error) {
    console.error('Test execution exception:', error);
    testFailedCount++;
  } finally {
    await teardown();
  }

  console.log('\n=============================================');
  console.log(`AI ASSISTANT TEST SUMMARY: ${testPassedCount} PASSED, ${testFailedCount} FAILED`);
  console.log('=============================================\n');

  if (testFailedCount > 0) {
    process.exit(1);
  }
}

runTests();
