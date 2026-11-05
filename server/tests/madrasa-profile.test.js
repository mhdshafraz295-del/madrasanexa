import sharp from 'sharp';
import { prisma } from '../src/lib/prisma.js';
import { hashPassword } from '../src/utils/password.js';
import { signAccessToken } from '../src/utils/jwt.js';
import app from '../src/app.js';
import http from 'http';

const TEST_PREFIX = 'prof_test_' + Date.now();

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

let madrasaB = null;
let adminB = null;
let tokenB = '';

let studentA1 = null;

async function setup() {
  console.log('\n--- Setting up Madrasa Profile Test Fixtures ---');
  const now = new Date();

  // 1. Subscription Plan
  const plan = await prisma.plan.upsert({
    where: { code: 'PRO_PROFILE_TEST' },
    update: {},
    create: {
      name: 'Pro Profile Test Plan',
      code: 'PRO_PROFILE_TEST',
      description: 'Profile Test Plan',
      durationMonths: 12,
      price: 15000,
      isActive: true,
    },
  });

  // 2. Tenant A
  madrasaA = await prisma.madrasa.create({
    data: {
      code: `${TEST_PREFIX}_MDA`,
      name: 'Al-Huda Islamic Academy',
      slug: `${TEST_PREFIX}-alhuda`,
      status: 'ACTIVE',
      phone: '+94771234567',
      email: 'info@alhuda.edu',
      address: '123 Mosque Road, Colombo',
      settings: {
        create: {
          currency: 'LKR',
          academicYear: '2026',
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

  // Student in Madrasa A with guardian contact
  studentA1 = await prisma.student.create({
    data: {
      madrasaId: madrasaA.id,
      admissionNo: `${TEST_PREFIX}_001`,
      admissionDate: new Date('2024-01-10'),
      fullName: 'Ahmad Abdullah',
      guardianName: 'Abdullah Omar',
      guardianPhone: '+94770000001',
      guardianEmail: 'abdullah@example.com',
      whatsappOptIn: true,
      status: 'ACTIVE',
    },
  });

  // 3. Tenant B
  madrasaB = await prisma.madrasa.create({
    data: {
      code: `${TEST_PREFIX}_MDB`,
      name: 'Noor Academy B',
      slug: `${TEST_PREFIX}-noor`,
      status: 'ACTIVE',
      settings: {
        create: {
          currency: 'LKR',
          academicYear: '2026',
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
  console.log('\n--- Tearing Down Test Fixtures ---');
  if (testServer) {
    await new Promise((resolve) => testServer.close(resolve));
  }

  // Delete notification jobs
  await prisma.notificationJob.deleteMany({
    where: { madrasaId: { in: [madrasaA.id, madrasaB.id] } }
  });

  // Delete students
  await prisma.student.deleteMany({
    where: { madrasaId: { in: [madrasaA.id, madrasaB.id] } }
  });

  // Delete profiles
  await prisma.madrasaProfile.deleteMany({
    where: { madrasaId: { in: [madrasaA.id, madrasaB.id] } }
  });

  // Delete users
  await prisma.user.deleteMany({
    where: { id: { in: [adminA.id, adminB.id] } }
  });

  // Delete subscriptions
  await prisma.subscription.deleteMany({
    where: { madrasaId: { in: [madrasaA.id, madrasaB.id] } }
  });

  // Delete settings
  await prisma.madrasaSetting.deleteMany({
    where: { madrasaId: { in: [madrasaA.id, madrasaB.id] } }
  });

  // Delete madrasas
  await prisma.madrasa.deleteMany({
    where: { id: { in: [madrasaA.id, madrasaB.id] } }
  });

  console.log('Fixtures cleaned up successfully.');
}

async function runTests() {
  try {
    await setup();

    console.log('\n=============================================');
    console.log('PHASE A: MADRASA PUBLIC HOMEPAGE TEST SUITE');
    console.log('=============================================');

    // TEST 1: Initial Get creates a draft profile with isPublished: false
    console.log('\n[TEST 1] Initial GET /homepage-profile creates draft');
    const res1 = await fetch(`${baseUrl}/api/madrasa-admin/homepage-profile`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const json1 = await res1.json();
    assert(res1.status === 200, 'GET /homepage-profile returns 200 OK');
    assert(json1.success === true, 'Response success is true');
    assert(json1.data.isPublished === false, 'Draft profile has isPublished = false');
    assert(json1.data.heroTitle.includes('Al-Huda Islamic Academy'), 'Hero title defaults cleanly');

    // TEST 2: Update Profile
    console.log('\n[TEST 2] PATCH /homepage-profile updates profile content');
    const updatePayload = {
      heroTitle: 'Excellence in Islamic Scholarship',
      heroSubtitle: 'Cultivating the leaders of tomorrow.',
      introduction: 'Al-Huda Islamic Academy is a premier Islamic institution founded with the noble objective of teaching Quran and Sunnah.',
      mission: 'To impart authentic Islamic knowledge and sound academic grounding.',
      vision: 'A model community of righteous, competent scholars and leaders.',
      syllabusInfo: 'Comprehensive Hifz, Tajweed, Fiqh, and language curriculum.',
      rulesAndRegulations: 'Respect for teachers, punctuality, and Islamic dress code are mandatory for all registered students.',
      contactPhone: '+94779999888',
      contactEmail: 'contact@alhuda.edu',
      address: '786 Light Avenue, Colombo 03',
      eventsJson: [
        {
          id: 'ev-1',
          title: 'Annual Hifz Completion Ceremony',
          date: '2026-11-15',
          description: 'Graduation ceremony celebrating students completing the Holy Quran memorization.',
          location: 'Main Auditorium',
          isPublished: true
        }
      ],
      noticesJson: [
        {
          id: 'nt-1',
          title: 'Admissions Open for Academic Year 2027',
          content: 'Online applications are now open for primary and secondary Hifz programs.',
          postedAt: '2026-10-29',
          priority: 'URGENT',
          isPublished: true
        }
      ]
    };

    const res2 = await fetch(`${baseUrl}/api/madrasa-admin/homepage-profile`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updatePayload)
    });
    const json2 = await res2.json();
    assert(res2.status === 200, 'PATCH /homepage-profile returns 200 OK');
    assert(json2.data.heroTitle === updatePayload.heroTitle, 'Hero title updated');
    assert(json2.data.eventsJson.length === 1, 'Events JSON persisted');
    assert(json2.data.noticesJson.length === 1, 'Notices JSON persisted');

    // TEST 3: Deterministic Summary Generation
    console.log('\n[TEST 3] POST /homepage-profile/generate-summary creates rule-based summary');
    const res3 = await fetch(`${baseUrl}/api/madrasa-admin/homepage-profile/generate-summary`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const json3 = await res3.json();
    assert(res3.status === 200, 'generate-summary returns 200 OK');
    assert(typeof json3.data.generatedSummary === 'string' && json3.data.generatedSummary.length > 50, 'Deterministic summary generated');
    assert(json3.data.generatedSummary.includes('Al-Huda Islamic Academy'), 'Summary references institutional name');
    assert(json3.data.generatedSummary.includes('Comprehensive Hifz'), 'Summary incorporates syllabus framework');

    // TEST 4: Security Gate: Public Endpoint rejects UNPUBLISHED draft profile
    console.log('\n[TEST 4] Public GET /madrasa/:slug returns 404 while draft (unpublished)');
    const res4 = await fetch(`${baseUrl}/api/public/madrasa/${madrasaA.slug}`);
    const json4 = await res4.json();
    assert(res4.status === 404, 'Unpublished profile returns 404 Not Found to public');
    assert(json4.success === false, 'Public response is not successful');

    // TEST 5: Explicit Publication Workflow
    console.log('\n[TEST 5] POST /homepage-profile/publish publishes portal');
    const res5 = await fetch(`${baseUrl}/api/madrasa-admin/homepage-profile/publish`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const json5 = await res5.json();
    assert(res5.status === 200, 'publish returns 200 OK');
    assert(json5.data.isPublished === true, 'Profile isPublished is true');
    assert(json5.data.publishedAt !== null, 'Profile publishedAt timestamp recorded');

    // TEST 6: Public Endpoint resolves PUBLISHED profile
    console.log('\n[TEST 6] Public GET /madrasa/:slug returns 200 once published');
    const res6 = await fetch(`${baseUrl}/api/public/madrasa/${madrasaA.slug}`);
    const json6 = await res6.json();
    assert(res6.status === 200, 'Public GET returns 200 OK for published profile');
    assert(json6.success === true, 'Public response is success');
    assert(json6.data.heroTitle === 'Excellence in Islamic Scholarship', 'Public payload matches profile');
    assert(json6.data.events.length === 1, 'Public events returned');
    assert(json6.data.notices.length === 1, 'Public notices returned');
    assert(json6.data.madrasa.slug === madrasaA.slug, 'Madrasa slug returned');

    // TEST 7: Tenant Isolation
    console.log('\n[TEST 7] Multi-Tenant Isolation between Madrasa A and Madrasa B');
    const res7 = await fetch(`${baseUrl}/api/madrasa-admin/homepage-profile`, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    const json7 = await res7.json();
    assert(res7.status === 200, 'Madrasa B can fetch its own profile');
    assert(json7.data.heroTitle.includes('Noor Academy B'), 'Madrasa B gets its own profile, not Madrasa A');
    assert(json7.data.isPublished === false, 'Madrasa B draft remains unpublished');

    // TEST 8: Notice Broadcast to Eligible Guardians
    console.log('\n[TEST 8] Notice Broadcast creates MADRASA_NOTICE_BROADCAST jobs');
    const res8 = await fetch(`${baseUrl}/api/madrasa-admin/homepage-profile/broadcast-notice`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ noticeId: 'nt-1' })
    });
    const json8 = await res8.json();
    assert(res8.status === 200, 'broadcast-notice returns 200 OK');
    assert(json8.success === true, 'broadcast success is true');
    assert(json8.data.recipientsQueued >= 1, 'At least 1 communication job queued for active student guardian');

    // Verify NotificationJob recorded in DB
    const jobs = await prisma.notificationJob.findMany({
      where: {
        madrasaId: madrasaA.id,
        eventType: 'MADRASA_NOTICE_BROADCAST'
      }
    });
    assert(jobs.length >= 1, 'Notification jobs recorded in database with MADRASA_NOTICE_BROADCAST');
    assert(jobs[0].recipientEntityId === studentA1.id, 'Job correctly addressed to Madrasa A student guardian');
    assert(jobs[0].madrasaId === madrasaA.id, 'Job strictly isolated to Madrasa A');

    // TEST 9: Unpublish Workflow
    console.log('\n[TEST 9] POST /homepage-profile/unpublish reverts portal to draft');
    const res9 = await fetch(`${baseUrl}/api/madrasa-admin/homepage-profile/unpublish`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const json9 = await res9.json();
    assert(res9.status === 200, 'unpublish returns 200 OK');
    assert(json9.data.isPublished === false, 'Profile isPublished reverted to false');

    // Verify public returns 404 again
    const res10 = await fetch(`${baseUrl}/api/public/madrasa/${madrasaA.slug}`);
    assert(res10.status === 404, 'Reverted profile immediately returns 404 to public again');

    // Create test image buffers using Sharp
    const sampleLogoPng = await sharp({
      create: {
        width: 128,
        height: 128,
        channels: 4,
        background: { r: 16, g: 185, b: 129, alpha: 1 }
      }
    }).png().toBuffer();

    const sampleHeroPng1 = await sharp({
      create: {
        width: 640,
        height: 360,
        channels: 4,
        background: { r: 6, g: 78, b: 59, alpha: 1 }
      }
    }).png().toBuffer();

    const sampleHeroPng2 = await sharp({
      create: {
        width: 800,
        height: 450,
        channels: 4,
        background: { r: 30, g: 41, b: 59, alpha: 1 }
      }
    }).png().toBuffer();

    // TEST 10: Institution Logo Upload & Profile Integration
    console.log('\n[TEST 10] POST /branding/logo sets logo and resolves in /homepage-profile');
    const logoFormData = new FormData();
    logoFormData.append('logo', new Blob([sampleLogoPng], { type: 'image/png' }), 'logo.png');

    const resLogo = await fetch(`${baseUrl}/api/madrasa-admin/branding/logo`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: logoFormData
    });
    const jsonLogo = await resLogo.json();
    assert(resLogo.status === 200, 'Logo upload returns 200 OK');
    assert(jsonLogo.success === true, 'Logo upload success is true');
    assert(!!jsonLogo.data.logoUrl, 'Logo upload returns dynamic logoUrl');

    const resProfileWithLogo = await fetch(`${baseUrl}/api/madrasa-admin/homepage-profile`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const jsonProfileWithLogo = await resProfileWithLogo.json();
    assert(jsonProfileWithLogo.data.madrasa.logoUrl === jsonLogo.data.logoUrl, 'Homepage profile resolves logoUrl');
    assert(jsonProfileWithLogo.data.madrasa.initials === 'AH', 'Homepage profile resolves correct initials');

    // TEST 11: Hero Background Image Upload
    console.log('\n[TEST 11] POST /homepage-profile/hero-image uploads hero background image');
    const heroForm1 = new FormData();
    heroForm1.append('heroImage', new Blob([sampleHeroPng1], { type: 'image/png' }), 'hero_campus1.png');

    const resHero1 = await fetch(`${baseUrl}/api/madrasa-admin/homepage-profile/hero-image`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: heroForm1
    });
    const jsonHero1 = await resHero1.json();
    assert(resHero1.status === 200, 'Hero image upload returns 200 OK');
    assert(jsonHero1.success === true, 'Hero image upload success is true');
    assert(!!jsonHero1.data.heroImageUrl, 'Hero image upload returns heroImageUrl');
    assert(jsonHero1.data.mimeType === 'image/webp', 'Hero image stored as optimized WebP');

    const heroImageId1 = jsonHero1.data.heroImageFileId;

    // Verify in GET /homepage-profile that heroImageUrl and logoUrl coexist independently
    const resProfileWithBoth = await fetch(`${baseUrl}/api/madrasa-admin/homepage-profile`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const jsonProfileWithBoth = await resProfileWithBoth.json();
    assert(jsonProfileWithBoth.data.heroImageUrl === jsonHero1.data.heroImageUrl, 'Homepage profile resolves heroImageUrl');
    assert(jsonProfileWithBoth.data.madrasa.logoUrl === jsonLogo.data.logoUrl, 'Logo remains intact when hero image is set');

    // TEST 12: Public Endpoint resolves both logo and hero image when published
    console.log('\n[TEST 12] Published public endpoint returns both logoUrl and heroImageUrl');
    // Publish
    await fetch(`${baseUrl}/api/madrasa-admin/homepage-profile/publish`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` }
    });

    const resPublicWithImages = await fetch(`${baseUrl}/api/public/madrasa/${madrasaA.slug}`);
    const jsonPublicWithImages = await resPublicWithImages.json();
    assert(resPublicWithImages.status === 200, 'Public GET returns 200 OK');
    assert(jsonPublicWithImages.data.heroImageUrl === jsonHero1.data.heroImageUrl, 'Public endpoint delivers heroImageUrl');
    assert(jsonPublicWithImages.data.madrasa.logoUrl === jsonLogo.data.logoUrl, 'Public endpoint delivers logoUrl');
    assert(jsonPublicWithImages.data.madrasa.initials === 'AH', 'Public endpoint delivers initials');

    // TEST 13: Hero Image Replacement (Independence & Cleanup)
    console.log('\n[TEST 13] Replacing hero image updates heroImageUrl and preserves logo');
    const heroForm2 = new FormData();
    heroForm2.append('heroImage', new Blob([sampleHeroPng2], { type: 'image/png' }), 'hero_campus2.png');

    const resHero2 = await fetch(`${baseUrl}/api/madrasa-admin/homepage-profile/hero-image`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: heroForm2
    });
    const jsonHero2 = await resHero2.json();
    assert(resHero2.status === 200, 'Hero image replacement returns 200 OK');
    assert(jsonHero2.data.heroImageFileId !== heroImageId1, 'New FileObject generated for replaced hero image');

    const resProfileAfterReplace = await fetch(`${baseUrl}/api/madrasa-admin/homepage-profile`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const jsonProfileAfterReplace = await resProfileAfterReplace.json();
    assert(jsonProfileAfterReplace.data.heroImageUrl === jsonHero2.data.heroImageUrl, 'Homepage profile reflects new heroImageUrl');
    assert(jsonProfileAfterReplace.data.madrasa.logoUrl === jsonLogo.data.logoUrl, 'Logo completely untouched by hero image replacement');

    // TEST 14: Hero Image Removal
    console.log('\n[TEST 14] DELETE /homepage-profile/hero-image removes hero image and preserves logo');
    const resDeleteHero = await fetch(`${baseUrl}/api/madrasa-admin/homepage-profile/hero-image`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const jsonDeleteHero = await resDeleteHero.json();
    assert(resDeleteHero.status === 200, 'Hero image delete returns 200 OK');
    assert(jsonDeleteHero.success === true, 'Hero image delete success is true');

    const resProfileAfterDelete = await fetch(`${baseUrl}/api/madrasa-admin/homepage-profile`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const jsonProfileAfterDelete = await resProfileAfterDelete.json();
    assert(jsonProfileAfterDelete.data.heroImageUrl === null, 'heroImageUrl is null after deletion');
    assert(jsonProfileAfterDelete.data.madrasa.logoUrl === jsonLogo.data.logoUrl, 'Logo completely untouched by hero image deletion');

    const resPublicAfterDelete = await fetch(`${baseUrl}/api/public/madrasa/${madrasaA.slug}`);
    const jsonPublicAfterDelete = await resPublicAfterDelete.json();
    assert(jsonPublicAfterDelete.data.heroImageUrl === null, 'Public endpoint has heroImageUrl null for navy gradient fallback');
    assert(jsonPublicAfterDelete.data.madrasa.logoUrl === jsonLogo.data.logoUrl, 'Public endpoint still has logoUrl');

    // TEST 15: Security Controls: Reject SVG, Reject Non-Image, Tenant Isolation
    console.log('\n[TEST 15] Security validations: SVG rejection and Cross-tenant protection');
    const svgForm = new FormData();
    svgForm.append('heroImage', new Blob(['<svg><script>alert(1)</script></svg>'], { type: 'image/svg+xml' }), 'evil.svg');

    const resSvg = await fetch(`${baseUrl}/api/madrasa-admin/homepage-profile/hero-image`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: svgForm
    });
    assert(resSvg.status === 400, 'SVG upload strictly rejected with 400 Bad Request');

    // Tenant B cannot delete Tenant A's hero image
    // First, upload a hero image for Tenant A again
    const heroForm3 = new FormData();
    heroForm3.append('heroImage', new Blob([sampleHeroPng1], { type: 'image/png' }), 'hero_campus1.png');
    await fetch(`${baseUrl}/api/madrasa-admin/homepage-profile/hero-image`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: heroForm3
    });

    // Tenant B deletes hero image on Tenant B - it should only affect Tenant B
    const resDeleteB = await fetch(`${baseUrl}/api/madrasa-admin/homepage-profile/hero-image`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    assert(resDeleteB.status === 200, 'Tenant B delete hero executes on Tenant B scope');

    // Verify Tenant A still has hero image!
    const resTenantAAfterB = await fetch(`${baseUrl}/api/madrasa-admin/homepage-profile`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const jsonTenantAAfterB = await resTenantAAfterB.json();
    assert(jsonTenantAAfterB.data.heroImageUrl !== null, 'Tenant A hero image remains intact after Tenant B operations');

    // TEST 16: Poster Image Upload for Notices and Events
    console.log('\n[TEST 16] POST /homepage-profile/poster uploads poster image to R2');
    const samplePosterPng = await sharp({
      create: {
        width: 800,
        height: 450,
        channels: 4,
        background: { r: 15, g: 118, b: 110, alpha: 1 }
      }
    }).png().toBuffer();

    const posterFormA = new FormData();
    posterFormA.append('poster', new Blob([samplePosterPng], { type: 'image/png' }), 'annual_event_poster.png');

    const resPosterA = await fetch(`${baseUrl}/api/madrasa-admin/homepage-profile/poster`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: posterFormA
    });
    const jsonPosterA = await resPosterA.json();
    assert(resPosterA.status === 200, 'POST /homepage-profile/poster returns 200 OK');
    assert(jsonPosterA.success === true, 'Poster upload success is true');
    assert(!!jsonPosterA.data.fileId, 'Poster upload returns fileId');
    assert(!!jsonPosterA.data.posterUrl, 'Poster upload returns posterUrl');
    assert(jsonPosterA.data.mimeType === 'image/webp', 'Poster image optimized to WebP');

    const posterFileIdA = jsonPosterA.data.fileId;
    const posterUrlA = jsonPosterA.data.posterUrl;

    // Reject SVG poster upload
    const svgPosterForm = new FormData();
    svgPosterForm.append('poster', new Blob(['<svg><script>alert(1)</script></svg>'], { type: 'image/svg+xml' }), 'malicious_poster.svg');
    const resPosterSvg = await fetch(`${baseUrl}/api/madrasa-admin/homepage-profile/poster`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: svgPosterForm
    });
    assert(resPosterSvg.status === 400, 'SVG poster upload strictly rejected with 400 Bad Request');

    // TEST 17: Cross-Tenant Isolation for Posters
    console.log('\n[TEST 17] Tenant B cannot delete Tenant A poster (Cross-tenant security)');
    const resCrossDeletePoster = await fetch(`${baseUrl}/api/madrasa-admin/homepage-profile/poster/${posterFileIdA}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    assert(resCrossDeletePoster.status === 404, 'Cross-tenant poster deletion blocked with 404 Not Found');

    // TEST 18: Notices and Events persist poster references and public portal resolves posterUrl
    console.log('\n[TEST 18] Events and Notices persist poster references and resolve in public profile');
    const updateWithPostersPayload = {
      eventsJson: [
        {
          id: 'ev-poster-1',
          title: 'Quran Recitation & Hifz Convocation 2026',
          date: '2026-12-20',
          description: 'Grand annual gathering honoring our distinguished Huffaz students.',
          location: 'Grand Conference Hall',
          isPublished: true,
          posterFileId: posterFileIdA,
          posterUrl: posterUrlA,
        }
      ],
      noticesJson: [
        {
          id: 'nt-poster-1',
          title: 'Special Ramadan Class Schedule Announced',
          content: 'Updated morning and evening timings for the upcoming holy month.',
          postedAt: '2026-10-29',
          priority: 'URGENT',
          isPublished: true,
          posterFileId: posterFileIdA,
          posterUrl: posterUrlA,
        }
      ]
    };

    const resUpdatePosters = await fetch(`${baseUrl}/api/madrasa-admin/homepage-profile`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateWithPostersPayload)
    });
    const jsonUpdatePosters = await resUpdatePosters.json();
    assert(resUpdatePosters.status === 200, 'PATCH /homepage-profile with posters returns 200 OK');

    // Verify admin query resolves dynamic posterUrl
    const resAdminProfile = await fetch(`${baseUrl}/api/madrasa-admin/homepage-profile`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const jsonAdminProfile = await resAdminProfile.json();
    assert(jsonAdminProfile.data.eventsJson[0].posterFileId === posterFileIdA, 'Event persisted posterFileId');
    assert(!!jsonAdminProfile.data.eventsJson[0].posterUrl, 'Event resolved dynamic posterUrl');
    assert(jsonAdminProfile.data.noticesJson[0].posterFileId === posterFileIdA, 'Notice persisted posterFileId');
    assert(!!jsonAdminProfile.data.noticesJson[0].posterUrl, 'Notice resolved dynamic posterUrl');

    // Verify public endpoint returns resolved posterUrl for published events and notices
    await fetch(`${baseUrl}/api/madrasa-admin/homepage-profile/publish`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` }
    });

    const resPublicWithPosters = await fetch(`${baseUrl}/api/public/madrasa/${madrasaA.slug}`);
    const jsonPublicWithPosters = await resPublicWithPosters.json();
    assert(resPublicWithPosters.status === 200, 'Public GET returns 200 OK');
    assert(jsonPublicWithPosters.data.events.length === 1, 'Public events list returned');
    assert(!!jsonPublicWithPosters.data.events[0].posterUrl, 'Public event delivers posterUrl');
    assert(jsonPublicWithPosters.data.notices.length === 1, 'Public notices list returned');
    assert(!!jsonPublicWithPosters.data.notices[0].posterUrl, 'Public notice delivers posterUrl');

    // TEST 19: DELETE /homepage-profile/poster/:fileId removes poster safely without breaking event
    console.log('\n[TEST 19] DELETE poster removes FileObject and R2 object safely');
    const resDeletePoster = await fetch(`${baseUrl}/api/madrasa-admin/homepage-profile/poster/${posterFileIdA}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const jsonDeletePoster = await resDeletePoster.json();
    assert(resDeletePoster.status === 200, 'DELETE /homepage-profile/poster/:fileId returns 200 OK');
    assert(jsonDeletePoster.success === true, 'Delete poster response success is true');

    // Verify file is removed from FileObject table
    const deletedFileInDb = await prisma.fileObject.findFirst({
      where: { id: posterFileIdA }
    });
    assert(deletedFileInDb === null, 'FileObject removed from database');

    console.log('\n=============================================');
    console.log(`Phase A Results: ${testPassedCount} Passed, ${testFailedCount} Failed`);
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
