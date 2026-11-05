import { z } from 'zod';
import * as classService from '../services/class.service.js';
import {
  createClassSchema,
  updateClassSchema,
  listClassesQuerySchema,
} from '../validations/class.validation.js';

export async function listClasses(req, res, next) {
  try {
    const query = listClassesQuerySchema.parse(req.query);
    const data = await classService.listClasses(req.tenant.madrasaId, query);

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

export async function getClass(req, res, next) {
  try {
    const data = await classService.getClassById(req.tenant.madrasaId, req.params.id);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function createClass(req, res, next) {
  try {
    const validated = createClassSchema.parse(req.body);
    const data = await classService.createClass(req.tenant.madrasaId, validated, req.auth.userId);

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

export async function updateClass(req, res, next) {
  try {
    const validated = updateClassSchema.parse(req.body);
    const data = await classService.updateClass(req.tenant.madrasaId, req.params.id, validated, req.auth.userId);

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

export async function activateClass(req, res, next) {
  try {
    const data = await classService.activateClass(req.tenant.madrasaId, req.params.id, req.auth.userId);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function deactivateClass(req, res, next) {
  try {
    const data = await classService.deactivateClass(req.tenant.madrasaId, req.params.id, req.auth.userId);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}
