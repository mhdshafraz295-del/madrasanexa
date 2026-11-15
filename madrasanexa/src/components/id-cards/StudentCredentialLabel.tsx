import React from 'react';
import type { CardPrintData } from '../../services/student-token.service';
import { StudentQrCode } from './StudentQrCode';
import { StudentBarcode } from './StudentBarcode';

export type LabelStyle = 'minimal' | 'professional' | 'compact';
export type CredentialMode = 'qr_only' | 'barcode_only' | 'qr_and_barcode';
export type CuttingGuideStyle = 'dotted' | 'solid' | 'corners' | 'none';

export interface StudentCredentialLabelProps {
  card: CardPrintData;
  style?: LabelStyle;
  credentialMode?: CredentialMode;
  cuttingGuide?: CuttingGuideStyle;
  widthMm?: number;
  heightMm?: number;
  madrasaName?: string;
  showAdmissionNo?: boolean;
  showInstitution?: boolean;
  className?: string;
}

/**
 * StudentCredentialLabel - Renders an individual student credential label with
 * exact physical dimensions, high-contrast typography, and scannable optical zones.
 *
 * Supported Visual Styles:
 * - Minimal: Clean white background, name, large credential, subtle border.
 * - Professional: Bold typography, admission pill, institutional accent, refined spacing.
 * - Compact: Optimized for dense printing with preserved scan quiet zones.
 */
