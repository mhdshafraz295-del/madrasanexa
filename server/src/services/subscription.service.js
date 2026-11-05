import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import {
  addCalendarMonthsUtc,
  getSubscriptionDaysRemaining,
  isExpiringSoonPrecise,
} from '../utils/subscription-date.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';

/**
 * MadrasaNexa Subscription Resolver & Lifecycle Service.
 *
 * Invariants Enforced:
 * 1. Expiration NEVER deletes tenant or business data.
 * 2. Request-time UTC dates govern access authority.
 * 3. Subscription resolution handles current, past, and future terms explicitly.
 * 4. Conflicting overlapping terms fail closed for security.
 * 5. Concurrent renewals are protected via transactional start-date re-evaluation.
 * 6. Scheduled synchronizations and activity logs are strictly idempotent.
 */

/**
 * Resolves current subscription access for a tenant Madrasa at request-time.
 *
 * Resolution Order:
 * A. Find candidate terms where startsAt <= nowUtc AND endsAt > nowUtc.
 * B. If exactly one candidate exists:
 *    - Check SUSPENDED / CANCELLED manual states.
 *    - Otherwise evaluate ACTIVE vs EXPIRING_SOON via precise UTC time comparison.
 * C. If no current candidate exists:
 *    - If prior terms exist (ended <= nowUtc) -> SUBSCRIPTION_EXPIRED.
 *    - If only future terms exist (startsAt > nowUtc) -> SUBSCRIPTION_NOT_STARTED.
 *    - If no subscription records exist -> SUBSCRIPTION_REQUIRED.
 * D. If multiple overlapping current candidates exist unexpectedly:
 *    - Fail closed (SUBSCRIPTION_CONFLICT) and log warning.
 *
 * @param {string} madrasaId - Madrasa identifier
 * @param {Date|string|number} [nowUtc=new Date()] - Reference UTC timestamp
 * @returns {Promise<object>} Access resolution result
/**
 * Canonical Phase 5 Subscription Access and Lifecycle Evaluator.
 * Pure evaluation: given a list of subscription records for a tenant,
 * derives the effective lifecycle state at `nowUtc`.
 *
 * @param {Array<object>} subscriptions - Array of subscription objects with startsAt, endsAt, status, and optional plan
 * @param {Date|string|number} [nowUtc=new Date()] - Reference UTC timestamp
 * @returns {object} Access resolution result
 */
export function evaluateEffectiveSubscription(subscriptions, nowUtc = new Date()) {
  const now = new Date(nowUtc);

  if (!subscriptions || subscriptions.length === 0) {
    return {
      allowed: false,
      code: 'SUBSCRIPTION_REQUIRED',
      status: 'REQUIRED',
      reason: 'No subscription found for this Madrasa. Please activate a subscription to access business modules.',
      daysRemaining: 0,
      subscription: null,
    };
  }

  // A. Find candidate current terms: startsAt <= now < endsAt
  const currentCandidates = subscriptions.filter(
    (sub) => sub.startsAt.getTime() <= now.getTime() && sub.endsAt.getTime() > now.getTime()
  );

  // B. Exactly one current term candidate
  if (currentCandidates.length === 1) {
    const candidate = currentCandidates[0];

    // Check manual administrative blocks
    if (candidate.status === 'SUSPENDED') {
      return {
        allowed: false,
        code: 'SUBSCRIPTION_SUSPENDED',
        status: 'SUSPENDED',
        reason: 'Subscription is suspended by platform administration.',
        daysRemaining: 0,
        subscription: candidate,
      };
    }

    if (candidate.status === 'CANCELLED') {
      return {
        allowed: false,
        code: 'SUBSCRIPTION_CANCELLED',
        status: 'CANCELLED',
        reason: 'Subscription has been cancelled.',
        daysRemaining: 0,
        subscription: candidate,
      };
    }

    // Precise UTC evaluation of expiring-soon threshold
    const isExpiringSoon = isExpiringSoonPrecise(candidate.endsAt, env.SUBSCRIPTION_EXPIRING_SOON_DAYS, now);
    const resolvedStatus = isExpiringSoon ? 'EXPIRING_SOON' : 'ACTIVE';
    const daysRemaining = getSubscriptionDaysRemaining(candidate.endsAt, now);

    return {
      allowed: true,
      code: resolvedStatus,
      status: resolvedStatus,
      daysRemaining,
      subscription: candidate,
    };
  }

  // D. Unexpected multiple overlapping current candidates -> Fail closed
  if (currentCandidates.length > 1) {
    console.warn(`[SECURITY CONFLICT] Multiple active overlapping subscription terms found`);
    return {
      allowed: false,
      code: 'SUBSCRIPTION_CONFLICT',
      status: 'CONFLICT',
      reason: 'Multiple conflicting active subscriptions found. Access is locked pending administrative review.',
      daysRemaining: 0,
      subscription: null,
    };
  }

  // C. No current candidate: Check past vs future terms
  const pastTerms = subscriptions.filter((sub) => sub.endsAt.getTime() <= now.getTime());
  if (pastTerms.length > 0) {
    // Sort to find the most recently expired term
    pastTerms.sort((a, b) => b.endsAt.getTime() - a.endsAt.getTime());
    const latestPast = pastTerms[0];

    return {
      allowed: false,
      code: 'SUBSCRIPTION_EXPIRED',
      status: 'EXPIRED',
      reason: `Subscription expired on ${latestPast.endsAt.toISOString().split('T')[0]}. Please renew your subscription.`,
      daysRemaining: 0,
      subscription: latestPast,
    };
  }

  const futureTerms = subscriptions.filter((sub) => sub.startsAt.getTime() > now.getTime());
  if (futureTerms.length > 0) {
    futureTerms.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
    const nextFuture = futureTerms[0];

    return {
      allowed: false,
      code: 'SUBSCRIPTION_NOT_STARTED',
      status: 'NOT_STARTED',
      reason: `Subscription is scheduled to begin on ${nextFuture.startsAt.toISOString().split('T')[0]}.`,
      daysRemaining: 0,
      subscription: nextFuture,
    };
  }

  // Fallback safe closure
  return {
    allowed: false,
    code: 'SUBSCRIPTION_REQUIRED',
    status: 'REQUIRED',
    reason: 'Active subscription required.',
    daysRemaining: 0,
    subscription: null,
  };
}

