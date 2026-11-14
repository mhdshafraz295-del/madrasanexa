/**
 * MadrasaNexa Phase 02 – Student Scan Token Service
 *
 * Implements:
 * - Secure token issuance for individual students (conforms to canonical 37-char format)
 * - Duplicate active token prevention (enforced at both business layer and database constraint)
 * - Additive batch token generation (generates missing tokens only, skips existing)
 * - Single-student token regeneration with mandatory audit reason (atomic revocation + replacement)
 * - Individual token revocation with audit metadata
 * - Tenant isolation enforced on all queries (madrasaId boundary)
 * - Secure database persistence via StudentScanToken model
 * - Reprinting support reusing existing active tokens (decrypted on-demand)
 * - Clean dependency injection of Prisma client for hermetic, non-polluting tests
 *
 * Strict Business Invariants:
 * - Normal issuance NEVER replaces an existing active token.
 * - Bulk force-regeneration is strictly forbidden.
 * - Raw tokens are never logged or stored in plaintext in persistent storage.
 */

import { prisma as defaultPrisma } from '../lib/prisma.js';
import {
  generateRawToken,
  isValidTokenFormat,
  deriveTokenHint,
  hashToken,
  encryptToken,
  decryptToken,
  validateEncryptionKey,
} from '../utils/scan-token-crypto.js';
import {
  BadRequestError,
  NotFoundError,
  ConflictError,
} from '../utils/errors.js';

/**
 * Resolves the 64-character hexadecimal encryption key.
 * Prioritizes explicitly passed overrideKey (for tests/injected contexts),
 * falling back to process.env.SCAN_TOKEN_ENCRYPTION_KEY or process.env.EMAIL_CREDENTIAL_ENCRYPTION_KEY.
 *
 * @param {string} [overrideKey]
 * @returns {string} Validated 64-character hex key string
 */
export function getTokenEncryptionKey(overrideKey = null) {
  const candidate = overrideKey
    || process.env.SCAN_TOKEN_ENCRYPTION_KEY
    || process.env.EMAIL_CREDENTIAL_ENCRYPTION_KEY;

  if (!candidate) {
    throw new Error('Server configuration error: SCAN_TOKEN_ENCRYPTION_KEY is required for scan token operations.');
  }

  validateEncryptionKey(candidate);
  return candidate.trim();
}

/**
 * Issues a new canonical scan token for an individual student.
 * Mandatory business rule: Normal issuance must NEVER replace an existing active token.
 *
 * @param {object} params
 * @param {string} params.madrasaId - Tenant madrasa ID (trusted context)
 * @param {string} params.studentId - Student ID
 * @param {string} [params.issuedById] - User ID of issuing operator/admin
 * @param {string} [params.keyHex] - Optional encryption key override
 * @param {object} [params.prismaClient] - Optional injected Prisma client (for isolated unit tests)
 * @returns {Promise<{ tokenRecord: object, rawToken: string }>}
 */
