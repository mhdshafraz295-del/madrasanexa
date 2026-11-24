import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Printer,
  RotateCw,
  IdCard,
  Shield,
  QrCode,
  Barcode,
  Smartphone,
  CreditCard,
  UploadCloud,
  Upload,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
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
 * - Dual Orientation Modes: Vertical Lanyard (53.98 × 85.60 mm) & Horizontal CR80 (85.60 × 53.98 mm).
 * - Luxury Deep Emerald (#193B32), Warm Antique Gold (#C5A059), and Crisp Off-White aesthetic.
 * - Zero-R2 / Browser Memory-Only Photo Upload (Print Only): Immediate local preview with zero cloud storage.
 * - 3D card flipping between Front and Back with smooth perspective.
 * - Exact CR80 physical proportions and dynamic print stylesheet isolation.
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
  // Orientation: 'vertical' (Default lanyard style) vs 'horizontal' (Classic CR80)
  const [orientation, setOrientation] = useState<'vertical' | 'horizontal'>('vertical');
  const [currentSide, setCurrentSide] = useState<'front' | 'back'>('front');
  const [credentialType, setCredentialType] = useState<'qr' | 'barcode'>('qr');
  const [printLayout, setPrintLayout] = useState<'both' | 'current'>('both');

  // Memory-only print photo upload state (Zero R2 storage)
  const [localPhotoUrl, setLocalPhotoUrl] = useState<string | null>(null);
  const [localPhotoName, setLocalPhotoName] = useState<string | null>(null);
  const [isDraggingPhoto, setIsDraggingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clear memory photo state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setLocalPhotoUrl(null);
      setLocalPhotoName(null);
      setCurrentSide('front');
    }
  }, [isOpen]);

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

  // Local-only file reader handler (Zero cloud upload)
  const handlePhotoFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file (JPG, PNG, WebP).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setLocalPhotoUrl(result);
      setLocalPhotoName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLocalPhoto = () => {
    setLocalPhotoUrl(null);
    setLocalPhotoName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Dimensions based on selected orientation
  const cardWidthMm = orientation === 'vertical' ? '53.98mm' : '85.60mm';
  const cardHeightMm = orientation === 'vertical' ? '85.60mm' : '53.98mm';

  return (
    <>
      {/* Dynamic Print-Specific Stylesheet Injection & Razor-Sharp HD Vector Preview Styles */}
      <style>{`
        /* HD Preview Antialiasing & Sharp Vector Text Rendering */
        .id-card-hd-stage {
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          text-rendering: optimizeLegibility;
          image-rendering: -webkit-optimize-contrast;
          transform: translateZ(0);
          backface-visibility: hidden;
        }

        .id-card-stage-vertical {
          zoom: 1.25;
        }
        @media (min-width: 480px) {
          .id-card-stage-vertical {
            zoom: 1.42;
          }
        }
        @media (min-width: 640px) {
          .id-card-stage-vertical {
            zoom: 1.54;
          }
        }

        .id-card-stage-horizontal {
          zoom: 1.05;
        }
        @media (min-width: 480px) {
          .id-card-stage-horizontal {
            zoom: 1.24;
          }
        }
        @media (min-width: 640px) {
          .id-card-stage-horizontal {
            zoom: 1.48;
          }
        }

        @media print {
          /* Enforce exact physical page geometry with 0 margins */
          @page {
            size: ${cardWidthMm} ${cardHeightMm};
            margin: 0mm;
          }

          html, body {
            width: ${cardWidthMm} !important;
            height: ${cardHeightMm} !important;
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
            width: ${cardWidthMm} !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            display: block !important;
            box-sizing: border-box !important;
            transform: none !important;
          }

          .cr80-print-card-wrapper {
            width: ${cardWidthMm} !important;
            height: ${cardHeightMm} !important;
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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/75 backdrop-blur-xs overflow-y-auto print:hidden">
        {/* Modal Window */}
        <div
          className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden my-auto"
          role="dialog"
          aria-modal="true"
        >
          {/* Header Design with Luxury Deep Emerald / Antique Gold Styling */}
          <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-stone-100 bg-gradient-to-r from-[#193B32]/5 via-white to-[#C5A059]/10">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#133129] to-[#193B32] text-white flex items-center justify-center shadow-sm shrink-0 border border-[#C5A059]/40">
                <IdCard className="w-5 h-5 text-[#C5A059]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base sm:text-lg text-[#0F172A] leading-tight tracking-tight">
                    Student ID Card Studio
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#193B32] text-[#C5A059] border border-[#C5A059]/40 uppercase tracking-wider">
                    CR80 Standard
                  </span>
                </div>
                <p className="text-xs text-stone-500 font-medium mt-0.5">
                  CR80 Physical Dimension Preview ·{' '}
                  {orientation === 'vertical'
                    ? '53.98 × 85.60 mm (Vertical Lanyard)'
                    : '85.60 × 53.98 mm (Horizontal Landscape)'}
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
          <div className="p-4 sm:p-6 flex flex-col items-center">
            {/* Top Toolbar: Orientation Selector & Side/Credential Controls */}
            <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-3 mb-4">
              {/* Orientation Mode Segmented Toggle */}
              <div className="inline-flex rounded-xl bg-stone-100 p-1 border border-stone-200/80 shadow-2xs w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setOrientation('vertical')}
                  className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    orientation === 'vertical'
                      ? 'bg-[#193B32] text-white shadow-xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                  title="Vertical Portrait (Lanyard style - 53.98 × 85.60 mm)"
                >
                  <Smartphone className="w-3.5 h-3.5 text-[#C5A059]" />
                  <span>Vertical Lanyard</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOrientation('horizontal')}
                  className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    orientation === 'horizontal'
                      ? 'bg-[#193B32] text-white shadow-xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                  title="Horizontal Landscape (Classic CR80 - 85.60 × 53.98 mm)"
                >
                  <CreditCard className="w-3.5 h-3.5 text-[#C5A059]" />
                  <span>Horizontal CR80</span>
                </button>
              </div>

              {/* Side Tab Switcher & Flip Control */}
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                {/* Front / Back Switcher */}
                <div className="inline-flex rounded-xl bg-stone-100 p-1 border border-stone-200/80 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setCurrentSide('front')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      currentSide === 'front'
                        ? 'bg-white text-[#193B32] shadow-xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    Front Side
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentSide('back')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      currentSide === 'back'
                        ? 'bg-white text-[#193B32] shadow-xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    Back Side
                  </button>
                </div>

                {/* Flip Card Control */}
                <button
                  type="button"
                  onClick={() => setCurrentSide((prev) => (prev === 'front' ? 'back' : 'front'))}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-200 bg-white text-stone-700 text-xs font-semibold hover:bg-stone-50 shadow-2xs transition-all cursor-pointer active:scale-95"
                  title="Flip Card (Space / F)"
                >
                  <RotateCw className="w-3.5 h-3.5 text-[#193B32]" />
                  <span>Flip</span>
                </button>
              </div>
            </div>

            {/* Zero-R2 / Browser Memory-Only Photo Upload (Print Only) Banner */}
            <div
              className={`w-full mb-4 bg-gradient-to-r from-[#FAF9F5] to-white border ${
                isDraggingPhoto ? 'border-[#C5A059] bg-[#C5A059]/10' : 'border-[#E8E5D8]'
              } rounded-2xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 transition-colors`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingPhoto(true);
              }}
              onDragLeave={() => setIsDraggingPhoto(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDraggingPhoto(false);
                const file = e.dataTransfer.files?.[0];
                if (file) handlePhotoFile(file);
              }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[#193B32]/10 text-[#193B32] flex items-center justify-center shrink-0 border border-[#193B32]/20">
                  <UploadCloud className="w-4 h-4 text-[#193B32]" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-[#193B32]">
                      Upload Photo (Print Only)
                    </span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-[#C5A059]/15 text-[#9A7B38] border border-[#C5A059]/30">
                      Zero Cloud R2 Storage
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-500 mt-0.5 truncate">
                    Local preview only — not saved to cloud storage. Instant print preview.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handlePhotoFile(file);
                  }}
                />

                {localPhotoUrl ? (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 text-[11px] text-emerald-800 font-semibold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="truncate max-w-[130px]">{localPhotoName || 'Custom Photo'}</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveLocalPhoto}
                      className="px-2.5 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                      title="Remove local photo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3.5 py-1.5 rounded-xl bg-white border border-[#C5A059]/60 hover:border-[#C5A059] text-[#193B32] hover:bg-[#FAF8F2] text-xs font-semibold shadow-2xs flex items-center gap-1.5 cursor-pointer transition-all"
                  >
                    <Upload className="w-3.5 h-3.5 text-[#C5A059]" />
                    <span>Choose Photo</span>
                  </button>
                )}
              </div>
            </div>

            {/* Back-side Credential Type Selector */}
            {currentSide === 'back' && (
              <div className="w-full flex items-center justify-end mb-3">
                <div className="inline-flex rounded-xl bg-stone-100 p-1 border border-stone-200/80 shadow-2xs text-xs">
                  <button
                    type="button"
                    onClick={() => setCredentialType('qr')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                      credentialType === 'qr'
                        ? 'bg-white text-[#193B32] shadow-xs'
                        : 'text-stone-500 hover:text-stone-800'
                    }`}
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>QR Code</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCredentialType('barcode')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                      credentialType === 'barcode'
                        ? 'bg-white text-[#193B32] shadow-xs'
                        : 'text-stone-500 hover:text-stone-800'
                    }`}
                  >
                    <Barcode className="w-3.5 h-3.5" />
                    <span>Barcode</span>
                  </button>
                </div>
              </div>
            )}

            {/* Interactive Screen Preview Container with 3D Flip */}
            <div className="w-full p-4 sm:p-6 bg-gradient-to-b from-stone-50/90 to-stone-100/70 border border-stone-200/90 rounded-2xl flex items-center justify-center shadow-inner overflow-hidden min-h-[340px]">
              <div
                className={`id-card-hd-stage transition-all duration-300 ${
                  orientation === 'vertical'
                    ? 'id-card-stage-vertical my-2'
                    : 'id-card-stage-horizontal my-3'
                }`}
                style={{
                  transformOrigin: 'center center',
                  perspective: '1200px',
                }}
              >
                <div
                  className="relative transition-transform duration-500 ease-in-out"
                  style={{
                    width: cardWidthMm,
                    height: cardHeightMm,
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
                      orientation={orientation}
                      localPhotoUrl={localPhotoUrl}
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
                      logoUrl={logoUrl}
                      tokenHint={tokenHint}
                      rawToken={rawToken}
                      credentialType={credentialType}
                      orientation={orientation}
                      className="shadow-xl"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Student Information Section */}
            <div className="w-full mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-stone-50/90 border border-stone-200/80 rounded-2xl p-3 text-xs">
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
                <span className="font-mono font-bold text-[#9A7B38] block mt-0.5">
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
                  <Shield className="w-3.5 h-3.5 text-[#193B32]" />
                  <span>v{cardVersion}.0 Active</span>
                </span>
              </div>
            </div>

            {/* Print Controls Footer */}
            <div className="w-full mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-stone-100">
              {/* Print Layout Options */}
              <div className="flex items-center gap-3 text-xs text-stone-600">
                <span className="font-semibold text-stone-800">Print Option:</span>
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="radio"
                    name="printLayout"
                    checked={printLayout === 'both'}
                    onChange={() => setPrintLayout('both')}
                    className="text-[#193B32] focus:ring-[#193B32] cursor-pointer"
                  />
                  <span className={printLayout === 'both' ? 'font-semibold text-[#0F172A]' : 'text-stone-600'}>
                    Front & Back (Duplex)
                  </span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="radio"
                    name="printLayout"
                    checked={printLayout === 'current'}
                    onChange={() => setPrintLayout('current')}
                    className="text-[#193B32] focus:ring-[#193B32] cursor-pointer"
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
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2 bg-gradient-to-r from-[#133129] to-[#193B32] hover:from-[#0d251f] hover:to-[#133129] text-white rounded-xl text-xs font-semibold shadow-xs border border-[#C5A059]/40 transition-all cursor-pointer active:scale-95"
                >
                  <Printer className="w-4 h-4 text-[#C5A059]" />
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
                orientation={orientation}
                localPhotoUrl={localPhotoUrl}
              />
            </div>
            <div className="cr80-print-card-wrapper">
              <IdCardBack
                student={student}
                madrasaName={madrasaName}
                madrasaPhone={madrasaPhone}
                madrasaEmail={madrasaEmail}
                logoUrl={logoUrl}
                tokenHint={tokenHint}
                rawToken={rawToken}
                credentialType={credentialType}
                orientation={orientation}
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
              orientation={orientation}
              localPhotoUrl={localPhotoUrl}
            />
          </div>
        ) : (
          <div className="cr80-print-card-wrapper">
            <IdCardBack
              student={student}
              madrasaName={madrasaName}
              madrasaPhone={madrasaPhone}
              madrasaEmail={madrasaEmail}
              logoUrl={logoUrl}
              tokenHint={tokenHint}
              rawToken={rawToken}
              credentialType={credentialType}
              orientation={orientation}
            />
          </div>
        )}
      </div>
    </>
  );
};

export default IdCardPreviewModal;
