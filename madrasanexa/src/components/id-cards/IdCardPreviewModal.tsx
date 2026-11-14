import React, { useState, useEffect } from 'react';
import { X, Printer, RotateCw, IdCard, Shield, QrCode, Barcode } from 'lucide-react';
import { IdCardFront } from './IdCardFront';
import { IdCardBack } from './IdCardBack';

export interface IdCardPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: {
    id: string;
    admissionNo: string;
    fullName: string;
    className?: string | null;
    photoFileId?: string | null;
    admissionDate?: string | null;
  };
  madrasaName: string;
  madrasaCode?: string | null;
  logoUrl?: string | null;
  madrasaPhone?: string | null;
  madrasaEmail?: string | null;
  academicYear?: string;
  cardVersion?: number;
  tokenHint?: string | null;
  rawToken?: string | null;
  issuedAt?: string | null;
}

/**
 * IdCardPreviewModal - Interactive 3D CR80 Visual Studio & Individual Card Print Modal.
 *
 * Features:
 * - 3D card flipping between Front and Back with smooth perspective.
 * - Exact CR80 physical proportions (85.60mm x 53.98mm).
 * - QR Code vs Barcode credential selection with QR default.
 * - Individual card print with print-specific isolation CSS (hides dashboard, prints card at 100% scale).
 * - Keyboard navigation (Esc to close, Space / F to flip).
 */
