import * as service from '../services/expense-analysis.service.js';
import {
  createCategorySchema,
  updateCategorySchema,
  createExpenseSchema,
  updateExpenseSchema,
  voidExpenseSchema,
  listExpensesSchema,
  monthQuerySchema,
  upsertBudgetSchema,
  upsertInsightSchema,
} from '../validations/expense-analysis.validation.js';

// ==========================================
// CATEGORIES
// ==========================================

export async function createCategory(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const userId = req.auth?.userId || req.user?.id;
    const validated = createCategorySchema.parse(req.body);
    const data = await service.createCategory(madrasaId, userId, validated);
    res.status(201).json({ success: true, message: 'Expense category created successfully.', data });
  } catch (err) {
    next(err);
  }
}

export async function updateCategory(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const userId = req.auth?.userId || req.user?.id;
    const validated = updateCategorySchema.parse(req.body);
    const data = await service.updateCategory(madrasaId, userId, req.params.id, validated);
    res.json({ success: true, message: 'Expense category updated successfully.', data });
  } catch (err) {
    next(err);
  }
}

export async function listCategories(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const includeInactive = req.query.includeInactive === 'true' || req.query.includeInactive === '1';
    const data = await service.listCategories(madrasaId, { includeInactive });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// ==========================================
// EXPENSES
// ==========================================

export async function createExpense(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const userId = req.auth?.userId || req.user?.id;
    const validated = createExpenseSchema.parse(req.body);
    const data = await service.createExpense(madrasaId, userId, validated);
    res.status(201).json({ success: true, message: 'Expense recorded successfully.', data });
  } catch (err) {
    next(err);
  }
}

export async function updateExpense(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const userId = req.auth?.userId || req.user?.id;
    const validated = updateExpenseSchema.parse(req.body);
    const data = await service.updateExpense(madrasaId, userId, req.params.id, validated);
    res.json({ success: true, message: 'Expense updated successfully.', data });
  } catch (err) {
    next(err);
  }
}

export async function voidExpense(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const userId = req.auth?.userId || req.user?.id;
    const validated = voidExpenseSchema.parse(req.body);
    const data = await service.voidExpense(madrasaId, userId, req.params.id, validated.voidReason);
    res.json({ success: true, message: 'Expense voided successfully.', data });
  } catch (err) {
    next(err);
  }
}

export async function listExpenses(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const validated = listExpensesSchema.parse(req.query);
    const result = await service.listExpenses(madrasaId, validated);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

// ==========================================
// BUDGETS
// ==========================================

export async function upsertBudgets(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const userId = req.auth?.userId || req.user?.id;
    const validated = upsertBudgetSchema.parse(req.body);
    const data = await service.upsertBudgets(madrasaId, userId, validated);
    res.json({ success: true, message: 'Budgets updated successfully.', data });
  } catch (err) {
    next(err);
  }
}

export async function getBudgets(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const { month } = monthQuerySchema.parse(req.query);
    const { year, month: m } = service.parseYearMonth(month);
    const data = await service.getBudgets(madrasaId, year, m);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// ==========================================
// INSIGHTS
// ==========================================

export async function upsertInsight(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const userId = req.auth?.userId || req.user?.id;
    const validated = upsertInsightSchema.parse(req.body);
    const data = await service.upsertMonthlyInsight(madrasaId, userId, validated);
    res.json({ success: true, message: 'Monthly insight saved successfully.', data });
  } catch (err) {
    next(err);
  }
}

// ==========================================
// ANALYSIS / SUMMARIES
// ==========================================

export async function getMonthlySummary(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const { month } = monthQuerySchema.parse(req.query);
    const { year, month: m } = service.parseYearMonth(month);
    const data = await service.getMonthlySummary(madrasaId, year, m);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getCategoryComparison(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const { month } = monthQuerySchema.parse(req.query);
    const { year, month: m } = service.parseYearMonth(month);
    const data = await service.getCategoryComparison(madrasaId, year, m);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getCostReview(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const { month } = monthQuerySchema.parse(req.query);
    const { year, month: m } = service.parseYearMonth(month);
    const data = await service.getCostReview(madrasaId, year, m);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getExpenseTrend(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const { month } = monthQuerySchema.parse(req.query);
    const { year, month: m } = service.parseYearMonth(month);
    const data = await service.getExpenseTrend(madrasaId, year, m);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// ==========================================
// EXPORTS
// ==========================================

export async function exportPdf(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const { month } = monthQuerySchema.parse(req.query);
    const { year, month: m } = service.parseYearMonth(month);
    const pdfBuffer = await service.exportMonthlyPdf(madrasaId, year, m);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Expense-Analysis-${month}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
}

export async function exportDetailedCsv(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const { month } = monthQuerySchema.parse(req.query);
    const { year, month: m } = service.parseYearMonth(month);
    const csvString = await service.exportDetailedCsv(madrasaId, year, m);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="Expense-Details-${month}.csv"`);
    res.send(Buffer.from(csvString, 'utf8'));
  } catch (err) {
    next(err);
  }
}

export async function exportSummaryCsv(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const { month } = monthQuerySchema.parse(req.query);
    const { year, month: m } = service.parseYearMonth(month);
    const csvString = await service.exportSummaryCsv(madrasaId, year, m);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="Expense-Summary-${month}.csv"`);
    res.send(Buffer.from(csvString, 'utf8'));
  } catch (err) {
    next(err);
  }
}
