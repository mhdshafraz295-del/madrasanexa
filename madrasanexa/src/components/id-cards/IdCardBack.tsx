import React, { useState } from 'react';
import { Phone, Building2, Shield } from 'lucide-react';
import { StudentQrCode } from './StudentQrCode';
import { StudentBarcode } from './StudentBarcode';

export interface IdCardBackProps {
  student: {
    id: string;
    admissionNo: string;
    fullName: string;
    className?: string | null;
  };
  madrasaName: string;
  madrasaPhone?: string | null;
  madrasaEmail?: string | null;
  madrasaAddress?: string | null;
  logoUrl?: string | null;
  tokenHint?: string | null;
  rawToken?: string | null;
  credentialType?: 'both' | 'qr' | 'barcode';
  orientation?: 'vertical' | 'horizontal';
  className?: string;
}

/**
 * Rub el Hizb (۞) 8-point geometric star emblem SVG
 */
const RubElHizbEmblem: React.FC<{ sizeMm?: number; color?: string; innerColor?: string }> = ({
  sizeMm = 4,
  color = '#C5A059',
  innerColor = '#193B32',
}) => (
  <svg
    viewBox="0 0 24 24"
    style={{ width: `${sizeMm}mm`, height: `${sizeMm}mm`, flexShrink: 0 }}
    aria-hidden="true"
  >
    <polygon
      points="12,1.5 14.8,5.5 19.5,4.8 18.8,9.5 22.5,12 18.8,14.5 19.5,19.2 14.8,18.5 12,22.5 9.2,18.5 4.5,19.2 5.2,14.5 1.5,12 5.2,9.5 4.5,4.8 9.2,5.5"
      fill={color}
    />
    <circle cx="12" cy="12" r="3.2" fill="none" stroke={innerColor} strokeWidth="1.2" />
    <circle cx="12" cy="12" r="1.1" fill={innerColor} />
  </svg>
);

// High-fidelity Islamic geometric star lattice background pattern
const ISLAMIC_STAR_PATTERN = `radial-gradient(circle at 50% 50%, rgba(197, 160, 89, 0.18) 1px, transparent 1px), linear-gradient(45deg, rgba(197, 160, 89, 0.08) 25%, transparent 25%, transparent 75%, rgba(197, 160, 89, 0.08) 75%), linear-gradient(-45deg, rgba(197, 160, 89, 0.08) 25%, transparent 25%, transparent 75%, rgba(197, 160, 89, 0.08) 75%)`;

/**
 * IdCardBack - ISO/IEC 7810 ID-1 (CR80) Standard Student ID Card Back Layout.
 *
 * Supports Dual Orientation Modes:
 * 1. Vertical Portrait (Lanyard Style): 53.98 mm W × 85.60 mm H (Default)
 * 2. Horizontal Landscape (Classic CR80): 85.60 mm W × 53.98 mm H
 *
 * Full Deep Emerald Geometric Luxury Theme:
 * - Full Deep Emerald (#193B32, gradient #133129 to #1E463B)
 * - Subtle Antique Gold geometric star lattice
 * - Centered gold Rub el Hizb (۞) emblem
 * - High-contrast Pure White rounded container for optical scanners
 * - Institutional property & helpdesk emergency notice in gold & off-white typography
 */
