import process from 'process';
process.env.NODE_ENV = 'test';

import { prisma } from '../src/lib/prisma.js';
import { hashPassword } from '../src/utils/password.js';
import { signAccessToken } from '../src/utils/jwt.js';
import app from '../src/app.js';
import sharp from 'sharp';
import {
  setTestStorageAdapter,
  getTestStorageAdapter,
  uploadBufferToR2,
  deleteObjectFromR2,
  resolveObjectAccessUrl,
} from '../src/services/r2.service.js';
import * as brandingService from '../src/services/branding.service.js';
import { buildReportHtmlDocument } from '../src/services/pdf-report.service.js';
import { getMadrasaContext } from '../src/services/report.service.js';

const TEST_PREFIX = 'brand_test_' + Date.now();
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

// In-Memory Test Storage Adapter simulating Cloudflare R2 strictly for tests
class MemoryTestStorageAdapter {
  constructor() {
    this.storage = new Map();
  }

  async uploadBuffer(key, buffer, contentType) {
    this.storage.set(key, { buffer: Buffer.from(buffer), contentType });
    return { key, size: buffer.length };
  }

  async getObjectBuffer(key) {
    const item = this.storage.get(key);
    if (!item) {
      const err = new Error(`NoSuchKey: ${key}`);
      err.name = 'NoSuchKey';
      throw err;
    }
    return item.buffer;
  }

  async deleteObject(key) {
    this.storage.delete(key);
    return true;
  }

  async resolveUrl(key) {
    return `https://test-r2.madrasanexa.internal/${key}`;
  }

  has(key) {
    return this.storage.has(key);
  }

  clear() {
    this.storage.clear();
  }
}

let mockStorage = new MemoryTestStorageAdapter();
let testServer = null;
let baseUrl = '';

// Test fixtures
let madrasaA = null;
let adminA = null;
let tokenA = '';

let madrasaB = null;
let adminB = null;
let tokenB = '';

let madrasaExpired = null;
let adminExpired = null;
let tokenExpired = '';

