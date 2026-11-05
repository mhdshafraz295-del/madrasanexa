import { prisma } from '../lib/prisma.js';
import { Prisma } from '@prisma/client';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { calculateBillingBoundaries } from './invoice.service.js';

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Retrieves Madrasa context, branding, and timezone settings.
 *
 * @param {string} madrasaId
 * @returns {Promise<object>}
 */
export async function getMadrasaContext(madrasaId) {
  const madrasa = await prisma.madrasa.findUnique({
    where: { id: madrasaId },
    include: {
      settings: true,
    },
  });

  if (!madrasa) {
    throw new NotFoundError('Madrasa not found.');
  }

  const settings = madrasa.settings || {};
  const tz = settings.timezone || 'Asia/Colombo';
  const currency = settings.currency || 'LKR';

  // Safe logo resolution: only use if FileObject belongs to this tenant
  let logoDataUri = null;
  if (madrasa.logoFileId) {
    try {
      const fileObj = await prisma.fileObject.findFirst({
        where: { id: madrasa.logoFileId, madrasaId },
      });
      if (fileObj && fileObj.publicUrl && ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(fileObj.mimeType)) {
        logoDataUri = fileObj.publicUrl;
      }
    } catch (e) {
      // Non-blocking fallback
      logoDataUri = null;
    }
  }

  return {
    id: madrasa.id,
    name: madrasa.name,
    code: madrasa.code,
    phone: madrasa.phone || null,
    address: madrasa.address || null,
    logoUrl: logoDataUri,
    currency,
    timezone: tz,
    receiptHeader: settings.receiptHeader || null,
    receiptFooter: settings.receiptFooter || null,
    academicYear: settings.academicYear || null,
  };
}

/**
 * Validates that classId belongs to madrasa and matches academicSectionId if supplied.
 */
async function validateSectionClassHierarchy(madrasaId, academicSectionId, classId) {
  if (!classId) return;

  const cls = await prisma.class.findFirst({
    where: { id: classId, madrasaId },
    select: { id: true, academicSectionId: true, name: true },
  });

  if (!cls) {
    throw new NotFoundError('Class not found.');
  }

  if (academicSectionId !== undefined && academicSectionId !== null && cls.academicSectionId !== academicSectionId) {
    throw new BadRequestError('Selected class does not belong to the selected academic section.');
  }
}

/**
 * Computes authoritative completed allocations and balances for a set of invoices.
 * Rule: completedAllocated = SUM(PaymentAllocation.amount) WHERE Payment.status = COMPLETED
 */
function computeInvoiceFinancials(invoice, tz, nowTz) {
  let completedAllocated = new Prisma.Decimal(0);
  let lastPaymentDate = null;
  const receiptNumbers = [];

  if (Array.isArray(invoice.allocations)) {
    for (const alloc of invoice.allocations) {
      if (alloc.payment && alloc.payment.status === 'COMPLETED') {
        completedAllocated = completedAllocated.plus(alloc.amount);
        if (alloc.payment.paidAt) {
          if (!lastPaymentDate || new Date(alloc.payment.paidAt) > new Date(lastPaymentDate)) {
            lastPaymentDate = alloc.payment.paidAt;
          }
        }
        if (alloc.payment.receipt?.receiptNo) {
          receiptNumbers.push(alloc.payment.receipt.receiptNo);
        }
      }
    }
  }

  const isVoid = invoice.status === 'VOID';
  const totalAmount = new Prisma.Decimal(invoice.totalAmount || 0);
  const balance = isVoid ? new Prisma.Decimal(0) : totalAmount.minus(completedAllocated);
  const effectiveBalance = balance.lt(0) ? new Prisma.Decimal(0) : balance;

  // Authoritative Status Resolver
  let status = 'PENDING';
  let isOverdue = false;
  let daysOverdue = 0;

  if (isVoid) {
    status = 'VOID';
  } else if (effectiveBalance.isZero()) {
    status = 'PAID';
  } else if (completedAllocated.gt(0)) {
    status = 'PARTIAL';
    if (invoice.dueDate) {
      const dueDay = dayjs(invoice.dueDate).tz(tz).startOf('day');
      const currentDay = dayjs(nowTz).tz(tz).startOf('day');
      if (dueDay.isBefore(currentDay)) {
        isOverdue = true;
        daysOverdue = currentDay.diff(dueDay, 'day');
      }
    }
  } else {
    // completedAllocated === 0
    if (invoice.dueDate) {
      const dueDay = dayjs(invoice.dueDate).tz(tz).startOf('day');
      const currentDay = dayjs(nowTz).tz(tz).startOf('day');
      if (dueDay.isBefore(currentDay)) {
        status = 'OVERDUE';
        isOverdue = true;
        daysOverdue = currentDay.diff(dueDay, 'day');
      } else {
        status = 'PENDING';
      }
    } else {
      status = 'PENDING';
    }
  }

  return {
    totalAmount,
    paidAmount: completedAllocated,
    balanceAmount: effectiveBalance,
    status,
    isOverdue,
    daysOverdue,
    lastPaymentDate,
    receiptNo: receiptNumbers.length > 0 ? Array.from(new Set(receiptNumbers)).join(', ') : null,
  };
}

/**
 * 1. PAID STUDENTS REPORT
 * Only fully paid invoices (authoritative balance = 0 and not VOID).
 */
export async function buildPaidStudentsReport(madrasaId, filters = {}) {
  const madrasa = await getMadrasaContext(madrasaId);
  await validateSectionClassHierarchy(madrasaId, filters.academicSectionId, filters.classId);

  const nowTz = dayjs().tz(madrasa.timezone);
  const currentYear = nowTz.year();
  const currentMonth = nowTz.month() + 1;
  const billingYear = filters.billingYear || currentYear;
  const billingMonth = filters.billingMonth || currentMonth;

  const where = {
    madrasaId,
    billingYear,
    billingMonth,
    status: { not: 'VOID' },
  };

  if (filters.classId) {
    where.student = { classId: filters.classId };
  } else if (filters.academicSectionId) {
    where.student = {
      class: { academicSectionId: filters.academicSectionId },
    };
  }

  if (filters.search) {
    const s = filters.search.trim();
    where.student = {
      ...where.student,
      OR: [
        { fullName: { contains: s } },
        { admissionNo: { contains: s } },
      ],
    };
  }

  const invoices = await prisma.invoice.findMany({
    where,
    include: {
      student: {
        include: {
          class: {
            include: { academicSection: true },
          },
        },
      },
      allocations: {
        include: {
          payment: {
            include: { receipt: true },
          },
        },
      },
    },
    orderBy: [
      { student: { admissionNo: 'asc' } },
      { invoiceNo: 'asc' },
    ],
  });

  const paidRecords = [];
  let totalExpected = new Prisma.Decimal(0);
  let totalCollected = new Prisma.Decimal(0);

  for (const inv of invoices) {
    const fin = computeInvoiceFinancials(inv, madrasa.timezone, nowTz);
    if (fin.status === 'PAID') {
      totalExpected = totalExpected.plus(fin.totalAmount);
      totalCollected = totalCollected.plus(fin.paidAmount);

      paidRecords.push({
        id: inv.id,
        invoiceNo: inv.invoiceNo,
        admissionNo: inv.student.admissionNo,
        studentName: inv.student.fullName,
        sectionName: inv.student.class?.academicSection?.name || 'Unassigned',
        className: inv.student.class?.name || 'Unassigned',
        expectedAmount: fin.totalAmount.toFixed(2),
        paidAmount: fin.paidAmount.toFixed(2),
        balanceAmount: '0.00',
        status: 'PAID',
        lastPaymentDate: fin.lastPaymentDate ? dayjs(fin.lastPaymentDate).tz(madrasa.timezone).format('YYYY-MM-DD HH:mm') : '-',
        receiptNo: fin.receiptNo || '-',
      });
    }
  }

  const summary = {
    totalStudents: paidRecords.length,
    totalExpected: totalExpected.toFixed(2),
    totalCollected: totalCollected.toFixed(2),
    totalBalance: '0.00',
    currency: madrasa.currency,
  };

  return {
    reportType: 'PAID_STUDENTS',
    title: 'Paid Students Report',
    period: `${dayjs(`${billingYear}-${String(billingMonth).padStart(2, '0')}-01`).format('MMMM YYYY')}`,
    filters: {
      billingYear,
      billingMonth,
      academicSectionId: filters.academicSectionId || null,
      classId: filters.classId || null,
    },
    madrasa,
    summary,
    totalRecords: paidRecords.length,
    records: paidRecords,
  };
}

