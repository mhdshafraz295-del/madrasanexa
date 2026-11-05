import prisma from '../lib/prisma.js';
import { Prisma } from '@prisma/client';
import { NotFoundError, BadRequestError, ConflictError } from '../utils/errors.js';
import { logTenantActivity } from './tenant.service.js';
import { resolveLogoDataUri } from './branding.service.js';
import { renderRawHtmlToPdf } from './pdf-report.service.js';
import { generateCsvString } from './csv-report.service.js';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function parseDateOnly(dateStr) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new BadRequestError('Invalid date format. Expected YYYY-MM-DD.');
  }
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new BadRequestError('Invalid calendar date.');
  }
  return date;
}

export function formatDateOnly(d) {
  if (!d) return '';
  const dateObj = typeof d === 'string' ? new Date(d) : d;
  const year = dateObj.getUTCFullYear();
  const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseYearMonth(monthStr) {
  if (!monthStr || !/^\d{4}-\d{2}$/.test(monthStr)) {
    throw new BadRequestError('Invalid month format. Expected YYYY-MM.');
  }
  const [year, month] = monthStr.split('-').map(Number);
  if (month < 1 || month > 12) {
    throw new BadRequestError('Month must be between 1 and 12.');
  }
  return { year, month };
}

export function getMonthBoundaries(year, month) {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  return { start, end };
}

export function getPreviousMonth(year, month) {
  if (month === 1) {
    return { prevYear: year - 1, prevMonth: 12 };
  }
  return { prevYear: year, prevMonth: month - 1 };
}

// ==========================================
// 1. CATEGORY MANAGEMENT
// ==========================================

export async function createCategory(madrasaId, userId, { name, description }) {
  const existing = await prisma.expenseCategory.findUnique({
    where: { madrasaId_name: { madrasaId, name } },
  });
  if (existing) {
    throw new ConflictError(`Expense category '${name}' already exists.`);
  }

  const category = await prisma.expenseCategory.create({
    data: {
      madrasaId,
      name,
      description: description || null,
      isActive: true,
    },
  });

  logTenantActivity({
    madrasaId,
    userId,
    action: 'EXPENSE_CATEGORY_CREATED',
    entityType: 'ExpenseCategory',
    entityId: category.id,
    metadata: { name: category.name },
  }).catch(() => {});

  return category;
}

export async function updateCategory(madrasaId, userId, categoryId, { name, description, isActive }) {
  const category = await prisma.expenseCategory.findFirst({
    where: { id: categoryId, madrasaId },
  });
  if (!category) {
    throw new NotFoundError('Expense category not found.');
  }

  if (name && name !== category.name) {
    const existingName = await prisma.expenseCategory.findUnique({
      where: { madrasaId_name: { madrasaId, name } },
    });
    if (existingName) {
      throw new ConflictError(`Expense category '${name}' already exists.`);
    }
  }

  const data = {};
  if (name !== undefined) data.name = name;
  if (description !== undefined) data.description = description || null;
  if (isActive !== undefined) data.isActive = isActive;

  const updated = await prisma.expenseCategory.update({
    where: { id: categoryId },
    data,
  });

  logTenantActivity({
    madrasaId,
    userId,
    action: 'EXPENSE_CATEGORY_UPDATED',
    entityType: 'ExpenseCategory',
    entityId: updated.id,
    metadata: { name: updated.name, isActive: updated.isActive },
  }).catch(() => {});

  return updated;
}

export async function listCategories(madrasaId, { includeInactive = false } = {}) {
  const where = { madrasaId };
  if (!includeInactive) {
    where.isActive = true;
  }
  return prisma.expenseCategory.findMany({
    where,
    orderBy: { name: 'asc' },
  });
}

// ==========================================
// 2. EXPENSE CRUD (Transactional ActivityLog)
// ==========================================

export async function createExpense(madrasaId, userId, data) {
  const category = await prisma.expenseCategory.findFirst({
    where: { id: data.categoryId, madrasaId, isActive: true },
  });
  if (!category) {
    throw new NotFoundError('Expense category not found or is inactive.');
  }

  const parsedDate = parseDateOnly(data.expenseDate);
  const amountDecimal = new Prisma.Decimal(data.amount);
  const quantityDecimal = data.quantity ? new Prisma.Decimal(data.quantity) : null;
  const unitCostDecimal = data.unitCost !== undefined && data.unitCost !== null ? new Prisma.Decimal(data.unitCost) : null;

  const expense = await prisma.$transaction(async (tx) => {
    const created = await tx.expense.create({
      data: {
        madrasaId,
        categoryId: data.categoryId,
        expenseDate: parsedDate,
        description: data.description,
        amount: amountDecimal,
        quantity: quantityDecimal,
        unitLabel: data.unitLabel || null,
        unitCost: unitCostDecimal,
        supplierName: data.supplierName || null,
        reasonNote: data.reasonNote || null,
        status: 'ACTIVE',
        createdById: userId,
      },
      include: {
        category: { select: { id: true, name: true } },
      },
    });

    await tx.activityLog.create({
      data: {
        madrasaId,
        userId,
        action: 'EXPENSE_CREATED',
        entityType: 'Expense',
        entityId: created.id,
        metadata: {
          categoryName: category.name,
          amount: created.amount.toString(),
          expenseDate: data.expenseDate,
          description: created.description,
        },
      },
    });

    return created;
  });

  return {
    ...expense,
    expenseDate: formatDateOnly(expense.expenseDate),
    amount: expense.amount.toString(),
    quantity: expense.quantity ? expense.quantity.toString() : null,
    unitCost: expense.unitCost ? expense.unitCost.toString() : null,
  };
}

export async function updateExpense(madrasaId, userId, expenseId, data) {
  const existing = await prisma.expense.findFirst({
    where: { id: expenseId, madrasaId },
    include: { category: true },
  });
  if (!existing) {
    throw new NotFoundError('Expense record not found.');
  }
  if (existing.status === 'VOID') {
    throw new BadRequestError('Cannot update a voided expense record.');
  }

  let categoryName = existing.category.name;
  if (data.categoryId && data.categoryId !== existing.categoryId) {
    const newCategory = await prisma.expenseCategory.findFirst({
      where: { id: data.categoryId, madrasaId, isActive: true },
    });
    if (!newCategory) {
      throw new NotFoundError('Expense category not found or is inactive.');
    }
    categoryName = newCategory.name;
  }

  const updatePayload = { updatedById: userId };
  if (data.expenseDate) updatePayload.expenseDate = parseDateOnly(data.expenseDate);
  if (data.categoryId) updatePayload.categoryId = data.categoryId;
  if (data.description !== undefined) updatePayload.description = data.description;
  if (data.amount !== undefined) updatePayload.amount = new Prisma.Decimal(data.amount);
  if (data.quantity !== undefined) updatePayload.quantity = data.quantity ? new Prisma.Decimal(data.quantity) : null;
  if (data.unitLabel !== undefined) updatePayload.unitLabel = data.unitLabel || null;
  if (data.unitCost !== undefined) updatePayload.unitCost = data.unitCost !== null ? new Prisma.Decimal(data.unitCost) : null;
  if (data.supplierName !== undefined) updatePayload.supplierName = data.supplierName || null;
  if (data.reasonNote !== undefined) updatePayload.reasonNote = data.reasonNote || null;

  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.expense.update({
      where: { id: expenseId },
      data: updatePayload,
      include: {
        category: { select: { id: true, name: true } },
      },
    });

    await tx.activityLog.create({
      data: {
        madrasaId,
        userId,
        action: 'EXPENSE_UPDATED',
        entityType: 'Expense',
        entityId: res.id,
        metadata: {
          categoryName,
          amount: res.amount.toString(),
          description: res.description,
        },
      },
    });

    return res;
  });

  return {
    ...updated,
    expenseDate: formatDateOnly(updated.expenseDate),
    amount: updated.amount.toString(),
    quantity: updated.quantity ? updated.quantity.toString() : null,
    unitCost: updated.unitCost ? updated.unitCost.toString() : null,
  };
}

