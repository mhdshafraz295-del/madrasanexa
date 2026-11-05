import dotenv from 'dotenv';
dotenv.config();

// 1. Mandatory test environment configuration
process.env.NODE_ENV = 'test';
process.env.MOCK_SMS = 'true';
process.env.EMAIL_PROVIDER = 'test';

// 2. Strict DATABASE_TEST_URL check: Must be present, non-empty string
const testDbUrl = process.env.DATABASE_TEST_URL;
if (!testDbUrl || typeof testDbUrl !== 'string' || testDbUrl.trim() === '') {
  throw new Error('FATAL DATABASE ISOLATION ERROR: DATABASE_TEST_URL is mandatory for test execution. Aborting immediately.');
}

// 3. Parse database URL safely without exposing credentials
let parsedDbName = '';
try {
  const urlObj = new URL(testDbUrl);
  parsedDbName = urlObj.pathname.replace(/^\//, '').split('?')[0];
} catch {
  throw new Error('FATAL DATABASE ISOLATION ERROR: DATABASE_TEST_URL is an invalid URI format.');
}

if (parsedDbName !== 'madrasanexa_test') {
  throw new Error(`FATAL DATABASE ISOLATION ERROR: Target database name is "${parsedDbName}". Must strictly be "madrasanexa_test". Aborting!`);
}

// 4. Overwrite DATABASE_URL in process.env so schema.prisma and subprocesses point to test database
process.env.DATABASE_URL = testDbUrl;
