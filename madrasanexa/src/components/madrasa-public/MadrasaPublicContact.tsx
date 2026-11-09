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
    <section id="contact" className="public-section-enter scroll-mt-28 bg-white rounded-3xl border border-[#E5E5DF] p-5 sm:p-8 md:p-12 shadow-xs">
      {/* Section Header */}
      <div className="max-w-2xl mb-8 sm:mb-10">
        <div className="inline-flex items-center space-x-2 text-xs font-bold uppercase tracking-wider mb-2 px-3.5 py-1 rounded-full bg-[#F5F5F1] border border-[#E5E5DF] shadow-2xs" style={{ color: primaryColor }}>
          <Phone className="w-3.5 h-3.5" style={{ color: primaryColor }} />
          <span>Institutional Directory</span>
        </div>
        <h2
          className="text-2xl sm:text-3xl font-serif font-bold tracking-tight mb-2 text-[#252525]"
          style={{ color: theme.headingColor || '#252525' }}
        >
          Contact & Campus Location
        </h2>
        <p className="text-xs sm:text-sm text-[#666666]">
          Official communication channels for parents, guardians, and prospective applicants.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-8">

        {/* Campus Address */}
        <div className="flex items-start space-x-3.5 sm:space-x-4 p-4 sm:p-5 rounded-2xl bg-[#F5F5F1] border border-[#E5E5DF] min-w-0">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white border border-[#E5E5DF] flex items-center justify-center shrink-0 shadow-xs" style={{ color: primaryColor }}>
            <MapPin className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] sm:text-xs font-bold uppercase text-[#666666] tracking-wider mb-1">
              Campus Address
            </p>
            <p className="text-xs sm:text-sm text-[#252525] font-semibold leading-relaxed break-words">
              {address || 'Official campus address available upon inquiry.'}
            </p>
          </div>
        </div>

        {/* Official Telephone */}
        <div className="flex items-start space-x-3.5 sm:space-x-4 p-4 sm:p-5 rounded-2xl bg-[#F5F5F1] border border-[#E5E5DF] min-w-0">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white border border-[#E5E5DF] flex items-center justify-center shrink-0 shadow-xs" style={{ color: primaryColor }}>
            <Phone className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] sm:text-xs font-bold uppercase text-[#666666] tracking-wider mb-1">
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
            <p className="text-[11px] text-[#666666] mt-0.5">Administrative Office Hours</p>
          </div>
        </div>

        {/* Official Email */}
        <div className="flex items-start space-x-3.5 sm:space-x-4 p-4 sm:p-5 rounded-2xl bg-[#F5F5F1] border border-[#E5E5DF] min-w-0">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white border border-[#E5E5DF] flex items-center justify-center shrink-0 shadow-xs" style={{ color: primaryColor }}>
            <Mail className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] sm:text-xs font-bold uppercase text-[#666666] tracking-wider mb-1">
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
            <p className="text-[11px] text-[#666666] mt-0.5">Primary status notification channel</p>
          </div>
        </div>

      </div>
    </section>
  );
};
