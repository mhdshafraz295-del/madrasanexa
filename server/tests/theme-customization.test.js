import { prisma } from '../src/lib/prisma.js';
import { hashPassword } from '../src/utils/password.js';
import { signAccessToken } from '../src/utils/jwt.js';
import app from '../src/app.js';
import http from 'http';

const TEST_PREFIX = 'theme_test_' + Date.now();

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

async function setup() {
  console.log('\n--- Setting up Theme Customization Test Fixtures ---');
  const now = new Date();

  // Subscription Plan
  const plan = await prisma.plan.upsert({
    where: { code: 'PRO_THEME_TEST' },
    update: {},
    create: {
      name: 'Pro Theme Test Plan',
      code: 'PRO_THEME_TEST',
      description: 'Theme Test Plan',
      durationMonths: 12,
      price: 15000,
      isActive: true,
    },
  });

  // Tenant A
  madrasaA = await prisma.madrasa.create({
    data: {
      code: `${TEST_PREFIX}_MDA`,
      name: 'Al-Huda Theme Academy',
      slug: `${TEST_PREFIX}-alhuda`,
      status: 'ACTIVE',
      phone: '+94771234567',
      email: 'info@alhuda.edu',
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
          heroTitle: 'Welcome to Al-Huda Theme Academy',
          heroSubtitle: 'Excellence in Islamic Learning and Character',
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

  // Tenant B
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
          heroTitle: 'Welcome to Noor Academy B',
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
  console.log('\n--- Tearing Down Theme Customization Test Fixtures ---');
  if (testServer) {
    await new Promise((resolve) => testServer.close(resolve));
  }

  try {
    const madrasaIds = [madrasaA?.id, madrasaB?.id].filter(Boolean);
    if (madrasaIds.length > 0) {
      await prisma.madrasaProfile.deleteMany({
        where: { madrasaId: { in: madrasaIds } },
      });
      await prisma.subscription.deleteMany({
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

    console.log('\n=== RUNNING THEME CUSTOMIZATION E2E & REGRESSION TESTS ===\n');

    // TEST 1: Get Theme initial state returns default presets and null published
    console.log('[TEST 1] GET /api/madrasa-admin/portal-cms/theme loads default theme and presets');
    const resGetTheme = await fetch(`${baseUrl}/api/madrasa-admin/portal-cms/theme`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(resGetTheme.status === 200, 'GET /portal-cms/theme returns 200 OK');
    const jsonGetTheme = await resGetTheme.json();
    assert(jsonGetTheme.success === true, 'Response is success');
    assert(jsonGetTheme.data.presets.length === 6, 'Exactly 6 coordinated presets available');
    assert(jsonGetTheme.data.published === null, 'Initial published theme is null');
    assert(!!jsonGetTheme.data.draft.primaryBtnBg, 'Draft theme contains color tokens');
    assert(jsonGetTheme.data.contrastAnalysis.isAccessible === true, 'Default theme passes WCAG contrast checks');

    // TEST 2: Save Draft Theme
    console.log('\n[TEST 2] PUT /api/madrasa-admin/portal-cms/theme/draft saves draft changes');
    const customTokens = {
      ...jsonGetTheme.data.draft,
      primaryBtnBg: '#0284c7', // Ocean blue
      primaryBtnHoverBg: '#0369a1',
      pageBg: '#f0fdf4',
    };

    const resSaveDraft = await fetch(`${baseUrl}/api/madrasa-admin/portal-cms/theme/draft`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify(customTokens),
    });
    assert(resSaveDraft.status === 200, 'PUT /portal-cms/theme/draft returns 200 OK');
    const jsonSaveDraft = await resSaveDraft.json();
    assert(jsonSaveDraft.data.draft.primaryBtnBg === '#0284c7', 'Draft primaryBtnBg updated to #0284c7');
    assert(jsonSaveDraft.data.published === null, 'Published theme remains null when saving draft');

    // TEST 3: Public visitors see default theme, NOT the draft
    console.log('\n[TEST 3] Public endpoints do not expose unreleased draft themes');
    const resPublicHome = await fetch(`${baseUrl}/api/public/madrasa/${madrasaA.slug}`);
    assert(resPublicHome.status === 200, 'Public homepage returns 200 OK');
    const jsonPublicHome = await resPublicHome.json();
    assert(
      jsonPublicHome.data.theme.primaryBtnBg !== '#0284c7',
      'Public homepage does NOT expose unreleased draft theme token'
    );
    assert(
      jsonPublicHome.data.theme.primaryBtnBg === '#047857',
      'Public homepage falls back to default published theme'
    );

    // TEST 4: Validation rejects invalid hex codes and unrecognized keys
    console.log('\n[TEST 4] Theme token validation rejects malformed colors and unknown keys');
    const badTokens = {
      ...customTokens,
      primaryBtnBg: 'not-a-color',
    };
    const resBadTokens = await fetch(`${baseUrl}/api/madrasa-admin/portal-cms/theme/draft`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify(badTokens),
    });
    assert(resBadTokens.status === 400, 'Invalid color token strictly rejected with 400 Bad Request');

    // TEST 4B: Rejection of unrecognized legacy keys (e.g. bodyText, bodyBg)
    const unknownKeysPayload = {
      ...customTokens,
      bodyText: '#334155',
      bodyBg: '#fcfbf7',
    };
    const resUnknownKeys = await fetch(`${baseUrl}/api/madrasa-admin/portal-cms/theme/draft`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify(unknownKeysPayload),
    });
    assert(resUnknownKeys.status === 400, 'Unrecognized keys bodyText and bodyBg strictly rejected with 400 Bad Request');
    const jsonUnknownKeys = await resUnknownKeys.json();
    const hasUnrecognizedMsg = JSON.stringify(jsonUnknownKeys).includes('Unrecognized key');
    assert(hasUnrecognizedMsg, 'Response error specifies Unrecognized keys');

    // TEST 4C: Canonical frontend theme payload is accepted cleanly
    const canonicalFrontendPayload = {
      pageBg: '#fcfbf7',
      navbarBg: '#ffffff',
      heroOverlay: '#064e3b',
      heroOverlayOpacity: 0.88,
      sectionBg: '#ffffff',
      footerBg: '#062e24',
      cardBg: '#ffffff',
      headingColor: '#064e3b',
      sectionHeadingColor: '#0f172a',
      bodyTextColor: '#334155',
      mutedTextColor: '#64748b',
      linkColor: '#047857',
      linkHoverColor: '#065f46',
      heroTextColor: '#ffffff',
      footerTextColor: '#cbd5e1',
      primaryBtnBg: '#047857',
      primaryBtnText: '#ffffff',
      primaryBtnHoverBg: '#065f46',
      secondaryBtnBg: '#f1f5f9',
      secondaryBtnText: '#0f172a',
      secondaryBtnBorder: '#cbd5e1',
      cardBorderColor: '#e2e8f0',
      cardShadowIntensity: 'subtle',
      dividerColor: '#e2e8f0',
      borderRadius: 'xl',
      inputBg: '#ffffff',
      inputBorderColor: '#cbd5e1',
      inputFocusBorder: '#047857',
      inputText: '#0f172a',
      inputPlaceholder: '#94a3b8',
    };
    const resCanonical = await fetch(`${baseUrl}/api/madrasa-admin/portal-cms/theme/draft`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify(canonicalFrontendPayload),
    });
    assert(resCanonical.status === 200, 'Canonical frontend theme object strictly accepted with 200 OK');

    // TEST 5: Contrast Analyzer detects low-contrast combination
    console.log('\n[TEST 5] Contrast analyzer detects inaccessible color combinations');
    const lowContrastTokens = {
      ...customTokens,
      primaryBtnBg: '#ffffff',
      primaryBtnText: '#ffffff', // White on white!
    };
    const resLowContrast = await fetch(`${baseUrl}/api/madrasa-admin/portal-cms/theme/draft`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify(lowContrastTokens),
    });
    assert(resLowContrast.status === 200, 'Low contrast draft accepted with warnings');
    const jsonLowContrast = await resLowContrast.json();
    assert(jsonLowContrast.data.contrastAnalysis.isAccessible === false, 'Contrast analyzer flagged inaccessible combination');
    assert(jsonLowContrast.data.contrastAnalysis.warnings.length > 0, 'Returned detailed contrast warnings');
    assert(!!jsonLowContrast.data.contrastAnalysis.warnings[0].suggestedFg, 'Provided accessible suggested shade');

    // TEST 6: Publish Theme makes it public
    console.log('\n[TEST 6] POST /api/madrasa-admin/portal-cms/theme/publish publishes theme to public visitors');
    const oceanNavyPreset = jsonGetTheme.data.presets.find((p) => p.id === 'ocean-navy');
    assert(!!oceanNavyPreset, 'Found ocean-navy preset');

    const resPublish = await fetch(`${baseUrl}/api/madrasa-admin/portal-cms/theme/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ tokens: oceanNavyPreset.tokens }),
    });
    assert(resPublish.status === 200, 'POST /portal-cms/theme/publish returns 200 OK');
    const jsonPublish = await resPublish.json();
    assert(jsonPublish.data.published.primaryBtnBg === '#0284c7', 'Published theme has ocean-navy primaryBtnBg');

    // Public visitors now see the published ocean-navy theme!
    const resPublicAfterPublish = await fetch(`${baseUrl}/api/public/madrasa/${madrasaA.slug}`);
    const jsonPublicAfterPublish = await resPublicAfterPublish.json();
    assert(
      jsonPublicAfterPublish.data.theme.primaryBtnBg === '#0284c7',
      'Public homepage reflects newly published theme tokens'
    );

    // Public admissions page also delivers the published theme!
    const resPublicAdm = await fetch(`${baseUrl}/api/public/madrasa/${madrasaA.slug}/admissions`);
    assert(resPublicAdm.status === 200, 'Public admissions endpoint returns 200 OK');
    const jsonPublicAdm = await resPublicAdm.json();
    assert(
      jsonPublicAdm.data.theme.primaryBtnBg === '#0284c7',
      'Public admissions page reflects newly published theme tokens'
    );
    assert(jsonPublicAdm.data.heroTitle === 'Welcome to Al-Huda Theme Academy', 'Admissions page reflects heroTitle');

    // TEST 7: Reset to default theme
    console.log('\n[TEST 7] POST /api/madrasa-admin/portal-cms/theme/reset resets draft to default');
    const resReset = await fetch(`${baseUrl}/api/madrasa-admin/portal-cms/theme/reset`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(resReset.status === 200, 'POST /portal-cms/theme/reset returns 200 OK');
    const jsonReset = await resReset.json();
    assert(
      jsonReset.data.draft.primaryBtnBg === '#047857',
      'Draft reset to default Classic Islamic Green (#047857)'
    );

    // TEST 8: Discard unsaved draft changes
    console.log('\n[TEST 8] POST /api/madrasa-admin/portal-cms/theme/discard reverts draft to last published');
    const resDiscard = await fetch(`${baseUrl}/api/madrasa-admin/portal-cms/theme/discard`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(resDiscard.status === 200, 'POST /portal-cms/theme/discard returns 200 OK');
    const jsonDiscard = await resDiscard.json();
    assert(
      jsonDiscard.data.draft.primaryBtnBg === '#0284c7',
      'Draft reverted back to published Ocean Navy theme'
    );

    // TEST 9: Multi-tenant isolation - Tenant B cannot read or overwrite Tenant A's theme
    console.log('\n[TEST 9] Strict Multi-Tenant Isolation for Theme Customization');
    const resTenantBTheme = await fetch(`${baseUrl}/api/madrasa-admin/portal-cms/theme`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(resTenantBTheme.status === 200, 'Tenant B fetches own theme settings');
    const jsonTenantBTheme = await resTenantBTheme.json();
    assert(jsonTenantBTheme.data.published === null, 'Tenant B has its own unconfigured published theme');
    assert(
      jsonTenantBTheme.data.draft.primaryBtnBg === '#047857',
      'Tenant B draft is untouched by Tenant A modifications'
    );

    console.log('\n=============================================');
    console.log(`Theme Tests Results: ${testPassedCount} Passed, ${testFailedCount} Failed`);
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
