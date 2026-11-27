import React, { useState } from 'react';
import { Mail, CheckCircle2, Building, ShieldCheck } from 'lucide-react';

interface MadrasaPublicNewsletterProps {
  madrasaName: string;
}

export const MadrasaPublicNewsletter: React.FC<MadrasaPublicNewsletterProps> = ({
  madrasaName,
}) => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) return;
    setSubmitted(true);
    setEmail('');
  };

  return (
    <section className="my-8 sm:my-12">
      <div className="bg-[#F5F2E9] rounded-3xl p-6 sm:p-10 lg:p-12 border border-[#E5E0D5] shadow-xs relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-6 sm:gap-8 relative z-10">

          {/* Left / Center Info */}
          <div className="flex items-start sm:items-center space-x-4 max-w-2xl">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white border border-[#C5A059]/40 flex items-center justify-center text-[#0B3B2C] shrink-0 shadow-2xs">
              <Building className="w-6 h-6 sm:w-7 sm:h-7 text-[#0B3B2C]" />
            </div>
            <div>
              <h3 className="font-serif text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-[#1C2826] mb-1.5">
                Stay Informed & Connected
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
                Receive official circulars, examination results, and event announcements directly from {madrasaName}.
              </p>
            </div>
          </div>

          {/* Right Input Form */}
          <div className="w-full lg:w-auto shrink-0 max-w-md">
            {submitted ? (
              <div className="flex items-center space-x-2 text-xs font-semibold text-[#0B3B2C] bg-white px-5 py-3 rounded-xl border border-[#C5A059]/40 shadow-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Thank you! You are now subscribed to official bulletins.</span>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2.5 sm:gap-2">
                <div className="relative flex-1">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email address..."
                    required
                    className="w-full sm:w-72 pl-10 pr-4 py-2.5 sm:py-3 rounded-xl bg-white border border-[#D5D0C2] text-xs sm:text-sm text-[#1C2826] placeholder-slate-400 focus:outline-hidden focus:border-[#0B3B2C] focus:ring-1 focus:ring-[#0B3B2C] transition-all"
                  />
                </div>
                <button
                  type="submit"
                  className="px-6 py-2.5 sm:py-3 rounded-xl bg-[#0B3B2C] hover:bg-[#07281D] text-white text-xs font-bold uppercase tracking-wider shadow-xs hover:shadow-md transition-all shrink-0 cursor-pointer"
                >
                  Subscribe
                </button>
              </form>
            )}
            <div className="flex items-center space-x-1.5 mt-2 text-[11px] text-slate-500">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
              <span>Official institutional circulars only. Zero spam.</span>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