export async function issueStudentToken({
  madrasaId,
  studentId,
  issuedById = null,
  keyHex = null,
  prismaClient = defaultPrisma,
}) {
  if (!madrasaId || typeof madrasaId !== 'string') {
    throw new BadRequestError('Tenant madrasaId is required.');
  }
  if (!studentId || typeof studentId !== 'string') {
    throw new BadRequestError('Student ID is required.');
  }

  // 1. Tenant-isolated student lookup (prevents IDOR / cross-tenant issuance)
  const student = await prismaClient.student.findFirst({
    where: { id: studentId, madrasaId },
    select: { id: true, madrasaId: true, admissionNo: true, fullName: true },
  });

  if (!student) {
    throw new NotFoundError('Student not found.');
  }

  // 2. Duplicate prevention check
  const existingActive = await prismaClient.studentScanToken.findFirst({
    where: { madrasaId, studentId, isActive: true },
    select: { id: true, tokenHint: true, version: true, issuedAt: true },
  });

  if (existingActive) {
    throw new ConflictError(
      `Student already has an active scan token (Hint: ${existingActive.tokenHint}, Version: ${existingActive.version}). Normal issuance cannot overwrite an active token. Use regeneration to replace an existing token.`
    );
  }

  // 3. Cryptographic token generation & encryption
  const encryptionKey = getTokenEncryptionKey(keyHex);
  const rawToken = generateRawToken();

  if (!isValidTokenFormat(rawToken)) {
    throw new Error('Internal cryptographic failure: generated token does not match canonical format.');
  }

  const tokenHash = hashToken(rawToken);
  const tokenHint = deriveTokenHint(rawToken);
  const { tokenEncrypted, tokenIv, tokenAuthTag, keyVersion } = encryptToken(rawToken, encryptionKey, { keyVersion: 1 });

  // 4. Persistence with activeStudentId unique constraint
  const tokenRecord = await prismaClient.studentScanToken.create({
    data: {
      madrasaId,
      studentId,
      tokenHash,
      tokenEncrypted,
      tokenIv,
      tokenAuthTag,
      keyVersion,
      tokenHint,
      version: 1,
      isActive: true,
      activeStudentId: studentId, // Enforces unique active token per tenant/student
      issuedById,
      issuedAt: new Date(),
    },
    select: {
      id: true,
      madrasaId: true,
      studentId: true,
      tokenHint: true,
      version: true,
      isActive: true,
      issuedAt: true,
      issuedById: true,
      keyVersion: true,
      createdAt: true,
    },
  });

  // Return rawToken ONLY in memory for initial card rendering
  return { tokenRecord, rawToken };
}

/**
 * Additive batch token generation for missing student cards.
 * Mandatory business rule: Generates missing tokens only; strictly skips students with existing active tokens.
 *
 * @param {object} params
 * @param {string} params.madrasaId - Tenant madrasa ID
 * @param {string} [params.classId] - Optional class filter
 * @param {string} [params.issuedById] - Operator ID
 * @param {string} [params.keyHex] - Optional encryption key override
 * @param {object} [params.prismaClient] - Optional injected Prisma client
 * @returns {Promise<{ totalEligible: number, generatedCount: number, skippedCount: number, tokens: Array<{ tokenRecord: object, rawToken: string }> }>}
 */
export async function batchGenerateMissingTokens({
  madrasaId,
  classId = null,
  issuedById = null,
  keyHex = null,
  prismaClient = defaultPrisma,
}) {
  if (!madrasaId || typeof madrasaId !== 'string') {
    throw new BadRequestError('Tenant madrasaId is required.');
  }

  // 1. Query students in tenant (optionally by class)
  const studentWhere = { madrasaId };
  if (classId && typeof classId === 'string' && classId.trim().length > 0) {
    studentWhere.classId = classId.trim();
  }

  const students = await prismaClient.student.findMany({
    where: studentWhere,
    select: { id: true, admissionNo: true, fullName: true },
    orderBy: { admissionNo: 'asc' },
  });

  if (students.length === 0) {
    return { totalEligible: 0, generatedCount: 0, skippedCount: 0, tokens: [] };
  }

  // 2. Query students who already have active tokens
  const existingActiveTokens = await prismaClient.studentScanToken.findMany({
    where: {
      madrasaId,
      studentId: { in: students.map((s) => s.id) },
      isActive: true,
    },
    select: { studentId: true },
  });

  const activeStudentIdSet = new Set(existingActiveTokens.map((t) => t.studentId));
  const missingStudents = students.filter((s) => !activeStudentIdSet.has(s.id));

  if (missingStudents.length === 0) {
    return {
      totalEligible: students.length,
      generatedCount: 0,
      skippedCount: students.length,
      tokens: [],
    };
  }

  // 3. Additive issuance for missing students only
  const encryptionKey = getTokenEncryptionKey(keyHex);
  const issuedList = [];

  for (const student of missingStudents) {
    const rawToken = generateRawToken();
    const tokenHash = hashToken(rawToken);
    const tokenHint = deriveTokenHint(rawToken);
    const { tokenEncrypted, tokenIv, tokenAuthTag, keyVersion } = encryptToken(rawToken, encryptionKey, { keyVersion: 1 });

    const tokenRecord = await prismaClient.studentScanToken.create({
      data: {
        madrasaId,
        studentId: student.id,
        tokenHash,
        tokenEncrypted,
        tokenIv,
        tokenAuthTag,
        keyVersion,
        tokenHint,
        version: 1,
        isActive: true,
        activeStudentId: student.id,
        issuedById,
        issuedAt: new Date(),
      },
      select: {
        id: true,
        madrasaId: true,
        studentId: true,
        tokenHint: true,
        version: true,
        isActive: true,
        issuedAt: true,
        issuedById: true,
        keyVersion: true,
        createdAt: true,
      },
    });

    issuedList.push({ tokenRecord, rawToken });
  }

  return {
    totalEligible: students.length,
    generatedCount: issuedList.length,
    skippedCount: activeStudentIdSet.size,
    tokens: issuedList,
  };
}

