import { useState, useEffect } from 'react';
import { apiGetPublicHomepage, type PlanData } from '../../services/homepage.service';
import PublicNavbar from '../../components/public/PublicNavbar';
import PricingSection from '../../components/public/PricingSection';
import PublicFooter from '../../components/public/PublicFooter';
import FloatingWhatsAppButton from '../../components/public/FloatingWhatsAppButton';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';

export default function PricingPage() {
  const [plans, setPlans] = useState<PlanData[]>([]);
  const [footerData, setFooterData] = useState<any>(null);
  const [whatsAppData, setWhatsAppData] = useState<any>(null);
  const [contactEnabled, setContactEnabled] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPricingData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGetPublicHomepage();
      setPlans(res.plans || []);
      if (res.content) {
        setFooterData(res.content.footer);
        setWhatsAppData(res.content.whatsapp);
        const hasContact = Boolean(
          res.content.contact?.enabled &&
            (res.content.contact.email || res.content.contact.phone || res.content.contact.address)
        );
        setContactEnabled(hasContact);
      }
    } catch (err: any) {
      console.error('[PricingPage] Failed to load public pricing plans:', err);
      setError(err.response?.data?.message || err.message || 'Unable to load subscription plans at this time.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPricingData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F6F1] flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#89865D]" />
          <p className="text-xs font-semibold text-[#7C8A9A] tracking-wider uppercase">
            Loading Subscription Plans...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-[#0F172A] font-sans antialiased flex flex-col justify-between">
      <div>
        {/* Navigation */}
        <PublicNavbar contactEnabled={contactEnabled} />

        {/* Hero Banner Header */}
        <div className="pt-28 pb-12 bg-[#F7F6F1] border-b border-[#E7E9EE]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 text-center max-w-3xl">
            <h1 className="font-serif text-3xl sm:text-5xl font-bold text-[#0F172A] tracking-tight">
              Institutional Subscription Tiers
            </h1>
            <p className="text-sm sm:text-base text-[#7C8A9A] mt-3 leading-relaxed">
              Transparent, predictable capacity tiers designed for Islamic madrasas and collegiate institutions.
            </p>
          </div>
        </div>

        {/* Error Notification if API failed */}
        {error && (
          <div className="max-w-xl mx-auto mt-8 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-800 text-xs flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
            <button
              onClick={fetchPricingData}
              className="inline-flex items-center gap-1 font-bold underline cursor-pointer text-red-900"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Unified Pricing Section */}
        <PricingSection plans={plans} />
      </div>

      {/* Footer */}
      <PublicFooter data={footerData} contactEnabled={contactEnabled} />

      {/* WhatsApp Button */}
      {whatsAppData && (
        <FloatingWhatsAppButton
          enabled={whatsAppData.enabled}
          number={whatsAppData.number}
          defaultMessage={whatsAppData.defaultMessage}
        />
      )}
    </div>
  );
}
