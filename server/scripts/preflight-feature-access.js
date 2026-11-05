import { prisma } from '../src/lib/prisma.js';
import { evaluateEffectiveSubscription } from '../src/services/subscription.service.js';

async function runPreflight() {
  console.log('====================================================');
  console.log('   MADRASANEXA v2 — PHASE 1 PRE-FLIGHT DIAGNOSTICS   ');
  console.log('====================================================\n');

  let hasAnomalies = false;

  // 1. Check all Madrasas
  const madrasas = await prisma.madrasa.findMany({
    include: {
      subscriptions: {
        include: {
          plan: true,
        },
        orderBy: { startsAt: 'desc' },
      },
      users: {
        select: { id: true, email: true, role: true, isActive: true },
      },
    },
  });

  console.log(`[1] Madrasa Records Audit: Total = ${madrasas.length}`);
  for (const m of madrasas) {
    console.log(`  - Madrasa: "${m.name}" (ID: ${m.id}, Code: ${m.code}, Status: ${m.status}, Slug: ${m.slug || 'N/A'})`);
    console.log(`    Admins/Users: ${m.users.length} (${m.users.map(u => `${u.email} [${u.role}]`).join(', ')})`);
    console.log(`    Total Subscriptions: ${m.subscriptions.length}`);

    if (m.status === 'ACTIVE') {
      const activeSubs = m.subscriptions.filter(s => s.status === 'ACTIVE');
      console.log(`    Active Subscriptions: ${activeSubs.length}`);

      if (m.subscriptions.length === 0) {
        console.warn(`    ⚠️  WARNING: Active Madrasa ${m.id} has NO subscription records!`);
        hasAnomalies = true;
      } else {
        const subEval = evaluateEffectiveSubscription(m.subscriptions, new Date());
        console.log(`    Effective Access: allowed=${subEval.allowed}, status=${subEval.status}, code=${subEval.code}, daysRemaining=${subEval.daysRemaining}`);
        if (subEval.subscription) {
          console.log(`    Current Linked Plan: "${subEval.subscription.plan?.name}" (ID: ${subEval.subscription.planId}, Code: ${subEval.subscription.plan?.code})`);
        }
      }
    }
  }
  console.log('');

  // 2. Check all Plans in database
  const plans = await prisma.plan.findMany({
    include: {
      _count: {
        select: { subscriptions: true },
      },
    },
  });

  console.log(`[2] Plan Records Audit: Total = ${plans.length}`);
  const activePlans = plans.filter(p => p.isActive);
  const inactivePlans = plans.filter(p => !p.isActive);
  console.log(`  - Active Plans (${activePlans.length}):`);
  for (const p of activePlans) {
    console.log(`    * [ID: ${p.id}] "${p.name}" (Code: ${p.code}, Duration: ${p.durationMonths}mo, Price: LKR ${p.price}, Linked Subscriptions: ${p._count.subscriptions})`);
  }
  console.log(`  - Inactive Plans (${inactivePlans.length}):`);
  for (const p of inactivePlans) {
    console.log(`    * [ID: ${p.id}] "${p.name}" (Code: ${p.code}, Linked Subscriptions: ${p._count.subscriptions})`);
  }
  console.log('');

  // 3. Check Subscriptions integrity (orphaned plans or madrasas)
  const allSubs = await prisma.subscription.findMany();
  console.log(`[3] Subscription Integrity Audit: Total = ${allSubs.length}`);
  const planIds = new Set(plans.map(p => p.id));
  const madrasaIds = new Set(madrasas.map(m => m.id));

  let orphanPlanSubs = 0;
  let orphanMadrasaSubs = 0;
  for (const s of allSubs) {
    if (!planIds.has(s.planId)) {
      console.error(`  ❌ ERROR: Subscription ${s.id} references non-existent planId: ${s.planId}`);
      orphanPlanSubs++;
      hasAnomalies = true;
    }
    if (!madrasaIds.has(s.madrasaId)) {
      console.error(`  ❌ ERROR: Subscription ${s.id} references non-existent madrasaId: ${s.madrasaId}`);
      orphanMadrasaSubs++;
      hasAnomalies = true;
    }
  }

  if (orphanPlanSubs === 0 && orphanMadrasaSubs === 0) {
    console.log('  ✅ Foreign key integrity: 100% valid. Zero orphan subscriptions.');
  }
  console.log('');

  // 4. Check Payment Records & Submissions
  const payments = await prisma.subscriptionPayment.count();
  const submissions = await prisma.subscriptionPaymentSubmission.count();
  console.log(`[4] Billing Records Audit:`);
  console.log(`  - Subscription Payments: ${payments}`);
  console.log(`  - Subscription Payment Submissions: ${submissions}`);
  console.log('');

  // 5. Final Diagnostic Conclusion
  console.log('====================================================');
  if (hasAnomalies) {
    console.warn('⚠️  PRE-FLIGHT DIAGNOSTIC DETECTED ANOMALIES. REVIEW ABOVE LOGS.');
  } else {
    console.log('✅ PRE-FLIGHT DIAGNOSTIC PASSED: ALL DATA & RELATIONS READY FOR PHASE 2.');
  }
  console.log('====================================================\n');
}

runPreflight()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal preflight error:', err);
    process.exit(1);
  });