export const StudentCredentialLabel: React.FC<StudentCredentialLabelProps> = ({
  card,
  style = 'professional',
  credentialMode = 'qr_only',
  cuttingGuide = 'dotted',
  widthMm = 60,
  heightMm = 45,
  madrasaName = 'Madrasa Portal',
  showAdmissionNo = true,
  showInstitution = true,
  className = '',
}) => {
  const { student, card: tokenInfo } = card;

  // Determine cutting boundary border class based on setting
  const getBorderClasses = () => {
    switch (cuttingGuide) {
      case 'dotted':
        return 'border border-dashed border-stone-300';
      case 'solid':
        return 'border border-solid border-stone-300';
      case 'corners':
        return 'border border-transparent'; // Corner brackets rendered separately
      case 'none':
      default:
        return 'border border-transparent';
    }
  };

  // Determine responsive QR size based on available label height and mode
  const getQrSizeMm = () => {
    if (credentialMode === 'qr_and_barcode') {
      return style === 'compact' ? 14 : 17;
    }
    if (style === 'compact') return 16;
    if (style === 'minimal') return Math.min(26, heightMm - 16);
    return Math.min(24, heightMm - 18);
  };

  const qrSizeMm = getQrSizeMm();

  return (
    <div
      className={`relative bg-white text-stone-900 overflow-hidden box-border select-none flex flex-col justify-between ${getBorderClasses()} ${className}`}
      style={{
        width: `${widthMm}mm`,
        height: `${heightMm}mm`,
        padding: style === 'compact' ? '1.5mm' : '2.5mm',
        boxSizing: 'border-box',
        backgroundColor: '#ffffff',
      }}
      data-student-id={student.id}
      data-admission-no={student.admissionNo}
    >
      {/* Optional Corner Cutting Marks (for 'corners' guide mode) */}
      {cuttingGuide === 'corners' && (
        <>
          <div className="absolute top-0 left-0 w-[2.5mm] h-[2.5mm] pointer-events-none">
            <div className="absolute top-0 left-0 w-[2.5mm] h-[0.25mm] bg-stone-400" />
            <div className="absolute top-0 left-0 h-[2.5mm] w-[0.25mm] bg-stone-400" />
          </div>
          <div className="absolute top-0 right-0 w-[2.5mm] h-[2.5mm] pointer-events-none">
            <div className="absolute top-0 right-0 w-[2.5mm] h-[0.25mm] bg-stone-400" />
            <div className="absolute top-0 right-0 h-[2.5mm] w-[0.25mm] bg-stone-400" />
          </div>
          <div className="absolute bottom-0 left-0 w-[2.5mm] h-[2.5mm] pointer-events-none">
            <div className="absolute bottom-0 left-0 w-[2.5mm] h-[0.25mm] bg-stone-400" />
            <div className="absolute bottom-0 left-0 h-[2.5mm] w-[0.25mm] bg-stone-400" />
          </div>
          <div className="absolute bottom-0 right-0 w-[2.5mm] h-[2.5mm] pointer-events-none">
            <div className="absolute bottom-0 right-0 w-[2.5mm] h-[0.25mm] bg-stone-400" />
            <div className="absolute bottom-0 right-0 h-[2.5mm] w-[0.25mm] bg-stone-400" />
          </div>
        </>
      )}

      {/* Subtle Institutional Top Accent Bar (Professional Style Only) */}
      {style === 'professional' && (
        <div className="absolute top-0 inset-x-0 h-[0.8mm] bg-[#0F5A47]" />
      )}

      {/* ==================================================== */}
      {/* 1. TOP SECTION: Student Name & Optional Admission No */}
      {/* ==================================================== */}
      <div className="w-full text-center shrink-0 pt-[0.5mm]">
        {/* Student Full Name with safe wrapping and font scaling */}
        <h4
          className={`font-bold text-[#0F172A] leading-tight tracking-tight line-clamp-1 ${
            style === 'compact'
              ? 'text-[2.2mm]'
              : style === 'minimal'
              ? 'text-[2.6mm]'
              : 'text-[2.5mm]'
          }`}
          title={student.fullName}
        >
          {student.fullName}
        </h4>

        {/* Optional Admission Number */}
        {showAdmissionNo && (
          <div className="flex items-center justify-center gap-[1.5mm] mt-[0.3mm]">
            <span
              className={`font-mono font-semibold text-stone-500 uppercase ${
                style === 'compact' ? 'text-[1.5mm]' : 'text-[1.7mm]'
              }`}
            >
              {student.admissionNo}
            </span>
            {student.className && style !== 'compact' && (
              <>
                <span className="text-stone-300 text-[1.5mm]">•</span>
                <span className="text-stone-500 text-[1.6mm] font-medium truncate max-w-[20mm]">
                  {student.className}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* ==================================================== */}
      {/* 2. CENTER SECTION: Credential Zone (QR / Barcode) */}
      {/* ==================================================== */}
      <div className="w-full flex-1 flex flex-col items-center justify-center my-[0.5mm] overflow-hidden">
        {credentialMode === 'qr_only' && (
          /* Mode A: QR Code Only */
          <div className="flex items-center justify-center p-[0.5mm] bg-white rounded-xs">
            <StudentQrCode
              token={tokenInfo.rawToken}
              tokenHint={tokenInfo.tokenHint}
              sizeMm={qrSizeMm}
            />
          </div>
        )}

        {credentialMode === 'barcode_only' && (
          /* Mode B: Code128 Barcode Only */
          <div className="w-full flex flex-col items-center justify-center px-[1mm]">
            <StudentBarcode
              admissionNo={student.admissionNo}
              barWidth={style === 'compact' ? 1.0 : 1.2}
              heightPx={style === 'compact' ? 18 : 24}
              className="w-full"
            />
            {/* Monospace Human-Readable text below barcode */}
            <span className="font-mono text-[1.8mm] font-semibold tracking-wider text-stone-700 mt-[0.3mm]">
              *{student.admissionNo}*
            </span>
          </div>
        )}

        {credentialMode === 'qr_and_barcode' && (
          /* Mode C: QR Code (Primary) + Barcode (Secondary) */
          <div className="w-full flex flex-col items-center justify-center gap-[0.8mm]">
            <div className="flex items-center justify-center bg-white p-[0.3mm]">
              <StudentQrCode
                token={tokenInfo.rawToken}
                tokenHint={tokenInfo.tokenHint}
                sizeMm={qrSizeMm}
              />
            </div>
            <div className="w-full max-w-[90%] flex flex-col items-center">
              <StudentBarcode
                admissionNo={student.admissionNo}
                barWidth={0.9}
                heightPx={14}
                className="w-full"
              />
            </div>
          </div>
        )}
      </div>

      {/* ==================================================== */}
      {/* 3. BOTTOM SECTION: Optional Institution / Identifier */}
      {/* ==================================================== */}
      {showInstitution && (
        <div className="w-full text-center shrink-0 border-t border-stone-100 pt-[0.4mm]">
          <span
            className={`font-semibold uppercase tracking-wider text-stone-400 block truncate ${
              style === 'compact' ? 'text-[1.2mm]' : 'text-[1.4mm]'
            }`}
          >
            {madrasaName}
          </span>
        </div>
      )}
    </div>
  );
};

export default StudentCredentialLabel;
