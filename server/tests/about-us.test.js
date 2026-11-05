process.env.NODE_ENV = 'test';

import { prisma } from '../src/lib/prisma.js';
import { hashPassword } from '../src/utils/password.js';
import { signAccessToken } from '../src/utils/jwt.js';
import app from '../src/app.js';
import sharp from 'sharp';
import {
  setTestStorageAdapter,
  getTestStorageAdapter,
} from '../src/services/r2.service.js';
import * as aboutUsService from '../src/services/about-us.service.js';

const TEST_PREFIX = 'about_test_' + Date.now();
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
let superAdminUser = null;
let superAdminToken = '';

let madrasaAdminUser = null;
let madrasaAdminToken = '';
let testMadrasa = null;

async function setup() {
  console.log('\n--- Setting Up About Us CMS Test Fixtures ---');

  // Register mock test storage adapter
  setTestStorageAdapter(mockStorage);

  // Clean-start isolation: clear singleton AboutUs and test FileObjects to ensure deterministic batch execution
  await prisma.aboutUs.deleteMany({
    where: { id: 'global' },
  });
  await prisma.fileObject.deleteMany({
    where: {
      type: { in: ['ABOUT_US_HERO', 'ABOUT_US_STORY'] },
    },
  });

  const passwordHash = await hashPassword('TestP@ss1234!');

  // 1. Create Super Admin fixture
  superAdminUser = await prisma.user.create({
    data: {
      name: 'Super Admin About Test',
      email: `${TEST_PREFIX}_super@test.com`,
      passwordHash,
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

  // 2. Create Madrasa & Madrasa Admin fixture
  const randCode = Math.random().toString(36).substring(2, 7).toUpperCase();
  testMadrasa = await prisma.madrasa.create({
    data: {
      code: `M_${randCode}`,
      name: 'Test Madrasa About CMS',
      slug: `${TEST_PREFIX}_slug_m`,
      email: `${TEST_PREFIX}_m@test.com`,
      status: 'ACTIVE',
      settings: {
        create: {
          currency: 'LKR',
          timezone: 'Asia/Colombo',
        },
      },
    },
  });

  madrasaAdminUser = await prisma.user.create({
    data: {
      name: 'Madrasa Admin About Test',
      email: `${TEST_PREFIX}_madmin@test.com`,
      passwordHash,
      role: 'MADRASA_ADMIN',
      madrasaId: testMadrasa.id,
      isActive: true,
      mustChangePassword: false,
    },
  });

  madrasaAdminToken = signAccessToken({
    userId: madrasaAdminUser.id,
    role: madrasaAdminUser.role,
    madrasaId: testMadrasa.id,
  });

  // Start ephemeral HTTP server
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
  console.log('\n--- Cleaning Up About Us CMS Test Fixtures ---');

  if (testServer) {
    await new Promise((resolve) => testServer.close(resolve));
  }

  // Cleanup Database
  await prisma.activityLog.deleteMany({
    where: {
      OR: [
        { userId: superAdminUser?.id },
        { userId: madrasaAdminUser?.id },
        { entityType: 'AboutUs' },
      ],
    },
  });

  // Reset singleton AboutUs record
  await prisma.aboutUs.deleteMany({
    where: { id: 'global' },
  });

  // Cleanup FileObjects
  await prisma.fileObject.deleteMany({
    where: {
      type: { in: ['ABOUT_US_HERO', 'ABOUT_US_STORY'] },
    },
  });

  if (testMadrasa?.id) {
    await prisma.user.deleteMany({ where: { madrasaId: testMadrasa.id } });
    await prisma.madrasaSetting.deleteMany({ where: { madrasaId: testMadrasa.id } });
    await prisma.madrasa.deleteMany({ where: { id: testMadrasa.id } });
  }

  if (superAdminUser?.id) {
    await prisma.user.deleteMany({ where: { id: superAdminUser.id } });
  }

  mockStorage.clear();
}

// Helper to generate a dummy PNG buffer
async function createPngBuffer(width = 400, height = 300, color = { r: 16, g: 185, b: 129, alpha: 1 }) {
  return await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: color,
    },
  })
    .png()
    .toBuffer();
}

