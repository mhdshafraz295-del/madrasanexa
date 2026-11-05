import { prisma } from '../lib/prisma.js';
import { evaluateEffectiveSubscription } from './subscription.service.js';

/**
 * Feature keys belonging to the Admissions & Interview Management module.
 * Based on canonical feature-catalogue.js (Category 6).
 */
const INTERVIEW_GRANULAR_KEYS = Object.freeze([
  'INTERVIEW_BULK_SCHEDULING',
  'INTERVIEW_ROUNDS_WORKFLOW',
  'INTERVIEW_EVALUATION',
  'INTERVIEW_PDF_INVITATIONS',
  'INTERVIEW_EMAIL_DISPATCH',
]);

/**
 * Resolves feature entitlement for a given Madrasa and feature key at a specified UTC time.
 *
 * Strict Evaluation Order:
 * 1. Validate inputs (madrasaId and featureKey required).
 * 2. Verify Madrasa exists and is ACTIVE.
 * 3. Evaluate effective subscription lifecycle via evaluateEffectiveSubscription().
 * 4. Verify subscription allows access (startsAt <= nowUtc < endsAt, not suspended/cancelled/expired).
 * 5. Check active MadrasaFeatureOverride:
 *    - DENY overrides always win and take precedence over everything.
 *    - GRANT overrides permit access if Madrasa and subscription are active.
 *    - Expired or future overrides are ignored and fall back to plan features.
 * 6. Evaluate PlanFeature on the active subscription's plan:
 *    - Must have matching featureKey with isEnabled === true.
 * 7. Fail closed: Any missing record, disabled feature, or resolution error denies access.
 *
 * @param {string} madrasaId - Unique tenant Madrasa identifier
 * @param {string} featureKey - Feature key to evaluate (e.g. 'ADMISSIONS_INTERVIEW')
 * @param {Date|string|number} [nowUtc=new Date()] - Evaluation timestamp in UTC
 * @returns {Promise<{ allowed: boolean, code: string, reason: string, source: string|null }>}
 */