/**
 * 2. UNPAID STUDENTS REPORT
 * Invoices where completedAllocated = 0 and balance > 0 (PENDING or OVERDUE, excluding PARTIAL and PAID).
 */
export async function buildUnpaidStudentsReport(madrasaId, filters = {}) {
  const madrasa = await getMadrasaContext(madrasaId);
  await validateSectionClassHierarchy(madrasaId, filters.academicSectionId, filters.classId);

  const nowTz = dayjs().tz(madrasa.timezone);
  const billingYear = filters.billingYear || nowTz.year();
  const billingMonth = filters.billingMonth || (nowTz.month() + 1);

  const where = {
    madrasaId,
    billingYear,
    billingMonth,
    status: { not: 'VOID' },
  };

  if (filters.classId) {
    where.student = { classId: filters.classId };
  } else if (filters.academicSectionId) {
    where.student = {
      class: { academicSectionId: filters.academicSectionId },
    };
  }

  if (filters.search) {
    const s = filters.search.trim();
    where.student = {
      ...where.student,
      OR: [
        { fullName: { contains: s } },
        { admissionNo: { contains: s } },
      ],
    };
  }

  const invoices = await prisma.invoice.findMany({
    where,
    include: {
      student: {
        include: {
          class: {
            include: { academicSection: true },
          },
        },
      },
      allocations: {
        include: {
          payment: true,
        },
      },
    },
    orderBy: [
      { student: { admissionNo: 'asc' } },
      { invoiceNo: 'asc' },
    ],
  });

  const unpaidRecords = [];
  let totalExpected = new Prisma.Decimal(0);
  let totalBalance = new Prisma.Decimal(0);
  let pendingCount = 0;
  let overdueCount = 0;

  for (const inv of invoices) {
    const fin = computeInvoiceFinancials(inv, madrasa.timezone, nowTz);
    // Unpaid rule: paidAmount == 0 && balanceAmount > 0
    if (fin.paidAmount.isZero() && fin.balanceAmount.gt(0)) {
      if (filters.status === 'PENDING' && fin.status !== 'PENDING') continue;
      if (filters.status === 'OVERDUE' && fin.status !== 'OVERDUE') continue;

      totalExpected = totalExpected.plus(fin.totalAmount);
      totalBalance = totalBalance.plus(fin.balanceAmount);

      if (fin.status === 'OVERDUE') overdueCount++;
      else pendingCount++;

      unpaidRecords.push({
        id: inv.id,
        invoiceNo: inv.invoiceNo,
        admissionNo: inv.student.admissionNo,
        studentName: inv.student.fullName,
        sectionName: inv.student.class?.academicSection?.name || 'Unassigned',
        className: inv.student.class?.name || 'Unassigned',
        expectedAmount: fin.totalAmount.toFixed(2),
        paidAmount: '0.00',
        balanceAmount: fin.balanceAmount.toFixed(2),
        dueDate: inv.dueDate ? dayjs(inv.dueDate).tz(madrasa.timezone).format('YYYY-MM-DD') : '-',
        status: fin.status,
        guardianName: inv.student.guardianName || '-',
        guardianPhone: inv.student.guardianPhone || '-',
      });
    }
  }

  const summary = {
    totalUnpaid: unpaidRecords.length,
    pendingCount,
    overdueCount,
    totalExpected: totalExpected.toFixed(2),
    totalCollected: '0.00',
    totalOutstanding: totalBalance.toFixed(2),
    currency: madrasa.currency,
  };

  return {
    reportType: 'UNPAID_STUDENTS',
    title: 'Unpaid Students Report',
    period: `${dayjs(`${billingYear}-${String(billingMonth).padStart(2, '0')}-01`).format('MMMM YYYY')}`,
    filters: {
      billingYear,
      billingMonth,
      academicSectionId: filters.academicSectionId || null,
      classId: filters.classId || null,
      status: filters.status || 'ALL',
    },
    madrasa,
    summary,
    totalRecords: unpaidRecords.length,
    records: unpaidRecords,
  };
}

/**
 * 3. PARTIAL PAYMENTS REPORT
 * Invoices where completedAllocated > 0 and balance > 0.
 */
export async function buildPartialPaymentsReport(madrasaId, filters = {}) {
  const madrasa = await getMadrasaContext(madrasaId);
  await validateSectionClassHierarchy(madrasaId, filters.academicSectionId, filters.classId);

  const nowTz = dayjs().tz(madrasa.timezone);
  const billingYear = filters.billingYear || nowTz.year();
  const billingMonth = filters.billingMonth || (nowTz.month() + 1);

  const where = {
    madrasaId,
    billingYear,
    billingMonth,
    status: { not: 'VOID' },
  };

  if (filters.classId) {
    where.student = { classId: filters.classId };
  } else if (filters.academicSectionId) {
    where.student = {
      class: { academicSectionId: filters.academicSectionId },
    };
  }

  const invoices = await prisma.invoice.findMany({
    where,
    include: {
      student: {
        include: {
          class: {
            include: { academicSection: true },
          },
        },
      },
      allocations: {
        include: {
          payment: {
            include: { receipt: true },
          },
        },
      },
    },
    orderBy: [
      { student: { admissionNo: 'asc' } },
      { invoiceNo: 'asc' },
    ],
  });

  const partialRecords = [];
  let totalExpected = new Prisma.Decimal(0);
  let totalPaid = new Prisma.Decimal(0);
  let totalBalance = new Prisma.Decimal(0);

  for (const inv of invoices) {
    const fin = computeInvoiceFinancials(inv, madrasa.timezone, nowTz);
    if (fin.status === 'PARTIAL') {
      totalExpected = totalExpected.plus(fin.totalAmount);
      totalPaid = totalPaid.plus(fin.paidAmount);
      totalBalance = totalBalance.plus(fin.balanceAmount);

      partialRecords.push({
        id: inv.id,
        invoiceNo: inv.invoiceNo,
        admissionNo: inv.student.admissionNo,
        studentName: inv.student.fullName,
        sectionName: inv.student.class?.academicSection?.name || 'Unassigned',
        className: inv.student.class?.name || 'Unassigned',
        expectedAmount: fin.totalAmount.toFixed(2),
        paidAmount: fin.paidAmount.toFixed(2),
        balanceAmount: fin.balanceAmount.toFixed(2),
        dueDate: inv.dueDate ? dayjs(inv.dueDate).tz(madrasa.timezone).format('YYYY-MM-DD') : '-',
        status: fin.isOverdue ? 'PARTIAL (OVERDUE)' : 'PARTIAL',
        lastPaymentDate: fin.lastPaymentDate ? dayjs(fin.lastPaymentDate).tz(madrasa.timezone).format('YYYY-MM-DD HH:mm') : '-',
      });
    }
  }

  const summary = {
    totalPartial: partialRecords.length,
    totalExpected: totalExpected.toFixed(2),
    totalPaid: totalPaid.toFixed(2),
    totalOutstanding: totalBalance.toFixed(2),
    currency: madrasa.currency,
  };

  return {
    reportType: 'PARTIAL_PAYMENTS',
    title: 'Partial Payment Report',
    period: `${dayjs(`${billingYear}-${String(billingMonth).padStart(2, '0')}-01`).format('MMMM YYYY')}`,
    filters: {
      billingYear,
      billingMonth,
      academicSectionId: filters.academicSectionId || null,
      classId: filters.classId || null,
    },
    madrasa,
    summary,
    totalRecords: partialRecords.length,
    records: partialRecords,
  };
}

