import { z } from 'zod';

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const timeToMinutes = (timeStr) => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

export const slotAllocationSchema = z.object({
  applicationId: z.string().min(1, 'Application ID is required'),
  startTime: z.string().regex(timeRegex, 'Start time must be HH:mm (24-hour)'),
  endTime: z.string().regex(timeRegex, 'End time must be HH:mm (24-hour)'),
}).refine((slot) => timeToMinutes(slot.endTime) > timeToMinutes(slot.startTime), {
  message: 'End time must be after start time',
  path: ['endTime'],
});

export const scheduleInterviewSchema = z.object({
  admissionPeriodId: z.string().min(1, 'Admission intake period is required.'),
  interviewRound: z.enum(['FIRST', 'SECOND']).default('FIRST'),
  schedulingMethod: z.enum(['SAME_TIME', 'INDIVIDUAL_SLOTS']),
  title: z
    .string()
    .min(2, 'Title must be at least 2 characters.')
    .max(191, 'Title cannot exceed 191 characters.')
    .transform((val) => val.trim()),
  interviewDate: z.string().regex(dateRegex, 'Date must be formatted as YYYY-MM-DD.'),
  venue: z
    .string()
    .min(2, 'Venue is required.')
    .max(255, 'Venue cannot exceed 255 characters.')
    .transform((val) => val.trim()),
  defaultStartTime: z.string().regex(timeRegex, 'Default start time must be HH:mm.').optional().nullable(),
  defaultEndTime: z.string().regex(timeRegex, 'Default end time must be HH:mm.').optional().nullable(),
  slotDurationMinutes: z.coerce.number().int().min(5).max(180).optional().nullable(),
  instructions: z.string().max(2000, 'Instructions cannot exceed 2000 characters.').optional().nullable(),
  requiredDocuments: z.array(z.string().min(1).max(150)).optional().nullable(),
  applicationIds: z.array(z.string().min(1)).min(1, 'At least one applicant must be selected.'),
  slotAllocations: z.array(slotAllocationSchema).optional().nullable(),
}).superRefine((data, ctx) => {
  // Validate unique applications in payload
  const uniqueApps = new Set(data.applicationIds);
  if (uniqueApps.size !== data.applicationIds.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Duplicate applicant IDs found in selection.',
      path: ['applicationIds'],
    });
  }

  // Same time method requirements
  if (data.schedulingMethod === 'SAME_TIME') {
    if (!data.defaultStartTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Start time is required for same-time scheduling.',
        path: ['defaultStartTime'],
      });
    }
    if (!data.defaultEndTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'End time is required for same-time scheduling.',
        path: ['defaultEndTime'],
      });
    }
    if (data.defaultStartTime && data.defaultEndTime) {
      if (timeToMinutes(data.defaultEndTime) <= timeToMinutes(data.defaultStartTime)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'End time must be after start time.',
          path: ['defaultEndTime'],
        });
      }
    }
  }

  // Individual slots method requirements
  if (data.schedulingMethod === 'INDIVIDUAL_SLOTS') {
    if (data.slotAllocations && data.slotAllocations.length > 0) {
      if (data.slotAllocations.length !== data.applicationIds.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Every selected applicant must have an allocated time slot.',
          path: ['slotAllocations'],
        });
      }
      const allocatedAppIds = new Set(data.slotAllocations.map((s) => s.applicationId));
      for (const appId of data.applicationIds) {
        if (!allocatedAppIds.has(appId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Applicant ${appId} is missing an allocated time slot.`,
            path: ['slotAllocations'],
          });
        }
      }
    } else {
      // Auto-slot mode requires defaultStartTime and slotDurationMinutes
      if (!data.defaultStartTime) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Default start time is required to automatically calculate slots.',
          path: ['defaultStartTime'],
        });
      }
      if (!data.slotDurationMinutes || data.slotDurationMinutes < 5) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Slot duration (minimum 5 minutes) is required for individual time slots.',
          path: ['slotDurationMinutes'],
        });
      }
    }
  }
});

export const rescheduleInterviewSchema = z.object({
  interviewDate: z.string().regex(dateRegex, 'Date must be formatted as YYYY-MM-DD.'),
  startTime: z.string().regex(timeRegex, 'Start time must be HH:mm.'),
  endTime: z.string().regex(timeRegex, 'End time must be HH:mm.'),
  venue: z.string().min(2).max(255).optional().transform((val) => (val ? val.trim() : undefined)),
  rescheduleReason: z.string().max(1000).optional().nullable(),
}).refine((data) => timeToMinutes(data.endTime) > timeToMinutes(data.startTime), {
  message: 'End time must be after start time.',
  path: ['endTime'],
});

export const cancelInterviewSchema = z.object({
  cancellationReason: z
    .string()
    .min(3, 'Cancellation reason must be at least 3 characters.')
    .max(1000, 'Cancellation reason cannot exceed 1000 characters.')
    .transform((val) => val.trim()),
});

export const evaluateInterviewSchema = z.object({
  attendance: z.enum(['PRESENT', 'ABSENT']).optional().nullable(),
  quranRecitationScore: z.coerce.number().min(0).max(100).optional().nullable(),
  islamicKnowledgeScore: z.coerce.number().min(0).max(100).optional().nullable(),
  academicScore: z.coerce.number().min(0).max(100).optional().nullable(),
  conductScore: z.coerce.number().min(0).max(100).optional().nullable(),
  totalScore: z.coerce.number().min(0).max(100).optional().nullable(),
  interviewerNotes: z.string().max(2000).optional().nullable(),
  recommendationNotes: z.string().max(2000).optional().nullable(),
  result: z.enum(['PENDING', 'PASSED', 'NEEDS_SECOND_INTERVIEW', 'REJECTED']).default('PENDING'),
});

export const queryAppointmentsSchema = z.object({
  admissionPeriodId: z.string().optional(),
  interviewRound: z.enum(['FIRST', 'SECOND']).optional(),
  status: z.enum(['SCHEDULED', 'RESCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW']).optional(),
  result: z.enum(['PENDING', 'PASSED', 'NEEDS_SECOND_INTERVIEW', 'REJECTED']).optional(),
  attendance: z.enum(['PRESENT', 'ABSENT', 'UNRECORDED']).optional(),
  startDate: z.string().regex(dateRegex).optional(),
  endDate: z.string().regex(dateRegex).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const retryEmailNotificationSchema = z.object({
  notificationIds: z.array(z.string().min(1)).min(1, 'At least one notification ID is required.').optional(),
  appointmentId: z.string().min(1).optional(),
  force: z.boolean().optional().default(false),
}).refine((data) => data.notificationIds || data.appointmentId, {
  message: 'Either notificationIds or appointmentId must be provided.',
});
