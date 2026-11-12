import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { hashPassword, validatePasswordStrength } from '../utils/password.js';
import { normalizeEmail } from '../utils/email-normalization.js';
import { addCalendarMonthsUtc, isExpiringSoonPrecise, getSubscriptionDaysRemaining } from '../utils/subscription-date.js';
import { createSubscriptionRenewal, evaluateEffectiveSubscription } from './subscription.service.js';
import { sendApprovalEmail, getSetupPasswordUrl } from './email.service.js';
import { getMadrasaBranding, generateInitials } from './branding.service.js';
import { resolveObjectAccessUrl } from './r2.service.js';
import { NotFoundError, BadRequestError, ConflictError } from '../utils/errors.js';
import {
  FEATURE_CATALOGUE,
  FEATURE_CATEGORIES,
  FEATURE_STATUS,
  getFeaturesByCategory,
} from '../constants/feature-catalogue.js';

/**
 * Super Admin Platform Service.
 *
 * Enforces:
 * - Centralized Phase 3 password security (cost 12, min 10 chars).
 * - Atomic concurrency-safe onboarding request approval.
 * - One-time temporary password delivery without plaintext persistence.
 * - Date-aware platform dashboard metrics.
 * - Strict tenant-targeted admin management.
 * - Zero business data deletion across all lifecycle actions.
 */

// ==========================================
// 1. DASHBOARD ANALYTICS
// ==========================================

/**
 * Generates deterministic half-open UTC month sequence for 6m or 12m periods.
 * Always includes the current calendar month plus the preceding (N-1) months.
 *
 * @param {'6m'|'12m'} period - Filter period
 * @param {Date} [nowUtc=new Date()] - Reference timestamp
 * @returns {Array<object>} Complete month sequence with [startUtc, endUtc) bounds
 */
function getPlatformMonthSequence(period = '6m', nowUtc = new Date()) {
  const currentYear = nowUtc.getUTCFullYear();
  const currentMonth = nowUtc.getUTCMonth() + 1; // 1-12

  const monthCount = period === '12m' ? 12 : 6;
  const sequence = [];

  for (let i = monthCount - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(currentYear, currentMonth - 1 - i, 1));
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1;
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    const label = d.toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
    const startUtc = new Date(Date.UTC(year, month - 1, 1));
    const endUtc = new Date(Date.UTC(year, month, 1));

    sequence.push({ year, month, monthKey, label, startUtc, endUtc });
  }

  return sequence;
}