export async function voidExpense(madrasaId, userId, expenseId, voidReason) {
  const existing = await prisma.expense.findFirst({
    where: { id: expenseId, madrasaId },
    include: { category: true },
  });
  if (!existing) {
    throw new NotFoundError('Expense record not found.');
  }
  if (existing.status === 'VOID') {
    throw new BadRequestError('Expense record is already voided.');
  }

  const voided = await prisma.$transaction(async (tx) => {
    const res = await tx.expense.update({
      where: { id: expenseId },
      data: {
        status: 'VOID',
        voidReason,
        voidedAt: new Date(),
        updatedById: userId,
      },
      include: {
        category: { select: { id: true, name: true } },
      },
    });

    await tx.activityLog.create({
      data: {
        madrasaId,
        userId,
        action: 'EXPENSE_VOIDED',
        entityType: 'Expense',
        entityId: res.id,
        metadata: {
          categoryName: existing.category.name,
          amount: res.amount.toString(),
          voidReason,
        },
      },
    });

    return res;
  });

  return {
    ...voided,
    expenseDate: formatDateOnly(voided.expenseDate),
    amount: voided.amount.toString(),
    quantity: voided.quantity ? voided.quantity.toString() : null,
    unitCost: voided.unitCost ? voided.unitCost.toString() : null,
  };
}

