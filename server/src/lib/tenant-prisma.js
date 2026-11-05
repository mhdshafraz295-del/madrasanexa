import { NotFoundError, BadRequestError } from '../utils/errors.js';

/**
 * Tenant-Scoped Prisma Helper Library for MadrasaNexa.
 *
 * DESIGN PRINCIPLES:
 * 1. Explicit & Auditable: No hidden global Prisma extensions modifying arbitrary queries.
 * 2. Trusted Tenant Source: All tenant IDs passed must come from server-trusted context
 *    (req.tenant.madrasaId for Madrasa Admins, or explicitly resolved req.platformTarget.madrasaId for Super Admins).
 *    NEVER pass raw req.body.madrasaId, req.query.madrasaId, or req.params.madrasaId directly.
 * 3. Anti-Enumeration / IDOR Safe: Cross-tenant records or non-existent records throw generic NotFoundError (404).
 *    Never reveal whether an ID exists under another tenant institution.
 */

/**
 * Canonical registry of tenant-scoped Prisma model delegates.
 * Every model listed here is strictly scoped by `madrasaId`.
 */
export const TENANT_MODELS = Object.freeze([
  'academicSection',
  'class',
  'student',
  'studentFeeSetting',
  'invoice',
  'invoiceItem',
  'payment',
  'paymentAllocation',
  'receipt',
  'whatsAppLog',
  'fileObject',
  'madrasaSetting',
  'madrasaEmailSetting',
  'activityLog',
  'subject',
  'markingAssessment',
  'markingAssessmentSubject',
  'studentMark',
  'attendanceSession',
  'attendanceRecord',
  'ustadh',
  'ustadhSchedule',
  'ustadhAttendanceRecord',
  'ustadhSalary',
  'timetableBreak',
  'expenseCategory',
  'expense',
  'expenseBudget',
  'expenseMonthlyInsight',
  'notificationJob',
  'timetablePublication',
  'studentQualification',
  'studentIncident',
  'studentMeeting',
  'studentFollowUp',
]);

/**
 * Checks whether a Prisma model delegate name is registered as tenant-scoped.
 *
 * @param {string} modelName
 * @returns {boolean}
 */
export const isTenantModel = (modelName) => {
  return typeof modelName === 'string' && TENANT_MODELS.includes(modelName);
};

/**
 * Validates that the provided tenant ID is a non-empty string.
 * Prevents undefined, null, or accidental empty strings from bypassing tenant scope.
 *
 * @param {string} trustedMadrasaId
 * @returns {string}
 */
export const assertValidTenantId = (trustedMadrasaId) => {
  if (!trustedMadrasaId || typeof trustedMadrasaId !== 'string' || trustedMadrasaId.trim() === '') {
    throw new BadRequestError('Invalid or missing tenant scope.');
  }
  return trustedMadrasaId.trim();
};

/**
 * Combines a trusted madrasaId with additional where criteria.
 *
 * @param {string} trustedMadrasaId - Verified server tenant ID (e.g. req.tenant.madrasaId)
 * @param {object} [additionalWhere={}] - Additional Prisma filter conditions
 * @returns {object} Scoped Prisma where clause
 */
export const tenantWhere = (trustedMadrasaId, additionalWhere = {}) => {
  const madrasaId = assertValidTenantId(trustedMadrasaId);
  return {
    ...additionalWhere,
    madrasaId,
  };
};

/**
 * Finds a single tenant-owned record by ID and trusted madrasaId.
 * Uses findFirst with compound criteria to guarantee tenant isolation.
 *
 * @param {object} modelDelegate - Prisma model delegate (e.g. prisma.student)
 * @param {string} id - Record identifier
 * @param {string} trustedMadrasaId - Verified server tenant ID
 * @param {object} [options={}] - Additional Prisma options (select, include, etc.)
 * @returns {Promise<object|null>} The found record or null
 */
