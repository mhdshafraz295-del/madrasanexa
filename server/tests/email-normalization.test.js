import './setup-test-env.js';
import { PrismaClient } from '@prisma/client';
import { normalizeEmail, createNormalizedEmailSchema, createOptionalNormalizedEmailSchema } from '../src/utils/email-normalization.js';
import { loginSchema } from '../src/validators/auth.validator.js';
import { publicOnboardingRequestSchema } from '../src/validations/onboarding.validation.js';
import { approveOnboardingSchema, updateMadrasaSchema } from '../src/validations/super-admin.validation.js';
import { updateSettingsSchema, updateAdminProfileSchema } from '../src/validations/madrasa-admin.validation.js';
import { prisma, getPrismaDatasourceUrl } from '../src/lib/prisma.js';
import { hashPassword } from '../src/utils/password.js';
import app from '../src/app.js';

const CANONICAL_EMAIL = 'mhdshafraz295@gmail.com';
const SUPER_ADMIN_CANONICAL_EMAIL = 'superadmin@madrasanexa.com';

const REQUIRED_VARIANTS = [
  { label: 'Canonical Exact', input: 'mhdshafraz295@gmail.com' },
  { label: 'Uppercase', input: 'MHDShafraz295@GMAIL.COM' },
  { label: 'Leading Whitespace', input: ' mhdshafraz295@gmail.com' },
  { label: 'Trailing Whitespace', input: 'mhdshafraz295@gmail.com ' },
  { label: 'Both-Side Whitespace', input: '  mhdshafraz295@gmail.com  ' },
];

const devPrisma = new PrismaClient({
  datasources: {
    db: {
      url: getPrismaDatasourceUrl(false),
    },
  },
});

