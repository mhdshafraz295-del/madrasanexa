import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  aboutUsService,
  getStoredAboutUsLanguage,
  setStoredAboutUsLanguage,
  type AboutUsLanguage,
  type PublicAboutUsData,
} from '../../services/aboutUs.service';
import AboutUsContentView from '../../components/about-us/AboutUsContentView';
import { Loader2, Globe2, AlertCircle, RefreshCw, ExternalLink } from 'lucide-react';

export default function MadrasaAdminAboutUsPage() {
  const [lang, setLang] = useState<AboutUsLanguage>(getStoredAboutUsLanguage);
  const [data, setData] = useState<PublicAboutUsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchData = async (targetLang: AboutUsLanguage) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      setLoading(true);
      setError(null);
      const res = await aboutUsService.getPublicAboutUs(targetLang, {
        signal: controller.signal,
      });
      setData(res);
    } catch (err: any) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') {
        return; // Ignore aborted requests
      }
      setError(err.response?.data?.message || 'Unable to load platform information.');
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchData(lang);
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [lang]);

  const handleLanguageChange = (newLang: AboutUsLanguage) => {
    setLang(newLang);
    setStoredAboutUsLanguage(newLang);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="bg-white rounded-2xl p-6 border border-[#E7E9EE] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-[#0F172A]">About MadrasaNexa</h1>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#37C6A3]/10 text-[#0F766E] border border-[#37C6A3]/20 uppercase tracking-wider">
              Global Platform
            </span>
          </div>
          <p className="text-xs text-[#7C8A9A] mt-1">
            Learn about the global platform powering modern Islamic educational institutions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {/* Language Selector */}
          <div
            role="group"
            aria-label="Select content language"
            className="inline-flex items-center p-1 rounded-xl bg-[#F7F6F1] border border-[#E7E9EE]"
          >
            <button
              type="button"
              onClick={() => handleLanguageChange('en')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                lang === 'en'
                  ? 'bg-white text-[#0F172A] shadow-2xs'
                  : 'text-[#7C8A9A] hover:text-[#0F172A]'
              }`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => handleLanguageChange('ar')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                lang === 'ar'
                  ? 'bg-white text-[#0F172A] shadow-2xs'
                  : 'text-[#7C8A9A] hover:text-[#0F172A]'
              }`}
            >
              العربية
            </button>
            <button
              type="button"
              onClick={() => handleLanguageChange('ta')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                lang === 'ta'
                  ? 'bg-white text-[#0F172A] shadow-2xs'
                  : 'text-[#7C8A9A] hover:text-[#0F172A]'
              }`}
            >
              தமிழ்
            </button>
          </div>

          <button
            onClick={() => fetchData(lang)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#E7E9EE] bg-[#F7F6F1] hover:bg-[#E7E9EE] text-xs font-semibold text-[#0F172A] transition cursor-pointer"
            title="Refresh latest published content"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#37C6A3]' : 'text-[#7C8A9A]'}`} />
            <span>Refresh</span>
          </button>
          <Link
            to="/about-us"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <span>View Public Page</span>
            <ExternalLink className="w-3.5 h-3.5 text-[#37C6A3]" />
          </Link>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-[#E7E9EE] p-16 flex flex-col items-center justify-center space-y-3 shadow-xs">
          <Loader2 className="w-8 h-8 animate-spin text-[#37C6A3]" />
          <p className="text-xs font-semibold text-[#7C8A9A]">Loading MadrasaNexa platform overview...</p>
        </div>
      ) : error ? (
        <div className="bg-white rounded-2xl border border-red-200 p-10 text-center space-y-4 shadow-xs">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
          <h2 className="text-base font-bold text-[#0F172A]">Unable to Load Platform Information</h2>
          <p className="text-xs text-[#7C8A9A] max-w-md mx-auto">{error}</p>
          <button
            onClick={() => fetchData(lang)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0F172A] text-white text-xs font-bold hover:bg-[#1E293B] transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </button>
        </div>
      ) : !data?.isPublished || !data?.content ? (
        <div className="bg-white rounded-3xl border border-[#E7E9EE] p-12 text-center space-y-4 shadow-xs max-w-2xl mx-auto my-6">
          <div className="w-14 h-14 rounded-2xl bg-[#F7F6F1] flex items-center justify-center mx-auto text-[#7C8A9A]">
            <Globe2 className="w-7 h-7 text-[#37C6A3]" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-base font-bold text-[#0F172A]">About MadrasaNexa Information Unavailable</h2>
            <p className="text-xs text-[#7C8A9A] leading-relaxed max-w-md mx-auto">
              About MadrasaNexa information is currently unavailable. Please check back shortly.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-[#F7F6F1] rounded-3xl border border-[#E7E9EE] shadow-xs overflow-hidden p-4 sm:p-6 lg:p-8">
          <AboutUsContentView
            content={data.content}
            variant="admin"
            language={data.language || lang}
            direction={data.direction || (lang === 'ar' ? 'rtl' : 'ltr')}
            fieldMetadata={data.fieldMetadata}
          />
        </div>
      )}
    </div>
  );
}
