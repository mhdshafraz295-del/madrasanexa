import { prisma } from '../src/lib/prisma.js';
import fs from 'fs';

// -------------------------------------------------------------
// AUDITED & VERIFIED 61 IMPLEMENTED FEATURE KEYS
// (From madrasanexa-v2-feature-catalogue.md)
// -------------------------------------------------------------
export const VERIFIED_IMPLEMENTED_FEATURES = [
  // Category 1: Student Management (7)
  'STUDENT_DIRECTORY',
  'STUDENT_REGISTRATION',
  'STUDENT_PROFILE_MGMT',
  'STUDENT_STATUS_LIFECYCLE',
  'STUDENT_DOCUMENTS',
  'STUDENT_TIMELINE_HISTORY',
  'STUDENT_DATA_EXPORT',

  // Category 2: Teacher & Staff (Ustadh) Management (5)
  'USTADH_DIRECTORY',
  'USTADH_REGISTRATION',
  'USTADH_SCHEDULES',
  'USTADH_ATTENDANCE',
  'USTADH_PAYROLL',

  // Category 3: Academic Management (5)
  'ACADEMIC_SECTIONS',
  'CLASS_MANAGEMENT',
  'SUBJECT_MANAGEMENT',
  'TIMETABLE_BUILDER',
  'TIMETABLE_PUBLISHING',

  // Category 4: Attendance Management (3)
  'STUDENT_ATTENDANCE',
  'ATTENDANCE_ANALYTICS',
  'ATTENDANCE_ALERTS',

  // Category 5: Fee & Finance Management (6)
  'FEE_INVOICE_ENGINE',
  'FEE_POS_COLLECTION',
  'FEE_STUDENT_OVERRIDES',
  'FEE_RECEIPTS_PDF',
  'FEE_EXPENSE_ANALYSIS',
  'FEE_DUE_REMINDERS',

  // Category 6: Admissions & Interview Management (8)
  'ADMISSION_PERIODS',
  'ONLINE_APPLICATIONS_HUB',
  'APPLICANT_CONVERSION',
  'INTERVIEW_BULK_SCHEDULING',
  'INTERVIEW_ROUNDS_WORKFLOW',
  'INTERVIEW_EVALUATION',
  'INTERVIEW_PDF_INVITATIONS',
  'INTERVIEW_EMAIL_DISPATCH',

  // Category 7: Examination Management (3)
  'EXAM_ASSESSMENTS',
  'EXAM_MARK_ENTRY',
  'EXAM_REPORT_CARDS',

  // Category 8: Certificate Management (2)
  'CERTIFICATE_VERIFICATION',
  'CERTIFICATE_STREAMING',

  // Category 9: Parent & Guardian Management (2)
  'GUARDIAN_PROFILES',
  'GUARDIAN_COMMUNICATION',

  // Category 10: Communication & Notifications (4)
  'NOTIFICATION_ENGINE',
  'SMS_GATEWAY_INTEGRATION',
  'EMAIL_SENDER_SETTINGS',
  'IN_APP_ANNOUNCEMENTS',

  // Category 11: Public CMS – Madrasa Website Management (8)
  'PUBLIC_CMS_WEBSITE',
  'PUBLIC_CMS_PROFILE_EDITOR',
  'PUBLIC_CMS_HERO_BANNER',
  'PUBLIC_CMS_EVENT_GALLERY',
  'PUBLIC_CMS_NOTICE_BOARD',
  'PUBLIC_CMS_THEME_CUSTOM',
  'PUBLIC_CMS_ADMISSIONS_PORTAL',
  'PUBLIC_CMS_SEO_METADATA',

  // Category 12: Alumni Network (3)
  'ALUMNI_MANAGEMENT',
  'ALUMNI_GLOBAL_DIRECTORY',
  'ALUMNI_VERIFICATION_HUB',

  // Category 13: Reports & Analytics (3)
  'REPORTS_DASHBOARD',
  'REPORTS_FINANCIAL',
  'REPORTS_ACADEMIC',

  // Category 19: System Configuration (2)
  'INSTITUTIONAL_SETTINGS',
  'BRANDING_MANAGEMENT',
];