/**
 * Resolves current subscription access for a tenant Madrasa at request-time.
 *
 * Resolution Order:
 * A. Find candidate terms where startsAt <= nowUtc AND endsAt > nowUtc.
 * B. If exactly one candidate exists:
 *    - Check SUSPENDED / CANCELLED manual states.
 *    - Otherwise evaluate ACTIVE vs EXPIRING_SOON via precise UTC time comparison.
 * C. If no current candidate exists:
 *    - If prior terms exist (ended <= nowUtc) -> SUBSCRIPTION_EXPIRED.
 *    - If only future terms exist (startsAt > nowUtc) -> SUBSCRIPTION_NOT_STARTED.
 *    - If no subscription records exist -> SUBSCRIPTION_REQUIRED.
 * D. If multiple overlapping current candidates exist unexpectedly:
 *    - Fail closed (SUBSCRIPTION_CONFLICT) and log warning.
 *
 * @param {string} madrasaId - Madrasa identifier
 * @param {Date|string|number} [nowUtc=new Date()] - Reference UTC timestamp
 * @returns {Promise<object>} Access resolution result
 */
export async function resolveSubscriptionAccess(madrasaId, nowUtc = new Date()) {
  const now = new Date(nowUtc);

  // Fetch all subscriptions for this Madrasa to inspect history, current, and future terms
  const subscriptions = await prisma.subscription.findMany({
    where: { madrasaId },
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
  });

  return evaluateEffectiveSubscription(subscriptions, now);
}

/**
 * Returns a sanitized subscription summary suitable for client consumption.
 * Expired Madrasa Admins can safely retrieve this payload without error.
 *
 * @param {string} madrasaId
 * @param {Date|string|number} [nowUtc=new Date()]
 * @returns {Promise<object>}
 */
export async function getSubscriptionSummary(madrasaId, nowUtc = new Date()) {
  const access = await resolveSubscriptionAccess(madrasaId, nowUtc);

  return {
    allowed: access.allowed,
    code: access.code,
    status: access.status,
    daysRemaining: access.daysRemaining,
    reason: access.reason || null,
    subscription: access.subscription ? {
      id: access.subscription.id,
      status: access.status,
      startsAt: access.subscription.startsAt,
      endsAt: access.subscription.endsAt,
      priceAtPurchase: access.subscription.priceAtPurchase,
      durationMonthsAtPurchase: access.subscription.durationMonthsAtPurchase,
      renewedAt: access.subscription.renewedAt,
      plan: access.subscription.plan ? {
        id: access.subscription.plan.id,
        name: access.subscription.plan.name,
        code: access.subscription.plan.code,
        durationMonths: access.subscription.plan.durationMonths,
      } : null,
    } : null,
  };
}

