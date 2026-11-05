import { z } from 'zod';

export const createAssessmentSchema = z.object({
  classId: z.string().min(1, 'Class is required.'),
  academicYear: z.string().min(1, 'Academic Year is required.').max(50),
  term: z.string().min(1, 'Term is required.').max(50),
  name: z.string().min(1, 'Assessment name is required.').max(100),
});

export const updateAssessmentSchema = z.object({
  academicYear: z.string().min(1).max(50).optional(),
  term: z.string().min(1).max(50).optional(),
  name: z.string().min(1).max(100).optional(),
});

export const addSubjectSchema = z.object({
  subjectId: z.string().optional(),
  newSubject: z.object({
    name: z.string().min(1, 'Subject name is required.').max(100),
    code: z.string().max(20).optional().nullable(),
    description: z.string().max(500).optional().nullable(),
  }).optional(),
  maxMark: z.coerce.number().positive('Maximum mark must be greater than 0.').max(1000),
  passMark: z.coerce.number().min(0, 'Pass mark cannot be negative.').max(1000),
  sortOrder: z.coerce.number().int().min(0).default(0),
}).refine((data) => data.passMark <= data.maxMark, {
  message: 'Pass mark cannot exceed maximum mark.',
  path: ['passMark'],
}).refine((data) => data.subjectId || data.newSubject, {
  message: 'Either an existing subjectId or newSubject must be provided.',
  path: ['subjectId'],
});

export const saveMarksSchema = z.object({
  marks: z.array(
    z.object({
      studentId: z.string().min(1, 'Student ID is required.'),
      assessmentSubjectId: z.string().min(1, 'Assessment Subject ID is required.'),
      mark: z.preprocess((val) => {
        if (val === null || val === undefined || val === '' || val === 'null') return null;
        const num = Number(val);
        return isNaN(num) ? val : num;
      }, z.number().min(0).max(1000).nullable()),
    })
  ).min(1, 'At least one mark entry must be provided.'),
});

export const gpaSettingsSchema = z.object({
  bands: z.array(
    z.object({
      minPercentage: z.coerce.number().min(0).max(100),
      maxPercentage: z.coerce.number().min(0).max(100),
      gpa: z.coerce.number().min(0).max(4.00),
    })
  ).min(1, 'At least one GPA band is required.'),
});
