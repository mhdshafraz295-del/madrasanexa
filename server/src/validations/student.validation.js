import { z } from 'zod';

export const createStudentSchema = z
  .object({
    admissionNo: z
      .string({ required_error: 'Admission number is required.' })
      .trim()
      .min(1, 'Admission number must not be empty.')
      .max(50, 'Admission number must not exceed 50 characters.'),
    fullName: z
      .string({ required_error: 'Student full name is required.' })
      .trim()
      .min(2, 'Full name must be at least 2 characters.')
      .max(150, 'Full name must not exceed 150 characters.'),
    academicSectionId: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform((val) => (val && val.trim() !== '' && val !== 'UNASSIGNED' && val !== 'ALL' ? val.trim() : null)),
    classId: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform((val) => (val && val.trim() !== '' && val !== 'UNASSIGNED' ? val.trim() : null)),
    guardianName: z
      .string({ required_error: 'Guardian name is required.' })
      .trim()
      .min(2, 'Guardian name must be at least 2 characters.')
      .max(150, 'Guardian name must not exceed 150 characters.'),
    guardianPhone: z
      .string()
      .trim()
      .max(30, 'Guardian phone must not exceed 30 characters.')
      .optional()
      .nullable()
      .transform((val) => (val && val.trim() !== '' ? val.trim() : null)),
    guardianEmail: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform((val) => (val && val.trim() !== '' ? val.trim().toLowerCase() : null))
      .refine((val) => val === null || (val.length <= 255 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)), {
        message: 'Invalid guardian email address format.',
      }),
    whatsappNumber: z
      .string()
      .trim()
      .max(30, 'WhatsApp number must not exceed 30 characters.')
      .optional()
      .nullable()
      .transform((val) => (val && val.trim() !== '' ? val.trim() : null)),
    guardianWhatsapp: z
      .string()
      .trim()
      .max(30, 'WhatsApp number must not exceed 30 characters.')
      .optional()
      .nullable()
      .transform((val) => (val && val.trim() !== '' ? val.trim() : null)),
    whatsappOptIn: z.boolean().optional(),
    whatsappNotification: z.boolean().optional(),
    address: z
      .string()
      .trim()
      .max(500, 'Address must not exceed 500 characters.')
      .optional()
      .nullable()
      .transform((val) => (val && val.trim() !== '' ? val.trim() : null)),
    admissionDate: z
      .string()
      .optional()
      .refine((val) => val === undefined || !isNaN(Date.parse(val)), {
        message: 'Invalid admission date format.',
      }),
    joinedAt: z
      .string()
      .optional()
      .refine((val) => val === undefined || !isNaN(Date.parse(val)), {
        message: 'Invalid admission date format.',
      }),
    monthlyFeeOverride: z
      .union([z.string(), z.number()])
      .optional()
      .nullable()
      .refine(
        (val) => val === undefined || val === null || (!isNaN(Number(val)) && Number(val) >= 0),
        {
          message: 'Monthly fee override must be a non-negative number.',
        }
      ),
    monthlyFee: z
      .union([z.string(), z.number()])
      .optional()
      .nullable()
      .refine(
        (val) => val === undefined || val === null || (!isNaN(Number(val)) && Number(val) >= 0),
        {
          message: 'Monthly fee must be a non-negative number.',
        }
      ),
    notes: z
      .string()
      .trim()
      .max(1000, 'Notes must not exceed 1000 characters.')
      .optional()
      .nullable()
      .transform((val) => (val && val.trim() !== '' ? val.trim() : null)),
  })
  .transform((data) => {
    const whatsappNum = data.whatsappNumber || data.guardianWhatsapp || null;
    const optIn = data.whatsappOptIn !== undefined ? data.whatsappOptIn : Boolean(data.whatsappNotification);
    const admDateRaw = data.admissionDate || data.joinedAt || new Date();
    const feeRaw = data.monthlyFeeOverride !== undefined && data.monthlyFeeOverride !== null && data.monthlyFeeOverride !== ''
      ? data.monthlyFeeOverride
      : data.monthlyFee !== undefined && data.monthlyFee !== null && data.monthlyFee !== ''
      ? data.monthlyFee
      : null;

    return {
      admissionNo: data.admissionNo,
      fullName: data.fullName,
      academicSectionId: data.academicSectionId,
      classId: data.classId,
      guardianName: data.guardianName,
      guardianPhone: data.guardianPhone,
      guardianEmail: data.guardianEmail,
      whatsappNumber: whatsappNum,
      whatsappOptIn: optIn,
      address: data.address,
      admissionDate: new Date(admDateRaw),
      monthlyFeeOverride: feeRaw !== null ? String(Number(feeRaw).toFixed(2)) : null,
      notes: data.notes,
    };
  })
  .refine(
    (data) => {
      if (data.whatsappOptIn && (!data.whatsappNumber || data.whatsappNumber.trim() === '')) {
        return false;
      }
      return true;
    },
    {
      message: 'WhatsApp number is required when WhatsApp opt-in is enabled.',
      path: ['whatsappNumber'],
    }
  );

