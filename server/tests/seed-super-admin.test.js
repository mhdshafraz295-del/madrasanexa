import { PrismaClient } from '@prisma/client';
import { bootstrapSuperAdmin } from '../prisma/seed-super-admin.js';
import { hashPassword, comparePassword } from '../src/utils/password.js';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SEED_SCRIPT_PATH = path.resolve(__dirname, '../prisma/seed-super-admin.js');

// Strictly target MySQL 8.4 on port 3307 (isolated disposable test server)
const TEST_DATABASE_URL = 'mysql://root:@127.0.0.1:3307/madrasanexa_clean_migration_test';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: TEST_DATABASE_URL,
    },
  },
});

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    failed++;
    console.error(`❌ FAILED: ${message}`);
    throw new Error(message);
  }
  passed++;
  console.log(`✅ PASSED: ${message}`);
}

async function assertThrowsAsync(fn, expectedSubstring, testName) {
  try {
    await fn();
    failed++;
    console.error(`❌ FAILED [${testName}]: Expected function to throw, but it succeeded.`);
    throw new Error(`Expected throw for ${testName}`);
  } catch (err) {
    if (expectedSubstring && !err.message.includes(expectedSubstring)) {
      failed++;
      console.error(`❌ FAILED [${testName}]: Expected error message containing "${expectedSubstring}", got "${err.message}"`);
      throw err;
    }
    passed++;
    console.log(`✅ PASSED [${testName}]: Successfully caught expected error "${err.message}"`);
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('🧪 MADRASANEXA SUPER ADMIN SEED VERIFICATION TEST SUITE');
  console.log(`🎯 Database: ${TEST_DATABASE_URL}`);
  console.log('================================================================\n');

  const testEmails = [
    'initial.superadmin@madrasanexa.com',
    'mustchange.admin@madrasanexa.com',
    'school.principal@madrasanexa.com',
    'cli.superadmin@madrasanexa.com',
  ];

  try {
    // 0. Ensure clean slate for test emails in test database
    console.log('--- Step 0: Cleaning up prior test artifacts if any ---');
    await prisma.user.deleteMany({
      where: {
        email: { in: testEmails },
      },
    });
    console.log('Clean slate ready.\n');

    // 1. Missing required parameters
    console.log('--- Test Group 1: Missing Required Inputs ---');
    await assertThrowsAsync(
      () => bootstrapSuperAdmin({ email: '', password: 'ValidPassword123!', databaseUrl: TEST_DATABASE_URL }),
      'SUPER_ADMIN_EMAIL is required',
      'Empty email validation'
    );

    await assertThrowsAsync(
      () => bootstrapSuperAdmin({ email: '   ', password: 'ValidPassword123!', databaseUrl: TEST_DATABASE_URL }),
      'SUPER_ADMIN_EMAIL is required',
      'Whitespace-only email validation'
    );

    await assertThrowsAsync(
      () => bootstrapSuperAdmin({ email: 'admin@madrasanexa.com', password: '', databaseUrl: TEST_DATABASE_URL }),
      'SUPER_ADMIN_PASSWORD is required',
      'Empty password validation'
    );

    await assertThrowsAsync(
      () => bootstrapSuperAdmin({ email: 'admin@madrasanexa.com', password: '   ', databaseUrl: TEST_DATABASE_URL }),
      'SUPER_ADMIN_PASSWORD is required',
      'Whitespace-only password validation'
    );

    // 2. Invalid email format
    console.log('\n--- Test Group 2: Invalid Email Syntax ---');
    const invalidEmails = ['plainaddress', 'user@', '@domain.com', 'user@domain@domain.com'];
    for (const invEmail of invalidEmails) {
      await assertThrowsAsync(
        () => bootstrapSuperAdmin({ email: invEmail, password: 'ValidPassword123!', databaseUrl: TEST_DATABASE_URL }),
        'SUPER_ADMIN_EMAIL must be a valid email address',
        `Invalid email format (${invEmail})`
      );
    }

    // 3. Password strength policy enforcement
    console.log('\n--- Test Group 3: Password Strength Policy Enforcement ---');
    await assertThrowsAsync(
      () => bootstrapSuperAdmin({ email: 'admin@madrasanexa.com', password: 'Short1!', databaseUrl: TEST_DATABASE_URL }),
      'Password must be at least 10 characters long',
      'Password too short (< 10 chars)'
    );

    await assertThrowsAsync(
      () => bootstrapSuperAdmin({ email: 'admin@madrasanexa.com', password: 'allletterslongpassword', databaseUrl: TEST_DATABASE_URL }),
      'Password must contain at least one letter and at least one number or symbol',
      'Password missing numbers or symbols'
    );

    await assertThrowsAsync(
      () => bootstrapSuperAdmin({ email: 'admin@madrasanexa.com', password: '123456789012345', databaseUrl: TEST_DATABASE_URL }),
      'Password must contain at least one letter and at least one number or symbol',
      'Password missing letters'
    );

    // 4. Successful creation of first Super Admin
    console.log('\n--- Test Group 4: Successful Super Admin Creation ---');
    const createResult = await bootstrapSuperAdmin({
      name: '  Lead Platform Administrator  ',
      email: '  Initial.SuperAdmin@MadrasaNexa.COM  ',
      password: 'StrongSuperAdmin#2026!',
      databaseUrl: TEST_DATABASE_URL,
    });

    assert(createResult.success === true, 'bootstrapSuperAdmin returned success: true');
    assert(createResult.alreadyExists === false, 'bootstrapSuperAdmin returned alreadyExists: false');
    assert(createResult.user.email === 'initial.superadmin@madrasanexa.com', 'Email correctly normalized to lowercase');
    assert(createResult.user.name === 'Lead Platform Administrator', 'Name correctly trimmed');
    assert(createResult.user.role === 'SUPER_ADMIN', 'Role is SUPER_ADMIN');
    assert(createResult.user.passwordHash === undefined, 'Returned user object does not expose passwordHash');

    // Deep database record inspection
    const dbUser = await prisma.user.findUnique({
      where: { email: 'initial.superadmin@madrasanexa.com' },
    });
    assert(Boolean(dbUser), 'User record persisted in database');
    assert(dbUser.role === 'SUPER_ADMIN', 'DB record role is strictly SUPER_ADMIN');
    assert(dbUser.madrasaId === null, 'DB record madrasaId is null (super admin has no tenant constraint)');
    assert(dbUser.isActive === true, 'DB record isActive is true');
    assert(dbUser.mustChangePassword === false, 'DB record mustChangePassword is false');
    assert(dbUser.tokenVersion === 0, 'DB record tokenVersion is 0');
    assert(typeof dbUser.passwordHash === 'string' && dbUser.passwordHash.startsWith('$2'), 'Bcrypt hash correctly stored');

    const passwordMatches = await comparePassword('StrongSuperAdmin#2026!', dbUser.passwordHash);
    assert(passwordMatches === true, 'Stored bcrypt hash authenticates plaintext password');

    const wrongPasswordMatches = await comparePassword('IncorrectPassword#2026!', dbUser.passwordHash);
    assert(wrongPasswordMatches === false, 'Stored bcrypt hash rejects incorrect password');

    // 5. Idempotency (re-running with same email does not overwrite or rehash)
    console.log('\n--- Test Group 5: Non-Destructive Idempotency ---');
    const existingHash = dbUser.passwordHash;
    const existingUpdatedAt = dbUser.updatedAt;

    const duplicateResult = await bootstrapSuperAdmin({
      name: 'Different Name Should Be Ignored',
      email: 'INITIAL.SUPERADMIN@madrasanexa.com', // different case
      password: 'CompletelyDifferentPassword#999!',
      databaseUrl: TEST_DATABASE_URL,
    });

    assert(duplicateResult.success === true, 'Idempotent run returned success: true');
    assert(duplicateResult.alreadyExists === true, 'Idempotent run returned alreadyExists: true');

    const recheckedUser = await prisma.user.findUnique({
      where: { email: 'initial.superadmin@madrasanexa.com' },
    });
    assert(recheckedUser.id === dbUser.id, 'User ID remained unchanged');
    assert(recheckedUser.passwordHash === existingHash, 'Password hash was NOT overwritten by duplicate invocation');
    assert(recheckedUser.name === 'Lead Platform Administrator', 'Name was NOT overwritten by duplicate invocation');

    const stillAuthenticatesOriginal = await comparePassword('StrongSuperAdmin#2026!', recheckedUser.passwordHash);
    assert(stillAuthenticatesOriginal === true, 'Original password still authenticates after duplicate run');

    // 6. Role conflict protection (cannot overwrite or elevate non-super-admin)
    console.log('\n--- Test Group 6: Role Conflict Protection ---');
    await prisma.user.create({
      data: {
        name: 'School Principal',
        email: 'school.principal@madrasanexa.com',
        passwordHash: await hashPassword('AnyPass123!'),
        role: 'MADRASA_ADMIN',
        isActive: true,
      },
    });

    await assertThrowsAsync(
      () =>
        bootstrapSuperAdmin({
          email: 'school.principal@madrasanexa.com',
          password: 'SuperAdminPass#2026!',
          databaseUrl: TEST_DATABASE_URL,
        }),
      'Conflict Error: An account with email "school.principal@madrasanexa.com" already exists with role "MADRASA_ADMIN"',
      'Role conflict throws error and blocks overwrite'
    );

    const principalCheck = await prisma.user.findUnique({
      where: { email: 'school.principal@madrasanexa.com' },
    });
    assert(principalCheck.role === 'MADRASA_ADMIN', 'Existing non-super-admin role was preserved intact');

    // 7. Optional mustChangePassword flag
    console.log('\n--- Test Group 7: Custom Parameters (mustChangePassword) ---');
    const mustChangeResult = await bootstrapSuperAdmin({
      email: 'mustchange.admin@madrasanexa.com',
      password: 'MustChangePass#2026!',
      mustChangePassword: true,
      databaseUrl: TEST_DATABASE_URL,
    });
    assert(mustChangeResult.user.mustChangePassword === true, 'mustChangePassword returned true');

    const mustChangeDb = await prisma.user.findUnique({
      where: { email: 'mustchange.admin@madrasanexa.com' },
    });
    assert(mustChangeDb.mustChangePassword === true, 'DB record mustChangePassword persisted true');

    // 8. CLI direct execution test
    console.log('\n--- Test Group 8: Direct CLI Execution via Child Process ---');

    // 8a. CLI without env vars should exit with code 1
    const cliNoEnvExitCode = await new Promise((resolve) => {
      const child = spawn(process.execPath, [SEED_SCRIPT_PATH], {
        env: { ...process.env, SUPER_ADMIN_EMAIL: '', SUPER_ADMIN_PASSWORD: '' },
      });
      child.on('exit', (code) => resolve(code));
    });
    assert(cliNoEnvExitCode === 1, 'CLI without environment variables exited with code 1');

    // 8b. CLI with valid env vars should create account and exit with code 0
    const cliWithEnvExitCode = await new Promise((resolve) => {
      const child = spawn(process.execPath, [SEED_SCRIPT_PATH], {
        env: {
          ...process.env,
          DATABASE_URL: TEST_DATABASE_URL,
          SUPER_ADMIN_NAME: 'CLI Admin',
          SUPER_ADMIN_EMAIL: 'cli.superadmin@madrasanexa.com',
          SUPER_ADMIN_PASSWORD: 'CliSuperPassword#2026!',
        },
      });
      let stderr = '';
      child.stderr.on('data', (d) => (stderr += d.toString()));
      child.on('exit', (code) => {
        if (code !== 0) console.error('CLI stderr:', stderr);
        resolve(code);
      });
    });
    assert(cliWithEnvExitCode === 0, 'CLI with valid environment variables exited with code 0');

    const cliCreatedUser = await prisma.user.findUnique({
      where: { email: 'cli.superadmin@madrasanexa.com' },
    });
    assert(Boolean(cliCreatedUser), 'CLI successfully created account in database');
    assert(cliCreatedUser.role === 'SUPER_ADMIN', 'CLI created account has role SUPER_ADMIN');

    // 9. Cleanup test records
    console.log('\n--- Step 9: Post-Test Cleanup ---');
    const deleteResult = await prisma.user.deleteMany({
      where: {
        email: { in: testEmails },
      },
    });
    console.log(`Cleaned up ${deleteResult.count} test records from isolated test database.`);

    console.log('\n================================================================');
    console.log(`🎉 ALL TESTS COMPLETED: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================');
  } finally {
    await prisma.$disconnect();
  }
}

runTests().catch((err) => {
  console.error('\n❌ Unhandled test runner error:', err);
  process.exit(1);
});
