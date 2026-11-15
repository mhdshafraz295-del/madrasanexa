import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Printer,
  Download,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Info,
  Tags,
  QrCode,
  Barcode,
  Layers,
  Sliders,
  Eye,
  ZoomIn,
  ZoomOut,
  Search,
  Trash2,
} from 'lucide-react';
import type { CardPrintData } from '../../services/student-token.service';
import { apiRenderBatchCardPdf } from '../../services/student-token.service';
import { A4LabelSheet } from './A4LabelSheet';
import { buildSelfContainedLabelSheetPdfHtml } from './pdf-print-stylesheet';
import type {
  LabelStyle,
  CredentialMode,
  CuttingGuideStyle,
} from './StudentCredentialLabel';

export interface LabelPrintStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  cards: CardPrintData[];
  madrasaName: string;
  madrasaCode?: string | null;
  academicYear?: string;
}

// Preset physical configurations optimized for standard A4
const STYLE_PRESETS: Record<
  LabelStyle,
  {
    columns: number;
    rows: number;
    labelWidth: number;
    labelHeight: number;
    gapX: number;
    gapY: number;
    marginX: number;
    marginY: number;
  }
> = {
  minimal: {
    columns: 3,
    rows: 6,
    labelWidth: 58,
    labelHeight: 40,
    gapX: 5,
    gapY: 5,
    marginX: 13,
    marginY: 16,
  },
  professional: {
    columns: 3,
    rows: 5,
    labelWidth: 60,
    labelHeight: 48,
    gapX: 4,
    gapY: 5,
    marginX: 11,
    marginY: 16,
  },
  compact: {
    columns: 4,
    rows: 8,
    labelWidth: 45,
    labelHeight: 30,
    gapX: 4,
    gapY: 3.5,
    marginX: 9,
    marginY: 14.5,
  },
};

/**
 * LabelPrintStudioModal - Professional Studio for designing, previewing,
 * and printing individual student QR & Barcode credential labels on A4 paper.
 */
