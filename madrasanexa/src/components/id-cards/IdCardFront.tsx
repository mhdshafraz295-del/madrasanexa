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
  className?: string;
}

/**
 * IdCardFront - ISO/IEC 7810 ID-1 (CR80) Standard Student ID Card Front Layout.
 *
 * Exact Physical Dimensions:
 * - Width: 85.60 mm (3.370 in)
 * - Height: 53.98 mm (2.125 in)
 * - Corner Radius: 3.18 mm (0.125 in)
 *
 * Privacy Invariants:
 * - Omits student home address, date of birth, guardian mobile phone, and blood group.
 * - Displays only verified institutional identity attributes.
 */
export const IdCardFront: React.FC<IdCardFrontProps> = ({
  student,
  madrasaName,
  madrasaCode,
  logoUrl,
  academicYear = '2025/2026',
  cardVersion = 1,
  issuedAt,
  className = '',
}) => {
  const [logoFailed, setLogoFailed] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);

  const initials = student.fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase() || 'ST';

  // Dynamic font sizing based on name character length to ensure graceful 2-line rendering
  const nameLength = (student.fullName || '').trim().length;
  const nameTypographyClass =
    nameLength > 32
      ? 'text-[2.2mm] leading-[2.6mm]'
      : nameLength > 22
      ? 'text-[2.5mm] leading-[2.9mm]'
      : 'text-[2.9mm] leading-[3.4mm]';

  const formattedIssueDate = issuedAt
    ? new Date(issuedAt).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
    : new Date().toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });

  return (
    <div
      className={`relative bg-white text-stone-900 overflow-hidden select-none border border-stone-200/90 shadow-sm print:shadow-none print:border-none ${className}`}
      style={{
        width: '85.60mm',
        height: '53.98mm',
        borderRadius: '3.18mm',
        boxSizing: 'border-box',
      }}
      data-card-side="front"
    >
      {/* Background Guilloche Security Accents */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.035]"
        style={{
          backgroundImage: `radial-gradient(circle at 50% 50%, #0F5A47 1px, transparent 1px)`,
          backgroundSize: '4mm 4mm',
        }}
      />
      <div className="absolute -right-8 -bottom-8 w-28 h-28 rounded-full bg-emerald-500/5 pointer-events-none" />
      <div className="absolute right-12 -top-10 w-24 h-24 rounded-full bg-[#0F5A47]/5 pointer-events-none" />

      {/* Outer Card Container */}
      <div className="relative h-full flex flex-col justify-between p-[2.8mm]">
        {/* Top Header Band */}
        <div className="flex items-center gap-[2.2mm] pb-[1.8mm] border-b border-stone-200/80">
          {/* Institution Logo */}
          <div className="w-[8.5mm] h-[8.5mm] shrink-0 flex items-center justify-center bg-stone-50 rounded-[1.2mm] overflow-hidden border border-stone-200/60">
            {logoUrl && !logoFailed ? (
              <img
                src={logoUrl}
                alt={madrasaName}
                onError={() => setLogoFailed(true)}
                className="w-full h-full object-contain p-[0.3mm]"
              />
            ) : (
              <Building2 className="w-[5.2mm] h-[5.2mm] text-[#0F5A47]" />
            )}
          </div>

          {/* Institution Title & Subtitle */}
          <div className="flex-1 min-w-0 pr-1">
            <h1 className="text-[2.8mm] font-extrabold text-[#0F172A] leading-[3.2mm] truncate tracking-tight uppercase">
              {madrasaName}
            </h1>
            <div className="flex items-center justify-between gap-1 mt-[0.3mm]">
              <span className="text-[1.8mm] font-bold text-[#0F5A47] tracking-wider uppercase">
                Student Identity Card
              </span>
              <span className="text-[1.7mm] font-semibold text-stone-500 font-mono">
                {academicYear}
              </span>
            </div>
          </div>
        </div>

        {/* Center Card Body: Photo & Credentials */}
        <div className="flex-1 flex items-center gap-[3.0mm] py-[1.5mm]">
          {/* Student Photo */}
          <div
            className="w-[21.5mm] h-[27.0mm] shrink-0 rounded-[1.8mm] bg-stone-100 border border-stone-300 overflow-hidden flex flex-col items-center justify-center shadow-xs relative"
            style={{ boxSizing: 'border-box' }}
          >
            {student.photoFileId && !photoFailed ? (
              <img
                src={student.photoFileId}
                alt={student.fullName}
                onError={() => setPhotoFailed(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-stone-100 to-stone-200 text-stone-400 p-1">
                <div className="w-[9mm] h-[9mm] rounded-full bg-[#0F172A] text-emerald-400 font-bold text-[3.2mm] flex items-center justify-center mb-[1mm] shadow-xs">
                  {initials}
                </div>
                <User className="w-[3.5mm] h-[3.5mm] text-stone-400" />
              </div>
            )}
            <div className="absolute bottom-0 inset-x-0 h-[1.2mm] bg-[#0F5A47]" />
          </div>

          {/* Student Identity Information */}
          <div className="flex-1 min-w-0 flex flex-col justify-between h-[27.0mm] py-[0.5mm]">
            <div>
              <span className="text-[1.6mm] font-bold tracking-wider uppercase text-stone-400 block leading-tight">
                Student Name
              </span>
              <h2 className={`${nameTypographyClass} font-bold text-[#0F172A] line-clamp-2 tracking-tight mt-[0.2mm] break-words`}>
                {student.fullName}
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-x-[2mm] gap-y-[0.8mm] mt-[0.5mm]">
              <div>
                <span className="text-[1.6mm] font-bold tracking-wider uppercase text-stone-400 block leading-tight">
                  Admission No
                </span>
                <span className="text-[2.2mm] font-mono font-bold text-[#0F5A47] leading-tight block">
                  {student.admissionNo}
                </span>
              </div>

              <div>
                <span className="text-[1.6mm] font-bold tracking-wider uppercase text-stone-400 block leading-tight">
                  Class / Section
                </span>
                <span className="text-[2.2mm] font-semibold text-stone-800 leading-tight block truncate">
                  {student.className || 'General'}
                </span>
              </div>

              <div>
                <span className="text-[1.6mm] font-bold tracking-wider uppercase text-stone-400 block leading-tight">
                  Issued
                </span>
                <span className="text-[1.9mm] font-medium text-stone-600 leading-tight block font-mono">
                  {formattedIssueDate}
                </span>
              </div>

              <div>
                <span className="text-[1.6mm] font-bold tracking-wider uppercase text-stone-400 block leading-tight">
                  Card Ver
                </span>
                <span className="text-[1.9mm] font-mono text-stone-500 leading-tight block">
                  v{cardVersion}.0
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Security Footer Stripe */}
        <div className="flex items-center justify-between pt-[1.2mm] border-t border-stone-200/80 text-[1.6mm] text-stone-500">
          <div className="flex items-center gap-[1mm] text-[#0F5A47] font-semibold">
            <ShieldCheck className="w-[2.4mm] h-[2.4mm]" />
            <span>MadrasaNexa Verified Card</span>
          </div>
          <span className="font-mono text-stone-400 tracking-wider">
            {madrasaCode ? `ID: ${madrasaCode}-${student.admissionNo}` : `ID: ${student.admissionNo}`}
          </span>
        </div>
      </div>
    </div>
  );
};

export default IdCardFront;
