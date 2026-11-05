import './setup-test-env.js';
import { prisma } from '../src/lib/prisma.js';
import { hashPassword } from '../src/utils/password.js';
import { signAccessToken } from '../src/utils/jwt.js';
import app from '../src/app.js';

const TEST_PREFIX = 'hp_test_' + Date.now();

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
let madrasaAdminUser = null;
let madrasaAdminToken = '';

async function setup() {
  console.log('\n--- Setting up Homepage CMS Test Fixtures ---');

  // 1. Create Super Admin
  superAdminUser = await prisma.user.create({
    data: {
      name: 'CMS Super Admin',
      email: `${TEST_PREFIX}_super@example.com`,
      passwordHash: await hashPassword('SuperSecureP@ss123!'),
      role: 'SUPER_ADMIN',
      madrasaId: null,
      isActive: true,
      mustChangePassword: false,
    },
  });
  superAdminToken = signAccessToken({
    userId: superAdminUser.id,
    role: superAdminUser.role,
    madrasaId: null,
  });

  // 2. Create Tenant Madrasa & Madrasa Admin
  madrasa = await prisma.madrasa.create({
    data: {
      name: 'Noor Academy',
      code: `${TEST_PREFIX.slice(-5).toUpperCase()}N`,
      slug: `na-${Date.now().toString().slice(-6)}`,
      email: `${TEST_PREFIX}_na@example.com`,
      status: 'ACTIVE',
    },
  });
  madrasaAdminUser = await prisma.user.create({
    data: {
      name: 'Madrasa Admin Noor',
      email: `${TEST_PREFIX}_madmin@example.com`,
      passwordHash: await hashPassword('MAdminSecureA123!'),
      role: 'MADRASA_ADMIN',
      madrasaId: madrasa.id,
      isActive: true,
      mustChangePassword: false,
    },
  });
  madrasaAdminToken = signAccessToken({
    userId: madrasaAdminUser.id,
    role: madrasaAdminUser.role,
    madrasaId: madrasa.id,
  });

  // Ensure an active Plan exists
  const existingPlan = await prisma.plan.findFirst({ where: { isActive: true } });
  if (!existingPlan) {
    await prisma.plan.create({
      data: {
        name: 'Standard Plan',
        code: `${TEST_PREFIX}_STD`,
        description: 'Standard institutional plan',
        price: 15000,
        durationMonths: 6,
        isActive: true,
      },
    });
  }

  // Start HTTP Server on ephemeral port
  await new Promise((resolve) => {
    testServer = app.listen(0, () => {
      const port = testServer.address().port;
      baseUrl = `http://127.0.0.1:${port}/api`;
      console.log(`Test server running at ${baseUrl}`);
      resolve();
    });
  });
}

async function teardown() {
  console.log('\n--- Tearing down Homepage CMS Test Fixtures ---');
  if (testServer) {
    await new Promise((resolve) => testServer.close(resolve));
  }
  if (madrasaAdminUser) {
    await prisma.user.delete({ where: { id: madrasaAdminUser.id } }).catch(() => {});
  }
  if (madrasa) {
    await prisma.madrasa.delete({ where: { id: madrasa.id } }).catch(() => {});
  }
  if (superAdminUser) {
    await prisma.user.delete({ where: { id: superAdminUser.id } }).catch(() => {});
  }
}

