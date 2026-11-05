import { z } from 'zod';

const WEEKDAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

export const createBreakSchema = z.object({
  classId: z.string({ required_error: 'Class is required.' }).min(1, 'Class is required.'),
  name: z.string({ required_error: 'Break name is required.' }).min(1, 'Break name is required.').max(100),
  dayOfWeek: z.enum(WEEKDAYS, { required_error: 'Teaching day is required.' }),
  startMinutes: z.coerce.number().int().min(0).max(1439),
  endMinutes: z.coerce.number().int().min(1).max(1440),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Effective From must be in YYYY-MM-DD format.'),
  effectiveTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Effective Until must be in YYYY-MM-DD format.').nullable().optional(),
}).refine(data => data.endMinutes > data.startMinutes, {
  message: 'End time must be after start time.',
  path: ['endMinutes'],
}).refine(data => {
  if (data.effectiveTo) {
    return new Date(data.effectiveTo).getTime() >= new Date(data.effectiveFrom).getTime();
  }
  return true;
}, {
  message: 'Effective Until must be on or after Effective From.',
  path: ['effectiveTo'],
});

export const updateBreakSchema = z.object({
  classId: z.string().min(1).optional(),
  name: z.string().min(1).max(100).optional(),
  dayOfWeek: z.enum(WEEKDAYS).optional(),
  startMinutes: z.coerce.number().int().min(0).max(1439).optional(),
  endMinutes: z.coerce.number().int().min(1).max(1440).optional(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Effective From must be in YYYY-MM-DD format.').optional(),
  effectiveTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Effective Until must be in YYYY-MM-DD format.').nullable().optional(),
  isActive: z.boolean().optional(),
}).refine(data => {
  if (data.startMinutes !== undefined && data.endMinutes !== undefined) {
    return data.endMinutes > data.startMinutes;
  }
  return true;
}, {
  message: 'End time must be after start time.',
  path: ['endMinutes'],
}).refine(data => {
  if (data.effectiveFrom && data.effectiveTo) {
    return new Date(data.effectiveTo).getTime() >= new Date(data.effectiveFrom).getTime();
  }
  return true;
}, {
  message: 'Effective Until must be on or after Effective From.',
  path: ['effectiveTo'],
});

export const getClassTimetableQuerySchema = z.object({
  classId: z.string({ required_error: 'Class ID is required.' }).min(1, 'Class ID is required.'),
  referenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'referenceDate must be in YYYY-MM-DD format.').optional(),
});

export const getStaffTimetableQuerySchema = z.object({
  ustadhId: z.string().optional(),
  staffType: z.enum(['USTADH', 'SCHOOL_TEACHER']).optional(),
  referenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'referenceDate must be in YYYY-MM-DD format.').optional(),
});

export const getFullTimetableQuerySchema = z.object({
  referenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'referenceDate must be in YYYY-MM-DD format.').optional(),
});

export const listBreaksQuerySchema = z.object({
  classId: z.string().optional(),
  dayOfWeek: z.enum(WEEKDAYS).optional(),
  isActive: z.coerce.boolean().optional(),
});
