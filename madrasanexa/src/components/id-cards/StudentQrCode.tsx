import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { QrCode, ShieldAlert, Loader2 } from 'lucide-react';

export interface StudentQrCodeProps {
  token?: string | null;
  tokenHint?: string | null;
  sizeMm?: number;
  className?: string;
}

/** Canonical 37-character token format regex: MNX1_ + 32 lowercase hexadecimal chars */
const CANONICAL_TOKEN_REGEX = /^MNX1_[0-9a-f]{32}$/;

/**
 * StudentQrCode - Standards-compliant client-side QR code generator.
 *
 * Requirements:
 * - Encodes only the canonical scan token (MNX1_<32hex>).
 * - Adheres to QR Version 3-M (29x29 matrix, Error Correction Level M, 15% recovery).
 * - Vector SVG rendering for crisp, zero-distortion physical card printing.
 * - Fits within the exact CR80 physical card QR optical zone (25.0mm x 25.0mm).
 * - Never logs or leaks raw tokens in error messages or DOM strings.
 */
export const StudentQrCode: React.FC<StudentQrCodeProps> = ({
  token,
  tokenHint,
  sizeMm = 23.4,
  className = '',
}) => {
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<'NONE' | 'INVALID_FORMAT' | 'RENDER_ERROR'>('NONE');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // 1. Missing or pending token
    if (!token) {
      setSvgContent(null);
      setErrorStatus('NONE');
      return;
    }

    const trimmedToken = token.trim();

    // 2. Strict canonical format validation before encoding
    if (!CANONICAL_TOKEN_REGEX.test(trimmedToken)) {
      setSvgContent(null);
      setErrorStatus('INVALID_FORMAT');
      return;
    }

    // 3. Generate standards-compliant Version 3-M SVG
    setIsLoading(true);
    setErrorStatus('NONE');

    QRCode.toString(trimmedToken, {
      type: 'svg',
      version: 3,
      errorCorrectionLevel: 'M',
      margin: 0,
      color: {
        dark: '#0F172A',
        light: '#FFFFFF',
      },
    })
      .then((svg) => {
        setSvgContent(svg);
        setErrorStatus('NONE');
      })
      .catch(() => {
        setSvgContent(null);
        setErrorStatus('RENDER_ERROR');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [token]);

  // Loading state
  if (isLoading) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-stone-50 text-stone-400 ${className}`}
        style={{ width: `${sizeMm}mm`, height: `${sizeMm}mm` }}
        aria-label="Generating secure QR code"
      >
        <Loader2 className="w-5 h-5 animate-spin text-[#0F5A47]" />
        <span className="text-[1.3mm] font-semibold text-stone-500 mt-[1mm]">
          Generating QR...
        </span>
      </div>
    );
  }

  // Invalid token format state (Never reveals raw token in UI)
  if (errorStatus === 'INVALID_FORMAT') {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-rose-50 border border-rose-200 rounded-[1.5mm] text-rose-700 p-1 text-center select-none ${className}`}
        style={{ width: `${sizeMm}mm`, height: `${sizeMm}mm` }}
        title="Token does not match canonical 37-character format"
      >
        <ShieldAlert className="w-5 h-5 text-rose-500 mb-[0.6mm]" />
        <span className="text-[1.4mm] font-bold leading-tight uppercase">
          Invalid Token
        </span>
        <span className="text-[1.2mm] text-rose-600/80 leading-tight mt-[0.3mm]">
          Format Mismatch
        </span>
      </div>
    );
  }

  // Render failure fallback
  if (errorStatus === 'RENDER_ERROR') {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-amber-50 border border-amber-200 rounded-[1.5mm] text-amber-700 p-1 text-center select-none ${className}`}
        style={{ width: `${sizeMm}mm`, height: `${sizeMm}mm` }}
      >
        <ShieldAlert className="w-5 h-5 text-amber-500 mb-[0.6mm]" />
        <span className="text-[1.4mm] font-bold leading-tight">
          Encoding Failed
        </span>
      </div>
    );
  }

  // Valid rendered vector QR code
  if (svgContent) {
    return (
      <div
        className={`relative flex items-center justify-center bg-white select-none ${className}`}
        style={{ width: `${sizeMm}mm`, height: `${sizeMm}mm` }}
        data-qr-version="3-M"
        data-qr-dimension="29x29"
        title="Cryptographic QR Attendance Token (Version 3-M)"
      >
        <div
          className="w-full h-full flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:block"
          dangerouslySetInnerHTML={{ __html: svgContent }}
        />
      </div>
    );
  }

  // Fallback: Token unavailable / pending issuance
  return (
    <div
      className={`flex flex-col items-center justify-center bg-stone-50 border border-dashed border-stone-300 rounded-[1.5mm] text-stone-400 p-[1mm] select-none text-center ${className}`}
      style={{ width: `${sizeMm}mm`, height: `${sizeMm}mm` }}
    >
      <QrCode className="w-[8mm] h-[8mm] text-stone-400 stroke-[1.5]" />
      <span className="text-[1.4mm] font-bold text-[#0F5A47] uppercase tracking-wider mt-[0.8mm] leading-tight">
        Secure QR
      </span>
      <span className="text-[1.3mm] font-mono text-stone-400 leading-tight mt-[0.2mm]">
        {tokenHint ? tokenHint : 'Pending Issue'}
      </span>
    </div>
  );
};

export default StudentQrCode;
