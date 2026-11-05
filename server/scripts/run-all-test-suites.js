import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const testSuites = [
  { name: 'Tenant Isolation', cmd: 'node --import ./tests/setup-test-env.js tests/tenant-isolation.test.js' },
  { name: 'Subscription Gatekeeping', cmd: 'node --import ./tests/setup-test-env.js tests/subscription.test.js' },
  { name: 'Super Admin Core (Phase 6)', cmd: 'node --import ./tests/setup-test-env.js tests/super-admin.test.js' },
  { name: 'Super Admin Approval Workflow', cmd: 'node --import ./tests/setup-test-env.js tests/super-admin-approval.test.js' },
  { name: 'Super Admin Institutions', cmd: 'node --import ./tests/setup-test-env.js tests/super-admin-institutions.test.js' },
  { name: 'Super Admin Plans', cmd: 'node --import ./tests/setup-test-env.js tests/super-admin-plans.test.js' },
  { name: 'Plan Features & Access', cmd: 'node tests/run-features-test.js' },
  { name: 'Madrasa Admin Core (Phase 7)', cmd: 'node --import ./tests/setup-test-env.js tests/madrasa-admin.test.js' },
  { name: 'Student & Class Management (Phase 8)', cmd: 'node --import ./tests/setup-test-env.js tests/student-class.test.js' },
  { name: 'Invoice Management (Phase 9)', cmd: 'node --import ./tests/setup-test-env.js tests/invoice.test.js' },
  { name: 'Payment & Fee POS (Phase 10)', cmd: 'node --import ./tests/setup-test-env.js tests/payment.test.js' },
  { name: 'Academic Structure & Sections', cmd: 'node --import ./tests/setup-test-env.js tests/academic-structure.test.js' },
  { name: 'Financial & Operational Reports', cmd: 'node --import ./tests/setup-test-env.js tests/report.test.js' },
  { name: 'Branding & Logo Management', cmd: 'node --import ./tests/setup-test-env.js tests/branding.test.js' },
  { name: 'Authentication Regression', cmd: 'node --import ./tests/setup-test-env.js tests/auth-regression.test.js' },
  { name: 'Super Admin Dashboard Analytics', cmd: 'node --import ./tests/setup-test-env.js tests/super-admin-dashboard-analytics.test.js' },
  { name: 'About Us CMS', cmd: 'node --import ./tests/setup-test-env.js tests/about-us.test.js' },
  { name: 'About Us Multilingual Support', cmd: 'node --import ./tests/setup-test-env.js tests/about-us-multilingual.test.js' },
  { name: 'Platform Announcements', cmd: 'node --import ./tests/setup-test-env.js tests/announcement.test.js' },
  { name: 'Subscription Offline Payments', cmd: 'node --import ./tests/setup-test-env.js tests/subscription-payments.test.js' },
  { name: 'Madrasa Portal CMS', cmd: 'node --import ./tests/setup-test-env.js tests/homepage-cms.test.js' },
  { name: 'Marking Hub & Grade Book', cmd: 'node --import ./tests/setup-test-env.js tests/marking-hub.test.js' },
  { name: 'Student Attendance Tracking', cmd: 'node --import ./tests/setup-test-env.js tests/attendance.test.js' },
  { name: 'Ustadh & Staff Payroll/Schedules', cmd: 'node --import ./tests/setup-test-env.js tests/ustadh-management.test.js' },
  { name: 'Class & Staff Timetable Engine', cmd: 'node --import ./tests/setup-test-env.js tests/timetable.test.js' },
  { name: 'Expense Analysis & Budgeting', cmd: 'node --import ./tests/setup-test-env.js tests/expense-analysis.test.js' },
  { name: 'New Madrasa Clean Start Isolation', cmd: 'node --import ./tests/setup-test-env.js tests/new-madrasa-clean-start.test.js' },
  { name: 'Automatic Notifications & Dispatch', cmd: 'node --import ./tests/setup-test-env.js tests/automatic-notifications.test.js' },
  { name: 'Madrasa Email Sender Settings', cmd: 'node --import ./tests/setup-test-env.js tests/madrasa-email-sender-settings.test.js' },
  { name: 'Email Address Normalization', cmd: 'node --import ./tests/setup-test-env.js tests/email-normalization.test.js' },
  { name: 'Student Records & Qualifications', cmd: 'node --import ./tests/setup-test-env.js tests/student-records.test.js' },
  { name: 'Unit 1 Dashboards Verification', cmd: 'node --import ./tests/setup-test-env.js tests/unit1-dashboards.test.js' },
  { name: 'Unit 2 Due Date Reminders', cmd: 'node --import ./tests/setup-test-env.js tests/unit2-due-date-reminders.test.js' },
  { name: 'Madrasa Public Profile & Showcase', cmd: 'node --import ./tests/setup-test-env.js tests/madrasa-profile.test.js' },
  { name: 'Events Gallery Multi-Image Uploads', cmd: 'node --env-file=.env tests/events-gallery-multi-image.test.js' },
  { name: 'Online Admissions & Application Review', cmd: 'node --import ./tests/setup-test-env.js tests/admissions.test.js' },
  { name: 'Admission Email Notifications', cmd: 'node --import ./tests/setup-test-env.js tests/admission-email.test.js' },
  { name: 'Madrasa Theme Customization', cmd: 'node --import ./tests/setup-test-env.js tests/theme-customization.test.js' },
  { name: 'Alumni Network & Verification', cmd: 'node --import ./tests/setup-test-env.js tests/alumni-network.test.js' },
  { name: 'Curriculum Lifecycle QA', cmd: 'node --import ./tests/setup-test-env.js tests/curriculum-lifecycle-qa.test.js' },
  { name: 'Curriculum Validation', cmd: 'node --import ./tests/setup-test-env.js tests/curriculum-validation.test.js' },
  { name: 'Date/Time Settings & Localization', cmd: 'node --import ./tests/setup-test-env.js tests/datetime-settings.test.js' },
  { name: 'Navbar Theme Sync', cmd: 'node --import ./tests/setup-test-env.js tests/navbar-theme-sync.test.js' },
  { name: 'Staff Section & Stats Validation', cmd: 'node --import ./tests/setup-test-env.js tests/staff-section-and-stats.test.js' },
  { name: 'Subscription Worker Background Job', cmd: 'node --import ./tests/setup-test-env.js tests/subscription-worker.test.js' },
  { name: 'Theme Defaults Consistency', cmd: 'node --import ./tests/setup-test-env.js tests/theme-defaults.test.js' },
];