export const findTenantRecord = async (modelDelegate, id, trustedMadrasaId, options = {}) => {
  const madrasaId = assertValidTenantId(trustedMadrasaId);
  if (!id || typeof id !== 'string') {
    return null;
  }

  const { where = {}, ...restOptions } = options;

  return await modelDelegate.findFirst({
    where: {
      id,
      madrasaId,
      ...where,
    },
    ...restOptions,
  });
};

/**
 * Finds a single tenant-owned record by ID and trusted madrasaId, or throws NotFoundError (404).
 * ANTI-ENUMERATION: If the record exists under another tenant, this STILL throws NotFoundError.
 *
 * @param {object} modelDelegate - Prisma model delegate (e.g. prisma.student)
 * @param {string} id - Record identifier
 * @param {string} trustedMadrasaId - Verified server tenant ID
 * @param {object} [options={}] - Additional Prisma options (select, include, etc.)
 * @param {string} [customMessage='Resource not found.'] - Generic error message
 * @returns {Promise<object>} The found record
 * @throws {NotFoundError} If record does not exist OR belongs to another Madrasa
 */
export const findTenantRecordOrThrow = async (
  modelDelegate,
  id,
  trustedMadrasaId,
  options = {},
  customMessage = 'Resource not found.'
) => {
  const record = await findTenantRecord(modelDelegate, id, trustedMadrasaId, options);
  if (!record) {
    throw new NotFoundError(customMessage);
  }
  return record;
};

/**
 * Asserts ownership of an existing record for a tenant.
 * IDOR Safe: Throws NotFoundError (404) if non-existent or foreign tenant.
 *
 * @param {object} modelDelegate - Prisma model delegate (e.g. prisma.student)
 * @param {string} id - Record identifier
 * @param {string} trustedMadrasaId - Verified server tenant ID
 * @param {string} [customMessage='Resource not found.']
 * @returns {Promise<object>} The validated record
 */
export const assertTenantOwnership = async (
  modelDelegate,
  id,
  trustedMadrasaId,
  customMessage = 'Resource not found.'
) => {
  return await findTenantRecordOrThrow(modelDelegate, id, trustedMadrasaId, {}, customMessage);
};

/**
 * Validates that a related foreign-key resource (e.g. classId for Student, studentId for Invoice)
 * belongs to the exact same tenant before assignment/relation.
 *
 * IDOR Safe: Throws NotFoundError (404) if related record does not exist OR belongs to another Madrasa.
 * Never throws 403, preventing discovery of foreign IDs.
 *
 * @param {object} modelDelegate - Related Prisma delegate (e.g. prisma.class)
 * @param {string} relatedId - Foreign ID to validate
 * @param {string} trustedMadrasaId - Verified server tenant ID
 * @param {string} [resourceName='Related resource'] - Display name in generic message
 * @returns {Promise<object>}
 */
export const validateRelatedTenantResource = async (
  modelDelegate,
  relatedId,
  trustedMadrasaId,
  resourceName = 'Related resource'
) => {
  const madrasaId = assertValidTenantId(trustedMadrasaId);
  if (!relatedId || typeof relatedId !== 'string') {
    throw new NotFoundError(`${resourceName} not found.`);
  }

  const related = await modelDelegate.findFirst({
    where: {
      id: relatedId,
      madrasaId,
    },
    select: { id: true, madrasaId: true },
  });

  if (!related) {
    throw new NotFoundError(`${resourceName} not found.`);
  }

  return related;
};

/**
 * Builds synchronized query clauses for pagination to prevent cross-tenant enumeration via counts.
 * Guarantees that totalCount and items always execute with the exact same tenant filter.
 *
 * @param {string} trustedMadrasaId - Verified server tenant ID
 * @param {object} [additionalWhere={}] - Filter options
 * @returns {{ where: object }}
 */
export const tenantPaginationWhere = (trustedMadrasaId, additionalWhere = {}) => {
  return {
    where: tenantWhere(trustedMadrasaId, additionalWhere),
  };
};
