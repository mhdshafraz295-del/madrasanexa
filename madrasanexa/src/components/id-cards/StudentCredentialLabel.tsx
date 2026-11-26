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
      className={`student-credential-label credential-label-card relative bg-white text-stone-900 overflow-hidden box-border select-none flex flex-col justify-between ${getBorderClasses()} ${className}`}
      data-label-card="true"
      style={{
        width: `${widthMm}mm`,
        height: `${heightMm}mm`,
        padding: style === 'compact' ? '1.5mm' : '2.5mm',
        boxSizing: 'border-box',
        backgroundColor: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        overflow: 'hidden',
      }}
      data-student-id={student.id}
      data-admission-no={student.admissionNo}
    >
      {/* Optional Corner Cutting Marks (for 'corners' guide mode) */}
      {cuttingGuide === 'corners' && (
        <>
          <div className="absolute top-0 left-0 w-[2.5mm] h-[2.5mm] pointer-events-none" style={{ position: 'absolute', top: 0, left: 0, width: '2.5mm', height: '2.5mm' }}>
            <div className="absolute top-0 left-0 w-[2.5mm] h-[0.25mm] bg-stone-400" style={{ position: 'absolute', top: 0, left: 0, width: '2.5mm', height: '0.25mm', backgroundColor: '#94a3b8' }} />
            <div className="absolute top-0 left-0 h-[2.5mm] w-[0.25mm] bg-stone-400" style={{ position: 'absolute', top: 0, left: 0, height: '2.5mm', width: '0.25mm', backgroundColor: '#94a3b8' }} />
          </div>
          <div className="absolute top-0 right-0 w-[2.5mm] h-[2.5mm] pointer-events-none" style={{ position: 'absolute', top: 0, right: 0, width: '2.5mm', height: '2.5mm' }}>
            <div className="absolute top-0 right-0 w-[2.5mm] h-[0.25mm] bg-stone-400" style={{ position: 'absolute', top: 0, right: 0, width: '2.5mm', height: '0.25mm', backgroundColor: '#94a3b8' }} />
            <div className="absolute top-0 right-0 h-[2.5mm] w-[0.25mm] bg-stone-400" style={{ position: 'absolute', top: 0, right: 0, height: '2.5mm', width: '0.25mm', backgroundColor: '#94a3b8' }} />
          </div>
          <div className="absolute bottom-0 left-0 w-[2.5mm] h-[2.5mm] pointer-events-none" style={{ position: 'absolute', bottom: 0, left: 0, width: '2.5mm', height: '2.5mm' }}>
            <div className="absolute bottom-0 left-0 w-[2.5mm] h-[0.25mm] bg-stone-400" style={{ position: 'absolute', bottom: 0, left: 0, width: '2.5mm', height: '0.25mm', backgroundColor: '#94a3b8' }} />
            <div className="absolute bottom-0 left-0 h-[2.5mm] w-[0.25mm] bg-stone-400" style={{ position: 'absolute', bottom: 0, left: 0, height: '2.5mm', width: '0.25mm', backgroundColor: '#94a3b8' }} />
          </div>
          <div className="absolute bottom-0 right-0 w-[2.5mm] h-[2.5mm] pointer-events-none" style={{ position: 'absolute', bottom: 0, right: 0, width: '2.5mm', height: '2.5mm' }}>
            <div className="absolute bottom-0 right-0 w-[2.5mm] h-[0.25mm] bg-stone-400" style={{ position: 'absolute', bottom: 0, right: 0, width: '2.5mm', height: '0.25mm', backgroundColor: '#94a3b8' }} />
            <div className="absolute bottom-0 right-0 h-[2.5mm] w-[0.25mm] bg-stone-400" style={{ position: 'absolute', bottom: 0, right: 0, height: '2.5mm', width: '0.25mm', backgroundColor: '#94a3b8' }} />
          </div>
        </>
      )}

      {/* Subtle Institutional Top Accent Bar (Professional Style Only) */}
      {style === 'professional' && (
        <div className="absolute top-0 inset-x-0 h-[0.8mm] bg-[#0F5A47]" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '0.8mm', backgroundColor: '#0F5A47' }} />
      )}

      {/* ==================================================== */}
      {/* 1. TOP SECTION: Student Name & Optional Admission No */}
      {/* ==================================================== */}
      <div className="w-full text-center shrink-0 pt-[0.5mm]" style={{ width: '100%', textAlign: 'center', flexShrink: 0, paddingTop: '0.5mm' }}>
        {/* Student Full Name with safe wrapping and font scaling */}
        <h4
          className={`credential-label-student-name font-bold text-[#0F172A] leading-tight tracking-tight line-clamp-1 ${
            style === 'compact'
              ? 'text-[2.2mm]'
              : style === 'minimal'
              ? 'text-[2.6mm]'
              : 'text-[2.5mm]'
          }`}
          style={{
            fontSize: style === 'compact' ? '2.2mm' : style === 'minimal' ? '2.6mm' : '2.5mm',
            lineHeight: style === 'compact' ? '2.6mm' : style === 'minimal' ? '3.0mm' : '2.9mm',
            fontWeight: 700,
            color: '#0F172A',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={student.fullName}
        >
          {student.fullName}
        </h4>

        {/* Optional Admission Number */}
        {showAdmissionNo && (
          <div className="flex items-center justify-center gap-[1.5mm] mt-[0.3mm]" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.5mm', marginTop: '0.3mm' }}>
            <span
              className={`font-mono font-semibold text-stone-500 uppercase ${
                style === 'compact' ? 'text-[1.5mm]' : 'text-[1.7mm]'
              }`}
              style={{
                fontSize: style === 'compact' ? '1.5mm' : '1.7mm',
                fontFamily: 'monospace',
                fontWeight: 600,
                color: '#64748b',
                textTransform: 'uppercase',
              }}
            >
              {student.admissionNo}
            </span>
            {student.className && style !== 'compact' && (
              <>
                <span className="text-stone-300 text-[1.5mm]" style={{ color: '#cbd5e1', fontSize: '1.5mm' }}>•</span>
                <span className="text-stone-500 text-[1.6mm] font-medium truncate max-w-[20mm]" style={{ color: '#64748b', fontSize: '1.6mm', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '20mm' }}>
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
      <div className="w-full flex-1 flex flex-col items-center justify-center my-[0.5mm] overflow-hidden" style={{ width: '100%', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: '0.5mm 0', overflow: 'hidden' }}>
        {credentialMode === 'qr_only' && (
          /* Mode A: QR Code Only */
          <div className="flex items-center justify-center p-[0.5mm] bg-white rounded-xs" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.5mm', backgroundColor: '#ffffff' }}>
            <StudentQrCode
              token={tokenInfo.rawToken}
              tokenHint={tokenInfo.tokenHint}
              sizeMm={qrSizeMm}
            />
          </div>
        )}

        {credentialMode === 'barcode_only' && (
          /* Mode B: Code128 Barcode Only */
          <div className="w-full flex flex-col items-center justify-center px-[1mm]" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 1mm' }}>
            <StudentBarcode
              admissionNo={student.admissionNo}
              barWidth={style === 'compact' ? 1.0 : 1.2}
              heightPx={style === 'compact' ? 18 : 24}
              className="w-full"
            />
            {/* Monospace Human-Readable text below barcode */}
            <span className="font-mono text-[1.8mm] font-semibold tracking-wider text-stone-700 mt-[0.3mm]" style={{ fontFamily: 'monospace', fontSize: '1.8mm', fontWeight: 600, color: '#334155', marginTop: '0.3mm' }}>
              *{student.admissionNo}*
            </span>
          </div>
        )}

        {credentialMode === 'qr_and_barcode' && (
          /* Mode C: QR Code (Primary) + Barcode (Secondary) */
          <div className="w-full flex flex-col items-center justify-center gap-[0.8mm]" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.8mm' }}>
            <div className="flex items-center justify-center bg-white p-[0.3mm]" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', padding: '0.3mm' }}>
              <StudentQrCode
                token={tokenInfo.rawToken}
                tokenHint={tokenInfo.tokenHint}
                sizeMm={qrSizeMm}
              />
            </div>
            <div className="w-full max-w-[90%] flex flex-col items-center" style={{ width: '100%', maxWidth: '90%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
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
        <div className="w-full text-center shrink-0 border-t border-stone-100 pt-[0.4mm]" style={{ width: '100%', textAlign: 'center', flexShrink: 0, borderTop: '1px solid #f1f5f9', paddingTop: '0.4mm' }}>
          <span
            className={`font-semibold uppercase tracking-wider text-stone-400 block truncate ${
              style === 'compact' ? 'text-[1.2mm]' : 'text-[1.4mm]'
            }`}
            style={{
              fontSize: style === 'compact' ? '1.2mm' : '1.4mm',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: '#94a3b8',
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {madrasaName}
          </span>
        </div>
      )}
    </div>
  );
};

export default StudentCredentialLabel;