console.log(`Starting automated test execution of ${testSuites.length} test suites...\n`);

const results = [];
let totalPassedAll = 0;
let totalFailedAll = 0;

for (let i = 0; i < testSuites.length; i++) {
  const suite = testSuites[i];
  process.stdout.write(`[${i + 1}/${testSuites.length}] Running ${suite.name}... `);
  const startTime = Date.now();
  let status = 'PASS';
  let stdout = '';
  let stderr = '';
  let errorMsg = null;
  let passedCount = 0;
  let failedCount = 0;

  try {
    const output = execSync(suite.cmd, {
      cwd: path.resolve(import.meta.dirname, '..'),
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 120000,
    });
    stdout = output;
  } catch (err) {
    status = 'FAIL';
    stdout = err.stdout ? err.stdout.toString() : '';
    stderr = err.stderr ? err.stderr.toString() : '';
    errorMsg = err.message;
  }

  const durationMs = Date.now() - startTime;

  // Extract pass / fail counts from stdout
  const passMatches = stdout.match(/(?:✓\s*\[PASS\]|Passed:\s*(\d+)|\b(\d+)\s*Passed)/gi) || [];
  const failMatches = stdout.match(/(?:✗\s*\[FAIL\]|Failed:\s*(\d+)|\b(\d+)\s*Failed)/gi) || [];

  // Count explicit individual assertions
  const individualPasses = (stdout.match(/\[PASS\]/gi) || []).length;
  const individualFails = (stdout.match(/\[FAIL\]/gi) || []).length;

  // Check for summary lines: "X Passed, Y Failed"
  const summaryMatch = stdout.match(/(\d+)\s*Passed[,\s]+(\d+)\s*Failed/i);
  if (summaryMatch) {
    passedCount = parseInt(summaryMatch[1], 10);
    failedCount = parseInt(summaryMatch[2], 10);
  } else if (individualPasses > 0 || individualFails > 0) {
    passedCount = individualPasses;
    failedCount = individualFails;
  } else {
    // If exit code is 0 and no explicit counters, mark as 1 pass
    passedCount = status === 'PASS' ? 1 : 0;
    failedCount = status === 'FAIL' ? 1 : 0;
  }

  if (failedCount > 0 || status === 'FAIL') {
    status = 'FAIL';
    console.log(`FAILED (${passedCount} passed, ${failedCount} failed in ${(durationMs / 1000).toFixed(1)}s)`);
  } else {
    console.log(`PASSED (${passedCount} passed in ${(durationMs / 1000).toFixed(1)}s)`);
  }

  totalPassedAll += passedCount;
  totalFailedAll += failedCount;

  results.push({
    name: suite.name,
    cmd: suite.cmd,
    status,
    passedCount,
    failedCount,
    durationMs,
    errorMsg: status === 'FAIL' ? (errorMsg || stderr || stdout.slice(-500)) : null,
  });
}

console.log('\n====================================================');
console.log('ALL TEST SUITES EXECUTION COMPLETED');
console.log(`Total Suites: ${results.length}`);
console.log(`Passed Suites: ${results.filter(r => r.status === 'PASS').length}`);
console.log(`Failed Suites: ${results.filter(r => r.status === 'FAIL').length}`);
console.log(`Total Individual Tests Passed: ${totalPassedAll}`);
console.log(`Total Individual Tests Failed: ${totalFailedAll}`);
console.log('====================================================\n');

fs.writeFileSync(
  path.resolve(import.meta.dirname, 'test-execution-report.json'),
  JSON.stringify({ totalSuites: results.length, totalPassedAll, totalFailedAll, results }, null, 2)
);
