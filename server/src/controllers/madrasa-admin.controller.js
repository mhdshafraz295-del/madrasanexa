import { z } from 'zod';
import * as madrasaAdminService from '../services/madrasa-admin.service.js';
import {
  dashboardQuerySchema,
  updateSettingsSchema,
  updateAdminProfileSchema,
  activityQuerySchema,
} from '../validations/madrasa-admin.validation.js';

/**
 * Controller: GET /api/madrasa-admin/dashboard
 */
export async function getDashboard(req, res, next) {
  try {
    const { range } = dashboardQuerySchema.parse(req.query);
    const data = await madrasaAdminService.getDashboardSummary(req.tenant.madrasaId, range);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: error.issues?.[0]?.message || error.errors?.[0]?.message || 'Validation error.',
        errors: error.issues || error.errors,
      });
    }
    next(error);
  }
}

/**
 * Controller: GET /api/madrasa-admin/settings
 */
export async function getSettings(req, res, next) {
  try {
    const data = await madrasaAdminService.getMadrasaSettings(req.tenant.madrasaId);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Controller: PATCH /api/madrasa-admin/settings
 */
export async function updateSettings(req, res, next) {
  try {
    const validated = updateSettingsSchema.parse(req.body);
    const ipAddress = req.ip || req.connection?.remoteAddress || null;
    const userAgent = req.get('user-agent') || null;

    const data = await madrasaAdminService.updateMadrasaSettings(
      req.tenant.madrasaId,
      validated,
      req.auth?.userId || null,
      ipAddress,
      userAgent
    );

    return res.status(200).json({
      success: true,
      message: 'Institutional settings updated successfully.',
      data,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: error.issues?.[0]?.message || error.errors?.[0]?.message || 'Validation error.',
        errors: error.issues || error.errors,
      });
    }
    next(error);
  }
}

/**
 * Controller: GET /api/madrasa-admin/profile
 */
export async function getProfile(req, res, next) {
  try {
    const data = await madrasaAdminService.getAdminProfile(
      req.auth.userId,
      req.tenant.madrasaId
    );

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Controller: PATCH /api/madrasa-admin/profile
 */
export async function updateProfile(req, res, next) {
  try {
    const validated = updateAdminProfileSchema.parse(req.body);
    const ipAddress = req.ip || req.connection?.remoteAddress || null;
    const userAgent = req.get('user-agent') || null;

    const data = await madrasaAdminService.updateAdminProfile(
      req.auth.userId,
      req.tenant.madrasaId,
      validated,
      ipAddress,
      userAgent
    );

    return res.status(200).json({
      success: true,
      message: 'Administrator profile updated successfully.',
      data,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: error.issues?.[0]?.message || error.errors?.[0]?.message || 'Validation error.',
        errors: error.issues || error.errors,
      });
    }
    next(error);
  }
}

/**
 * Controller: GET /api/madrasa-admin/activity
 */
export async function getActivity(req, res, next) {
  try {
    const { page, pageSize, action } = activityQuerySchema.parse(req.query);
    const data = await madrasaAdminService.getTenantActivity(
      req.tenant.madrasaId,
      page,
      pageSize,
      action
    );

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: error.issues?.[0]?.message || error.errors?.[0]?.message || 'Validation error.',
        errors: error.issues || error.errors,
      });
    }
    next(error);
  }
}

/**
 * Controller: GET /api/madrasa-admin/subscription
 * (Exempt from requireActiveSubscription per Correction 1)
 */
export async function getSubscription(req, res, next) {
  try {
    const data = await madrasaAdminService.getSubscriptionOverview(req.tenant.madrasaId);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}