/**
 * 4. OVERDUE STUDENTS REPORT
 * Invoices where balance > 0 and dueDate < now in Madrasa timezone (not VOID).
 */
export async function buildOverdueStudentsReport(madrasaId, filters = {}) {
  const madrasa = await getMadrasaContext(madrasaId);
  await validateSectionClassHierarchy(madrasaId, filters.academicSectionId, filters.classId);

  const nowTz = dayjs().tz(madrasa.timezone);
  const where = {
    madrasaId,
    status: { not: 'VOID' },
    dueDate: { lt: nowTz.toDate() },
  };

  if (filters.billingYear) {
    where.billingYear = filters.billingYear;
  }
  if (filters.billingMonth) {
    where.billingMonth = filters.billingMonth;
  }

  if (filters.classId) {
    where.student = { classId: filters.classId };
  } else if (filters.academicSectionId) {
    where.student = {
      class: { academicSectionId: filters.academicSectionId },
    };
  }

  const invoices = await prisma.invoice.findMany({
    where,
    include: {
      student: {
        include: {
          class: {
            include: { academicSection: true },
          },
        },
      },
      allocations: {
        include: { payment: true },
      },
    },
    orderBy: [
      { dueDate: 'asc' },
      { student: { admissionNo: 'asc' } },
    ],
  });

  const overdueRecords = [];
  let totalExpected = new Prisma.Decimal(0);
  let totalPaid = new Prisma.Decimal(0);
  let totalBalance = new Prisma.Decimal(0);

  for (const inv of invoices) {
    const fin = computeInvoiceFinancials(inv, madrasa.timezone, nowTz);
    if (fin.isOverdue && fin.balanceAmount.gt(0)) {
      totalExpected = totalExpected.plus(fin.totalAmount);
      totalPaid = totalPaid.plus(fin.paidAmount);
      totalBalance = totalBalance.plus(fin.balanceAmount);

      const periodStr = `${dayjs(`${inv.billingYear}-${String(inv.billingMonth).padStart(2, '0')}-01`).format('MMM YYYY')}`;

      overdueRecords.push({
        id: inv.id,
        invoiceNo: inv.invoiceNo,
        admissionNo: inv.student.admissionNo,
        studentName: inv.student.fullName,
        sectionName: inv.student.class?.academicSection?.name || 'Unassigned',
        className: inv.student.class?.name || 'Unassigned',
        billingPeriod: periodStr,
        expectedAmount: fin.totalAmount.toFixed(2),
        paidAmount: fin.paidAmount.toFixed(2),
        balanceAmount: fin.balanceAmount.toFixed(2),
        dueDate: inv.dueDate ? dayjs(inv.dueDate).tz(madrasa.timezone).format('YYYY-MM-DD') : '-',
        daysOverdue: fin.daysOverdue,
      });
    }
  }

  const summary = {
    totalOverdue: overdueRecords.length,
    totalExpected: totalExpected.toFixed(2),
    totalPaid: totalPaid.toFixed(2),
    totalOutstanding: totalBalance.toFixed(2),
    currency: madrasa.currency,
  };

  return {
    reportType: 'OVERDUE_STUDENTS',
    title: 'Overdue Students Report',
    period: filters.billingYear ? `${filters.billingYear}` : 'All Overdue Periods',
    filters: {
      billingYear: filters.billingYear || null,
      billingMonth: filters.billingMonth || null,
      academicSectionId: filters.academicSectionId || null,
      classId: filters.classId || null,
    },
    madrasa,
    summary,
    totalRecords: overdueRecords.length,
    records: overdueRecords,
  };
}

/**
 * 5. OUTSTANDING BALANCE REPORT
 * Includes PENDING, PARTIAL, OVERDUE. Excludes PAID, VOID.
 */
export async function buildOutstandingReport(madrasaId, filters = {}) {
  const madrasa = await getMadrasaContext(madrasaId);
  await validateSectionClassHierarchy(madrasaId, filters.academicSectionId, filters.classId);

  const nowTz = dayjs().tz(madrasa.timezone);
  const where = {
    madrasaId,
    status: { not: 'VOID' },
  };

  if (filters.billingYear) where.billingYear = filters.billingYear;
  if (filters.billingMonth) where.billingMonth = filters.billingMonth;

  if (filters.classId) {
    where.student = { classId: filters.classId };
  } else if (filters.academicSectionId) {
    where.student = {
      class: { academicSectionId: filters.academicSectionId },
    };
  }

  const invoices = await prisma.invoice.findMany({
    where,
    include: {
      student: {
        include: {
          class: {
            include: { academicSection: true },
          },
        },
      },
      allocations: {
        include: { payment: true },
      },
    },
    orderBy: [
      { student: { admissionNo: 'asc' } },
      { invoiceNo: 'asc' },
    ],
  });

  let records = [];
  let totalExpected = new Prisma.Decimal(0);
  let totalPaid = new Prisma.Decimal(0);
  let totalBalance = new Prisma.Decimal(0);

  for (const inv of invoices) {
    const fin = computeInvoiceFinancials(inv, madrasa.timezone, nowTz);
    if (fin.balanceAmount.gt(0) && fin.status !== 'VOID' && fin.status !== 'PAID') {
      totalExpected = totalExpected.plus(fin.totalAmount);
      totalPaid = totalPaid.plus(fin.paidAmount);
      totalBalance = totalBalance.plus(fin.balanceAmount);

      const periodStr = `${dayjs(`${inv.billingYear}-${String(inv.billingMonth).padStart(2, '0')}-01`).format('MMM YYYY')}`;

      records.push({
        id: inv.id,
        invoiceNo: inv.invoiceNo,
        admissionNo: inv.student.admissionNo,
        studentName: inv.student.fullName,
        sectionName: inv.student.class?.academicSection?.name || 'Unassigned',
        className: inv.student.class?.name || 'Unassigned',
        billingPeriod: periodStr,
        expectedAmount: fin.totalAmount.toFixed(2),
        paidAmount: fin.paidAmount.toFixed(2),
        balanceAmount: fin.balanceAmount.toFixed(2),
        dueDate: inv.dueDate ? dayjs(inv.dueDate).tz(madrasa.timezone).format('YYYY-MM-DD') : '-',
        status: fin.status,
        _balanceNum: fin.balanceAmount.toNumber(),
        _dueTime: inv.dueDate ? new Date(inv.dueDate).getTime() : 0,
      });
    }
  }

  // Sorting
  if (filters.sortBy === 'largest_balance') {
    records.sort((a, b) => b._balanceNum - a._balanceNum);
  } else if (filters.sortBy === 'oldest_due') {
    records.sort((a, b) => a._dueTime - b._dueTime);
  } else if (filters.sortBy === 'student_name') {
    records.sort((a, b) => a.studentName.localeCompare(b.studentName));
  } else if (filters.sortBy === 'class') {
    records.sort((a, b) => a.className.localeCompare(b.className));
  } else if (filters.sortBy === 'section') {
    records.sort((a, b) => a.sectionName.localeCompare(b.sectionName));
  }

  // Remove internal sort keys
  records = records.map(({ _balanceNum, _dueTime, ...rest }) => rest);

  const summary = {
    totalInvoices: records.length,
    totalExpected: totalExpected.toFixed(2),
    totalPaid: totalPaid.toFixed(2),
    totalOutstanding: totalBalance.toFixed(2),
    currency: madrasa.currency,
  };

  return {
    reportType: 'OUTSTANDING_BALANCE',
    title: 'Outstanding Balance Report',
    period: filters.billingYear ? `${filters.billingYear}` : 'All Periods',
    filters: {
      billingYear: filters.billingYear || null,
      billingMonth: filters.billingMonth || null,
      academicSectionId: filters.academicSectionId || null,
      classId: filters.classId || null,
      sortBy: filters.sortBy || 'default',
    },
    madrasa,
    summary,
    totalRecords: records.length,
    records,
  };
}

