import { useState, useEffect, useCallback } from 'react';
import type {
  MonthlySummary,
  CategoryComparisonItem,
  CostReviewData,
  MonthlyTrendPoint,
  ExpenseCategory,
  ExpenseItem,
  ExpenseBudgetItem,
} from '../../services/expense-analysis.service';
import {
  getMonthlySummary,
  getCategoryComparison,
  getCostReview,
  getExpenseTrend,
  listCategories,
  createCategory,
  updateCategory,
  listExpenses,
  createExpense,
  updateExpense,
  voidExpense,
  getBudgets,
  upsertBudgets,
  upsertInsight,
  downloadExpensePdf,
  downloadDetailedCsv,
  downloadSummaryCsv,
} from '../../services/expense-analysis.service';
import ExpenseSummaryCards from '../../components/expense-analysis/ExpenseSummaryCards';
import ExpenseHistoryTable from '../../components/expense-analysis/ExpenseHistoryTable';
import ExpenseCategoryManager from '../../components/expense-analysis/ExpenseCategoryManager';
import ExpenseBudgetModal from '../../components/expense-analysis/ExpenseBudgetModal';
import MonthlyComparisonTable from '../../components/expense-analysis/MonthlyComparisonTable';
import CostReviewPanel from '../../components/expense-analysis/CostReviewPanel';
import MonthlyInsightModal from '../../components/expense-analysis/MonthlyInsightModal';
import ExpenseEntryModal from '../../components/expense-analysis/ExpenseEntryModal';
import ExpenseTrendChart from '../../components/expense-analysis/ExpenseTrendChart';
import BudgetVsActualChart from '../../components/expense-analysis/BudgetVsActualChart';
import {
  Plus,
  FileSpreadsheet,
  FileDown,
  Calendar,
  Layers,
  BarChart3,
  ReceiptText,
  Sliders,
  Sparkles,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';

export default function ExpenseAnalysisPage() {
  const currency = 'LKR';

  // Current month default: YYYY-MM
  const today = new Date();
  const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);

  const [activeTab, setActiveTab] = useState<'overview' | 'expenses' | 'comparison' | 'costReview' | 'categories'>(
    'overview'
  );

  // Data states
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [comparison, setComparison] = useState<CategoryComparisonItem[]>([]);
  const [costReview, setCostReview] = useState<CostReviewData | null>(null);
  const [trend, setTrend] = useState<MonthlyTrendPoint[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [budgets, setBudgets] = useState<ExpenseBudgetItem[]>([]);

  // Expenses table states
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [expensesTotal, setExpensesTotal] = useState(0);
  const [expensePage, setExpensePage] = useState(1);
  const [expenseFilters, setExpenseFilters] = useState<any>({});

  // Loading & error
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Modals
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseItem | null>(null);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [insightModalData, setInsightModalData] = useState<{
    isOpen: boolean;
    categoryId: string;
    categoryName: string;
    existingReason?: string | null;
    existingActionPlan?: string | null;
  }>({
    isOpen: false,
    categoryId: '',
    categoryName: '',
  });

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [summaryRes, compRes, reviewRes, trendRes, catsRes, budgetsRes] = await Promise.all([
        getMonthlySummary(selectedMonth),
        getCategoryComparison(selectedMonth),
        getCostReview(selectedMonth),
        getExpenseTrend(selectedMonth),
        listCategories(true),
        getBudgets(selectedMonth),
      ]);

      setSummary(summaryRes);
      setComparison(compRes);
      setCostReview(reviewRes);
      setTrend(trendRes);
      setCategories(catsRes);
      setBudgets(budgetsRes);

      // Load expenses for selected month
      const expRes = await listExpenses({
        month: selectedMonth,
        page: expensePage,
        pageSize: 50,
        ...expenseFilters,
      });
      setExpenses(expRes.data);
      setExpensesTotal(expRes.total);
    } catch (err: any) {
      console.error('[ExpenseAnalysisPage] load error:', err);
      setError(err?.response?.data?.message || err.message || 'Failed to load expense analysis.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedMonth, expensePage, expenseFilters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Add/Edit Expense
  const handleSaveExpense = async (payload: any) => {
    if (editingExpense) {
      await updateExpense(editingExpense.id, payload);
    } else {
      await createExpense(payload);
    }
    setEditingExpense(null);
    await loadData();
  };

  // Handle Void
  const handleVoidExpense = async (expense: ExpenseItem) => {
    if (!expense.voidReason) return;
    await voidExpense(expense.id, expense.voidReason);
    await loadData();
  };

  // Handle Category CRUD
  const handleAddCategory = async (data: { name: string; description?: string | null }) => {
    await createCategory(data);
    await loadData();
  };

  const handleUpdateCategory = async (id: string, data: any) => {
    await updateCategory(id, data);
    await loadData();
  };

  // Handle Budgets
  const handleSaveBudgets = async (items: { categoryId: string; amount: number | string }[]) => {
    const [y, m] = selectedMonth.split('-').map(Number);
    await upsertBudgets({ year: y, month: m, budgets: items });
    await loadData();
  };

  // Handle Insight
  const handleSaveInsight = async (payload: any) => {
    await upsertInsight(payload);
    await loadData();
  };

  const handleExportPdf = async () => {
    try {
      setIsExporting(true);
      await downloadExpensePdf(selectedMonth);
    } catch (err: any) {
      alert(err?.response?.data?.message || err.message || 'Failed to download PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportDetailedCsv = async () => {
    try {
      setIsExporting(true);
      await downloadDetailedCsv(selectedMonth);
    } catch (err: any) {
      alert(err?.response?.data?.message || err.message || 'Failed to download Detailed CSV.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportSummaryCsv = async () => {
    try {
      setIsExporting(true);
      await downloadSummaryCsv(selectedMonth);
    } catch (err: any) {
      alert(err?.response?.data?.message || err.message || 'Failed to download Summary CSV.');
    } finally {
      setIsExporting(false);
    }
  };

  const [selYear, selMonth] = selectedMonth.split('-').map(Number);

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#7C8A9A] uppercase tracking-wider mb-1">
            <ReceiptText className="w-4 h-4 text-[#37C6A3]" />
            <span>Finance &bull; Operating Expenditure</span>
          </div>
          <h1 className="text-2xl font-extrabold text-[#0F172A] tracking-tight">Expense Analysis</h1>
          <p className="text-xs text-[#7C8A9A] mt-0.5">
            Track operational spending, analyze monthly cost variations, budgets, and data-backed cost review.
          </p>
        </div>

        {/* Action Controls & Month Selector */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-3 py-2 bg-white border border-[#E7E9EE] rounded-xl shadow-xs">
            <Calendar className="w-4 h-4 text-[#7C8A9A]" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => {
                if (e.target.value) setSelectedMonth(e.target.value);
              }}
              className="text-xs font-bold text-[#0F172A] bg-transparent focus:outline-hidden cursor-pointer"
            />
          </div>

          <button
            onClick={() => loadData()}
            className="p-2.5 bg-white border border-[#E7E9EE] hover:bg-[#F7F6F1] rounded-xl text-[#7C8A9A] hover:text-[#0F172A] transition shadow-xs cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => {
              setEditingExpense(null);
              setIsAddExpenseOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#0F172A] hover:bg-[#1E293B] text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#37C6A3]" />
            <span>Add Expense</span>
          </button>

          <button
            onClick={() => setIsBudgetModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-white border border-[#E7E9EE] hover:bg-[#F7F6F1] text-[#0F172A] rounded-xl text-xs font-semibold transition shadow-xs cursor-pointer"
          >
            <Sliders className="w-4 h-4 text-[#7C8A9A]" />
            <span>Set Budgets</span>
          </button>

          {/* Export Dropdown / Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleExportPdf}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-white border border-[#E7E9EE] hover:bg-[#F7F6F1] text-[#0F172A] rounded-xl text-xs font-semibold transition shadow-xs disabled:opacity-50 cursor-pointer"
              title="Download Monthly Analysis PDF"
            >
              <FileDown className="w-4 h-4 text-rose-500" />
              <span>PDF</span>
            </button>

            <button
              onClick={handleExportSummaryCsv}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 bg-white border border-[#E7E9EE] hover:bg-[#F7F6F1] text-[#0F172A] rounded-xl text-xs font-semibold transition shadow-xs disabled:opacity-50 cursor-pointer"
              title="Download Summary CSV"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Summary CSV</span>
            </button>

            <button
              onClick={handleExportDetailedCsv}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 bg-white border border-[#E7E9EE] hover:bg-[#F7F6F1] text-[#0F172A] rounded-xl text-xs font-semibold transition shadow-xs disabled:opacity-50 cursor-pointer"
              title="Download Detailed Transactions CSV"
            >
              <FileSpreadsheet className="w-4 h-4 text-blue-600" />
              <span>Details CSV</span>
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2 text-rose-700 text-xs">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Metric Cards */}
      <ExpenseSummaryCards summary={summary} currency={currency} />

      {/* Tabs Navigation */}
      <div className="border-b border-[#E7E9EE] flex items-center gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 px-3 text-xs font-bold border-b-2 transition whitespace-nowrap cursor-pointer ${
            activeTab === 'overview'
              ? 'border-[#0F172A] text-[#0F172A]'
              : 'border-transparent text-[#7C8A9A] hover:text-[#0F172A]'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Overview &amp; Trends</span>
          </div>
        </button>

        <button
          onClick={() => setActiveTab('comparison')}
          className={`pb-3 px-3 text-xs font-bold border-b-2 transition whitespace-nowrap cursor-pointer ${
            activeTab === 'comparison'
              ? 'border-[#0F172A] text-[#0F172A]'
              : 'border-transparent text-[#7C8A9A] hover:text-[#0F172A]'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            <span>Category Comparison</span>
          </div>
        </button>

        <button
          onClick={() => setActiveTab('costReview')}
          className={`pb-3 px-3 text-xs font-bold border-b-2 transition whitespace-nowrap cursor-pointer ${
            activeTab === 'costReview'
              ? 'border-[#0F172A] text-[#0F172A]'
              : 'border-transparent text-[#7C8A9A] hover:text-[#0F172A]'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Cost Review &amp; Signals</span>
          </div>
        </button>

        <button
          onClick={() => setActiveTab('expenses')}
          className={`pb-3 px-3 text-xs font-bold border-b-2 transition whitespace-nowrap cursor-pointer ${
            activeTab === 'expenses'
              ? 'border-[#0F172A] text-[#0F172A]'
              : 'border-transparent text-[#7C8A9A] hover:text-[#0F172A]'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <ReceiptText className="w-3.5 h-3.5" />
            <span>Expense Records ({expensesTotal})</span>
          </div>
        </button>

        <button
          onClick={() => setActiveTab('categories')}
          className={`pb-3 px-3 text-xs font-bold border-b-2 transition whitespace-nowrap cursor-pointer ${
            activeTab === 'categories'
              ? 'border-[#0F172A] text-[#0F172A]'
              : 'border-transparent text-[#7C8A9A] hover:text-[#0F172A]'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5" />
            <span>Categories ({categories.length})</span>
          </div>
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <BudgetVsActualChart comparison={comparison} currency={currency} />
            <ExpenseTrendChart trend={trend} currency={currency} />
          </div>

          <MonthlyComparisonTable
            comparison={comparison}
            selectedMonth={selectedMonth}
            previousMonth={summary?.previousMonth || ''}
            currency={currency}
            onOpenInsightModal={(catId, catName) => {
              const compItem = comparison.find((c) => c.categoryId === catId);
              setInsightModalData({
                isOpen: true,
                categoryId: catId,
                categoryName: catName,
                existingReason: compItem?.adminReason,
                existingActionPlan: compItem?.actionPlan,
              });
            }}
          />
        </div>
      )}

      {activeTab === 'comparison' && (
        <MonthlyComparisonTable
          comparison={comparison}
          selectedMonth={selectedMonth}
          previousMonth={summary?.previousMonth || ''}
          currency={currency}
          onOpenInsightModal={(catId, catName) => {
            const compItem = comparison.find((c) => c.categoryId === catId);
            setInsightModalData({
              isOpen: true,
              categoryId: catId,
              categoryName: catName,
              existingReason: compItem?.adminReason,
              existingActionPlan: compItem?.actionPlan,
            });
          }}
        />
      )}

      {activeTab === 'costReview' && <CostReviewPanel costReview={costReview} currency={currency} />}

      {activeTab === 'expenses' && (
        <ExpenseHistoryTable
          expenses={expenses}
          categories={categories}
          total={expensesTotal}
          page={expensePage}
          pageSize={50}
          onPageChange={(p) => setExpensePage(p)}
          onFilterChange={(f) => {
            setExpenseFilters(f);
            setExpensePage(1);
          }}
          onEdit={(exp) => {
            setEditingExpense(exp);
            setIsAddExpenseOpen(true);
          }}
          onVoid={handleVoidExpense}
          currency={currency}
          selectedMonth={selectedMonth}
        />
      )}

      {activeTab === 'categories' && (
        <ExpenseCategoryManager
          categories={categories}
          onAddCategory={handleAddCategory}
          onUpdateCategory={handleUpdateCategory}
        />
      )}

      {/* Modals */}
      <ExpenseEntryModal
        isOpen={isAddExpenseOpen}
        onClose={() => {
          setIsAddExpenseOpen(false);
          setEditingExpense(null);
        }}
        onSubmit={handleSaveExpense}
        categories={categories}
        expenseToEdit={editingExpense}
        currency={currency}
      />

      <ExpenseBudgetModal
        isOpen={isBudgetModalOpen}
        onClose={() => setIsBudgetModalOpen(false)}
        categories={categories}
        existingBudgets={budgets}
        year={selYear}
        month={selMonth}
        onSaveBudgets={handleSaveBudgets}
        currency={currency}
      />

      <MonthlyInsightModal
        isOpen={insightModalData.isOpen}
        onClose={() => setInsightModalData((prev) => ({ ...prev, isOpen: false }))}
        categoryId={insightModalData.categoryId}
        categoryName={insightModalData.categoryName}
        year={selYear}
        month={selMonth}
        existingReason={insightModalData.existingReason}
        existingActionPlan={insightModalData.existingActionPlan}
        onSave={handleSaveInsight}
      />
    </div>
  );
}