async function testEmailNormalization() {
  let passed = 0;
  let failed = 0;
  let testServer = null;

  const assert = (condition, message) => {
    if (!condition) {
      failed++;
      throw new Error(message);
    }
    passed++;
  };

  try {
    console.log('--- 1. Read-Only Inspection of Stored Database Account Record ---');
    const storedUser = await devPrisma.user.findUnique({
      where: { email: CANONICAL_EMAIL },
      select: { id: true, name: true, email: true, role: true, madrasaId: true, isActive: true },
    });
    assert(Boolean(storedUser), `Expected user record for ${CANONICAL_EMAIL} to exist in primary database`);
    assert(storedUser.email === CANONICAL_EMAIL, `Expected exact canonical email "${CANONICAL_EMAIL}", got ${JSON.stringify(storedUser.email)}`);
    assert(!/[A-Z]/.test(storedUser.email), 'Stored email must not contain uppercase characters');
    assert(!/^\s/.test(storedUser.email), 'Stored email must not contain leading whitespace');
    assert(!/\s$/.test(storedUser.email), 'Stored email must not contain trailing whitespace');
    assert(!/[\r\n\t\v\f\u0000-\u001F\u007F-\u009F\u200B-\u200D\uFEFF]/.test(storedUser.email), 'Stored email must not contain newline/tab/hidden characters');
    console.log(`✅ Stored account record verified canonical: ${JSON.stringify(storedUser.email)} (id: ${storedUser.id}, role: ${storedUser.role})`);

    console.log('\n--- 2. Testing Direct normalizeEmail() Helper Across All 5 Required Variants ---');
    for (const v of REQUIRED_VARIANTS) {
      const normalized = normalizeEmail(v.input);
      assert(
        normalized === CANONICAL_EMAIL,
        `[${v.label}] normalizeEmail(${JSON.stringify(v.input)}) expected "${CANONICAL_EMAIL}", got "${normalized}"`
      );
      console.log(`  ✅ [${v.label}] ${JSON.stringify(v.input)} -> ${JSON.stringify(normalized)}`);
    }
    assert(normalizeEmail('  MhDshAfraZ295@gMaiL.cOm  ') === CANONICAL_EMAIL, 'Failed combined mixed-case + whitespace');
    assert(normalizeEmail(null) === null && normalizeEmail(undefined) === undefined, 'Failed handling null/undefined safely');

    console.log('\n--- 3. Testing Zod Schemas Across All 5 Required Variants ---');
    const requiredSchema = createNormalizedEmailSchema();
    const optionalSchema = createOptionalNormalizedEmailSchema();

    for (const v of REQUIRED_VARIANTS) {
      const parsedReq = requiredSchema.parse(v.input);
      assert(parsedReq === CANONICAL_EMAIL, `[${v.label}] createNormalizedEmailSchema failed: got ${parsedReq}`);

      const parsedOpt = optionalSchema.parse(v.input);
      assert(parsedOpt === CANONICAL_EMAIL, `[${v.label}] createOptionalNormalizedEmailSchema failed: got ${parsedOpt}`);

      const parsedLogin = loginSchema.parse({ email: v.input, password: 'TestPassword123!' });
      assert(parsedLogin.email === CANONICAL_EMAIL, `[${v.label}] loginSchema failed: got ${parsedLogin.email}`);

      const parsedOnboarding = publicOnboardingRequestSchema.parse({
        madrasaName: 'Test Madrasa',
        contactName: 'Test Contact',
        email: v.input,
        phone: '0771234567',
      });
      assert(parsedOnboarding.email === CANONICAL_EMAIL, `[${v.label}] publicOnboardingRequestSchema failed`);

      const parsedApprove = approveOnboardingSchema.parse({
        madrasaCode: 'TEST01',
        madrasaSlug: 'test-01',
        adminEmail: v.input,
      });
      assert(parsedApprove.adminEmail === CANONICAL_EMAIL, `[${v.label}] approveOnboardingSchema failed`);

      const parsedUpdateMadrasa = updateMadrasaSchema.parse({ email: v.input });
      assert(parsedUpdateMadrasa.email === CANONICAL_EMAIL, `[${v.label}] updateMadrasaSchema failed`);

      const parsedSettings = updateSettingsSchema.parse({ email: v.input });
      assert(parsedSettings.email === CANONICAL_EMAIL, `[${v.label}] updateSettingsSchema failed`);

      const parsedAdminProfile = updateAdminProfileSchema.parse({ email: v.input });
      assert(parsedAdminProfile.email === CANONICAL_EMAIL, `[${v.label}] updateAdminProfileSchema failed`);
    }

    let invalidFailed = false;
    try {
      requiredSchema.parse('invalid-email-string');
    } catch {
      invalidFailed = true;
    }
    assert(invalidFailed, 'Zod schema must reject invalid email syntax');
    assert(
      optionalSchema.parse(null) === null &&
        optionalSchema.parse(undefined) === null &&
        optionalSchema.parse('') === null,
      'Zod optional schema must normalize null/undefined/empty-string to null'
    );
    console.log('✅ All Zod schemas (Auth, Onboarding, Super Admin, Madrasa Admin) normalize all 5 variants to canonical form');

    console.log('\n--- 4. Testing Super Admin & Madrasa Admin Account Lookup Normalization (Read-Only on Primary DB) ---');
    const superAdminVariants = [
      'superadmin@madrasanexa.com',
      'SUPERADMIN@MADRASANEXA.COM',
      ' superadmin@madrasanexa.com',
      'superadmin@madrasanexa.com ',
      '  SUPERADMIN@MADRASANEXA.COM  ',
    ];
    for (const saInput of superAdminVariants) {
      const normalizedSa = normalizeEmail(saInput);
      assert(normalizedSa === SUPER_ADMIN_CANONICAL_EMAIL, `Super Admin normalizeEmail failed for ${saInput}`);
      const parsedSaLogin = loginSchema.parse({ email: saInput, password: 'TestPassword!' });
      assert(parsedSaLogin.email === SUPER_ADMIN_CANONICAL_EMAIL, `Super Admin loginSchema failed for ${saInput}`);

      const saRecord = await devPrisma.user.findUnique({
        where: { email: parsedSaLogin.email },
        select: { id: true, email: true, role: true, isActive: true },
      });
      assert(
        Boolean(saRecord) && saRecord.email === SUPER_ADMIN_CANONICAL_EMAIL && saRecord.role === 'SUPER_ADMIN',
        `Super Admin lookup failed for ${JSON.stringify(saInput)}`
      );
    }

    for (const maVariant of REQUIRED_VARIANTS) {
      const normalizedMa = normalizeEmail(maVariant.input);
      const maRecord = await devPrisma.user.findUnique({
        where: { email: normalizedMa },
        select: { id: true, email: true, role: true, madrasaId: true, isActive: true },
      });
      assert(
        Boolean(maRecord) && maRecord.email === CANONICAL_EMAIL && maRecord.role === 'MADRASA_ADMIN',
        `Madrasa Admin lookup failed for ${JSON.stringify(maVariant.input)}`
      );
    }
    console.log('✅ Super Admin and Madrasa Admin account lookups verified across all 5 normalized variants');

    console.log('\n--- 5. Testing End-to-End API Login (200 OK) & Wrong-Password Error Separation (401) Across All 5 Variants ---');
    // Seed isolated test fixture in madrasanexa_test (zero touches to primary madrasanexa DB)
    const testPwd = 'ValidTestPass#2026!';
    const testPwdHash = await hashPassword(testPwd);

    const testMadrasa = await prisma.madrasa.upsert({
      where: { code: 'NORM_TEST_01' },
      update: { status: 'ACTIVE', email: CANONICAL_EMAIL },
      create: {
        code: 'NORM_TEST_01',
        name: 'Email Normalization Test Madrasa',
        slug: 'email-norm-test-madrasa',
        email: CANONICAL_EMAIL,
        status: 'ACTIVE',
      },
    });

    await prisma.user.upsert({
      where: { email: CANONICAL_EMAIL },
      update: {
        passwordHash: testPwdHash,
        role: 'MADRASA_ADMIN',
        madrasaId: testMadrasa.id,
        isActive: true,
      },
      create: {
        name: 'Mhd Shafraz',
        email: CANONICAL_EMAIL,
        passwordHash: testPwdHash,
        role: 'MADRASA_ADMIN',
        madrasaId: testMadrasa.id,
        isActive: true,
      },
    });

    await prisma.user.upsert({
      where: { email: SUPER_ADMIN_CANONICAL_EMAIL },
      update: {
        passwordHash: testPwdHash,
        role: 'SUPER_ADMIN',
        madrasaId: null,
        isActive: true,
      },
      create: {
        name: 'System Super Admin',
        email: SUPER_ADMIN_CANONICAL_EMAIL,
        passwordHash: testPwdHash,
        role: 'SUPER_ADMIN',
        madrasaId: null,
        isActive: true,
      },
    });

    testServer = await new Promise((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    const port = testServer.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;

    for (const v of REQUIRED_VARIANTS) {
      // A. Valid password -> 200 OK + canonical email
      const okRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: v.input,
          password: testPwd,
        }),
      });
      const okJson = await okRes.json();
      assert(
        okRes.status === 200 && okJson.success === true,
        `[${v.label}] Expected 200 OK for valid credentials, got ${okRes.status}: ${JSON.stringify(okJson)}`
      );
      assert(
        okJson.data?.user?.email === CANONICAL_EMAIL,
        `[${v.label}] Expected authenticated user email "${CANONICAL_EMAIL}", got "${okJson.data?.user?.email}"`
      );

      // B. Wrong password -> 401 "Invalid email or password." (NEVER 400 or email-format validation error)
      const wrongRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: v.input,
          password: 'WrongPassword_999!',
        }),
      });
      const wrongJson = await wrongRes.json();
      assert(
        wrongRes.status === 401,
        `[${v.label}] Wrong password expected HTTP 401, got ${wrongRes.status}: ${JSON.stringify(wrongJson)}`
      );
      assert(
        wrongJson.message === 'Invalid email or password.',
        `[${v.label}] Wrong password expected "Invalid email or password.", got "${wrongJson.message}"`
      );
      assert(
        !wrongJson.errors && !/invalid email address/i.test(wrongJson.message || ''),
        `[${v.label}] Wrong password must NOT display an email-format validation error`
      );

      console.log(
        `  ✅ [${v.label}] input=${JSON.stringify(v.input)} -> ValidPwd: 200 (email="${okJson.data.user.email}") | WrongPwd: 401 ("${wrongJson.message}")`
      );
    }

    // Super Admin login across all 5 variants
    for (const saInput of superAdminVariants) {
      const saRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: saInput,
          password: testPwd,
        }),
      });
      const saJson = await saRes.json();
      assert(
        saRes.status === 200 && saJson.data?.user?.email === SUPER_ADMIN_CANONICAL_EMAIL && saJson.data?.user?.role === 'SUPER_ADMIN',
        `Super Admin login failed for ${JSON.stringify(saInput)}: status ${saRes.status}`
      );
    }
    console.log('✅ Super Admin HTTP login verified across all 5 normalized variants');

    // Genuinely invalid email syntax -> 400 Validation failed ("Invalid email address")
    const invalidRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'mhdshafraz295',
        password: testPwd,
      }),
    });
    const invalidJson = await invalidRes.json();
    assert(invalidRes.status === 400, `Expected status 400 for invalid email syntax, got ${invalidRes.status}`);
    assert(
      invalidJson.errors?.some((e) => e.path === 'email' && e.message === 'Invalid email address'),
      `Expected email validation error for malformed email, got ${JSON.stringify(invalidJson)}`
    );
    console.log('✅ API correctly rejects genuinely malformed email syntax with status 400');

    console.log(`\n🎉 ALL EMAIL NORMALIZATION & LOOKUP REGRESSION TESTS PASSED! (${passed} assertions passed, ${failed} failed)`);
  } finally {
    if (testServer) {
      await new Promise((resolve) => testServer.close(resolve));
    }
    await devPrisma.$disconnect();
    await prisma.$disconnect();
  }
}

testEmailNormalization().catch((err) => {
  console.error('❌ Regression test failed:', err);
  process.exit(1);
});
