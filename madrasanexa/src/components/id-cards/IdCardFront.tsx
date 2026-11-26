import React, { useState } from 'react';
import { Building2, User, ShieldCheck } from 'lucide-react';

export interface IdCardFrontProps {
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
  academicYear?: string;
  cardVersion?: number;
  issuedAt?: string | null;
  orientation?: 'vertical' | 'horizontal';
  localPhotoUrl?: string | null;
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
 * IdCardFront - ISO/IEC 7810 ID-1 (CR80) Student ID Card Front Layout.
 *
 * Supports Dual Orientation Modes:
 * 1. Vertical Portrait (Lanyard Style): 53.98 mm W × 85.60 mm H (Default)
 * 2. Horizontal Landscape (Classic CR80): 85.60 mm W × 53.98 mm H
 *
 * Luxury Theme:
 * - Deep Emerald Forest Green (#193B32, gradient #133129 to #1E463B)
 * - Warm Antique Gold (#C5A059 / #D4AF37)
 * - Crisp Off-White (#F6F6F3) lower typography section
 * - Rub el Hizb (۞) 8-point geometric star accents
 */
export const IdCardFront: React.FC<IdCardFrontProps> = ({
  student,
  madrasaName,
  madrasaCode,
  logoUrl,
  academicYear = '2025/2026',
  cardVersion = 1,
  issuedAt,
  orientation = 'horizontal',
  localPhotoUrl,
  className = '',
}) => {
  const [logoFailed, setLogoFailed] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);

  // Active photo: prioritize memory-only print photo, then saved photoFileId
  const activePhoto = localPhotoUrl || student.photoFileId;

  const initials =
    student.fullName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0])
      .join('')
      .toUpperCase() || 'ST';

  const nameLength = (student.fullName || '').trim().length;

  const formattedIssueDate = issuedAt
    ? new Date(issuedAt).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
    : new Date().toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });

  // -------------------------------------------------------------
  // 1. VERTICAL PORTRAIT MODE (53.98mm × 85.60mm)
  // -------------------------------------------------------------
  if (orientation === 'vertical') {
    const verticalNameFontSize =
      nameLength > 30 ? '2.1mm' : nameLength > 20 ? '2.4mm' : '2.7mm';
    const verticalNameLineHeight =
      nameLength > 30 ? '2.5mm' : nameLength > 20 ? '2.8mm' : '3.2mm';

    return (
      <div
        className={`id-card-face relative overflow-hidden select-none border border-stone-300 shadow-sm print:shadow-none print:border-none ${className}`}
        style={{
          width: '53.98mm',
          height: '85.60mm',
          borderRadius: '3.18mm',
          boxSizing: 'border-box',
          backgroundColor: '#F6F6F3',
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
        }}
        data-card-side="front"
        data-card-orientation="vertical"
      >
        {/* UPPER ZONE: Deep Emerald Forest Green (#193B32 with gold lattice) */}
        <div
          className="relative flex flex-col items-center justify-between"
          style={{
            height: '47.5mm',
            padding: '2.4mm 2.4mm 1.6mm 2.4mm',
            background: 'linear-gradient(180deg, #133129 0%, #193B32 50%, #1E463B 100%)',
            boxSizing: 'border-box',
            position: 'relative',
          }}
        >
          {/* Subtle Islamic Lattice Security Overlay */}
          <div
            className="absolute inset-0 pointer-events-none opacity-20"
            style={{
              backgroundImage: ISLAMIC_STAR_PATTERN,
              backgroundSize: '4mm 4mm, 8mm 8mm, 8mm 8mm',
            }}
          />

          {/* Top Brand & Institution Header */}
          <div className="relative z-10 w-full flex items-center justify-between gap-[1.5mm]">
            {/* Institution Logo: Crisp Light-Mode White/Cream Badge */}
            <div
              className="shrink-0 flex items-center justify-center bg-white rounded-[1.4mm] overflow-hidden shadow-xs"
              style={{
                width: '7.8mm',
                height: '7.8mm',
                flexShrink: 0,
                backgroundColor: '#FFFFFF',
                border: '0.45mm solid #C5A059',
                padding: '0.4mm',
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
                <Building2 className="w-[4.4mm] h-[4.4mm] text-[#193B32]" />
              )}
            </div>

            {/* Title & Badge */}
            <div className="flex-1 min-w-0 text-left">
              <h1
                className="text-white font-extrabold uppercase truncate tracking-tight"
                style={{
                  fontSize: '2.1mm',
                  lineHeight: '2.5mm',
                  color: '#FFFFFF',
                  textShadow: '0 0.5px 1px rgba(0,0,0,0.4)',
                }}
              >
                {madrasaName}
              </h1>
              <div className="flex items-center gap-[1mm] mt-[0.3mm]">
                <span
                  className="font-bold tracking-wider uppercase font-mono"
                  style={{ fontSize: '1.4mm', color: '#C5A059', letterSpacing: '0.04em' }}
                >
                  Student Identity Card
                </span>
                <span
                  className="font-mono text-emerald-200"
                  style={{ fontSize: '1.3mm' }}
                >
                  • {academicYear}
                </span>
              </div>
            </div>

            {/* Rub el Hizb Emblem */}
            <RubElHizbEmblem sizeMm={3.6} color="#C5A059" innerColor="#133129" />
          </div>

          {/* Student Portrait Frame */}
          <div
            className="relative z-10 mt-[1.2mm] rounded-[2.0mm] overflow-hidden shadow-md flex items-center justify-center bg-stone-100"
            style={{
              width: '24.0mm',
              height: '29.5mm',
              border: '0.8mm solid #C5A059',
              boxSizing: 'border-box',
            }}
          >
            {activePhoto && !photoFailed ? (
              <img
                src={activePhoto}
                alt={student.fullName}
                onError={() => setPhotoFailed(true)}
                className="w-full h-full object-cover object-top"
                style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }}
              />
            ) : (
              <div
                className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-[#133129] to-[#1E463B] text-stone-200"
                style={{ width: '100%', height: '100%' }}
              >
                <div
                  className="w-[10mm] h-[10mm] rounded-full bg-[#193B32] border border-[#C5A059] text-[#C5A059] font-bold flex items-center justify-center shadow-xs mb-[1mm]"
                  style={{ fontSize: '3.6mm' }}
                >
                  {initials}
                </div>
                <User className="w-[3.2mm] h-[3.2mm] text-emerald-200/70" />
              </div>
            )}
            {/* Thin bottom gold trim inside frame */}
            <div
              className="absolute bottom-0 inset-x-0 h-[1mm]"
              style={{ backgroundColor: '#C5A059' }}
            />
          </div>

          {/* Gold Decorative Dividing Border */}
          <div
            className="absolute bottom-0 inset-x-0 h-[0.7mm]"
            style={{
              background: 'linear-gradient(90deg, #193B32 0%, #C5A059 50%, #193B32 100%)',
            }}
          />
        </div>

        {/* LOWER ZONE: Crisp Off-White (#F6F6F3) Typography */}
        <div
          className="relative flex flex-col justify-between"
          style={{
            height: '38.10mm',
            padding: '2.0mm 2.6mm 1.8mm 2.6mm',
            boxSizing: 'border-box',
            backgroundColor: '#F6F6F3',
          }}
        >
          {/* Student Full Name */}
          <div className="text-center pt-[0.2mm]">
            <span
              className="font-bold uppercase tracking-wider block text-stone-400"
              style={{ fontSize: '1.4mm', letterSpacing: '0.06em', lineHeight: '1.8mm' }}
            >
              Full Student Name
            </span>
            <h2
              className="id-card-student-name font-extrabold text-[#0D251F] tracking-tight mt-[0.3mm] line-clamp-2"
              style={{
                fontSize: verticalNameFontSize,
                lineHeight: verticalNameLineHeight,
                color: '#0D251F',
                wordBreak: 'break-word',
              }}
            >
              {student.fullName}
            </h2>
          </div>

          {/* Information Grid: 2 Columns */}
          <div
            className="grid grid-cols-2 gap-x-[2mm] gap-y-[1.0mm] bg-white rounded-[1.8mm] p-[1.8mm] border border-stone-200/90 shadow-2xs mt-[1mm]"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: '1.0mm 2.0mm',
              padding: '1.8mm',
            }}
          >
            {/* Admission No */}
            <div>
              <span
                className="font-bold uppercase tracking-wider text-stone-400 block"
                style={{ fontSize: '1.4mm', lineHeight: '1.8mm' }}
              >
                Admission No
              </span>
              <span
                className="font-mono font-extrabold block truncate"
                style={{ fontSize: '2.2mm', color: '#9A7B38', lineHeight: '2.6mm' }}
              >
                {student.admissionNo}
              </span>
            </div>

            {/* Class / Section */}
            <div>
              <span
                className="font-bold uppercase tracking-wider text-stone-400 block"
                style={{ fontSize: '1.4mm', lineHeight: '1.8mm' }}
              >
                Class / Section
              </span>
              <span
                className="font-bold text-[#193B32] block truncate"
                style={{ fontSize: '2.0mm', lineHeight: '2.6mm' }}
              >
                {student.className || 'General'}
              </span>
            </div>

            {/* Issued Date */}
            <div>
              <span
                className="font-bold uppercase tracking-wider text-stone-400 block"
                style={{ fontSize: '1.4mm', lineHeight: '1.8mm' }}
              >
                Issued Date
              </span>
              <span
                className="font-mono text-stone-600 block"
                style={{ fontSize: '1.7mm', lineHeight: '2.1mm' }}
              >
                {formattedIssueDate}
              </span>
            </div>

            {/* Card Version */}
            <div>
              <span
                className="font-bold uppercase tracking-wider text-stone-400 block"
                style={{ fontSize: '1.4mm', lineHeight: '1.8mm' }}
              >
                Card Version
              </span>
              <span
                className="font-mono text-stone-600 font-semibold block"
                style={{ fontSize: '1.7mm', lineHeight: '2.1mm' }}
              >
                v{cardVersion}.0
              </span>
            </div>
          </div>

          {/* Bottom Security Footer Stripe */}
          <div
            className="flex items-center justify-between pt-[1.2mm] border-t border-stone-200/90"
            style={{
              paddingTop: '1.2mm',
              borderTop: '1px solid #E2DFD2',
            }}
          >
            <div
              className="flex items-center gap-[1mm] font-semibold"
              style={{ fontSize: '1.5mm', color: '#193B32' }}
            >
              <ShieldCheck className="w-[2.4mm] h-[2.4mm] text-[#C5A059]" />
              <span>MadrasaNexa Verified Card</span>
            </div>
            <span
              className="font-mono text-stone-400"
              style={{ fontSize: '1.4mm' }}
            >
              {madrasaCode ? `${madrasaCode}-${student.admissionNo}` : student.admissionNo}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // 2. HORIZONTAL LANDSCAPE MODE (85.60mm × 53.98mm)
  // -------------------------------------------------------------
  const horizontalNameFontSize =
    nameLength > 32 ? '2.2mm' : nameLength > 22 ? '2.5mm' : '2.8mm';
  const horizontalNameLineHeight =
    nameLength > 32 ? '2.6mm' : nameLength > 22 ? '2.9mm' : '3.3mm';

  return (
    <div
      className={`id-card-face relative overflow-hidden select-none border border-stone-300 shadow-sm print:shadow-none print:border-none ${className}`}
      style={{
        width: '85.60mm',
        height: '53.98mm',
        borderRadius: '3.18mm',
        boxSizing: 'border-box',
        backgroundColor: '#F6F6F3',
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
      }}
      data-card-side="front"
      data-card-orientation="horizontal"
    >
      {/* Outer Card Container */}
      <div
        className="relative h-full flex flex-col justify-between"
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          boxSizing: 'border-box',
        }}
      >
        {/* TOP HEADER BAND: Deep Emerald (#193B32 with Gold Accents) */}
        <div
          className="relative px-[2.8mm] py-[1.8mm] flex items-center justify-between gap-[2mm]"
          style={{
            background: 'linear-gradient(90deg, #133129 0%, #193B32 60%, #1E463B 100%)',
            borderBottom: '0.6mm solid #C5A059',
            boxSizing: 'border-box',
          }}
        >
          {/* Subtle Islamic Lattice Background */}
          <div
            className="absolute inset-0 pointer-events-none opacity-15"
            style={{
              backgroundImage: ISLAMIC_STAR_PATTERN,
              backgroundSize: '4mm 4mm, 8mm 8mm, 8mm 8mm',
            }}
          />

          <div className="relative z-10 flex items-center gap-[2mm] min-w-0 flex-1">
            {/* Institution Logo: Crisp Light-Mode White/Cream Badge */}
            <div
              className="shrink-0 flex items-center justify-center bg-white rounded-[1.4mm] overflow-hidden shadow-xs"
              style={{
                width: '8.4mm',
                height: '8.4mm',
                flexShrink: 0,
                backgroundColor: '#FFFFFF',
                border: '0.45mm solid #C5A059',
                padding: '0.4mm',
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
                <Building2 className="w-[5.2mm] h-[5.2mm] text-[#193B32]" />
              )}
            </div>

            {/* Institution Title */}
            <div className="flex-1 min-w-0 pr-1">
              <h1
                className="text-white font-extrabold uppercase truncate tracking-tight"
                style={{
                  fontSize: '2.7mm',
                  lineHeight: '3.1mm',
                  color: '#FFFFFF',
                  textShadow: '0 0.5px 1px rgba(0,0,0,0.3)',
                }}
              >
                {madrasaName}
              </h1>
              <div className="flex items-center justify-between gap-1 mt-[0.3mm]">
                <span
                  className="font-bold tracking-wider uppercase font-mono"
                  style={{ fontSize: '1.6mm', color: '#C5A059', letterSpacing: '0.04em' }}
                >
                  Student Identity Card
                </span>
                <span
                  className="font-mono text-emerald-200"
                  style={{ fontSize: '1.5mm' }}
                >
                  {academicYear}
                </span>
              </div>
            </div>
          </div>

          {/* Right Emblem */}
          <div className="relative z-10 shrink-0">
            <RubElHizbEmblem sizeMm={4.2} color="#C5A059" innerColor="#133129" />
          </div>
        </div>

        {/* CENTER BODY: Photo & Student Credentials on Crisp Off-White */}
        <div
          className="flex-1 flex items-center gap-[3.2mm] px-[2.8mm] py-[1.6mm]"
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: '3.2mm',
            padding: '1.6mm 2.8mm',
            backgroundColor: '#F6F6F3',
          }}
        >
          {/* Student Photo Container */}
          <div
            className="rounded-[1.8mm] bg-stone-100 overflow-hidden flex flex-col items-center justify-center shadow-xs relative shrink-0"
            style={{
              width: '21.5mm',
              height: '27.0mm',
              flexShrink: 0,
              border: '0.7mm solid #C5A059',
              boxSizing: 'border-box',
            }}
          >
            {activePhoto && !photoFailed ? (
              <img
                src={activePhoto}
                alt={student.fullName}
                onError={() => setPhotoFailed(true)}
                className="w-full h-full object-cover object-top"
                style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }}
              />
            ) : (
              <div
                className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-[#133129] to-[#1E463B] text-stone-200 p-1"
                style={{ width: '100%', height: '100%' }}
              >
                <div
                  className="w-[9mm] h-[9mm] rounded-full bg-[#193B32] border border-[#C5A059] text-[#C5A059] font-bold text-[3.2mm] flex items-center justify-center mb-[1mm] shadow-xs"
                >
                  {initials}
                </div>
                <User className="w-[3.5mm] h-[3.5mm] text-emerald-200/70" />
              </div>
            )}
            <div
              className="absolute bottom-0 inset-x-0 h-[1.2mm]"
              style={{ backgroundColor: '#193B32' }}
            />
          </div>

          {/* Student Identity Information */}
          <div
            className="flex-1 min-w-0 flex flex-col justify-between h-[27.0mm] py-[0.4mm]"
            style={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              height: '27.0mm',
            }}
          >
            <div>
              <span
                className="text-[1.5mm] font-bold tracking-wider uppercase text-stone-400 block leading-tight"
                style={{ letterSpacing: '0.05em' }}
              >
                Student Name
              </span>
              <h2
                className="id-card-student-name font-extrabold text-[#0D251F] line-clamp-2 tracking-tight mt-[0.2mm] break-words"
                style={{
                  fontSize: horizontalNameFontSize,
                  lineHeight: horizontalNameLineHeight,
                  color: '#0D251F',
                }}
              >
                {student.fullName}
              </h2>
            </div>

            <div
              className="grid grid-cols-2 gap-x-[2.2mm] gap-y-[0.8mm] mt-[0.5mm] bg-white rounded-[1.5mm] p-[1.5mm] border border-stone-200/80 shadow-2xs"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                columnGap: '2.2mm',
                rowGap: '0.8mm',
                padding: '1.5mm',
              }}
            >
              <div>
                <span
                  className="text-[1.4mm] font-bold tracking-wider uppercase text-stone-400 block leading-tight"
                >
                  Admission No
                </span>
                <span
                  className="text-[2.2mm] font-mono font-extrabold block leading-tight"
                  style={{ color: '#9A7B38' }}
                >
                  {student.admissionNo}
                </span>
              </div>

              <div>
                <span
                  className="text-[1.4mm] font-bold tracking-wider uppercase text-stone-400 block leading-tight"
                >
                  Class / Section
                </span>
                <span
                  className="text-[2.0mm] font-bold text-[#193B32] leading-tight block truncate"
                >
                  {student.className || 'General'}
                </span>
              </div>

              <div>
                <span
                  className="text-[1.4mm] font-bold tracking-wider uppercase text-stone-400 block leading-tight"
                >
                  Issued
                </span>
                <span
                  className="text-[1.8mm] font-mono font-medium text-stone-600 leading-tight block"
                >
                  {formattedIssueDate}
                </span>
              </div>

              <div>
                <span
                  className="text-[1.4mm] font-bold tracking-wider uppercase text-stone-400 block leading-tight"
                >
                  Card Ver
                </span>
                <span
                  className="text-[1.8mm] font-mono text-stone-600 font-semibold leading-tight block"
                >
                  v{cardVersion}.0
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM SECURITY FOOTER STRIPE */}
        <div
          className="flex items-center justify-between px-[2.8mm] py-[1.2mm] border-t border-[#E2DFD2] bg-[#FAF9F5] text-[1.6mm]"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1.2mm 2.8mm',
            borderTop: '1px solid #E2DFD2',
            backgroundColor: '#FAF9F5',
          }}
        >
          <div
            className="flex items-center gap-[1mm] font-semibold text-[#193B32]"
            style={{ display: 'flex', alignItems: 'center', gap: '1mm', color: '#193B32' }}
          >
            <ShieldCheck className="w-[2.4mm] h-[2.4mm] text-[#C5A059]" />
            <span>MadrasaNexa Verified Card</span>
          </div>
          <span
            className="font-mono text-stone-400 tracking-wider"
            style={{ fontFamily: 'monospace', letterSpacing: '0.04em' }}
          >
            {madrasaCode ? `ID: ${madrasaCode}-${student.admissionNo}` : `ID: ${student.admissionNo}`}
          </span>
        </div>
      </div>
    </div>
  );
};

export default IdCardFront;