async function setup() {
  console.log('\n--- Setting Up Dynamic Madrasa Branding Test Fixtures ---');

  // Register the test storage adapter
  setTestStorageAdapter(mockStorage);

  const passwordHash = await hashPassword('TestPass1234!');

  // Madrasa A (Active)
  const randA = Math.random().toString(36).substring(2, 7).toUpperCase();
  const randB = Math.random().toString(36).substring(2, 7).toUpperCase();
  const randX = Math.random().toString(36).substring(2, 7).toUpperCase();

  madrasaA = await prisma.madrasa.create({
    data: {
      code: `A_${randA}`,
      name: 'Darul Uloom Al-Hikmah',
      slug: `${TEST_PREFIX}_slug_a`,
      email: `${TEST_PREFIX}_a@test.com`,
      phone: '+94771112233',
      address: '100 Galle Road, Colombo',
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

  adminA = await prisma.user.create({
    data: {
      name: 'Admin A',
      email: `${TEST_PREFIX}_admin_a@test.com`,
      passwordHash,
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

  // Active subscription for Madrasa A
  const plan = await prisma.plan.findFirst();
  await prisma.subscription.create({
    data: {
      madrasaId: madrasaA.id,
      planId: plan.id,
      status: 'ACTIVE',
      startsAt: new Date(Date.now() - 10 * 86400000),
      endsAt: new Date(Date.now() + 30 * 86400000),
      priceAtPurchase: 5000,
      durationMonthsAtPurchase: 1,
    },
  });

  // Madrasa B (Active Tenant B for isolation testing)
  madrasaB = await prisma.madrasa.create({
    data: {
      code: `B_${randB}`,
      name: 'Madina Academy',
      slug: `${TEST_PREFIX}_slug_b`,
      email: `${TEST_PREFIX}_b@test.com`,
      phone: '+94772223344',
      address: '200 Kandy Road, Kandy',
      status: 'ACTIVE',
      settings: {
        create: {
          currency: 'LKR',
          timezone: 'Asia/Colombo',
          invoicePrefix: 'INV-B-',
          receiptPrefix: 'REC-B-',
        },
      },
    },
  });

  adminB = await prisma.user.create({
    data: {
      name: 'Admin B',
      email: `${TEST_PREFIX}_admin_b@test.com`,
      passwordHash,
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

  await prisma.subscription.create({
    data: {
      madrasaId: madrasaB.id,
      planId: plan.id,
      status: 'ACTIVE',
      startsAt: new Date(Date.now() - 10 * 86400000),
      endsAt: new Date(Date.now() + 30 * 86400000),
      priceAtPurchase: 5000,
      durationMonthsAtPurchase: 1,
    },
  });

  // Madrasa Expired (Expired Subscription)
  madrasaExpired = await prisma.madrasa.create({
    data: {
      code: `X_${randX}`,
      name: 'Al-Noor Institute',
      slug: `${TEST_PREFIX}_slug_x`,
      email: `${TEST_PREFIX}_x@test.com`,
      status: 'ACTIVE',
      settings: {
        create: {
          currency: 'LKR',
          timezone: 'Asia/Colombo',
        },
      },
    },
  });

  adminExpired = await prisma.user.create({
    data: {
      name: 'Admin Expired',
      email: `${TEST_PREFIX}_admin_x@test.com`,
      passwordHash,
      role: 'MADRASA_ADMIN',
      madrasaId: madrasaExpired.id,
      isActive: true,
      mustChangePassword: false,
    },
  });

  tokenExpired = signAccessToken({
    userId: adminExpired.id,
    role: adminExpired.role,
    madrasaId: madrasaExpired.id,
  });

  await prisma.subscription.create({
    data: {
      madrasaId: madrasaExpired.id,
      planId: plan.id,
      status: 'EXPIRED',
      startsAt: new Date(Date.now() - 60 * 86400000),
      endsAt: new Date(Date.now() - 10 * 86400000),
      priceAtPurchase: 5000,
      durationMonthsAtPurchase: 1,
    },
  });

  // Start ephemeral HTTP server for API requests
  await new Promise((resolve) => {
    testServer = app.listen(0, () => {
      const port = testServer.address().port;
      baseUrl = `http://127.0.0.1:${port}/api`;
      resolve();
    });
  });

  console.log(`Test server running at ${baseUrl}`);
}

async function teardown() {
  console.log('\n--- Cleaning Up Dynamic Madrasa Branding Test Fixtures ---');
  if (testServer) {
    await new Promise((resolve) => testServer.close(resolve));
  }

  // Cleanup Database
  const madrasaIds = [madrasaA?.id, madrasaB?.id, madrasaExpired?.id].filter(Boolean);
  if (madrasaIds.length > 0) {
    await prisma.activityLog.deleteMany({ where: { madrasaId: { in: madrasaIds } } });
    await prisma.fileObject.deleteMany({ where: { madrasaId: { in: madrasaIds } } });
    await prisma.user.deleteMany({ where: { madrasaId: { in: madrasaIds } } });
    await prisma.madrasaSetting.deleteMany({ where: { madrasaId: { in: madrasaIds } } });
    await prisma.subscription.deleteMany({ where: { madrasaId: { in: madrasaIds } } });
    await prisma.madrasa.deleteMany({ where: { id: { in: madrasaIds } } });
  }

  mockStorage.clear();
}

async function runTests() {
  await setup();

  try {
    console.log('\n[TEST GROUP 1: R2 Mock Isolation & Configuration Safety]');
    // 1.1 Non-test mode prevents mock adapter registration
    {
      const prevEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      let threw = false;
      try {
        setTestStorageAdapter(new MemoryTestStorageAdapter());
      } catch (err) {
        threw = true;
      }
      process.env.NODE_ENV = prevEnv;
      assert(threw, '1.1 setTestStorageAdapter throws when NODE_ENV is not test (Correction 1)');
    }

    // 1.2 Initial state has no logo
    {
      const res = await fetch(`${baseUrl}/madrasa-admin/branding`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      const body = await res.json();
      assert(res.status === 200, '1.2 Initial GET /branding returns 200');
      assert(body.data.logoUrl === null, '1.2 Initial logoUrl is null');
      assert(body.data.logoFileId === null, '1.2 Initial logoFileId is null');
      assert(body.data.initials === 'DU', '1.2 Generates deterministic initials DU for Darul Uloom Al-Hikmah (Correction 25)');
    }

    console.log('\n[TEST GROUP 2: File & Security Validations]');
    // 2.1 Reject SVG uploads (Correction 6)
    {
      const svgBuffer = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
      let threw = false;
      let errorMsg = '';
      try {
        await brandingService.uploadMadrasaLogo(madrasaA.id, svgBuffer, 'evil.svg', adminA.id);
      } catch (err) {
        threw = true;
        errorMsg = err.message;
      }
      assert(threw, '2.1 Reject SVG upload attempt');
      assert(errorMsg.includes('SVG images are not allowed'), '2.1 Rejection message specifically flags SVG');
    }

    // 2.2 Reject non-image / corrupted buffers (Correction 6)
    {
      const corruptBuffer = Buffer.from('this is not an image file at all');
      let threw = false;
      try {
        await brandingService.uploadMadrasaLogo(madrasaA.id, corruptBuffer, 'corrupt.png', adminA.id);
      } catch (err) {
        threw = true;
      }
      assert(threw, '2.2 Reject non-image buffer');
    }

    // 2.3 Reject files exceeding 5MB (Correction 6)
    {
      const largeBuffer = Buffer.alloc(6 * 1024 * 1024); // 6 MB
      let threw = false;
      let errorMsg = '';
      try {
        await brandingService.uploadMadrasaLogo(madrasaA.id, largeBuffer, 'huge.jpg', adminA.id);
      } catch (err) {
        threw = true;
        errorMsg = err.message;
      }
      assert(threw, '2.3 Reject files exceeding 5 MB');
      assert(errorMsg.includes('smaller than 5 MB'), '2.3 Error message informs 5 MB limit');
    }

    console.log('\n[TEST GROUP 3: Successful Upload, Sharp WebP Conversion & Metadata]');
    let logoAFileId = null;
    let logoAKey = null;
    {
      // Create a test 600x400 PNG image
      const testImageBuffer = await sharp({
        create: {
          width: 600,
          height: 400,
          channels: 4,
          background: { r: 55, g: 198, b: 163, alpha: 1 },
        },
      })
        .png()
        .toBuffer();

      const result = await brandingService.uploadMadrasaLogo(
        madrasaA.id,
        testImageBuffer,
        'official_emblem.png',
        adminA.id
      );

      assert(result.success === true, '3.1 Upload succeeds');
      assert(Boolean(result.data.fileId), '3.1 Returns new fileId');
      assert(result.data.mimeType === 'image/webp', '3.1 Output mimeType is image/webp (Correction 9)');

      logoAFileId = result.data.fileId;

      // Verify Database state
      const dbMadrasa = await prisma.madrasa.findUnique({
        where: { id: madrasaA.id },
        select: { logoFileId: true },
      });
      assert(dbMadrasa.logoFileId === logoAFileId, '3.2 Madrasa.logoFileId updated in MySQL (Correction 26)');

      const fileRecord = await prisma.fileObject.findUnique({
        where: { id: logoAFileId },
      });
      assert(fileRecord !== null, '3.3 FileObject created in MySQL');
      assert(fileRecord.madrasaId === madrasaA.id, '3.3 FileObject is tenant-owned (Correction 26)');
      assert(fileRecord.mimeType === 'image/webp', '3.3 FileObject.mimeType is image/webp (Correction 9)');
      assert(fileRecord.size === result.data.size, '3.3 FileObject.size matches converted WebP length (Correction 9)');

      logoAKey = fileRecord.objectKey;
      assert(mockStorage.has(logoAKey), '3.4 Converted WebP exists in R2 storage');

      // Verify aspect ratio preservation via Sharp inspection (Correction 8)
      const storedBuffer = await mockStorage.getObjectBuffer(logoAKey);
      const meta = await sharp(storedBuffer).metadata();
      assert(meta.format === 'webp', '3.5 Stored object is WebP format');
      assert(meta.width === 512, '3.5 Image scaled proportionally to max width 512');
      assert(meta.height === 341, '3.5 Aspect ratio preserved (600x400 -> 512x341, no forced square crop) (Correction 8)');

      // Verify ActivityLog
      const log = await prisma.activityLog.findFirst({
        where: { madrasaId: madrasaA.id, action: 'MADRASA_LOGO_UPDATED' },
      });
      assert(Boolean(log), '3.6 ActivityLog MADRASA_LOGO_UPDATED recorded (Correction 22)');
    }

    console.log('\n[TEST GROUP 4: Persistence Across Sessions & Multi-Tenant Isolation]');
    // 4.1 GET /branding returns the uploaded logo
    {
      const res = await fetch(`${baseUrl}/madrasa-admin/branding`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      const body = await res.json();
      assert(res.status === 200, '4.1 GET /branding returns 200');
      assert(body.data.logoFileId === logoAFileId, '4.1 Branding returns active logoFileId');
      assert(body.data.logoUrl.includes(logoAKey), '4.1 Branding returns dynamic logo access URL');
    }

    // 4.2 GET /auth/me returns the uploaded logo
    {
      const res = await fetch(`${baseUrl}/auth/me`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      const body = await res.json();
      assert(res.status === 200, '4.2 GET /auth/me returns 200');
      assert(Boolean(body.data.user.madrasa?.logoUrl), '4.2 /auth/me returns user.madrasa.logoUrl for sidebar');
    }

    // 4.3 GET /settings returns the uploaded logo
    {
      const res = await fetch(`${baseUrl}/madrasa-admin/settings`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      const body = await res.json();
      assert(res.status === 200, '4.3 GET /settings returns 200');
      assert(body.data.madrasa.logoFileId === logoAFileId, '4.3 Settings returns logoFileId');
      assert(Boolean(body.data.madrasa.logoUrl), '4.3 Settings returns logoUrl');
    }

    // 4.4 Strict Tenant Isolation: Tenant B has no logo and cannot access Tenant A's logo (Correction 26)
    {
      const resB = await fetch(`${baseUrl}/madrasa-admin/branding`, {
        headers: { Authorization: `Bearer ${tokenB}` },
      });
      const bodyB = await resB.json();
      assert(bodyB.data.logoFileId === null, '4.4 Madrasa B logoFileId is null');
      assert(bodyB.data.logoUrl === null, '4.4 Madrasa B logoUrl is null');
      assert(bodyB.data.initials === 'MA', '4.4 Madrasa B initials are MA for Madina Academy');
    }

    console.log('\n[TEST GROUP 5: Safe Replacement, Old Logo Cleanup & Concurrency]');
    let logoA2FileId = null;
    let logoA2Key = null;
    {
      // Replace with Logo 2
      const newBuffer = await sharp({
        create: {
          width: 400,
          height: 400,
          channels: 4,
          background: { r: 15, g: 23, b: 42, alpha: 1 },
        },
      })
        .png()
        .toBuffer();

      const result = await brandingService.uploadMadrasaLogo(
        madrasaA.id,
        newBuffer,
        'new_emblem.png',
        adminA.id
      );

      logoA2FileId = result.data.fileId;
      assert(logoA2FileId !== logoAFileId, '5.1 New logo has distinct fileId');

      const fileRecord = await prisma.fileObject.findUnique({
        where: { id: logoA2FileId },
      });
      logoA2Key = fileRecord.objectKey;

      // Check that DB points to new logo
      const dbMadrasa = await prisma.madrasa.findUnique({
        where: { id: madrasaA.id },
        select: { logoFileId: true },
      });
      assert(dbMadrasa.logoFileId === logoA2FileId, '5.2 Madrasa points to new logo ID');

      // Wait a tick for asynchronous cleanup
      await new Promise((r) => setTimeout(r, 200));

      // Check old logo was cleaned up from storage and DB (Correction 3 & 21)
      assert(!mockStorage.has(logoAKey), '5.3 Old logo key cleaned up from storage');
      const oldDbRecord = await prisma.fileObject.findUnique({
        where: { id: logoAFileId },
      });
      assert(oldDbRecord === null, '5.4 Old FileObject deleted from database');
      assert(mockStorage.has(logoA2Key), '5.5 New logo remains in storage');
    }

    console.log('\n[TEST GROUP 6: Safe Removal & Idempotence]');
    {
      const result = await brandingService.removeMadrasaLogo(madrasaA.id, adminA.id);
      assert(result.success === true, '6.1 Remove logo succeeds');

      const dbMadrasa = await prisma.madrasa.findUnique({
        where: { id: madrasaA.id },
        select: { logoFileId: true },
      });
      assert(dbMadrasa.logoFileId === null, '6.2 Madrasa.logoFileId unlinked to null (Correction 4)');

      await new Promise((r) => setTimeout(r, 200));
      assert(!mockStorage.has(logoA2Key), '6.3 Removed logo cleaned up from storage');

      const log = await prisma.activityLog.findFirst({
        where: { madrasaId: madrasaA.id, action: 'MADRASA_LOGO_REMOVED' },
      });
      assert(Boolean(log), '6.4 ActivityLog MADRASA_LOGO_REMOVED recorded (Correction 22)');

      // Idempotent removal
      const result2 = await brandingService.removeMadrasaLogo(madrasaA.id, adminA.id);
      assert(result2.success === true, '6.5 Idempotent second removal succeeds without error');
    }

    console.log('\n[TEST GROUP 7: PDF Logo Data URI & Preview Isolation]');
    {
      // Upload fresh logo
      const img = await sharp({
        create: {
          width: 300,
          height: 300,
          channels: 4,
          background: { r: 255, g: 0, b: 0, alpha: 1 },
        },
      })
        .png()
        .toBuffer();

      await brandingService.uploadMadrasaLogo(madrasaA.id, img, 'pdf_logo.png', adminA.id);

      // 7.1 getMadrasaContext for Preview/CSV does NOT download logo bytes (Correction 2)
      const context = await getMadrasaContext(madrasaA.id);
      assert(!context.logoUrl?.startsWith('data:'), '7.1 getMadrasaContext does not generate data URI for Preview/CSV');

      // 7.2 resolveLogoDataUri downloads bytes ONLY for PDF (Correction 2, 17, 18)
      const dataUri = await brandingService.resolveLogoDataUri(madrasaA.id);
      assert(Boolean(dataUri), '7.2 resolveLogoDataUri succeeds');
      assert(dataUri.startsWith('data:image/webp;base64,'), '7.2 Logo encoded as data:image/webp;base64,...');

      // 7.3 buildReportHtmlDocument includes the image tag with data URI (Correction 19)
      const reportDataWithLogo = {
        madrasa: {
          id: madrasaA.id,
          name: madrasaA.name,
          logoDataUri: dataUri,
        },
        title: 'Paid Students Report',
        period: 'September 2026',
        reportType: 'PAID_STUDENTS',
        records: [],
      };
      const htmlWithLogo = buildReportHtmlDocument(reportDataWithLogo);
      assert(htmlWithLogo.includes('class="madrasa-logo"'), '7.3 HTML includes madrasa-logo class');
      assert(htmlWithLogo.includes('data:image/webp;base64,'), '7.3 HTML embeds data URI directly');

      // 7.4 Non-blocking fallback when logo is removed or missing (Correction 20)
      await brandingService.removeMadrasaLogo(madrasaA.id, adminA.id);
      const missingDataUri = await brandingService.resolveLogoDataUri(madrasaA.id);
      assert(missingDataUri === null, '7.4 resolveLogoDataUri returns null when no logo exists');

      const reportDataNoLogo = {
        madrasa: {
          id: madrasaA.id,
          name: madrasaA.name,
          logoDataUri: null,
        },
        title: 'Paid Students Report',
        period: 'September 2026',
        reportType: 'PAID_STUDENTS',
        records: [],
      };
      const htmlNoLogo = buildReportHtmlDocument(reportDataNoLogo);
      assert(!htmlNoLogo.includes('class="madrasa-logo"'), '7.4 HTML omits logo tag cleanly without crashing');
      assert(htmlNoLogo.includes(madrasaA.name), '7.4 Madrasa text branding remains intact');
    }

    console.log('\n[TEST GROUP 8: Subscription Gating]');
    // 8.1 Expired admin can still read branding (Correction 12)
    {
      const res = await fetch(`${baseUrl}/madrasa-admin/branding`, {
        headers: { Authorization: `Bearer ${tokenExpired}` },
      });
      assert(res.status === 200, '8.1 GET /branding is exempt from requireActiveSubscription (Correction 12)');
    }

    // 8.2 Expired admin cannot mutate branding
    {
      const res = await fetch(`${baseUrl}/madrasa-admin/branding/logo`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenExpired}` },
      });
      assert(res.status === 403, '8.2 DELETE /branding/logo blocked for expired subscription');
    }

  } finally {
    await teardown();
  }

  console.log('\n=============================================');
  console.log(`TOTAL TESTS: ${testPassedCount + testFailedCount}`);
  console.log(`PASSED: ${testPassedCount}`);
  console.log(`FAILED: ${testFailedCount}`);
  console.log('=============================================\n');

  if (testFailedCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
