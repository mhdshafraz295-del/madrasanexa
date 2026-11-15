import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Printer,
  Download,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Info,
} from 'lucide-react';
import type { CardPrintData } from '../../services/student-token.service';
import { apiRenderBatchCardPdf } from '../../services/student-token.service';
import { A4CardSheet } from './A4CardSheet';
import { A4CalibrationSheet } from './A4CalibrationSheet';
import {
  buildSelfContainedCardSheetPdfHtml,
  convertImageUrlToDataUri,
} from './pdf-print-stylesheet';

export interface BatchPrintStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  cards: CardPrintData[];
  madrasaName: string;
  madrasaCode?: string | null;
  logoUrl?: string | null;
  academicYear?: string;
  madrasaPhone?: string | null;
  madrasaEmail?: string | null;
}

const CARDS_PER_SHEET = 8;

/**
 * BatchPrintStudioModal - A4 Batch ID Card Print Studio & Multi-Sheet Generator.
 *
 * Capabilities:
 * - 2x4 CR80 Grid on A4 Portrait (210mm x 297mm).
 * - Multi-page sheet splitting (8 cards per sheet).
 * - Separate Front and Back sheets with long-edge duplex column mirroring.
 * - Dedicated physical calibration test sheet with 50mm ruler.
 * - Hardware alignment offset fine-tuning (±5mm X/Y).
 * - 100% scale browser print engine and Puppeteer server-side PDF generator.
 */