export const IdCardBack: React.FC<IdCardBackProps> = ({
  student,
  madrasaName,
  madrasaPhone,
  madrasaEmail,
  madrasaAddress: _madrasaAddress,
  logoUrl,
  tokenHint,
  rawToken,
  credentialType = 'qr',
  orientation = 'horizontal',
  className = '',
}) => {
  const [logoFailed, setLogoFailed] = useState(false);

  // -------------------------------------------------------------
  // 1. VERTICAL PORTRAIT MODE (53.98mm × 85.60mm)
  // -------------------------------------------------------------
  if (orientation === 'vertical') {
    return (
      <div
        className={`relative overflow-hidden select-none border border-stone-300 shadow-sm print:shadow-none print:border-none ${className}`}
        style={{
          width: '53.98mm',
          height: '85.60mm',
          borderRadius: '3.18mm',
          boxSizing: 'border-box',
          background: 'linear-gradient(180deg, #133129 0%, #193B32 50%, #1E463B 100%)',
          color: '#F6F6F3',
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
        }}
        data-card-side="back"
        data-card-orientation="vertical"
      >
        {/* Subtle Islamic Lattice Background Overlay */}
        <div
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{
            backgroundImage: ISLAMIC_STAR_PATTERN,
            backgroundSize: '4mm 4mm, 8mm 8mm, 8mm 8mm',
          }}
        />

        {/* Outer Card Container */}
        <div
          className="relative z-10 h-full flex flex-col justify-between"
          style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '2.4mm',
            boxSizing: 'border-box',
          }}
        >
          {/* Top Header */}
          <div
            className="flex items-center justify-between pb-[1.4mm] border-b border-[#C5A059]/40"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: '1.4mm',
              borderBottom: '0.6mm solid rgba(197, 160, 89, 0.4)',
            }}
          >
            <div className="flex items-center gap-[1.5mm] min-w-0 flex-1">
              {/* Institution Logo: Crisp Light-Mode White/Cream Badge */}
              <div
                className="shrink-0 flex items-center justify-center bg-white rounded-[1.2mm] overflow-hidden shadow-xs"
                style={{
                  width: '5.8mm',
                  height: '5.8mm',
                  flexShrink: 0,
                  backgroundColor: '#FFFFFF',
                  border: '0.4mm solid #C5A059',
                  padding: '0.3mm',
                  boxSizing: 'border-box',
                }}
              >
                {logoUrl && !logoFailed ? (
                  <img
                    src={logoUrl}
                    alt={madrasaName}
                    onError={() => setLogoFailed(true)}
                    className="w-full h-full object-contain"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                ) : (
                  <Building2 className="w-[3.8mm] h-[3.8mm] text-[#193B32]" />
                )}
              </div>
              <div className="min-w-0">
                <h3
                  className="text-white font-extrabold uppercase truncate tracking-tight"
                  style={{
                    fontSize: '2.1mm',
                    lineHeight: '2.5mm',
                    color: '#FFFFFF',
                  }}
                >
                  {madrasaName}
                </h3>
                <span
                  className="font-bold tracking-widest uppercase block font-mono"
                  style={{ fontSize: '1.3mm', color: '#C5A059', letterSpacing: '0.05em' }}
                >
                  Official Student Badge
                </span>
              </div>
            </div>

            <RubElHizbEmblem sizeMm={3.6} color="#C5A059" innerColor="#133129" />
          </div>

          {/* Center Credential Zone: High-Contrast Pure White Rounded Container */}
          <div
            className="flex-1 flex flex-col items-center justify-center py-[2mm]"
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2mm 0',
            }}
          >
            {credentialType === 'qr' ? (
              /* Dedicated QR Code Center View */
              <div className="flex flex-col items-center justify-center gap-[1.5mm]">
                <div
                  className="bg-white rounded-[2.2mm] flex items-center justify-center p-[1mm] shadow-lg border border-[#C5A059]/60"
                  style={{
                    width: '30.0mm',
                    height: '30.0mm',
                    backgroundColor: '#FFFFFF',
                    borderRadius: '2.2mm',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '1mm',
                    boxSizing: 'border-box',
                  }}
                >
                  <StudentQrCode
                    token={rawToken}
                    tokenHint={tokenHint}
                    sizeMm={28}
                  />
                </div>

                <div
                  className="inline-flex items-center gap-[1mm] bg-[#133129]/90 border border-[#C5A059]/40 rounded-md px-[2mm] py-[0.5mm] mt-[0.5mm]"
                >
                  <Shield className="w-[2.2mm] h-[2.2mm] text-[#C5A059]" />
                  <span className="font-mono text-[#C5A059] font-bold" style={{ fontSize: '1.6mm' }}>
                    {tokenHint || 'MNX1_SECURE'}
                  </span>
                </div>

                <span
                  className="font-mono text-emerald-100/90 text-center"
                  style={{ fontSize: '1.5mm', letterSpacing: '0.02em' }}
                >
                  Secure Attendance • ISO/IEC 18004
                </span>
              </div>
            ) : credentialType === 'barcode' ? (
              /* Dedicated Barcode Center View */
              <div className="flex flex-col items-center justify-center w-full gap-[1.5mm]">
                <div
                  className="w-full bg-white rounded-[2.0mm] px-[2mm] py-[2mm] flex flex-col items-center justify-center shadow-lg border border-[#C5A059]/60"
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: '2.0mm',
                    padding: '2mm',
                    boxSizing: 'border-box',
                  }}
                >
                  <StudentBarcode
                    admissionNo={student.admissionNo}
                    barWidth={1.3}
                    heightPx={34}
                  />
                </div>

                <div className="flex items-center justify-between w-full px-1">
                  <span className="font-mono text-[#C5A059] font-semibold" style={{ fontSize: '1.5mm' }}>
                    Code128 Standard
                  </span>
                  <span className="font-mono text-emerald-100/80" style={{ fontSize: '1.5mm' }}>
                    ID: {student.admissionNo}
                  </span>
                </div>
              </div>
            ) : (
              /* Dual Mode: Both QR and Barcode */
              <div className="flex flex-col items-center justify-center w-full gap-[1.5mm]">
                <div
                  className="bg-white rounded-[2mm] flex items-center justify-center p-[0.8mm] shadow-lg border border-[#C5A059]/60"
                  style={{ width: '22mm', height: '22mm' }}
                >
                  <StudentQrCode
                    token={rawToken}
                    tokenHint={tokenHint}
                    sizeMm={20.4}
                  />
                </div>
                <div
                  className="w-full bg-white rounded-[1.8mm] px-[1.5mm] py-[1mm] flex flex-col items-center justify-center shadow-md border border-[#C5A059]/50"
                >
                  <StudentBarcode
                    admissionNo={student.admissionNo}
                    barWidth={1.2}
                    heightPx={20}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Bottom Property Notice & Institutional Contact */}
          <div
            className="pt-[1.4mm] border-t border-[#C5A059]/30 flex flex-col justify-between gap-[0.8mm]"
            style={{
              paddingTop: '1.4mm',
              borderTop: '0.6mm solid rgba(197, 160, 89, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.8mm',
            }}
          >
            <p
              className="text-[#E2DFD2] leading-[2.0mm] text-center"
              style={{ fontSize: '1.5mm', lineHeight: '2.0mm', color: '#E2DFD2' }}
            >
              This card is the property of <strong className="text-white">{madrasaName}</strong>. If found, please return to the administration office.
            </p>

            <div
              className="flex items-center justify-between font-medium pt-[0.4mm]"
              style={{ fontSize: '1.5mm' }}
            >
              <div className="flex items-center gap-[1mm] truncate">
                <Phone className="w-[2.2mm] h-[2.2mm] text-[#C5A059] shrink-0" />
                <span className="text-[#C5A059] truncate">
                  {madrasaPhone || madrasaEmail || 'Admin Office'}
                </span>
              </div>
              <span className="font-mono text-emerald-200/70 shrink-0">
                Not Transferable
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // 2. HORIZONTAL LANDSCAPE MODE (85.60mm × 53.98mm)
  // -------------------------------------------------------------
  return (
    <div
      className={`relative overflow-hidden select-none border border-stone-300 shadow-sm print:shadow-none print:border-none ${className}`}
      style={{
        width: '85.60mm',
        height: '53.98mm',
        borderRadius: '3.18mm',
        boxSizing: 'border-box',
        background: 'linear-gradient(135deg, #133129 0%, #193B32 50%, #1E463B 100%)',
        color: '#F6F6F3',
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
      }}
      data-card-side="back"
      data-card-orientation="horizontal"
    >
      {/* Subtle Islamic Lattice Background Overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: ISLAMIC_STAR_PATTERN,
          backgroundSize: '4mm 4mm, 8mm 8mm, 8mm 8mm',
        }}
      />

      {/* Outer Card Container */}
      <div
        className="relative z-10 h-full flex flex-col justify-between p-[2.8mm]"
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '2.8mm',
          boxSizing: 'border-box',
        }}
      >
        {/* Top Header */}
        <div
          className="flex items-center justify-between pb-[1.4mm] border-b border-[#C5A059]/40"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: '1.4mm',
            borderBottom: '0.6mm solid rgba(197, 160, 89, 0.4)',
          }}
        >
          <div className="flex items-center gap-[1.8mm] min-w-0" style={{ display: 'flex', alignItems: 'center', gap: '1.8mm', minWidth: 0 }}>
            {/* Institution Logo: Crisp Light-Mode White/Cream Badge */}
            <div
              className="shrink-0 flex items-center justify-center bg-white rounded-[1.2mm] overflow-hidden shadow-xs"
              style={{
                width: '6.0mm',
                height: '6.0mm',
                flexShrink: 0,
                backgroundColor: '#FFFFFF',
                border: '0.4mm solid #C5A059',
                padding: '0.3mm',
                boxSizing: 'border-box',
              }}
            >
              {logoUrl && !logoFailed ? (
                <img
                  src={logoUrl}
                  alt={madrasaName}
                  onError={() => setLogoFailed(true)}
                  className="w-full h-full object-contain"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              ) : (
                <Building2 className="w-[4mm] h-[4mm] text-[#193B32]" />
              )}
            </div>
            <h3
              className="text-white font-extrabold uppercase truncate tracking-tight"
              style={{ fontSize: '2.3mm', fontWeight: 700, color: '#FFFFFF', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {madrasaName}
            </h3>
          </div>
          <div className="flex items-center gap-[1.5mm] shrink-0">
            <span
              className="font-bold uppercase tracking-widest font-mono text-[#C5A059]"
              style={{ fontSize: '1.6mm', letterSpacing: '0.05em' }}
            >
              Official Badge
            </span>
            <RubElHizbEmblem sizeMm={3.6} color="#C5A059" innerColor="#133129" />
          </div>
        </div>

        {/* Center Section: Credential Zone with High-Contrast Pure White Rounded Container */}
        <div
          className="flex-1 flex items-center justify-center py-[1.2mm]"
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.2mm 0',
          }}
        >
          {credentialType === 'qr' ? (
            /* Dedicated QR Code Center View */
            <div className="flex items-center justify-center gap-[4.5mm] w-full" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4.5mm', width: '100%' }}>
              <div
                className="shrink-0 bg-white border border-[#C5A059]/60 rounded-[2.0mm] flex items-center justify-center p-[0.8mm] shadow-lg"
                style={{
                  width: '27.0mm',
                  height: '27.0mm',
                  flexShrink: 0,
                  backgroundColor: '#FFFFFF',
                  borderRadius: '2.0mm',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0.8mm',
                  boxSizing: 'border-box',
                }}
              >
                <StudentQrCode
                  token={rawToken}
                  tokenHint={tokenHint}
                  sizeMm={25.4}
                />
              </div>

              <div className="flex flex-col justify-center gap-[1.2mm] text-left">
                <span className="font-extrabold text-white tracking-tight" style={{ fontSize: '2.1mm' }}>
                  Secure Digital Attendance
                </span>
                <span className="text-emerald-100/90 font-mono" style={{ fontSize: '1.6mm' }}>
                  ISO/IEC 18004 • Version 3-M
                </span>
                <div
                  className="inline-flex items-center gap-[1.2mm] bg-[#133129] border border-[#C5A059]/40 rounded px-[2mm] py-[0.6mm] mt-[0.5mm]"
                >
                  <Shield className="w-[2.2mm] h-[2.2mm] text-[#C5A059]" />
                  <span className="text-emerald-200/90 font-semibold" style={{ fontSize: '1.5mm' }}>Token:</span>
                  <span className="font-mono text-[#C5A059] font-bold" style={{ fontSize: '1.5mm' }}>
                    {tokenHint || 'MNX1_SECURE'}
                  </span>
                </div>
              </div>
            </div>
          ) : credentialType === 'barcode' ? (
            /* Dedicated Barcode Center View */
            <div className="flex flex-col items-center justify-center w-full max-w-[70mm] gap-[1.5mm]">
              <div
                className="w-full bg-white rounded-[2.0mm] px-[2.5mm] py-[1.5mm] flex flex-col items-center justify-center shadow-lg border border-[#C5A059]/60 overflow-hidden"
              >
                <StudentBarcode
                  admissionNo={student.admissionNo}
                  barWidth={1.5}
                  heightPx={30}
                />
              </div>
              <div className="flex items-center justify-between w-full px-1 text-[1.6mm]">
                <span className="font-mono text-[#C5A059] font-semibold">Code128 Standard</span>
                <span className="text-emerald-100/80 font-mono">Student ID: {student.admissionNo}</span>
              </div>
            </div>
          ) : (
            /* Dual Mode (Both QR & Barcode) */
            <div className="flex items-center justify-between gap-[3mm] w-full">
              {/* Left: 2D QR Code Container */}
              <div
                className="shrink-0 bg-white border border-[#C5A059]/60 rounded-[1.8mm] flex items-center justify-center p-[0.8mm] shadow-lg"
                style={{ width: '25.0mm', height: '25.0mm' }}
              >
                <StudentQrCode
                  token={rawToken}
                  tokenHint={tokenHint}
                  sizeMm={23.4}
                />
              </div>

              {/* Right: 1D Code128 Barcode Container */}
              <div className="flex-1 min-w-0 flex flex-col justify-between h-[25.0mm] py-[0.4mm]">
                <div
                  className="bg-white rounded-[1.8mm] px-[1mm] py-[0.8mm] flex flex-col items-center justify-center h-[17.5mm] shadow-lg border border-[#C5A059]/50 overflow-hidden"
                >
                  <StudentBarcode
                    admissionNo={student.admissionNo}
                    barWidth={1.3}
                    heightPx={24}
                  />
                </div>

                <div className="flex items-center justify-between text-[1.6mm] pt-[0.8mm]">
                  <span className="text-emerald-100/80">Auth: MadrasaNexa</span>
                  <span className="font-mono text-[#C5A059] font-semibold">CR80 • ISO-7810</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Notice & Institutional Contact */}
        <div
          className="pt-[1.4mm] border-t border-[#C5A059]/30 flex flex-col justify-between gap-[0.8mm]"
          style={{
            paddingTop: '1.4mm',
            borderTop: '0.6mm solid rgba(197, 160, 89, 0.3)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '0.8mm',
          }}
        >
          <p className="text-[1.6mm] text-[#E2DFD2] leading-[2.1mm] text-justify">
            This card is the property of <strong className="text-white">{madrasaName}</strong>. It must be presented upon entry for digital attendance. If found, please return to the administration office.
          </p>

          <div className="flex items-center justify-between text-[1.6mm] font-medium">
            <div className="flex items-center gap-[1mm] truncate">
              <Phone className="w-[2.2mm] h-[2.2mm] text-[#C5A059] shrink-0" />
              <span className="text-[#C5A059] truncate">
                Helpdesk: {madrasaPhone || madrasaEmail || 'Contact Madrasa Admin Office'}
              </span>
            </div>
            <span className="font-mono text-emerald-200/70 shrink-0 text-[1.5mm]">
              Not Transferable
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IdCardBack;