/**
 * 6. MONTHLY FEE COLLECTION SUMMARY
 * Evaluates performance of invoices billed for billingYear & billingMonth.
 */
export async function buildMonthlyCollectionReport(madrasaId, filters = {}) {
  const madrasa = await getMadrasaContext(madrasaId);
  await validateSectionClassHierarchy(madrasaId, filters.academicSectionId, filters.classId);

  const nowTz = dayjs().tz(madrasa.timezone);
  const billingYear = filters.billingYear || nowTz.year();
  const billingMonth = filters.billingMonth || (nowTz.month() + 1);

  const where = {
    madrasaId,
    billingYear,
    billingMonth,
    status: { not: 'VOID' },
  };

  if (filters.classId) {
    where.student = { classId: filters.classId };
  } else if (filters.academicSectionId) {
    where.student = {
      class: { academicSectionId: filters.academicSectionId },
    };
  }

  const invoices = await prisma.invoice.findMany({
    where,
    include: {
      student: {
        include: {
          class: {
            include: { academicSection: true },
          },
        },
      },
      allocations: {
        include: { payment: true },
      },
    },
  });

  let totalExpected = new Prisma.Decimal(0);
  let totalCollected = new Prisma.Decimal(0);
  let totalOutstanding = new Prisma.Decimal(0);
  let paidCount = 0;
  let partialCount = 0;
  let pendingCount = 0;
  let overdueCount = 0;

  for (const inv of invoices) {
    const fin = computeInvoiceFinancials(inv, madrasa.timezone, nowTz);
    totalExpected = totalExpected.plus(fin.totalAmount);
    totalCollected = totalCollected.plus(fin.paidAmount);
    totalOutstanding = totalOutstanding.plus(fin.balanceAmount);

    if (fin.status === 'PAID') paidCount++;
    else if (fin.status === 'PARTIAL') partialCount++;
    else if (fin.status === 'OVERDUE') overdueCount++;
    else pendingCount++;
  }

  const collectionRate = totalExpected.gt(0)
    ? totalCollected.dividedBy(totalExpected).times(100).toFixed(2)
    : '0.00';

  const summary = {
    totalStudentsBilled: invoices.length,
    totalExpected: totalExpected.toFixed(2),
    totalCollected: totalCollected.toFixed(2),
    totalOutstanding: totalOutstanding.toFixed(2),
    paidCount,
    partialCount,
    pendingCount,
    overdueCount,
    collectionRate: `${collectionRate}%`,
    currency: madrasa.currency,
  };

  // Group summary by class for display breakdown
  const classBreakdownMap = new Map();
  for (const inv of invoices) {
    const fin = computeInvoiceFinancials(inv, madrasa.timezone, nowTz);
    const classKey = inv.student.classId || 'unassigned';
    if (!classBreakdownMap.has(classKey)) {
      classBreakdownMap.set(classKey, {
        sectionName: inv.student.class?.academicSection?.name || 'Unassigned',
        className: inv.student.class?.name || 'Unassigned',
        billedCount: 0,
        expected: new Prisma.Decimal(0),
        collected: new Prisma.Decimal(0),
        outstanding: new Prisma.Decimal(0),
      });
    }
    const item = classBreakdownMap.get(classKey);
    item.billedCount++;
    item.expected = item.expected.plus(fin.totalAmount);
    item.collected = item.collected.plus(fin.paidAmount);
    item.outstanding = item.outstanding.plus(fin.balanceAmount);
  }

  const records = Array.from(classBreakdownMap.values()).map((row) => ({
    sectionName: row.sectionName,
    className: row.className,
    studentsBilled: row.billedCount,
    expectedAmount: row.expected.toFixed(2),
    collectedAmount: row.collected.toFixed(2),
    outstandingAmount: row.outstanding.toFixed(2),
    collectionRate: row.expected.gt(0)
      ? `${row.collected.dividedBy(row.expected).times(100).toFixed(2)}%`
      : '0.00%',
  }));

  return {
    reportType: 'MONTHLY_COLLECTION_SUMMARY',
    title: 'Monthly Fee Collection Summary',
    period: `${dayjs(`${billingYear}-${String(billingMonth).padStart(2, '0')}-01`).format('MMMM YYYY')}`,
    filters: {
      billingYear,
      billingMonth,
      academicSectionId: filters.academicSectionId || null,
      classId: filters.classId || null,
    },
    madrasa,
    summary,
    totalRecords: records.length,
    records,
  };
}

/**
 * 7. SECTION-WISE FEE COLLECTION REPORT
 * Dynamic sections + Unassigned legacy classes.
 */
export async function buildSectionWiseCollectionReport(madrasaId, filters = {}) {
  const madrasa = await getMadrasaContext(madrasaId);
  const nowTz = dayjs().tz(madrasa.timezone);
  const billingYear = filters.billingYear || nowTz.year();
  const billingMonth = filters.billingMonth || (nowTz.month() + 1);

  // Fetch all sections for tenant
  const sections = await prisma.academicSection.findMany({
    where: { madrasaId },
    orderBy: { sortOrder: 'asc' },
  });

  const invoices = await prisma.invoice.findMany({
    where: {
      madrasaId,
      billingYear,
      billingMonth,
      status: { not: 'VOID' },
    },
    include: {
      student: {
        include: {
          class: {
            include: { academicSection: true },
          },
        },
      },
      allocations: {
        include: { payment: true },
      },
    },
  });

  // Map each section ID to aggregations
  const sectionMap = new Map();
  for (const sec of sections) {
    sectionMap.set(sec.id, {
      sectionId: sec.id,
      sectionName: sec.name,
      studentsBilled: 0,
      expected: new Prisma.Decimal(0),
      collected: new Prisma.Decimal(0),
      outstanding: new Prisma.Decimal(0),
    });
  }

  // Also prepare unassigned bucket
  const unassignedBucket = {
    sectionId: 'unassigned',
    sectionName: 'Unassigned',
    studentsBilled: 0,
    expected: new Prisma.Decimal(0),
    collected: new Prisma.Decimal(0),
    outstanding: new Prisma.Decimal(0),
  };

  let totalExpectedAll = new Prisma.Decimal(0);
  let totalCollectedAll = new Prisma.Decimal(0);
  let totalOutstandingAll = new Prisma.Decimal(0);
  let totalBilledAll = 0;

  for (const inv of invoices) {
    const fin = computeInvoiceFinancials(inv, madrasa.timezone, nowTz);
    const secId = inv.student.class?.academicSectionId;
    const bucket = secId && sectionMap.has(secId) ? sectionMap.get(secId) : unassignedBucket;

    bucket.studentsBilled++;
    bucket.expected = bucket.expected.plus(fin.totalAmount);
    bucket.collected = bucket.collected.plus(fin.paidAmount);
    bucket.outstanding = bucket.outstanding.plus(fin.balanceAmount);

    totalBilledAll++;
    totalExpectedAll = totalExpectedAll.plus(fin.totalAmount);
    totalCollectedAll = totalCollectedAll.plus(fin.paidAmount);
    totalOutstandingAll = totalOutstandingAll.plus(fin.balanceAmount);
  }

  const records = [];
  for (const sec of sections) {
    const b = sectionMap.get(sec.id);
    records.push({
      sectionName: b.sectionName,
      studentsBilled: b.studentsBilled,
      expectedAmount: b.expected.toFixed(2),
      collectedAmount: b.collected.toFixed(2),
      outstandingAmount: b.outstanding.toFixed(2),
      collectionRate: b.expected.gt(0)
        ? `${b.collected.dividedBy(b.expected).times(100).toFixed(2)}%`
        : '0.00%',
    });
  }

  if (unassignedBucket.studentsBilled > 0) {
    records.push({
      sectionName: 'Unassigned',
      studentsBilled: unassignedBucket.studentsBilled,
      expectedAmount: unassignedBucket.expected.toFixed(2),
      collectedAmount: unassignedBucket.collected.toFixed(2),
      outstandingAmount: unassignedBucket.outstanding.toFixed(2),
      collectionRate: unassignedBucket.expected.gt(0)
        ? `${unassignedBucket.collected.dividedBy(unassignedBucket.expected).times(100).toFixed(2)}%`
        : '0.00%',
    });
  }

  const overallRate = totalExpectedAll.gt(0)
    ? `${totalCollectedAll.dividedBy(totalExpectedAll).times(100).toFixed(2)}%`
    : '0.00%';

  const summary = {
    totalSections: records.length,
    totalStudentsBilled: totalBilledAll,
    totalExpected: totalExpectedAll.toFixed(2),
    totalCollected: totalCollectedAll.toFixed(2),
    totalOutstanding: totalOutstandingAll.toFixed(2),
    collectionRate: overallRate,
    currency: madrasa.currency,
  };

  return {
    reportType: 'SECTION_COLLECTION',
    title: 'Section-wise Fee Collection Report',
    period: `${dayjs(`${billingYear}-${String(billingMonth).padStart(2, '0')}-01`).format('MMMM YYYY')}`,
    filters: { billingYear, billingMonth },
    madrasa,
    summary,
    totalRecords: records.length,
    records,
  };
}