export const BatchPrintStudioModal: React.FC<BatchPrintStudioModalProps> = ({
  isOpen,
  onClose,
  cards,
  madrasaName,
  madrasaCode,
  logoUrl,
  academicYear = '2025/2026',
  madrasaPhone,
  madrasaEmail,
}) => {
  const [activeSheetMode, setActiveSheetMode] = useState<'both' | 'front' | 'back' | 'calibration'>('both');
  const [duplexPreviewSide, setDuplexPreviewSide] = useState<'front' | 'back'>('front');
  const [mirrorColumns, setMirrorColumns] = useState(true);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [currentPreviewPage, setCurrentPreviewPage] = useState(1);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const printAreaRef = useRef<HTMLDivElement>(null);

  // Split cards into chunks of 8
  const chunks: CardPrintData[][] = [];
  for (let i = 0; i < cards.length; i += CARDS_PER_SHEET) {
    chunks.push(cards.slice(i, i + CARDS_PER_SHEET));
  }
  const totalSheetPages = Math.max(1, chunks.length);

  // Reset preview page on modal open or card length change
  useEffect(() => {
    setCurrentPreviewPage(1);
  }, [cards.length, isOpen]);

  // Keyboard shortcut listener
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleBrowserPrint = () => {
    window.print();
  };

  const handleDownloadServerPdf = async () => {
    if (!printAreaRef.current) return;

    try {
      setIsExportingPdf(true);
      setExportError(null);

      let bodyHtml = printAreaRef.current.innerHTML;

      // Convert logo URL to inlined base64 Data URI for Puppeteer security pass-through
      if (logoUrl) {
        try {
          const logoDataUri = await convertImageUrlToDataUri(logoUrl);
          if (logoDataUri) {
            bodyHtml = bodyHtml.split(logoUrl).join(logoDataUri);
          }
        } catch (e) {
          console.warn('Failed to convert logo to data URI for PDF', e);
        }
      }

      const printHtml = buildSelfContainedCardSheetPdfHtml({
        bodyHtml,
        title: `${madrasaName} - Student ID Cards A4`,
      });

      const blob = await apiRenderBatchCardPdf({
        html: printHtml,
        title: `student-id-cards-${academicYear.replace('/', '-')}`,
      });

      // Trigger browser file download
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `student-id-cards-a4-batch-${academicYear.replace('/', '-')}.pdf`;
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

  return (
    <>
      {/* Print-Specific Stylesheet Injection */}
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

          #a4-batch-print-area,
          #a4-batch-print-area * {
            visibility: visible;
          }

          #a4-batch-print-area {
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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-stone-900/75 backdrop-blur-xs overflow-y-auto print:hidden">
        {/* Main Modal Shell */}
        <div
          className="relative w-full max-w-6xl bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden my-auto flex flex-col max-h-[95vh]"
          role="dialog"
          aria-modal="true"
        >
          {/* Header Bar */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-stone-200 bg-gradient-to-r from-stone-50/90 to-white shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 sm:w-11 h-10 sm:h-11 rounded-2xl bg-[#0F5A47] text-white flex items-center justify-center shadow-xs shrink-0">
                <Printer className="w-5 h-5 text-emerald-200" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm sm:text-base text-[#0F172A] tracking-tight">
                    A4 Batch ID Card Print Studio
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-[#0F5A47] shrink-0">
                    {cards.length} Cards Selected
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-stone-500 font-medium mt-0.5">
                  2×4 Grid · 8 Cards/Sheet · Exact CR80 (85.60 × 53.98 mm) · Exterior Crop Marks
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Subheader Toolbar & Control Bar */}
          <div className="px-4 sm:px-6 py-3 border-b border-stone-200 bg-white flex flex-wrap items-center justify-between gap-3 sm:gap-4 shrink-0">
            {/* View Mode Tabs */}
            <div className="flex flex-wrap items-center gap-1 p-1 bg-stone-100 rounded-xl border border-stone-200/80 shadow-xs w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setActiveSheetMode('both')}
                className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer text-center whitespace-nowrap ${
                  activeSheetMode === 'both'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                Duplex (Front & Back)
              </button>
              <button
                type="button"
                onClick={() => setActiveSheetMode('front')}
                className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer text-center whitespace-nowrap ${
                  activeSheetMode === 'front'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                Fronts Only
              </button>
              <button
                type="button"
                onClick={() => setActiveSheetMode('back')}
                className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer text-center whitespace-nowrap ${
                  activeSheetMode === 'back'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                Backs Only
              </button>
              <button
                type="button"
                onClick={() => setActiveSheetMode('calibration')}
                className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer text-center whitespace-nowrap ${
                  activeSheetMode === 'calibration'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                Calibration Sheet
              </button>
            </div>

            {/* Duplex Mirroring & Calibration Adjustments */}
            <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 sm:gap-4 text-xs text-stone-600 w-full sm:w-auto">
              {activeSheetMode !== 'calibration' && (
                <label className="flex items-center gap-1.5 cursor-pointer font-medium select-none text-[11px] sm:text-xs">
                  <input
                    type="checkbox"
                    checked={mirrorColumns}
                    onChange={(e) => setMirrorColumns(e.target.checked)}
                    className="rounded text-[#0F5A47] focus:ring-[#0F5A47]"
                  />
                  <span>Mirror Back Columns</span>
                </label>
              )}

              {/* Offset Fine-Tuning */}
              <div className="flex items-center gap-2 sm:border-l sm:border-stone-200 sm:pl-3">
                <span className="text-stone-400 font-medium text-[11px] sm:text-xs">Offsets:</span>
                <label className="flex items-center gap-1">
                  <span className="font-mono text-stone-500 text-xs">X:</span>
                  <input
                    type="number"
                    step="0.5"
                    min="-5"
                    max="5"
                    value={offsetX}
                    onChange={(e) => setOffsetX(parseFloat(e.target.value) || 0)}
                    className="w-12 sm:w-14 px-1 py-0.5 rounded border border-stone-300 text-center font-mono text-xs"
                    title="Horizontal shift in millimeters"
                  />
                  <span className="text-[10px] text-stone-400">mm</span>
                </label>

                <label className="flex items-center gap-1">
                  <span className="font-mono text-stone-500 text-xs">Y:</span>
                  <input
                    type="number"
                    step="0.5"
                    min="-5"
                    max="5"
                    value={offsetY}
                    onChange={(e) => setOffsetY(parseFloat(e.target.value) || 0)}
                    className="w-12 sm:w-14 px-1 py-0.5 rounded border border-stone-300 text-center font-mono text-xs"
                    title="Vertical shift in millimeters"
                  />
                  <span className="text-[10px] text-stone-400">mm</span>
                </label>
              </div>
            </div>
          </div>

          {/* Error Notification */}
          {exportError && (
            <div className="mx-4 sm:mx-6 mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center justify-between">
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

          {/* Interactive Screen Preview Viewport */}
          <div className="flex-1 overflow-auto p-4 sm:p-6 bg-stone-100 flex flex-col items-center justify-start min-h-[480px]">
            {/* Sheet Page Pagination Controls (When > 1 sheet chunk) */}
            {activeSheetMode !== 'calibration' && totalSheetPages > 1 && (
              <div className="mb-3 flex items-center gap-3 bg-white px-4 py-1.5 rounded-full shadow-xs border border-stone-200 text-xs">
                <button
                  type="button"
                  onClick={() => setCurrentPreviewPage((p) => Math.max(1, p - 1))}
                  disabled={currentPreviewPage <= 1}
                  className="p-1 rounded-full hover:bg-stone-100 disabled:opacity-30 cursor-pointer"
                  aria-label="Previous sheet page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-semibold text-stone-700">
                  Previewing Sheet Page <strong>{currentPreviewPage}</strong> of <strong>{totalSheetPages}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPreviewPage((p) => Math.min(totalSheetPages, p + 1))}
                  disabled={currentPreviewPage >= totalSheetPages}
                  className="p-1 rounded-full hover:bg-stone-100 disabled:opacity-30 cursor-pointer"
                  aria-label="Next sheet page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Duplex Front / Back Preview Side Switcher */}
            {activeSheetMode === 'both' && (
              <div className="mb-3 inline-flex items-center p-1 bg-white border border-stone-200 rounded-full shadow-xs text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setDuplexPreviewSide('front')}
                  className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                    duplexPreviewSide === 'front'
                      ? 'bg-[#0F5A47] text-white shadow-xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  Front Page
                </button>
                <button
                  type="button"
                  onClick={() => setDuplexPreviewSide('back')}
                  className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                    duplexPreviewSide === 'back'
                      ? 'bg-[#0F5A47] text-white shadow-xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  Back Page (Duplex View)
                </button>
              </div>
            )}

            {/* Scaled A4 Sheet Screen Preview Container */}
            <div className="w-full overflow-x-auto flex flex-col items-center">
              <div
                className="bg-white shadow-2xl border border-stone-300 rounded-sm overflow-hidden"
                style={{
                  transform: 'scale(0.58)',
                  transformOrigin: 'top center',
                  marginBottom: '-120mm', // Counteract CSS scale gap
                }}
              >
                {activeSheetMode === 'calibration' ? (
                  <A4CalibrationSheet
                    madrasaName={madrasaName}
                    offsetX={offsetX}
                    offsetY={offsetY}
                  />
                ) : activeSheetMode === 'front' ? (
                  <A4CardSheet
                    cards={chunks[currentPreviewPage - 1] || []}
                    sheetType="front"
                    offsetX={offsetX}
                    offsetY={offsetY}
                    pageNumber={currentPreviewPage}
                    totalPages={totalSheetPages}
                    madrasaName={madrasaName}
                    madrasaCode={madrasaCode}
                    logoUrl={logoUrl}
                    academicYear={academicYear}
                  />
                ) : activeSheetMode === 'back' ? (
                  <A4CardSheet
                    cards={chunks[currentPreviewPage - 1] || []}
                    sheetType="back"
                    mirrorColumns={mirrorColumns}
                    offsetX={offsetX}
                    offsetY={offsetY}
                    pageNumber={currentPreviewPage}
                    totalPages={totalSheetPages}
                    madrasaName={madrasaName}
                    madrasaPhone={madrasaPhone}
                    madrasaEmail={madrasaEmail}
                    academicYear={academicYear}
                  />
                ) : duplexPreviewSide === 'back' ? (
                  /* Duplex View: Previewing Back Sheet with Column Mirroring */
                  <A4CardSheet
                    cards={chunks[currentPreviewPage - 1] || []}
                    sheetType="back"
                    mirrorColumns={mirrorColumns}
                    offsetX={offsetX}
                    offsetY={offsetY}
                    pageNumber={currentPreviewPage}
                    totalPages={totalSheetPages}
                    madrasaName={madrasaName}
                    madrasaPhone={madrasaPhone}
                    madrasaEmail={madrasaEmail}
                    academicYear={academicYear}
                  />
                ) : (
                  /* Duplex View: Previewing Front Sheet */
                  <A4CardSheet
                    cards={chunks[currentPreviewPage - 1] || []}
                    sheetType="front"
                    offsetX={offsetX}
                    offsetY={offsetY}
                    pageNumber={currentPreviewPage}
                    totalPages={totalSheetPages}
                    madrasaName={madrasaName}
                    madrasaCode={madrasaCode}
                    logoUrl={logoUrl}
                    academicYear={academicYear}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Footer Bar with Print & Export Actions */}
          <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-t border-stone-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 shrink-0">
            <div className="flex items-center gap-2 text-[11px] sm:text-xs text-stone-500 w-full sm:w-auto">
              <Info className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Set printer to <strong>A4 Paper</strong> and <strong>100% Scale</strong> (disable &quot;Fit to Printable Area&quot;).
              </span>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto flex-wrap sm:flex-nowrap">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 sm:flex-initial px-3 sm:px-4 py-2 border border-stone-200 text-stone-600 rounded-xl text-xs font-semibold hover:bg-stone-50 transition-colors cursor-pointer"
              >
                Close
              </button>

              <button
                type="button"
                onClick={handleDownloadServerPdf}
                disabled={isExportingPdf}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-semibold transition-all cursor-pointer border border-stone-300 disabled:opacity-50"
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
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2 bg-[#0F5A47] hover:bg-[#0c4738] text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer active:scale-95"
              >
                <Printer className="w-4 h-4" />
                <span className="whitespace-nowrap">Print A4 Batch</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden Dedicated Print Area (Only visible to printer via @media print) */}
      <div id="a4-batch-print-area" ref={printAreaRef} className="hidden print:block">
        {activeSheetMode === 'calibration' ? (
          <div className="a4-print-page">
            <A4CalibrationSheet
              madrasaName={madrasaName}
              offsetX={offsetX}
              offsetY={offsetY}
            />
          </div>
        ) : activeSheetMode === 'front' ? (
          chunks.map((chunk, index) => (
            <div key={`print-front-page-${index}`} className="a4-print-page">
              <A4CardSheet
                cards={chunk}
                sheetType="front"
                offsetX={offsetX}
                offsetY={offsetY}
                pageNumber={index + 1}
                totalPages={totalSheetPages}
                madrasaName={madrasaName}
                madrasaCode={madrasaCode}
                logoUrl={logoUrl}
                academicYear={academicYear}
              />
            </div>
          ))
        ) : activeSheetMode === 'back' ? (
          chunks.map((chunk, index) => (
            <div key={`print-back-page-${index}`} className="a4-print-page">
              <A4CardSheet
                cards={chunk}
                sheetType="back"
                mirrorColumns={mirrorColumns}
                offsetX={offsetX}
                offsetY={offsetY}
                pageNumber={index + 1}
                totalPages={totalSheetPages}
                madrasaName={madrasaName}
                madrasaPhone={madrasaPhone}
                madrasaEmail={madrasaEmail}
                academicYear={academicYear}
              />
            </div>
          ))
        ) : (
          /* Duplex Mode: Prints Front Page 1, Back Page 1, Front Page 2, Back Page 2, etc. */
          chunks.map((chunk, index) => (
            <React.Fragment key={`print-duplex-pair-${index}`}>
              <div className="a4-print-page">
                <A4CardSheet
                  cards={chunk}
                  sheetType="front"
                  offsetX={offsetX}
                  offsetY={offsetY}
                  pageNumber={index + 1}
                  totalPages={totalSheetPages}
                  madrasaName={madrasaName}
                  madrasaCode={madrasaCode}
                  logoUrl={logoUrl}
                  academicYear={academicYear}
                />
              </div>
              <div className="a4-print-page">
                <A4CardSheet
                  cards={chunk}
                  sheetType="back"
                  mirrorColumns={mirrorColumns}
                  offsetX={offsetX}
                  offsetY={offsetY}
                  pageNumber={index + 1}
                  totalPages={totalSheetPages}
                  madrasaName={madrasaName}
                  madrasaPhone={madrasaPhone}
                  madrasaEmail={madrasaEmail}
                  academicYear={academicYear}
                />
              </div>
            </React.Fragment>
          ))
        )}
      </div>
    </>
  );
};

export default BatchPrintStudioModal;
