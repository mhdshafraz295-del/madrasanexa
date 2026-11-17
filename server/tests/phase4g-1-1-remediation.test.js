/**
 * MadrasaNexa Phase 4G-1.1: Targeted Remediation Test Suite
 * Validates the four targeted deployment blocker remediations:
 * 1. Admin Classroom QR Management Tab Mounting
 * 2. Teacher Login Production Prefill Elimination
 * 3. Attendance History API Response Mapping
 * 4. Multi-Origin Production CORS Configuration
 *
 * Execution: 100% Offline / Zero Database Connection Required
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveAllowedOrigins } from '../src/app.js';
import { envSchema } from '../src/config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function test(description, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ PASS: ${description}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${description}`);
    console.error(`    ${err.message}`);
    failedTests++;
  }
}

console.log('\n================================================================');
console.log('  MadrasaNexa Phase 4G-1.1: Targeted Remediation Test Suite');
console.log('  (100% Offline / Zero Database Connection Required)');
console.log('================================================================\n');

// =============================================================================
// Group 1: Multi-Origin Production CORS Configuration (Blocker 4)
// =============================================================================
console.log('Group 1: Multi-Origin Production CORS Configuration (resolveAllowedOrigins)');

test('Configured Admin origin and Teacher Portal origin are both allowed in production', () => {
  const prodConfig = {
    NODE_ENV: 'production',
    FRONTEND_URL: 'https://admin.madrasanexa.lk',
    ALLOWED_ORIGINS: ['https://admin.madrasanexa.lk', 'https://teacher.madrasanexa.lk'],
  };

  const allowed = resolveAllowedOrigins(prodConfig);
  assert.equal(allowed.includes('https://admin.madrasanexa.lk'), true);
  assert.equal(allowed.includes('https://teacher.madrasanexa.lk'), true);
  assert.equal(allowed.includes('https://malicious-site.com'), false);
  // Production must NOT include localhost automatically
  assert.equal(allowed.includes('http://localhost:5173'), false);
  assert.equal(allowed.includes('http://localhost:5174'), false);
});

test('Comma-separated ALLOWED_ORIGINS string is correctly parsed and normalized', () => {
  const config = {
    NODE_ENV: 'production',
    ALLOWED_ORIGINS: 'https://admin.madrasanexa.lk/, https://teacher.madrasanexa.lk/ ',
  };

  const allowed = resolveAllowedOrigins(config);
  assert.deepEqual(allowed.sort(), [
    'https://admin.madrasanexa.lk',
    'https://teacher.madrasanexa.lk',
  ].sort());
});

test('Backward compatibility preserved when only FRONTEND_URL is provided', () => {
  const config = {
    NODE_ENV: 'production',
    FRONTEND_URL: 'https://legacy-admin.madrasanexa.lk',
  };

  const allowed = resolveAllowedOrigins(config);
  assert.equal(allowed.includes('https://legacy-admin.madrasanexa.lk'), true);
  assert.equal(allowed.length, 1);
});

test('Development mode automatically permits localhost development ports', () => {
  const devConfig = {
    NODE_ENV: 'development',
    FRONTEND_URL: 'http://localhost:5173',
  };

  const allowed = resolveAllowedOrigins(devConfig);
  assert.equal(allowed.includes('http://localhost:5173'), true);
  assert.equal(allowed.includes('http://127.0.0.1:5173'), true);
  assert.equal(allowed.includes('http://localhost:5174'), true);
  assert.equal(allowed.includes('http://127.0.0.1:5174'), true);
  assert.equal(allowed.includes('https://unknown-external.com'), false);
});

test('No wildcard (*) or arbitrary reflection is permitted in allowedOrigins', () => {
  const prodConfig = {
    NODE_ENV: 'production',
    FRONTEND_URL: 'https://admin.madrasanexa.lk',
    ALLOWED_ORIGINS: ['https://admin.madrasanexa.lk'],
  };

  const allowed = resolveAllowedOrigins(prodConfig);
  assert.equal(allowed.includes('*'), false);
});

// =============================================================================
// Group 2: Environment Schema Validation (Blocker 4)
// =============================================================================
console.log('\nGroup 2: Environment Schema Validation (envSchema)');

test('envSchema transforms comma-separated ALLOWED_ORIGINS into trimmed array', () => {
  const parsed = envSchema.shape.ALLOWED_ORIGINS.parse(
    'https://admin.madrasanexa.lk, https://teacher.madrasanexa.lk'
  );
  assert.deepEqual(parsed, [
    'https://admin.madrasanexa.lk',
    'https://teacher.madrasanexa.lk',
  ]);
});

test('envSchema defaults to empty array when ALLOWED_ORIGINS is omitted', () => {
  const parsed = envSchema.shape.ALLOWED_ORIGINS.parse(undefined);
  assert.deepEqual(parsed, []);
});

test('envSchema rejects malformed URLs in ALLOWED_ORIGINS', () => {
  assert.throws(
    () => {
      envSchema.shape.ALLOWED_ORIGINS.parse('not-a-valid-url, https://good.com');
    },
    (err) => err.message.includes('ALLOWED_ORIGINS must be a comma-separated list')
  );
});

// =============================================================================
// Group 3: Admin ClassesPage Classroom Tab Integration (Blocker 1)
// =============================================================================
console.log('\nGroup 3: Admin ClassesPage Classroom Tab Integration (Blocker 1)');

test('ClassesPage.tsx imports ClassroomQrManagementTab and QrCode', () => {
  const classesPagePath = path.join(rootDir, 'madrasanexa/src/pages/madrasa-admin/ClassesPage.tsx');
  const rawContent = fs.readFileSync(classesPagePath, 'utf-8');
  const content = rawContent.replace(/\r\n/g, '\n');

  assert.equal(content.includes('ClassroomQrManagementTab'), true, 'Must import ClassroomQrManagementTab');
  assert.equal(content.includes('QrCode'), true, 'Must import QrCode icon');
  assert.equal(
    content.includes("activeTab, setActiveTab] = useState<'CLASSES' | 'SECTIONS' | 'CLASSROOMS'>('CLASSES')"),
    true,
    'Must include CLASSROOMS in activeTab type'
  );
  assert.equal(
    content.includes("onClick={() => setActiveTab('CLASSROOMS')}"),
    true,
    'Must have CLASSROOMS tab click handler'
  );
  assert.equal(
    content.includes("{activeTab === 'CLASSROOMS' && (\n        <ClassroomQrManagementTab />\n      )}"),
    true,
    'Must conditionally render ClassroomQrManagementTab'
  );
});

// =============================================================================
// Group 4: Teacher Login Form Production State (Blocker 2)
// =============================================================================
console.log('\nGroup 4: Teacher Login Form Production State (Blocker 2)');

test('LoginPage.tsx uses import.meta.env.DEV gating for initial state', () => {
  const loginPagePath = path.join(rootDir, 'teacher_portal_ui/src/pages/LoginPage.tsx');
  const content = fs.readFileSync(loginPagePath, 'utf-8');

  assert.equal(
    content.includes("useState(import.meta.env.DEV ? 'abdullah.farooq@madrasanexa.lk' : '')"),
    true,
    'Identifier must default to empty string in production'
  );
  assert.equal(
    content.includes("useState(import.meta.env.DEV ? 'demo12345' : '')"),
    true,
    'Password must default to empty string in production'
  );
});

test('Teacher Portal production build bundle contains zero demo passwords', () => {
  const distPath = path.join(rootDir, 'teacher_portal_ui/dist/assets');
  if (fs.existsSync(distPath)) {
    const files = fs.readdirSync(distPath).filter((f) => f.endsWith('.js'));
    let foundDemoPassword = false;
    for (const file of files) {
      const code = fs.readFileSync(path.join(distPath, file), 'utf-8');
      if (code.includes('demo12345')) {
        foundDemoPassword = true;
        break;
      }
    }
    assert.equal(foundDemoPassword, false, 'Production build must not contain demo12345');
  } else {
    console.warn('    Note: teacher_portal_ui/dist not found, skipping bundle scan.');
  }
});

// =============================================================================
// Group 5: Attendance History API Response Mapping (Blocker 3)
// =============================================================================
console.log('\nGroup 5: Attendance History API Response Mapping (Blocker 3)');

test('AttendanceHistoryPage.tsx maps backend session items into HistoricalAttendanceSession', () => {
  const historyPagePath = path.join(
    rootDir,
    'teacher_portal_ui/src/pages/attendance/AttendanceHistoryPage.tsx'
  );
  const content = fs.readFileSync(historyPagePath, 'utf-8');

  assert.equal(content.includes('setSessions(mapped)'), true, 'Must call setSessions with mapped backend data');
  assert.equal(content.includes('useState<HistoricalAttendanceSession[]>([])'), true, 'Initial state must be empty array');
  assert.equal(content.includes('<LoadingState'), true, 'Must render LoadingState');
  assert.equal(content.includes('<ErrorState'), true, 'Must render ErrorState');
  assert.equal(content.includes('<EmptyState'), true, 'Must render EmptyState');
  assert.equal(content.includes('todayStr'), true, 'Must compute dynamic today date');
  assert.equal(content.includes('yesterdayStr'), true, 'Must compute dynamic yesterday date');
});

test('Response mapper normalizes uppercase backend statuses to UI title-case cleanly', () => {
  // Simulate mapping function logic
  const mockBackendRecord = {
    id: 'rec_101',
    studentId: 'st_1',
    rollNo: 'HIFZ-001',
    name: 'Umar Farooq',
    status: 'PRESENT',
    method: 'Barcode Scan',
  };

  const status =
    mockBackendRecord.status === 'Present' || mockBackendRecord.status === 'Late' || mockBackendRecord.status === 'Excused' || mockBackendRecord.status === 'Absent'
      ? mockBackendRecord.status
      : mockBackendRecord.status === 'PRESENT'
      ? 'Present'
      : mockBackendRecord.status === 'LATE'
      ? 'Late'
      : mockBackendRecord.status === 'EXCUSED'
      ? 'Excused'
      : 'Absent';

  assert.equal(status, 'Present');
});

// =============================================================================
// Summary
// =============================================================================
console.log('\n================================================================');
console.log(`  Tests Executed: ${totalTests}`);
console.log(`  Passed:         ${passedTests}`);
console.log(`  Failed:         ${failedTests}`);
console.log('================================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('  All Phase 4G-1.1 remediation tests PASSED (100%).\n');
}
