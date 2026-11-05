import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { resolveSubscriptionAccess } from './subscription.service.js';
import { NotFoundError, ConflictError } from '../utils/errors.js';
import { resolveObjectAccessUrl } from './r2.service.js';
import { normalizeEmail } from '../utils/email-normalization.js';

/**
 * Helper to build month sequence for date ranges.
 * Range options: 'current_month' (1), '3m' (3), '6m' (6), '12m' (12), 'year' (calendar year to date).
 */
function getMonthRangeSequence(rangeKey, nowUtc = new Date()) {
  const currentYear = nowUtc.getUTCFullYear();
  const currentMonth = nowUtc.getUTCMonth() + 1; // 1-12

  let monthCount = 12;
  if (rangeKey === 'current_month') monthCount = 1;
  else if (rangeKey === '3m') monthCount = 3;
  else if (rangeKey === '6m') monthCount = 6;
  else if (rangeKey === '12m') monthCount = 12;
  else if (rangeKey === 'year') monthCount = currentMonth;

  const months = [];
  for (let i = monthCount - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(currentYear, currentMonth - 1 - i, 1));
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1;
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    const label = d.toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
    const startUtc = new Date(Date.UTC(year, month - 1, 1));
    const endUtc = new Date(Date.UTC(year, month, 1));

    months.push({ year, month, monthKey, label, startUtc, endUtc });
  }

  return months;
}

/**
 * 1. TENANT DASHBOARD ANALYTICS
 *
 * Rules:
 * - Strictly tenant-scoped (madrasaId = trustedMadrasaId).
 * - Decimal-safe server arithmetic (no floating point precision drift).
 * - Billing-month performance (Invoice totalAmount vs PaymentAllocation amount).
 * - Actual cash collection by payment date (Payment.paidAt).
 * - VOID invoices and VOID payments strictly excluded.
 * - Subscription summary reuses resolveSubscriptionAccess (no duplicated resolver).
 * - True empty states when no records exist (no fake/demo data).
 */
