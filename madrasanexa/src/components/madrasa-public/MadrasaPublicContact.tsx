import React from 'react';
import { MapPin, Phone, Mail } from 'lucide-react';
import type { MadrasaThemeTokens } from '../../services/api';

interface MadrasaPublicContactProps {
  madrasaName?: string;
  address?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  theme: MadrasaThemeTokens;
}

export const MadrasaPublicContact: React.FC<MadrasaPublicContactProps> = ({
  address,
  contactPhone,
  contactEmail,
}) => {
  return (
    <section
      id="contact"
      className="scroll-mt-28 bg-white rounded-3xl p-6 sm:p-10 lg:p-12 border border-[#E5E0D5] shadow-xs relative overflow-hidden"
    >
      {/* Top Emerald/Gold Accent Strip */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#0B3B2C] via-[#C5A059] to-[#0B3B2C]" />

      {/* Section Header */}
      <div className="max-w-2xl mb-8 sm:mb-10">
        <div className="inline-flex items-center space-x-2 text-[11px] sm:text-xs font-bold uppercase tracking-wider mb-2.5 px-3.5 py-1.5 rounded-full bg-[#FAF8F3] border border-[#C5A059]/40 text-[#0B3B2C] shadow-2xs">
          <Phone className="w-3.5 h-3.5 text-[#C5A059]" />
          <span>Institutional Directory</span>
        </div>
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-bold tracking-tight mb-2 text-[#1C2826]">
          Contact & Campus Location
        </h2>
        <p className="text-xs sm:text-sm md:text-base text-slate-600 leading-relaxed">
          Official communication channels for parents, guardians, and prospective applicants.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-7">

        {/* Campus Address */}
        <div className="flex items-start space-x-4 p-5 sm:p-6 rounded-2xl bg-[#FDFCF9] border border-[#E5E0D5] shadow-2xs transition-all duration-300 hover:border-[#C5A059]/60 hover:shadow-md hover:-translate-y-1 group">
          <div className="w-11 h-11 rounded-xl bg-[#0B3B2C] border border-[#C5A059]/40 flex items-center justify-center text-[#DFC076] shrink-0 shadow-2xs transition-transform duration-300 group-hover:scale-105">
            <MapPin className="w-5 h-5 text-[#DFC076]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] sm:text-[11px] font-bold uppercase text-[#C5A059] tracking-wider mb-1">
              Campus Address
            </p>
            <p className="text-xs sm:text-sm text-[#1C2826] font-semibold leading-relaxed break-words">
              {address || 'Official campus address available upon inquiry.'}
            </p>
          </div>
        </div>

        {/* Official Telephone */}
        <div className="flex items-start space-x-4 p-5 sm:p-6 rounded-2xl bg-[#FDFCF9] border border-[#E5E0D5] shadow-2xs transition-all duration-300 hover:border-[#C5A059]/60 hover:shadow-md hover:-translate-y-1 group">
          <div className="w-11 h-11 rounded-xl bg-[#0B3B2C] border border-[#C5A059]/40 flex items-center justify-center text-[#DFC076] shrink-0 shadow-2xs transition-transform duration-300 group-hover:scale-105">
            <Phone className="w-5 h-5 text-[#DFC076]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] sm:text-[11px] font-bold uppercase text-[#C5A059] tracking-wider mb-1">
              Telephone Inquiries
            </p>
            {contactPhone ? (
              <a
                href={`tel:${contactPhone.replace(/\s+/g, '')}`}
                className="text-xs sm:text-sm font-bold text-[#0B3B2C] hover:text-[#C5A059] transition-colors block break-words"
              >
                {contactPhone}
              </a>
            ) : (
              <p className="text-xs sm:text-sm text-[#1C2826] font-semibold">Available via Admissions Desk</p>
            )}
            <p className="text-[11px] text-slate-500 mt-0.5">Administrative Office Hours</p>
          </div>
        </div>

        {/* Official Email */}
        <div className="flex items-start space-x-4 p-5 sm:p-6 rounded-2xl bg-[#FDFCF9] border border-[#E5E0D5] shadow-2xs transition-all duration-300 hover:border-[#C5A059]/60 hover:shadow-md hover:-translate-y-1 group">
          <div className="w-11 h-11 rounded-xl bg-[#0B3B2C] border border-[#C5A059]/40 flex items-center justify-center text-[#DFC076] shrink-0 shadow-2xs transition-transform duration-300 group-hover:scale-105">
            <Mail className="w-5 h-5 text-[#DFC076]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] sm:text-[11px] font-bold uppercase text-[#C5A059] tracking-wider mb-1">
              Electronic Mail
            </p>
            {contactEmail ? (
              <a
                href={`mailto:${contactEmail}`}
                className="text-xs sm:text-sm font-bold text-[#0B3B2C] hover:text-[#C5A059] transition-colors block break-all"
              >
                {contactEmail}
              </a>
            ) : (
              <p className="text-xs sm:text-sm text-[#1C2826] font-semibold">Available via Portal</p>
            )}
            <p className="text-[11px] text-slate-500 mt-0.5">Primary notification desk</p>
          </div>
        </div>

      </div>
    </section>
  );
};
