import React from 'react';
import { Phone, Building2 } from 'lucide-react';
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
  tokenHint?: string | null;
  rawToken?: string | null;
  className?: string;
}

/**
 * IdCardBack - ISO/IEC 7810 ID-1 (CR80) Standard Student ID Card Back Layout.
 *
 * Exact Physical Dimensions:
 * - Width: 85.60 mm (3.370 in)
 * - Height: 53.98 mm (2.125 in)
 * - Corner Radius: 3.18 mm (0.125 in)
 *
 * Credential Zones:
 * - Left: 25.0 mm x 25.0 mm vector QR code container encoding canonical scan token (ISO/IEC 18004 Version 3-M).
 * - Right: Code128 1D vector barcode container encoding student admission number.
 * - Bottom: Official return notice and madrasa institutional emergency contact.
 */
export const IdCardBack: React.FC<IdCardBackProps> = ({
  student,
  madrasaName,
  madrasaPhone,
  madrasaEmail,
  madrasaAddress: _madrasaAddress,
  tokenHint,
  rawToken,
  className = '',
}) => {
  return (
    <div
      className={`relative bg-white text-stone-900 overflow-hidden select-none border border-stone-200/90 shadow-sm print:shadow-none print:border-none ${className}`}
      style={{
        width: '85.60mm',
        height: '53.98mm',
        borderRadius: '3.18mm',
        boxSizing: 'border-box',
      }}
      data-card-side="back"
    >
      {/* Background Guilloche Security Texture */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `radial-gradient(circle at 50% 50%, #0F172A 1px, transparent 1px)`,
          backgroundSize: '4mm 4mm',
        }}
      />

      {/* Outer Card Container */}
      <div className="relative h-full flex flex-col justify-between p-[2.8mm]">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-[1.4mm] border-b border-stone-200/80">
          <div className="flex items-center gap-[1.5mm] min-w-0">
            <Building2 className="w-[3.6mm] h-[3.6mm] text-[#0F5A47] shrink-0" />
            <h3 className="text-[2.2mm] font-bold text-[#0F172A] truncate uppercase tracking-tight">
              {madrasaName}
            </h3>
          </div>
          <span className="text-[1.7mm] font-semibold text-stone-400 uppercase tracking-widest font-mono shrink-0">
            Official Badge
          </span>
        </div>

        {/* Center Section: Dual Credential Zone */}
        <div className="flex-1 flex items-center justify-between gap-[3mm] py-[1.2mm]">
          {/* Left: 2D QR Code Container (25mm x 25mm exact optical zone) */}
          <div
            className="w-[25.0mm] h-[25.0mm] shrink-0 bg-white border border-stone-200/90 rounded-[1.8mm] flex items-center justify-center p-[0.8mm] relative overflow-hidden shadow-2xs"
            style={{ boxSizing: 'border-box' }}
          >
            <StudentQrCode
              token={rawToken}
              tokenHint={tokenHint}
              sizeMm={23.4}
            />
          </div>

          {/* Right: 1D Code128 Barcode Container */}
          <div className="flex-1 min-w-0 flex flex-col justify-between h-[25.0mm] py-[0.5mm]">
            <div className="bg-white border border-stone-200/90 rounded-[1.8mm] px-[1mm] py-[0.8mm] flex flex-col items-center justify-center h-[17.5mm] shadow-2xs overflow-hidden">
              <StudentBarcode
                admissionNo={student.admissionNo}
                barWidth={1.3}
                heightPx={24}
              />
            </div>

            <div className="flex items-center justify-between text-[1.6mm] text-stone-500 pt-[0.8mm]">
              <span className="truncate">Auth: MadrasaNexa Gate F</span>
              <span className="font-mono text-[#0F5A47] font-semibold shrink-0">CR80 • ISO-7810</span>
            </div>
          </div>
        </div>

        {/* Bottom Notice & Institutional Contact */}
        <div className="pt-[1.4mm] border-t border-stone-200/80 flex flex-col justify-between gap-[0.8mm]">
          <p className="text-[1.6mm] text-stone-500 leading-[2.1mm] text-justify">
            This card is the property of <strong className="text-stone-700">{madrasaName}</strong>. It must be presented upon entry for digital attendance. If found, please return to the administration office.
          </p>

          <div className="flex items-center justify-between text-[1.6mm] text-stone-600 font-medium">
            <div className="flex items-center gap-[1mm] truncate">
              <Phone className="w-[2.2mm] h-[2.2mm] text-[#0F5A47] shrink-0" />
              <span className="truncate">
                Helpdesk: {madrasaPhone || madrasaEmail || 'Contact Madrasa Admin Office'}
              </span>
            </div>
            <span className="font-mono text-stone-400 shrink-0 text-[1.5mm]">
              Not Transferable
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IdCardBack;