export async function getDashboardSummary(madrasaId, range = '12m') {
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1;

  // 1. Basic Tenant Counts (Students, Classes, Teachers & Academic Sections)
  const [
    totalStudents,
    activeStudents,
    activeClasses,
    totalTeachers,
    activeTeachers,
    ustadhCount,
    schoolTeacherCount,
    activeSchedules,
    academicSections,
  ] = await Promise.all([
    prisma.student.count({ where: { madrasaId } }),
    prisma.student.count({ where: { madrasaId, status: 'ACTIVE' } }),
    prisma.class.count({ where: { madrasaId, isActive: true } }),
    prisma.ustadh.count({ where: { madrasaId } }),
    prisma.ustadh.count({ where: { madrasaId, isActive: true } }),
    prisma.ustadh.count({ where: { madrasaId, staffType: 'USTADH' } }),
    prisma.ustadh.count({ where: { madrasaId, staffType: 'SCHOOL_TEACHER' } }),
    prisma.ustadhSchedule.findMany({
      where: { madrasaId, isActive: true },
      select: { ustadhId: true, classId: true },
    }),
    prisma.academicSection.findMany({
      where: { madrasaId, isActive: true },
      select: {
        id: true,
        name: true,
        code: true,
        classes: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            _count: {
              select: { students: { where: { status: 'ACTIVE' } } },
            },
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
    }),
  ]);

  const assignedTeacherIds = new Set(activeSchedules.map((s) => s.ustadhId));
  const assignedClassIds = new Set(activeSchedules.map((s) => s.classId));

  const sectionsSummary = academicSections.map((sec) => {
    const classCount = sec.classes.length;
    const studentCount = sec.classes.reduce((sum, c) => sum + (c._count?.students || 0), 0);
    return {
      id: sec.id,
      name: sec.name,
      code: sec.code,
      classCount,
      studentCount,
    };
  });

  // 2. Current Month Billing Performance (Decimal-Safe)
  // Expected = sum of Invoice.totalAmount where billingYear/billingMonth matches and status != VOID
  const currentExpectedAgg = await prisma.invoice.aggregate({
    where: {
      madrasaId,
      billingYear: currentYear,
      billingMonth: currentMonth,
      status: { not: 'VOID' },
    },
    _sum: { totalAmount: true },
  });
  const currentMonthExpected = currentExpectedAgg._sum.totalAmount || new Prisma.Decimal(0);

  // Collected = sum of PaymentAllocation.amount allocated to non-VOID invoices for this billing month from COMPLETED payments
  const currentCollectedAgg = await prisma.paymentAllocation.aggregate({
    where: {
      madrasaId,
      invoice: {
        billingYear: currentYear,
        billingMonth: currentMonth,
        status: { not: 'VOID' },
      },
      payment: {
        status: 'COMPLETED',
      },
    },
    _sum: { amount: true },
  });
  const currentMonthCollected = currentCollectedAgg._sum.amount || new Prisma.Decimal(0);

  // Pending = max(0, Expected - Collected)
  const currentMonthPending = Prisma.Decimal.max(
    new Prisma.Decimal(0),
    currentMonthExpected.sub(currentMonthCollected)
  );

  // 3. Total Collectible Outstanding Balance
  // Sum of balanceAmount for all non-VOID invoices
  const outstandingAgg = await prisma.invoice.aggregate({
    where: {
      madrasaId,
      status: { not: 'VOID' },
    },
    _sum: { balanceAmount: true },
  });
  const totalOutstandingBalance = outstandingAgg._sum.balanceAmount || new Prisma.Decimal(0);

  // 4. Current Subscription Status (reusing Phase 5 resolver)
  const subscriptionAccess = await resolveSubscriptionAccess(madrasaId, now);

  // 5. Build Range Sequence for Authoritative Charts
  const monthSequence = getMonthRangeSequence(range, now);
  const earliestMonth = monthSequence[0];
  const latestMonth = monthSequence[monthSequence.length - 1];

  // A. Invoices grouped by billingYear, billingMonth for Monthly Fee Performance
  const invoicesInRange = await prisma.invoice.findMany({
    where: {
      madrasaId,
      status: { not: 'VOID' },
      OR: monthSequence.map((m) => ({
        billingYear: m.year,
        billingMonth: m.month,
      })),
    },
    select: {
      billingYear: true,
      billingMonth: true,
      totalAmount: true,
    },
  });

  // B. Payment allocations for invoices in this range from COMPLETED payments
  const allocationsInRange = await prisma.paymentAllocation.findMany({
    where: {
      madrasaId,
      invoice: {
        status: { not: 'VOID' },
        OR: monthSequence.map((m) => ({
          billingYear: m.year,
          billingMonth: m.month,
        })),
      },
      payment: {
        status: 'COMPLETED',
      },
    },
    select: {
      amount: true,
      invoice: {
        select: {
          billingYear: true,
          billingMonth: true,
        },
      },
    },
  });

  // Aggregate by monthKey for Chart 1 (Monthly Fee Performance)
  const expectedByMonth = new Map();
  for (const inv of invoicesInRange) {
    const key = `${inv.billingYear}-${String(inv.billingMonth).padStart(2, '0')}`;
    const prev = expectedByMonth.get(key) || new Prisma.Decimal(0);
    expectedByMonth.set(key, prev.add(inv.totalAmount));
  }

  const collectedByMonth = new Map();
  for (const alloc of allocationsInRange) {
    const key = `${alloc.invoice.billingYear}-${String(alloc.invoice.billingMonth).padStart(2, '0')}`;
    const prev = collectedByMonth.get(key) || new Prisma.Decimal(0);
    collectedByMonth.set(key, prev.add(alloc.amount));
  }

  const monthlyFeePerformance = monthSequence.map((m) => {
    const exp = expectedByMonth.get(m.monthKey) || new Prisma.Decimal(0);
    const col = collectedByMonth.get(m.monthKey) || new Prisma.Decimal(0);
    const pen = Prisma.Decimal.max(new Prisma.Decimal(0), exp.sub(col));

    return {
      month: m.monthKey,
      label: m.label,
      expected: Number(exp.toFixed(2)),
      collected: Number(col.toFixed(2)),
      pending: Number(pen.toFixed(2)),
    };
  });

  // C. Actual Cash Collection by Payment Date (Payment.paidAt) for Chart 2
  const paymentsInRange = await prisma.payment.findMany({
    where: {
      madrasaId,
      status: 'COMPLETED',
      paidAt: {
        gte: earliestMonth.startUtc,
        lt: latestMonth.endUtc,
      },
    },
    select: {
      amount: true,
      paidAt: true,
    },
  });

  const cashByMonth = new Map();
  for (const p of paymentsInRange) {
    const pYear = p.paidAt.getUTCFullYear();
    const pMonth = p.paidAt.getUTCMonth() + 1;
    const key = `${pYear}-${String(pMonth).padStart(2, '0')}`;
    const prev = cashByMonth.get(key) || new Prisma.Decimal(0);
    cashByMonth.set(key, prev.add(p.amount));
  }

  const monthlyCashCollection = monthSequence.map((m) => {
    const amount = cashByMonth.get(m.monthKey) || new Prisma.Decimal(0);
    return {
      month: m.monthKey,
      label: m.label,
      collected: Number(amount.toFixed(2)),
    };
  });

  // D. Student Status Distribution
  const studentStatusCounts = await prisma.student.groupBy({
    by: ['status'],
    where: { madrasaId },
    _count: { id: true },
  });

  const studentStatusDistribution = {
    active: 0,
    inactive: 0,
    archived: 0,
  };
  for (const row of studentStatusCounts) {
    if (row.status === 'ACTIVE') studentStatusDistribution.active = row._count.id;
    else if (row.status === 'INACTIVE') studentStatusDistribution.inactive = row._count.id;
    else if (row.status === 'ARCHIVED') studentStatusDistribution.archived = row._count.id;
  }

  // E. Invoice Status Distribution (Date-Aware Overdue Calculation)
  const [overdueCount, baseStatusCounts] = await Promise.all([
    prisma.invoice.count({
      where: {
        madrasaId,
        status: { in: ['PENDING', 'PARTIAL'] },
        dueDate: { lt: now },
        balanceAmount: { gt: 0 },
      },
    }),
    prisma.invoice.groupBy({
      by: ['status'],
      where: { madrasaId },
      _count: { id: true },
    }),
  ]);

  const invoiceStatusDistribution = {
    pending: 0,
    partial: 0,
    paid: 0,
    overdue: overdueCount,
    void: 0,
  };

  for (const row of baseStatusCounts) {
    const key = row.status.toLowerCase();
    if (key in invoiceStatusDistribution && key !== 'overdue') {
      invoiceStatusDistribution[key] = row._count.id;
    }
  }

  // Pending count displayed excludes those that are overdue
  invoiceStatusDistribution.pending = Math.max(0, invoiceStatusDistribution.pending - overdueCount);

  // F. Recent Activity (latest 10 entries)
  const recentActivity = await prisma.activityLog.findMany({
    where: { madrasaId },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  return {
    kpis: {
      totalStudents,
      activeStudents,
      activeClasses,
      currentMonthExpectedFees: Number(currentMonthExpected.toFixed(2)),
      currentMonthCollectedFees: Number(currentMonthCollected.toFixed(2)),
      currentMonthPendingFees: Number(currentMonthPending.toFixed(2)),
      totalOutstandingBalance: Number(totalOutstandingBalance.toFixed(2)),
    },
    subscription: {
      allowed: subscriptionAccess.allowed,
      code: subscriptionAccess.code,
      status: subscriptionAccess.status,
      daysRemaining: subscriptionAccess.daysRemaining,
      isExpiringSoon: subscriptionAccess.status === 'EXPIRING_SOON',
      subscription: subscriptionAccess.subscription
        ? {
            id: subscriptionAccess.subscription.id,
            startsAt: subscriptionAccess.subscription.startsAt,
            endsAt: subscriptionAccess.subscription.endsAt,
            plan: subscriptionAccess.subscription.plan
              ? {
                  id: subscriptionAccess.subscription.plan.id,
                  name: subscriptionAccess.subscription.plan.name,
                  code: subscriptionAccess.subscription.plan.code,
                  price: Number(subscriptionAccess.subscription.plan.price),
                  durationMonths: subscriptionAccess.subscription.plan.durationMonths,
                }
              : null,
          }
        : null,
    },
    charts: {
      monthlyFeePerformance,
      monthlyCashCollection,
      studentStatusDistribution,
      invoiceStatusDistribution,
    },
    recentActivity: recentActivity.map((log) => ({
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      metadata: log.metadata,
      createdAt: log.createdAt,
      user: log.user ? { id: log.user.id, name: log.user.name } : null,
    })),
    teacherStats: {
      totalTeachers,
      activeTeachers,
      ustadhCount,
      schoolTeacherCount,
      teachersWithClasses: assignedTeacherIds.size,
      classesWithTeachers: assignedClassIds.size,
    },
    academicGroupStats: {
      totalSections: academicSections.length,
      sections: sectionsSummary,
    },
  };
}

/**
 * 2. GET MADRASA SETTINGS (Read-Oriented)
 *
 * Rules:
 * - Read-oriented: retrieves Madrasa and MadrasaSetting without unnecessary database writes.
 * - Idempotent fallback: if a legacy Madrasa genuinely lacks settings, safely creates the 1-to-1 default row.
 * - Never leaks other tenants' data or sensitive platform secrets.
 */
export async function getMadrasaSettings(madrasaId) {
  const madrasa = await prisma.madrasa.findUnique({
    where: { id: madrasaId },
    include: { settings: true },
  });

  if (!madrasa) {
    throw new NotFoundError('Madrasa institution not found.');
  }

  // Idempotent fallback for legacy Madrasas without settings
  let settings = madrasa.settings;
  if (!settings) {
    settings = await prisma.madrasaSetting.upsert({
      where: { madrasaId },
      create: {
        madrasaId,
        invoicePrefix: 'INV-',
        receiptPrefix: 'REC-',
        currency: 'LKR',
        timezone: 'Asia/Colombo',
      },
      update: {},
    });
  }

  let logoUrl = null;
  if (madrasa.logoFileId) {
    try {
      const fileObj = await prisma.fileObject.findFirst({
        where: { id: madrasa.logoFileId, madrasaId, type: 'MADRASA_LOGO' },
        select: { objectKey: true },
      });
      if (fileObj?.objectKey) {
        logoUrl = await resolveObjectAccessUrl(fileObj.objectKey);
      }
    } catch (e) {
      // Non-blocking fallback
    }
  }

  return {
    madrasa: {
      id: madrasa.id,
      name: madrasa.name,
      code: madrasa.code,
      slug: madrasa.slug,
      email: madrasa.email,
      phone: madrasa.phone,
      address: madrasa.address,
      status: madrasa.status,
      logoFileId: madrasa.logoFileId,
      logoUrl,
      createdAt: madrasa.createdAt,
      updatedAt: madrasa.updatedAt,
    },
    settings: {
      id: settings.id,
      invoicePrefix: settings.invoicePrefix,
      receiptPrefix: settings.receiptPrefix,
      currency: settings.currency,
      timezone: settings.timezone || 'Asia/Colombo',
      academicYear: settings.academicYear,
      receiptHeader: settings.receiptHeader,
      receiptFooter: settings.receiptFooter,
      dateFormat: settings.dateFormat || 'DD/MM/YYYY',
      timeFormat: settings.timeFormat || '12_HOUR',
      workingHoursStart: settings.workingHoursStart || '07:30',
      workingHoursEnd: settings.workingHoursEnd || '16:30',
      workingDays: settings.workingDays || ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'],
      weeklyHolidays: settings.weeklyHolidays || ['SUNDAY'],
      attendanceStartTime: settings.attendanceStartTime || '07:30',
      attendanceClosingTime: settings.attendanceClosingTime || '08:30',
      lateMarkingTime: settings.lateMarkingTime || '08:00',
      attendanceGracePeriodMinutes: settings.attendanceGracePeriodMinutes ?? 15,
      autoAttendanceClosing: Boolean(settings.autoAttendanceClosing),
      timetableSlotDurationMinutes: settings.timetableSlotDurationMinutes ?? 45,
      updatedAt: settings.updatedAt,
    },
  };
}

/**
 * 3. UPDATE MADRASA SETTINGS
 *
 * Rules:
 * - Executes in prisma.$transaction for atomic profile + settings persistence.
 * - Strips and protects tenant identity fields (code, slug, status, id, madrasaId).
 * - Creates an ActivityLog entry: MADRASA_SETTINGS_UPDATED.
 */
export async function updateMadrasaSettings(
  madrasaId,
  data,
  userId = null,
  ipAddress = null,
  userAgent = null
) {
  const existingMadrasa = await prisma.madrasa.findUnique({
    where: { id: madrasaId },
    include: { settings: true },
  });

  if (!existingMadrasa) {
    throw new NotFoundError('Madrasa institution not found.');
  }

  const result = await prisma.$transaction(async (tx) => {
    // 1. Update Madrasa institution fields
    const madrasaUpdateData = {};
    if (data.name !== undefined) madrasaUpdateData.name = data.name;
    if (data.email !== undefined) madrasaUpdateData.email = data.email;
    if (data.phone !== undefined) madrasaUpdateData.phone = data.phone;
    if (data.address !== undefined) madrasaUpdateData.address = data.address;

    let updatedMadrasa = existingMadrasa;
    if (Object.keys(madrasaUpdateData).length > 0) {
      updatedMadrasa = await tx.madrasa.update({
        where: { id: madrasaId },
        data: madrasaUpdateData,
      });
    }

    // 2. Update MadrasaSetting fields
    const settingsUpdateData = {};
    if (data.invoicePrefix !== undefined) settingsUpdateData.invoicePrefix = data.invoicePrefix;
    if (data.receiptPrefix !== undefined) settingsUpdateData.receiptPrefix = data.receiptPrefix;
    if (data.currency !== undefined) settingsUpdateData.currency = data.currency;
    if (data.timezone !== undefined) settingsUpdateData.timezone = data.timezone;
    if (data.academicYear !== undefined) settingsUpdateData.academicYear = data.academicYear;
    if (data.receiptHeader !== undefined) settingsUpdateData.receiptHeader = data.receiptHeader;
    if (data.receiptFooter !== undefined) settingsUpdateData.receiptFooter = data.receiptFooter;

    // Centralized Date & Time Settings
    if (data.dateFormat !== undefined) settingsUpdateData.dateFormat = data.dateFormat;
    if (data.timeFormat !== undefined) settingsUpdateData.timeFormat = data.timeFormat;
    if (data.workingHoursStart !== undefined) settingsUpdateData.workingHoursStart = data.workingHoursStart;
    if (data.workingHoursEnd !== undefined) settingsUpdateData.workingHoursEnd = data.workingHoursEnd;
    if (data.workingDays !== undefined) settingsUpdateData.workingDays = data.workingDays;
    if (data.weeklyHolidays !== undefined) settingsUpdateData.weeklyHolidays = data.weeklyHolidays;
    if (data.attendanceStartTime !== undefined) settingsUpdateData.attendanceStartTime = data.attendanceStartTime;
    if (data.attendanceClosingTime !== undefined) settingsUpdateData.attendanceClosingTime = data.attendanceClosingTime;
    if (data.lateMarkingTime !== undefined) settingsUpdateData.lateMarkingTime = data.lateMarkingTime;
    if (data.attendanceGracePeriodMinutes !== undefined) settingsUpdateData.attendanceGracePeriodMinutes = data.attendanceGracePeriodMinutes;
    if (data.autoAttendanceClosing !== undefined) settingsUpdateData.autoAttendanceClosing = data.autoAttendanceClosing;
    if (data.timetableSlotDurationMinutes !== undefined) settingsUpdateData.timetableSlotDurationMinutes = data.timetableSlotDurationMinutes;

    const updatedSettings = await tx.madrasaSetting.upsert({
      where: { madrasaId },
      create: {
        madrasaId,
        invoicePrefix: data.invoicePrefix || 'INV-',
        receiptPrefix: data.receiptPrefix || 'REC-',
        currency: data.currency || 'LKR',
        timezone: data.timezone || 'Asia/Colombo',
        academicYear: data.academicYear || null,
        receiptHeader: data.receiptHeader || null,
        receiptFooter: data.receiptFooter || null,
        dateFormat: data.dateFormat || 'DD/MM/YYYY',
        timeFormat: data.timeFormat || '12_HOUR',
        workingHoursStart: data.workingHoursStart || '07:30',
        workingHoursEnd: data.workingHoursEnd || '16:30',
        workingDays: data.workingDays || ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'],
        weeklyHolidays: data.weeklyHolidays || ['SUNDAY'],
        attendanceStartTime: data.attendanceStartTime || '07:30',
        attendanceClosingTime: data.attendanceClosingTime || '08:30',
        lateMarkingTime: data.lateMarkingTime || '08:00',
        attendanceGracePeriodMinutes: data.attendanceGracePeriodMinutes ?? 15,
        autoAttendanceClosing: data.autoAttendanceClosing ?? false,
        timetableSlotDurationMinutes: data.timetableSlotDurationMinutes ?? 45,
      },
      update: settingsUpdateData,
    });

    // 3. ActivityLog audit entry
    await tx.activityLog.create({
      data: {
        madrasaId,
        userId,
        action: 'MADRASA_SETTINGS_UPDATED',
        entityType: 'MadrasaSetting',
        entityId: updatedSettings.id,
        metadata: {
          updatedMadrasaFields: Object.keys(madrasaUpdateData),
          updatedSettingFields: Object.keys(settingsUpdateData),
        },
        ipAddress,
        userAgent,
      },
    });

    return { madrasa: updatedMadrasa, settings: updatedSettings };
  });

  return {
    madrasa: {
      id: result.madrasa.id,
      name: result.madrasa.name,
      code: result.madrasa.code,
      slug: result.madrasa.slug,
      email: result.madrasa.email,
      phone: result.madrasa.phone,
      address: result.madrasa.address,
      status: result.madrasa.status,
      logoFileId: result.madrasa.logoFileId,
      createdAt: result.madrasa.createdAt,
      updatedAt: result.madrasa.updatedAt,
    },
    settings: {
      id: result.settings.id,
      invoicePrefix: result.settings.invoicePrefix,
      receiptPrefix: result.settings.receiptPrefix,
      currency: result.settings.currency,
      timezone: result.settings.timezone || 'Asia/Colombo',
      academicYear: result.settings.academicYear,
      receiptHeader: result.settings.receiptHeader,
      receiptFooter: result.settings.receiptFooter,
      dateFormat: result.settings.dateFormat || 'DD/MM/YYYY',
      timeFormat: result.settings.timeFormat || '12_HOUR',
      workingHoursStart: result.settings.workingHoursStart || '07:30',
      workingHoursEnd: result.settings.workingHoursEnd || '16:30',
      workingDays: result.settings.workingDays || ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'],
      weeklyHolidays: result.settings.weeklyHolidays || ['SUNDAY'],
      attendanceStartTime: result.settings.attendanceStartTime || '07:30',
      attendanceClosingTime: result.settings.attendanceClosingTime || '08:30',
      lateMarkingTime: result.settings.lateMarkingTime || '08:00',
      attendanceGracePeriodMinutes: result.settings.attendanceGracePeriodMinutes ?? 15,
      autoAttendanceClosing: Boolean(result.settings.autoAttendanceClosing),
      timetableSlotDurationMinutes: result.settings.timetableSlotDurationMinutes ?? 45,
      updatedAt: result.settings.updatedAt,
    },
  };
}

/**
 * 4. GET ADMIN PROFILE
 *
 * Returns the authenticated Madrasa Admin's profile.
 * Excludes passwordHash and private authentication secrets.
 */
export async function getAdminProfile(userId, madrasaId) {
  const user = await prisma.user.findFirst({
    where: { id: userId, madrasaId, role: 'MADRASA_ADMIN' },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    throw new NotFoundError('Administrator profile not found.');
  }

  return user;
}

/**
 * 5. UPDATE ADMIN PROFILE
 *
 * Allows updating name and email.
 * Rejects duplicate email collision globally.
 * Logs ADMIN_PROFILE_UPDATED to ActivityLog.
 */
export async function updateAdminProfile(
  userId,
  madrasaId,
  data,
  ipAddress = null,
  userAgent = null
) {
  const user = await prisma.user.findFirst({
    where: { id: userId, madrasaId, role: 'MADRASA_ADMIN' },
  });

  if (!user) {
    throw new NotFoundError('Administrator profile not found.');
  }

  const normalizedEmail = data.email ? normalizeEmail(data.email) : undefined;

  if (normalizedEmail && normalizedEmail !== user.email) {
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) {
      throw new ConflictError('This email address is already registered to another user.');
    }
  }

  const updateData = {};
  if (data.name !== undefined) updateData.name = data.name.trim();
  if (normalizedEmail !== undefined) updateData.email = normalizedEmail;

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  await prisma.activityLog.create({
    data: {
      madrasaId,
      userId,
      action: 'ADMIN_PROFILE_UPDATED',
      entityType: 'User',
      entityId: userId,
      metadata: {
        updatedFields: Object.keys(updateData),
      },
      ipAddress,
      userAgent,
    },
  });

  return updatedUser;
}

/**
 * 6. GET TENANT ACTIVITY
 *
 * Returns paginated, tenant-isolated ActivityLog entries.
 */
export async function getTenantActivity(madrasaId, page = 1, pageSize = 20, action = null) {
  const skip = (page - 1) * pageSize;
  const where = { madrasaId };
  if (action) {
    where.action = action;
  }

  const [total, logs] = await Promise.all([
    prisma.activityLog.count({ where }),
    prisma.activityLog.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
  ]);

  return {
    logs: logs.map((log) => ({
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      metadata: log.metadata,
      createdAt: log.createdAt,
      user: log.user ? { id: log.user.id, name: log.user.name, email: log.user.email } : null,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 1,
  };
}

/**
 * 7. GET SUBSCRIPTION OVERVIEW
 *
 * Reuses resolveSubscriptionAccess for current access calculation,
 * plus fetches historical terms and subscription payments for own tenant only.
 * Exempt from requireActiveSubscription so expired admins can view it.
 */
export async function getSubscriptionOverview(madrasaId) {
  const now = new Date();
  const currentAccess = await resolveSubscriptionAccess(madrasaId, now);

  const [terms, payments] = await Promise.all([
    prisma.subscription.findMany({
      where: { madrasaId },
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            code: true,
            price: true,
            durationMonths: true,
          },
        },
      },
      orderBy: { startsAt: 'desc' },
    }),
    prisma.subscriptionPayment.findMany({
      where: { madrasaId },
      include: {
        subscription: {
          include: {
            plan: { select: { name: true, code: true } },
          },
        },
      },
      orderBy: { paidAt: 'desc' },
    }),
  ]);

  return {
    currentAccess: {
      allowed: currentAccess.allowed,
      code: currentAccess.code,
      status: currentAccess.status,
      daysRemaining: currentAccess.daysRemaining,
      isExpiringSoon: currentAccess.status === 'EXPIRING_SOON',
      subscription: currentAccess.subscription
        ? {
            id: currentAccess.subscription.id,
            status: currentAccess.subscription.status,
            startsAt: currentAccess.subscription.startsAt,
            endsAt: currentAccess.subscription.endsAt,
            priceAtPurchase: Number(currentAccess.subscription.priceAtPurchase),
            durationMonthsAtPurchase: currentAccess.subscription.durationMonthsAtPurchase,
            plan: currentAccess.subscription.plan
              ? {
                  id: currentAccess.subscription.plan.id,
                  name: currentAccess.subscription.plan.name,
                  code: currentAccess.subscription.plan.code,
                }
              : null,
          }
        : null,
    },
    terms: terms.map((term) => ({
      id: term.id,
      status: term.status,
      startsAt: term.startsAt,
      endsAt: term.endsAt,
      priceAtPurchase: Number(term.priceAtPurchase),
      durationMonthsAtPurchase: term.durationMonthsAtPurchase,
      renewedAt: term.renewedAt,
      createdAt: term.createdAt,
      plan: {
        id: term.plan.id,
        name: term.plan.name,
        code: term.plan.code,
      },
    })),
    payments: payments.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      paymentMethod: p.paymentMethod,
      reference: p.reference,
      paidAt: p.paidAt,
      subscriptionId: p.subscriptionId,
      planName: p.subscription?.plan?.name || 'Subscription',
    })),
  };
}
