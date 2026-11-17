import { z } from 'zod';

export const createClassroomSchema = z.object({
  name: z.string().trim().min(1, 'Classroom name is required.').max(100),
  roomNumber: z.string().trim().min(1, 'Room number or identifier is required.').max(50),
  classId: z.string().trim().optional().nullable(),
  capacity: z.number().int().min(1).max(1000).optional().nullable(),
  facilities: z.string().trim().max(1000).optional().nullable(),
  building: z.string().trim().max(100).optional().nullable(),
  floor: z.string().trim().max(50).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  isActive: z.boolean().default(true),
});

export const updateClassroomSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  roomNumber: z.string().trim().min(1).max(50).optional(),
  classId: z.string().trim().optional().nullable(),
  capacity: z.number().int().min(1).max(1000).optional().nullable(),
  facilities: z.string().trim().max(1000).optional().nullable(),
  building: z.string().trim().max(100).optional().nullable(),
  floor: z.string().trim().max(50).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  isActive: z.boolean().optional(),
});

export const listClassroomsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().optional(),
  isActive: z.preprocess((val) => {
    if (val === 'true' || val === true) return true;
    if (val === 'false' || val === false) return false;
    return undefined;
  }, z.boolean().optional()),
});