export async function resolveFeatureEntitlement(madrasaId, featureKey, nowUtc = new Date()) {
  try {
    // 1. Validate input parameters
    if (!madrasaId || typeof madrasaId !== 'string' || madrasaId.trim() === '') {
      return {
        allowed: false,
        code: 'ENTITLEMENT_RESOLUTION_ERROR',
        reason: 'Invalid or missing madrasaId for feature entitlement check.',
        source: null,
      };
    }

    if (!featureKey || typeof featureKey !== 'string' || featureKey.trim() === '') {
      return {
        allowed: false,
        code: 'ENTITLEMENT_RESOLUTION_ERROR',
        reason: 'Invalid or missing featureKey for feature entitlement check.',
        source: null,
      };
    }

    const normalizedKey = featureKey.trim();
    const now = new Date(nowUtc);
    if (isNaN(now.getTime())) {
      return {
        allowed: false,
        code: 'ENTITLEMENT_RESOLUTION_ERROR',
        reason: 'Invalid timestamp supplied for feature entitlement check.',
        source: null,
      };
    }

    // Determine relevant override keys (primary + umbrella mappings)
    const relevantKeys = [normalizedKey];
    if (normalizedKey === 'ADMISSIONS_INTERVIEW') {
      relevantKeys.push(...INTERVIEW_GRANULAR_KEYS);
    } else if (INTERVIEW_GRANULAR_KEYS.includes(normalizedKey)) {
      relevantKeys.push('ADMISSIONS_INTERVIEW');
    }

    // 2. Query Madrasa, subscriptions (with plan features), and overrides in single round-trip
    const madrasa = await prisma.madrasa.findUnique({
      where: { id: madrasaId },
      select: {
        id: true,
        status: true,
        subscriptions: {
          include: {
            plan: {
              include: {
                planFeatures: true,
              },
            },
          },
          orderBy: [
            { endsAt: 'desc' },
            { startsAt: 'desc' },
          ],
        },
        featureOverrides: {
          where: {
            featureKey: { in: relevantKeys },
          },
        },
      },
    });

    if (!madrasa) {
      return {
        allowed: false,
        code: 'INSTITUTION_INACTIVE',
        reason: 'Institution workspace not found.',
        source: null,
      };
    }

    // 3. Institution Status Gate
    if (madrasa.status !== 'ACTIVE') {
      return {
        allowed: false,
        code: 'INSTITUTION_INACTIVE',
        reason: `Institution status is ${madrasa.status}. Access restricted.`,
        source: null,
      };
    }

    // 4. Subscription Lifecycle Gate (reusing canonical evaluator)
    const subscriptionAccess = evaluateEffectiveSubscription(madrasa.subscriptions, now);
    if (!subscriptionAccess.allowed) {
      return {
        allowed: false,
        code: subscriptionAccess.code || 'SUBSCRIPTION_REQUIRED',
        reason: subscriptionAccess.reason || 'Active subscription required.',
        source: null,
      };
    }

    const activeSubscription = subscriptionAccess.subscription;

    // 5. Active Feature Overrides Evaluation
    // Filter overrides strictly valid at now: startsAt <= now AND (expiresAt IS NULL OR expiresAt > now)
    const activeOverrides = (madrasa.featureOverrides || []).filter((ov) => {
      const startsAt = new Date(ov.startsAt);
      if (startsAt.getTime() > now.getTime()) return false;
      if (ov.expiresAt) {
        const expiresAt = new Date(ov.expiresAt);
        if (expiresAt.getTime() <= now.getTime()) return false;
      }
      return true;
    });

    // Defensive conflict resolution: ANY active DENY override unconditionally wins
    // Check direct DENY or umbrella DENY
    const hasDenyOverride = activeOverrides.some((ov) => {
      if (ov.overrideType !== 'DENY') return false;
      // An exact key DENY always matches
      if (ov.featureKey === normalizedKey) return true;
      // An umbrella DENY applies to its children
      if (ov.featureKey === 'ADMISSIONS_INTERVIEW' && INTERVIEW_GRANULAR_KEYS.includes(normalizedKey)) return true;
      // If evaluating umbrella ADMISSIONS_INTERVIEW, any child DENY or parent DENY blocks
      if (normalizedKey === 'ADMISSIONS_INTERVIEW' && (ov.featureKey === 'ADMISSIONS_INTERVIEW' || INTERVIEW_GRANULAR_KEYS.includes(ov.featureKey))) return true;
      return false;
    });

    if (hasDenyOverride) {
      return {
        allowed: false,
        code: 'FEATURE_OVERRIDE_DENIED',
        reason: `Access to feature "${normalizedKey}" has been administratively disabled for this institution.`,
        source: 'OVERRIDE',
      };
    }

    // Check active GRANT override
    const hasGrantOverride = activeOverrides.some((ov) => {
      if (ov.overrideType !== 'GRANT') return false;
      if (ov.featureKey === normalizedKey) return true;
      if (normalizedKey === 'ADMISSIONS_INTERVIEW' && (ov.featureKey === 'ADMISSIONS_INTERVIEW' || INTERVIEW_GRANULAR_KEYS.includes(ov.featureKey))) return true;
      if (ov.featureKey === 'ADMISSIONS_INTERVIEW' && INTERVIEW_GRANULAR_KEYS.includes(normalizedKey)) return true;
      return false;
    });

    if (hasGrantOverride) {
      return {
        allowed: true,
        code: 'FEATURE_OVERRIDE_GRANTED',
        reason: `Feature "${normalizedKey}" granted via institutional override.`,
        source: 'OVERRIDE',
      };
    }

    // 6. PlanFeature Entitlement Evaluation
    const planFeatures = activeSubscription?.plan?.planFeatures || [];

    const hasPlanFeature = planFeatures.some((pf) => {
      if (!pf.isEnabled) return false;
      if (pf.featureKey === normalizedKey) return true;
      // If evaluating umbrella key, check if umbrella or any granular key is enabled on the plan
      if (normalizedKey === 'ADMISSIONS_INTERVIEW' && (pf.featureKey === 'ADMISSIONS_INTERVIEW' || INTERVIEW_GRANULAR_KEYS.includes(pf.featureKey))) {
        return true;
      }
      // If evaluating granular key, check if umbrella is enabled on the plan
      if (INTERVIEW_GRANULAR_KEYS.includes(normalizedKey) && pf.featureKey === 'ADMISSIONS_INTERVIEW') {
        return true;
      }
      return false;
    });

    if (hasPlanFeature) {
      return {
        allowed: true,
        code: 'FEATURE_PLAN_ENABLED',
        reason: `Feature "${normalizedKey}" is enabled in current subscription plan.`,
        source: 'PLAN',
      };
    }

    // 7. Feature Missing or Disabled on Plan
    return {
      allowed: false,
      code: 'FEATURE_NOT_IN_PLAN',
      reason: `Feature "${normalizedKey}" is not included in current subscription plan.`,
      source: null,
    };
  } catch (error) {
    console.error(`[Error] resolveFeatureEntitlement failed for madrasaId=${madrasaId}, featureKey=${featureKey}:`, error);
    return {
      allowed: false,
      code: 'ENTITLEMENT_RESOLUTION_ERROR',
      reason: 'Failed to resolve feature entitlement due to internal error.',
      source: null,
    };
  }
}
