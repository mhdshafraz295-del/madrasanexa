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
  theme,
}) => {
  const primaryColor = theme.primaryBtnBg || '#504F34';

  return (
    <section id="contact" className="public-section-enter scroll-mt-28 glass-panel-gold rounded-3xl p-5 sm:p-8 md:p-12">
      {/* Section Header */}
      <div className="max-w-2xl mb-8 sm:mb-10">
        <div className="inline-flex items-center space-x-2 text-xs font-bold uppercase tracking-wider mb-2 px-3.5 py-1.5 rounded-full bg-white/85 backdrop-blur-md border border-[#C5A059]/35 shadow-[0_0_12px_rgba(197,160,89,0.16)]" style={{ color: primaryColor }}>
          <Phone className="w-3.5 h-3.5" style={{ color: primaryColor }} />
          <span>Institutional Directory</span>
        </div>
        <h2
          className="text-2xl sm:text-3xl font-serif font-bold tracking-tight mb-2 text-[#252525]"
          style={{ color: theme.headingColor || '#252525' }}
        >
          Contact & Campus Location
        </h2>
        <p className="text-xs sm:text-sm text-slate-600">
          Official communication channels for parents, guardians, and prospective applicants.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-8">

        {/* Campus Address */}
        <div className="flex items-start space-x-3.5 sm:space-x-4 p-4 sm:p-5 rounded-2xl bg-white/80 backdrop-blur-md border border-[#C5A059]/30 shadow-[0_4px_16px_rgba(60,50,30,0.05),0_0_12px_rgba(197,160,89,0.12)] min-w-0 transition-all duration-300 hover:border-[#C5A059]/60 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(60,50,30,0.08),0_0_18px_rgba(197,160,89,0.22)]">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white/90 border border-[#C5A059]/35 shadow-[0_0_10px_rgba(197,160,89,0.15)] flex items-center justify-center shrink-0" style={{ color: primaryColor }}>
            <MapPin className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] sm:text-xs font-bold uppercase text-slate-600 tracking-wider mb-1">
              Campus Address
            </p>
            <p className="text-xs sm:text-sm text-[#252525] font-semibold leading-relaxed break-words">
              {address || 'Official campus address available upon inquiry.'}
            </p>
          </div>
        </div>

        {/* Official Telephone */}
        <div className="flex items-start space-x-3.5 sm:space-x-4 p-4 sm:p-5 rounded-2xl bg-white/80 backdrop-blur-md border border-[#C5A059]/30 shadow-[0_4px_16px_rgba(60,50,30,0.05),0_0_12px_rgba(197,160,89,0.12)] min-w-0 transition-all duration-300 hover:border-[#C5A059]/60 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(60,50,30,0.08),0_0_18px_rgba(197,160,89,0.22)]">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white/90 border border-[#C5A059]/35 shadow-[0_0_10px_rgba(197,160,89,0.15)] flex items-center justify-center shrink-0" style={{ color: primaryColor }}>
            <Phone className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] sm:text-xs font-bold uppercase text-slate-600 tracking-wider mb-1">
              Telephone Inquiries
            </p>
            {contactPhone ? (
              <a
                href={`tel:${contactPhone.replace(/\s+/g, '')}`}
                className="text-xs sm:text-sm font-bold hover:underline block break-words"
                style={{ color: primaryColor }}
              >
                {contactPhone}
              </a>
            ) : (
              <p className="text-xs sm:text-sm text-[#252525] font-semibold">Available via Admissions Desk</p>
            )}
            <p className="text-[11px] text-slate-500 mt-0.5">Administrative Office Hours</p>
          </div>
        </div>

        {/* Official Email */}
        <div className="flex items-start space-x-3.5 sm:space-x-4 p-4 sm:p-5 rounded-2xl bg-white/80 backdrop-blur-md border border-[#C5A059]/30 shadow-[0_4px_16px_rgba(60,50,30,0.05),0_0_12px_rgba(197,160,89,0.12)] min-w-0 transition-all duration-300 hover:border-[#C5A059]/60 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(60,50,30,0.08),0_0_18px_rgba(197,160,89,0.22)]">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white/90 border border-[#C5A059]/35 shadow-[0_0_10px_rgba(197,160,89,0.15)] flex items-center justify-center shrink-0" style={{ color: primaryColor }}>
            <Mail className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] sm:text-xs font-bold uppercase text-slate-600 tracking-wider mb-1">
              Electronic Mail
            </p>
            {contactEmail ? (
              <a
                href={`mailto:${contactEmail}`}
                className="text-xs sm:text-sm font-bold hover:underline block break-all"
                style={{ color: primaryColor }}
              >
                {contactEmail}
              </a>
            ) : (
              <p className="text-xs sm:text-sm text-[#252525] font-semibold">Available via Portal</p>
            )}
            <p className="text-[11px] text-slate-500 mt-0.5">Primary status notification channel</p>
          </div>
        </div>

      </div>
    </section>
  );
};
