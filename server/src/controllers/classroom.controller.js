import * as classroomService from '../services/classroom.service.js';
import {
  createClassroomSchema,
  updateClassroomSchema,
  listClassroomsQuerySchema,
} from '../validations/classroom.validation.js';

export async function listClassrooms(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const query = listClassroomsQuerySchema.parse(req.query);
    const data = await classroomService.listClassrooms(madrasaId, query);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getClassroom(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const { id } = req.params;
    const data = await classroomService.getClassroomById(madrasaId, id);
    res.json({ success: true, data: { ...data, classroom: data } });
  } catch (err) {
    next(err);
  }
}

export async function createClassroom(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const adminUserId = req.auth?.userId || req.user?.id;
    const validated = createClassroomSchema.parse(req.body);
    const data = await classroomService.createClassroom(madrasaId, adminUserId, validated);
    res.status(201).json({ success: true, message: 'Classroom created successfully.', data: { ...data, classroom: data } });
  } catch (err) {
    next(err);
  }
}

export async function updateClassroom(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const adminUserId = req.auth?.userId || req.user?.id;
    const { id } = req.params;
    const validated = updateClassroomSchema.parse(req.body);
    const data = await classroomService.updateClassroom(madrasaId, id, adminUserId, validated);
    res.json({ success: true, message: 'Classroom updated successfully.', data: { ...data, classroom: data } });
  } catch (err) {
    next(err);
  }
}

export async function regenerateClassroomQr(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const adminUserId = req.auth?.userId || req.user?.id;
    const { id } = req.params;
    const data = await classroomService.regenerateClassroomQr(madrasaId, id, adminUserId);
    res.json({ success: true, message: data.message, data: { ...data, classroom: data } });
  } catch (err) {
    next(err);
  }
}

export async function revokeClassroomQr(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const adminUserId = req.auth?.userId || req.user?.id;
    const { id } = req.params;
    const data = await classroomService.revokeClassroomQr(madrasaId, id, adminUserId);
    res.json({ success: true, message: data.message, data: { ...data, classroom: data } });
  } catch (err) {
    next(err);
  }
}

export async function activateClassroom(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const adminUserId = req.auth?.userId || req.user?.id;
    const { id } = req.params;
    const data = await classroomService.activateClassroom(madrasaId, id, adminUserId);
    res.json({ success: true, message: data.message, data: { ...data, classroom: data } });
  } catch (err) {
    next(err);
  }
}

export async function getClassroomQrPrintData(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const { id } = req.params;
    const data = await classroomService.getClassroomQrPrintData(madrasaId, id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