/**
 * 8. CLASS-WISE FEE COLLECTION REPORT
 */
export async function buildClassWiseCollectionReport(madrasaId, filters = {}) {
  const madrasa = await getMadrasaContext(madrasaId);
  const nowTz = dayjs().tz(madrasa.timezone);
  const billingYear = filters.billingYear || nowTz.year();
  const billingMonth = filters.billingMonth || (nowTz.month() + 1);

  const where = {
    madrasaId,
    billingYear,
    billingMonth,
    status: { not: 'VOID' },
  };

  if (filters.academicSectionId) {
    where.student = { class: { academicSectionId: filters.academicSectionId } };
  }

  const classes = await prisma.class.findMany({
    where: {
      madrasaId,
      ...(filters.academicSectionId ? { academicSectionId: filters.academicSectionId } : {}),
    },
    include: { academicSection: true },
    orderBy: [
      { academicSection: { sortOrder: 'asc' } },
      { name: 'asc' },
    ],
  });

  const invoices = await prisma.invoice.findMany({
    where,
    include: {
      student: {
        include: {
          class: {
            include: { academicSection: true },
          },
        },
      },
      allocations: {
        include: { payment: true },
      },
    },
  });

  const classMap = new Map();
  for (const c of classes) {
    classMap.set(c.id, {
      sectionName: c.academicSection?.name || 'Unassigned',
      className: c.name,
      studentsBilled: 0,
      expected: new Prisma.Decimal(0),
      collected: new Prisma.Decimal(0),
      outstanding: new Prisma.Decimal(0),
      paidCount: 0,
      partialCount: 0,
      unpaidCount: 0,
    });
  }

  // Handle unassigned students
  const unassignedBucket = {
    sectionName: 'Unassigned',
    className: 'No Class Assigned',
    studentsBilled: 0,
    expected: new Prisma.Decimal(0),
    collected: new Prisma.Decimal(0),
    outstanding: new Prisma.Decimal(0),
    paidCount: 0,
    partialCount: 0,
    unpaidCount: 0,
  };

  let totalBilledAll = 0;
  let totalExpectedAll = new Prisma.Decimal(0);
  let totalCollectedAll = new Prisma.Decimal(0);
  let totalOutstandingAll = new Prisma.Decimal(0);

  for (const inv of invoices) {
    const fin = computeInvoiceFinancials(inv, madrasa.timezone, nowTz);
    const clsId = inv.student.classId;
    const bucket = clsId && classMap.has(clsId) ? classMap.get(clsId) : unassignedBucket;

    bucket.studentsBilled++;
    bucket.expected = bucket.expected.plus(fin.totalAmount);
    bucket.collected = bucket.collected.plus(fin.paidAmount);
    bucket.outstanding = bucket.outstanding.plus(fin.balanceAmount);

    if (fin.status === 'PAID') bucket.paidCount++;
    else if (fin.status === 'PARTIAL') bucket.partialCount++;
    else bucket.unpaidCount++;

    totalBilledAll++;
    totalExpectedAll = totalExpectedAll.plus(fin.totalAmount);
    totalCollectedAll = totalCollectedAll.plus(fin.paidAmount);
    totalOutstandingAll = totalOutstandingAll.plus(fin.balanceAmount);
  }

  const records = [];
  for (const c of classes) {
    const b = classMap.get(c.id);
    records.push({
      sectionName: b.sectionName,
      className: b.className,
      studentsBilled: b.studentsBilled,
      expectedAmount: b.expected.toFixed(2),
      collectedAmount: b.collected.toFixed(2),
      outstandingAmount: b.outstanding.toFixed(2),
      paidCount: b.paidCount,
      partialCount: b.partialCount,
      unpaidCount: b.unpaidCount,
      collectionRate: b.expected.gt(0)
        ? `${b.collected.dividedBy(b.expected).times(100).toFixed(2)}%`
        : '0.00%',
    });
  }

  if (unassignedBucket.studentsBilled > 0) {
    records.push({
      sectionName: unassignedBucket.sectionName,
      className: unassignedBucket.className,
      studentsBilled: unassignedBucket.studentsBilled,
      expectedAmount: unassignedBucket.expected.toFixed(2),
      collectedAmount: unassignedBucket.collected.toFixed(2),
      outstandingAmount: unassignedBucket.outstanding.toFixed(2),
      paidCount: unassignedBucket.paidCount,
      partialCount: unassignedBucket.partialCount,
      unpaidCount: unassignedBucket.unpaidCount,
      collectionRate: unassignedBucket.expected.gt(0)
        ? `${unassignedBucket.collected.dividedBy(unassignedBucket.expected).times(100).toFixed(2)}%`
        : '0.00%',
    });
  }

  const summary = {
    totalClasses: records.length,
    totalStudentsBilled: totalBilledAll,
    totalExpected: totalExpectedAll.toFixed(2),
    totalCollected: totalCollectedAll.toFixed(2),
    totalOutstanding: totalOutstandingAll.toFixed(2),
    collectionRate: totalExpectedAll.gt(0)
      ? `${totalCollectedAll.dividedBy(totalExpectedAll).times(100).toFixed(2)}%`
      : '0.00%',
    currency: madrasa.currency,
  };

  return {
    reportType: 'CLASS_COLLECTION',
    title: 'Class-wise Fee Collection Report',
    period: `${dayjs(`${billingYear}-${String(billingMonth).padStart(2, '0')}-01`).format('MMMM YYYY')}`,
    filters: {
      billingYear,
      billingMonth,
      academicSectionId: filters.academicSectionId || null,
    },
    madrasa,
    summary,
    totalRecords: records.length,
    records,
  };
}

/**
 * 9. CASH COLLECTION REPORT
 * Based strictly on Payment.paidAt and Payment.status = COMPLETED in Madrasa timezone.
 * Supports: Today, Specific Date, Date Range.
 */