async function runTests() {
  try {
    await setup();

    // =========================================================================
    // GROUP 1: PUBLIC HOMEPAGE RETRIEVAL & PRIVACY
    // =========================================================================
    console.log('\n--- Group 1: Public Homepage Retrieval & Privacy ---');

    // Ensure status is UNPUBLISHED or DRAFT initially
    await prisma.homepageContent.upsert({
      where: { id: 'global' },
      update: { status: 'DRAFT', publishedContent: null },
      create: { id: 'global', status: 'DRAFT', publishedContent: null },
    });

    // 1. Unauthenticated visitor can fetch public homepage (HTTP 200)
    const pubRes1 = await fetch(`${baseUrl}/public/homepage`);
    assert(pubRes1.status === 200, '1. Public homepage endpoint returns HTTP 200 for unauthenticated visitor');
    const pubJson1 = await pubRes1.json();
    assert(pubJson1.success === true, 'Response indicates success: true');
    assert(pubJson1.data.isPublished === false, '2. isPublished is false when unpublished');
    assert(pubJson1.data.content === null, '3. Draft content is NEVER exposed publicly when unpublished');
    assert(Array.isArray(pubJson1.data.plans) && pubJson1.data.plans.length >= 1, '4. Real active plans returned in public payload');
    assert(!pubJson1.data.plans.some(p => p.price === undefined || p.name === undefined), 'Plans contain valid names and prices');

    // =========================================================================
    // GROUP 2: AUTHENTICATION & AUTHORIZATION BOUNDARIES
    // =========================================================================
    console.log('\n--- Group 2: Authorization Boundaries ---');

    // 5. Unauthenticated call to CMS editor returns 401
    const unauthCms = await fetch(`${baseUrl}/super-admin/website-content/homepage`);
    assert(unauthCms.status === 401, '5. Unauthenticated GET /website-content/homepage rejected with HTTP 401');

    const unauthPut = await fetch(`${baseUrl}/super-admin/website-content/homepage`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hero: { title: 'Hacked Title' } }),
    });
    assert(unauthPut.status === 401, '6. Unauthenticated PUT /website-content/homepage rejected with HTTP 401');

    const unauthPub = await fetch(`${baseUrl}/super-admin/website-content/homepage/publish`, {
      method: 'POST',
    });
    assert(unauthPub.status === 401, '7. Unauthenticated POST /publish rejected with HTTP 401');

    // 8. Madrasa Admin call to Super Admin CMS returns 403
    const madrasaGet = await fetch(`${baseUrl}/super-admin/website-content/homepage`, {
      headers: { Authorization: `Bearer ${madrasaAdminToken}` },
    });
    assert(madrasaGet.status === 403, '8. Madrasa Admin GET /website-content/homepage rejected with HTTP 403');

    const madrasaPut = await fetch(`${baseUrl}/super-admin/website-content/homepage`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${madrasaAdminToken}`,
      },
      body: JSON.stringify({ hero: { title: 'Rogue Title' } }),
    });
    assert(madrasaPut.status === 403, '9. Madrasa Admin PUT /website-content/homepage rejected with HTTP 403');

    // =========================================================================
    // GROUP 3: SUPER ADMIN DRAFT MANAGEMENT & INPUT VALIDATION
    // =========================================================================
    console.log('\n--- Group 3: Super Admin Draft Management & Validation ---');

    // 10. Super Admin can fetch draft
    const saGet = await fetch(`${baseUrl}/super-admin/website-content/homepage`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert(saGet.status === 200, '10. Super Admin GET draft returns HTTP 200');
    const saGetJson = await saGet.json();
    assert(!!saGetJson.data.draftContent, 'Draft content structure returned to Super Admin');

    // 11. Super Admin can update draft
    const updatedHeroTitle = 'Modern Madrasa Operating System 2026';
    const saPut = await fetch(`${baseUrl}/super-admin/website-content/homepage`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        hero: {
          title: updatedHeroTitle,
          description: 'Updated test description for verified testing.',
          primaryCtaLabel: 'Get Started Today',
          primaryCtaUrl: '/register',
        },
      }),
    });
    assert(saPut.status === 200, '11. Super Admin can update draft with valid fields (HTTP 200)');

    // 12. Public endpoint does NOT reflect draft changes before publish
    const pubRes2 = await fetch(`${baseUrl}/public/homepage`);
    const pubJson2 = await pubRes2.json();
    assert(pubJson2.data.isPublished === false, '12. Public status remains false after saving draft');
    assert(pubJson2.data.content === null, 'Public content remains null after saving draft');

    // 13. Unsafe javascript: URL rejected by Zod validation
    const saMaliciousUrl = await fetch(`${baseUrl}/super-admin/website-content/homepage`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        hero: {
          title: 'Testing XSS',
          primaryCtaUrl: 'javascript:alert(1)',
        },
      }),
    });
    assert(saMaliciousUrl.status === 400, '13. Unsafe javascript: URL scheme rejected with HTTP 400');

    // 14. Unapproved icon rejected by Zod validation
    const saBadIcon = await fetch(`${baseUrl}/super-admin/website-content/homepage`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        features: [
          {
            id: 'feat-bad',
            title: 'Bad Feature',
            description: 'Testing unapproved icon',
            icon: 'UnapprovedRandomIconName',
          },
        ],
      }),
    });
    assert(saBadIcon.status === 400, '14. Unapproved icon name rejected with HTTP 400');

    // =========================================================================
    // GROUP 4: PUBLISH & UNPUBLISH LIFECYCLE
    // =========================================================================
    console.log('\n--- Group 4: Publish & Unpublish Lifecycle ---');

    // 15. Super Admin publishes homepage
    const saPubRes = await fetch(`${baseUrl}/super-admin/website-content/homepage/publish`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert(saPubRes.status === 200, '15. Super Admin publish returns HTTP 200');
    const saPubJson = await saPubRes.json();
    assert(saPubJson.data.status === 'PUBLISHED', 'Publication status is PUBLISHED');

    // 16. Public endpoint now reflects published snapshot
    const pubRes3 = await fetch(`${baseUrl}/public/homepage`);
    const pubJson3 = await pubRes3.json();
    assert(pubJson3.data.isPublished === true, '16. Public endpoint isPublished is true after publishing');
    assert(pubJson3.data.content?.hero?.title === updatedHeroTitle, '17. Public content reflects published headline');
    assert(Array.isArray(pubJson3.data.content?.features), 'Features array is present in published content');

    // 18. Super Admin unpublishes homepage
    const saUnpubRes = await fetch(`${baseUrl}/super-admin/website-content/homepage/unpublish`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert(saUnpubRes.status === 200, '18. Super Admin unpublish returns HTTP 200');

    // 19. Public endpoint immediately reflects unpublished state
    const pubRes4 = await fetch(`${baseUrl}/public/homepage`);
    const pubJson4 = await pubRes4.json();
    assert(pubJson4.data.isPublished === false, '19. Public endpoint isPublished is false after unpublish');
    // =========================================================================
    // GROUP 5: HERO MEDIA SLIDER & WHATSAPP DRAFT VALIDATION
    // =========================================================================
    console.log('\n--- Group 5: Hero Media Slider & WhatsApp Draft Validation ---');

    // 21. Rejection of heroMedia autoplayInterval < 3000ms
    const saBadIntervalRes = await fetch(`${baseUrl}/super-admin/website-content/homepage`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        heroMedia: {
          enabled: true,
          autoplay: true,
          autoplayInterval: 1000,
        },
      }),
    });
    assert(saBadIntervalRes.status === 400, '21. heroMedia autoplayInterval < 3000ms rejected with HTTP 400');

    // 22. Rejection of > 8 heroMedia items
    const nineItems = Array.from({ length: 9 }, (_, i) => ({
      id: `item-${i + 1}`,
      fileId: `file-${i + 1}`,
      alt: `Image ${i + 1}`,
      enabled: true,
      sortOrder: i + 1,
    }));
    const saTooManyImagesRes = await fetch(`${baseUrl}/super-admin/website-content/homepage`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        heroMedia: {
          items: nineItems,
        },
      }),
    });
    assert(saTooManyImagesRes.status === 400, '22. More than 8 heroMedia items rejected with HTTP 400');

    // 23. Rejection of invalid WhatsApp phone number
    const saBadWhatsAppRes = await fetch(`${baseUrl}/super-admin/website-content/homepage`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        whatsapp: {
          enabled: true,
          number: 'invalid-not-a-number',
        },
      }),
    });
    assert(saBadWhatsAppRes.status === 400, '23. Invalid WhatsApp number rejected with HTTP 400');

    // 23b. Rejection of enabled hero image with alt text < 3 characters
    // Fixture for hero item validation
    await prisma.fileObject.upsert({
      where: { id: 'file-123' },
      update: {
        madrasaId: null,
        type: 'OTHER',
        objectKey: 'platform/homepage/hero/file-123.webp',
        originalName: 'file-123.webp',
        mimeType: 'image/webp',
        size: 1024,
      },
      create: {
        id: 'file-123',
        madrasaId: null,
        type: 'OTHER',
        objectKey: 'platform/homepage/hero/file-123.webp',
        originalName: 'file-123.webp',
        mimeType: 'image/webp',
        size: 1024,
      },
    });

    const saShortAltRes = await fetch(`${baseUrl}/super-admin/website-content/homepage`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        heroMedia: {
          items: [
            {
              id: 'item-short-alt',
              fileId: 'file-123',
              alt: 'hi', // < 3 characters
              enabled: true,
              sortOrder: 1,
            },
          ],
        },
      }),
    });
    assert(saShortAltRes.status === 400, '23b. Enabled hero image with alt < 3 characters rejected with HTTP 400');

    // 23c. Acceptance of disabled hero image with empty alt text
    const saDisabledEmptyAltRes = await fetch(`${baseUrl}/super-admin/website-content/homepage`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        heroMedia: {
          items: [
            {
              id: 'item-disabled-empty',
              fileId: 'file-123',
              alt: '', // empty alt allowed when disabled
              enabled: false,
              sortOrder: 1,
            },
          ],
        },
      }),
    });
    assert(saDisabledEmptyAltRes.status === 200, '23c. Disabled hero image with empty alt text accepted with HTTP 200');

    // =========================================================================
    // GROUP 6: IMAGE UPLOAD & PERMISSION CHECKS
    // =========================================================================
    console.log('\n--- Group 6: Image Upload & Permission Checks ---');

    // 24. Unauthenticated image upload rejected with 401
    const unauthUploadRes = await fetch(`${baseUrl}/super-admin/website-content/homepage/images`, {
      method: 'POST',
    });
    assert(unauthUploadRes.status === 401, '24. Unauthenticated image upload returns HTTP 401');

    // 25. Madrasa Admin image upload rejected with 403
    const madminUploadRes = await fetch(`${baseUrl}/super-admin/website-content/homepage/images`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${madrasaAdminToken}` },
    });
    assert(madminUploadRes.status === 403, '25. Madrasa Admin image upload returns HTTP 403');

    // 26. Uploading unsupported file format rejected with 400
    const textBlob = new Blob(['Sample plain text content'], { type: 'text/plain' });
    const badFd = new FormData();
    badFd.append('images', textBlob, 'notes.txt');
    const badUploadRes = await fetch(`${baseUrl}/super-admin/website-content/homepage/images`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}` },
      body: badFd,
    });
    assert(badUploadRes.status === 400, '26. Non-image upload rejected with HTTP 400');

    // 27. Super Admin successfully uploads valid image
    const samplePng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );
    const validFd = new FormData();
    validFd.append('images', new Blob([samplePng], { type: 'image/png' }), 'test-hero-1.png');

    const saUploadRes = await fetch(`${baseUrl}/super-admin/website-content/homepage/images`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}` },
      body: validFd,
    });
    assert(saUploadRes.status === 201, '27. Super Admin image upload returns HTTP 201');
    const saUploadJson = await saUploadRes.json();
    assert(Array.isArray(saUploadJson.data) && saUploadJson.data.length === 1, 'Uploaded images returned in data array');
    const uploadedFileId = saUploadJson.data[0].id;
    assert(Boolean(uploadedFileId), 'Uploaded image record contains file ID');

    // Verify FileObject in DB
    const fileObjDb = await prisma.fileObject.findUnique({ where: { id: uploadedFileId } });
    assert(fileObjDb !== null, 'FileObject created in DB');
    assert(fileObjDb.madrasaId === null, 'FileObject.madrasaId is strictly null (platform-owned)');
    assert(fileObjDb.mimeType === 'image/webp', 'Image optimized and stored as WebP');

    // =========================================================================
    // GROUP 7: DRAFT ISOLATION, PUBLISHING & DELETION SAFETY
    // =========================================================================
    console.log('\n--- Group 7: Draft Isolation, Publishing & Deletion Safety ---');

    // 28. Save uploaded image to draft
    const customWhatsAppMsg = 'Custom Test Inquiry Greeting';
    const saSaveDraftMediaRes = await fetch(`${baseUrl}/super-admin/website-content/homepage`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        heroMedia: {
          enabled: true,
          autoplay: true,
          autoplayInterval: 4000,
          items: [
            {
              id: 'media-item-1',
              fileId: uploadedFileId,
              alt: 'Modern Madrasa Class',
              caption: 'Digital Classroom',
              enabled: true,
              sortOrder: 1,
            },
          ],
        },
        whatsapp: {
          enabled: true,
          number: '+94 78 325 4552',
          defaultMessage: customWhatsAppMsg,
        },
      }),
    });
    assert(saSaveDraftMediaRes.status === 200, '28. Save draft with heroMedia and whatsapp returns HTTP 200');

    // 29. Deletion safety: Cannot delete image while referenced in draft
    const deleteDraftRefRes = await fetch(
      `${baseUrl}/super-admin/website-content/homepage/images/${uploadedFileId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${superAdminToken}` },
      }
    );
    assert(deleteDraftRefRes.status === 400, '29. Deleting image referenced in draft rejected with HTTP 400');

    // 30. Draft isolation: Verify public endpoint DOES NOT expose draft heroMedia / custom WhatsApp
    // Currently published status was set to false by unpublish in step 18
    const pubCheckDraftRes = await fetch(`${baseUrl}/public/homepage`);
    const pubCheckDraftJson = await pubCheckDraftRes.json();
    assert(pubCheckDraftJson.data.isPublished === false, '30. Draft heroMedia not visible on public endpoint while unpublished');

    // 31. Publish homepage
    const publishMediaRes = await fetch(`${baseUrl}/super-admin/website-content/homepage/publish`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert(publishMediaRes.status === 200, '31. Super Admin publishes updated homepage with heroMedia');

    // 32. Verify published public endpoint exposes resolved heroMedia and WhatsApp
    const pubMediaRes = await fetch(`${baseUrl}/public/homepage`);
    const pubMediaJson = await pubMediaRes.json();
    assert(pubMediaJson.data.isPublished === true, '32. Public endpoint isPublished is true');
    assert(pubMediaJson.data.content?.heroMedia?.enabled === true, 'Public heroMedia is enabled');
    assert(
      Array.isArray(pubMediaJson.data.content?.heroMedia?.items) &&
        pubMediaJson.data.content.heroMedia.items.length === 1,
      'Public heroMedia contains resolved image items'
    );
    assert(
      Boolean(pubMediaJson.data.content.heroMedia.items[0].url),
      'Public heroMedia item has resolved URL'
    );
    assert(
      pubMediaJson.data.content?.whatsapp?.defaultMessage === customWhatsAppMsg,
      'Public whatsapp section reflects published default message'
    );

    // 33. Deletion safety: Cannot delete image while referenced in published content
    // Even if removed from draft:
    await fetch(`${baseUrl}/super-admin/website-content/homepage`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        heroMedia: {
          items: [],
        },
      }),
    });
    const deletePubRefRes = await fetch(
      `${baseUrl}/super-admin/website-content/homepage/images/${uploadedFileId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${superAdminToken}` },
      }
    );
    assert(deletePubRefRes.status === 400, '33. Deleting image referenced in published content rejected with HTTP 400');

    // 34. Publish empty draft so image is completely unreferenced
    await fetch(`${baseUrl}/super-admin/website-content/homepage/publish`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });

    // 35. Deletion safety: Unreferenced image can now be safely deleted
    const deleteSuccessRes = await fetch(
      `${baseUrl}/super-admin/website-content/homepage/images/${uploadedFileId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${superAdminToken}` },
      }
    );
    assert(deleteSuccessRes.status === 200, '34. Unreferenced image successfully deleted with HTTP 200');

    // Verify deleted from DB
    const deletedFileDb = await prisma.fileObject.findUnique({ where: { id: uploadedFileId } });
    assert(deletedFileDb === null, '35. FileObject deleted from database');

    // =========================================================================
    // GROUP 8: SECTION MEDIA MANAGEMENT & FILEOBJECT REFERENCE SECURITY
    // =========================================================================
    console.log('\n--- Group 8: Section Media Management & Security Validation ---');

    // 36. Upload image with section = 'product-preview'
    const previewFd = new FormData();
    previewFd.append('images', new Blob([samplePng], { type: 'image/png' }), 'dashboard-preview.png');
    previewFd.append('section', 'product-preview');

    const previewUploadRes = await fetch(`${baseUrl}/super-admin/website-content/homepage/images?section=product-preview`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}` },
      body: previewFd,
    });
    assert(previewUploadRes.status === 201, '36. Upload image with section = product-preview returns HTTP 201');
    const previewUploadJson = await previewUploadRes.json();
    const previewFileId = previewUploadJson.data[0].id;
    const previewFileDb = await prisma.fileObject.findUnique({ where: { id: previewFileId } });
    assert(previewFileDb.objectKey.startsWith('platform/homepage/sections/product-preview/'), 'Product preview objectKey starts with platform/homepage/sections/product-preview/');

    // 37. Upload image with section = 'features'
    const featuresFd = new FormData();
    featuresFd.append('images', new Blob([samplePng], { type: 'image/png' }), 'student-records.png');
    featuresFd.append('section', 'features');

    const featuresUploadRes = await fetch(`${baseUrl}/super-admin/website-content/homepage/images?section=features`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}` },
      body: featuresFd,
    });
    assert(featuresUploadRes.status === 201, '37. Upload image with section = features returns HTTP 201');
    const featuresUploadJson = await featuresUploadRes.json();
    const featuresFileId = featuresUploadJson.data[0].id;
    const featuresFileDb = await prisma.fileObject.findUnique({ where: { id: featuresFileId } });
    assert(featuresFileDb.objectKey.startsWith('platform/homepage/sections/features/'), 'Features objectKey starts with platform/homepage/sections/features/');

    // 38. Upload with unwhitelisted section rejected with 400
    const badSectionFd = new FormData();
    badSectionFd.append('images', new Blob([samplePng], { type: 'image/png' }), 'security.png');
    badSectionFd.append('section', 'unauthorized-section');

    const badSectionUploadRes = await fetch(`${baseUrl}/super-admin/website-content/homepage/images?section=unauthorized-section`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}` },
      body: badSectionFd,
    });
    assert(badSectionUploadRes.status === 400, '38. Upload with unwhitelisted section rejected with HTTP 400');

    // 39. ProductPreviewMedia validation
    // 39a. Enabled with fileId, alt < 3 characters rejected with 400
    const badPreviewAltRes = await fetch(`${baseUrl}/super-admin/website-content/homepage`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        productPreviewMedia: {
          enabled: true,
          fileId: previewFileId,
          alt: 'hi', // < 3 characters
          caption: 'Dashboard Overview',
        },
      }),
    });
    assert(badPreviewAltRes.status === 400, '39a. Product preview with short alt rejected with HTTP 400');

    // 39b. Enabled with fileId, valid alt accepted with 200
    const goodPreviewAltRes = await fetch(`${baseUrl}/super-admin/website-content/homepage`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        productPreviewMedia: {
          enabled: true,
          fileId: previewFileId,
          alt: 'MadrasaNexa Live Administrative Portal',
          caption: 'Interactive Portal Suite',
        },
      }),
    });
    assert(goodPreviewAltRes.status === 200, '39b. Product preview with valid alt accepted with HTTP 200');

    // 39c. Disabled with fileId and empty alt accepted with 200
    const disabledPreviewAltRes = await fetch(`${baseUrl}/super-admin/website-content/homepage`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        productPreviewMedia: {
          enabled: false,
          fileId: previewFileId,
          alt: '',
          caption: null,
        },
      }),
    });
    assert(disabledPreviewAltRes.status === 200, '39c. Disabled product preview with empty alt accepted with HTTP 200');

    // Restore enabled product preview
    await fetch(`${baseUrl}/super-admin/website-content/homepage`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        productPreviewMedia: {
          enabled: true,
          fileId: previewFileId,
          alt: 'MadrasaNexa Live Administrative Portal',
          caption: 'Interactive Portal Suite',
        },
      }),
    });

    // 40. Features visual media validation
    // 40a. Feature enabled with imageFileId and alt < 3 chars rejected with 400
    const badFeatureAltRes = await fetch(`${baseUrl}/super-admin/website-content/homepage`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        features: [
          {
            id: 'feat-students',
            title: 'Student & Academic Records',
            description: 'Comprehensive student profiles.',
            icon: 'GraduationCap',
            sortOrder: 1,
            enabled: true,
            imageFileId: featuresFileId,
            imageAlt: 'ab', // < 3 chars
            imageCaption: null,
          },
        ],
      }),
    });
    assert(badFeatureAltRes.status === 400, '40a. Feature with short alt rejected with HTTP 400');

    // 40b. Feature enabled with imageFileId and valid alt accepted with 200
    const goodFeatureAltRes = await fetch(`${baseUrl}/super-admin/website-content/homepage`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        features: [
          {
            id: 'feat-students',
            title: 'Student & Academic Records',
            description: 'Comprehensive student profiles.',
            icon: 'GraduationCap',
            sortOrder: 1,
            enabled: true,
            imageFileId: featuresFileId,
            imageAlt: 'Student Records Directory View',
            imageCaption: 'Academic Profiles and Records',
          },
        ],
      }),
    });
    assert(goodFeatureAltRes.status === 200, '40b. Feature with valid alt accepted with HTTP 200');

    // 41. Security Reference Validation (Tenant file, private receipt, non-homepage)
    // Create malicious fixture FileObjects
    const tenantFile = await prisma.fileObject.create({
      data: {
        madrasaId: madrasa.id, // belongs to tenant
        type: 'OTHER',
        objectKey: 'tenant/secret/file.webp',
        originalName: 'secret.webp',
        mimeType: 'image/webp',
        size: 512,
      },
    });

    const receiptFile = await prisma.fileObject.create({
      data: {
        madrasaId: null,
        type: 'OTHER',
        objectKey: 'receipts/subscription/private-receipt.pdf', // private receipt!
        originalName: 'receipt.pdf',
        mimeType: 'application/pdf',
        size: 1024,
      },
    });

    const foreignFile = await prisma.fileObject.create({
      data: {
        madrasaId: null,
        type: 'OTHER',
        objectKey: 'system/avatars/avatar.webp', // wrong prefix!
        originalName: 'avatar.webp',
        mimeType: 'image/webp',
        size: 512,
      },
    });

    // 41a. Reference non-existent fileId rejected with 400
    const nonExistentRefRes = await fetch(`${baseUrl}/super-admin/website-content/homepage`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        productPreviewMedia: {
          enabled: true,
          fileId: 'non-existent-file-id-xyz',
          alt: 'Non-existent file',
        },
      }),
    });
    assert(nonExistentRefRes.status === 400, '41a. Non-existent fileId reference rejected with HTTP 400');

    // 41b. Reference tenant-owned fileId rejected with 400
    const tenantRefRes = await fetch(`${baseUrl}/super-admin/website-content/homepage`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        productPreviewMedia: {
          enabled: true,
          fileId: tenantFile.id,
          alt: 'Tenant owned file',
        },
      }),
    });
    assert(tenantRefRes.status === 400, '41b. Tenant-owned fileId reference rejected with HTTP 400');

    // 41c. Reference private receipt fileId rejected with 400
    const receiptRefRes = await fetch(`${baseUrl}/super-admin/website-content/homepage`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        productPreviewMedia: {
          enabled: true,
          fileId: receiptFile.id,
          alt: 'Private receipt file',
        },
      }),
    });
    assert(receiptRefRes.status === 400, '41c. Private receipt fileId reference rejected with HTTP 400');

    // 41d. Reference foreign prefix rejected with 400
    const foreignRefRes = await fetch(`${baseUrl}/super-admin/website-content/homepage`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        productPreviewMedia: {
          enabled: true,
          fileId: foreignFile.id,
          alt: 'Foreign prefix file',
        },
      }),
    });
    assert(foreignRefRes.status === 400, '41d. Foreign storage prefix reference rejected with HTTP 400');

    // Cleanup malicious fixtures
    await prisma.fileObject.deleteMany({
      where: { id: { in: [tenantFile.id, receiptFile.id, foreignFile.id] } },
    });

    // 42. Section Media Deletion Safety
    // 42a. Deleting product preview image while in draft rejected with 400
    const delDraftPreviewRes = await fetch(
      `${baseUrl}/super-admin/website-content/homepage/images/${previewFileId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${superAdminToken}` },
      }
    );
    assert(delDraftPreviewRes.status === 400, '42a. Deleting product preview image referenced in draft rejected with HTTP 400');

    // 42b. Deleting feature image while in draft rejected with 400
    const delDraftFeatureRes = await fetch(
      `${baseUrl}/super-admin/website-content/homepage/images/${featuresFileId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${superAdminToken}` },
      }
    );
    assert(delDraftFeatureRes.status === 400, '42b. Deleting feature image referenced in draft rejected with HTTP 400');

    // 42c. Publish homepage and verify public response
    const pubRes = await fetch(`${baseUrl}/super-admin/website-content/homepage/publish`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert(pubRes.status === 200, '42c. Publish homepage with section media returns HTTP 200');

    // 42d. Public endpoint exposes resolved section media
    const publicDataRes = await fetch(`${baseUrl}/public/homepage`);
    const publicDataJson = await publicDataRes.json();
    assert(Boolean(publicDataJson.data.content?.productPreviewMedia?.url), 'Public homepage exposes resolved productPreviewMedia URL');
    assert(publicDataJson.data.content?.productPreviewMedia?.alt === 'MadrasaNexa Live Administrative Portal', 'Public productPreviewMedia has correct alt');
    assert(Boolean(publicDataJson.data.content?.features?.[0]?.imageUrl), 'Public homepage exposes resolved feature imageUrl');

    // 42e. Deleting image while published rejected with 400
    const delPubPreviewRes = await fetch(
      `${baseUrl}/super-admin/website-content/homepage/images/${previewFileId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${superAdminToken}` },
      }
    );
    assert(delPubPreviewRes.status === 400, '42e. Deleting section image referenced in published content rejected with HTTP 400');

    // 42f. Clear references from draft, publish empty, then delete
    await fetch(`${baseUrl}/super-admin/website-content/homepage`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        productPreviewMedia: { enabled: true, fileId: null, alt: '', caption: null },
        features: [
          {
            id: 'feat-students',
            title: 'Student & Academic Records',
            description: 'Comprehensive student profiles.',
            icon: 'GraduationCap',
            sortOrder: 1,
            enabled: true,
            imageFileId: null,
            imageAlt: null,
            imageCaption: null,
          },
        ],
      }),
    });
    await fetch(`${baseUrl}/super-admin/website-content/homepage/publish`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });

    const delSuccessPreviewRes = await fetch(
      `${baseUrl}/super-admin/website-content/homepage/images/${previewFileId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${superAdminToken}` },
      }
    );
    assert(delSuccessPreviewRes.status === 200, '42f. Unreferenced product preview image deleted with HTTP 200');

    const delSuccessFeatureRes = await fetch(
      `${baseUrl}/super-admin/website-content/homepage/images/${featuresFileId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${superAdminToken}` },
      }
    );
    assert(delSuccessFeatureRes.status === 200, '42g. Unreferenced feature image deleted with HTTP 200');
  } finally {
    await teardown();
  }

  console.log(`\n========================================`);
  console.log(`HOMEPAGE CMS TEST SUITE RESULTS:`);
  console.log(`  Passed: ${testPassedCount}`);
  console.log(`  Failed: ${testFailedCount}`);
  console.log(`========================================\n`);

  if (testFailedCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
