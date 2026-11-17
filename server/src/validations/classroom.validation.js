import { z } from 'zod';

export const createClassroomSchema = z.object({
  name: z.string().trim().min(1, 'Classroom name is required.').max(100),
  roomNumber: z.string().trim().min(1, 'Room number or identifier is required.').max(50),
  capacity: z.number().int().min(1).max(1000).optional().nullable(),
  facilities: z.string().trim().max(1000).optional().nullable(),
  isActive: z.boolean().default(true),
});

export const updateClassroomSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  roomNumber: z.string().trim().min(1).max(50).optional(),
  capacity: z.number().int().min(1).max(1000).optional().nullable(),
  facilities: z.string().trim().max(1000).optional().nullable(),
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