export async function buildCashCollectionReport(madrasaId, filters = {}) {
  const madrasa = await getMadrasaContext(madrasaId);
  await validateSectionClassHierarchy(madrasaId, filters.academicSectionId, filters.classId);

  const tz = madrasa.timezone;
  const nowTz = dayjs().tz(tz);

  let startBoundary;
  let endBoundary;

  if (filters.date) {
    // Specific Date
    startBoundary = dayjs.tz(filters.date, tz).startOf('day').toDate();
    endBoundary = dayjs.tz(filters.date, tz).endOf('day').toDate();
  } else if (filters.startDate || filters.endDate) {
    // Date Range
    const startStr = filters.startDate || nowTz.format('YYYY-MM-DD');
    const endStr = filters.endDate || nowTz.format('YYYY-MM-DD');
    startBoundary = dayjs.tz(startStr, tz).startOf('day').toDate();
    endBoundary = dayjs.tz(endStr, tz).endOf('day').toDate();
  } else {
    // Default Today
    startBoundary = nowTz.startOf('day').toDate();
    endBoundary = nowTz.endOf('day').toDate();
  }

  const where = {
    madrasaId,
    status: 'COMPLETED',
    paidAt: {
      gte: startBoundary,
      lte: endBoundary,
    },
  };

  if (filters.paymentMethod) {
    where.paymentMethod = filters.paymentMethod;
  }

  if (filters.classId) {
    where.student = { classId: filters.classId };
  } else if (filters.academicSectionId) {
    where.student = {
      class: { academicSectionId: filters.academicSectionId },
    };
  }

  const payments = await prisma.payment.findMany({
    where,
    include: {
      student: {
        include: {
          class: {
            include: { academicSection: true },
          },
        },
      },
      receipt: true,
      allocations: {
        include: {
          invoice: { select: { invoiceNo: true, billingYear: true, billingMonth: true } },
        },
      },
    },
    orderBy: { paidAt: 'desc' },
  });

  let totalCash = new Prisma.Decimal(0);
  let totalBank = new Prisma.Decimal(0);
  let totalCard = new Prisma.Decimal(0);
  let totalOther = new Prisma.Decimal(0);
  let totalCollected = new Prisma.Decimal(0);

  const records = payments.map((p) => {
    const amt = new Prisma.Decimal(p.amount);
    totalCollected = totalCollected.plus(amt);

    if (p.paymentMethod === 'CASH') totalCash = totalCash.plus(amt);
    else if (p.paymentMethod === 'BANK_TRANSFER') totalBank = totalBank.plus(amt);
    else if (p.paymentMethod === 'CARD') totalCard = totalCard.plus(amt);
    else totalOther = totalOther.plus(amt);

    const allocatedMonths = p.allocations.map((a) =>
      `${dayjs(`${a.invoice.billingYear}-${String(a.invoice.billingMonth).padStart(2, '0')}-01`).format('MMM YYYY')} (${a.invoice.invoiceNo})`
    ).join(', ');

    return {
      id: p.id,
      paymentNo: p.paymentNo,
      receiptNo: p.receipt?.receiptNo || '-',
      paidAt: dayjs(p.paidAt).tz(tz).format('YYYY-MM-DD HH:mm'),
      admissionNo: p.student.admissionNo,
      studentName: p.student.fullName,
      sectionName: p.student.class?.academicSection?.name || 'Unassigned',
      className: p.student.class?.name || 'Unassigned',
      paymentMethod: p.paymentMethod,
      reference: p.reference || '-',
      amount: amt.toFixed(2),
      allocatedMonths: allocatedMonths || '-',
    };
  });

  const periodLabel = filters.date
    ? `Date: ${filters.date}`
    : `${dayjs(startBoundary).tz(tz).format('YYYY-MM-DD')} to ${dayjs(endBoundary).tz(tz).format('YYYY-MM-DD')}`;

  const summary = {
    totalTransactions: payments.length,
    totalCash: totalCash.toFixed(2),
    totalBankTransfer: totalBank.toFixed(2),
    totalCard: totalCard.toFixed(2),
    totalOther: totalOther.toFixed(2),
    totalCollected: totalCollected.toFixed(2),
    currency: madrasa.currency,
  };

  return {
    reportType: 'CASH_COLLECTION',
    title: 'Cash Collection Report',
    period: periodLabel,
    filters: {
      date: filters.date || null,
      startDate: filters.startDate || null,
      endDate: filters.endDate || null,
      paymentMethod: filters.paymentMethod || null,
      academicSectionId: filters.academicSectionId || null,
      classId: filters.classId || null,
    },
    madrasa,
    summary,
    totalRecords: records.length,
    records,
  };
}

/**
 * 10. PAYMENT METHOD SUMMARY REPORT
 * Explicit breakdown of methods with completed counts/totals and separate VOID figures.
 */
export async function buildPaymentMethodSummaryReport(madrasaId, filters = {}) {
  const madrasa = await getMadrasaContext(madrasaId);
  const tz = madrasa.timezone;
  const nowTz = dayjs().tz(tz);

  let startBoundary;
  let endBoundary;

  if (filters.date) {
    startBoundary = dayjs.tz(filters.date, tz).startOf('day').toDate();
    endBoundary = dayjs.tz(filters.date, tz).endOf('day').toDate();
  } else if (filters.startDate || filters.endDate) {
    const startStr = filters.startDate || nowTz.format('YYYY-MM-DD');
    const endStr = filters.endDate || nowTz.format('YYYY-MM-DD');
    startBoundary = dayjs.tz(startStr, tz).startOf('day').toDate();
    endBoundary = dayjs.tz(endStr, tz).endOf('day').toDate();
  } else {
    // Default current month
    startBoundary = nowTz.startOf('month').toDate();
    endBoundary = nowTz.endOf('month').toDate();
  }

  const allPayments = await prisma.payment.findMany({
    where: {
      madrasaId,
      paidAt: {
        gte: startBoundary,
        lte: endBoundary,
      },
    },
    select: {
      paymentMethod: true,
      amount: true,
      status: true,
    },
  });

  const methods = ['CASH', 'BANK_TRANSFER', 'CARD', 'OTHER'];
  const methodMap = new Map();
  for (const m of methods) {
    methodMap.set(m, {
      method: m,
      completedCount: 0,
      completedAmount: new Prisma.Decimal(0),
      voidCount: 0,
      voidAmount: new Prisma.Decimal(0),
    });
  }

  let totalActiveAmount = new Prisma.Decimal(0);
  let totalActiveCount = 0;
  let totalVoidAmount = new Prisma.Decimal(0);
  let totalVoidCount = 0;

  for (const p of allPayments) {
    const item = methodMap.get(p.paymentMethod) || methodMap.get('OTHER');
    const amt = new Prisma.Decimal(p.amount);

    if (p.status === 'COMPLETED') {
      item.completedCount++;
      item.completedAmount = item.completedAmount.plus(amt);
      totalActiveCount++;
      totalActiveAmount = totalActiveAmount.plus(amt);
    } else if (p.status === 'VOID') {
      item.voidCount++;
      item.voidAmount = item.voidAmount.plus(amt);
      totalVoidCount++;
      totalVoidAmount = totalVoidAmount.plus(amt);
    }
  }

  const records = methods.map((m) => {
    const item = methodMap.get(m);
    return {
      paymentMethod: m,
      transactionCount: item.completedCount,
      completedAmount: item.completedAmount.toFixed(2),
      voidCount: item.voidCount,
      voidAmount: item.voidAmount.toFixed(2),
      shareRate: totalActiveAmount.gt(0)
        ? `${item.completedAmount.dividedBy(totalActiveAmount).times(100).toFixed(2)}%`
        : '0.00%',
    };
  });

  const summary = {
    totalCompletedTransactions: totalActiveCount,
    totalCompletedAmount: totalActiveAmount.toFixed(2),
    totalVoidTransactions: totalVoidCount,
    totalVoidAmount: totalVoidAmount.toFixed(2),
    currency: madrasa.currency,
  };

  const periodLabel = `${dayjs(startBoundary).tz(tz).format('YYYY-MM-DD')} to ${dayjs(endBoundary).tz(tz).format('YYYY-MM-DD')}`;

  return {
    reportType: 'PAYMENT_METHOD_SUMMARY',
    title: 'Payment Method Summary',
    period: periodLabel,
    filters: {
      date: filters.date || null,
      startDate: filters.startDate || null,
      endDate: filters.endDate || null,
    },
    madrasa,
    summary,
    totalRecords: records.length,
    records,
  };
}

