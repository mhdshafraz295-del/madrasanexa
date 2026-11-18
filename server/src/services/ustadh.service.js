import { prisma } from '../lib/prisma.js';
import { NotFoundError, BadRequestError, ConflictError } from '../utils/errors.js';
import { logTenantActivity } from './tenant.service.js';
import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

/**
 * Parses YYYY-MM-DD into a UTC midnight Date object to prevent timezone shifts.
 *
 * @param {string} dateStr
 * @returns {Date}
 */
export function parseDateOnly(dateStr) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new BadRequestError('Invalid date format. Expected YYYY-MM-DD.');
  }
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

/**
 * Formats a Date object into YYYY-MM-DD string.
 *
 * @param {Date|string} d
 * @returns {string}
 */
export function formatDateOnly(d) {
  if (!d) return '';
  const dateObj = typeof d === 'string' ? new Date(d) : d;
  const year = dateObj.getUTCFullYear();
  const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Normalizes an international E.164 phone number to digits-only for wa.me.
 * Example: "+94783254552" -> "94783254552"
 *
 * @param {string} whatsappNumber
 * @returns {string}
 */
export function normalizeWaMeDigits(whatsappNumber) {
  if (!whatsappNumber) return '';
  return String(whatsappNumber).replace(/\D/g, '');
}

/**
 * Generates a wa.me URL with pre-filled encoded text.
 *
 * @param {string} whatsappNumber
 * @param {string} messageText
 * @returns {string}
 */
export function buildWaMeUrl(whatsappNumber, messageText) {
  const digits = normalizeWaMeDigits(whatsappNumber);
  if (!digits) return '';
  return `https://wa.me/${digits}?text=${encodeURIComponent(messageText)}`;
}

/**
 * Generates the next sequential Ustadh code for a tenant (e.g. UST001, UST002).
 *
 * @param {string} madrasaId
 * @returns {Promise<string>}
 */
export async function calculateNextUstadhCode(madrasaId) {
  const ustadhs = await prisma.ustadh.findMany({
    where: {
      madrasaId,
      ustadhCode: { startsWith: 'UST' },
    },
    select: { ustadhCode: true },
  });

  let maxNum = 0;
  for (const u of ustadhs) {
    const match = u.ustadhCode.match(/^UST(\d+)$/i);
    if (match) {
      const n = parseInt(match[1], 10);
      if (!isNaN(n) && n > maxNum) {
        maxNum = n;
      }
    }
  }

  const nextNum = maxNum + 1;
  return `UST${String(nextNum).padStart(3, '0')}`;
}

/**
 * Creates a new Ustadh profile with concurrency-safe code generation and retry loop.
 *
 * @param {string} madrasaId
 * @param {string} userId
 * @param {object} data
 * @returns {Promise<object>}
 */
export async function createUstadh(madrasaId, userId, data) {
  const isCustomCode = Boolean(data.ustadhCode && data.ustadhCode.trim());
  const maxRetries = isCustomCode ? 1 : 5;
  let attempt = 0;

  while (attempt < maxRetries) {
    attempt++;
    const codeToUse = isCustomCode
      ? data.ustadhCode.trim()
      : await calculateNextUstadhCode(madrasaId);

    try {
      const created = await prisma.ustadh.create({
        data: {
          madrasaId,
          ustadhCode: codeToUse,
          staffType: data.staffType || 'USTADH',
          fullName: data.fullName.trim(),
          phoneNumber: data.phoneNumber ? data.phoneNumber.trim() : null,
          whatsappNumber: data.whatsappNumber ? data.whatsappNumber.trim() : null,
          email: data.email ? data.email.trim() : null,
          address: data.address ? data.address.trim() : null,
          joinDate: parseDateOnly(data.joinDate),
          leaveDate: data.leaveDate ? parseDateOnly(data.leaveDate) : null,
          baseMonthlySalary: new Prisma.Decimal(data.baseMonthlySalary),
          isActive: data.isActive !== undefined ? data.isActive : true,
          notes: data.notes ? data.notes.trim() : null,
        },
      });

      logTenantActivity({
        madrasaId,
        userId,
        action: 'USTADH_CREATED',
        entityType: 'Ustadh',
        entityId: created.id,
        metadata: { ustadhCode: created.ustadhCode, fullName: created.fullName },
      }).catch(() => {});

      return formatUstadhResponse(created);
    } catch (err) {
      if (err.code === 'P2002' && err.meta?.target?.includes('ustadhCode')) {
        if (isCustomCode) {
          throw new ConflictError(`Ustadh code "${codeToUse}" is already taken.`);
        }
        // Concurrency collision on auto-generated code: retry with freshly calculated code
        if (attempt >= maxRetries) {
          throw new ConflictError('Could not allocate a unique Ustadh code due to high concurrency. Please try again.');
        }
        continue;
      }
      throw err;
    }
  }
}

/**
 * Lists Ustadhs for a tenant with optional search and pagination.
 *
 * @param {string} madrasaId
 * @param {object} query
 * @returns {Promise<object>}
 */
export async function listUstadhs(madrasaId, query = {}) {
  const { search, isActive, staffType, page = 1, pageSize = 50 } = query;
  const where = { madrasaId };

  if (isActive !== undefined && isActive !== '') {
    where.isActive = isActive === 'true' || isActive === true;
  }

  if (staffType && ['USTADH', 'SCHOOL_TEACHER'].includes(staffType)) {
    where.staffType = staffType;
  }

  if (search && search.trim()) {
    const s = search.trim();
    where.OR = [
      { fullName: { contains: s } },
      { ustadhCode: { contains: s } },
      { phoneNumber: { contains: s } },
      { email: { contains: s } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.ustadh.count({ where }),
    prisma.ustadh.findMany({
      where,
      orderBy: [{ isActive: 'desc' }, { ustadhCode: 'asc' }],
      skip: (Number(page) - 1) * Number(pageSize),
      take: Number(pageSize),
      include: {
        _count: {
          select: {
            schedules: { where: { isActive: true } },
          },
        },
      },
    }),
  ]);

  return {
    items: items.map((u) => ({
      ...formatUstadhResponse(u),
      activeScheduleCount: u._count.schedules,
    })),
    total,
    page: Number(page),
    pageSize: Number(pageSize),
    totalPages: Math.ceil(total / Number(pageSize)) || 1,
  };
}

/**
 * Gets a single Ustadh profile by ID.
 *
 * @param {string} madrasaId
 * @param {string} ustadhId
 * @returns {Promise<object>}
 */
export async function getUstadhById(madrasaId, ustadhId) {
  const ustadh = await prisma.ustadh.findFirst({
    where: { id: ustadhId, madrasaId },
    include: {
      schedules: {
        where: { isActive: true },
        include: {
          class: { select: { id: true, name: true, code: true } },
          subject: { select: { id: true, name: true, code: true } },
        },
        orderBy: [{ dayOfWeek: 'asc' }, { startMinutes: 'asc' }],
      },
    },
  });

  if (!ustadh) {
    throw new NotFoundError('Ustadh not found.');
  }

  return {
    ...formatUstadhResponse(ustadh),
    schedules: ustadh.schedules.map((s) => ({
      id: s.id,
      dayOfWeek: s.dayOfWeek,
      startMinutes: s.startMinutes,
      endMinutes: s.endMinutes,
      effectiveFrom: formatDateOnly(s.effectiveFrom),
      effectiveTo: s.effectiveTo ? formatDateOnly(s.effectiveTo) : null,
      isActive: s.isActive,
      class: s.class,
      subject: s.subject,
    })),
  };
}

/**
 * Updates an Ustadh profile.
 *
 * @param {string} madrasaId
 * @param {string} ustadhId
 * @param {string} userId
 * @param {object} data
 * @returns {Promise<object>}
 */
export async function updateUstadh(madrasaId, ustadhId, userId, data) {
  const existing = await prisma.ustadh.findFirst({
    where: { id: ustadhId, madrasaId },
  });

  if (!existing) {
    throw new NotFoundError('Ustadh not found.');
  }

  const updateData = {};
  if (data.staffType !== undefined) updateData.staffType = data.staffType;
  if (data.fullName !== undefined) updateData.fullName = data.fullName.trim();
  if (data.phoneNumber !== undefined) updateData.phoneNumber = data.phoneNumber ? data.phoneNumber.trim() : null;
  if (data.whatsappNumber !== undefined) updateData.whatsappNumber = data.whatsappNumber ? data.whatsappNumber.trim() : null;
  if (data.email !== undefined) updateData.email = data.email ? data.email.trim() : null;
  if (data.address !== undefined) updateData.address = data.address ? data.address.trim() : null;
  if (data.notes !== undefined) updateData.notes = data.notes ? data.notes.trim() : null;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  if (data.joinDate !== undefined) {
    updateData.joinDate = parseDateOnly(data.joinDate);
  }
  if (data.leaveDate !== undefined) {
    updateData.leaveDate = data.leaveDate ? parseDateOnly(data.leaveDate) : null;
  }
  if (data.baseMonthlySalary !== undefined) {
    updateData.baseMonthlySalary = new Prisma.Decimal(data.baseMonthlySalary);
  }

  // If ustadhCode changed, check uniqueness
  if (data.ustadhCode && data.ustadhCode.trim() !== existing.ustadhCode) {
    updateData.ustadhCode = data.ustadhCode.trim();
  }

  try {
    let updated;
    if (data.isActive === false && existing.userId) {
      [updated] = await prisma.$transaction([
        prisma.ustadh.update({
          where: { id: existing.id },
          data: updateData,
        }),
        prisma.user.update({
          where: { id: existing.userId },
          data: {
            isActive: false,
            tokenVersion: { increment: 1 },
          },
        }),
      ]);
    } else {
      updated = await prisma.ustadh.update({
        where: { id: existing.id },
        data: updateData,
      });
    }

    logTenantActivity({
      madrasaId,
      userId,
      action: 'USTADH_UPDATED',
      entityType: 'Ustadh',
      entityId: updated.id,
      metadata: { ustadhCode: updated.ustadhCode, fullName: updated.fullName },
    }).catch(() => {});

    return formatUstadhResponse(updated);
  } catch (err) {
    if (err.code === 'P2002' && err.meta?.target?.includes('ustadhCode')) {
      throw new ConflictError(`Ustadh code "${updateData.ustadhCode}" is already taken.`);
    }
    throw err;
  }
}

/**
 * Atomically deactivates an Ustadh and any linked User account, incrementing tokenVersion to revoke active JWTs.
 *
 * @param {string} madrasaId
 * @param {string} ustadhId
 * @param {string} adminUserId
 * @returns {Promise<object>}
 */
export async function deactivateUstadhAccount(madrasaId, ustadhId, adminUserId) {
  const existing = await prisma.ustadh.findFirst({
    where: { id: ustadhId, madrasaId },
  });

  if (!existing) {
    throw new NotFoundError('Ustadh not found.');
  }

  const operations = [
    prisma.ustadh.update({
      where: { id: existing.id },
      data: { isActive: false },
    }),
  ];

  if (existing.userId) {
    operations.push(
      prisma.user.update({
        where: { id: existing.userId },
        data: {
          isActive: false,
          tokenVersion: { increment: 1 },
        },
      })
    );
  }

  const [updatedUstadh] = await prisma.$transaction(operations);

  logTenantActivity({
    madrasaId,
    userId: adminUserId,
    action: 'USTADH_DEACTIVATED',
    entityType: 'Ustadh',
    entityId: updatedUstadh.id,
    metadata: {
      ustadhCode: updatedUstadh.ustadhCode,
      hasLinkedUser: Boolean(existing.userId),
      tokenRevoked: Boolean(existing.userId),
    },
  }).catch(() => {});

  return formatUstadhResponse(updatedUstadh);
}

/**
 * Links an Ustadh to a User account with TEACHER role.
 *
 * @param {string} madrasaId
 * @param {string} ustadhId
 * @param {string} targetUserId
 * @param {string} adminUserId
 * @returns {Promise<object>}
 */
export async function linkUstadhToUser(madrasaId, ustadhId, targetUserId, adminUserId) {
  const ustadh = await prisma.ustadh.findFirst({
    where: { id: ustadhId, madrasaId },
  });

  if (!ustadh) {
    throw new NotFoundError('Ustadh not found.');
  }

  if (ustadh.userId) {
    throw new ConflictError('Ustadh is already linked to a user account.');
  }

  const user = await prisma.user.findFirst({
    where: { id: targetUserId, madrasaId },
  });

  if (!user) {
    throw new NotFoundError('User not found in this institution.');
  }

  if (user.role !== 'TEACHER') {
    throw new ConflictError('User must have TEACHER role to be linked to an Ustadh profile.');
  }

  const existingLink = await prisma.ustadh.findFirst({
    where: { userId: targetUserId },
  });

  if (existingLink) {
    throw new ConflictError('User is already linked to another Ustadh profile.');
  }

  const updated = await prisma.ustadh.update({
    where: { id: ustadh.id },
    data: { userId: user.id },
  });

  logTenantActivity({
    madrasaId,
    userId: adminUserId,
    action: 'USTADH_USER_LINKED',
    entityType: 'Ustadh',
    entityId: updated.id,
    metadata: { ustadhCode: updated.ustadhCode, userId: user.id },
  }).catch(() => {});

  return formatUstadhResponse(updated);
}

/**
 * Generates a readable 8-character OTP avoiding ambiguous characters (0, O, 1, l, I).
 * Format: <Prefix>@<4-digits> (e.g. Mdx@7492).
 *
 * @param {string} [prefix='Mdx']
 * @returns {string}
 */
export function generateReadableOtp(prefix = 'Mdx') {
  let clean = (prefix || 'Mdx').replace(/[^a-zA-Z]/g, '').slice(0, 3);
  if (!clean) clean = 'Mdx';
  clean = clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();

  // Digits pool avoiding 0 and 1
  const digitsPool = '23456789';
  let digits = '';
  for (let i = 0; i < 4; i++) {
    digits += digitsPool.charAt(Math.floor(Math.random() * digitsPool.length));
  }
  return `${clean}@${digits}`;
}

/**
 * Resolves the live Teacher Portal base URL with dynamic fallback.
 *
 * @param {string} [customUrl]
 * @returns {string}
 */
export function resolveTeacherPortalUrl(customUrl = null) {
  if (customUrl && typeof customUrl === 'string' && customUrl.trim()) {
    return customUrl.trim().replace(/\/+$/, '');
  }
  if (process.env.TEACHER_PORTAL_URL && process.env.TEACHER_PORTAL_URL.trim()) {
    return process.env.TEACHER_PORTAL_URL.trim().replace(/\/+$/, '');
  }
  return 'http://localhost:5174';
}

/**
 * Creates or resets a linked TEACHER portal user account for an existing Ustadh profile.
 * Supports auto-generating readable OTPs, dynamic deep-links, and institutional fallback emails.
 *
 * @param {string} madrasaId
 * @param {string} ustadhId
 * @param {string} adminUserId
 * @param {{ email?: string, password?: string, mustChangePassword?: boolean, teacherPortalUrl?: string, isReset?: boolean }} data
 * @returns {Promise<object>}
 */
export async function createPortalAccountForUstadh(madrasaId, ustadhId, adminUserId, data = {}) {
  const ustadh = await prisma.ustadh.findFirst({
    where: { id: ustadhId, madrasaId },
  });

  if (!ustadh) {
    throw new NotFoundError('Ustadh not found.');
  }

  // Fetch institution name & code
  const madrasa = await prisma.madrasa.findUnique({
    where: { id: madrasaId },
    select: { id: true, name: true, code: true },
  });

  const madrasaCode = madrasa?.code || 'MDX';
  const madrasaName = madrasa?.name || 'Madrasa';
  const baseUrl = resolveTeacherPortalUrl(data.teacherPortalUrl);

  // Case 1: Ustadh already has a linked portal account -> Reset / Re-provision credentials
  if (ustadh.userId) {
    const existingUser = await prisma.user.findUnique({
      where: { id: ustadh.userId },
    });

    if (existingUser) {
      const targetEmail = (data.email || existingUser.email || ustadh.email || '').trim().toLowerCase() ||
        `${ustadh.ustadhCode.toLowerCase()}@${madrasaCode.toLowerCase()}.madrasanexa.local`;

      // If updating email, check uniqueness
      if (targetEmail !== existingUser.email) {
        const emailTaken = await prisma.user.findFirst({
          where: {
            email: targetEmail,
            id: { not: existingUser.id },
          },
        });
        if (emailTaken) {
          throw new ConflictError(`An account with email "${targetEmail}" already exists.`);
        }
      }

      const rawPassword = data.password && data.password.trim()
        ? data.password.trim()
        : generateReadableOtp(madrasaCode);
      const passwordHash = await bcrypt.hash(rawPassword, 10);
      const mustChange = data.mustChangePassword !== undefined ? Boolean(data.mustChangePassword) : true;

      const [updatedUser, updatedUstadh] = await prisma.$transaction(async (tx) => {
        const uUser = await tx.user.update({
          where: { id: existingUser.id },
          data: {
            email: targetEmail,
            name: ustadh.fullName,
            passwordHash,
            mustChangePassword: mustChange,
            isActive: true,
            tokenVersion: { increment: 1 },
          },
        });

        const uUstadh = await tx.ustadh.update({
          where: { id: ustadh.id },
          data: {
            email: targetEmail,
          },
        });

        return [uUser, uUstadh];
      });

      logTenantActivity({
        madrasaId,
        userId: adminUserId,
        action: 'TEACHER_PORTAL_PASSWORD_RESET',
        entityType: 'Ustadh',
        entityId: updatedUstadh.id,
        metadata: {
          ustadhCode: updatedUstadh.ustadhCode,
          userId: updatedUser.id,
          email: targetEmail,
          mustChangePassword: mustChange,
        },
      }).catch(() => {});

      const loginUrl = `${baseUrl}/login?code=${encodeURIComponent(madrasaCode)}&email=${encodeURIComponent(updatedUser.email)}`;

      return {
        ustadh: formatUstadhResponse(updatedUstadh),
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          name: updatedUser.name,
          role: updatedUser.role,
          mustChangePassword: updatedUser.mustChangePassword,
          temporaryPassword: rawPassword,
        },
        credentials: {
          madrasaName,
          madrasaCode,
          ustadhName: updatedUstadh.fullName,
          ustadhCode: updatedUstadh.ustadhCode,
          loginIdentifier: updatedUser.email,
          temporaryPassword: rawPassword,
          teacherPortalUrl: baseUrl,
          loginUrl,
          whatsappNumber: updatedUstadh.whatsappNumber || updatedUstadh.phoneNumber || null,
          email: updatedUser.email,
        },
        isReset: true,
      };
    }
  }

  // Case 2: New Portal Account Provisioning
  const emailToUse = (data.email || ustadh.email || '').trim().toLowerCase() ||
    `${ustadh.ustadhCode.toLowerCase()}@${madrasaCode.toLowerCase()}.madrasanexa.local`;

  // Check if a User with this email already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: emailToUse },
  });

  if (existingUser) {
    if (existingUser.madrasaId === madrasaId && existingUser.role === 'TEACHER') {
      const linkedAnother = await prisma.ustadh.findFirst({
        where: { userId: existingUser.id },
      });
      if (!linkedAnother) {
        // Link to existing unlinked teacher user and update password
        const rawPassword = data.password && data.password.trim()
          ? data.password.trim()
          : generateReadableOtp(madrasaCode);
        const passwordHash = await bcrypt.hash(rawPassword, 10);
        const mustChange = data.mustChangePassword !== undefined ? Boolean(data.mustChangePassword) : true;

        const [updatedUser, updatedUstadh] = await prisma.$transaction(async (tx) => {
          const uUser = await tx.user.update({
            where: { id: existingUser.id },
            data: {
              passwordHash,
              mustChangePassword: mustChange,
              tokenVersion: { increment: 1 },
            },
          });

          const uUstadh = await tx.ustadh.update({
            where: { id: ustadh.id },
            data: { userId: existingUser.id, email: emailToUse },
          });

          return [uUser, uUstadh];
        });

        logTenantActivity({
          madrasaId,
          userId: adminUserId,
          action: 'TEACHER_PORTAL_ACCOUNT_LINKED',
          entityType: 'Ustadh',
          entityId: updatedUstadh.id,
          metadata: { ustadhCode: updatedUstadh.ustadhCode, userId: updatedUser.id, email: emailToUse },
        }).catch(() => {});

        const loginUrl = `${baseUrl}/login?code=${encodeURIComponent(madrasaCode)}&email=${encodeURIComponent(updatedUser.email)}`;

        return {
          ustadh: formatUstadhResponse(updatedUstadh),
          user: {
            id: updatedUser.id,
            email: updatedUser.email,
            name: updatedUser.name,
            role: updatedUser.role,
            mustChangePassword: updatedUser.mustChangePassword,
            temporaryPassword: rawPassword,
          },
          credentials: {
            madrasaName,
            madrasaCode,
            ustadhName: updatedUstadh.fullName,
            ustadhCode: updatedUstadh.ustadhCode,
            loginIdentifier: updatedUser.email,
            temporaryPassword: rawPassword,
            teacherPortalUrl: baseUrl,
            loginUrl,
            whatsappNumber: updatedUstadh.whatsappNumber || updatedUstadh.phoneNumber || null,
            email: updatedUser.email,
          },
          isReset: false,
        };
      }
    }
    throw new ConflictError(`An account with email "${emailToUse}" already exists.`);
  }

  // Generate readable OTP and hash
  const rawPassword = data.password && data.password.trim()
    ? data.password.trim()
    : generateReadableOtp(madrasaCode);
  const passwordHash = await bcrypt.hash(rawPassword, 10);
  const mustChange = data.mustChangePassword !== undefined ? Boolean(data.mustChangePassword) : true;

  // Execute atomically in transaction
  const [createdUser, updatedUstadh] = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        madrasaId,
        name: ustadh.fullName,
        email: emailToUse,
        passwordHash,
        role: 'TEACHER',
        mustChangePassword: mustChange,
        isActive: true,
        tokenVersion: 1,
      },
    });

    const updated = await tx.ustadh.update({
      where: { id: ustadh.id },
      data: {
        userId: newUser.id,
        email: emailToUse,
      },
    });

    return [newUser, updated];
  });

  logTenantActivity({
    madrasaId,
    userId: adminUserId,
    action: 'TEACHER_PORTAL_ACCOUNT_CREATED',
    entityType: 'Ustadh',
    entityId: updatedUstadh.id,
    metadata: {
      ustadhCode: updatedUstadh.ustadhCode,
      userId: createdUser.id,
      email: emailToUse,
      mustChangePassword: mustChange,
    },
  }).catch(() => {});

  const loginUrl = `${baseUrl}/login?code=${encodeURIComponent(madrasaCode)}&email=${encodeURIComponent(createdUser.email)}`;

  return {
    ustadh: formatUstadhResponse(updatedUstadh),
    user: {
      id: createdUser.id,
      email: createdUser.email,
      name: createdUser.name,
      role: createdUser.role,
      mustChangePassword: createdUser.mustChangePassword,
      temporaryPassword: rawPassword,
    },
    credentials: {
      madrasaName,
      madrasaCode,
      ustadhName: updatedUstadh.fullName,
      ustadhCode: updatedUstadh.ustadhCode,
      loginIdentifier: createdUser.email,
      temporaryPassword: rawPassword,
      teacherPortalUrl: baseUrl,
      loginUrl,
      whatsappNumber: updatedUstadh.whatsappNumber || updatedUstadh.phoneNumber || null,
      email: createdUser.email,
    },
    isReset: false,
  };
}

/**
 * Formats database Ustadh record for API responses.
 *
 * @param {object} u
 * @returns {object}
 */
export function formatUstadhResponse(u) {
  return {
    id: u.id,
    madrasaId: u.madrasaId,
    ustadhCode: u.ustadhCode,
    staffType: u.staffType || 'USTADH',
    fullName: u.fullName,
    phoneNumber: u.phoneNumber,
    whatsappNumber: u.whatsappNumber,
    normalizedWhatsApp: normalizeWaMeDigits(u.whatsappNumber),
    email: u.email,
    address: u.address,
    joinDate: formatDateOnly(u.joinDate),
    leaveDate: u.leaveDate ? formatDateOnly(u.leaveDate) : null,
    baseMonthlySalary: parseFloat(u.baseMonthlySalary.toString()),
    isActive: u.isActive,
    userId: u.userId || null,
    hasPortalAccess: Boolean(u.userId),
    notes: u.notes,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}