/**
 * Regenerates an individual student's scan token with a mandatory audit reason.
 * Atomically revokes previous active token and issues its replacement in a single transaction.
 *
 * @param {object} params
 * @param {string} params.madrasaId - Tenant madrasa ID
 * @param {string} params.studentId - Student ID
 * @param {string} params.reason - Mandatory audit reason (e.g. "CARD_LOST", "CARD_DAMAGED", "SECURITY_RESET")
 * @param {string} [params.issuedById] - Operator ID
 * @param {string} [params.keyHex] - Optional encryption key override
 * @param {object} [params.prismaClient] - Optional injected Prisma client
 * @returns {Promise<{ tokenRecord: object, rawToken: string, previousTokenId: string|null }>}
 */
export async function regenerateStudentToken({
  madrasaId,
  studentId,
  reason,
  issuedById = null,
  keyHex = null,
  prismaClient = defaultPrisma,
}) {
  if (!madrasaId || typeof madrasaId !== 'string') {
    throw new BadRequestError('Tenant madrasaId is required.');
  }
  if (!studentId || typeof studentId !== 'string') {
    throw new BadRequestError('Student ID is required.');
  }
  if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
    throw new BadRequestError('Mandatory audit reason is required for student token regeneration.');
  }

  // 1. Tenant-isolated student lookup
  const student = await prismaClient.student.findFirst({
    where: { id: studentId, madrasaId },
    select: { id: true, madrasaId: true },
  });

  if (!student) {
    throw new NotFoundError('Student not found.');
  }

  // 2. Prepare replacement token
  const encryptionKey = getTokenEncryptionKey(keyHex);
  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  const tokenHint = deriveTokenHint(rawToken);
  const { tokenEncrypted, tokenIv, tokenAuthTag, keyVersion } = encryptToken(rawToken, encryptionKey, { keyVersion: 1 });

  // 3. Atomic transaction: revoke active and insert replacement
  const transactionResult = await prismaClient.$transaction(async (tx) => {
    // Locate existing active token (if any)
    const existingActive = await tx.studentScanToken.findFirst({
      where: { madrasaId, studentId, isActive: true },
    });

    let nextVersion = 1;
    let previousTokenId = null;

    if (existingActive) {
      previousTokenId = existingActive.id;
      nextVersion = existingActive.version + 1;

      // Atomically revoke prior token and nullify activeStudentId
      await tx.studentScanToken.update({
        where: { id: existingActive.id },
        data: {
          isActive: false,
          activeStudentId: null, // Frees the @@unique([madrasaId, activeStudentId]) constraint
          revokedAt: new Date(),
          revokedById: issuedById,
          revokeReason: reason.trim(),
        },
      });
    }

    // Insert new active replacement token
    const newToken = await tx.studentScanToken.create({
      data: {
        madrasaId,
        studentId,
        tokenHash,
        tokenEncrypted,
        tokenIv,
        tokenAuthTag,
        keyVersion,
        tokenHint,
        version: nextVersion,
        isActive: true,
        activeStudentId: studentId,
        issuedById,
        issuedAt: new Date(),
      },
      select: {
        id: true,
        madrasaId: true,
        studentId: true,
        tokenHint: true,
        version: true,
        isActive: true,
        issuedAt: true,
        issuedById: true,
        keyVersion: true,
        createdAt: true,
      },
    });

    return { tokenRecord: newToken, previousTokenId };
  });

  return {
    tokenRecord: transactionResult.tokenRecord,
    rawToken,
    previousTokenId: transactionResult.previousTokenId,
  };
}