/**
 * 11. PAYMENT HISTORY REPORT
 * Full audit list of payments, clearly distinguishing COMPLETED from VOID.
 */
export async function buildPaymentHistoryReport(madrasaId, filters = {}) {
  const madrasa = await getMadrasaContext(madrasaId);
  const tz = madrasa.timezone;
  const nowTz = dayjs().tz(tz);

  let startBoundary = null;
  let endBoundary = null;

  if (filters.startDate || filters.endDate) {
    const startStr = filters.startDate || '2000-01-01';
    const endStr = filters.endDate || nowTz.format('YYYY-MM-DD');
    startBoundary = dayjs.tz(startStr, tz).startOf('day').toDate();
    endBoundary = dayjs.tz(endStr, tz).endOf('day').toDate();
  }

  const where = { madrasaId };

  if (startBoundary && endBoundary) {
    where.paidAt = { gte: startBoundary, lte: endBoundary };
  }

  if (filters.status && filters.status !== 'ALL') {
    where.status = filters.status;
  }

  if (filters.paymentMethod) {
    where.paymentMethod = filters.paymentMethod;
  }

  if (filters.search) {
    const s = filters.search.trim();
    where.OR = [
      { paymentNo: { contains: s } },
      { student: { fullName: { contains: s } } },
      { student: { admissionNo: { contains: s } } },
      { receipt: { receiptNo: { contains: s } } },
    ];
  }

  const payments = await prisma.payment.findMany({
    where,
    include: {
      student: {
        include: {
          class: {
            include: { academicSection: true },
          },
        },
      },
      receipt: true,
      allocations: {
        include: {
          invoice: { select: { invoiceNo: true, billingYear: true, billingMonth: true } },
        },
      },
    },
    orderBy: { paidAt: 'desc' },
  });

  let totalCompletedAmount = new Prisma.Decimal(0);
  let totalVoidAmount = new Prisma.Decimal(0);
  let completedCount = 0;
  let voidCount = 0;

  const records = payments.map((p) => {
    const amt = new Prisma.Decimal(p.amount);
    if (p.status === 'COMPLETED') {
      totalCompletedAmount = totalCompletedAmount.plus(amt);
      completedCount++;
    } else {
      totalVoidAmount = totalVoidAmount.plus(amt);
      voidCount++;
    }

    const allocatedPeriods = p.allocations.map((a) =>
      `${dayjs(`${a.invoice.billingYear}-${String(a.invoice.billingMonth).padStart(2, '0')}-01`).format('MMM YYYY')} (${a.invoice.invoiceNo})`
    ).join(', ');

    return {
      id: p.id,
      paymentNo: p.paymentNo,
      receiptNo: p.receipt?.receiptNo || '-',
      paidAt: dayjs(p.paidAt).tz(tz).format('YYYY-MM-DD HH:mm'),
      admissionNo: p.student.admissionNo,
      studentName: p.student.fullName,
      sectionName: p.student.class?.academicSection?.name || 'Unassigned',
      className: p.student.class?.name || 'Unassigned',
      paymentMethod: p.paymentMethod,
      reference: p.reference || '-',
      amount: amt.toFixed(2),
      status: p.status,
      allocatedPeriods: allocatedPeriods || '-',
      voidReason: p.status === 'VOID' ? (p.voidReason || 'Voided') : null,
    };
  });

  const summary = {
    totalPayments: payments.length,
    completedCount,
    voidCount,
    totalCompletedAmount: totalCompletedAmount.toFixed(2),
    totalVoidAmount: totalVoidAmount.toFixed(2),
    currency: madrasa.currency,
  };

  return {
    reportType: 'PAYMENT_HISTORY',
    title: 'Payment History Report',
    period: startBoundary && endBoundary
      ? `${dayjs(startBoundary).tz(tz).format('YYYY-MM-DD')} to ${dayjs(endBoundary).tz(tz).format('YYYY-MM-DD')}`
      : 'All Time',
    filters: {
      startDate: filters.startDate || null,
      endDate: filters.endDate || null,
      status: filters.status || 'ALL',
      paymentMethod: filters.paymentMethod || null,
    },
    madrasa,
    summary,
    totalRecords: records.length,
    records,
  };
}

/**
 * 12. MISSING MONTHLY INVOICES / NOT GENERATED REPORT (Mandatory Correction #2)
 * Eligible students for whom NO monthly invoice was generated for billingYear & billingMonth.
 * Reuses Phase 9 rules: ACTIVE students enrolled before periodEndExclusive.
 * Excludes students with existing invoices (even if VOID).
 */
