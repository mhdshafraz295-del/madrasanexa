import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  CreditCard,
  PlusCircle,
  Eye,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Users,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Printer,
  Tags,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  apiListCardTokens,
  apiIssueCardToken,
  apiBatchGenerateTokens,
  apiGetCardPrintData,
  apiGetBatchCardPrintData,
  type CardTokenListItem,
  type CardPrintData,
} from '../../services/student-token.service';
import { IdCardPreviewModal } from './IdCardPreviewModal';
import { BatchPrintStudioModal } from './BatchPrintStudioModal';
import { LabelPrintStudioModal } from './LabelPrintStudioModal';

export interface IdCardStudioTabProps {
  classes: Array<{ id: string; name: string; code?: string | null }>;
  selectedClassId?: string;
  academicYear?: string;
}

export const IdCardStudioTab: React.FC<IdCardStudioTabProps> = ({
  classes,
  selectedClassId: initialClassId = '',
  academicYear = '2025/2026',
}) => {
  const { user } = useAuth();
  const madrasaName = user?.madrasa?.name || 'Madrasa Portal';
  const madrasaCode = user?.madrasa?.code || '';
  const customLogoUrl = user?.madrasa?.logoUrl || null;

  // Filter States
  const [classFilter, setClassFilter] = useState<string>(initialClassId);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE_TOKEN' | 'MISSING_TOKEN' | 'REVOKED'>('ALL');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Data States
  const [items, setItems] = useState<CardTokenListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Action Loading States
  const [issuingStudentId, setIssuingStudentId] = useState<string | null>(null);
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [loadingPrintStudentId, setLoadingPrintStudentId] = useState<string | null>(null);

  // Active Preview Modal State (Ephemeral memory strictly - zero persistent storage)
  const [previewCardData, setPreviewCardData] = useState<CardPrintData | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Multi-Student Batch Selection & A4 Studio States (Ephemeral memory)
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [batchPrintCards, setBatchPrintCards] = useState<CardPrintData[]>([]);
  const [isBatchPrintModalOpen, setIsBatchPrintModalOpen] = useState(false);
  const [isLoadingBatchPrint, setIsLoadingBatchPrint] = useState(false);

  // Student QR & Barcode Label Studio States (Ephemeral memory)
  const [labelCards, setLabelCards] = useState<CardPrintData[]>([]);
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
  const [isLoadingLabelPrint, setIsLoadingLabelPrint] = useState(false);

  // Sync initial class selection
  useEffect(() => {
    if (initialClassId && !classFilter) {
      setClassFilter(initialClassId);
    }
  }, [initialClassId, classFilter]);

  // Load student card tokens from Step 1.1 API
  const loadTokens = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const res = await apiListCardTokens({
        classId: classFilter || undefined,
        search: searchTerm.trim() || undefined,
        status: statusFilter,
        page,
        pageSize,
      });

      setItems(res.items || []);
      setTotalCount(res.total || 0);
      setTotalPages(res.totalPages || 1);
    } catch (err: any) {
      console.error('Failed to load student card tokens', err);
      setErrorMessage(err.response?.data?.message || 'Failed to load student ID card directory.');
    } finally {
      setIsLoading(false);
    }
  }, [classFilter, searchTerm, statusFilter, page, pageSize]);

  useEffect(() => {
    loadTokens();
  }, [loadTokens]);

  // Issue single card token
  const handleIssueToken = async (studentId: string, studentName: string) => {
    try {
      setIssuingStudentId(studentId);
      setErrorMessage(null);
      setSuccessMessage(null);

      const res = await apiIssueCardToken(studentId);
      setSuccessMessage(`Card issued successfully for ${studentName} (Hint: ${res.tokenHint}, Ver: ${res.version}).`);
      await loadTokens();
    } catch (err: any) {
      console.error('Failed to issue student card token', err);
      setErrorMessage(err.response?.data?.message || 'Failed to issue card token.');
    } finally {
      setIssuingStudentId(null);
    }
  };

  // Batch generate missing tokens
  const handleBatchGenerate = async () => {
    const confirmMsg = classFilter
      ? `Generate cards for all students in the selected class who are missing active cards?`
      : `Generate cards for all students across the entire institution who are missing active cards?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      setIsBatchGenerating(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const res = await apiBatchGenerateTokens({
        classId: classFilter || undefined,
      });

      setSuccessMessage(
        `Batch generation complete: ${res.generatedCount} new cards issued, ${res.skippedCount} students skipped.`
      );
      await loadTokens();
    } catch (err: any) {
      console.error('Batch generation failed', err);
      setErrorMessage(err.response?.data?.message || 'Batch token generation failed.');
    } finally {
      setIsBatchGenerating(false);
    }
  };

  // Open Preview Modal (Fetches decrypted print data via POST endpoint)
  const handleOpenPreview = async (item: CardTokenListItem) => {
    try {
      setLoadingPrintStudentId(item.studentId);
      setErrorMessage(null);

      const cardData = await apiGetCardPrintData(item.studentId);
      setPreviewCardData(cardData);
      setIsPreviewOpen(true);
    } catch (err: any) {
      console.error('Failed to load card preview data', err);
      setErrorMessage(err.response?.data?.message || 'Failed to load card preview details.');
    } finally {
      setLoadingPrintStudentId(null);
    }
  };

  // Selection toggle handlers
  const handleToggleSelectStudent = (studentId: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    );
  };

  const handleToggleSelectAllOnPage = () => {
    const pageIds = items.map((i) => i.studentId);
    const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedStudentIds.includes(id));
    if (allSelected) {
      setSelectedStudentIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedStudentIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const handleClearSelection = () => {
    setSelectedStudentIds([]);
  };

  const handleOpenBatchPrint = async (targetStudentIds?: string[]) => {
    const idsToFetch = targetStudentIds || selectedStudentIds;
    if (idsToFetch.length === 0) {
      setErrorMessage('Please select at least one student for batch printing.');
      return;
    }

    try {
      setIsLoadingBatchPrint(true);
      setErrorMessage(null);

      const res = await apiGetBatchCardPrintData({
        studentIds: idsToFetch,
      });

      if (!res.cards || res.cards.length === 0) {
        setErrorMessage('None of the selected students have active card credentials issued yet. Generate cards first.');
        return;
      }

      setBatchPrintCards(res.cards);
      setIsBatchPrintModalOpen(true);
    } catch (err: any) {
      console.error('Failed to load batch card print data', err);
      setErrorMessage(err.response?.data?.message || 'Failed to load batch card print data.');
    } finally {
      setIsLoadingBatchPrint(false);
    }
  };

  // Launch Student QR & Barcode Label Studio
  const handleOpenLabelStudio = async (studentId?: string) => {
    const idsToFetch = studentId ? [studentId] : selectedStudentIds;
    if (idsToFetch.length === 0) {
      setErrorMessage('Please select at least one student for label printing.');
      return;
    }

    try {
      setIsLoadingLabelPrint(true);
      setErrorMessage(null);

      const res = await apiGetBatchCardPrintData({
        studentIds: idsToFetch,
      });

      if (!res.cards || res.cards.length === 0) {
        setErrorMessage('None of the selected students have active card credentials issued yet. Generate cards first.');
        return;
      }

      setLabelCards(res.cards);
      setIsLabelModalOpen(true);
    } catch (err: any) {
      console.error('Failed to load credential label print data', err);
      setErrorMessage(err.response?.data?.message || 'Failed to load credential label print data.');
    } finally {
      setIsLoadingLabelPrint(false);
    }
  };

  // Metrics computation from current list
  const activeCount = items.filter((i) => i.hasActiveToken).length;
  const missingCount = items.filter((i) => !i.hasActiveToken).length;

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-rose-500 hover:text-rose-700 text-xs font-semibold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-600 hover:text-emerald-800 text-xs font-semibold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top Banner / Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Students */}
        <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-stone-400 uppercase tracking-wider block">
              Total Students
            </span>
            <span className="text-2xl font-extrabold text-stone-900 mt-1 block">
              {totalCount}
            </span>
            <span className="text-[11px] text-stone-500 mt-0.5 block">
              Filtered directory records
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-stone-100 text-stone-700 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Cards Issued (Active) */}
        <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider block">
              Cards Active
            </span>
            <span className="text-2xl font-extrabold text-emerald-800 mt-1 block">
              {activeCount}
            </span>
            <span className="text-[11px] text-emerald-600 mt-0.5 block">
              Ready for QR attendance
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>

        {/* Missing Cards (Needs Issue) */}
        <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-amber-700 uppercase tracking-wider block">
              Missing Cards
            </span>
            <span className="text-2xl font-extrabold text-amber-800 mt-1 block">
              {missingCount}
            </span>
            <span className="text-[11px] text-amber-600 mt-0.5 block">
              Pending issuance
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
        </div>

        {/* Institution Info */}
        <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-xs flex items-center justify-between">
          <div className="min-w-0 pr-2">
            <span className="text-xs font-bold text-stone-400 uppercase tracking-wider block">
              Institutional Standard
            </span>
            <span className="text-sm font-bold text-stone-900 mt-1 truncate block">
              ISO/IEC 7810 CR80
            </span>
            <span className="text-[11px] text-[#0F5A47] font-mono mt-0.5 block truncate">
              85.60 × 53.98 mm
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#0F5A47]/10 text-[#0F5A47] flex items-center justify-center shrink-0">
            <CreditCard className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Action Toolbar & Filters */}
      <div className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-xs flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4">
        {/* Left: Search & Filter Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
          {/* Search Input */}
          <div className="relative flex-1 min-w-0 sm:min-w-[200px]">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search name or admission number..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
            />
          </div>

          {/* Class Selector Dropdown */}
          <div className="w-full sm:w-48">
            <select
              value={classFilter}
              onChange={(e) => {
                setClassFilter(e.target.value);
                setPage(1);
              }}
              className="w-full py-2 px-3 text-xs rounded-xl border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
            >
              <option value="">All Classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="w-full sm:w-40">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as any);
                setPage(1);
              }}
              className="w-full py-2 px-3 text-xs rounded-xl border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
            >
              <option value="ALL">All Card Statuses</option>
              <option value="ACTIVE_TOKEN">Active Cards</option>
              <option value="MISSING_TOKEN">Missing Cards</option>
              <option value="REVOKED">Revoked</option>
            </select>
          </div>
        </div>

        {/* Right: Primary Batch Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto justify-start sm:justify-end">
          <button
            type="button"
            onClick={loadTokens}
            disabled={isLoading}
            className="p-2 border border-stone-200 rounded-xl text-stone-600 hover:bg-stone-50 transition-colors cursor-pointer shrink-0"
            title="Refresh directory"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-600' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => handleOpenBatchPrint()}
            disabled={isLoadingBatchPrint || selectedStudentIds.length === 0}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-semibold border border-stone-200 shadow-xs transition-all cursor-pointer active:scale-95 disabled:opacity-40 whitespace-nowrap"
            title={selectedStudentIds.length === 0 ? 'Select students to batch print' : 'Print A4 sheets for selected students'}
          >
            {isLoadingBatchPrint ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0F5A47]" />
            ) : (
              <Printer className="w-3.5 h-3.5 text-stone-600" />
            )}
            <span>A4 Batch Print{selectedStudentIds.length > 0 ? ` (${selectedStudentIds.length})` : ''}</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenLabelStudio()}
            disabled={isLoadingLabelPrint || selectedStudentIds.length === 0}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-semibold border border-stone-200 shadow-xs transition-all cursor-pointer active:scale-95 disabled:opacity-40 whitespace-nowrap"
            title={selectedStudentIds.length === 0 ? 'Select students to print labels' : 'Print individual QR & Barcode labels'}
          >
            {isLoadingLabelPrint ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0F5A47]" />
            ) : (
              <Tags className="w-3.5 h-3.5 text-[#0F5A47]" />
            )}
            <span>Print Labels{selectedStudentIds.length > 0 ? ` (${selectedStudentIds.length})` : ''}</span>
          </button>

          <button
            type="button"
            onClick={handleBatchGenerate}
            disabled={isBatchGenerating}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 bg-[#0F5A47] hover:bg-[#0c4738] text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer active:scale-95 disabled:opacity-50 whitespace-nowrap"
          >
            {isBatchGenerating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>Generate Missing Cards</span>
          </button>
        </div>
      </div>

      {/* Batch Selection Action Bar */}
      {selectedStudentIds.length > 0 && (
        <div className="bg-emerald-50/90 border border-emerald-200 rounded-2xl px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-emerald-950 shadow-xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-[#0F5A47]" />
            <span className="font-semibold">
              <strong>{selectedStudentIds.length}</strong> student{selectedStudentIds.length === 1 ? '' : 's'} selected
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleClearSelection}
              className="px-3 py-1.5 rounded-lg border border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50 text-xs font-medium cursor-pointer"
            >
              Clear Selection
            </button>

            <button
              type="button"
              onClick={() => handleOpenLabelStudio()}
              disabled={isLoadingLabelPrint}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-emerald-300 bg-white text-[#0F5A47] hover:bg-emerald-50 font-semibold text-xs shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {isLoadingLabelPrint ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Tags className="w-3.5 h-3.5 text-[#0F5A47]" />
              )}
              <span>Print Labels ({selectedStudentIds.length})</span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenBatchPrint()}
              disabled={isLoadingBatchPrint}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#0F5A47] hover:bg-[#0c4738] text-white font-semibold text-xs shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {isLoadingBatchPrint ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Printer className="w-3.5 h-3.5" />
              )}
              <span>Open A4 Batch Print Studio ({selectedStudentIds.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* Directory Table */}
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left border-collapse">
            <thead>
              <tr className="border-b border-stone-200/80 bg-stone-50/70 text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                <th className="py-3 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={items.length > 0 && items.every((i) => selectedStudentIds.includes(i.studentId))}
                    onChange={handleToggleSelectAllOnPage}
                    className="rounded text-[#0F5A47] focus:ring-[#0F5A47] cursor-pointer"
                    title="Select / deselect all on page"
                  />
                </th>
                <th className="py-3 px-3 w-12 text-center">#</th>
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-4">Class</th>
                <th className="py-3 px-4">Card Status</th>
                <th className="py-3 px-4">Credential Hint</th>
                <th className="py-3 px-4 text-center">Scan Count</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-stone-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-[#0F5A47]" />
                      <span>Loading student card directory...</span>
                    </div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-stone-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <CreditCard className="w-8 h-8 text-stone-300 stroke-[1.5]" />
                      <span className="font-semibold text-stone-600">No student card records found.</span>
                      <p className="text-[11px] text-stone-400 max-w-sm">
                        Adjust search filters or click &quot;Generate Missing Cards&quot; to issue initial card credentials.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((item, idx) => {
                  const globalIdx = (page - 1) * pageSize + idx + 1;
                  const isIssuing = issuingStudentId === item.studentId;
                  const isLoadingPreview = loadingPrintStudentId === item.studentId;
                  const isSelected = selectedStudentIds.includes(item.studentId);

                  return (
                    <tr
                      key={item.studentId}
                      className={`transition-colors ${isSelected ? 'bg-emerald-50/40 hover:bg-emerald-50/60' : 'hover:bg-stone-50/70'}`}
                    >
                      {/* Selection Checkbox */}
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectStudent(item.studentId)}
                          className="rounded text-[#0F5A47] focus:ring-[#0F5A47] cursor-pointer"
                        />
                      </td>

                      {/* Index */}
                      <td className="py-3 px-3 text-center font-mono text-stone-400">
                        {globalIdx}
                      </td>

                      {/* Student Identity */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-stone-100 text-stone-700 font-bold text-xs flex items-center justify-center shrink-0 border border-stone-200/60">
                            {item.fullName.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <span className="font-semibold text-stone-900 block leading-tight truncate max-w-[180px] sm:max-w-xs">
                              {item.fullName}
                            </span>
                            <span className="text-[10px] text-stone-400 font-mono block">
                              Adm: {item.admissionNo}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Class */}
                      <td className="py-3 px-4 text-stone-600 font-medium whitespace-nowrap">
                        {item.className || 'General'}
                      </td>

                      {/* Card Status Badge */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {item.hasActiveToken ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                            <span>Active (v{item.version || 1})</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                            <span>Missing Card</span>
                          </span>
                        )}
                      </td>

                      {/* Credential Hint */}
                      <td className="py-3 px-4 font-mono text-[11px] text-stone-600 whitespace-nowrap">
                        {item.tokenHint ? (
                          <span className="bg-stone-100 px-2 py-0.5 rounded border border-stone-200/80 font-mono text-[10px] tracking-tight">
                            {item.tokenHint}
                          </span>
                        ) : (
                          <span className="text-stone-300">—</span>
                        )}
                      </td>

                      {/* Scan Count */}
                      <td className="py-3 px-4 text-center font-mono font-medium text-stone-700 whitespace-nowrap">
                        {item.scanCount}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {item.hasActiveToken ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenLabelStudio(item.studentId)}
                                disabled={isLoadingLabelPrint}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-stone-200 bg-white text-stone-700 hover:text-emerald-800 hover:border-emerald-300 hover:bg-emerald-50/40 text-xs font-semibold shadow-xs transition-all cursor-pointer"
                                title="Print student QR & barcode label"
                              >
                                <Tags className="w-3.5 h-3.5 text-[#0F5A47]" />
                                <span className="hidden sm:inline">Label</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenPreview(item)}
                                disabled={isLoadingPreview}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-200 bg-white text-stone-700 hover:text-emerald-800 hover:border-emerald-300 hover:bg-emerald-50/40 text-xs font-semibold shadow-xs transition-all cursor-pointer"
                                title="View and print individual card"
                              >
                                {isLoadingPreview ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Eye className="w-3.5 h-3.5 text-[#0F5A47]" />
                                )}
                                <span>View / Print</span>
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleIssueToken(item.studentId, item.fullName)}
                              disabled={isIssuing}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0F5A47] hover:bg-[#0c4738] text-white text-xs font-semibold shadow-xs transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                            >
                              {isIssuing ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <PlusCircle className="w-3.5 h-3.5" />
                              )}
                              <span>Issue Card</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-stone-200/80 bg-stone-50/50 text-xs text-stone-500">
            <span>
              Showing page <strong>{page}</strong> of <strong>{totalPages}</strong> ({totalCount} students)
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg border border-stone-200 bg-white disabled:opacity-40 hover:bg-stone-50 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg border border-stone-200 bg-white disabled:opacity-40 hover:bg-stone-50 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Individual Card Preview & Print Modal */}
      {previewCardData && (
        <IdCardPreviewModal
          isOpen={isPreviewOpen}
          onClose={() => {
            setIsPreviewOpen(false);
            setPreviewCardData(null);
          }}
          student={previewCardData.student}
          madrasaName={madrasaName}
          madrasaCode={madrasaCode}
          logoUrl={customLogoUrl}
          academicYear={academicYear}
          cardVersion={previewCardData.card.version}
          tokenHint={previewCardData.card.tokenHint}
          rawToken={previewCardData.card.rawToken}
          issuedAt={previewCardData.card.issuedAt}
        />
      )}

      {/* A4 Batch ID Card Print Studio Modal */}
      {isBatchPrintModalOpen && (
        <BatchPrintStudioModal
          isOpen={isBatchPrintModalOpen}
          onClose={() => {
            setIsBatchPrintModalOpen(false);
            setBatchPrintCards([]); // Ephemeral cleanup of raw tokens!
          }}
          cards={batchPrintCards}
          madrasaName={madrasaName}
          madrasaCode={madrasaCode}
          logoUrl={customLogoUrl}
          academicYear={academicYear}
          madrasaPhone={null}
          madrasaEmail={null}
        />
      )}

      {/* Student QR & Barcode Label Studio Modal */}
      {isLabelModalOpen && (
        <LabelPrintStudioModal
          isOpen={isLabelModalOpen}
          onClose={() => {
            setIsLabelModalOpen(false);
            setLabelCards([]); // Ephemeral cleanup of raw tokens!
          }}
          cards={labelCards}
          madrasaName={madrasaName}
          madrasaCode={madrasaCode}
          academicYear={academicYear}
        />
      )}
    </div>
  );
};

export default IdCardStudioTab;