/**
 * Revokes an individual student scan token with mandatory audit metadata.
 *
 * @param {object} params
 * @param {string} params.madrasaId - Tenant madrasa ID
 * @param {string} [params.tokenId] - Specific token ID to revoke
 * @param {string} [params.studentId] - Student ID (revokes active token)
 * @param {string} params.reason - Mandatory audit reason
 * @param {string} [params.revokedById] - Operator ID
 * @param {object} [params.prismaClient] - Optional injected Prisma client
 * @returns {Promise<object>} Revoked token record
 */
export async function revokeStudentToken({
  madrasaId,
  tokenId = null,
  studentId = null,
  reason,
  revokedById = null,
  prismaClient = defaultPrisma,
}) {
  if (!madrasaId || typeof madrasaId !== 'string') {
    throw new BadRequestError('Tenant madrasaId is required.');
  }
  if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
    throw new BadRequestError('Mandatory audit reason is required for token revocation.');
  }
  if (!tokenId && !studentId) {
    throw new BadRequestError('Either tokenId or studentId is required for revocation.');
  }

  const whereClause = { madrasaId, isActive: true };
  if (tokenId) {
    whereClause.id = tokenId;
  } else {
    whereClause.studentId = studentId;
  }

  const activeToken = await prismaClient.studentScanToken.findFirst({
    where: whereClause,
  });

  if (!activeToken) {
    throw new NotFoundError('No active scan token found to revoke for this student.');
  }

  const revokedRecord = await prismaClient.studentScanToken.update({
    where: { id: activeToken.id },
    data: {
      isActive: false,
      activeStudentId: null, // Frees unique constraint
      revokedAt: new Date(),
      revokedById,
      revokeReason: reason.trim(),
    },
    select: {
      id: true,
      madrasaId: true,
      studentId: true,
      tokenHint: true,
      version: true,
      isActive: true,
      revokedAt: true,
      revokedById: true,
      revokeReason: true,
      updatedAt: true,
    },
  });

  return revokedRecord;
}

/**
 * Retrieves the current active token metadata for a student (redacted, no secret).
 *
 * @param {object} params
 * @param {string} params.madrasaId - Tenant madrasa ID
 * @param {string} params.studentId - Student ID
 * @param {object} [params.prismaClient] - Optional injected Prisma client
 * @returns {Promise<object|null>} Redacted active token record or null
 */
export async function getActiveTokenForStudent({
  madrasaId,
  studentId,
  prismaClient = defaultPrisma,
}) {
  if (!madrasaId || !studentId) {
    throw new BadRequestError('Tenant madrasaId and studentId are required.');
  }

  return await prismaClient.studentScanToken.findFirst({
    where: { madrasaId, studentId, isActive: true },
    select: {
      id: true,
      madrasaId: true,
      studentId: true,
      tokenHint: true,
      version: true,
      isActive: true,
      issuedAt: true,
      issuedById: true,
      keyVersion: true,
      lastScannedAt: true,
      scanCount: true,
      createdAt: true,
    },
  });
}

/**
 * Retrieves and decrypts the active token for reprinting an existing card.
 * Mandatory business rule: Reprinting must reuse the existing active token without generating a new one.
 *
 * @param {object} params
 * @param {string} params.madrasaId - Tenant madrasa ID
 * @param {string} params.studentId - Student ID
 * @param {string} [params.keyHex] - Optional encryption key override
 * @param {object} [params.prismaClient] - Optional injected Prisma client
 * @returns {Promise<{ tokenRecord: object, rawToken: string }>}
 */