/**
 * Creates an atomic subscription renewal.
 *
 * Concurrency & Invariant Guarantees:
 * - Runs inside an isolated Prisma transaction.
 * - Queries the latest existing term inside the transaction.
 * - If current term is valid or future, sets consecutive startsAt = latestTerm.endsAt.
 * - If current term expired or nonexistent, sets startsAt = nowUtc.
 * - Computes endsAt using safe calendar month addition.
 * - Enforces duplicate renewal avoidance if a term for that exact startsAt already exists.
 * - Preserves all prior Subscription rows and updates renewedAt.
 * - Creates an isolated SubscriptionPayment row snapshotting plan price.
 * - Idempotently logs activity.
 *
 * @param {object} params
 * @param {string} params.madrasaId
 * @param {string} params.planId
 * @param {string} [params.paymentMethod='BANK_TRANSFER']
 * @param {string|null} [params.reference=null]
 * @param {string|null} [params.notes=null]
 * @param {string|null} [params.performedByUserId=null]
 * @param {string|null} [params.ipAddress=null]
 * @param {string|null} [params.userAgent=null]
 * @param {Date} [params.nowUtc=new Date()]
 * @returns {Promise<object>} Renewal result with subscription and payment
 */
export async function createSubscriptionRenewal({
  madrasaId,
  planId,
  paymentMethod = 'BANK_TRANSFER',
  reference = null,
  notes = null,
  performedByUserId = null,
  ipAddress = null,
  userAgent = null,
  nowUtc = new Date(),
}) {
  const now = new Date(nowUtc);

  return await prisma.$transaction(async (tx) => {
    // 1. Verify plan exists and is active
    const plan = await tx.plan.findUnique({
      where: { id: planId },
    });

    if (!plan || !plan.isActive) {
      throw new BadRequestError('The selected subscription plan does not exist or is inactive.');
    }

    // 2. Query latest existing subscription term inside transaction
    const latestTerm = await tx.subscription.findFirst({
      where: { madrasaId },
      orderBy: [
        { endsAt: 'desc' },
        { startsAt: 'desc' },
      ],
    });

    // 3. Determine consecutive coverage or immediate start
    let newStartsAt;
    if (latestTerm && latestTerm.endsAt.getTime() > now.getTime()) {
      // Consecutive extension from prior term end
      newStartsAt = new Date(latestTerm.endsAt);
    } else {
      // Immediate new activation from current time
      newStartsAt = now;
    }

    // 4. Concurrency Guard: Check if a renewal starting at this exact time already exists
    const duplicate = await tx.subscription.findFirst({
      where: {
        madrasaId,
        startsAt: newStartsAt,
      },
    });

    if (duplicate) {
      throw new BadRequestError('A subscription renewal starting at this term boundary is already recorded.');
    }

    // 5. Calculate new endsAt using calendar-month arithmetic
    const newEndsAt = addCalendarMonthsUtc(newStartsAt, plan.durationMonths);

    // 6. Create new Subscription record snapshotting plan price and duration
    const newSubscription = await tx.subscription.create({
      data: {
        madrasaId,
        planId: plan.id,
        status: 'ACTIVE',
        startsAt: newStartsAt,
        endsAt: newEndsAt,
        priceAtPurchase: plan.price,
        durationMonthsAtPurchase: plan.durationMonths,
      },
      include: {
        plan: true,
      },
    });

    // 7. Update prior subscription's renewedAt if one existed
    if (latestTerm) {
      await tx.subscription.update({
        where: { id: latestTerm.id },
        data: { renewedAt: now },
      });
    }

    // 8. Create SubscriptionPayment snapshotting payment details
    const payment = await tx.subscriptionPayment.create({
      data: {
        madrasaId,
        subscriptionId: newSubscription.id,
        amount: plan.price,
        paymentMethod,
        reference: reference ? String(reference).trim() : null,
        paidAt: now,
        notes: notes ? String(notes).trim() : null,
      },
    });

    // 9. Record audit activity log inside transaction
    await tx.activityLog.create({
      data: {
        madrasaId,
        userId: performedByUserId ? String(performedByUserId) : null,
        action: 'SUBSCRIPTION_RENEWED',
        entityType: 'Subscription',
        entityId: newSubscription.id,
        metadata: {
          planCode: plan.code,
          startsAt: newStartsAt.toISOString(),
          endsAt: newEndsAt.toISOString(),
          priceAtPurchase: String(plan.price),
          durationMonths: plan.durationMonths,
          paymentId: payment.id,
          previousSubscriptionId: latestTerm ? latestTerm.id : null,
        },
        ipAddress: ipAddress ? String(ipAddress) : null,
        userAgent: userAgent ? String(userAgent) : null,
      },
    });

    return {
      subscription: newSubscription,
      payment,
      previousSubscriptionId: latestTerm ? latestTerm.id : null,
    };
  });
}