export async function getPlatformDashboardMetrics({ period = '6m' } = {}) {
  const now = new Date();

  // 1. Month sequence generation with [startInclusive, endExclusive)
  const monthSequence = getPlatformMonthSequence(period, now);
  const earliestStart = monthSequence[0].startUtc;
  const latestEnd = monthSequence[monthSequence.length - 1].endUtc;

  // 2. Parallel queries for counts, financial totals, and chart ranges
  const [
    totalMadrasas,
    activeMadrasas,
    suspendedMadrasas,
    archivedMadrasas,
    totalOnboardings,
    pendingOnboardings,
    approvedOnboardings,
    rejectedOnboardings,
    totalRevenueAgg,
    monthRevenueAgg,
    totalPlans,
    totalStudents,
    totalSubscriptionRows,
    totalPaymentSubmissions,
    pendingPaymentSubmissions,
    approvedPaymentSubmissions,
    rejectedPaymentSubmissions,
    recentPendingOnboardings,
    rawRecentMadrasas,
    recentPayments,
    madrasasInRange,
    paymentsInRange,
    currentCandidateSubscriptions,
  ] = await Promise.all([
    prisma.madrasa.count(),
    prisma.madrasa.count({ where: { status: 'ACTIVE' } }),
    prisma.madrasa.count({ where: { status: 'SUSPENDED' } }),
    prisma.madrasa.count({ where: { status: 'ARCHIVED' } }),
    prisma.madrasaOnboardingRequest.count(),
    prisma.madrasaOnboardingRequest.count({ where: { status: 'PENDING' } }),
    prisma.madrasaOnboardingRequest.count({ where: { status: 'APPROVED' } }),
    prisma.madrasaOnboardingRequest.count({ where: { status: 'REJECTED' } }),
    prisma.subscriptionPayment.aggregate({ _sum: { amount: true } }),
    prisma.subscriptionPayment.aggregate({
      where: { paidAt: { gte: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)) } },
      _sum: { amount: true },
    }),
    prisma.plan.count(),
    prisma.student.count(),
    prisma.subscription.count(),
    prisma.subscriptionPaymentSubmission.count(),
    prisma.subscriptionPaymentSubmission.count({ where: { status: 'PENDING' } }),
    prisma.subscriptionPaymentSubmission.count({ where: { status: 'APPROVED' } }),
    prisma.subscriptionPaymentSubmission.count({ where: { status: 'REJECTED' } }),
    prisma.madrasaOnboardingRequest.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.madrasa.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        name: true,
        code: true,
        status: true,
        createdAt: true,
        subscriptions: {
          orderBy: { endsAt: 'desc' },
          take: 1,
          select: {
            id: true,
            status: true,
            endsAt: true,
          },
        },
      },
    }),
    prisma.subscriptionPayment.findMany({
      include: {
        madrasa: { select: { id: true, name: true, code: true } },
        subscription: { include: { plan: { select: { name: true } } } },
      },
      orderBy: { paidAt: 'desc' },
      take: 5,
    }),
    // Chart 1: Institution Growth in half-open window [earliestStart, latestEnd)
    prisma.madrasa.findMany({
      where: {
        createdAt: {
          gte: earliestStart,
          lt: latestEnd,
        },
      },
      select: {
        id: true,
        createdAt: true,
      },
    }),
    // Chart 2: Platform subscription payments in half-open window [earliestStart, latestEnd)
    prisma.subscriptionPayment.findMany({
      where: {
        paidAt: {
          gte: earliestStart,
          lt: latestEnd,
        },
      },
      select: {
        amount: true,
        paidAt: true,
      },
    }),
    // Charts 3 & 4: Current candidate subscriptions
    prisma.subscription.findMany({
      where: {
        startsAt: { lte: now },
        endsAt: { gt: now },
      },
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            code: true,
            durationMonths: true,
          },
        },
      },
      orderBy: [
        { endsAt: 'desc' },
        { startsAt: 'desc' },
      ],
    }),
  ]);

  // --- CHART 1: Institution Growth ---
  const madrasasByMonth = new Map();
  for (const m of madrasasInRange) {
    const y = m.createdAt.getUTCFullYear();
    const mon = m.createdAt.getUTCMonth() + 1;
    const key = `${y}-${String(mon).padStart(2, '0')}`;
    madrasasByMonth.set(key, (madrasasByMonth.get(key) || 0) + 1);
  }

  const institutionGrowth = monthSequence.map((m) => ({
    month: m.monthKey,
    label: m.label,
    institutions: madrasasByMonth.get(m.monthKey) || 0,
  }));

  // --- CHART 2: Subscription Revenue Trend (Decimal-Safe) ---
  const revenueByMonth = new Map();
  for (const p of paymentsInRange) {
    const y = p.paidAt.getUTCFullYear();
    const mon = p.paidAt.getUTCMonth() + 1;
    const key = `${y}-${String(mon).padStart(2, '0')}`;
    const prev = revenueByMonth.get(key) || new Prisma.Decimal(0);
    revenueByMonth.set(key, prev.add(p.amount));
  }

  const subscriptionRevenue = monthSequence.map((m) => {
    const dec = revenueByMonth.get(m.monthKey) || new Prisma.Decimal(0);
    return {
      month: m.monthKey,
      label: m.label,
      revenue: Number(dec.toFixed(2)),
    };
  });

  // --- CHARTS 3 & 4: Subscription Status & Plan Distribution (Canonical Phase 5 Resolver) ---
  // Group current candidate subscriptions by madrasaId
  const subsByMadrasa = new Map();
  for (const sub of currentCandidateSubscriptions) {
    if (!subsByMadrasa.has(sub.madrasaId)) {
      subsByMadrasa.set(sub.madrasaId, []);
    }
    subsByMadrasa.get(sub.madrasaId).push(sub);
  }

  // Bounded query for Madrasas without ongoing subscriptions (at most 1 latest subscription per Madrasa)
  const madrasasWithoutCurrent = await prisma.madrasa.findMany({
    where: {
      id: { notIn: Array.from(subsByMadrasa.keys()) },
    },
    select: {
      id: true,
      subscriptions: {
        take: 1,
        orderBy: [
          { endsAt: 'desc' },
          { startsAt: 'desc' },
        ],
        include: {
          plan: {
            select: {
              id: true,
              name: true,
              code: true,
              durationMonths: true,
            },
          },
        },
      },
    },
  });

  for (const m of madrasasWithoutCurrent) {
    subsByMadrasa.set(m.id, m.subscriptions || []);
  }

  // Evaluate each Madrasa using canonical Phase 5 lifecycle authority
  const statusCounts = {
    ACTIVE: 0,
    EXPIRING_SOON: 0,
    EXPIRED: 0,
    SUSPENDED: 0,
    CANCELLED: 0,
  };

  const planInstitutionCounts = new Map(); // planId -> number
  const planDetailsMap = new Map();        // planId -> { id, name }

  for (const [_, subs] of subsByMadrasa.entries()) {
    const evaluation = evaluateEffectiveSubscription(subs, now);

    // Increment valid SubscriptionStatus enum count
    if (statusCounts[evaluation.status] !== undefined) {
      statusCounts[evaluation.status]++;
    }

    // For Plan Distribution: count institutions with an effective current subscription
    if (evaluation.allowed && evaluation.subscription?.plan) {
      const plan = evaluation.subscription.plan;
      planDetailsMap.set(plan.id, { id: plan.id, name: plan.name });
      planInstitutionCounts.set(plan.id, (planInstitutionCounts.get(plan.id) || 0) + 1);
    }
  }

  const subscriptionStatus = [
    { status: 'ACTIVE', label: 'Active', count: statusCounts.ACTIVE },
    { status: 'EXPIRING_SOON', label: 'Expiring Soon', count: statusCounts.EXPIRING_SOON },
    { status: 'EXPIRED', label: 'Expired', count: statusCounts.EXPIRED },
    { status: 'SUSPENDED', label: 'Suspended', count: statusCounts.SUSPENDED },
    { status: 'CANCELLED', label: 'Cancelled', count: statusCounts.CANCELLED },
  ];

  const planDistribution = Array.from(planInstitutionCounts.entries())
    .map(([planId, institutionCount]) => ({
      planId,
      planName: planDetailsMap.get(planId)?.name || 'Unknown Plan',
      institutionCount,
    }))
    .sort((a, b) => b.institutionCount - a.institutionCount);

  // Format recent madrasas
  const recentMadrasas = rawRecentMadrasas.map((m) => {
    const latestSub = m.subscriptions?.[0];
    let daysRemaining = 0;
    if (latestSub) {
      daysRemaining = Math.max(0, Math.ceil((latestSub.endsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    }
    return {
      id: m.id,
      name: m.name,
      code: m.code,
      status: m.status,
      createdAt: m.createdAt,
      subscriptionSummary: latestSub
        ? {
            code: m.code,
            status: latestSub.status,
            daysRemaining,
          }
        : undefined,
    };
  });

  return {
    counts: {
      totalMadrasas,
      activeMadrasas,
      suspendedMadrasas,
      archivedMadrasas,
      pendingOnboardings,
      pendingBankSubmissions: pendingPaymentSubmissions,
      activeSubscriptions: statusCounts.ACTIVE,
      expiringSoonSubscriptions: statusCounts.EXPIRING_SOON,
      totalPlans,
    },
    financials: {
      totalCollected: Number(totalRevenueAgg._sum.amount || 0),
      currentMonth: Number(monthRevenueAgg._sum.amount || 0),
    },
    pendingOnboardingsList: recentPendingOnboardings,
    recentMadrasas,
    madrasas: {
      total: totalMadrasas,
      active: activeMadrasas,
      suspended: suspendedMadrasas,
      archived: archivedMadrasas,
    },
    onboardings: {
      total: totalOnboardings,
      pending: pendingOnboardings,
      approved: approvedOnboardings,
      rejected: rejectedOnboardings,
    },
    bankSubmissions: {
      total: totalPaymentSubmissions,
      pending: pendingPaymentSubmissions,
      approved: approvedPaymentSubmissions,
      rejected: rejectedPaymentSubmissions,
    },
    subscriptions: {
      total: totalSubscriptionRows,
      active: statusCounts.ACTIVE,
      expiringSoon: statusCounts.EXPIRING_SOON,
      expired: statusCounts.EXPIRED,
      suspended: statusCounts.SUSPENDED,
      cancelled: statusCounts.CANCELLED,
    },
    revenue: {
      total: Number(totalRevenueAgg._sum.amount || 0),
      currentMonth: Number(monthRevenueAgg._sum.amount || 0),
    },
    totalStudents,
    recentPendingOnboardings,
    recentPayments,
    charts: {
      institutionGrowth,
      subscriptionRevenue,
      subscriptionStatus,
      planDistribution,
    },
  };
}

// ==========================================
// 2. ONBOARDING REQUESTS MANAGEMENT
// ==========================================

export async function listOnboardingRequests({ status, search, page = 1, pageSize = 20 }) {
  const pageNum = Math.max(1, parseInt(page) || 1);
  const size = Math.min(100, Math.max(1, parseInt(pageSize) || 20));
  const skip = (pageNum - 1) * size;

  const where = {};
  if (status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
    where.status = status;
  }

  if (search && typeof search === 'string' && search.trim()) {
    const term = search.trim();
    where.OR = [
      { madrasaName: { contains: term } },
      { contactName: { contains: term } },
      { email: { contains: term } },
      { phone: { contains: term } },
      { district: { contains: term } },
    ];
  }

  const [requests, total, pendingCount, approvedCount, rejectedCount, activeMadrasasCount] = await Promise.all([
    prisma.madrasaOnboardingRequest.findMany({
      where,
      include: {
        reviewedByUser: { select: { id: true, name: true, email: true } },
        approvedMadrasa: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: size,
    }),
    prisma.madrasaOnboardingRequest.count({ where }),
    prisma.madrasaOnboardingRequest.count({ where: { status: 'PENDING' } }),
    prisma.madrasaOnboardingRequest.count({ where: { status: 'APPROVED' } }),
    prisma.madrasaOnboardingRequest.count({ where: { status: 'REJECTED' } }),
    prisma.madrasa.count({ where: { status: 'ACTIVE' } }),
  ]);

  // Fetch email delivery status for returned requests from ActivityLog
  const requestIds = requests.map((r) => r.id);
  const emailLogs = requestIds.length > 0 ? await prisma.activityLog.findMany({
    where: {
      entityType: 'MadrasaOnboardingRequest',
      entityId: { in: requestIds },
      action: { in: ['APPROVAL_EMAIL_SENT', 'APPROVAL_EMAIL_FAILED', 'APPROVAL_EMAIL_RESENT'] },
    },
    orderBy: { createdAt: 'desc' },
  }) : [];

  const latestLogByRequestId = new Map();
  for (const log of emailLogs) {
    if (!latestLogByRequestId.has(log.entityId)) {
      latestLogByRequestId.set(log.entityId, log);
    }
  }

  // Fetch plan names for approved requests
  const approvedMadrasaIds = requests.map((r) => r.approvedMadrasaId).filter(Boolean);
  const subscriptions = approvedMadrasaIds.length > 0 ? await prisma.subscription.findMany({
    where: { madrasaId: { in: approvedMadrasaIds } },
    include: { plan: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  }) : [];
  const subByMadrasaId = new Map(subscriptions.map((s) => [s.madrasaId, s]));

  const enrichedRequests = requests.map((req) => {
    let emailStatus = 'NOT_SENT';
    let emailSentAt = null;
    let emailError = null;

    if (req.status === 'APPROVED') {
      const latestLog = latestLogByRequestId.get(req.id);
      if (latestLog) {
        if (latestLog.action === 'APPROVAL_EMAIL_SENT' || latestLog.action === 'APPROVAL_EMAIL_RESENT') {
          emailStatus = 'SENT';
          emailSentAt = latestLog.createdAt;
        } else if (latestLog.action === 'APPROVAL_EMAIL_FAILED') {
          const errMsg = latestLog.metadata?.errorMessage || latestLog.metadata?.error || '';
          const isNotConfig =
            latestLog.metadata?.emailStatus === 'NOT_CONFIGURED' ||
            latestLog.metadata?.errorCode === 'NOT_CONFIGURED' ||
            errMsg.includes('not configured');
          if (isNotConfig) {
            emailStatus = 'NOT_CONFIGURED';
          } else {
            emailStatus = 'FAILED';
          }
          emailError = errMsg;
        }
      }
    }

    const sub = req.approvedMadrasaId ? subByMadrasaId.get(req.approvedMadrasaId) : null;

    return {
      ...req,
      emailStatus,
      emailSentAt,
      emailError,
      planName: sub?.plan?.name || null,
    };
  });

  return {
    requests: enrichedRequests,
    pagination: {
      total,
      page: pageNum,
      pageSize: size,
      totalPages: Math.ceil(total / size) || 1,
    },
    kpi: {
      pending: pendingCount,
      approved: approvedCount,
      rejected: rejectedCount,
      activeMadrasas: activeMadrasasCount,
    },
  };
}

export async function getOnboardingRequestById(id) {
  const request = await prisma.madrasaOnboardingRequest.findUnique({
    where: { id },
    include: {
      reviewedByUser: { select: { id: true, name: true, email: true } },
      approvedMadrasa: { select: { id: true, name: true, code: true } },
    },
  });

  if (!request) {
    throw new NotFoundError('Onboarding request not found.');
  }

  // Fetch ActivityLogs for this request to build dynamic timeline and email state
  const logs = await prisma.activityLog.findMany({
    where: {
      entityType: 'MadrasaOnboardingRequest',
      entityId: id,
    },
    include: {
      user: { select: { name: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Build timeline
  const timeline = [
    {
      action: 'SUBMITTED',
      title: 'Registration Submitted',
      date: request.createdAt,
      actor: request.contactName,
    },
  ];

  if (request.status === 'APPROVED' && request.reviewedAt) {
    timeline.push({
      action: 'APPROVED',
      title: 'Approved by Super Admin',
      date: request.reviewedAt,
      actor: request.reviewedByUser?.name || 'Super Admin',
    });
  } else if (request.status === 'REJECTED' && request.reviewedAt) {
    timeline.push({
      action: 'REJECTED',
      title: 'Rejected by Super Admin',
      date: request.reviewedAt,
      actor: request.reviewedByUser?.name || 'Super Admin',
      notes: request.rejectionReason,
    });
  }

  let emailStatus = 'NOT_SENT';
  let emailSentAt = null;
  let emailError = null;

  for (const log of logs) {
    if (log.action === 'APPROVAL_EMAIL_SENT') {
      timeline.push({
        action: 'EMAIL_SENT',
        title: 'Approval Email Sent',
        date: log.createdAt,
        actor: 'System',
        notes: log.metadata?.recipient ? `Sent to ${log.metadata.recipient}` : undefined,
      });
      emailStatus = 'SENT';
      emailSentAt = log.createdAt;
      emailError = null;
    } else if (log.action === 'APPROVAL_EMAIL_RESENT') {
      timeline.push({
        action: 'EMAIL_RESENT',
        title: 'Approval Email Resent',
        date: log.createdAt,
        actor: log.user?.name || 'Super Admin',
        notes: log.metadata?.recipient ? `Sent to ${log.metadata.recipient}` : undefined,
      });
      emailStatus = 'SENT';
      emailSentAt = log.createdAt;
      emailError = null;
    } else if (log.action === 'APPROVAL_EMAIL_FAILED') {
      const isResend = log.metadata?.attemptType === 'RESEND';
      const errMsg = log.metadata?.errorMessage || log.metadata?.error || 'Email delivery failed';
      const isNotConfig =
        log.metadata?.emailStatus === 'NOT_CONFIGURED' ||
        log.metadata?.errorCode === 'NOT_CONFIGURED' ||
        errMsg.includes('not configured');
      timeline.push({
        action: 'EMAIL_FAILED',
        title: isNotConfig
          ? 'Email Not Configured'
          : isResend
          ? 'Resend Approval Email Failed'
          : 'Approval Email Delivery Failed',
        date: log.createdAt,
        actor: isResend && log.user?.name ? log.user.name : 'System',
        notes: errMsg,
      });
      emailStatus = isNotConfig ? 'NOT_CONFIGURED' : 'FAILED';
      emailError = errMsg;
    }
  }

  // Fetch linked subscription & plan if approved
  let subscription = null;
  if (request.approvedMadrasaId) {
    subscription = await prisma.subscription.findFirst({
      where: { madrasaId: request.approvedMadrasaId },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  return {
    ...request,
    emailStatus,
    emailSentAt,
    emailError,
    timeline,
    subscription,
  };
}

/**
 * Concurrency-Safe Atomic Onboarding Approval (Correction 3)
 */
export async function approveOnboardingRequest({
  requestId,
  reviewedByUserId,
  madrasaCode,
  madrasaSlug,
  madrasaName,
  adminName,
  adminEmail,
  planId,
  startsAt = new Date(),
  paymentMethod = 'BANK_TRANSFER',
  paymentReference = null,
  paymentNotes = null,
  recordInitialPayment = false,
  temporaryPassword = null,
  ipAddress = null,
  userAgent = null,
}) {
  const now = new Date();
  const cleanCode = madrasaCode.trim().toUpperCase();
  const cleanSlug = madrasaSlug.trim().toLowerCase();

  // Pre-validate password and hash before entering the interactive transaction to avoid transaction timeouts
  const rawTemporaryPassword = temporaryPassword || (crypto.randomBytes(6).toString('hex') + '!Aa1');
  const passwordValidation = validatePasswordStrength(rawTemporaryPassword);
  if (!passwordValidation.valid) {
    throw new BadRequestError(passwordValidation.message || 'Temporary password does not meet security requirements.');
  }
  const passwordHash = await hashPassword(rawTemporaryPassword);

  const txResult = await prisma.$transaction(async (tx) => {
    // 1. Atomic claim check (Correction 3): conditionally claim PENDING status
    const claimResult = await tx.madrasaOnboardingRequest.updateMany({
      where: {
        id: requestId,
        status: 'PENDING',
      },
      data: {
        status: 'APPROVED',
        reviewedAt: now,
        reviewedByUserId,
      },
    });

    if (claimResult.count === 0) {
      throw new ConflictError('This onboarding request has already been reviewed, approved, rejected, or is being processed concurrently.');
    }

    // 2. Fetch the onboarding request details
    const request = await tx.madrasaOnboardingRequest.findUnique({
      where: { id: requestId },
    });

    const finalMadrasaName = (madrasaName || request.madrasaName).trim();
    const finalAdminName = (adminName || request.contactName).trim();
    const finalAdminEmail = normalizeEmail(adminEmail || request.email);

    // 3. Verify Plan is active (if planId provided)
    let plan = null;
    let subscription = null;
    let payment = null;

    if (planId) {
      plan = await tx.plan.findUnique({ where: { id: planId } });
      if (!plan || !plan.isActive) {
        throw new BadRequestError('The selected subscription plan does not exist or is inactive.');
      }
    }

    // 4. Verify unique constraints
    const [existingCode, existingSlug, existingEmail] = await Promise.all([
      tx.madrasa.findUnique({ where: { code: cleanCode } }),
      tx.madrasa.findUnique({ where: { slug: cleanSlug } }),
      tx.user.findUnique({ where: { email: finalAdminEmail } }),
    ]);

    if (existingCode) {
      throw new ConflictError(`Madrasa code '${cleanCode}' is already registered.`);
    }
    if (existingSlug) {
      throw new ConflictError(`Madrasa slug '${cleanSlug}' is already registered.`);
    }
    if (existingEmail) {
      throw new ConflictError(`User email '${finalAdminEmail}' is already registered.`);
    }

    // 5. Create Madrasa institution
    const madrasa = await tx.madrasa.create({
      data: {
        code: cleanCode,
        name: finalMadrasaName,
        slug: cleanSlug,
        email: request.email,
        phone: request.phone,
        address: request.address,
        status: 'ACTIVE',
      },
    });

    // 7. Create default MadrasaSetting
    await tx.madrasaSetting.create({
      data: {
        madrasaId: madrasa.id,
        invoicePrefix: 'INV-',
        receiptPrefix: 'REC-',
        currency: 'LKR',
        timezone: 'Asia/Colombo',
      },
    });

    // 8. Create Madrasa Admin User with mustChangePassword = true (Correction 2)
    const adminUser = await tx.user.create({
      data: {
        name: finalAdminName,
        email: finalAdminEmail,
        passwordHash,
        role: 'MADRASA_ADMIN',
        madrasaId: madrasa.id,
        isActive: true,
        mustChangePassword: true,
      },
    });

    // 9. Initial Subscription creation using Phase 5 rules (only if planId was provided)
    if (plan) {
      const subStartsAt = new Date(startsAt);
      const subEndsAt = addCalendarMonthsUtc(subStartsAt, plan.durationMonths);
      const isExpiring = isExpiringSoonPrecise(subEndsAt, env.SUBSCRIPTION_EXPIRING_SOON_DAYS, subStartsAt);
      const initialSubStatus = isExpiring ? 'EXPIRING_SOON' : 'ACTIVE';

      subscription = await tx.subscription.create({
        data: {
          madrasaId: madrasa.id,
          planId: plan.id,
          status: initialSubStatus,
          startsAt: subStartsAt,
          endsAt: subEndsAt,
          priceAtPurchase: plan.price,
          durationMonthsAtPurchase: plan.durationMonths,
        },
        include: { plan: true },
      });

      // 10. Optional SubscriptionPayment
      if (recordInitialPayment) {
        payment = await tx.subscriptionPayment.create({
          data: {
            madrasaId: madrasa.id,
            subscriptionId: subscription.id,
            amount: plan.price,
            paymentMethod,
            reference: paymentReference,
            notes: paymentNotes,
            paidAt: now,
          },
        });
      }
    }

    // 11. Finalize onboarding request link
    await tx.madrasaOnboardingRequest.update({
      where: { id: requestId },
      data: { approvedMadrasaId: madrasa.id },
    });

    // 12. Record ActivityLogs
    await tx.activityLog.create({
      data: {
        action: 'ONBOARDING_REQUEST_APPROVED',
        userId: reviewedByUserId,
        madrasaId: madrasa.id,
        entityType: 'MadrasaOnboardingRequest',
        entityId: requestId,
        metadata: {
          madrasaCode: cleanCode,
          adminEmail: finalAdminEmail,
          planCode: plan ? plan.code : null,
        },
        ipAddress,
        userAgent,
      },
    });

    await tx.activityLog.create({
      data: {
        action: 'MADRASA_CREATED',
        userId: reviewedByUserId,
        madrasaId: madrasa.id,
        entityType: 'Madrasa',
        entityId: madrasa.id,
        ipAddress,
        userAgent,
      },
    });

    // Return one-time temporary password (never stored plaintext, never logged)
    return {
      madrasa,
      adminUser: {
        id: adminUser.id,
        name: adminUser.name,
        email: adminUser.email,
        role: adminUser.role,
        mustChangePassword: adminUser.mustChangePassword,
        temporaryPassword: rawTemporaryPassword,
      },
      subscription,
      payment,
      credentials: {
        email: finalAdminEmail,
        temporaryPassword: rawTemporaryPassword,
      },
    };
  }, { maxWait: 10000, timeout: 20000 });

  // 13. Asynchronous Automatic Approval Email (outside Prisma transaction - Correction 18)
  let emailDelivery = {
    status: 'NOT_CONFIGURED',
    error: null,
    sentAt: null,
  };

  try {
    const formattedStart = txResult.subscription?.startsAt
      ? new Date(txResult.subscription.startsAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
      : '';
    const formattedEnd = txResult.subscription?.endsAt
      ? new Date(txResult.subscription.endsAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
      : '';

    const emailRes = await sendApprovalEmail({
      to: txResult.adminUser.email,
      applicantName: txResult.adminUser.name,
      madrasaName: txResult.madrasa.name,
      planName: txResult.subscription?.plan?.name || null,
      subscriptionStart: formattedStart,
      subscriptionEnd: formattedEnd,
      adminEmail: txResult.adminUser.email,
      temporaryPassword: null,
    });

    emailDelivery = {
      status: emailRes.status,
      error: emailRes.error || null,
      sentAt: emailRes.success ? new Date().toISOString() : null,
    };

    if (emailRes.success) {
      await prisma.activityLog.create({
        data: {
          action: 'APPROVAL_EMAIL_SENT',
          userId: reviewedByUserId,
          madrasaId: txResult.madrasa.id,
          entityType: 'MadrasaOnboardingRequest',
          entityId: requestId,
          metadata: {
            recipient: txResult.adminUser.email,
            planName: txResult.subscription?.plan?.name,
            providerMessageId: emailRes.messageId || null,
            sentAt: emailDelivery.sentAt,
          },
          ipAddress,
          userAgent,
        },
      });
    } else {
      await prisma.activityLog.create({
        data: {
          action: 'APPROVAL_EMAIL_FAILED',
          userId: reviewedByUserId,
          madrasaId: txResult.madrasa.id,
          entityType: 'MadrasaOnboardingRequest',
          entityId: requestId,
          metadata: {
            recipient: txResult.adminUser.email,
            planName: txResult.subscription?.plan?.name,
            emailStatus: emailRes.status,
            errorCode: emailRes.status,
            errorMessage: emailRes.error || 'Failed to deliver approval email',
          },
          ipAddress,
          userAgent,
        },
      });
    }
  } catch (err) {
    const sanitizedError = String(err.message || 'Unknown email error').slice(0, 200);
    emailDelivery = {
      status: 'FAILED',
      error: sanitizedError,
      sentAt: null,
    };
    try {
      await prisma.activityLog.create({
        data: {
          action: 'APPROVAL_EMAIL_FAILED',
          userId: reviewedByUserId,
          madrasaId: txResult.madrasa.id,
          entityType: 'MadrasaOnboardingRequest',
          entityId: requestId,
          metadata: {
            recipient: txResult.adminUser.email,
            errorCode: 'FAILED',
            errorMessage: sanitizedError,
          },
          ipAddress,
          userAgent,
        },
      });
    } catch (_) {
      // ActivityLog safety
    }
  }

  return {
    ...txResult,
    emailDelivery,
  };
}

/**
 * Resends the onboarding approval email for an already-approved request.
 * Guaranteed to NEVER recreate or provision Madrasa, Admin, or Subscription.
 * Enforces a 30-second rate safety cooldown.
 */
export async function resendApprovalEmail({
  requestId,
  reviewedByUserId,
  ipAddress = null,
  userAgent = null,
}) {
  const request = await prisma.madrasaOnboardingRequest.findUnique({
    where: { id: requestId },
    include: { approvedMadrasa: true },
  });

  if (!request) {
    throw new NotFoundError('Onboarding request not found.');
  }

  if (request.status !== 'APPROVED') {
    throw new BadRequestError('Only approved onboarding requests can receive an approval email.');
  }

  if (!request.approvedMadrasaId) {
    throw new BadRequestError('This onboarding request has no linked provisioned Madrasa.');
  }

  // 1. Rate safety cooldown check (30 seconds - Correction 14)
  const latestEmailLog = await prisma.activityLog.findFirst({
    where: {
      entityType: 'MadrasaOnboardingRequest',
      entityId: requestId,
      action: { in: ['APPROVAL_EMAIL_SENT', 'APPROVAL_EMAIL_FAILED', 'APPROVAL_EMAIL_RESENT'] },
    },
    orderBy: { createdAt: 'desc' },
  });

  const now = Date.now();
  if (latestEmailLog && (now - new Date(latestEmailLog.createdAt).getTime() < 30000)) {
    const remainingSeconds = Math.ceil((30000 - (now - new Date(latestEmailLog.createdAt).getTime())) / 1000);
    const err = new Error(`Please wait ${remainingSeconds} seconds before requesting another email resend.`);
    err.statusCode = 429;
    throw err;
  }

  // 2. Resolve authoritative linked Admin User (Correction 5)
  const adminUser = await prisma.user.findFirst({
    where: {
      madrasaId: request.approvedMadrasaId,
      role: 'MADRASA_ADMIN',
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  if (!adminUser) {
    throw new NotFoundError('No administrator account found linked to this approved Madrasa.');
  }

  // 3. Resolve authoritative linked Subscription & Plan
  const subscription = await prisma.subscription.findFirst({
    where: { madrasaId: request.approvedMadrasaId },
    include: { plan: true },
    orderBy: { createdAt: 'desc' },
  });

  const formattedStart = subscription?.startsAt
    ? new Date(subscription.startsAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : '';
  const formattedEnd = subscription?.endsAt
    ? new Date(subscription.endsAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : '';

  // 4. Generate cryptographically secure one-time setup token (stored only as SHA-256 hash)
  const rawSetupToken = crypto.randomBytes(32).toString('hex');
  const setupTokenHash = crypto.createHash('sha256').update(rawSetupToken).digest('hex');
  const setupExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24-hour expiration

  // Invalidate any existing unused setup tokens for this user before issuing a new one
  await prisma.passwordSetupToken.updateMany({
    where: { userId: adminUser.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  const setupTokenRecord = await prisma.passwordSetupToken.create({
    data: {
      userId: adminUser.id,
      tokenHash: setupTokenHash,
      expiresAt: setupExpiresAt,
    },
  });

  const setupUrl = getSetupPasswordUrl(rawSetupToken);

  // 5. Dispatch Email with setup link (NEVER mutates user.passwordHash before or during email dispatch)
  let emailRes;
  try {
    emailRes = await sendApprovalEmail({
      to: adminUser.email,
      applicantName: adminUser.name,
      madrasaName: request.approvedMadrasa.name,
      planName: subscription?.plan?.name || null,
      subscriptionStart: formattedStart,
      subscriptionEnd: formattedEnd,
      adminEmail: adminUser.email,
      temporaryPassword: null,
      setupUrl,
    });
  } catch (err) {
    emailRes = {
      success: false,
      status: 'FAILED',
      error: String(err.message || 'Unknown email error').slice(0, 200),
    };
  }

  const emailDelivery = {
    status: emailRes.status,
    error: emailRes.error || null,
    sentAt: emailRes.success ? new Date().toISOString() : null,
  };

  // 6. Log Activity & Session Handling
  if (emailRes.success) {
    // Only increment tokenVersion on successful dispatch to revoke previous sessions upon credential setup issuance
    await prisma.user.update({
      where: { id: adminUser.id },
      data: {
        tokenVersion: { increment: 1 },
      },
    });

    await prisma.activityLog.create({
      data: {
        action: 'APPROVAL_EMAIL_RESENT',
        userId: reviewedByUserId,
        madrasaId: request.approvedMadrasaId,
        entityType: 'MadrasaOnboardingRequest',
        entityId: requestId,
        metadata: {
          recipient: adminUser.email,
          planName: subscription?.plan?.name,
          providerMessageId: emailRes.messageId || null,
          sentAt: emailDelivery.sentAt,
        },
        ipAddress,
        userAgent,
      },
    });
  } else {
    // Delivery failed: Delete/invalidate the un-dispatched setup token so it cannot be used
    await prisma.passwordSetupToken.update({
      where: { id: setupTokenRecord.id },
      data: { usedAt: new Date() },
    }).catch(() => {});

    // Existing user.passwordHash and user.tokenVersion are strictly preserved!
    await prisma.activityLog.create({
      data: {
        action: 'APPROVAL_EMAIL_FAILED',
        userId: reviewedByUserId,
        madrasaId: request.approvedMadrasaId,
        entityType: 'MadrasaOnboardingRequest',
        entityId: requestId,
        metadata: {
          attemptType: 'RESEND',
          recipient: adminUser.email,
          planName: subscription?.plan?.name,
          emailStatus: emailRes.status,
          errorCode: emailRes.status,
          errorMessage: emailRes.error || 'Failed to resend approval email',
        },
        ipAddress,
        userAgent,
      },
    });
  }

  return {
    success: emailRes.success,
    emailDelivery,
    credentials: {
      email: adminUser.email,
    },
  };
}

export async function rejectOnboardingRequest({
  requestId,
  reviewedByUserId,
  rejectionReason,
  ipAddress = null,
  userAgent = null,
}) {
  const now = new Date();

  return await prisma.$transaction(async (tx) => {
    const claimResult = await tx.madrasaOnboardingRequest.updateMany({
      where: {
        id: requestId,
        status: 'PENDING',
      },
      data: {
        status: 'REJECTED',
        reviewedAt: now,
        reviewedByUserId,
        rejectionReason: rejectionReason.trim(),
      },
    });

    if (claimResult.count === 0) {
      throw new ConflictError('This onboarding request has already been reviewed, approved, rejected, or is being processed concurrently.');
    }

    await tx.activityLog.create({
      data: {
        action: 'ONBOARDING_REQUEST_REJECTED',
        userId: reviewedByUserId,
        entityType: 'MadrasaOnboardingRequest',
        entityId: requestId,
        metadata: { rejectionReason: rejectionReason.trim() },
        ipAddress,
        userAgent,
      },
    });

    return await tx.madrasaOnboardingRequest.findUnique({
      where: { id: requestId },
      include: { reviewedByUser: { select: { id: true, name: true } } },
    });
  });
}

// ==========================================
// 3. MADRASA INSTITUTION MANAGEMENT
// ==========================================

export async function listMadrasas({ search, status, planId, subscriptionStatus, page = 1, pageSize = 10 }) {
  const pageNum = Math.max(1, parseInt(page) || 1);
  const size = Math.min(100, Math.max(1, parseInt(pageSize) || 10));
  const skip = (pageNum - 1) * size;
  const now = new Date();
  const thresholdDays = env.SUBSCRIPTION_EXPIRING_SOON_DAYS || 7;
  const thresholdDate = new Date(now.getTime() + thresholdDays * 24 * 60 * 60 * 1000);

  // 1. Dynamic KPI Calculations across all institutions in database (all in parallel)
  const [totalInstitutions, activeCount, suspendedCount, archivedCount, expiringSubsCount] = await Promise.all([
    prisma.madrasa.count(),
    prisma.madrasa.count({ where: { status: 'ACTIVE' } }),
    prisma.madrasa.count({ where: { status: 'SUSPENDED' } }),
    prisma.madrasa.count({ where: { status: 'ARCHIVED' } }),
    prisma.subscription.count({
      where: {
        status: { in: ['ACTIVE', 'EXPIRING_SOON'] },
        startsAt: { lte: now },
        endsAt: { gt: now, lte: thresholdDate },
      },
    }),
  ]);

  const kpis = {
    total: totalInstitutions,
    active: activeCount,
    suspended: suspendedCount,
    archived: archivedCount,
    expiringSoon: expiringSubsCount,
  };

  // 2. Build where filter
  const where = {};

  if (status && ['ACTIVE', 'SUSPENDED', 'ARCHIVED'].includes(status)) {
    where.status = status;
  }

  if (planId && typeof planId === 'string' && planId.trim()) {
    where.subscriptions = {
      some: {
        planId: planId.trim(),
      },
    };
  }

  if (subscriptionStatus && ['ACTIVE', 'EXPIRING_SOON', 'EXPIRED', 'SUSPENDED', 'CANCELLED'].includes(subscriptionStatus)) {
    where.subscriptions = {
      ...(where.subscriptions || {}),
      some: {
        ...(where.subscriptions?.some || {}),
        status: subscriptionStatus,
      },
    };
  }

  if (search && typeof search === 'string' && search.trim()) {
    const term = search.trim();
    where.OR = [
      { name: { contains: term } },
      { code: { contains: term } },
      { slug: { contains: term } },
      { email: { contains: term } },
      { phone: { contains: term } },
      {
        users: {
          some: {
            role: 'MADRASA_ADMIN',
            name: { contains: term },
          },
        },
      },
      {
        users: {
          some: {
            role: 'MADRASA_ADMIN',
            email: { contains: term },
          },
        },
      },
    ];
  }

  // 3. Query paginated institutions with lightweight relations (NO heavy relation joins)
  const [madrasas, total] = await Promise.all([
    prisma.madrasa.findMany({
      where,
      select: {
        id: true,
        name: true,
        code: true,
        slug: true,
        email: true,
        phone: true,
        address: true,
        status: true,
        logoFileId: true,
        createdAt: true,
        updatedAt: true,
        archivedAt: true,
        users: {
          where: { role: 'MADRASA_ADMIN' },
          select: {
            id: true,
            name: true,
            email: true,
            isActive: true,
            mustChangePassword: true,
            lastLoginAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        _count: {
          select: {
            students: true,
            classes: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: size,
    }),
    prisma.madrasa.count({ where }),
  ]);

  // 4. Batch fetch relevant subscriptions for the current page only
  const pageMadrasaIds = madrasas.map((m) => m.id);
  const pageSubscriptions = pageMadrasaIds.length > 0
    ? await prisma.subscription.findMany({
        where: { madrasaId: { in: pageMadrasaIds } },
        include: {
          plan: {
            select: {
              id: true,
              name: true,
              code: true,
              durationMonths: true,
              price: true,
            },
          },
        },
        orderBy: [{ endsAt: 'desc' }, { startsAt: 'desc' }],
      })
    : [];

  const subsByMadrasa = new Map();
  for (const sub of pageSubscriptions) {
    if (!subsByMadrasa.has(sub.madrasaId)) {
      subsByMadrasa.set(sub.madrasaId, []);
    }
    subsByMadrasa.get(sub.madrasaId).push(sub);
  }

  // 5. Batch resolve logo URLs without binary download or N+1 queries
  const logoFileIds = madrasas.map((m) => m.logoFileId).filter(Boolean);
  const fileObjects = logoFileIds.length > 0
    ? await prisma.fileObject.findMany({
        where: { id: { in: logoFileIds } },
        select: { id: true, objectKey: true, publicUrl: true },
      })
    : [];

  const logoUrlMap = new Map();
  await Promise.all(
    fileObjects.map(async (f) => {
      try {
        if (f.publicUrl) {
          logoUrlMap.set(f.id, f.publicUrl);
        } else if (f.objectKey) {
          const url = await resolveObjectAccessUrl(f.objectKey);
          if (url) logoUrlMap.set(f.id, url);
        }
      } catch {
        // Fallback gracefully if URL cannot be generated
      }
    })
  );

  // 6. Format response items using canonical Phase 5 subscription resolution
  const formattedMadrasas = madrasas.map((m) => {
    const primaryAdmin = m.users[0] || null;
    const subs = subsByMadrasa.get(m.id) || [];

    // Candidate current term: startsAt <= now < endsAt
    const currentCandidates = subs.filter(
      (s) => s.startsAt.getTime() <= now.getTime() && s.endsAt.getTime() > now.getTime()
    );

    let activeSubscription = null;
    if (currentCandidates.length > 0) {
      const candidate = currentCandidates[0];
      const isExpiringSoon = isExpiringSoonPrecise(candidate.endsAt, thresholdDays, now);
      let resolvedStatus = candidate.status;
      if (!['SUSPENDED', 'CANCELLED'].includes(candidate.status)) {
        resolvedStatus = isExpiringSoon ? 'EXPIRING_SOON' : 'ACTIVE';
      }
      activeSubscription = {
        ...candidate,
        status: resolvedStatus,
        daysRemaining: getSubscriptionDaysRemaining(candidate.endsAt, now),
      };
    } else if (subs.length > 0) {
      const latestSub = subs[0];
      activeSubscription = {
        ...latestSub,
        daysRemaining: getSubscriptionDaysRemaining(latestSub.endsAt, now),
      };
    }

    const initials = generateInitials(m.name);
    const logoUrl = m.logoFileId ? (logoUrlMap.get(m.logoFileId) || null) : null;

    return {
      id: m.id,
      name: m.name,
      code: m.code,
      slug: m.slug,
      email: m.email,
      phone: m.phone,
      address: m.address,
      status: m.status,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
      archivedAt: m.archivedAt,
      logoFileId: m.logoFileId,
      logoUrl,
      initials,
      adminCount: m.users.length,
      primaryAdmin,
      admins: m.users,
      activeSubscription,
      counts: {
        students: m._count.students,
        classes: m._count.classes,
      },
    };
  });

  return {
    madrasas: formattedMadrasas,
    pagination: {
      total,
      page: pageNum,
      pageSize: size,
      totalPages: Math.ceil(total / size) || 1,
    },
    kpis,
  };
}

export async function getMadrasaDetails(id) {
  const now = new Date();
  const thresholdDays = env.SUBSCRIPTION_EXPIRING_SOON_DAYS || 7;

  const madrasa = await prisma.madrasa.findUnique({
    where: { id },
    include: {
      settings: true,
      users: {
        where: { role: 'MADRASA_ADMIN' },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          mustChangePassword: true,
          lastLoginAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      },
      subscriptions: {
        include: { plan: true },
        orderBy: [{ endsAt: 'desc' }, { startsAt: 'desc' }],
      },
      subscriptionPayments: {
        orderBy: { paidAt: 'desc' },
        take: 10,
      },
    },
  });

  if (!madrasa) {
    throw new NotFoundError('Madrasa not found.');
  }

  // Strictly tenant-scoped aggregate usage counts + logo lookup + activity in parallel
  const [
    totalStudents,
    activeStudents,
    classesCount,
    invoicesCount,
    paymentsCount,
    logoFileObject,
    recentActivity,
  ] = await Promise.all([
    prisma.student.count({ where: { madrasaId: id } }),
    prisma.student.count({ where: { madrasaId: id, status: 'ACTIVE' } }),
    prisma.class.count({ where: { madrasaId: id } }),
    prisma.invoice.count({ where: { madrasaId: id } }),
    prisma.payment.count({ where: { madrasaId: id } }),
    madrasa.logoFileId
      ? prisma.fileObject.findFirst({
          where: { id: madrasa.logoFileId, madrasaId: id, type: 'MADRASA_LOGO' },
          select: { objectKey: true, publicUrl: true },
        })
      : Promise.resolve(null),
    prisma.activityLog.findMany({
      where: { madrasaId: id },
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ]);

  let logoUrl = logoFileObject?.publicUrl || null;
  if (!logoUrl && logoFileObject?.objectKey) {
    try {
      logoUrl = await resolveObjectAccessUrl(logoFileObject.objectKey);
    } catch {
      logoUrl = null;
    }
  }

  const branding = {
    id: madrasa.id,
    name: madrasa.name,
    code: madrasa.code,
    logoUrl,
    logoFileId: madrasa.logoFileId,
    initials: generateInitials(madrasa.name),
  };

  const formattedSubscriptions = madrasa.subscriptions.map((s) => ({
    ...s,
    daysRemaining: getSubscriptionDaysRemaining(s.endsAt, now),
  }));

  // Resolve current active subscription using canonical Phase 5 logic
  const currentCandidates = formattedSubscriptions.filter(
    (s) => s.startsAt.getTime() <= now.getTime() && s.endsAt.getTime() > now.getTime()
  );

  let activeSubscription = null;
  if (currentCandidates.length > 0) {
    const candidate = currentCandidates[0];
    const isExpiringSoon = isExpiringSoonPrecise(candidate.endsAt, thresholdDays, now);
    let resolvedStatus = candidate.status;
    if (!['SUSPENDED', 'CANCELLED'].includes(candidate.status)) {
      resolvedStatus = isExpiringSoon ? 'EXPIRING_SOON' : 'ACTIVE';
    }
    activeSubscription = {
      ...candidate,
      status: resolvedStatus,
    };
  } else if (formattedSubscriptions.length > 0) {
    activeSubscription = formattedSubscriptions[0];
  }

  return {
    ...madrasa,
    branding,
    admins: madrasa.users,
    subscriptions: formattedSubscriptions,
    activeSubscription,
    usage: {
      totalStudents,
      activeStudents,
      classes: classesCount,
      invoices: invoicesCount,
      payments: paymentsCount,
    },
    recentActivity,
  };
}

export async function updateMadrasa(id, data, performedByUserId, ipAddress = null, userAgent = null) {
  const madrasa = await prisma.madrasa.findUnique({ where: { id } });
  if (!madrasa) {
    throw new NotFoundError('Madrasa not found.');
  }

  const updated = await prisma.madrasa.update({
    where: { id },
    data: {
      name: data.name?.trim() || undefined,
      email: data.email ? data.email.trim().toLowerCase() : undefined,
      phone: data.phone?.trim() || undefined,
      address: data.address?.trim() || undefined,
    },
  });

  await prisma.activityLog.create({
    data: {
      action: 'MADRASA_UPDATED',
      userId: performedByUserId,
      madrasaId: id,
      entityType: 'Madrasa',
      entityId: id,
      metadata: data,
      ipAddress,
      userAgent,
    },
  });

  return updated;
}

export async function setMadrasaStatus(id, newStatus, performedByUserId, ipAddress = null, userAgent = null) {
  const madrasa = await prisma.madrasa.findUnique({ where: { id } });
  if (!madrasa) {
    throw new NotFoundError('Madrasa not found.');
  }

  if (madrasa.status === newStatus) {
    throw new BadRequestError(`Institution is already ${newStatus.toLowerCase()}.`);
  }

  // Valid state transitions:
  // ACTIVE -> SUSPENDED or ARCHIVED
  // SUSPENDED -> ACTIVE or ARCHIVED
  // ARCHIVED -> ACTIVE (restore)
  const validTransitions = {
    ACTIVE: ['SUSPENDED', 'ARCHIVED'],
    SUSPENDED: ['ACTIVE', 'ARCHIVED'],
    ARCHIVED: ['ACTIVE'],
  };

  const allowed = validTransitions[madrasa.status] || [];
  if (!allowed.includes(newStatus)) {
    throw new BadRequestError(`Cannot transition institution status from ${madrasa.status} to ${newStatus}.`);
  }

  const expectedPreviousStatus = madrasa.status;
  const updateData = { status: newStatus };

  if (newStatus === 'ARCHIVED') {
    updateData.archivedAt = new Date();
  } else if (newStatus === 'ACTIVE') {
    updateData.archivedAt = null;
  }

  // Atomic concurrency-safe update conditioned on expected previous status
  const updateResult = await prisma.madrasa.updateMany({
    where: {
      id,
      status: expectedPreviousStatus,
    },
    data: updateData,
  });

  if (updateResult.count === 0) {
    throw new ConflictError('This institution was updated by another request. Refresh and try again.');
  }

  const updated = await prisma.madrasa.findUnique({ where: { id } });

  const actionMap = {
    ACTIVE: 'MADRASA_ACTIVATED',
    SUSPENDED: 'MADRASA_SUSPENDED',
    ARCHIVED: 'MADRASA_ARCHIVED',
  };

  await prisma.activityLog.create({
    data: {
      action: actionMap[newStatus] || 'MADRASA_STATUS_CHANGED',
      userId: performedByUserId,
      madrasaId: id,
      entityType: 'Madrasa',
      entityId: id,
      metadata: { previousStatus: expectedPreviousStatus, newStatus },
      ipAddress,
      userAgent,
    },
  });

  return updated;
}

export async function activateMadrasa(id, performedByUserId, ipAddress = null, userAgent = null) {
  return setMadrasaStatus(id, 'ACTIVE', performedByUserId, ipAddress, userAgent);
}

export async function suspendMadrasa(id, performedByUserId, ipAddress = null, userAgent = null) {
  return setMadrasaStatus(id, 'SUSPENDED', performedByUserId, ipAddress, userAgent);
}

export async function archiveMadrasa(id, performedByUserId, ipAddress = null, userAgent = null) {
  return setMadrasaStatus(id, 'ARCHIVED', performedByUserId, ipAddress, userAgent);
}

// ==========================================
// 4. MADRASA ADMIN ACCOUNT MANAGEMENT
// ==========================================

export async function resetMadrasaAdminPassword(
  madrasaId,
  adminUserId,
  temporaryPassword = null,
  performedByUserId = null,
  ipAddress = null,
  userAgent = null
) {
  // Tenant-target safe assertion (Correction 7)
  const user = await prisma.user.findFirst({
    where: {
      id: adminUserId,
      madrasaId,
      role: 'MADRASA_ADMIN',
    },
  });

  if (!user) {
    throw new NotFoundError('Madrasa administrator not found for this institution.');
  }

  const rawTemporaryPassword = temporaryPassword || (crypto.randomBytes(6).toString('hex') + '!Aa1');
  const passwordValidation = validatePasswordStrength(rawTemporaryPassword);
  if (!passwordValidation.valid) {
    throw new BadRequestError(passwordValidation.message || 'Temporary password does not meet security requirements.');
  }

  const newPasswordHash = await hashPassword(rawTemporaryPassword);

  await prisma.user.update({
    where: { id: adminUserId },
    data: {
      passwordHash: newPasswordHash,
      mustChangePassword: true,
      tokenVersion: { increment: 1 },
    },
  });

  await prisma.activityLog.create({
    data: {
      action: 'MADRASA_ADMIN_PASSWORD_RESET',
      userId: performedByUserId,
      madrasaId,
      entityType: 'User',
      entityId: adminUserId,
      ipAddress,
      userAgent,
    },
  });

  return {
    email: user.email,
    temporaryPassword: rawTemporaryPassword,
  };
}

export async function toggleMadrasaAdminActive(
  madrasaId,
  adminUserId,
  isActive,
  performedByUserId = null,
  ipAddress = null,
  userAgent = null
) {
  // Tenant-target safe assertion (Correction 7)
  const user = await prisma.user.findFirst({
    where: {
      id: adminUserId,
      madrasaId,
      role: 'MADRASA_ADMIN',
    },
  });

  if (!user) {
    throw new NotFoundError('Madrasa administrator not found for this institution.');
  }

  const updated = await prisma.user.update({
    where: { id: adminUserId },
    data: { isActive: Boolean(isActive) },
  });

  await prisma.activityLog.create({
    data: {
      action: isActive ? 'MADRASA_ADMIN_ACTIVATED' : 'MADRASA_ADMIN_DEACTIVATED',
      userId: performedByUserId,
      madrasaId,
      entityType: 'User',
      entityId: adminUserId,
      metadata: { isActive: Boolean(isActive) },
      ipAddress,
      userAgent,
    },
  });

  return updated;
}

// ==========================================
// 5. DYNAMIC PLAN & FEATURE MANAGEMENT
// ==========================================

export async function getFeatureCatalogue() {
  const categories = getFeaturesByCategory();
  const summary = {
    totalFeatures: FEATURE_CATALOGUE.length,
    implemented: FEATURE_CATALOGUE.filter((f) => f.status === FEATURE_STATUS.IMPLEMENTED).length,
    core: FEATURE_CATALOGUE.filter((f) => f.status === FEATURE_STATUS.CORE).length,
    partiallyImplemented: FEATURE_CATALOGUE.filter((f) => f.status === FEATURE_STATUS.PARTIALLY_IMPLEMENTED).length,
    planned: FEATURE_CATALOGUE.filter((f) => f.status === FEATURE_STATUS.PLANNED).length,
    totalCategories: FEATURE_CATEGORIES.length,
  };

  return {
    categories,
    summary,
  };
}

export async function listPlans(options = {}) {
  const { search, status } = options;

  const where = {};
  if (status === 'ACTIVE') {
    where.isActive = true;
  } else if (status === 'INACTIVE') {
    where.isActive = false;
  }

  if (search && search.trim()) {
    const term = search.trim();
    where.OR = [
      { name: { contains: term } },
      { code: { contains: term } },
      { description: { contains: term } },
    ];
  }

  const now = new Date();

  const [plans, totalPlans, activePlans, inactivePlans, currentSubscriptions, totalSubCounts] = await Promise.all([
    prisma.plan.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        planFeatures: {
          select: {
            id: true,
            featureKey: true,
            isEnabled: true,
          },
        },
      },
    }),
    prisma.plan.count(),
    prisma.plan.count({ where: { isActive: true } }),
    prisma.plan.count({ where: { isActive: false } }),
    prisma.subscription.findMany({
      where: {
        startsAt: { lte: now },
        endsAt: { gt: now },
        status: { notIn: ['SUSPENDED', 'CANCELLED', 'EXPIRED'] },
      },
      select: { id: true, planId: true, madrasaId: true },
    }),
    prisma.subscription.groupBy({
      by: ['planId'],
      _count: { _all: true },
    }),
  ]);

  const globalKpis = {
    totalPlans,
    activePlans,
    inactivePlans,
    activeSubscriptions: currentSubscriptions.length,
    institutionsUsingPlans: new Set(currentSubscriptions.map((s) => s.madrasaId)).size,
  };

  const enrichedPlans = plans.map((plan) => {
    const planActiveSubs = currentSubscriptions.filter((s) => s.planId === plan.id);
    const historicalEntry = totalSubCounts.find((c) => c.planId === plan.id);
    const enabledFeatures = (plan.planFeatures || []).filter((pf) => pf.isEnabled);

    return {
      ...plan,
      featuresCount: enabledFeatures.length,
      assignedFeatureKeys: enabledFeatures.map((pf) => pf.featureKey),
      activeSubscriptionsCount: planActiveSubs.length,
      institutionsCount: new Set(planActiveSubs.map((s) => s.madrasaId)).size,
      totalSubscriptionsCount: historicalEntry?._count?._all || 0,
    };
  });

  return {
    plans: enrichedPlans,
    kpis: globalKpis,
  };
}

export async function getPlanDetails(id) {
  const plan = await prisma.plan.findUnique({
    where: { id },
    include: {
      planFeatures: {
        orderBy: { featureKey: 'asc' },
      },
    },
  });

  if (!plan) {
    throw new NotFoundError('Subscription plan not found.');
  }

  const now = new Date();
  const [currentSubscriptions, totalSubscriptionsCount, recentActivity] = await Promise.all([
    prisma.subscription.findMany({
      where: {
        planId: id,
        startsAt: { lte: now },
        endsAt: { gt: now },
        status: { notIn: ['SUSPENDED', 'CANCELLED', 'EXPIRED'] },
      },
      select: { id: true, madrasaId: true },
    }),
    prisma.subscription.count({
      where: { planId: id },
    }),
    prisma.activityLog.findMany({
      where: {
        entityType: 'Plan',
        entityId: id,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    }),
  ]);

  const enabledFeatures = (plan.planFeatures || []).filter((pf) => pf.isEnabled);
  const disabledFeatures = (plan.planFeatures || []).filter((pf) => !pf.isEnabled);

  return {
    ...plan,
    featuresCount: enabledFeatures.length,
    disabledFeaturesCount: disabledFeatures.length,
    assignedFeatureKeys: enabledFeatures.map((pf) => pf.featureKey),
    activeSubscriptionsCount: currentSubscriptions.length,
    institutionsCount: new Set(currentSubscriptions.map((s) => s.madrasaId)).size,
    totalSubscriptionsCount,
    recentActivity,
  };
}

export async function createPlan(data, performedByUserId, ipAddress = null, userAgent = null) {
  const cleanCode = data.code.trim().toUpperCase();
  const cleanName = data.name.trim();

  const existingCode = await prisma.plan.findUnique({
    where: { code: cleanCode },
  });

  if (existingCode) {
    throw new ConflictError(`Plan with code '${cleanCode}' already exists.`);
  }

  const existingName = await prisma.plan.findFirst({
    where: { name: cleanName },
  });

  if (existingName) {
    throw new ConflictError(`Plan with name '${cleanName}' already exists.`);
  }

  const featureKeys = data.featureKeys && Array.isArray(data.featureKeys)
    ? Array.from(new Set(data.featureKeys))
    : [];

  return await prisma.$transaction(async (tx) => {
    const plan = await tx.plan.create({
      data: {
        name: cleanName,
        code: cleanCode,
        description: data.description?.trim() || null,
        durationMonths: data.durationMonths,
        price: new Prisma.Decimal(data.price),
        originalPrice: data.originalPrice ? new Prisma.Decimal(data.originalPrice) : null,
        isSpecialOffer: Boolean(data.isSpecialOffer),
        specialOfferLabel: data.specialOfferLabel?.trim() || null,
        isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
      },
    });

    if (featureKeys.length > 0) {
      await tx.planFeature.createMany({
        data: featureKeys.map((featureKey) => ({
          planId: plan.id,
          featureKey,
          isEnabled: true,
        })),
      });
    }

    await tx.activityLog.create({
      data: {
        action: 'PLAN_CREATED',
        userId: performedByUserId,
        entityType: 'Plan',
        entityId: plan.id,
        metadata: {
          name: plan.name,
          code: cleanCode,
          price: String(data.price),
          originalPrice: data.originalPrice ? String(data.originalPrice) : null,
          isSpecialOffer: Boolean(data.isSpecialOffer),
          specialOfferLabel: data.specialOfferLabel?.trim() || null,
          durationMonths: data.durationMonths,
          featuresCount: featureKeys.length,
          assignedFeatureKeys: featureKeys,
        },
        ipAddress,
        userAgent,
      },
    });

    return await tx.plan.findUnique({
      where: { id: plan.id },
      include: {
        planFeatures: {
          orderBy: { featureKey: 'asc' },
        },
      },
    });
  });
}

export async function updatePlanFeatures(planId, featureKeys, performedByUserId, ipAddress = null, userAgent = null) {
  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    include: {
      planFeatures: true,
    },
  });

  if (!plan) {
    throw new NotFoundError('Subscription plan not found.');
  }

  const currentEnabledKeys = plan.planFeatures.filter((pf) => pf.isEnabled).map((pf) => pf.featureKey);
  const targetKeys = Array.from(new Set(featureKeys));

  const addedKeys = targetKeys.filter((k) => !currentEnabledKeys.includes(k));
  const removedKeys = currentEnabledKeys.filter((k) => !targetKeys.includes(k));

  const isNoOp = addedKeys.length === 0 && removedKeys.length === 0;

  if (isNoOp) {
    return {
      planId: plan.id,
      planName: plan.name,
      planCode: plan.code,
      assignedCount: targetKeys.length,
      addedCount: 0,
      removedCount: 0,
      addedKeys: [],
      removedKeys: [],
      assignedFeatureKeys: targetKeys,
      isNoOp: true,
    };
  }

  return await prisma.$transaction(async (tx) => {
    // 1. Delete removed features
    if (removedKeys.length > 0) {
      await tx.planFeature.deleteMany({
        where: {
          planId,
          featureKey: { in: removedKeys },
        },
      });
    }

    // 2. Add new features
    if (addedKeys.length > 0) {
      await tx.planFeature.createMany({
        data: addedKeys.map((featureKey) => ({
          planId,
          featureKey,
          isEnabled: true,
        })),
        skipDuplicates: true,
      });
    }

    // 3. Bump parent Plan updatedAt for cache invalidation signal in SAME transaction
    await tx.plan.update({
      where: { id: planId },
      data: { updatedAt: new Date() },
    });

    // 4. Log PLAN_FEATURES_UPDATED in SAME transaction
    await tx.activityLog.create({
      data: {
        action: 'PLAN_FEATURES_UPDATED',
        userId: performedByUserId,
        entityType: 'Plan',
        entityId: planId,
        metadata: {
          planName: plan.name,
          planCode: plan.code,
          addedKeys,
          removedKeys,
          addedCount: addedKeys.length,
          removedCount: removedKeys.length,
          totalAssignedCount: targetKeys.length,
          assignedFeatureKeys: targetKeys,
        },
        ipAddress,
        userAgent,
      },
    });

    return {
      planId: plan.id,
      planName: plan.name,
      planCode: plan.code,
      assignedCount: targetKeys.length,
      addedCount: addedKeys.length,
      removedCount: removedKeys.length,
      addedKeys,
      removedKeys,
      assignedFeatureKeys: targetKeys,
      isNoOp: false,
    };
  });
}

export async function getPlanComparison(options = {}) {
  const { includeInactive, planIds } = options;

  const where = {};
  if (!includeInactive) {
    where.isActive = true;
  }
  if (planIds && planIds.length > 0) {
    where.id = { in: planIds };
  }

  const now = new Date();

  const [plans, currentSubscriptions] = await Promise.all([
    prisma.plan.findMany({
      where,
      orderBy: [{ isActive: 'desc' }, { price: 'asc' }],
      include: {
        planFeatures: true,
      },
    }),
    prisma.subscription.findMany({
      where: {
        startsAt: { lte: now },
        endsAt: { gt: now },
        status: { notIn: ['SUSPENDED', 'CANCELLED', 'EXPIRED'] },
      },
      select: { planId: true },
    }),
  ]);

  const activeSubCountMap = new Map();
  for (const s of currentSubscriptions) {
    activeSubCountMap.set(s.planId, (activeSubCountMap.get(s.planId) || 0) + 1);
  }

  // Format plans for side-by-side comparison matrix
  const formattedPlans = plans.map((p) => {
    const enabledFeatureMap = {};
    for (const pf of p.planFeatures) {
      if (pf.isEnabled) {
        enabledFeatureMap[pf.featureKey] = true;
      }
    }

    return {
      id: p.id,
      name: p.name,
      code: p.code,
      description: p.description,
      durationMonths: p.durationMonths,
      price: String(p.price),
      originalPrice: p.originalPrice ? String(p.originalPrice) : null,
      isSpecialOffer: Boolean(p.isSpecialOffer),
      specialOfferLabel: p.specialOfferLabel || null,
      currency: 'LKR',
      isActive: p.isActive,
      activeSubscriptionsCount: activeSubCountMap.get(p.id) || 0,
      featuresCount: Object.keys(enabledFeatureMap).length,
      featureAvailability: enabledFeatureMap,
    };
  });

  const categories = getFeaturesByCategory();

  return {
    plans: formattedPlans,
    categories,
    catalogueStats: {
      totalFeatures: FEATURE_CATALOGUE.length,
      implemented: FEATURE_CATALOGUE.filter((f) => f.status === FEATURE_STATUS.IMPLEMENTED).length,
      core: FEATURE_CATALOGUE.filter((f) => f.status === FEATURE_STATUS.CORE).length,
      partiallyImplemented: FEATURE_CATALOGUE.filter((f) => f.status === FEATURE_STATUS.PARTIALLY_IMPLEMENTED).length,
      planned: FEATURE_CATALOGUE.filter((f) => f.status === FEATURE_STATUS.PLANNED).length,
    },
  };
}

export async function updatePlan(id, data, performedByUserId, ipAddress = null, userAgent = null) {
  const plan = await prisma.plan.findUnique({ where: { id } });
  if (!plan) {
    throw new NotFoundError('Subscription plan not found.');
  }

  if (data.name && data.name.trim() !== plan.name) {
    const cleanName = data.name.trim();
    const existingName = await prisma.plan.findFirst({
      where: {
        name: cleanName,
        NOT: { id },
      },
    });
    if (existingName) {
      throw new ConflictError(`Plan with name '${cleanName}' already exists.`);
    }
  }

  const updateData = {};
  const changes = {};

  if (data.name !== undefined && data.name.trim() !== plan.name) {
    updateData.name = data.name.trim();
    changes.name = { from: plan.name, to: updateData.name };
  }
  if (data.description !== undefined) {
    const desc = data.description?.trim() || null;
    if (desc !== plan.description) {
      updateData.description = desc;
      changes.description = { from: plan.description, to: desc };
    }
  }
  if (data.durationMonths !== undefined && data.durationMonths !== plan.durationMonths) {
    updateData.durationMonths = data.durationMonths;
    changes.durationMonths = { from: plan.durationMonths, to: data.durationMonths };
  }
  if (data.price !== undefined && String(data.price) !== String(plan.price)) {
    updateData.price = new Prisma.Decimal(data.price);
    changes.price = { from: String(plan.price), to: String(data.price) };
  }
  if (data.originalPrice !== undefined) {
    const orig = data.originalPrice ? new Prisma.Decimal(data.originalPrice) : null;
    const oldOrigStr = plan.originalPrice ? String(plan.originalPrice) : null;
    const newOrigStr = data.originalPrice ? String(data.originalPrice) : null;
    if (newOrigStr !== oldOrigStr) {
      updateData.originalPrice = orig;
      changes.originalPrice = { from: oldOrigStr, to: newOrigStr };
    }
  }
  if (data.isSpecialOffer !== undefined && Boolean(data.isSpecialOffer) !== plan.isSpecialOffer) {
    updateData.isSpecialOffer = Boolean(data.isSpecialOffer);
    changes.isSpecialOffer = { from: plan.isSpecialOffer, to: Boolean(data.isSpecialOffer) };
  }
  if (data.specialOfferLabel !== undefined) {
    const label = data.specialOfferLabel?.trim() || null;
    if (label !== plan.specialOfferLabel) {
      updateData.specialOfferLabel = label;
      changes.specialOfferLabel = { from: plan.specialOfferLabel, to: label };
    }
  }
  if (data.isActive !== undefined && Boolean(data.isActive) !== plan.isActive) {
    updateData.isActive = Boolean(data.isActive);
    changes.isActive = { from: plan.isActive, to: Boolean(data.isActive) };
  }

  const updated = await prisma.plan.update({
    where: { id },
    data: updateData,
  });

  await prisma.activityLog.create({
    data: {
      action: 'PLAN_UPDATED',
      userId: performedByUserId,
      entityType: 'Plan',
      entityId: id,
      metadata: { changes },
      ipAddress,
      userAgent,
    },
  });

  return updated;
}

export async function togglePlanActive(id, isActive, performedByUserId, ipAddress = null, userAgent = null) {
  const plan = await prisma.plan.findUnique({ where: { id } });
  if (!plan) {
    throw new NotFoundError('Subscription plan not found.');
  }

  const targetActive = Boolean(isActive);
  if (plan.isActive === targetActive) {
    return plan;
  }

  const updated = await prisma.plan.update({
    where: { id },
    data: { isActive: targetActive },
  });

  await prisma.activityLog.create({
    data: {
      action: targetActive ? 'PLAN_ACTIVATED' : 'PLAN_DEACTIVATED',
      userId: performedByUserId,
      entityType: 'Plan',
      entityId: id,
      metadata: {
        previousStatus: plan.isActive,
        newStatus: targetActive,
      },
      ipAddress,
      userAgent,
    },
  });

  return updated;
}

// ==========================================
// 6. SUBSCRIPTION MANAGEMENT & RENEWAL
// ==========================================

export async function getMadrasaSubscriptionHistory(madrasaId) {
  const madrasa = await prisma.madrasa.findUnique({ where: { id: madrasaId } });
  if (!madrasa) {
    throw new NotFoundError('Madrasa not found.');
  }

  const [subscriptions, payments] = await Promise.all([
    prisma.subscription.findMany({
      where: { madrasaId },
      include: { plan: true },
      orderBy: [{ endsAt: 'desc' }, { startsAt: 'desc' }],
    }),
    prisma.subscriptionPayment.findMany({
      where: { madrasaId },
      include: { subscription: { include: { plan: true } } },
      orderBy: { paidAt: 'desc' },
    }),
  ]);

  return {
    madrasa: { id: madrasa.id, name: madrasa.name, code: madrasa.code },
    subscriptions,
    payments,
  };
}

export async function renewSubscriptionForMadrasa({
  madrasaId,
  planId,
  paymentMethod = 'BANK_TRANSFER',
  reference = null,
  notes = null,
  performedByUserId = null,
  ipAddress = null,
  userAgent = null,
}) {
  const madrasa = await prisma.madrasa.findUnique({ where: { id: madrasaId } });
  if (!madrasa) {
    throw new NotFoundError('Madrasa not found.');
  }

  // Reuses Phase 5 transaction and date arithmetic
  return await createSubscriptionRenewal({
    madrasaId,
    planId,
    paymentMethod,
    reference,
    notes,
    performedByUserId,
    ipAddress,
    userAgent,
    nowUtc: new Date(),
  });
}

export async function setSubscriptionManualStatus(
  subscriptionId,
  newStatus,
  performedByUserId,
  ipAddress = null,
  userAgent = null
) {
  if (!['SUSPENDED', 'CANCELLED'].includes(newStatus)) {
    throw new BadRequestError('Only SUSPENDED or CANCELLED status can be manually applied.');
  }

  const sub = await prisma.subscription.findUnique({ where: { id: subscriptionId } });
  if (!sub) {
    throw new NotFoundError('Subscription record not found.');
  }

  const updated = await prisma.subscription.update({
    where: { id: subscriptionId },
    data: { status: newStatus },
  });

  await prisma.activityLog.create({
    data: {
      action: newStatus === 'SUSPENDED' ? 'SUBSCRIPTION_SUSPENDED' : 'SUBSCRIPTION_CANCELLED',
      userId: performedByUserId,
      madrasaId: sub.madrasaId,
      entityType: 'Subscription',
      entityId: subscriptionId,
      ipAddress,
      userAgent,
    },
  });

  return updated;
}

// ==========================================
// 7. PLATFORM ACTIVITY LOGS
// ==========================================

export async function listPlatformActivityLogs({ page = 1, pageSize = 50, action, madrasaId }) {
  const pageNum = Math.max(1, parseInt(page) || 1);
  const size = Math.min(100, Math.max(1, parseInt(pageSize) || 50));
  const skip = (pageNum - 1) * size;

  const where = {};
  if (action && typeof action === 'string' && action.trim()) {
    where.action = action.trim();
  }
  if (madrasaId && typeof madrasaId === 'string' && madrasaId.trim()) {
    where.madrasaId = madrasaId.trim();
  }

  const [logs, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      include: {
        madrasa: { select: { id: true, name: true, code: true } },
        user: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: size,
    }),
    prisma.activityLog.count({ where }),
  ]);

  return {
    logs,
    pagination: {
      total,
      page: pageNum,
      pageSize: size,
      totalPages: Math.ceil(total / size) || 1,
    },
  };
}