export async function getActiveTokenForPrint({
  madrasaId,
  studentId,
  keyHex = null,
  prismaClient = defaultPrisma,
}) {
  if (!madrasaId || !studentId) {
    throw new BadRequestError('Tenant madrasaId and studentId are required.');
  }

  const tokenRecord = await prismaClient.studentScanToken.findFirst({
    where: { madrasaId, studentId, isActive: true },
  });

  if (!tokenRecord) {
    throw new NotFoundError('No active scan token found for this student. Issue a card first.');
  }

  const encryptionKey = getTokenEncryptionKey(keyHex);
  const rawToken = decryptToken({
    tokenEncrypted: tokenRecord.tokenEncrypted,
    tokenIv: tokenRecord.tokenIv,
    tokenAuthTag: tokenRecord.tokenAuthTag,
  }, encryptionKey);

  return {
    tokenRecord: {
      id: tokenRecord.id,
      madrasaId: tokenRecord.madrasaId,
      studentId: tokenRecord.studentId,
      tokenHint: tokenRecord.tokenHint,
      version: tokenRecord.version,
      isActive: tokenRecord.isActive,
      issuedAt: tokenRecord.issuedAt,
    },
    rawToken,
  };
}

/**
 * Retrieves the full audit history of tokens issued for a student.
 *
 * @param {object} params
 * @param {string} params.madrasaId - Tenant madrasa ID
 * @param {string} params.studentId - Student ID
 * @param {object} [params.prismaClient] - Optional injected Prisma client
 * @returns {Promise<Array<object>>}
 */
export async function listStudentTokenHistory({
  madrasaId,
  studentId,
  prismaClient = defaultPrisma,
}) {
  if (!madrasaId || !studentId) {
    throw new BadRequestError('Tenant madrasaId and studentId are required.');
  }

  return await prismaClient.studentScanToken.findMany({
    where: { madrasaId, studentId },
    select: {
      id: true,
      tokenHint: true,
      version: true,
      isActive: true,
      issuedAt: true,
      issuedById: true,
      revokedAt: true,
      revokedById: true,
      revokeReason: true,
      scanCount: true,
      lastScannedAt: true,
      createdAt: true,
    },
    orderBy: { version: 'desc' },
  });
}

/**
 * Lists students and their card token statuses within tenant boundary.
 * Never leaks raw tokens, token hashes, or cryptographic ciphertext.
 *
 * @param {object} params
 * @param {string} params.madrasaId - Tenant madrasa ID
 * @param {string} [params.classId] - Optional class filter
 * @param {string} [params.search] - Optional search filter for name or admissionNo
 * @param {string} [params.status] - 'ALL' | 'ACTIVE_TOKEN' | 'MISSING_TOKEN' | 'REVOKED'
 * @param {number} [params.page] - Page number (default 1)
 * @param {number} [params.pageSize] - Page size (default 20)
 * @param {object} [params.prismaClient] - Injected Prisma client
 * @returns {Promise<{ items: Array<object>, total: number, page: number, pageSize: number, totalPages: number }>}
 */
