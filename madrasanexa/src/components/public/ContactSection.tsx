import type { ContactData } from '../../services/homepage.service';
import { Mail, Phone, MapPin, Clock, MessageSquare } from 'lucide-react';

interface ContactSectionProps {
  data: ContactData;
}

export default function ContactSection({ data }: ContactSectionProps) {
  if (!data || !data.enabled) return null;

  const hasEmail = Boolean(data.email && data.email.trim());
  const hasPhone = Boolean(data.phone && data.phone.trim());
  const hasAddress = Boolean(data.address && data.address.trim());
  const hasHours = Boolean(data.officeHours && data.officeHours.trim());

  if (!hasEmail && !hasPhone && !hasAddress && !hasHours) {
    return null;
  }

  return (
    <section id="contact" className="py-20 sm:py-28 bg-[#F5F5F1] border-t border-[#E5E5DF] relative scroll-mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="text-center max-w-2xl mx-auto mb-14 sm:mb-18">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-white text-[#85845C] text-xs font-semibold tracking-wider uppercase mb-3 border border-[#E5E5DF] shadow-2xs">
            <MessageSquare className="w-3.5 h-3.5 text-[#A5A477]" />
            <span>Platform Communications</span>
          </div>
          <h2 className="font-serif text-2xl sm:text-4xl font-bold text-[#252525] tracking-tight">
            {data.headline || 'Contact Platform Administration'}
          </h2>
          <div className="w-16 h-1 bg-[#85845C] mx-auto rounded-full mt-4 mb-4" />
          {data.description && (
            <p className="text-base text-[#666666]">
              {data.description}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
          {hasEmail && (
            <div className="acju-card bg-white p-6 rounded-xl border border-[#E5E5DF] shadow-xs text-center flex flex-col items-center group">
              <div className="acju-icon-badge w-12 h-12 rounded-full bg-[#F5F5F1] group-hover:bg-white text-[#85845C] flex items-center justify-center mb-4 transition-colors">
                <Mail className="w-5 h-5 text-[#85845C]" />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#666666] group-hover:text-white/80 mb-1 transition-colors">
                Email Inquiries
              </h3>
              <a
                href={`mailto:${data.email}`}
                className="text-xs sm:text-sm font-semibold text-[#252525] group-hover:text-white transition-colors break-all"
              >
                {data.email}
              </a>
            </div>
          )}

          {hasPhone && (
            <div className="acju-card bg-white p-6 rounded-xl border border-[#E5E5DF] shadow-xs text-center flex flex-col items-center group">
              <div className="acju-icon-badge w-12 h-12 rounded-full bg-[#F5F5F1] group-hover:bg-white text-[#85845C] flex items-center justify-center mb-4 transition-colors">
                <Phone className="w-5 h-5 text-[#85845C]" />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#666666] group-hover:text-white/80 mb-1 transition-colors">
                Telephone
              </h3>
              <a
                href={`tel:${data.phone}`}
                className="text-xs sm:text-sm font-semibold text-[#252525] group-hover:text-white transition-colors"
              >
                {data.phone}
              </a>
            </div>
          )}

          {hasAddress && (
            <div className="acju-card bg-white p-6 rounded-xl border border-[#E5E5DF] shadow-xs text-center flex flex-col items-center group">
              <div className="acju-icon-badge w-12 h-12 rounded-full bg-[#F5F5F1] group-hover:bg-white text-[#85845C] flex items-center justify-center mb-4 transition-colors">
                <MapPin className="w-5 h-5 text-[#85845C]" />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#666666] group-hover:text-white/80 mb-1 transition-colors">
                Office Location
              </h3>
              <p className="text-xs sm:text-sm font-medium text-[#252525] group-hover:text-white leading-relaxed transition-colors">
                {data.address}
              </p>
            </div>
          )}

          {hasHours && (
            <div className="acju-card bg-white p-6 rounded-xl border border-[#E5E5DF] shadow-xs text-center flex flex-col items-center group">
              <div className="acju-icon-badge w-12 h-12 rounded-full bg-[#F5F5F1] group-hover:bg-white text-[#85845C] flex items-center justify-center mb-4 transition-colors">
                <Clock className="w-5 h-5 text-[#85845C]" />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#666666] group-hover:text-white/80 mb-1 transition-colors">
                Working Hours
              </h3>
              <p className="text-xs sm:text-sm font-medium text-[#252525] group-hover:text-white leading-relaxed transition-colors">
                {data.officeHours}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