export const IdCardPreviewModal: React.FC<IdCardPreviewModalProps> = ({
  isOpen,
  onClose,
  student,
  madrasaName,
  madrasaCode,
  logoUrl,
  madrasaPhone,
  madrasaEmail,
  academicYear = '2025/2026',
  cardVersion = 1,
  tokenHint,
  rawToken,
  issuedAt,
}) => {
  const [currentSide, setCurrentSide] = useState<'front' | 'back'>('front');
  const [credentialType, setCredentialType] = useState<'qr' | 'barcode'>('qr');
  const [printLayout, setPrintLayout] = useState<'both' | 'current'>('both');

  // Keyboard shortcut listener
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'f' || e.key === 'F' || e.key === ' ') {
        e.preventDefault();
        setCurrentSide((prev) => (prev === 'front' ? 'back' : 'front'));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      {/* Print-Specific Stylesheet Injection */}
      <style>{`
        @media print {
          /* Enforce exact CR80 physical page geometry: 85.60mm x 53.98mm with 0 margins */
          @page {
            size: 85.60mm 53.98mm;
            margin: 0mm;
          }

          html, body {
            width: 85.60mm !important;
            height: 53.98mm !important;
            margin: 0mm !important;
            padding: 0mm !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            overflow: hidden !important;
          }

          /* Hide all main UI, navigation, headers, and modal chrome */
          body * {
            visibility: hidden;
          }

          /* Expose dedicated print area and all card descendants */
          #id-card-print-area,
          #id-card-print-area * {
            visibility: visible;
          }

          #id-card-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 85.60mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            display: block !important;
            box-sizing: border-box !important;
            transform: none !important;
          }

          .cr80-print-card-wrapper {
            width: 85.60mm !important;
            height: 53.98mm !important;
            margin: 0 !important;
            padding: 0 !important;
            display: block !important;
            box-sizing: border-box !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            transform: none !important;
          }

          /* Page break between Front and Back for 2-page duplex card printing */
          .cr80-page-break {
            page-break-after: always !important;
            break-after: page !important;
          }

          .cr80-page-break:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
        }
      `}</style>

      {/* Screen Backdrop */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/70 backdrop-blur-xs overflow-y-auto print:hidden">
        {/* Modal Window */}
        <div
          className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden my-auto"
          role="dialog"
          aria-modal="true"
        >
          {/* Section 2: Header Design */}
          <div className="flex items-center justify-between px-6 py-4.5 border-b border-stone-100 bg-gradient-to-r from-stone-50/90 to-white">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-[#0F5A47] text-white flex items-center justify-center shadow-sm shrink-0">
                <IdCard className="w-5 h-5 text-emerald-200" />
              </div>
              <div>
                <h3 className="font-bold text-base sm:text-lg text-[#0F172A] leading-tight tracking-tight">
                  Student ID Card Studio
                </h3>
                <p className="text-xs text-stone-500 font-medium mt-0.5">
                  CR80 Physical Dimension Preview · 85.60 × 53.98 mm
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

          {/* Modal Body */}
          <div className="p-5 sm:p-6 flex flex-col items-center">
            {/* Controls Bar: Side Tabs, Flip Control & Credential Selector */}
            <div className="flex flex-col sm:flex-row items-center justify-between w-full gap-3 mb-5">
              {/* Front Side / Back Side Tab Switcher */}
              <div className="inline-flex rounded-xl bg-stone-100 p-1 border border-stone-200/70 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setCurrentSide('front')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    currentSide === 'front'
                      ? 'bg-white text-[#0F5A47] shadow-xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  Front Side
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentSide('back')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    currentSide === 'back'
                      ? 'bg-white text-[#0F5A47] shadow-xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  Back Side
                </button>
              </div>

              {/* QR Code / Barcode Selector & Flip Button */}
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                {/* Credential Type Selector (Only active on back side, or switches to back side) */}
                <div className="inline-flex rounded-xl bg-stone-100 p-1 border border-stone-200/70 shadow-2xs text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setCredentialType('qr');
                      if (currentSide === 'front') setCurrentSide('back');
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                      credentialType === 'qr'
                        ? 'bg-white text-[#0F5A47] shadow-xs'
                        : 'text-stone-500 hover:text-stone-800'
                    }`}
                    title="Render Secure QR Code"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>QR Code</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCredentialType('barcode');
                      if (currentSide === 'front') setCurrentSide('back');
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                      credentialType === 'barcode'
                        ? 'bg-white text-[#0F5A47] shadow-xs'
                        : 'text-stone-500 hover:text-stone-800'
                    }`}
                    title="Render Code128 Admission Barcode"
                  >
                    <Barcode className="w-3.5 h-3.5" />
                    <span>Barcode</span>
                  </button>
                </div>

                {/* Flip Card Control */}
                <button
                  type="button"
                  onClick={() => setCurrentSide((prev) => (prev === 'front' ? 'back' : 'front'))}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-stone-200 bg-white text-stone-700 text-xs font-semibold hover:bg-stone-50 shadow-2xs transition-all cursor-pointer active:scale-95"
                  title="Flip Card (Space / F)"
                >
                  <RotateCw className="w-3.5 h-3.5 text-[#0F5A47]" />
                  <span>Flip (F)</span>
                </button>
              </div>
            </div>

            {/* Interactive Screen Preview Container with 3D Flip */}
            <div className="w-full p-4 sm:p-6 bg-gradient-to-b from-stone-50/80 to-stone-100/60 border border-stone-200/80 rounded-2xl flex items-center justify-center shadow-inner overflow-hidden">
              <div
                className="transition-all duration-300 transform scale-100 sm:scale-110 lg:scale-120 my-3"
                style={{
                  transformOrigin: 'center center',
                  perspective: '1200px',
                }}
              >
                <div
                  className="relative transition-transform duration-500 ease-in-out"
                  style={{
                    width: '85.60mm',
                    height: '53.98mm',
                    transformStyle: 'preserve-3d',
                    transform: currentSide === 'back' ? 'rotateY(180deg)' : 'rotateY(0deg)',
                  }}
                >
                  {/* Front Face */}
                  <div
                    className="absolute inset-0"
                    style={{
                      backfaceVisibility: 'hidden',
                      WebkitBackfaceVisibility: 'hidden',
                    }}
                  >
                    <IdCardFront
                      student={student}
                      madrasaName={madrasaName}
                      madrasaCode={madrasaCode}
                      logoUrl={logoUrl}
                      academicYear={academicYear}
                      cardVersion={cardVersion}
                      issuedAt={issuedAt}
                      className="shadow-xl"
                    />
                  </div>

                  {/* Back Face */}
                  <div
                    className="absolute inset-0"
                    style={{
                      backfaceVisibility: 'hidden',
                      WebkitBackfaceVisibility: 'hidden',
                      transform: 'rotateY(180deg)',
                    }}
                  >
                    <IdCardBack
                      student={student}
                      madrasaName={madrasaName}
                      madrasaPhone={madrasaPhone}
                      madrasaEmail={madrasaEmail}
                      tokenHint={tokenHint}
                      rawToken={rawToken}
                      credentialType={credentialType}
                      className="shadow-xl"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 6: Student Information Section */}
            <div className="w-full mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-stone-50/90 border border-stone-200/80 rounded-2xl p-3.5 text-xs">
              <div>
                <span className="text-[10px] text-stone-400 uppercase tracking-wider block font-bold">
                  Student Name
                </span>
                <span className="font-semibold text-[#0F172A] truncate block mt-0.5" title={student.fullName}>
                  {student.fullName}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-stone-400 uppercase tracking-wider block font-bold">
                  Admission Number
                </span>
                <span className="font-mono font-bold text-[#0F5A47] block mt-0.5">
                  {student.admissionNo}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-stone-400 uppercase tracking-wider block font-bold">
                  Credential Hint
                </span>
                <span className="font-mono text-stone-600 block mt-0.5 truncate">
                  {tokenHint || 'Pending Issue'}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-stone-400 uppercase tracking-wider block font-bold">
                  Card Version / Status
                </span>
                <span className="font-semibold text-stone-800 flex items-center gap-1.5 mt-0.5">
                  <Shield className="w-3.5 h-3.5 text-[#0F5A47]" />
                  <span>v{cardVersion}.0 Active</span>
                </span>
              </div>
            </div>

            {/* Section 7: Print Controls */}
            <div className="w-full mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 pt-3.5 border-t border-stone-100">
              {/* Print Layout Options */}
              <div className="flex items-center gap-3 text-xs text-stone-600">
                <span className="font-semibold text-stone-800">Print Option:</span>
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="radio"
                    name="printLayout"
                    checked={printLayout === 'both'}
                    onChange={() => setPrintLayout('both')}
                    className="text-[#0F5A47] focus:ring-[#0F5A47] cursor-pointer"
                  />
                  <span className={printLayout === 'both' ? 'font-semibold text-[#0F172A]' : 'text-stone-600'}>
                    Front & Back (Duplex / 2 Pages)
                  </span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="radio"
                    name="printLayout"
                    checked={printLayout === 'current'}
                    onChange={() => setPrintLayout('current')}
                    className="text-[#0F5A47] focus:ring-[#0F5A47] cursor-pointer"
                  />
                  <span className={printLayout === 'current' ? 'font-semibold text-[#0F172A]' : 'text-stone-600'}>
                    Current View Only
                  </span>
                </label>
              </div>

              {/* Action Buttons: Close and Print */}
              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 sm:flex-initial px-4 py-2 border border-stone-200 text-stone-600 hover:text-stone-800 rounded-xl text-xs font-semibold hover:bg-stone-50 transition-colors cursor-pointer"
                >
                  Close
                </button>

                <button
                  type="button"
                  onClick={handlePrint}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2 bg-[#0F5A47] hover:bg-[#0c4738] text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer active:scale-95"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Card (CR80)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden Dedicated Print Area (Only visible to printer via @media print) */}
      <div id="id-card-print-area" className="hidden print:block">
        {printLayout === 'both' ? (
          <>
            <div className="cr80-print-card-wrapper cr80-page-break">
              <IdCardFront
                student={student}
                madrasaName={madrasaName}
                madrasaCode={madrasaCode}
                logoUrl={logoUrl}
                academicYear={academicYear}
                cardVersion={cardVersion}
                issuedAt={issuedAt}
              />
            </div>
            <div className="cr80-print-card-wrapper">
              <IdCardBack
                student={student}
                madrasaName={madrasaName}
                madrasaPhone={madrasaPhone}
                madrasaEmail={madrasaEmail}
                tokenHint={tokenHint}
                rawToken={rawToken}
                credentialType={credentialType}
              />
            </div>
          </>
        ) : currentSide === 'front' ? (
          <div className="cr80-print-card-wrapper">
            <IdCardFront
              student={student}
              madrasaName={madrasaName}
              madrasaCode={madrasaCode}
              logoUrl={logoUrl}
              academicYear={academicYear}
              cardVersion={cardVersion}
              issuedAt={issuedAt}
            />
          </div>
        ) : (
          <div className="cr80-print-card-wrapper">
            <IdCardBack
              student={student}
              madrasaName={madrasaName}
              madrasaPhone={madrasaPhone}
              madrasaEmail={madrasaEmail}
              tokenHint={tokenHint}
              rawToken={rawToken}
              credentialType={credentialType}
            />
          </div>
        )}
      </div>
    </>
  );
};

export default IdCardPreviewModal;