export async function listCardTokens({
  madrasaId,
  classId = null,
  search = null,
  status = 'ALL',
  page = 1,
  pageSize = 20,
  prismaClient = defaultPrisma,
}) {
  if (!madrasaId) {
    throw new BadRequestError('Tenant madrasaId is required.');
  }

  const where = { madrasaId };

  if (classId && typeof classId === 'string' && classId.trim().length > 0) {
    where.classId = classId.trim();
  }

  if (search && typeof search === 'string' && search.trim().length > 0) {
    const term = search.trim();
    where.OR = [
      { fullName: { contains: term } },
      { admissionNo: { contains: term } },
    ];
  }

  if (status === 'ACTIVE_TOKEN') {
    where.scanTokens = { some: { isActive: true } };
  } else if (status === 'MISSING_TOKEN') {
    where.scanTokens = { none: { isActive: true } };
  } else if (status === 'REVOKED') {
    where.scanTokens = { some: { revokedAt: { not: null } } };
  }

  const skip = (Math.max(1, page) - 1) * pageSize;
  const take = Math.min(100, Math.max(1, pageSize));

  const [total, students] = await Promise.all([
    prismaClient.student.count({ where }),
    prismaClient.student.findMany({
      where,
      skip,
      take,
      orderBy: { admissionNo: 'asc' },
      select: {
        id: true,
        admissionNo: true,
        fullName: true,
        status: true,
        classId: true,
        class: {
          select: { id: true, name: true },
        },
        scanTokens: {
          where: { isActive: true },
          take: 1,
          select: {
            id: true,
            tokenHint: true,
            version: true,
            scanCount: true,
            lastScannedAt: true,
            issuedAt: true,
          },
        },
      },
    }),
  ]);

  const items = students.map((s) => {
    const activeToken = s.scanTokens && s.scanTokens.length > 0 ? s.scanTokens[0] : null;
    return {
      studentId: s.id,
      admissionNo: s.admissionNo,
      fullName: s.fullName,
      studentStatus: s.status,
      classId: s.classId,
      className: s.class?.name || null,
      hasActiveToken: Boolean(activeToken),
      tokenId: activeToken?.id || null,
      tokenHint: activeToken?.tokenHint || null,
      version: activeToken?.version || null,
      scanCount: activeToken?.scanCount ?? 0,
      lastScannedAt: activeToken?.lastScannedAt || null,
      issuedAt: activeToken?.issuedAt || null,
    };
  });

  return {
    items,
    total,
    page,
    pageSize: take,
    totalPages: Math.max(1, Math.ceil(total / take)),
  };
}

/**
 * Retrieves and decrypts active tokens for batch card printing within tenant boundary.
 *
 * @param {object} params
 * @param {string} params.madrasaId - Tenant madrasa ID
 * @param {string[]} [params.studentIds] - Optional array of student IDs
 * @param {string} [params.classId] - Optional class ID
 * @param {string} [params.keyHex] - Optional encryption key override
 * @param {object} [params.prismaClient] - Injected Prisma client
 * @returns {Promise<{ cards: Array<{ student: object, card: object }> }>}
 */
export async function getBatchCardPrintData({
  madrasaId,
  studentIds = null,
  classId = null,
  keyHex = null,
  prismaClient = defaultPrisma,
}) {
  if (!madrasaId) {
    throw new BadRequestError('Tenant madrasaId is required.');
  }

  const where = { madrasaId };

  if (studentIds && Array.isArray(studentIds) && studentIds.length > 0) {
    where.id = { in: studentIds };
  }
  if (classId && typeof classId === 'string' && classId.trim().length > 0) {
    where.classId = classId.trim();
  }

  const students = await prismaClient.student.findMany({
    where,
    orderBy: { admissionNo: 'asc' },
    select: {
      id: true,
      admissionNo: true,
      fullName: true,
      status: true,
      admissionDate: true,
      photoFileId: true,
      classId: true,
      class: {
        select: { id: true, name: true },
      },
      scanTokens: {
        where: { isActive: true },
        take: 1,
      },
    },
  });

  const encryptionKey = getTokenEncryptionKey(keyHex);
  const cards = [];

  for (const s of students) {
    const activeToken = s.scanTokens && s.scanTokens.length > 0 ? s.scanTokens[0] : null;
    if (!activeToken) {
      continue;
    }

    const rawToken = decryptToken({
      tokenEncrypted: activeToken.tokenEncrypted,
      tokenIv: activeToken.tokenIv,
      tokenAuthTag: activeToken.tokenAuthTag,
    }, encryptionKey);

    cards.push({
      student: {
        id: s.id,
        admissionNo: s.admissionNo,
        fullName: s.fullName,
        className: s.class?.name || null,
        classId: s.classId,
        admissionDate: s.admissionDate,
        photoFileId: s.photoFileId,
        status: s.status,
      },
      card: {
        tokenId: activeToken.id,
        tokenHint: activeToken.tokenHint,
        version: activeToken.version,
        issuedAt: activeToken.issuedAt,
        rawToken,
      },
    });
  }

  return { cards };
}

