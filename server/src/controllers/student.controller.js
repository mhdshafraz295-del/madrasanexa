import { z } from 'zod';
import * as studentService from '../services/student.service.js';
import * as feeService from '../services/student-fee.service.js';
import {
  createStudentSchema,
  updateStudentSchema,
  listStudentsQuerySchema,
  setFeeOverrideSchema,
  useClassDefaultFeeSchema,
} from '../validations/student.validation.js';

export async function listStudents(req, res, next) {
  try {
    const query = listStudentsQuerySchema.parse(req.query);
    const data = await studentService.listStudents(req.tenant.madrasaId, query);

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

export async function getStudent(req, res, next) {
  try {
    const data = await studentService.getStudentById(req.tenant.madrasaId, req.params.id);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function createStudent(req, res, next) {
  try {
    const validated = createStudentSchema.parse(req.body);
    const data = await studentService.createStudent(req.tenant.madrasaId, validated, req.auth.userId);

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

export async function updateStudent(req, res, next) {
  try {
    const validated = updateStudentSchema.parse(req.body);
    const data = await studentService.updateStudent(req.tenant.madrasaId, req.params.id, validated, req.auth.userId);

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

export async function activateStudent(req, res, next) {
  try {
    const data = await studentService.updateStudentStatus(req.tenant.madrasaId, req.params.id, 'ACTIVE', req.auth.userId);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function inactivateStudent(req, res, next) {
  try {
    const data = await studentService.updateStudentStatus(req.tenant.madrasaId, req.params.id, 'INACTIVE', req.auth.userId);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function archiveStudent(req, res, next) {
  try {
    const data = await studentService.updateStudentStatus(req.tenant.madrasaId, req.params.id, 'ARCHIVED', req.auth.userId);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function getFeeHistory(req, res, next) {
  try {
    const data = await feeService.getStudentFeeHistory(req.params.id, req.tenant.madrasaId);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function setFeeOverride(req, res, next) {
  try {
    const validated = setFeeOverrideSchema.parse(req.body);
    const data = await feeService.setStudentFeeOverride(req.params.id, req.tenant.madrasaId, validated, req.auth.userId);

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

export async function useClassDefault(req, res, next) {
  try {
    const validated = useClassDefaultFeeSchema.parse(req.body || {});
    const data = await feeService.useClassDefaultFee(req.params.id, req.tenant.madrasaId, validated, req.auth.userId);

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
