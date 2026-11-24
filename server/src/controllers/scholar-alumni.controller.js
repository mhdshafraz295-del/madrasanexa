import * as scholarAlumniService from '../services/scholar-alumni.service.js';
import {
  publicSubmitScholarSchema,
  adminCreateScholarSchema,
  adminUpdateScholarSchema,
  updateScholarStatusSchema,
  toggleWebsiteVisibilitySchema,
} from '../validations/scholar-alumni.validation.js';
import { ForbiddenError } from '../utils/errors.js';

/**
 * Extracts and strictly validates the tenant madrasa context.
 * Guaranteed to return a non-empty string madrasaId, or throws ForbiddenError (403).
 */
function getTenantMadrasaId(req) {
  const madrasaId =
    req.tenant?.madrasaId ||
    req.tenant?.id ||
    req.auth?.madrasaId ||
    req.user?.madrasaId ||
    req.teacher?.madrasaId;

  if (!madrasaId || typeof madrasaId !== 'string' || !madrasaId.trim()) {
    throw new ForbiddenError('Tenant madrasa context is missing or unauthorized.');
  }

  return madrasaId.trim();
}

export async function getPublicAlumniList(req, res, next) {
  try {
    const { madrasaCode } = req.params;
    const result = await scholarAlumniService.getPublicAlumniForMadrasa(madrasaCode);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function submitPublicAlumniProfile(req, res, next) {
  try {
    const { madrasaCode } = req.params;
    const validated = publicSubmitScholarSchema.parse(req.body);
    const created = await scholarAlumniService.submitPublicAlumni(madrasaCode, validated);
    return res.status(201).json({
      success: true,
      message: 'Your profile has been submitted successfully for verification.',
      data: created,
    });
  } catch (error) {
    next(error);
  }
}

export async function getAdminAlumniHub(req, res, next) {
  try {
    const madrasaId = getTenantMadrasaId(req);
    const result = await scholarAlumniService.getMadrasaAdminAlumniHub(madrasaId, req.query);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function toggleWebsiteVisibility(req, res, next) {
  try {
    const madrasaId = getTenantMadrasaId(req);
    const validated = toggleWebsiteVisibilitySchema.parse(req.body);
    const result = await scholarAlumniService.toggleWebsiteVisibility(
      madrasaId,
      validated.showAlumniOnWebsite
    );
    return res.status(200).json({
      success: true,
      message: `Alumni & Scholars section is now ${validated.showAlumniOnWebsite ? 'visible on' : 'hidden from'} your public website.`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function createAdminScholar(req, res, next) {
  try {
    const madrasaId = getTenantMadrasaId(req);
    const userId = req.auth?.userId || req.user?.id || null;
    const validated = adminCreateScholarSchema.parse(req.body);
    const created = await scholarAlumniService.adminCreateScholar(madrasaId, validated, userId);
    return res.status(201).json({
      success: true,
      message: 'Scholar profile created successfully.',
      data: created,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateAdminScholar(req, res, next) {
  try {
    const madrasaId = getTenantMadrasaId(req);
    const { id } = req.params;
    const validated = adminUpdateScholarSchema.parse(req.body);
    const updated = await scholarAlumniService.adminUpdateScholar(madrasaId, id, validated);
    return res.status(200).json({
      success: true,
      message: 'Scholar profile updated successfully.',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateAdminScholarStatus(req, res, next) {
  try {
    const madrasaId = getTenantMadrasaId(req);
    const userId = req.auth?.userId || req.user?.id || null;
    const { id } = req.params;
    const validated = updateScholarStatusSchema.parse(req.body);
    const updated = await scholarAlumniService.adminUpdateScholarStatus(
      madrasaId,
      id,
      validated,
      userId
    );
    return res.status(200).json({
      success: true,
      message: 'Status updated successfully.',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteAdminScholar(req, res, next) {
  try {
    const madrasaId = getTenantMadrasaId(req);
    const { id } = req.params;
    const result = await scholarAlumniService.adminDeleteScholar(madrasaId, id);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getTeacherAlumniList(req, res, next) {
  try {
    const madrasaId = getTenantMadrasaId(req);
    const alumni = await scholarAlumniService.getTeacherAlumni(madrasaId);
    return res.status(200).json({
      success: true,
      data: alumni,
    });
  } catch (error) {
    next(error);
  }
}