async function runTests() {
  await setup();

  try {
    console.log('\n[TEST GROUP 1: Access Control & Authorization]');
    // 1.1 Super Admin can access CMS
    {
      const res = await fetch(`${baseUrl}/super-admin/about-us`, {
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });
      assert(res.status === 200, '1.1 Super Admin GET /super-admin/about-us returns 200');
      const body = await res.json();
      assert(body.success === true, '1.1 Response indicates success');
      assert(body.data.id === 'global', '1.1 Returns singleton global record');
    }

    // 1.2 Madrasa Admin receives 403 Forbidden
    {
      const res = await fetch(`${baseUrl}/super-admin/about-us`, {
        headers: { Authorization: `Bearer ${madrasaAdminToken}` },
      });
      assert(res.status === 403, '1.2 Madrasa Admin GET /super-admin/about-us returns 403 Forbidden');
    }

    // 1.3 Unauthenticated request receives 401 Unauthorized
    {
      const res = await fetch(`${baseUrl}/super-admin/about-us`);
      assert(res.status === 401, '1.3 Unauthenticated GET /super-admin/about-us returns 401');
    }

    // 1.4 Madrasa Admin cannot update draft (403)
    {
      const res = await fetch(`${baseUrl}/super-admin/about-us/draft`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${madrasaAdminToken}`,
        },
        body: JSON.stringify({ title: 'Unauthorized update' }),
      });
      assert(res.status === 403, '1.4 Madrasa Admin PUT /draft returns 403');
    }

    // 1.5 Unauthenticated cannot publish (401)
    {
      const res = await fetch(`${baseUrl}/super-admin/about-us/publish`, {
        method: 'POST',
      });
      assert(res.status === 401, '1.5 Unauthenticated POST /publish returns 401');
    }

    console.log('\n[TEST GROUP 2: Singleton Architecture & Initial State]');
    // 2.1 Initial singleton creation
    {
      const count = await prisma.aboutUs.count();
      assert(count === 1, '2.1 Exactly one singleton AboutUs record exists in DB');

      const adminData = await aboutUsService.getAdminAboutUs();
      assert(adminData.status === 'DRAFT', '2.1 Initial status is DRAFT');
      assert(adminData.draft.title === '', '2.1 Initial draft title is empty string');
      assert(adminData.published.publishedAt === null, '2.1 Initial publishedAt is null');
    }

    // 2.2 Public endpoint returns isPublished: false when unpublished
    {
      const res = await fetch(`${baseUrl}/public/about-us`);
      assert(res.status === 200, '2.2 Public GET /public/about-us returns 200');
      const body = await res.json();
      assert(body.data.isPublished === false, '2.2 isPublished is false for draft');
      assert(body.data.content === null, '2.2 content is null when not published');
      assert(body.data.draft === undefined, '2.2 Draft content is not leaked');
      assert(body.data.heroFileId === undefined, '2.2 FileObject IDs are not leaked');
    }

    console.log('\n[TEST GROUP 3: Draft Validation Rules]');
    // 3.1 HTML tags rejected in text fields
    {
      const res = await fetch(`${baseUrl}/super-admin/about-us/draft`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({ title: '<script>alert("xss")</script>Title' }),
      });
      assert(res.status === 400, '3.1 HTML tags in title rejected with 400');
    }

    // 3.2 HTML tags in core value rejected
    {
      const res = await fetch(`${baseUrl}/super-admin/about-us/draft`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({
          coreValues: [{ title: '<b>Bold</b>', description: 'desc' }],
        }),
      });
      assert(res.status === 400, '3.2 HTML tags in core values rejected with 400');
    }

    // 3.3 More than 12 core values rejected
    {
      const values = Array.from({ length: 13 }, (_, i) => ({
        title: `Value ${i + 1}`,
        description: `Description ${i + 1}`,
      }));
      const res = await fetch(`${baseUrl}/super-admin/about-us/draft`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({ coreValues: values }),
      });
      assert(res.status === 400, '3.3 More than 12 core values rejected with 400');
    }

    // 3.4 More than 12 highlights rejected
    {
      const highlights = Array.from({ length: 13 }, (_, i) => ({
        title: `Highlight ${i + 1}`,
        metric: '100+',
        description: `Highlight desc ${i + 1}`,
      }));
      const res = await fetch(`${baseUrl}/super-admin/about-us/draft`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({ highlights }),
      });
      assert(res.status === 400, '3.4 More than 12 highlights rejected with 400');
    }

    // 3.5 Malicious CTA URLs rejected
    {
      const maliciousUrls = [
        'javascript:alert(1)',
        'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
        'file:///etc/passwd',
        'http://insecure.com/contact',
      ];
      for (const badUrl of maliciousUrls) {
        const res = await fetch(`${baseUrl}/super-admin/about-us/draft`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${superAdminToken}`,
          },
          body: JSON.stringify({ ctaUrl: badUrl }),
        });
        assert(res.status === 400, `3.5 Insecure CTA URL "${badUrl}" rejected with 400`);
      }
    }

    // 3.6 Valid CTA URL accepted (internal path and HTTPS)
    {
      const res1 = await fetch(`${baseUrl}/super-admin/about-us/draft`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({ ctaUrl: '/register' }),
      });
      assert(res1.status === 200, '3.6 Valid relative CTA URL "/register" accepted');

      const res2 = await fetch(`${baseUrl}/super-admin/about-us/draft`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({ ctaUrl: 'https://madrasanexa.com/contact' }),
      });
      assert(res2.status === 200, '3.6 Valid HTTPS CTA URL accepted');
    }

    console.log('\n[TEST GROUP 4: Valid Draft Update & ActivityLog]');
    {
      const draftPayload = {
        title: 'MadrasaNexa Platform',
        subtitle: 'Empowering Islamic Educational Excellence Worldwide',
        introduction: 'MadrasaNexa is the leading all-in-one cloud management platform designed specifically for modern Islamic educational institutions.',
        story: 'Founded in 2026, MadrasaNexa began with a simple mission: to preserve tradition while empowering progress.',
        mission: 'To equip every Madrasa with enterprise-grade digital tools.',
        vision: 'A globally connected network of thriving Islamic institutions.',
        coreValues: [
          { title: 'Excellence (Ihsan)', description: 'Striving for highest quality in every feature and process.' },
          { title: 'Trust (Amanah)', description: 'Upholding sacred responsibility of protecting institution and student data.' },
        ],
        highlights: [
          { title: 'Active Students', metric: '25,000+', description: 'Managed across institutions globally' },
          { title: 'Uptime Reliability', metric: '99.9%', description: 'Enterprise high availability cloud' },
        ],
        ctaLabel: 'Get Started Today',
        ctaUrl: '/register',
        heroAlt: 'Madrasa students learning in modern classroom',
        storyAlt: 'Our founding team working together',
      };

      const res = await fetch(`${baseUrl}/super-admin/about-us/draft`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify(draftPayload),
      });
      assert(res.status === 200, '4.1 PUT /draft succeeds with valid payload');
      const body = await res.json();
      assert(body.data.draft.title === draftPayload.title, '4.1 Draft title persisted');
      assert(body.data.draft.coreValues.length === 2, '4.1 Core values saved');
      assert(body.data.draft.highlights.length === 2, '4.1 Highlights saved');

      // Verify ActivityLog
      const log = await prisma.activityLog.findFirst({
        where: {
          userId: superAdminUser.id,
          action: 'ABOUT_US_DRAFT_UPDATED',
        },
      });
      assert(Boolean(log), '4.2 ActivityLog ABOUT_US_DRAFT_UPDATED created');
      assert(log.madrasaId === null, '4.2 ActivityLog madrasaId is null (platform scope)');
    }

    console.log('\n[TEST GROUP 5: Atomic Publish & Public Access]');
    {
      const pubRes = await fetch(`${baseUrl}/super-admin/about-us/publish`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });
      assert(pubRes.status === 200, '5.1 POST /publish returns 200');
      const pubBody = await pubRes.json();
      assert(pubBody.data.status === 'PUBLISHED', '5.1 Status changed to PUBLISHED');
      assert(pubBody.data.published.title === 'MadrasaNexa Platform', '5.1 Published title matches draft');
      assert(Boolean(pubBody.data.published.publishedAt), '5.1 publishedAt timestamp recorded');

      // Verify Public endpoint returns published content
      const publicRes = await fetch(`${baseUrl}/public/about-us`);
      assert(publicRes.status === 200, '5.2 Public GET /public/about-us returns 200');
      const publicBody = await publicRes.json();
      assert(publicBody.data.isPublished === true, '5.2 isPublished is true');
      assert(publicBody.data.content.title === 'MadrasaNexa Platform', '5.2 Public content contains title');
      assert(publicBody.data.content.coreValues.length === 2, '5.2 Public content contains core values');
      assert(publicBody.data.content.highlights.length === 2, '5.2 Public content contains highlights');
      assert(publicBody.data.content.ctaUrl === '/register', '5.2 Public content contains ctaUrl');

      // Verify ActivityLog
      const pubLog = await prisma.activityLog.findFirst({
        where: {
          userId: superAdminUser.id,
          action: 'ABOUT_US_PUBLISHED',
        },
      });
      assert(Boolean(pubLog), '5.3 ActivityLog ABOUT_US_PUBLISHED created');
    }

    console.log('\n[TEST GROUP 6: Post-Publish Draft Isolation]');
    {
      // Edit draft title post-publish
      const res = await fetch(`${baseUrl}/super-admin/about-us/draft`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({ title: 'Updated Work In Progress Title' }),
      });
      assert(res.status === 200, '6.1 Draft edit succeeds post-publish');
      const body = await res.json();
      assert(body.data.draft.title === 'Updated Work In Progress Title', '6.1 Draft reflects new title');
      assert(body.data.status === 'PUBLISHED', '6.1 Status remains PUBLISHED');
      assert(body.data.published.title === 'MadrasaNexa Platform', '6.1 Published snapshot retains original title');

      // Public endpoint must STILL return the old published title!
      const publicRes = await fetch(`${baseUrl}/public/about-us`);
      const publicBody = await publicRes.json();
      assert(publicBody.data.content.title === 'MadrasaNexa Platform', '6.2 Public endpoint is isolated and serves published snapshot, not draft');
    }

    console.log('\n[TEST GROUP 7: Unpublish & Re-publish Lifecycle]');
    {
      // 7.1 Unpublish
      const unpubRes = await fetch(`${baseUrl}/super-admin/about-us/unpublish`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });
      assert(unpubRes.status === 200, '7.1 POST /unpublish returns 200');
      const unpubBody = await unpubRes.json();
      assert(unpubBody.data.status === 'UNPUBLISHED', '7.1 Status is UNPUBLISHED');

      // Verify non-destructive DB retention
      const dbRecord = await prisma.aboutUs.findUnique({ where: { id: 'global' } });
      assert(dbRecord.draftTitle === 'Updated Work In Progress Title', '7.2 Draft content preserved after unpublish');
      assert(dbRecord.publishedTitle === 'MadrasaNexa Platform', '7.2 Published content preserved after unpublish');

      // Public endpoint returns unpublished
      const publicRes = await fetch(`${baseUrl}/public/about-us`);
      const publicBody = await publicRes.json();
      assert(publicBody.data.isPublished === false, '7.3 Public endpoint reports isPublished: false');
      assert(publicBody.data.content === null, '7.3 Public content is null after unpublish');

      // 7.4 Re-publish publishes current draft
      const repubRes = await fetch(`${baseUrl}/super-admin/about-us/publish`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });
      assert(repubRes.status === 200, '7.4 Re-publish succeeds');
      const repubBody = await repubRes.json();
      assert(repubBody.data.status === 'PUBLISHED', '7.4 Status restored to PUBLISHED');
      assert(repubBody.data.published.title === 'Updated Work In Progress Title', '7.4 Published snapshot updated to latest draft');
    }

    console.log('\n[TEST GROUP 8: Image Upload, Sharp Processing & Storage]');
    let heroFileId = null;
    let storyFileId = null;
    {
      // 8.1 Upload valid PNG Hero image
      const heroPng = await createPngBuffer(2400, 1600, { r: 15, g: 23, b: 42, alpha: 1 });
      const heroFormData = new FormData();
      heroFormData.append('hero', new Blob([heroPng], { type: 'image/png' }), 'test-hero.png');
      heroFormData.append('altText', 'Empowering Next Gen Madrasas');

      const heroRes = await fetch(`${baseUrl}/super-admin/about-us/hero`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${superAdminToken}` },
        body: heroFormData,
      });
      assert(heroRes.status === 200, '8.1 POST /hero returns 200');
      const heroBody = await heroRes.json();
      assert(Boolean(heroBody.data.draft.heroFileId), '8.1 draft.heroFileId populated');
      assert(heroBody.data.draft.heroAlt === 'Empowering Next Gen Madrasas', '8.1 draft.heroAlt populated');
      assert(Boolean(heroBody.data.draft.heroImageUrl), '8.1 draft.heroImageUrl resolved');
      heroFileId = heroBody.data.draft.heroFileId;

      // Verify FileObject in DB
      const heroFileObj = await prisma.fileObject.findUnique({ where: { id: heroFileId } });
      assert(heroFileObj !== null, '8.2 FileObject created in DB');
      assert(heroFileObj.madrasaId === null, '8.2 FileObject has madrasaId = null (platform file)');
      assert(heroFileObj.type === 'ABOUT_US_HERO', '8.2 FileObject type is ABOUT_US_HERO');
      assert(heroFileObj.mimeType === 'image/webp', '8.2 Stored image is WebP format');
      assert(mockStorage.has(heroFileObj.objectKey), '8.2 Image buffer exists in test R2 storage');

      // Verify Sharp resizing: 2400 width resized to 1920 inside
      const storedHeroBuf = await mockStorage.getObjectBuffer(heroFileObj.objectKey);
      const heroMeta = await sharp(storedHeroBuf).metadata();
      assert(heroMeta.width === 1920, '8.3 Hero image resized to max width 1920px');

      // 8.2 Upload valid PNG Story image
      const storyPng = await createPngBuffer(1800, 1200, { r: 59, g: 130, b: 246, alpha: 1 });
      const storyFormData = new FormData();
      storyFormData.append('story', new Blob([storyPng], { type: 'image/png' }), 'test-story.png');
      storyFormData.append('altText', 'Our classroom in 2026');

      const storyRes = await fetch(`${baseUrl}/super-admin/about-us/story`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${superAdminToken}` },
        body: storyFormData,
      });
      assert(storyRes.status === 200, '8.4 POST /story returns 200');
      const storyBody = await storyRes.json();
      assert(Boolean(storyBody.data.draft.storyFileId), '8.4 draft.storyFileId populated');
      storyFileId = storyBody.data.draft.storyFileId;

      const storyFileObj = await prisma.fileObject.findUnique({ where: { id: storyFileId } });
      assert(storyFileObj.type === 'ABOUT_US_STORY', '8.5 FileObject type is ABOUT_US_STORY');

      const storedStoryBuf = await mockStorage.getObjectBuffer(storyFileObj.objectKey);
      const storyMeta = await sharp(storedStoryBuf).metadata();
      assert(storyMeta.width === 1200, '8.5 Story image resized to max width 1200px');
    }

    console.log('\n[TEST GROUP 9: Image Security & Validation Rejections]');
    {
      // 9.1 Reject SVG upload
      const svgBuffer = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
      const svgForm = new FormData();
      svgForm.append('hero', new Blob([svgBuffer], { type: 'image/svg+xml' }), 'malicious.svg');

      const svgRes = await fetch(`${baseUrl}/super-admin/about-us/hero`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${superAdminToken}` },
        body: svgForm,
      });
      assert(svgRes.status === 400, '9.1 SVG upload rejected with 400');
      const svgBody = await svgRes.json();
      assert(svgBody.message.includes('SVG images are not allowed'), '9.1 Error explicitly mentions SVG rejection');

      // 9.2 Reject corrupted/non-image buffer
      const badBuffer = Buffer.from('Not an image file');
      const badForm = new FormData();
      badForm.append('story', new Blob([badBuffer], { type: 'image/png' }), 'fake.png');

      const badRes = await fetch(`${baseUrl}/super-admin/about-us/story`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${superAdminToken}` },
        body: badForm,
      });
      assert(badRes.status === 400, '9.2 Corrupt image buffer rejected with 400');

      // 9.3 Reject file > 5MB
      const hugeBuffer = Buffer.alloc(6 * 1024 * 1024);
      const hugeForm = new FormData();
      hugeForm.append('hero', new Blob([hugeBuffer], { type: 'image/jpeg' }), 'huge.jpg');

      const hugeRes = await fetch(`${baseUrl}/super-admin/about-us/hero`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${superAdminToken}` },
        body: hugeForm,
      });
      assert(hugeRes.status === 400, '9.3 File > 5MB rejected with 400');
    }

    console.log('\n[TEST GROUP 10: Safe Removal & Published Snapshot Isolation]');
    {
      // Publish current state with hero and story
      await fetch(`${baseUrl}/super-admin/about-us/publish`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });

      // Confirm public API now has hero and story images
      const pubCheck1 = await fetch(`${baseUrl}/public/about-us`);
      const pubCheckBody1 = await pubCheck1.json();
      assert(Boolean(pubCheckBody1.data.content.heroImageUrl), '10.1 Public content has published hero image');
      assert(Boolean(pubCheckBody1.data.content.storyImageUrl), '10.1 Public content has published story image');

      // Delete draft hero image
      const delHeroRes = await fetch(`${baseUrl}/super-admin/about-us/hero`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });
      assert(delHeroRes.status === 200, '10.2 DELETE /hero returns 200');
      const delHeroBody = await delHeroRes.json();
      assert(delHeroBody.data.draft.heroFileId === null, '10.2 Draft heroFileId is unlinked to null');
      assert(delHeroBody.data.published.heroFileId === heroFileId, '10.2 Published heroFileId is retained untouched');

      // Verify public API still serves the published hero image!
      const pubCheck2 = await fetch(`${baseUrl}/public/about-us`);
      const pubCheckBody2 = await pubCheck2.json();
      assert(Boolean(pubCheckBody2.data.content.heroImageUrl), '10.3 Public API still displays published hero image after draft deletion');

      // Delete draft story image
      const delStoryRes = await fetch(`${baseUrl}/super-admin/about-us/story`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });
      assert(delStoryRes.status === 200, '10.4 DELETE /story returns 200');
      const delStoryBody = await delStoryRes.json();
      assert(delStoryBody.data.draft.storyFileId === null, '10.4 Draft storyFileId unlinked to null');
      assert(delStoryBody.data.published.storyFileId === storyFileId, '10.4 Published storyFileId is retained untouched');
    }

    console.log('\n[TEST GROUP 11: Compensation Rollback on DB Error]');
    {
      // Test compensation: if DB fails during transaction, uploaded R2 object is removed
      const validPng = await createPngBuffer(200, 200);

      // Force DB failure by mocking prisma.$transaction to throw
      const originalTx = prisma.$transaction;
      let interceptedKey = null;
      let threwError = false;

      // Wrap mockStorage.uploadBuffer to record key
      const origUpload = mockStorage.uploadBuffer.bind(mockStorage);
      mockStorage.uploadBuffer = async (k, buf, ct) => {
        interceptedKey = k;
        return origUpload(k, buf, ct);
      };

      prisma.$transaction = async () => {
        throw new Error('Simulated Database Crash during FileObject insertion');
      };

      try {
        await aboutUsService.uploadHeroImage(validPng, 'compensation_test.png', superAdminUser);
      } catch (err) {
        threwError = true;
      } finally {
        prisma.$transaction = originalTx;
        mockStorage.uploadBuffer = origUpload;
      }

      assert(threwError, '11.1 Service re-threw the database error');
      assert(Boolean(interceptedKey), '11.1 R2 upload occurred before DB failure');
      assert(!mockStorage.has(interceptedKey), '11.2 R2 object was deleted by compensation rollback');
    }

  } catch (err) {
    console.error('Fatal Test Runner Error:', err);
    testFailedCount++;
  } finally {
    await teardown();
  }

  console.log(`\n==================================================`);
  console.log(`ABOUT US CMS TEST RESULTS`);
  console.log(`Passed: ${testPassedCount}`);
  console.log(`Failed: ${testFailedCount}`);
  console.log(`==================================================\n`);

  if (testFailedCount > 0) {
    process.exit(1);
  }
}

runTests();