export const LabelPrintStudioModal: React.FC<LabelPrintStudioModalProps> = ({
  isOpen,
  onClose,
  cards: initialCards,
  madrasaName,
  academicYear = '2025/2026',
}) => {
  // Student List State (allows removing individual students in studio)
  const [activeCards, setActiveCards] = useState<CardPrintData[]>(initialCards);
  const [studentSearch, setStudentSearch] = useState('');

  // Active Tab for Mobile / Split View
  const [activeTab, setActiveTab] = useState<'preview' | 'design' | 'students'>('preview');

  // Credential & Design Style States
  const [credentialMode, setCredentialMode] = useState<CredentialMode>('qr_only');
  const [labelStyle, setLabelStyle] = useState<LabelStyle>('professional');
  const [cuttingGuide, setCuttingGuide] = useState<CuttingGuideStyle>('dotted');
  const [showCuttingGuides, setShowCuttingGuides] = useState(true);
  const [showAdmissionNo, setShowAdmissionNo] = useState(true);
  const [showInstitution, setShowInstitution] = useState(true);

  // Layout Parameters (Initialized from preset)
  const [columns, setColumns] = useState(STYLE_PRESETS.professional.columns);
  const [rows, setRows] = useState(STYLE_PRESETS.professional.rows);
  const [labelWidth, setLabelWidth] = useState(STYLE_PRESETS.professional.labelWidth);
  const [labelHeight, setLabelHeight] = useState(STYLE_PRESETS.professional.labelHeight);
  const [gapX, setGapX] = useState(STYLE_PRESETS.professional.gapX);
  const [gapY, setGapY] = useState(STYLE_PRESETS.professional.gapY);
  const [marginX, setMarginX] = useState(STYLE_PRESETS.professional.marginX);
  const [marginY, setMarginY] = useState(STYLE_PRESETS.professional.marginY);

  // Preview & Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [zoomScale, setZoomScale] = useState(() => (typeof window !== 'undefined' && window.innerWidth < 640 ? 0.35 : 0.55));

  // PDF Export States
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const printAreaRef = useRef<HTMLDivElement | null>(null);

  // Update initial cards when prop changes
  useEffect(() => {
    setActiveCards(initialCards);
  }, [initialCards]);

  // Handle preset change when label style changes
  const handleStyleChange = (newStyle: LabelStyle) => {
    setLabelStyle(newStyle);
    const preset = STYLE_PRESETS[newStyle];
    setColumns(preset.columns);
    setRows(preset.rows);
    setLabelWidth(preset.labelWidth);
    setLabelHeight(preset.labelHeight);
    setGapX(preset.gapX);
    setGapY(preset.gapY);
    setMarginX(preset.marginX);
    setMarginY(preset.marginY);
  };

  // Filtered students for student list tab
  const filteredCards = useMemo(() => {
    if (!studentSearch.trim()) return activeCards;
    const q = studentSearch.toLowerCase().trim();
    return activeCards.filter(
      (c) =>
        c.student.fullName.toLowerCase().includes(q) ||
        c.student.admissionNo.toLowerCase().includes(q)
    );
  }, [activeCards, studentSearch]);

  // Remove individual student
  const handleRemoveStudent = (studentId: string) => {
    setActiveCards((prev) => prev.filter((c) => c.student.id !== studentId));
  };

  // Calculate labels per page and page chunks
  const labelsPerPage = Math.max(1, columns * rows);
  const chunks = useMemo(() => {
    const list: CardPrintData[][] = [];
    for (let i = 0; i < activeCards.length; i += labelsPerPage) {
      list.push(activeCards.slice(i, i + labelsPerPage));
    }
    return list;
  }, [activeCards, labelsPerPage]);

  const totalPages = Math.max(1, chunks.length);

  // Keep currentPage within valid bounds
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // Browser Print Trigger
  const handleBrowserPrint = () => {
    window.print();
  };

  // Server Puppeteer PDF Export
  const handleDownloadServerPdf = async () => {
    if (!printAreaRef.current) return;

    try {
      setIsExportingPdf(true);
      setExportError(null);

      const bodyHtml = printAreaRef.current.innerHTML;
      const printHtml = buildSelfContainedLabelSheetPdfHtml({
        bodyHtml,
        title: `${madrasaName} - Student Credential Labels A4`,
      });

      const blob = await apiRenderBatchCardPdf({
        html: printHtml,
        title: `student-credential-labels-${academicYear.replace('/', '-')}`,
      });

      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `student-credential-labels-a4-${academicYear.replace('/', '-')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err: any) {
      console.error('Server PDF generation failed', err);
      setExportError(err.response?.data?.message || 'Failed to generate PDF on server. Please use Browser Print.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Print Stylesheet Injection */}
      <style>{`
        @media print {
          @page {
            size: 210mm 297mm portrait;
            margin: 0mm;
          }

          html, body {
            width: 210mm !important;
            height: 297mm !important;
            margin: 0mm !important;
            padding: 0mm !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            overflow: visible !important;
          }

          body * {
            visibility: hidden;
          }

          #a4-label-print-area,
          #a4-label-print-area * {
            visibility: visible;
          }

          #a4-label-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            display: block !important;
          }

          .a4-print-page {
            width: 210mm !important;
            height: 297mm !important;
            page-break-after: always !important;
            break-after: page !important;
            overflow: hidden !important;
            position: relative !important;
            margin: 0 !important;
            padding: 0 !important;
            box-sizing: border-box !important;
          }

          .a4-print-page:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
        }
      `}</style>

      {/* Screen Backdrop */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-stone-900/80 backdrop-blur-xs overflow-y-auto print:hidden">
        {/* Main Modal Shell */}
        <div
          className="relative w-full max-w-7xl bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden my-auto flex flex-col max-h-[96vh]"
          role="dialog"
          aria-modal="true"
        >
          {/* ==================================================== */}
          {/* Header Bar */}
          {/* ==================================================== */}
          <div className="flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 border-b border-stone-200 bg-gradient-to-r from-stone-50 to-white shrink-0 min-w-0">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="w-9 sm:w-11 h-9 sm:h-11 rounded-2xl bg-[#0F5A47] text-white flex items-center justify-center shadow-xs shrink-0">
                <Tags className="w-4 sm:w-5 h-4 sm:h-5 text-emerald-200" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <h3 className="font-bold text-xs sm:text-base text-[#0F172A] tracking-tight truncate">
                    Student QR &amp; Barcode Label Studio
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-emerald-100 text-[#0F5A47] shrink-0">
                    {activeCards.length} Labels
                  </span>
                </div>
                <p className="text-[10px] sm:text-xs text-stone-500 font-medium truncate mt-0.5 hidden sm:block">
                  Design, Preview and Print Individual Student Credential Labels · A4 Standard
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 sm:p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer shrink-0"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* ==================================================== */}
          {/* Mobile Navigation Tabs (visible on mobile only) */}
          {/* ==================================================== */}
          <div className="flex lg:hidden border-b border-stone-200 bg-stone-50 p-1 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`flex-1 py-2 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'preview'
                  ? 'bg-white text-[#0F5A47] shadow-xs'
                  : 'text-stone-500'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>A4 Preview</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('design')}
              className={`flex-1 py-2 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'design'
                  ? 'bg-white text-[#0F5A47] shadow-xs'
                  : 'text-stone-500'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Design & Layout</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('students')}
              className={`flex-1 py-2 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'students'
                  ? 'bg-white text-[#0F5A47] shadow-xs'
                  : 'text-stone-500'
              }`}
            >
              <Tags className="w-3.5 h-3.5" />
              <span>Students ({activeCards.length})</span>
            </button>
          </div>

          {/* ==================================================== */}
          {/* Main Two-Column Studio Workspace */}
          {/* ==================================================== */}
          <div className="flex-1 flex overflow-hidden">
            {/* -------------------------------------------------- */}
            {/* Left Control Panel: Credential, Design & Layout */}
            {/* -------------------------------------------------- */}
            <div
              className={`w-full lg:w-96 border-r border-stone-200 bg-white flex flex-col overflow-y-auto shrink-0 p-4 sm:p-5 space-y-5 ${
                activeTab === 'preview' ? 'hidden lg:flex' : 'flex'
              }`}
            >
              {/* If on 'students' tab on mobile: display student selection manager */}
              {activeTab === 'students' ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                      Selected Students ({activeCards.length})
                    </h4>
                    {activeCards.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setActiveCards([])}
                        className="text-[11px] text-rose-600 hover:text-rose-800 font-semibold cursor-pointer"
                      >
                        Clear All
                      </button>
                    )}
                  </div>

                  {/* Search filter */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Filter selected students..."
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>

                  {/* Student Items List */}
                  <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                    {filteredCards.length === 0 ? (
                      <div className="p-4 text-center text-xs text-stone-400 bg-stone-50 rounded-xl">
                        No students found.
                      </div>
                    ) : (
                      filteredCards.map((c) => (
                        <div
                          key={c.student.id}
                          className="flex items-center justify-between p-2 rounded-xl border border-stone-200/80 bg-stone-50/50 hover:bg-stone-50 text-xs"
                        >
                          <div className="min-w-0 pr-2">
                            <span className="font-semibold text-stone-900 block truncate">
                              {c.student.fullName}
                            </span>
                            <span className="font-mono text-[11px] text-stone-500">
                              {c.student.admissionNo}
                              {c.student.className ? ` · ${c.student.className}` : ''}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveStudent(c.student.id)}
                            className="p-1 text-stone-400 hover:text-rose-600 transition-colors cursor-pointer"
                            title="Remove from print"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <>
                  {/* Section 1: Credential Print Mode */}
                  <div>
                    <label className="text-xs font-bold text-stone-900 uppercase tracking-wider block mb-2">
                      1. Credential Mode
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setCredentialMode('qr_only')}
                        className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                          credentialMode === 'qr_only'
                            ? 'bg-emerald-50 border-[#0F5A47] text-[#0F5A47] font-bold shadow-xs'
                            : 'border-stone-200 hover:bg-stone-50 text-stone-600 text-xs'
                        }`}
                      >
                        <QrCode className="w-4 h-4" />
                        <span className="text-[11px] leading-tight">QR Only</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setCredentialMode('barcode_only')}
                        className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                          credentialMode === 'barcode_only'
                            ? 'bg-emerald-50 border-[#0F5A47] text-[#0F5A47] font-bold shadow-xs'
                            : 'border-stone-200 hover:bg-stone-50 text-stone-600 text-xs'
                        }`}
                      >
                        <Barcode className="w-4 h-4" />
                        <span className="text-[11px] leading-tight">Barcode Only</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setCredentialMode('qr_and_barcode')}
                        className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                          credentialMode === 'qr_and_barcode'
                            ? 'bg-emerald-50 border-[#0F5A47] text-[#0F5A47] font-bold shadow-xs'
                            : 'border-stone-200 hover:bg-stone-50 text-stone-600 text-xs'
                        }`}
                      >
                        <Layers className="w-4 h-4" />
                        <span className="text-[11px] leading-tight">QR + Barcode</span>
                      </button>
                    </div>
                  </div>

                  {/* Section 2: Label Design Style */}
                  <div>
                    <label className="text-xs font-bold text-stone-900 uppercase tracking-wider block mb-2">
                      2. Design Style
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['minimal', 'professional', 'compact'] as LabelStyle[]).map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => handleStyleChange(st)}
                          className={`p-2.5 rounded-xl border text-center capitalize transition-all cursor-pointer ${
                            labelStyle === st
                              ? 'bg-[#0F5A47] border-[#0F5A47] text-white font-bold shadow-xs'
                              : 'border-stone-200 hover:bg-stone-50 text-stone-700 text-xs'
                          }`}
                        >
                          <span className="text-xs block capitalize">{st}</span>
                          <span
                            className={`text-[10px] block opacity-80 ${
                              labelStyle === st ? 'text-emerald-100' : 'text-stone-400'
                            }`}
                          >
                            {STYLE_PRESETS[st].columns * STYLE_PRESETS[st].rows}/sheet
                          </span>
                        </button>
                      ))}
                    </div>

                    {/* Metadata Content Toggles */}
                    <div className="mt-3 space-y-2 text-xs text-stone-600">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={showAdmissionNo}
                          onChange={(e) => setShowAdmissionNo(e.target.checked)}
                          className="rounded text-[#0F5A47] focus:ring-[#0F5A47]"
                        />
                        <span>Show Student Admission Number</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={showInstitution}
                          onChange={(e) => setShowInstitution(e.target.checked)}
                          className="rounded text-[#0F5A47] focus:ring-[#0F5A47]"
                        />
                        <span>Show Institution Name ({madrasaName})</span>
                      </label>
                    </div>
                  </div>

                  {/* Section 3: Cutting Guides & Boundaries */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                        3. Cutting Boundaries
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-stone-600 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={showCuttingGuides}
                          onChange={(e) => setShowCuttingGuides(e.target.checked)}
                          className="rounded text-[#0F5A47] focus:ring-[#0F5A47]"
                        />
                        <span>Show Guides</span>
                      </label>
                    </div>

                    {showCuttingGuides && (
                      <div className="grid grid-cols-3 gap-2">
                        {(['dotted', 'solid', 'corners'] as CuttingGuideStyle[]).map((guide) => (
                          <button
                            key={guide}
                            type="button"
                            onClick={() => setCuttingGuide(guide)}
                            className={`px-2 py-1.5 rounded-lg border text-xs font-semibold capitalize transition-all cursor-pointer ${
                              cuttingGuide === guide
                                ? 'bg-white border-[#0F5A47] text-[#0F5A47] shadow-xs'
                                : 'border-stone-200 text-stone-500 hover:bg-stone-50'
                            }`}
                          >
                            {guide === 'dotted'
                              ? 'Dotted Line'
                              : guide === 'solid'
                              ? 'Solid Border'
                              : 'Corner Marks'}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Section 4: A4 Sheet Grid & Dimension Tuning */}
                  <div className="border-t border-stone-200 pt-4">
                    <label className="text-xs font-bold text-stone-900 uppercase tracking-wider block mb-2">
                      4. Sheet Layout Fine-Tuning
                    </label>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-stone-500 font-medium block mb-1">Columns:</span>
                        <input
                          type="number"
                          min="1"
                          max="6"
                          value={columns}
                          onChange={(e) => setColumns(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-full px-2 py-1 rounded-lg border border-stone-300 font-mono text-center"
                        />
                      </div>
                      <div>
                        <span className="text-stone-500 font-medium block mb-1">Rows:</span>
                        <input
                          type="number"
                          min="1"
                          max="12"
                          value={rows}
                          onChange={(e) => setRows(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-full px-2 py-1 rounded-lg border border-stone-300 font-mono text-center"
                        />
                      </div>

                      <div>
                        <span className="text-stone-500 font-medium block mb-1">Width (mm):</span>
                        <input
                          type="number"
                          step="1"
                          min="20"
                          max="100"
                          value={labelWidth}
                          onChange={(e) => setLabelWidth(parseFloat(e.target.value) || 20)}
                          className="w-full px-2 py-1 rounded-lg border border-stone-300 font-mono text-center"
                        />
                      </div>
                      <div>
                        <span className="text-stone-500 font-medium block mb-1">Height (mm):</span>
                        <input
                          type="number"
                          step="1"
                          min="20"
                          max="120"
                          value={labelHeight}
                          onChange={(e) => setLabelHeight(parseFloat(e.target.value) || 20)}
                          className="w-full px-2 py-1 rounded-lg border border-stone-300 font-mono text-center"
                        />
                      </div>
                    </div>

                    <div className="mt-3 p-2.5 bg-stone-50 rounded-xl border border-stone-200/80 text-[11px] text-stone-600 flex items-center justify-between">
                      <span>Labels per Sheet:</span>
                      <strong className="text-stone-900 font-mono text-xs">
                        {columns * rows} labels
                      </strong>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* -------------------------------------------------- */}
            {/* Right Screen: Interactive Live A4 Sheet Preview */}
            {/* -------------------------------------------------- */}
            <div
              className={`flex-1 bg-stone-100 flex flex-col items-center justify-start overflow-auto p-4 sm:p-6 min-h-[480px] ${
                activeTab !== 'preview' ? 'hidden lg:flex' : 'flex'
              }`}
            >
              {/* Preview Control Toolbar */}
              <div className="mb-3 w-full max-w-2xl flex flex-wrap items-center justify-between gap-2 bg-white px-4 py-2 rounded-2xl shadow-xs border border-stone-200 text-xs shrink-0">
                {/* Pagination Controls */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    className="p-1 rounded-lg hover:bg-stone-100 disabled:opacity-30 cursor-pointer"
                    aria-label="Previous Page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="font-semibold text-stone-700 font-mono">
                    Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    className="p-1 rounded-lg hover:bg-stone-100 disabled:opacity-30 cursor-pointer"
                    aria-label="Next Page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Summary Metadata */}
                <div className="hidden sm:flex items-center gap-3 text-[11px] text-stone-500 font-medium">
                  <span>
                    <strong>{activeCards.length}</strong> total
                  </span>
                  <span>•</span>
                  <span>
                    <strong>{labelsPerPage}</strong>/page
                  </span>
                  <span>•</span>
                  <span className="font-mono">{columns}×{rows} grid</span>
                </div>

                {/* Zoom Controls */}
                <div className="flex items-center gap-1.5 border-l border-stone-200 pl-2">
                  <button
                    type="button"
                    onClick={() => setZoomScale((z) => Math.max(0.4, parseFloat((z - 0.05).toFixed(2))))}
                    className="p-1 rounded hover:bg-stone-100 text-stone-600 cursor-pointer"
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[11px] font-mono text-stone-600 w-10 text-center">
                    {Math.round(zoomScale * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setZoomScale((z) => Math.min(1.0, parseFloat((z + 0.05).toFixed(2))))}
                    className="p-1 rounded hover:bg-stone-100 text-stone-600 cursor-pointer"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Scaled A4 Sheet Container */}
              <div className="w-full overflow-x-auto flex flex-col items-center">
                {activeCards.length === 0 ? (
                  <div className="my-auto p-12 bg-white rounded-3xl border border-stone-200 text-center space-y-3">
                    <Tags className="w-12 h-12 text-stone-300 mx-auto" />
                    <h4 className="font-bold text-sm text-stone-800">No Students Selected</h4>
                    <p className="text-xs text-stone-500 max-w-xs">
                      Please select students from the ID card directory to generate printable labels.
                    </p>
                  </div>
                ) : (
                  <div
                    className="bg-white shadow-2xl border border-stone-300 rounded-sm overflow-hidden"
                    style={{
                      transform: `scale(${zoomScale})`,
                      transformOrigin: 'top center',
                      marginBottom: `${-(297 * (1 - zoomScale))}mm`, // Counteract scale layout gap
                    }}
                  >
                    <A4LabelSheet
                      cards={chunks[currentPage - 1] || []}
                      columns={columns}
                      rows={rows}
                      labelWidth={labelWidth}
                      labelHeight={labelHeight}
                      gapX={gapX}
                      gapY={gapY}
                      marginX={marginX}
                      marginY={marginY}
                      style={labelStyle}
                      credentialMode={credentialMode}
                      cuttingGuide={cuttingGuide}
                      showCuttingGuides={showCuttingGuides}
                      madrasaName={madrasaName}
                      showAdmissionNo={showAdmissionNo}
                      showInstitution={showInstitution}
                      pageNumber={currentPage}
                      totalPages={totalPages}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ==================================================== */}
          {/* Error Notification Banner */}
          {/* ==================================================== */}
          {exportError && (
            <div className="mx-4 sm:mx-6 mt-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{exportError}</span>
              </div>
              <button
                type="button"
                onClick={() => setExportError(null)}
                className="text-rose-600 hover:text-rose-800 font-bold cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* ==================================================== */}
          {/* Footer Bar with Print & Export Actions */}
          {/* ==================================================== */}
          <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-t border-stone-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 shrink-0">
            <div className="flex items-center gap-2 text-[11px] sm:text-xs text-stone-500 w-full sm:w-auto">
              <Info className="w-4 h-4 text-[#0F5A47] shrink-0" />
              <span>
                Standard A4 · Set printer to <strong>100% Scale / Actual Size</strong> (disable &quot;Fit to Printable Area&quot;).
              </span>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto flex-wrap sm:flex-nowrap">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 sm:flex-initial px-4 py-2 border border-stone-200 text-stone-600 rounded-xl text-xs font-semibold hover:bg-stone-50 transition-colors cursor-pointer"
              >
                Close
              </button>

              <button
                type="button"
                onClick={handleDownloadServerPdf}
                disabled={isExportingPdf || activeCards.length === 0}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-semibold transition-all cursor-pointer border border-stone-300 disabled:opacity-50"
              >
                {isExportingPdf ? (
                  <Loader2 className="w-4 h-4 animate-spin text-[#0F5A47]" />
                ) : (
                  <Download className="w-4 h-4 text-stone-600" />
                )}
                <span className="whitespace-nowrap">PDF Export</span>
              </button>

              <button
                type="button"
                onClick={handleBrowserPrint}
                disabled={activeCards.length === 0}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2 bg-[#0F5A47] hover:bg-[#0c4738] text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer active:scale-95 disabled:opacity-50"
              >
                <Printer className="w-4 h-4" />
                <span className="whitespace-nowrap">Print Labels ({activeCards.length})</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ==================================================== */}
      {/* Hidden Dedicated Print Area (Only visible to printer via @media print) */}
      {/* ==================================================== */}
      <div id="a4-label-print-area" ref={printAreaRef} className="hidden print:block">
        {chunks.map((chunk, index) => (
          <div key={`print-label-page-${index}`} className="a4-print-page">
            <A4LabelSheet
              cards={chunk}
              columns={columns}
              rows={rows}
              labelWidth={labelWidth}
              labelHeight={labelHeight}
              gapX={gapX}
              gapY={gapY}
              marginX={marginX}
              marginY={marginY}
              style={labelStyle}
              credentialMode={credentialMode}
              cuttingGuide={showCuttingGuides ? cuttingGuide : 'none'}
              showCuttingGuides={showCuttingGuides}
              madrasaName={madrasaName}
              showAdmissionNo={showAdmissionNo}
              showInstitution={showInstitution}
              pageNumber={index + 1}
              totalPages={totalPages}
            />
          </div>
        ))}
      </div>
    </>
  );
};

export default LabelPrintStudioModal;