export async function buildMissingInvoicesReport(madrasaId, filters = {}) {
  const madrasa = await getMadrasaContext(madrasaId);
  await validateSectionClassHierarchy(madrasaId, filters.academicSectionId, filters.classId);

  const tz = madrasa.timezone;
  const nowTz = dayjs().tz(tz);
  const billingYear = filters.billingYear || nowTz.year();
  const billingMonth = filters.billingMonth || (nowTz.month() + 1);

  const { periodStart, periodEndExclusive } = calculateBillingBoundaries(billingYear, billingMonth, tz);

  // 1. Eligible candidate students strictly following Phase 9 rules:
  // - ACTIVE students only
  // - admissionDate < periodEndExclusive (allows pre-month and mid-month admissions)
  const studentWhere = {
    madrasaId,
    status: 'ACTIVE',
    admissionDate: { lt: periodEndExclusive },
  };

  if (filters.classId) {
    studentWhere.classId = filters.classId;
  } else if (filters.academicSectionId) {
    studentWhere.class = { academicSectionId: filters.academicSectionId };
  }

  const candidates = await prisma.student.findMany({
    where: studentWhere,
    include: {
      class: {
        include: { academicSection: true },
      },
    },
    orderBy: { admissionNo: 'asc' },
  });

  if (candidates.length === 0) {
    return {
      reportType: 'MISSING_INVOICES',
      title: 'Missing Monthly Invoices / Not Generated Report',
      period: `${dayjs(`${billingYear}-${String(billingMonth).padStart(2, '0')}-01`).format('MMMM YYYY')}`,
      filters: { billingYear, billingMonth },
      madrasa,
      summary: {
        totalMissing: 0,
        totalExpectedFee: '0.00',
        currency: madrasa.currency,
      },
      totalRecords: 0,
      records: [],
    };
  }

  // 2. Existing invoices for candidate students (ANY status: PENDING, PARTIAL, PAID, OVERDUE, VOID)
  // An existing VOID invoice is STILL an invoice generated for that month/year, so student is NOT missing!
  const existingInvoices = await prisma.invoice.findMany({
    where: {
      madrasaId,
      studentId: { in: candidates.map((s) => s.id) },
      billingYear,
      billingMonth,
    },
    select: { studentId: true },
  });

  const billedStudentIds = new Set(existingInvoices.map((inv) => inv.studentId));

  // 3. Filter down to unbilled students
  const unbilledCandidates = candidates.filter((s) => !billedStudentIds.has(s.id));

  // 4. Batched lookup of StudentFeeSetting intervals matching Phase 9 exact logic
  const candidateIds = unbilledCandidates.map((s) => s.id);
  const feeSettings = await prisma.studentFeeSetting.findMany({
    where: {
      madrasaId,
      studentId: { in: candidateIds },
      effectiveFrom: { lte: periodEndExclusive },
      OR: [
        { effectiveTo: null },
        { effectiveTo: { gt: periodStart } },
      ],
    },
    orderBy: { effectiveFrom: 'desc' },
  });

  const feeSettingsMap = new Map();
  for (const fs of feeSettings) {
    const list = feeSettingsMap.get(fs.studentId) || [];
    list.push(fs);
    feeSettingsMap.set(fs.studentId, list);
  }

  let totalExpectedFee = new Prisma.Decimal(0);
  const records = unbilledCandidates.map((s) => {
    // Phase 9 exact fee resolution:
    // targetDate = max(periodStart, student.admissionDate)
    const admTime = new Date(s.admissionDate).getTime();
    const startTime = periodStart.getTime();
    const feeTargetDate = new Date(Math.max(startTime, admTime));

    const studentSettings = feeSettingsMap.get(s.id) || [];
    const activeOverride = studentSettings.find(
      (setting) => setting.effectiveFrom <= feeTargetDate && (setting.effectiveTo === null || setting.effectiveTo > feeTargetDate)
    );

    let fee = new Prisma.Decimal(0);
    let feeSource = 'UNCONFIGURED';

    if (activeOverride) {
      fee = new Prisma.Decimal(activeOverride.amount);
      feeSource = 'STUDENT_OVERRIDE';
    } else if (s.class?.defaultMonthlyFee !== null && s.class?.defaultMonthlyFee !== undefined) {
      fee = new Prisma.Decimal(s.class.defaultMonthlyFee);
      feeSource = 'CLASS_DEFAULT';
    }

    totalExpectedFee = totalExpectedFee.plus(fee);

    return {
      studentId: s.id,
      admissionNo: s.admissionNo,
      studentName: s.fullName,
      sectionName: s.class?.academicSection?.name || 'Unassigned',
      className: s.class?.name || 'Unassigned',
      admissionDate: dayjs(s.admissionDate).tz(tz).format('YYYY-MM-DD'),
      expectedFee: fee.toFixed(2),
      feeSource,
      status: 'NOT_GENERATED',
      guardianName: s.guardianName || '-',
      guardianPhone: s.guardianPhone || '-',
    };
  });

  const summary = {
    totalMissing: records.length,
    totalExpectedFee: totalExpectedFee.toFixed(2),
    currency: madrasa.currency,
  };

  return {
    reportType: 'MISSING_INVOICES',
    title: 'Missing Monthly Invoices / Not Generated Report',
    period: `${dayjs(`${billingYear}-${String(billingMonth).padStart(2, '0')}-01`).format('MMMM YYYY')}`,
    filters: {
      billingYear,
      billingMonth,
      academicSectionId: filters.academicSectionId || null,
      classId: filters.classId || null,
    },
    madrasa,
    summary,
    totalRecords: records.length,
    records,
  };
}

/**
 * 13. INDIVIDUAL STUDENT FEE STATEMENT
 * Comprehensive month-by-month ledger + payment history + totals.
 */
export async function buildStudentStatementReport(madrasaId, studentId, filters = {}) {
  const madrasa = await getMadrasaContext(madrasaId);
  const tz = madrasa.timezone;
  const nowTz = dayjs().tz(tz);

  const student = await prisma.student.findFirst({
    where: { id: studentId, madrasaId },
    include: {
      class: {
        include: { academicSection: true },
      },
    },
  });

  if (!student) {
    throw new NotFoundError('Student not found.');
  }

  const currentYear = filters.year || nowTz.year();

  const invoiceWhere = {
    madrasaId,
    studentId,
  };
  if (filters.year) {
    invoiceWhere.billingYear = filters.year;
  }

  const invoices = await prisma.invoice.findMany({
    where: invoiceWhere,
    include: {
      allocations: {
        include: { payment: true },
      },
    },
    orderBy: [
      { billingYear: 'asc' },
      { billingMonth: 'asc' },
    ],
  });

  let totalExpected = new Prisma.Decimal(0);
  let totalPaid = new Prisma.Decimal(0);
  let totalOutstanding = new Prisma.Decimal(0);

  const billingLedger = [];

  for (const inv of invoices) {
    const fin = computeInvoiceFinancials(inv, tz, nowTz);

    // VOID invoices do not count toward collectible expected or balance totals
    if (fin.status !== 'VOID') {
      totalExpected = totalExpected.plus(fin.totalAmount);
      totalPaid = totalPaid.plus(fin.paidAmount);
      totalOutstanding = totalOutstanding.plus(fin.balanceAmount);
    }

    const monthLabel = `${dayjs(`${inv.billingYear}-${String(inv.billingMonth).padStart(2, '0')}-01`).format('MMMM YYYY')}`;

    billingLedger.push({
      id: inv.id,
      month: monthLabel,
      invoiceNo: inv.invoiceNo,
      issueDate: dayjs(inv.issueDate).tz(tz).format('YYYY-MM-DD'),
      dueDate: inv.dueDate ? dayjs(inv.dueDate).tz(tz).format('YYYY-MM-DD') : '-',
      expectedAmount: fin.totalAmount.toFixed(2),
      paidAmount: fin.paidAmount.toFixed(2),
      balanceAmount: fin.balanceAmount.toFixed(2),
      status: fin.status,
    });
  }

  // Payment history for student
  const paymentWhere = {
    madrasaId,
    studentId,
  };

  const payments = await prisma.payment.findMany({
    where: paymentWhere,
    include: {
      receipt: true,
      allocations: {
        include: {
          invoice: { select: { invoiceNo: true, billingYear: true, billingMonth: true } },
        },
      },
    },
    orderBy: { paidAt: 'desc' },
  });

  const paymentHistory = payments.map((p) => {
    const amt = new Prisma.Decimal(p.amount);
    const allocatedPeriods = p.allocations.map((a) =>
      `${dayjs(`${a.invoice.billingYear}-${String(a.invoice.billingMonth).padStart(2, '0')}-01`).format('MMM YYYY')} (${a.invoice.invoiceNo})`
    ).join(', ');

    return {
      id: p.id,
      paymentNo: p.paymentNo,
      receiptNo: p.receipt?.receiptNo || '-',
      paidAt: dayjs(p.paidAt).tz(tz).format('YYYY-MM-DD HH:mm'),
      paymentMethod: p.paymentMethod,
      amount: amt.toFixed(2),
      status: p.status,
      allocatedPeriods: allocatedPeriods || '-',
      voidReason: p.status === 'VOID' ? (p.voidReason || 'Voided') : null,
    };
  });

  const studentProfile = {
    id: student.id,
    admissionNo: student.admissionNo,
    fullName: student.fullName,
    currentSection: student.class?.academicSection?.name || 'Unassigned',
    currentClass: student.class?.name || 'Unassigned',
    guardianName: student.guardianName || '-',
    guardianPhone: student.guardianPhone || '-',
    admissionDate: dayjs(student.admissionDate).tz(tz).format('YYYY-MM-DD'),
  };

  const summary = {
    totalExpected: totalExpected.toFixed(2),
    totalPaid: totalPaid.toFixed(2),
    totalOutstanding: totalOutstanding.toFixed(2),
    currency: madrasa.currency,
  };

  return {
    reportType: 'STUDENT_STATEMENT',
    title: 'Student Fee Statement',
    period: filters.year ? `Year ${filters.year}` : 'Full Statement',
    student: studentProfile,
    madrasa,
    summary,
    billingLedger,
    paymentHistory,
    totalRecords: billingLedger.length,
    records: billingLedger, // Fallback uniform records accessor
  };
}