/**
 * Hourly synchronization job to update subscription statuses.
 *
 * Rules:
 * - Past terms (endsAt <= nowUtc): ACTIVE or EXPIRING_SOON -> EXPIRED.
 * - Current terms (startsAt <= nowUtc < endsAt):
 *   - If within threshold -> EXPIRING_SOON.
 *   - If outside threshold and was EXPIRING_SOON -> ACTIVE.
 * - Future terms (startsAt > nowUtc): Ignored (never marked EXPIRING_SOON).
 * - Manual states (SUSPENDED / CANCELLED): Strictly preserved.
 * - Activity logs for status transitions are recorded idempotently.
 *
 * @param {Date|string|number} [nowUtc=new Date()]
 * @returns {Promise<object>} Summary of updated records
 */
export async function synchronizeSubscriptionStatuses(nowUtc = new Date()) {
  const now = new Date(nowUtc);
  const thresholdDays = env.SUBSCRIPTION_EXPIRING_SOON_DAYS;

  // Retrieve all non-manual subscriptions
  const subscriptions = await prisma.subscription.findMany({
    where: {
      status: {
        notIn: ['SUSPENDED', 'CANCELLED'],
      },
    },
  });

  let expiredCount = 0;
  let expiringSoonCount = 0;
  let activeCount = 0;

  for (const sub of subscriptions) {
    const endMs = sub.endsAt.getTime();
    const startMs = sub.startsAt.getTime();
    const nowMs = now.getTime();

    // 1. Past terms: endsAt <= nowUtc
    if (endMs <= nowMs) {
      if (sub.status !== 'EXPIRED') {
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { status: 'EXPIRED' },
        });

        // Idempotent activity logging: only log if transition log not already created
        const existingLog = await prisma.activityLog.findFirst({
          where: {
            entityId: sub.id,
            action: 'SUBSCRIPTION_STATUS_EXPIRED',
          },
        });

        if (!existingLog) {
          await prisma.activityLog.create({
            data: {
              madrasaId: sub.madrasaId,
              action: 'SUBSCRIPTION_STATUS_EXPIRED',
              entityType: 'Subscription',
              entityId: sub.id,
              metadata: {
                previousStatus: sub.status,
                newStatus: 'EXPIRED',
                endsAt: sub.endsAt.toISOString(),
              },
            },
          });
        }

        expiredCount++;
      }
      continue;
    }

    // 2. Current terms: startsAt <= nowUtc < endsAt
    if (startMs <= nowMs && endMs > nowMs) {
      const isExpiring = isExpiringSoonPrecise(sub.endsAt, thresholdDays, now);

      if (isExpiring && sub.status !== 'EXPIRING_SOON') {
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { status: 'EXPIRING_SOON' },
        });

        const existingLog = await prisma.activityLog.findFirst({
          where: {
            entityId: sub.id,
            action: 'SUBSCRIPTION_STATUS_EXPIRING_SOON',
          },
        });

        if (!existingLog) {
          await prisma.activityLog.create({
            data: {
              madrasaId: sub.madrasaId,
              action: 'SUBSCRIPTION_STATUS_EXPIRING_SOON',
              entityType: 'Subscription',
              entityId: sub.id,
              metadata: {
                previousStatus: sub.status,
                newStatus: 'EXPIRING_SOON',
                endsAt: sub.endsAt.toISOString(),
              },
            },
          });
        }

        expiringSoonCount++;
      } else if (!isExpiring && sub.status === 'EXPIRING_SOON') {
        // Was marked expiring soon, but threshold changed or term was adjusted
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { status: 'ACTIVE' },
        });
        activeCount++;
      }
      continue;
    }

    // 3. Future terms: startsAt > nowUtc
    // Leave untouched; future terms must never be marked EXPIRING_SOON
  }

  return {
    expiredCount,
    expiringSoonCount,
    activeCount,
    timestamp: now.toISOString(),
  };
}
