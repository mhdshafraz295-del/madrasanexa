import { apiClient } from './api';

export type ExpenseStatus = 'ACTIVE' | 'VOID';
export type BudgetStatus = 'WITHIN_BUDGET' | 'NEAR_BUDGET' | 'OVER_BUDGET' | 'NOT_SET';

export interface ExpenseCategory {
  id: string;
  madrasaId: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseItem {
  id: string;
  madrasaId: string;
  categoryId: string;
  expenseDate: string;
  description: string;
  amount: string;
  quantity?: string | null;
  unitLabel?: string | null;
  unitCost?: string | null;
  supplierName?: string | null;
  reasonNote?: string | null;
  status: ExpenseStatus;
  voidReason?: string | null;
  voidedAt?: string | null;
  createdById: string;
  updatedById?: string | null;
  createdAt: string;
  updatedAt: string;
  category: { id: string; name: string };
  createdBy?: { id: string; name: string };
}

export interface ExpenseBudgetItem {
  id: string;
  madrasaId: string;
  categoryId: string;
  year: number;
  month: number;
  amount: string;
  category: { id: string; name: string };
}

export interface MonthlySummary {
  selectedMonth: string;
  previousMonth: string;
  currentTotal: string;
  previousTotal: string;
  difference: string;
  percentageChange: number | null;
  changeLabel: string;
  totalBudget: string;
  budgetVariance: string;
  totalBudgetStatus: BudgetStatus;
}

export interface CategoryComparisonItem {
  categoryId: string;
  categoryName: string;
  currentTotal: string;
  previousTotal: string;
  difference: string;
  percentageChange: number | null;
  changeLabel: string;
  budget: string | null;
  budgetVariance: string | null;
  budgetStatus: BudgetStatus;
  recordedReasons: string[];
  adminReason?: string | null;
  actionPlan?: string | null;
  expenseCount: number;
  previousExpenseCount: number;
}

export interface CostReviewCategory {
  categoryId: string;
  categoryName: string;
  currentTotal: string;
  previousTotal: string;
  difference: string;
  changeLabel: string;
  budget: string | null;
  budgetVariance: string | null;
  budgetStatus: BudgetStatus;
  recordedReasons: string[];
  adminReason?: string | null;
  actionPlan?: string | null;
  dataSignals: string[];
  suggestions: string[];
}

export interface CostReviewData {
  categories: CostReviewCategory[];
  topIncreases: { categoryName: string; difference: string; changeLabel: string }[];
  topDecreases: { categoryName: string; difference: string; changeLabel: string }[];
}

export interface MonthlyTrendPoint {
  year: number;
  month: number;
  label: string;
  total: string;
}

export interface MonthlyInsight {
  id: string;
  madrasaId: string;
  categoryId: string;
  year: number;
  month: number;
  adminReason?: string | null;
  actionPlan?: string | null;
  category: { id: string; name: string };
}

// ==========================================
// API CLIENT FUNCTIONS
// ==========================================

export async function listCategories(includeInactive = false): Promise<ExpenseCategory[]> {
  const res = await apiClient.get<{ success: boolean; data: ExpenseCategory[] }>(
    `/madrasa-admin/expense-analysis/categories${includeInactive ? '?includeInactive=true' : ''}`
  );
  return res.data.data;
}

export async function createCategory(payload: { name: string; description?: string | null }): Promise<ExpenseCategory> {
  const res = await apiClient.post<{ success: boolean; data: ExpenseCategory }>(
    '/madrasa-admin/expense-analysis/categories',
    payload
  );
  return res.data.data;
}

export async function updateCategory(
  id: string,
  payload: { name?: string; description?: string | null; isActive?: boolean }
): Promise<ExpenseCategory> {
  const res = await apiClient.patch<{ success: boolean; data: ExpenseCategory }>(
    `/madrasa-admin/expense-analysis/categories/${id}`,
    payload
  );
  return res.data.data;
}

export async function listExpenses(params: {
  month?: string;
  startDate?: string;
  endDate?: string;
  categoryId?: string;
  status?: ExpenseStatus;
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ data: ExpenseItem[]; total: number; page: number; pageSize: number; totalPages: number }> {
  const query = new URLSearchParams();
  if (params.month) query.append('month', params.month);
  if (params.startDate) query.append('startDate', params.startDate);
  if (params.endDate) query.append('endDate', params.endDate);
  if (params.categoryId) query.append('categoryId', params.categoryId);
  if (params.status) query.append('status', params.status);
  if (params.search) query.append('search', params.search);
  if (params.page) query.append('page', params.page.toString());
  if (params.pageSize) query.append('pageSize', params.pageSize.toString());

  const res = await apiClient.get<{
    success: boolean;
    data: ExpenseItem[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }>(`/madrasa-admin/expense-analysis/expenses?${query.toString()}`);
  return res.data;
}

export async function createExpense(payload: {
  expenseDate: string;
  categoryId: string;
  description: string;
  amount: number | string;
  quantity?: number | string | null;
  unitLabel?: string | null;
  unitCost?: number | string | null;
  supplierName?: string | null;
  reasonNote?: string | null;
}): Promise<ExpenseItem> {
  const res = await apiClient.post<{ success: boolean; data: ExpenseItem }>(
    '/madrasa-admin/expense-analysis/expenses',
    payload
  );
  return res.data.data;
}

export async function updateExpense(
  id: string,
  payload: {
    expenseDate?: string;
    categoryId?: string;
    description?: string;
    amount?: number | string;
    quantity?: number | string | null;
    unitLabel?: string | null;
    unitCost?: number | string | null;
    supplierName?: string | null;
    reasonNote?: string | null;
  }
): Promise<ExpenseItem> {
  const res = await apiClient.patch<{ success: boolean; data: ExpenseItem }>(
    `/madrasa-admin/expense-analysis/expenses/${id}`,
    payload
  );
  return res.data.data;
}

export async function voidExpense(id: string, voidReason: string): Promise<ExpenseItem> {
  const res = await apiClient.post<{ success: boolean; data: ExpenseItem }>(
    `/madrasa-admin/expense-analysis/expenses/${id}/void`,
    { voidReason }
  );
  return res.data.data;
}

export async function getBudgets(month: string): Promise<ExpenseBudgetItem[]> {
  const res = await apiClient.get<{ success: boolean; data: ExpenseBudgetItem[] }>(
    `/madrasa-admin/expense-analysis/budgets?month=${month}`
  );
  return res.data.data;
}

export async function upsertBudgets(payload: {
  year: number;
  month: number;
  budgets: { categoryId: string; amount: number | string }[];
}): Promise<ExpenseBudgetItem[]> {
  const res = await apiClient.put<{ success: boolean; data: ExpenseBudgetItem[] }>(
    '/madrasa-admin/expense-analysis/budgets',
    payload
  );
  return res.data.data;
}

export async function upsertInsight(payload: {
  categoryId: string;
  year: number;
  month: number;
  adminReason?: string | null;
  actionPlan?: string | null;
}): Promise<MonthlyInsight> {
  const res = await apiClient.put<{ success: boolean; data: MonthlyInsight }>(
    '/madrasa-admin/expense-analysis/insights',
    payload
  );
  return res.data.data;
}

export async function getMonthlySummary(month: string): Promise<MonthlySummary> {
  const res = await apiClient.get<{ success: boolean; data: MonthlySummary }>(
    `/madrasa-admin/expense-analysis/summary?month=${month}`
  );
  return res.data.data;
}

export async function getCategoryComparison(month: string): Promise<CategoryComparisonItem[]> {
  const res = await apiClient.get<{ success: boolean; data: CategoryComparisonItem[] }>(
    `/madrasa-admin/expense-analysis/comparison?month=${month}`
  );
  return res.data.data;
}

export async function getCostReview(month: string): Promise<CostReviewData> {
  const res = await apiClient.get<{ success: boolean; data: CostReviewData }>(
    `/madrasa-admin/expense-analysis/cost-review?month=${month}`
  );
  return res.data.data;
}

export async function getExpenseTrend(month: string): Promise<MonthlyTrendPoint[]> {
  const res = await apiClient.get<{ success: boolean; data: MonthlyTrendPoint[] }>(
    `/madrasa-admin/expense-analysis/trend?month=${month}`
  );
  return res.data.data;
}

export async function downloadExpensePdf(month: string): Promise<void> {
  const res = await apiClient.get(`/madrasa-admin/expense-analysis/export/pdf?month=${month}`, {
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `Expense-Analysis-${month}.pdf`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function downloadDetailedCsv(month: string): Promise<void> {
  const res = await apiClient.get(`/madrasa-admin/expense-analysis/export/details.csv?month=${month}`, {
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `Expense-Details-${month}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function downloadSummaryCsv(month: string): Promise<void> {
  const res = await apiClient.get(`/madrasa-admin/expense-analysis/export/summary.csv?month=${month}`, {
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `Expense-Summary-${month}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