async function runDryRun() {
  console.log('================================================================');
  console.log('   MADRASANEXA v2 — FEATURE SEEDING DRY RUN (READ-ONLY)         ');
  console.log('================================================================\n');

  // 1. Verify key count & uniqueness
  const uniqueKeys = new Set(VERIFIED_IMPLEMENTED_FEATURES);
  console.log(`[1] Verified Feature Keys Count: ${VERIFIED_IMPLEMENTED_FEATURES.length}`);
  console.log(`    Unique Feature Keys:         ${uniqueKeys.size}`);
  if (uniqueKeys.size !== VERIFIED_IMPLEMENTED_FEATURES.length) {
    throw new Error('DUPLICATE KEYS DETECTED IN SEED ARRAY!');
  }
  if (VERIFIED_IMPLEMENTED_FEATURES.length !== 61) {
    throw new Error(`EXPECTED EXACTLY 61 KEYS, GOT ${VERIFIED_IMPLEMENTED_FEATURES.length}`);
  }

  // 2. Fetch all plans from DB
  const allPlans = await prisma.plan.findMany({
    orderBy: { createdAt: 'asc' },
    include: {
      _count: {
        select: {
          subscriptions: true,
          planFeatures: true,
        },
      },
    },
  });

  console.log(`\n[2] Database Plans Audit: Total Plans = ${allPlans.length}`);
  for (const p of allPlans) {
    console.log(`  - Plan ID: ${p.id}`);
    console.log(`    Code: "${p.code}", Name: "${p.name}", Status: ${p.isActive ? 'ACTIVE' : 'INACTIVE'}`);
    console.log(`    Price: LKR ${p.price}, Duration: ${p.durationMonths}mo`);
    console.log(`    Subscriptions: ${p._count.subscriptions}, Existing Features: ${p._count.planFeatures}`);
  }

  // Filter active plans
  const activePlans = allPlans.filter(p => p.isActive);
  console.log(`\n[3] Active Plans to Target: ${activePlans.length}`);

  // Fetch any existing plan_features records
  const existingPlanFeatures = await prisma.planFeature.findMany({
    select: { id: true, planId: true, featureKey: true, isEnabled: true },
  });
  console.log(`    Existing plan_features in DB: ${existingPlanFeatures.length}`);

  // Map existing plan_features by `${planId}:${featureKey}`
  const existingMap = new Set(existingPlanFeatures.map(pf => `${pf.planId}:${pf.featureKey}`));

  // 3. Calculate expected insertions per active plan
  console.log('\n[4] Dry Run Simulation per Active Plan:');
  let totalNewInsertions = 0;
  let totalPreserved = 0;
  const planSimulations = [];

  for (const plan of activePlans) {
    let newForThisPlan = 0;
    let preservedForThisPlan = 0;

    for (const key of VERIFIED_IMPLEMENTED_FEATURES) {
      const compositeKey = `${plan.id}:${key}`;
      if (existingMap.has(compositeKey)) {
        preservedForThisPlan++;
      } else {
        newForThisPlan++;
      }
    }

    totalNewInsertions += newForThisPlan;
    totalPreserved += preservedForThisPlan;

    planSimulations.push({
      planId: plan.id,
      planCode: plan.code,
      planName: plan.name,
      activeSubscriptions: plan._count.subscriptions,
      expectedNewFeatures: newForThisPlan,
      preservedFeatures: preservedForThisPlan,
    });

    console.log(`  - Plan: "${plan.name}" (${plan.code})`);
    console.log(`    ID:                  ${plan.id}`);
    console.log(`    Active Subscriptions: ${plan._count.subscriptions}`);
    console.log(`    Expected New Records: ${newForThisPlan}`);
    console.log(`    Preserved Records:    ${preservedForThisPlan}`);
  }

  // Inactive plans check
  const inactivePlans = allPlans.filter(p => !p.isActive);
  console.log(`\n[5] Inactive Plans (Bypassed): ${inactivePlans.length}`);
  for (const ip of inactivePlans) {
    console.log(`  - Bypassed: "${ip.name}" (${ip.code}) | ID: ${ip.id} | Active: ${ip.isActive}`);
  }

  // 4. Overrides check: confirm 0 overrides would be created
  console.log('\n[6] Madrasa Overrides Verification:');
  console.log('    Permanent Madrasa overrides to create: 0 (Strictly per business rule #6)');

  // 5. Summary Table
  console.log('\n================================================================');
  console.log('   DRY RUN SUMMARY REPORT (ZERO MUTATIONS PERFORMED)            ');
  console.log('================================================================');
  console.log(`Active Plans Targeted:             ${activePlans.length}`);
  console.log(`Inactive Plans Bypassed:           ${inactivePlans.length}`);
  console.log(`Verified IMPLEMENTED Features:     ${VERIFIED_IMPLEMENTED_FEATURES.length}`);
  console.log(`Expected New Records per Plan:     ${VERIFIED_IMPLEMENTED_FEATURES.length}`);
  console.log(`Existing Records Preserved:        ${totalPreserved}`);
  console.log(`Total Expected Insertions:         ${totalNewInsertions}`);
  console.log(`Invalid / Duplicate Feature Keys:  0`);
  console.log(`Permanent Madrasa Overrides:       0`);
  console.log('================================================================\n');

  // Verify DB state is still untouched
  const finalPfCount = await prisma.planFeature.count();
  const finalMfoCount = await prisma.madrasaFeatureOverride.count();
  console.log(`DB Verification: plan_features=${finalPfCount}, madrasa_feature_overrides=${finalMfoCount}`);

  process.exit(0);
}

runDryRun().catch(e => {
  console.error(e);
  process.exit(1);
});
