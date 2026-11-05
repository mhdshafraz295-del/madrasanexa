process.env.NODE_ENV = 'test';

import { prisma } from '../src/lib/prisma.js';
import { hashPassword } from '../src/utils/password.js';
import { signAccessToken } from '../src/utils/jwt.js';
import app from '../src/app.js';
import { setTestStorageAdapter, getTestStorageAdapter } from '../src/services/r2.service.js';
import * as aboutUsService from '../src/services/about-us.service.js';

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

let testServer;
let baseUrl;
let superAdminToken;

async function setupFixtures() {
  setTestStorageAdapter(new MemoryTestStorageAdapter());

  const passwordHash = await hashPassword('SuperAdminPass123!');
  const superAdmin = await prisma.user.upsert({
    where: { email: 'multilingual_about_admin@madrasanexa.internal' },
    update: { isActive: true },
    create: {
      name: 'Multilingual About Admin',
      email: 'multilingual_about_admin@madrasanexa.internal',
      passwordHash,
      role: 'SUPER_ADMIN',
      isActive: true,
      mustChangePassword: false,
    },
  });

  superAdminToken = signAccessToken({
    userId: superAdmin.id,
    email: superAdmin.email,
    role: superAdmin.role,
    madrasaId: null,
  });

  return new Promise((resolve) => {
    testServer = app.listen(0, () => {
      const port = testServer.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
}

async function cleanupFixtures() {
  if (testServer) {
    await new Promise((resolve) => testServer.close(resolve));
  }
  await prisma.aboutUsTranslation.deleteMany({ where: { aboutUsId: 'global' } }).catch(() => {});
  await prisma.user.deleteMany({ where: { email: 'multilingual_about_admin@madrasanexa.internal' } }).catch(() => {});
}

async function apiRequest(method, path, body = null, token = null) {
  const headers = {};
  if (body && !(body instanceof Buffer)) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const opts = {
    method,
    headers,
  };
  if (body) {
    opts.body = typeof body === 'string' || body instanceof Buffer ? body : JSON.stringify(body);
  }

  const res = await fetch(`${baseUrl}${path}`, opts);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch (e) {
    json = text;
  }
  return { status: res.status, data: json };
}

async function runTests() {
  console.log('\n==================================================');
  console.log('MULTILINGUAL ABOUT US — INTEGRATION TEST SUITE');
  console.log('==================================================\n');

  await setupFixtures();

  try {
    // ----------------------------------------------------
    // TEST GROUP 1: ENGLISH REGRESSION & BACKWARD COMPATIBILITY
    // ----------------------------------------------------
    console.log('[TEST GROUP 1: English Regression & Backward Compatibility]');

    // Clean initial state
    await prisma.aboutUs.upsert({
      where: { id: 'global' },
      create: { id: 'global', status: 'DRAFT' },
      update: { status: 'DRAFT' },
    });
    await prisma.aboutUsTranslation.deleteMany({ where: { aboutUsId: 'global' } });

    // 1.1 Update English draft
    const updateEnRes = await apiRequest(
      'PUT',
      '/api/super-admin/about-us/draft',
      {
        title: 'English Title',
        subtitle: 'English Subtitle',
        introduction: 'English Intro',
        story: 'English Story',
        mission: 'English Mission',
        vision: 'English Vision',
        coreValues: [
          { title: 'Value A', description: 'Desc A', icon: 'Shield' },
          { title: 'Value B', description: 'Desc B', icon: 'Book' },
        ],
        highlights: [
          { title: 'Metric 1', metric: '100+', description: 'Desc M1' },
        ],
        ctaLabel: 'Get Started',
        ctaUrl: '/register',
      },
      superAdminToken
    );

    assert(updateEnRes.status === 200, '1.1 Update English draft returns 200');
    assert(updateEnRes.data.data.draft.title === 'English Title', '1.1 English draft title saved');
    assert(updateEnRes.data.data.draft.coreValues.length === 2, '1.1 English core values saved');
    assert(!!updateEnRes.data.data.draft.coreValues[0].id, '1.1 Core value A assigned stable ID');
    assert(!!updateEnRes.data.data.draft.coreValues[1].id, '1.1 Core value B assigned stable ID');

    // 1.2 Publish English
    const publishRes = await apiRequest('POST', '/api/super-admin/about-us/publish', {}, superAdminToken);
    assert(publishRes.status === 200, '1.2 Publish returns 200');
    assert(publishRes.data.data.status === 'PUBLISHED', '1.2 Status is PUBLISHED');

    // 1.3 Public no-query GET contract
    const publicNoQueryRes = await apiRequest('GET', '/api/public/about-us');
    assert(publicNoQueryRes.status === 200, '1.3 GET /api/public/about-us returns 200');
    assert(publicNoQueryRes.data.success === true, '1.3 success is true');
    assert(publicNoQueryRes.data.data.isPublished === true, '1.3 isPublished is true');
    assert(publicNoQueryRes.data.data.content.title === 'English Title', '1.3 Content title is English Title');
    assert(publicNoQueryRes.data.data.language === undefined, '1.3 Default no-query GET response does NOT contain language key (preserves contract)');
    assert(publicNoQueryRes.data.data.fieldMetadata === undefined, '1.3 Default no-query GET response does NOT contain fieldMetadata key (preserves contract)');

    // ----------------------------------------------------
    // TEST GROUP 2: TRANSLATION MODEL & DRAFT ISOLATION
    // ----------------------------------------------------
    console.log('\n[TEST GROUP 2: Translation Model & Draft Isolation]');

    const valAId = updateEnRes.data.data.draft.coreValues[0].id;
    const valBId = updateEnRes.data.data.draft.coreValues[1].id;
    const metric1Id = updateEnRes.data.data.draft.highlights[0].id;

    // 2.1 Save Arabic Draft
    const updateArRes = await apiRequest(
      'PUT',
      '/api/super-admin/about-us/draft',
      {
        language: 'ar',
        title: 'العنوان بالعربية',
        subtitle: 'العنوان الفرعي بالعربية',
        introduction: 'المقدمة بالعربية',
        coreValues: [
          { id: valAId, title: 'القيمة أ', description: 'وصف القيمة أ' },
        ],
        highlights: [
          { id: metric1Id, title: 'مقياس 1', description: 'وصف المقياس' },
        ],
        ctaLabel: 'ابدأ الآن',
      },
      superAdminToken
    );

    assert(updateArRes.status === 200, '2.1 Save Arabic Draft returns 200');
    assert(updateArRes.data.data.translations.ar.draft.title === 'العنوان بالعربية', '2.1 AR Draft title saved');
    assert(updateArRes.data.data.draft.title === 'English Title', '2.1 AR save does NOT overwrite EN draft title');

    // 2.2 Save Tamil Draft
    const updateTaRes = await apiRequest(
      'PUT',
      '/api/super-admin/about-us/draft',
      {
        language: 'ta',
        title: 'தமிழ் தலைப்பு',
        mission: 'தமிழ் நோக்கம்',
        coreValues: [
          { id: valBId, title: 'மதிப்பு B', description: 'விளக்கம் B' },
        ],
      },
      superAdminToken
    );

    assert(updateTaRes.status === 200, '2.2 Save Tamil Draft returns 200');
    assert(updateTaRes.data.data.translations.ta.draft.title === 'தமிழ் தலைப்பு', '2.2 TA Draft title saved');
    assert(updateTaRes.data.data.translations.ar.draft.title === 'العنوان بالعربية', '2.2 TA save does NOT overwrite AR draft title');
    assert(updateTaRes.data.data.draft.title === 'English Title', '2.2 TA save does NOT overwrite EN draft title');

    // 2.3 Verify EN translation row does NOT exist in DB
    const allTrans = await prisma.aboutUsTranslation.findMany({ where: { aboutUsId: 'global' } });
    const arTrans = allTrans.filter((t) => t.language === 'AR');
    const taTrans = allTrans.filter((t) => t.language === 'TA');
    const enTrans = allTrans.filter((t) => t.language === 'EN');
    assert(arTrans.length > 0 && taTrans.length > 0, '2.3 AR and TA translation rows exist');
    assert(enTrans.length === 0, '2.3 Saving English draft does NOT create an EN translation row');

    // 2.4 Verify translation schema rejects icon in AR/TA coreValues payload
    const rejectArIconRes = await apiRequest(
      'PUT',
      '/api/super-admin/about-us/draft',
      {
        language: 'ar',
        coreValues: [
          { id: valAId, title: 'القيمة أ', description: 'وصف', icon: 'Shield' },
        ],
      },
      superAdminToken
    );
    assert(rejectArIconRes.status === 400, '2.4 Backend rejects icon in AR coreValues payload with 400');

    // 2.5 Verify translation schema rejects metric in AR/TA highlights payload
    const rejectArMetricRes = await apiRequest(
      'PUT',
      '/api/super-admin/about-us/draft',
      {
        language: 'ar',
        highlights: [
          { id: metric1Id, title: 'مقياس 1', metric: '100+', description: 'وصف' },
        ],
      },
      superAdminToken
    );
    // 2.6 Verify schema rejects CMS admin UI header copy in draft payload
    const rejectCmsHelperRes = await apiRequest(
      'PUT',
      '/api/super-admin/about-us/draft',
      {
        language: 'ta',
        title: 'Hero Visual & Main Headlines (EN) Primary visual banner',
      },
      superAdminToken
    );
    assert(rejectCmsHelperRes.status === 400, '2.6 Backend rejects CMS admin UI header copy in draft title with 400');

    // ----------------------------------------------------
    // TEST GROUP 3: PUBLIC DRAFT ISOLATION
    // ----------------------------------------------------
    console.log('\n[TEST GROUP 3: Public Draft Isolation]');

    // Public API for AR and TA should still return English published content because AR and TA drafts have NOT been published yet
    const publicArBeforePublish = await apiRequest('GET', '/api/public/about-us?lang=ar');
    assert(publicArBeforePublish.status === 200, '3.1 GET /api/public/about-us?lang=ar returns 200');
    assert(publicArBeforePublish.data.data.language === 'ar', '3.1 Language is ar');
    assert(publicArBeforePublish.data.data.direction === 'rtl', '3.1 Direction is rtl');
    assert(publicArBeforePublish.data.data.content.title === 'English Title', '3.1 Public AR resolves to English published title before publish (no draft leakage)');
    assert(publicArBeforePublish.data.data.fieldMetadata.title.isFallback === true, '3.1 Field metadata title isFallback is true');

    // ----------------------------------------------------
    // TEST GROUP 4: ATOMIC PUBLISH & LOCALIZED RESOLUTION
    // ----------------------------------------------------
    console.log('\n[TEST GROUP 4: Atomic Publish & Localized Resolution]');

    // 4.1 Publish all languages atomically
    const publishAllRes = await apiRequest('POST', '/api/super-admin/about-us/publish', {}, superAdminToken);
    assert(publishAllRes.status === 200, '4.1 Publish returns 200');
    assert(publishAllRes.data.data.translations.ar.published !== null, '4.1 AR published snapshot exists');
    assert(publishAllRes.data.data.translations.ta.published !== null, '4.1 TA published snapshot exists');

    // 4.2 Query Public AR
    const publicArAfterPublish = await apiRequest('GET', '/api/public/about-us?lang=ar');
    assert(publicArAfterPublish.data.data.content.title === 'العنوان بالعربية', '4.2 Public AR returns localized title');
    assert(publicArAfterPublish.data.data.fieldMetadata.title.isFallback === false, '4.2 Title isFallback is false');
    assert(publicArAfterPublish.data.data.fieldMetadata.title.lang === 'ar', '4.2 Title metadata lang is ar');
    assert(publicArAfterPublish.data.data.fieldMetadata.title.dir === 'rtl', '4.2 Title metadata dir is rtl');

    // Field-by-field fallback check for missing AR mission (should fall back to English)
    assert(publicArAfterPublish.data.data.content.mission === 'English Mission', '4.2 Missing AR mission falls back to English Mission');
    assert(publicArAfterPublish.data.data.fieldMetadata.mission.isFallback === true, '4.2 Mission metadata isFallback is true');
    assert(publicArAfterPublish.data.data.fieldMetadata.mission.lang === 'en', '4.2 Mission metadata lang is en');
    assert(publicArAfterPublish.data.data.fieldMetadata.mission.dir === 'ltr', '4.2 Mission metadata dir is ltr');

    // Array item resolution check for AR
    const arCoreValA = publicArAfterPublish.data.data.content.coreValues.find((v) => v.id === valAId);
    const arCoreValB = publicArAfterPublish.data.data.content.coreValues.find((v) => v.id === valBId);
    assert(arCoreValA.title === 'القيمة أ', '4.2 Core value A has Arabic localized title');
    assert(arCoreValA.icon === 'Shield', '4.2 Core value A inherits canonical English icon');
    assert(arCoreValB.title === 'Value B', '4.2 Core value B without AR translation falls back to English title');

    // 4.3 Query Public TA
    const publicTaAfterPublish = await apiRequest('GET', '/api/public/about-us?lang=ta');
    assert(publicTaAfterPublish.data.data.language === 'ta', '4.3 Language is ta');
    assert(publicTaAfterPublish.data.data.direction === 'ltr', '4.3 Direction is ltr');
    assert(publicTaAfterPublish.data.data.content.title === 'தமிழ் தலைப்பு', '4.3 Public TA returns localized title');
    assert(publicTaAfterPublish.data.data.content.mission === 'தமிழ் நோக்கம்', '4.3 Public TA returns localized mission');

    // 4.4 Query Public ?lang=en explicitly
    const publicEnExplicit = await apiRequest('GET', '/api/public/about-us?lang=en');
    assert(publicEnExplicit.data.data.language === 'en', '4.4 Language is en');
    assert(publicEnExplicit.data.data.direction === 'ltr', '4.4 Direction is ltr');
    assert(publicEnExplicit.data.data.content.title === 'English Title', '4.4 Title is English Title');
    assert(publicEnExplicit.data.data.fieldMetadata !== undefined, '4.4 Explicit ?lang=en contains fieldMetadata');

    // 4.5 Invalid language query ?lang=invalid
    const publicInvalidLang = await apiRequest('GET', '/api/public/about-us?lang=invalid');
    assert(publicInvalidLang.data.data.language === 'en', '4.5 Invalid lang query resolves to en');
    assert(publicInvalidLang.data.data.direction === 'ltr', '4.5 Invalid lang query resolves to ltr');

    // ----------------------------------------------------
    // TEST GROUP 5: ARRAY STABILITY, REORDERING & ORPHANS
    // ----------------------------------------------------
    console.log('\n[TEST GROUP 5: Array Stability, Reordering & Orphans]');

    // 5.1 Reorder English core values
    await apiRequest(
      'PUT',
      '/api/super-admin/about-us/draft',
      {
        coreValues: [
          { id: valBId, title: 'Value B', description: 'Desc B', icon: 'Book' },
          { id: valAId, title: 'Value A', description: 'Desc A', icon: 'Shield' },
        ],
      },
      superAdminToken
    );
    await apiRequest('POST', '/api/super-admin/about-us/publish', {}, superAdminToken);

    const publicArReordered = await apiRequest('GET', '/api/public/about-us?lang=ar');
    const reorderedVals = publicArReordered.data.data.content.coreValues;
    assert(reorderedVals[0].id === valBId, '5.1 First item is now Value B');
    assert(reorderedVals[1].id === valAId, '5.1 Second item is now Value A');
    assert(reorderedVals[1].title === 'القيمة أ', '5.1 AR translation for Value A remains attached after reorder');

    // ----------------------------------------------------
    // TEST GROUP 6: CLEARING TRANSLATED FIELDS
    // ----------------------------------------------------
    console.log('\n[TEST GROUP 6: Clearing Translated Fields]');

    // Clear AR title in draft
    await apiRequest(
      'PUT',
      '/api/super-admin/about-us/draft',
      {
        language: 'ar',
        title: '', // Cleared intentionally
      },
      superAdminToken
    );
    await apiRequest('POST', '/api/super-admin/about-us/publish', {}, superAdminToken);

    const publicArAfterClear = await apiRequest('GET', '/api/public/about-us?lang=ar');
    assert(publicArAfterClear.data.data.content.title === 'English Title', '6.1 Cleared AR title falls back to English Published title after publish');
    assert(publicArAfterClear.data.data.fieldMetadata.title.isFallback === true, '6.1 Cleared AR title metadata isFallback is true');

    // ----------------------------------------------------
    // TEST GROUP 7: UNPUBLISHED BEHAVIOR
    // ----------------------------------------------------
    console.log('\n[TEST GROUP 7: Unpublished Behavior]');

    await apiRequest('POST', '/api/super-admin/about-us/unpublish', {}, superAdminToken);

    const publicUnpublishedAr = await apiRequest('GET', '/api/public/about-us?lang=ar');
    assert(publicUnpublishedAr.data.data.isPublished === false, '7.1 UNPUBLISHED status returns isPublished: false even when AR translation exists');
    assert(publicUnpublishedAr.data.data.content === null, '7.1 UNPUBLISHED status content is null');

    // Re-publish for cleanup
    await apiRequest('POST', '/api/super-admin/about-us/publish', {}, superAdminToken);

  } finally {
    await cleanupFixtures();
  }

  console.log('\n==================================================');
  console.log(`MULTILINGUAL ABOUT US TEST RESULTS`);
  console.log(`Passed: ${testPassedCount}`);
  console.log(`Failed: ${testFailedCount}`);
  console.log('==================================================\n');

  if (testFailedCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test script crashed:', err);
  process.exit(1);
});