export const updateStudentSchema = z
  .object({
    admissionNo: z
      .string()
      .trim()
      .min(1, 'Admission number must not be empty.')
      .max(50, 'Admission number must not exceed 50 characters.')
      .optional(),
    fullName: z
      .string()
      .trim()
      .min(2, 'Full name must be at least 2 characters.')
      .max(150, 'Full name must not exceed 150 characters.')
      .optional(),
    academicSectionId: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform((val) => (val === undefined ? undefined : val && val.trim() !== '' && val !== 'UNASSIGNED' && val !== 'ALL' ? val.trim() : null)),
    classId: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform((val) => (val === undefined ? undefined : val && val.trim() !== '' && val !== 'UNASSIGNED' ? val.trim() : null)),
    guardianName: z
      .string()
      .trim()
      .min(2, 'Guardian name must be at least 2 characters.')
      .max(150, 'Guardian name must not exceed 150 characters.')
      .optional(),
    guardianPhone: z
      .string()
      .trim()
      .max(30, 'Guardian phone must not exceed 30 characters.')
      .optional()
      .nullable()
      .transform((val) => (val === undefined ? undefined : val && val.trim() !== '' ? val.trim() : null)),
    guardianEmail: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform((val) => (val === undefined ? undefined : val && val.trim() !== '' ? val.trim().toLowerCase() : null))
      .refine((val) => val === undefined || val === null || (val.length <= 255 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)), {
        message: 'Invalid guardian email address format.',
      }),
    whatsappNumber: z
      .string()
      .trim()
      .max(30, 'WhatsApp number must not exceed 30 characters.')
      .optional()
      .nullable()
      .transform((val) => (val === undefined ? undefined : val && val.trim() !== '' ? val.trim() : null)),
    guardianWhatsapp: z
      .string()
      .trim()
      .max(30, 'WhatsApp number must not exceed 30 characters.')
      .optional()
      .nullable()
      .transform((val) => (val === undefined ? undefined : val && val.trim() !== '' ? val.trim() : null)),
    whatsappOptIn: z.boolean().optional(),
    whatsappNotification: z.boolean().optional(),
    address: z
      .string()
      .trim()
      .max(500, 'Address must not exceed 500 characters.')
      .optional()
      .nullable()
      .transform((val) => (val === undefined ? undefined : val && val.trim() !== '' ? val.trim() : null)),
    admissionDate: z
      .string()
      .optional()
      .refine((val) => val === undefined || !isNaN(Date.parse(val)), {
        message: 'Invalid admission date format.',
      }),
    joinedAt: z
      .string()
      .optional()
      .refine((val) => val === undefined || !isNaN(Date.parse(val)), {
        message: 'Invalid admission date format.',
      }),
    notes: z
      .string()
      .trim()
      .max(1000, 'Notes must not exceed 1000 characters.')
      .optional()
      .nullable()
      .transform((val) => (val === undefined ? undefined : val && val.trim() !== '' ? val.trim() : null)),
  })
  .transform((data) => {
    const whatsappNum = data.whatsappNumber !== undefined
      ? data.whatsappNumber
      : data.guardianWhatsapp !== undefined
      ? data.guardianWhatsapp
      : undefined;

    const optIn = data.whatsappOptIn !== undefined
      ? data.whatsappOptIn
      : data.whatsappNotification !== undefined
      ? data.whatsappNotification
      : undefined;

    const admDate = data.admissionDate !== undefined
      ? new Date(data.admissionDate)
      : data.joinedAt !== undefined
      ? new Date(data.joinedAt)
      : undefined;

    return {
      admissionNo: data.admissionNo,
      fullName: data.fullName,
      academicSectionId: data.academicSectionId,
      classId: data.classId,
      guardianName: data.guardianName,
      guardianPhone: data.guardianPhone,
      guardianEmail: data.guardianEmail,
      whatsappNumber: whatsappNum,
      whatsappOptIn: optIn,
      address: data.address,
      admissionDate: admDate,
      notes: data.notes,
    };
  });

export const listStudentsQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(20),
    search: z.string().trim().optional(),
    academicSectionId: z.string().trim().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED', 'ALL']).optional(),
    classId: z.string().trim().optional(),
  })
  .transform((data) => ({
    page: data.page,
    pageSize: data.pageSize,
    search: data.search,
    academicSectionId: data.academicSectionId === 'ALL' ? undefined : data.academicSectionId,
    status: data.status === 'ALL' ? undefined : data.status,
    classId: data.classId === 'ALL' ? undefined : data.classId,
  }));

export const setFeeOverrideSchema = z
  .object({
    amount: z.union([z.string(), z.number()]).optional(),
    monthlyFee: z.union([z.string(), z.number()]).optional(),
    effectiveFrom: z
      .string({ required_error: 'Effective from date is required.' })
      .refine((val) => !isNaN(Date.parse(val)), {
        message: 'Invalid effective from date format.',
      })
      .transform((val) => new Date(val)),
    reason: z
      .string()
      .trim()
      .max(255, 'Reason must not exceed 255 characters.')
      .optional()
      .nullable()
      .transform((val) => (val && val.trim() !== '' ? val.trim() : null)),
  })
  .refine((data) => data.amount !== undefined || data.monthlyFee !== undefined, {
    message: 'Fee override amount is required.',
    path: ['amount'],
  })
  .transform((data) => {
    const rawVal = data.amount !== undefined ? data.amount : data.monthlyFee;
    const num = Number(rawVal);
    if (isNaN(num) || num < 0) {
      throw new Error('Fee override amount must be a valid non-negative number.');
    }
    return {
      amount: String(num.toFixed(2)),
      effectiveFrom: data.effectiveFrom,
      reason: data.reason,
    };
  });

export const useClassDefaultFeeSchema = z.object({
  effectiveDate: z
    .string()
    .optional()
    .refine((val) => val === undefined || !isNaN(Date.parse(val)), {
      message: 'Invalid effective date format.',
    })
    .transform((val) => (val ? new Date(val) : new Date())),
  reason: z
    .string()
    .trim()
    .max(255, 'Reason must not exceed 255 characters.')
    .optional()
    .nullable()
    .transform((val) => (val && val.trim() !== '' ? val.trim() : null)),
});
