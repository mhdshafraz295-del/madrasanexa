import * as superAdminService from '../services/super-admin.service.js';
import {
  approveOnboardingSchema,
  rejectOnboardingSchema,
  updateMadrasaSchema,
  createPlanSchema,
  updatePlanSchema,
  updatePlanFeaturesSchema,
  renewSubscriptionSchema,
  adminPasswordResetSchema,
  listMadrasasQuerySchema,
  updateMadrasaStatusSchema,
  listPlansQuerySchema,
  planComparisonQuerySchema,
  dashboardQuerySchema,
} from '../validations/super-admin.validation.js';
import { z } from 'zod';

// ==========================================
// 1. DASHBOARD
// ==========================================

export const getDashboard = async (req, res, next) => {
  try {
    const { period } = dashboardQuerySchema.parse(req.query);
    const data = await superAdminService.getPlatformDashboardMetrics({ period });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 2. ONBOARDING
// ==========================================

export const listOnboardings = async (req, res, next) => {
  try {
    const { status, search, page, pageSize } = req.query;
    const result = await superAdminService.listOnboardingRequests({ status, search, page, pageSize });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getOnboardingById = async (req, res, next) => {
  try {
    const result = await superAdminService.getOnboardingRequestById(req.params.id);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const approveOnboarding = async (req, res, next) => {
  try {
    const validated = approveOnboardingSchema.parse(req.body);
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent');

    const result = await superAdminService.approveOnboardingRequest({
      requestId: req.params.id,
      reviewedByUserId: req.auth.userId,
      ...validated,
      ipAddress,
      userAgent,
    });

    return res.status(200).json({
      success: true,
      message: 'Onboarding request approved and Madrasa workspace provisioned.',
      data: result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const msg = error.issues?.[0]?.message || error.errors?.[0]?.message || 'Validation error.';
      return res.status(400).json({
        success: false,
        message: msg,
        errors: error.issues || error.errors,
      });
    }
    next(error);
  }
};

export const rejectOnboarding = async (req, res, next) => {
  try {
    const validated = rejectOnboardingSchema.parse(req.body);
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent');

    const result = await superAdminService.rejectOnboardingRequest({
      requestId: req.params.id,
      reviewedByUserId: req.auth.userId,
      rejectionReason: validated.rejectionReason,
      ipAddress,
      userAgent,
    });

    return res.status(200).json({
      success: true,
      message: 'Onboarding request rejected.',
      data: result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const msg = error.issues?.[0]?.message || error.errors?.[0]?.message || 'Validation error.';
      return res.status(400).json({
        success: false,
        message: msg,
        errors: error.issues || error.errors,
      });
    }
    next(error);
  }
};

export const resendOnboardingApprovalEmail = async (req, res, next) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent');

    const result = await superAdminService.resendApprovalEmail({
      requestId: req.params.id,
      reviewedByUserId: req.auth.userId,
      ipAddress,
      userAgent,
    });

    return res.status(200).json({
      success: true,
      message: result.emailDelivery?.status === 'SENT'
        ? 'Approval email resent successfully.'
        : 'Approval email delivery attempted.',
      data: result,
    });
  } catch (error) {
    if (error.statusCode === 429) {
      return res.status(429).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

// ==========================================
// 3. MADRASAS
// ==========================================

export const listMadrasas = async (req, res, next) => {
  try {
    const validated = listMadrasasQuerySchema.parse(req.query);
    const result = await superAdminService.listMadrasas(validated);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const msg = error.issues?.[0]?.message || error.errors?.[0]?.message || 'Validation error.';
      return res.status(400).json({ success: false, message: msg });
    }
    next(error);
  }
};

export const getMadrasa = async (req, res, next) => {
  try {
    const result = await superAdminService.getMadrasaDetails(req.params.id);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const updateMadrasa = async (req, res, next) => {
  try {
    const validated = updateMadrasaSchema.parse(req.body);
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent');

    const result = await superAdminService.updateMadrasa(
      req.params.id,
      validated,
      req.auth.userId,
      ipAddress,
      userAgent
    );

    return res.status(200).json({ success: true, message: 'Madrasa updated.', data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const msg = error.issues?.[0]?.message || error.errors?.[0]?.message || 'Validation error.';
      return res.status(400).json({ success: false, message: msg });
    }
    next(error);
  }
};

export const updateMadrasaStatus = async (req, res, next) => {
  try {
    const validated = updateMadrasaStatusSchema.parse(req.body);
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent');
    const result = await superAdminService.setMadrasaStatus(
      req.params.id,
      validated.status,
      req.auth.userId,
      ipAddress,
      userAgent
    );
    return res.status(200).json({
      success: true,
      message: `Madrasa status updated to ${validated.status}.`,
      data: result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const msg = error.issues?.[0]?.message || error.errors?.[0]?.message || 'Validation error.';
      return res.status(400).json({ success: false, message: msg });
    }
    next(error);
  }
};

export const activateMadrasa = async (req, res, next) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent');
    const result = await superAdminService.setMadrasaStatus(req.params.id, 'ACTIVE', req.auth.userId, ipAddress, userAgent);
    return res.status(200).json({ success: true, message: 'Madrasa activated.', data: result });
  } catch (error) {
    next(error);
  }
};

export const suspendMadrasa = async (req, res, next) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent');
    const result = await superAdminService.setMadrasaStatus(req.params.id, 'SUSPENDED', req.auth.userId, ipAddress, userAgent);
    return res.status(200).json({ success: true, message: 'Madrasa suspended.', data: result });
  } catch (error) {
    next(error);
  }
};

export const archiveMadrasa = async (req, res, next) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent');
    const result = await superAdminService.setMadrasaStatus(req.params.id, 'ARCHIVED', req.auth.userId, ipAddress, userAgent);
    return res.status(200).json({ success: true, message: 'Madrasa archived.', data: result });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 4. MADRASA ADMIN
// ==========================================

export const resetMadrasaAdminPassword = async (req, res, next) => {
  try {
    const validated = adminPasswordResetSchema.parse(req.body);
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent');

    const result = await superAdminService.resetMadrasaAdminPassword(
      req.params.madrasaId,
      req.params.adminUserId,
      validated.temporaryPassword,
      req.auth.userId,
      ipAddress,
      userAgent
    );

    return res.status(200).json({
      success: true,
      message: 'Admin password reset successfully.',
      data: result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const msg = error.issues?.[0]?.message || error.errors?.[0]?.message || 'Validation error.';
      return res.status(400).json({ success: false, message: msg });
    }
    next(error);
  }
};

export const toggleMadrasaAdminActive = async (req, res, next) => {
  try {
    const { isActive } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent');

    const result = await superAdminService.toggleMadrasaAdminActive(
      req.params.madrasaId,
      req.params.adminUserId,
      isActive,
      req.auth.userId,
      ipAddress,
      userAgent
    );

    return res.status(200).json({
      success: true,
      message: `Admin account ${isActive ? 'activated' : 'deactivated'}.`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 5. PLANS
// ==========================================
// 5. PLANS & FEATURE MANAGEMENT
// ==========================================

export const getFeatureCatalogue = async (req, res, next) => {
  try {
    const data = await superAdminService.getFeatureCatalogue();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getPlanComparison = async (req, res, next) => {
  try {
    const query = planComparisonQuerySchema.parse(req.query);
    const data = await superAdminService.getPlanComparison(query);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const msg = error.issues?.[0]?.message || error.errors?.[0]?.message || 'Validation error.';
      return res.status(400).json({ success: false, message: msg });
    }
    next(error);
  }
};

export const listPlans = async (req, res, next) => {
  try {
    const query = listPlansQuerySchema.parse(req.query);
    const result = await superAdminService.listPlans(query);
    return res.status(200).json({ success: true, data: result.plans, kpis: result.kpis });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const msg = error.issues?.[0]?.message || error.errors?.[0]?.message || 'Validation error.';
      return res.status(400).json({ success: false, message: msg });
    }
    next(error);
  }
};

export const getPlan = async (req, res, next) => {
  try {
    const plan = await superAdminService.getPlanDetails(req.params.id);
    return res.status(200).json({ success: true, data: plan });
  } catch (error) {
    next(error);
  }
};

export const createPlan = async (req, res, next) => {
  try {
    const validated = createPlanSchema.parse(req.body);
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent');

    const plan = await superAdminService.createPlan(validated, req.auth.userId, ipAddress, userAgent);
    return res.status(201).json({ success: true, message: 'Plan created.', data: plan });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const msg = error.issues?.[0]?.message || error.errors?.[0]?.message || 'Validation error.';
      return res.status(400).json({ success: false, message: msg });
    }
    next(error);
  }
};

export const updatePlan = async (req, res, next) => {
  try {
    const validated = updatePlanSchema.parse(req.body);
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent');

    const plan = await superAdminService.updatePlan(req.params.id, validated, req.auth.userId, ipAddress, userAgent);
    return res.status(200).json({ success: true, message: 'Plan updated.', data: plan });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const msg = error.issues?.[0]?.message || error.errors?.[0]?.message || 'Validation error.';
      return res.status(400).json({ success: false, message: msg });
    }
    next(error);
  }
};

export const updatePlanFeatures = async (req, res, next) => {
  try {
    const validated = updatePlanFeaturesSchema.parse(req.body);
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent');

    const result = await superAdminService.updatePlanFeatures(
      req.params.id,
      validated.featureKeys,
      req.auth.userId,
      ipAddress,
      userAgent
    );
    return res.status(200).json({
      success: true,
      message: result.isNoOp ? 'No feature changes detected.' : 'Plan features updated successfully.',
      data: result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const msg = error.issues?.[0]?.message || error.errors?.[0]?.message || 'Validation error.';
      return res.status(400).json({ success: false, message: msg });
    }
    next(error);
  }
};

export const activatePlan = async (req, res, next) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent');
    const plan = await superAdminService.togglePlanActive(req.params.id, true, req.auth.userId, ipAddress, userAgent);
    return res.status(200).json({ success: true, message: 'Plan activated.', data: plan });
  } catch (error) {
    next(error);
  }
};

export const deactivatePlan = async (req, res, next) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent');
    const plan = await superAdminService.togglePlanActive(req.params.id, false, req.auth.userId, ipAddress, userAgent);
    return res.status(200).json({ success: true, message: 'Plan deactivated.', data: plan });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 6. SUBSCRIPTIONS
// ==========================================

export const getMadrasaSubscriptions = async (req, res, next) => {
  try {
    const result = await superAdminService.getMadrasaSubscriptionHistory(req.params.madrasaId);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const renewMadrasaSubscription = async (req, res, next) => {
  try {
    const validated = renewSubscriptionSchema.parse(req.body);
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent');

    const result = await superAdminService.renewSubscriptionForMadrasa({
      madrasaId: req.params.madrasaId,
      ...validated,
      performedByUserId: req.auth.userId,
      ipAddress,
      userAgent,
    });

    return res.status(200).json({
      success: true,
      message: 'Subscription renewed successfully.',
      data: result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const msg = error.issues?.[0]?.message || error.errors?.[0]?.message || 'Validation error.';
      return res.status(400).json({ success: false, message: msg });
    }
    next(error);
  }
};

export const suspendSubscription = async (req, res, next) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent');
    const result = await superAdminService.setSubscriptionManualStatus(req.params.id, 'SUSPENDED', req.auth.userId, ipAddress, userAgent);
    return res.status(200).json({ success: true, message: 'Subscription suspended.', data: result });
  } catch (error) {
    next(error);
  }
};

export const cancelSubscription = async (req, res, next) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent');
    const result = await superAdminService.setSubscriptionManualStatus(req.params.id, 'CANCELLED', req.auth.userId, ipAddress, userAgent);
    return res.status(200).json({ success: true, message: 'Subscription cancelled.', data: result });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 7. ACTIVITY LOGS
// ==========================================

export const listActivityLogs = async (req, res, next) => {
  try {
    const { page, pageSize, action, madrasaId } = req.query;
    const result = await superAdminService.listPlatformActivityLogs({ page, pageSize, action, madrasaId });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};
