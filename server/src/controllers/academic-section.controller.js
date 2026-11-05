import { z } from 'zod';
import * as sectionService from '../services/academic-section.service.js';
import {
  createAcademicSectionSchema,
  updateAcademicSectionSchema,
  listAcademicSectionsQuerySchema,
} from '../validations/academic-section.validation.js';

export async function listSections(req, res, next) {
  try {
    const query = listAcademicSectionsQuerySchema.parse(req.query);
    const data = await sectionService.listAcademicSections(req.tenant.madrasaId, query);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: error.issues?.[0]?.message || 'Validation error.',
        errors: error.issues,
      });
    }
    next(error);
  }
}

export async function getSection(req, res, next) {
  try {
    const data = await sectionService.getAcademicSectionById(req.tenant.madrasaId, req.params.id);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function createSection(req, res, next) {
  try {
    const validated = createAcademicSectionSchema.parse(req.body);
    const data = await sectionService.createAcademicSection(req.tenant.madrasaId, validated, req.auth.userId);

    return res.status(201).json({
      success: true,
      data,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: error.issues?.[0]?.message || 'Validation error.',
        errors: error.issues,
      });
    }
    next(error);
  }
}

export async function updateSection(req, res, next) {
  try {
    const validated = updateAcademicSectionSchema.parse(req.body);
    const data = await sectionService.updateAcademicSection(req.tenant.madrasaId, req.params.id, validated, req.auth.userId);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: error.issues?.[0]?.message || 'Validation error.',
        errors: error.issues,
      });
    }
    next(error);
  }
}

export async function activateSection(req, res, next) {
  try {
    const data = await sectionService.activateAcademicSection(req.tenant.madrasaId, req.params.id, req.auth.userId);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function deactivateSection(req, res, next) {
  try {
    const data = await sectionService.deactivateAcademicSection(req.tenant.madrasaId, req.params.id, req.auth.userId);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}