export async function listExpenses(madrasaId, filters = {}) {
  const where = { madrasaId };

  if (filters.month) {
    const { year, month } = parseYearMonth(filters.month);
    const { start, end } = getMonthBoundaries(year, month);
    where.expenseDate = { gte: start, lt: end };
  } else if (filters.startDate || filters.endDate) {
    where.expenseDate = {};
    if (filters.startDate) where.expenseDate.gte = parseDateOnly(filters.startDate);
    if (filters.endDate) where.expenseDate.lte = parseDateOnly(filters.endDate);
  }

  if (filters.categoryId) {
    where.categoryId = filters.categoryId;
  }

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.search) {
    const search = filters.search.trim();
    where.OR = [
      { description: { contains: search } },
      { supplierName: { contains: search } },
      { reasonNote: { contains: search } },
    ];
  }

  const page = filters.page || 1;
  const pageSize = filters.pageSize || 50;
  const skip = (page - 1) * pageSize;

  const [total, items] = await Promise.all([
    prisma.expense.count({ where }),
    prisma.expense.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: [{ expenseDate: 'desc' }, { createdAt: 'desc' }],
      skip,
      take: pageSize,
    }),
  ]);

  return {
    data: items.map((e) => ({
      ...e,
      expenseDate: formatDateOnly(e.expenseDate),
      amount: e.amount.toString(),
      quantity: e.quantity ? e.quantity.toString() : null,
      unitCost: e.unitCost ? e.unitCost.toString() : null,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 1,
  };
}

// ==========================================
// 3. BUDGET MANAGEMENT (Atomic Bulk Upsert)
// ==========================================

export async function upsertBudgets(madrasaId, userId, { year, month, budgets }) {
  // 1. Reject duplicate categoryId values
  const seenCatIds = new Set();
  for (const b of budgets) {
    if (seenCatIds.has(b.categoryId)) {
      throw new BadRequestError(`Duplicate categoryId '${b.categoryId}' in budgets payload.`);
    }
    seenCatIds.add(b.categoryId);
  }

  // 2. Validate ALL categoryIds belong to current tenant BEFORE any write
  const categoryIds = budgets.map((b) => b.categoryId);
  const tenantCategories = await prisma.expenseCategory.findMany({
    where: { id: { in: categoryIds }, madrasaId },
    select: { id: true },
  });

  if (tenantCategories.length !== categoryIds.length) {
    throw new NotFoundError('One or more expense categories do not belong to this tenant or do not exist.');
  }

  // 3-6. Atomic transaction: upsert all budgets + write ActivityLog
  const results = await prisma.$transaction(async (tx) => {
    const upsertedList = [];
    for (const b of budgets) {
      const amountDecimal = new Prisma.Decimal(b.amount);
      const row = await tx.expenseBudget.upsert({
        where: {
          madrasaId_categoryId_year_month: {
            madrasaId,
            categoryId: b.categoryId,
            year,
            month,
          },
        },
        create: {
          madrasaId,
          categoryId: b.categoryId,
          year,
          month,
          amount: amountDecimal,
        },
        update: {
          amount: amountDecimal,
        },
        include: {
          category: { select: { id: true, name: true } },
        },
      });
      upsertedList.push(row);
    }

    await tx.activityLog.create({
      data: {
        madrasaId,
        userId,
        action: 'EXPENSE_BUDGET_UPDATED',
        entityType: 'ExpenseBudget',
        entityId: `${year}-${String(month).padStart(2, '0')}`,
        metadata: {
          year,
          month,
          count: budgets.length,
          categories: budgets.map((b) => b.categoryId),
        },
      },
    });

    return upsertedList;
  });

  return results.map((r) => ({
    ...r,
    amount: r.amount.toString(),
  }));
}

export async function getBudgets(madrasaId, year, month) {
  const rows = await prisma.expenseBudget.findMany({
    where: { madrasaId, year, month },
    include: { category: { select: { id: true, name: true } } },
    orderBy: { category: { name: 'asc' } },
  });
  return rows.map((r) => ({
    ...r,
    amount: r.amount.toString(),
  }));
}

// ==========================================
// 4. MONTHLY INSIGHT
// ==========================================

export async function upsertMonthlyInsight(madrasaId, userId, { categoryId, year, month, adminReason, actionPlan }) {
  const category = await prisma.expenseCategory.findFirst({
    where: { id: categoryId, madrasaId },
  });
  if (!category) {
    throw new NotFoundError('Expense category not found.');
  }

  const insight = await prisma.expenseMonthlyInsight.upsert({
    where: {
      madrasaId_categoryId_year_month: {
        madrasaId,
        categoryId,
        year,
        month,
      },
    },
    create: {
      madrasaId,
      categoryId,
      year,
      month,
      adminReason: adminReason || null,
      actionPlan: actionPlan || null,
    },
    update: {
      adminReason: adminReason || null,
      actionPlan: actionPlan || null,
    },
    include: {
      category: { select: { id: true, name: true } },
    },
  });

  logTenantActivity({
    madrasaId,
    userId,
    action: 'EXPENSE_INSIGHT_UPDATED',
    entityType: 'ExpenseMonthlyInsight',
    entityId: insight.id,
    metadata: {
      categoryName: category.name,
      year,
      month,
      hasReason: Boolean(adminReason),
      hasPlan: Boolean(actionPlan),
    },
  }).catch(() => {});

  return insight;
}

// ==========================================
// 5. MONTHLY SUMMARY
// ==========================================

export async function getMonthlySummary(madrasaId, year, month) {
  const { start: curStart, end: curEnd } = getMonthBoundaries(year, month);
  const { prevYear, prevMonth } = getPreviousMonth(year, month);
  const { start: prevStart, end: prevEnd } = getMonthBoundaries(prevYear, prevMonth);

  const [curSum, prevSum, budgetSum] = await Promise.all([
    prisma.expense.aggregate({
      where: { madrasaId, status: 'ACTIVE', expenseDate: { gte: curStart, lt: curEnd } },
      _sum: { amount: true },
    }),
    prisma.expense.aggregate({
      where: { madrasaId, status: 'ACTIVE', expenseDate: { gte: prevStart, lt: prevEnd } },
      _sum: { amount: true },
    }),
    prisma.expenseBudget.aggregate({
      where: { madrasaId, year, month },
      _sum: { amount: true },
    }),
  ]);

  const currentTotal = curSum._sum.amount || new Prisma.Decimal(0);
  const previousTotal = prevSum._sum.amount || new Prisma.Decimal(0);
  const difference = currentTotal.minus(previousTotal);
  const totalBudget = budgetSum._sum.amount || new Prisma.Decimal(0);
  const budgetVariance = currentTotal.minus(totalBudget);

  let percentageChange = null;
  let changeLabel = '0%';
  if (!previousTotal.isZero()) {
    percentageChange = difference.dividedBy(previousTotal).times(100).toDecimalPlaces(2).toNumber();
    changeLabel = `${percentageChange >= 0 ? '+' : ''}${percentageChange.toFixed(2)}%`;
  } else if (!currentTotal.isZero()) {
    changeLabel = 'NEW_SPEND';
  }

  let totalBudgetStatus = 'NOT_SET';
  if (!totalBudget.isZero()) {
    const ratio = currentTotal.dividedBy(totalBudget).toNumber();
    if (ratio > 1.0) totalBudgetStatus = 'OVER_BUDGET';
    else if (ratio >= 0.8) totalBudgetStatus = 'NEAR_BUDGET';
    else totalBudgetStatus = 'WITHIN_BUDGET';
  } else if (totalBudget.isZero() && !currentTotal.isZero()) {
    totalBudgetStatus = 'OVER_BUDGET';
  } else if (totalBudget.isZero() && currentTotal.isZero()) {
    totalBudgetStatus = 'WITHIN_BUDGET';
  }

  return {
    selectedMonth: `${year}-${String(month).padStart(2, '0')}`,
    previousMonth: `${prevYear}-${String(prevMonth).padStart(2, '0')}`,
    currentTotal: currentTotal.toString(),
    previousTotal: previousTotal.toString(),
    difference: difference.toString(),
    percentageChange,
    changeLabel,
    totalBudget: totalBudget.toString(),
    budgetVariance: budgetVariance.toString(),
    totalBudgetStatus,
  };
}

// ==========================================
// 6. CATEGORY COMPARISON (Category-Union Rule)
// ==========================================

export async function getCategoryComparison(madrasaId, year, month) {
  const { start: curStart, end: curEnd } = getMonthBoundaries(year, month);
  const { prevYear, prevMonth } = getPreviousMonth(year, month);
  const { start: prevStart, end: prevEnd } = getMonthBoundaries(prevYear, prevMonth);

  // Active expenses in current month
  const curExpenses = await prisma.expense.findMany({
    where: { madrasaId, status: 'ACTIVE', expenseDate: { gte: curStart, lt: curEnd } },
    include: { category: true },
  });

  // Active expenses in previous month
  const prevExpenses = await prisma.expense.findMany({
    where: { madrasaId, status: 'ACTIVE', expenseDate: { gte: prevStart, lt: prevEnd } },
    include: { category: true },
  });

  // Budgets for current month
  const budgets = await prisma.expenseBudget.findMany({
    where: { madrasaId, year, month },
    include: { category: true },
  });

  // Insights for current month
  const insights = await prisma.expenseMonthlyInsight.findMany({
    where: { madrasaId, year, month },
    include: { category: true },
  });

  // Category Union: current month categories + previous month categories + budget categories
  const categoryMap = new Map();

  for (const exp of curExpenses) {
    if (!categoryMap.has(exp.categoryId)) {
      categoryMap.set(exp.categoryId, { id: exp.categoryId, name: exp.category.name });
    }
  }
  for (const exp of prevExpenses) {
    if (!categoryMap.has(exp.categoryId)) {
      categoryMap.set(exp.categoryId, { id: exp.categoryId, name: exp.category.name });
    }
  }
  for (const b of budgets) {
    if (!categoryMap.has(b.categoryId)) {
      categoryMap.set(b.categoryId, { id: b.categoryId, name: b.category.name });
    }
  }

  // Pre-index budgets and insights
  const budgetMap = new Map(budgets.map((b) => [b.categoryId, b.amount]));
  const insightMap = new Map(insights.map((i) => [i.categoryId, i]));

  const comparisonRows = [];

  for (const [catId, cat] of categoryMap.entries()) {
    // Current month metrics
    const catCur = curExpenses.filter((e) => e.categoryId === catId);
    let curTotal = new Prisma.Decimal(0);
    const recordedReasons = [];
    for (const e of catCur) {
      curTotal = curTotal.plus(e.amount);
      if (e.reasonNote && e.reasonNote.trim() && !recordedReasons.includes(e.reasonNote.trim())) {
        recordedReasons.push(e.reasonNote.trim());
      }
    }

    // Previous month metrics
    const catPrev = prevExpenses.filter((e) => e.categoryId === catId);
    let prevTotal = new Prisma.Decimal(0);
    for (const e of catPrev) {
      prevTotal = prevTotal.plus(e.amount);
    }

    const difference = curTotal.minus(prevTotal);

    let percentageChange = null;
    let changeLabel = '0%';
    if (!prevTotal.isZero()) {
      percentageChange = difference.dividedBy(prevTotal).times(100).toDecimalPlaces(2).toNumber();
      changeLabel = `${percentageChange >= 0 ? '+' : ''}${percentageChange.toFixed(2)}%`;
    } else if (!curTotal.isZero()) {
      changeLabel = 'NEW_SPEND';
    }

    // Budget vs Actual
    const budgetAmount = budgetMap.get(catId) || null;
    let budgetVariance = null;
    let budgetStatus = 'NOT_SET';

    if (budgetAmount !== null) {
      budgetVariance = curTotal.minus(budgetAmount);
      if (budgetAmount.isZero()) {
        if (curTotal.isZero()) {
          budgetStatus = 'WITHIN_BUDGET';
        } else {
          budgetStatus = 'OVER_BUDGET';
        }
      } else {
        const ratio = curTotal.dividedBy(budgetAmount).toNumber();
        if (ratio > 1.0) {
          budgetStatus = 'OVER_BUDGET';
        } else if (ratio >= 0.8) {
          budgetStatus = 'NEAR_BUDGET';
        } else {
          budgetStatus = 'WITHIN_BUDGET';
        }
      }
    }

    const insight = insightMap.get(catId);
    const adminReason = insight?.adminReason || null;
    const actionPlan = insight?.actionPlan || null;

    comparisonRows.push({
      categoryId: catId,
      categoryName: cat.name,
      currentTotal: curTotal.toString(),
      previousTotal: prevTotal.toString(),
      difference: difference.toString(),
      percentageChange,
      changeLabel,
      budget: budgetAmount ? budgetAmount.toString() : null,
      budgetVariance: budgetVariance ? budgetVariance.toString() : null,
      budgetStatus,
      recordedReasons,
      adminReason,
      actionPlan,
      expenseCount: catCur.length,
      previousExpenseCount: catPrev.length,
    });
  }

  // Sort: Largest absolute difference descending
  comparisonRows.sort((a, b) => Math.abs(Number(b.difference)) - Math.abs(Number(a.difference)));

  return comparisonRows;
}

// ==========================================
// 7. COST REVIEW (Deterministic Data Signals)
// ==========================================

export async function getCostReview(madrasaId, year, month) {
  const comparison = await getCategoryComparison(madrasaId, year, month);
  const { start: curStart, end: curEnd } = getMonthBoundaries(year, month);
  const { prevYear, prevMonth } = getPreviousMonth(year, month);
  const { start: prevStart, end: prevEnd } = getMonthBoundaries(prevYear, prevMonth);

  const curExpenses = await prisma.expense.findMany({
    where: { madrasaId, status: 'ACTIVE', expenseDate: { gte: curStart, lt: curEnd } },
  });
  const prevExpenses = await prisma.expense.findMany({
    where: { madrasaId, status: 'ACTIVE', expenseDate: { gte: prevStart, lt: prevEnd } },
  });

  const costReviewItems = [];

  for (const row of comparison) {
    const catCur = curExpenses.filter((e) => e.categoryId === row.categoryId);
    const catPrev = prevExpenses.filter((e) => e.categoryId === row.categoryId);

    const dataSignals = [];
    const suggestions = [];

    // Factual data signals
    const curTotalNum = Number(row.currentTotal);
    const prevTotalNum = Number(row.previousTotal);
    const diffNum = Number(row.difference);

    if (diffNum !== 0) {
      dataSignals.push(`Category spend ${diffNum > 0 ? 'increased' : 'decreased'} by LKR ${Math.abs(diffNum).toLocaleString('en-US', { minimumFractionDigits: 2 })} (${row.changeLabel}).`);
    }

    dataSignals.push(`Transaction count: ${MONTH_NAMES[prevMonth - 1]} (${catPrev.length}) → ${MONTH_NAMES[month - 1]} (${catCur.length}).`);

    if (catCur.length > 0) {
      const avgCur = curTotalNum / catCur.length;
      const avgPrev = catPrev.length > 0 ? prevTotalNum / catPrev.length : 0;
      dataSignals.push(`Average expense transaction: ${MONTH_NAMES[prevMonth - 1]} LKR ${avgPrev.toLocaleString('en-US', { minimumFractionDigits: 2 })} → ${MONTH_NAMES[month - 1]} LKR ${avgCur.toLocaleString('en-US', { minimumFractionDigits: 2 })}.`);

      let largestExp = new Prisma.Decimal(0);
      for (const e of catCur) {
        if (e.amount.greaterThan(largestExp)) {
          largestExp = e.amount;
        }
      }
      dataSignals.push(`Largest single expense this month: LKR ${Number(largestExp).toLocaleString('en-US', { minimumFractionDigits: 2 })}.`);
    }

    if (row.budgetStatus === 'OVER_BUDGET' && row.budgetVariance) {
      dataSignals.push(`Monthly budget exceeded by LKR ${Number(row.budgetVariance).toLocaleString('en-US', { minimumFractionDigits: 2 })}.`);
    }

    // Optional Unit-Cost Signal (ONLY when >=2 expenses in each month share compatible unitLabel and non-null unitCost)
    let unitCostSignalComputed = false;
    let unitCostIncreasePercent = 0;
    const curUnits = catCur.filter((e) => e.unitLabel && e.unitCost !== null);
    const prevUnits = catPrev.filter((e) => e.unitLabel && e.unitCost !== null);

    if (curUnits.length >= 2 && prevUnits.length >= 2) {
      const unitMap = new Map();
      for (const e of curUnits) {
        unitMap.set(e.unitLabel.toLowerCase(), e.unitLabel);
      }
      for (const [normUnit, originalUnit] of unitMap.entries()) {
        const curMatching = curUnits.filter((e) => e.unitLabel.toLowerCase() === normUnit);
        const prevMatching = prevUnits.filter((e) => e.unitLabel.toLowerCase() === normUnit);
        if (curMatching.length >= 2 && prevMatching.length >= 2) {
          const avgCurCost = curMatching.reduce((acc, val) => acc + Number(val.unitCost), 0) / curMatching.length;
          const avgPrevCost = prevMatching.reduce((acc, val) => acc + Number(val.unitCost), 0) / prevMatching.length;
          if (avgPrevCost > 0) {
            const unitDiff = avgCurCost - avgPrevCost;
            unitCostIncreasePercent = (unitDiff / avgPrevCost) * 100;
            dataSignals.push(
              `Average recorded unit cost (${originalUnit}): ${MONTH_NAMES[prevMonth - 1]} LKR ${avgPrevCost.toFixed(2)} → ${MONTH_NAMES[month - 1]} LKR ${avgCurCost.toFixed(2)} (${unitCostIncreasePercent >= 0 ? '+' : ''}${unitCostIncreasePercent.toFixed(2)}%).`
            );
            unitCostSignalComputed = true;
          }
        }
      }
    }

    // Deterministic Review Suggestions (never fabricated reasons)
    if (row.budgetStatus === 'OVER_BUDGET') {
      suggestions.push('Review the largest expenses in this category and confirm whether the budget needs adjustment.');
    }

    if (unitCostSignalComputed && unitCostIncreasePercent >= 10) {
      suggestions.push('Compare supplier rates or negotiate purchase pricing.');
    }

    if (catCur.length >= catPrev.length * 1.5 && (catCur.length - catPrev.length >= 5)) {
      suggestions.push('Review whether purchases can be consolidated.');
    }

    if (catCur.length > 0) {
      let maxExpAmount = 0;
      for (const e of catCur) {
        if (Number(e.amount) > maxExpAmount) maxExpAmount = Number(e.amount);
      }
      if (curTotalNum > 0 && maxExpAmount >= curTotalNum * 0.5) {
        suggestions.push('Review the unusually large one-time expense.');
      }
    }

    if (suggestions.length === 0) {
      suggestions.push('No specific data-based reduction suggestion is available for this category.');
    }

    costReviewItems.push({
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      currentTotal: row.currentTotal,
      previousTotal: row.previousTotal,
      difference: row.difference,
      changeLabel: row.changeLabel,
      budget: row.budget,
      budgetVariance: row.budgetVariance,
      budgetStatus: row.budgetStatus,
      recordedReasons: row.recordedReasons,
      adminReason: row.adminReason,
      actionPlan: row.actionPlan,
      dataSignals,
      suggestions,
    });
  }

  // Top increases / decreases lists
  const topIncreases = comparison
    .filter((r) => Number(r.difference) > 0)
    .sort((a, b) => Number(b.difference) - Number(a.difference))
    .slice(0, 5);

  const topDecreases = comparison
    .filter((r) => Number(r.difference) < 0)
    .sort((a, b) => Number(a.difference) - Number(b.difference))
    .slice(0, 5);

  return {
    categories: costReviewItems,
    topIncreases,
    topDecreases,
  };
}

// ==========================================
// 8. SIX-MONTH EXPENSE TREND
// ==========================================

export async function getExpenseTrend(madrasaId, year, month) {
  const trend = [];

  for (let i = 5; i >= 0; i--) {
    let tMonth = month - i;
    let tYear = year;
    while (tMonth <= 0) {
      tMonth += 12;
      tYear -= 1;
    }

    const { start, end } = getMonthBoundaries(tYear, tMonth);
    const agg = await prisma.expense.aggregate({
      where: {
        madrasaId,
        status: 'ACTIVE',
        expenseDate: { gte: start, lt: end },
      },
      _sum: { amount: true },
    });

    const total = agg._sum.amount ? agg._sum.amount.toString() : '0';
    trend.push({
      year: tYear,
      month: tMonth,
      label: `${MONTH_NAMES[tMonth - 1].substring(0, 3)} ${tYear}`,
      total,
    });
  }

  return trend;
}

// ==========================================
// 9. EXPORTS (PDF & CSV)
// ==========================================

export async function exportMonthlyPdf(madrasaId, year, month) {
  const [summary, comparison, costReview, madrasa, setting, logoUri] = await Promise.all([
    getMonthlySummary(madrasaId, year, month),
    getCategoryComparison(madrasaId, year, month),
    getCostReview(madrasaId, year, month),
    prisma.madrasa.findUnique({ where: { id: madrasaId }, select: { name: true } }),
    prisma.madrasaSetting.findUnique({ where: { madrasaId }, select: { currency: true } }),
    resolveLogoDataUri(madrasaId),
  ]);

  const currency = setting?.currency || 'LKR';
  const madrasaName = madrasa?.name || 'Madrasa Workspace';
  const monthLabel = `${MONTH_NAMES[month - 1]} ${year}`;

  const rowsHtml = comparison
    .map((r) => {
      let statusColor = '#64748b';
      if (r.budgetStatus === 'OVER_BUDGET') statusColor = '#dc2626';
      else if (r.budgetStatus === 'NEAR_BUDGET') statusColor = '#d97706';
      else if (r.budgetStatus === 'WITHIN_BUDGET') statusColor = '#16a34a';

      return `
      <tr>
        <td style="border: 1px solid #333; padding: 6px 8px; font-weight: bold; word-break: break-word;">${escapeHtml(r.categoryName)}</td>
        <td style="border: 1px solid #333; padding: 6px 8px; text-align: right;">${Number(r.previousTotal).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
        <td style="border: 1px solid #333; padding: 6px 8px; text-align: right; font-weight: bold;">${Number(r.currentTotal).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
        <td style="border: 1px solid #333; padding: 6px 8px; text-align: right; color: ${Number(r.difference) > 0 ? '#b91c1c' : '#15803d'};">
          ${Number(r.difference) >= 0 ? '+' : ''}${Number(r.difference).toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </td>
        <td style="border: 1px solid #333; padding: 6px 8px; text-align: right;">${escapeHtml(r.changeLabel === 'NEW_SPEND' ? 'New Spend' : r.changeLabel)}</td>
        <td style="border: 1px solid #333; padding: 6px 8px; text-align: right;">${r.budget ? Number(r.budget).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '-'}</td>
        <td style="border: 1px solid #333; padding: 6px 8px; text-align: right;">${r.budgetVariance ? (Number(r.budgetVariance) >= 0 ? '+' : '') + Number(r.budgetVariance).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '-'}</td>
        <td style="border: 1px solid #333; padding: 6px 8px; text-align: center; color: ${statusColor}; font-weight: bold;">
          ${escapeHtml(r.budgetStatus.replace('_', ' '))}
        </td>
      </tr>
    `;
    })
    .join('');

  // Top increases section
  const increasesHtml = costReview.topIncreases.length > 0
    ? costReview.topIncreases.map((inc, i) => `<li><strong>${i + 1}. ${escapeHtml(inc.categoryName)}:</strong> +${currency} ${Number(inc.difference).toLocaleString('en-US', { minimumFractionDigits: 2 })} (${escapeHtml(inc.changeLabel)})</li>`).join('')
    : '<li>No categories increased this month.</li>';

  // Top decreases section
  const decreasesHtml = costReview.topDecreases.length > 0
    ? costReview.topDecreases.map((dec, i) => `<li><strong>${i + 1}. ${escapeHtml(dec.categoryName)}:</strong> ${currency} ${Number(dec.difference).toLocaleString('en-US', { minimumFractionDigits: 2 })} (${escapeHtml(dec.changeLabel)})</li>`).join('')
    : '<li>No categories decreased this month.</li>';

  // Recorded reasons section
  const reasonsList = [];
  for (const c of costReview.categories) {
    if (c.recordedReasons.length > 0 || c.adminReason) {
      const items = [];
      for (const r of c.recordedReasons) items.push(escapeHtml(r));
      if (c.adminReason) items.push(`<em>Admin Note:</em> ${escapeHtml(c.adminReason)}`);
      reasonsList.push(`<li><strong>${escapeHtml(c.categoryName)}:</strong> ${items.join('; ')}</li>`);
    }
  }
  const recordedReasonsHtml = reasonsList.length > 0 ? reasonsList.join('') : '<li>No recorded reasons available for this month.</li>';

  // Management action plan section
  const planList = [];
  for (const c of costReview.categories) {
    if (c.actionPlan) {
      planList.push(`<li><strong>${escapeHtml(c.categoryName)}:</strong> ${escapeHtml(c.actionPlan)}</li>`);
    }
  }
  const actionPlanHtml = planList.length > 0 ? planList.join('') : '<li>No specific management action plan recorded for this month.</li>';

  // Cost Review Suggestions section
  const suggestionsList = [];
  for (const c of costReview.categories) {
    if (c.suggestions && c.suggestions.length > 0) {
      for (const s of c.suggestions) {
        suggestionsList.push(`<li><strong>${escapeHtml(c.categoryName)}:</strong> ${escapeHtml(s)}</li>`);
      }
    }
  }
  const suggestionsHtml = suggestionsList.length > 0 ? suggestionsList.join('') : '<li>No cost review suggestions available.</li>';

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Monthly Expense Analysis - ${escapeHtml(monthLabel)}</title>
  <style>
    body {
      font-family: 'Noto Sans Local', sans-serif;
      margin: 0;
      padding: 0;
      color: #1a1a1a;
      background: #ffffff;
      font-size: 11px;
    }
    .header {
      text-align: center;
      margin-bottom: 20px;
    }
    .header img {
      max-height: 70px;
      max-width: 180px;
      object-fit: contain;
      margin-bottom: 8px;
    }
    .header h1 {
      margin: 0 0 4px 0;
      font-size: 18px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .header h2 {
      margin: 0 0 4px 0;
      font-size: 13px;
      color: #475569;
      font-weight: normal;
    }
    .header .month {
      font-size: 12px;
      font-weight: bold;
      color: #0f172a;
    }
    .summary-grid {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    .summary-grid td {
      border: 1px solid #333;
      padding: 8px 12px;
      width: 33.33%;
    }
    .metric-label {
      font-size: 9px;
      color: #64748b;
      text-transform: uppercase;
      font-weight: bold;
      margin-bottom: 4px;
    }
    .metric-val {
      font-size: 14px;
      font-weight: bold;
      color: #0f172a;
    }
    .table-container {
      margin-bottom: 25px;
    }
    table.data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10.5px;
    }
    table.data-table th {
      border: 1px solid #333;
      background: #f1f5f9;
      padding: 7px 8px;
      font-weight: bold;
      text-transform: uppercase;
      font-size: 9.5px;
      color: #0f172a;
    }
    .analysis-section {
      margin-bottom: 18px;
      page-break-inside: avoid;
    }
    .analysis-title {
      font-size: 11px;
      font-weight: bold;
      text-transform: uppercase;
      color: #0f172a;
      border-bottom: 1.5px solid #0f172a;
      padding-bottom: 3px;
      margin-bottom: 8px;
    }
    ul.analysis-list {
      margin: 0;
      padding-left: 18px;
      line-height: 1.6;
    }
    .footer {
      text-align: center;
      font-size: 9px;
      color: #94a3b8;
      border-top: 1px solid #e2e8f0;
      padding-top: 8px;
      margin-top: 25px;
    }
  </style>
</head>
<body>
  <div class="header">
    ${logoUri ? `<img src="${logoUri}" alt="Logo" />` : ''}
    <h1>${escapeHtml(madrasaName)}</h1>
    <h2>Monthly Expense Analysis</h2>
    <div class="month">Month: ${escapeHtml(monthLabel)}</div>
  </div>

  <table class="summary-grid">
    <tr>
      <td>
        <div class="metric-label">Current Month Expense</div>
        <div class="metric-val">${currency} ${Number(summary.currentTotal).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
      </td>
      <td>
        <div class="metric-label">Previous Month Expense</div>
        <div class="metric-val">${currency} ${Number(summary.previousTotal).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
      </td>
      <td>
        <div class="metric-label">Difference / Change</div>
        <div class="metric-val" style="color: ${Number(summary.difference) > 0 ? '#b91c1c' : '#15803d'};">
          ${Number(summary.difference) >= 0 ? '+' : ''}${currency} ${Number(summary.difference).toLocaleString('en-US', { minimumFractionDigits: 2 })} (${escapeHtml(summary.changeLabel === 'NEW_SPEND' ? 'New Spend' : summary.changeLabel)})
        </div>
      </td>
    </tr>
    <tr>
      <td>
        <div class="metric-label">Monthly Budget</div>
        <div class="metric-val">${currency} ${Number(summary.totalBudget).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
      </td>
      <td>
        <div class="metric-label">Budget Variance</div>
        <div class="metric-val" style="color: ${Number(summary.budgetVariance) > 0 ? '#b91c1c' : '#15803d'};">
          ${Number(summary.budgetVariance) >= 0 ? '+' : ''}${currency} ${Number(summary.budgetVariance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </div>
      </td>
      <td>
        <div class="metric-label">Budget Status</div>
        <div class="metric-val" style="text-transform: capitalize;">${escapeHtml(summary.totalBudgetStatus.toLowerCase().replace('_', ' '))}</div>
      </td>
    </tr>
  </table>

  <div class="table-container">
    <table class="data-table">
      <thead>
        <tr>
          <th style="text-align: left;">Category</th>
          <th style="text-align: right;">Previous (${escapeHtml(summary.previousMonth)})</th>
          <th style="text-align: right;">Current (${escapeHtml(summary.selectedMonth)})</th>
          <th style="text-align: right;">Difference</th>
          <th style="text-align: right;">Change</th>
          <th style="text-align: right;">Budget</th>
          <th style="text-align: right;">Variance</th>
          <th style="text-align: center;">Status</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml || '<tr><td colspan="8" style="text-align: center; padding: 12px; border: 1px solid #333;">No expense categories recorded for this period.</td></tr>'}
      </tbody>
    </table>
  </div>

  <div class="analysis-section">
    <div class="analysis-title">Top Cost Increases</div>
    <ul class="analysis-list">${increasesHtml}</ul>
  </div>

  <div class="analysis-section">
    <div class="analysis-title">Top Cost Decreases</div>
    <ul class="analysis-list">${decreasesHtml}</ul>
  </div>

  <div class="analysis-section">
    <div class="analysis-title">Recorded Reasons</div>
    <ul class="analysis-list">${recordedReasonsHtml}</ul>
  </div>

  <div class="analysis-section">
    <div class="analysis-title">Management Action Plan</div>
    <ul class="analysis-list">${actionPlanHtml}</ul>
  </div>

  <div class="analysis-section">
    <div class="analysis-title">Cost Review Suggestions</div>
    <ul class="analysis-list">${suggestionsHtml}</ul>
  </div>

  <div class="footer">
    Generated by MadrasaNexa &bull; Official Expense Analysis Report &bull; ${new Date().toISOString().replace('T', ' ').substring(0, 19)} UTC
  </div>
</body>
</html>`;

  return renderRawHtmlToPdf({ html, landscape: true });
}

export async function exportDetailedCsv(madrasaId, year, month) {
  const { start, end } = getMonthBoundaries(year, month);
  const expenses = await prisma.expense.findMany({
    where: {
      madrasaId,
      status: 'ACTIVE',
      expenseDate: { gte: start, lt: end },
    },
    include: { category: true },
    orderBy: [{ expenseDate: 'asc' }, { createdAt: 'asc' }],
  });

  const headers = [
    'Date',
    'Category',
    'Description',
    'Amount',
    'Quantity',
    'Unit',
    'Unit Cost',
    'Supplier',
    'Reason',
    'Status',
  ];

  const rows = expenses.map((e) => [
    formatDateOnly(e.expenseDate),
    e.category.name,
    e.description,
    e.amount.toString(),
    e.quantity ? e.quantity.toString() : '',
    e.unitLabel || '',
    e.unitCost ? e.unitCost.toString() : '',
    e.supplierName || '',
    e.reasonNote || '',
    e.status,
  ]);

  return generateCsvString({ headers, rows });
}

export async function exportSummaryCsv(madrasaId, year, month) {
  const comparison = await getCategoryComparison(madrasaId, year, month);

  const headers = [
    'Category',
    'Previous Month',
    'Current Month',
    'Difference',
    'Percentage Change',
    'Budget',
    'Variance',
    'Recorded Reason',
    'Action Plan',
  ];

  const rows = comparison.map((r) => [
    r.categoryName,
    r.previousTotal,
    r.currentTotal,
    r.difference,
    r.changeLabel === 'NEW_SPEND' ? 'New Spend' : r.changeLabel,
    r.budget || '',
    r.budgetVariance || '',
    (r.recordedReasons.length > 0 ? r.recordedReasons.join('; ') : (r.adminReason || '')),
    r.actionPlan || '',
  ]);

  return generateCsvString({ headers, rows });
}
