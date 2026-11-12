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
import PublicNavbar from '../../components/public/PublicNavbar';
import PublicFooter from '../../components/public/PublicFooter';
import { Loader2, ArrowLeft, Globe2, AlertCircle } from 'lucide-react';

export default function AboutUsPage() {
  const [lang, setLang] = useState<AboutUsLanguage>(getStoredAboutUsLanguage);
  const [data, setData] = useState<PublicAboutUsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchPublicData = async (targetLang: AboutUsLanguage) => {
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
        return;
      }
      setError(err.response?.data?.message || 'Failed to load About Us information.');
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchPublicData(lang);
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
    <div className="min-h-screen bg-[#F5F5F1] flex flex-col text-[#252525]">
      {/* Unified Public Top Navbar with Quick Links */}
      <PublicNavbar />

      {/* Language Selector Bar (Page Local) */}
      <div className="bg-white border-b border-[#E5E5DF] pt-24 pb-3 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2 text-xs text-[#666666] font-semibold">
            <Globe2 className="w-4 h-4 text-[#85845C]" />
            <span>Content Language:</span>
          </div>

          <div
            role="group"
            aria-label="Select content language"
            className="inline-flex items-center p-1 rounded-xl bg-[#F5F5F1] border border-[#E5E5DF]"
          >
            <button
              type="button"
              onClick={() => handleLanguageChange('en')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                lang === 'en'
                  ? 'bg-white text-[#85845C] shadow-2xs border border-[#E5E5DF]'
                  : 'text-[#666666] hover:text-[#252525]'
              }`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => handleLanguageChange('ar')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                lang === 'ar'
                  ? 'bg-white text-[#85845C] shadow-2xs border border-[#E5E5DF]'
                  : 'text-[#666666] hover:text-[#252525]'
              }`}
            >
              العربية
            </button>
            <button
              type="button"
              onClick={() => handleLanguageChange('ta')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                lang === 'ta'
                  ? 'bg-white text-[#85845C] shadow-2xs border border-[#E5E5DF]'
                  : 'text-[#666666] hover:text-[#252525]'
              }`}
            >
              தமிழ்
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 py-10 sm:py-16">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-[#85845C]" />
            <p className="text-xs font-semibold text-[#666666]">Loading About Us...</p>
          </div>
        ) : error ? (
          <div className="max-w-lg mx-4 sm:mx-auto my-20 p-8 rounded-2xl bg-white border border-[#E5E5DF] text-center space-y-4 shadow-sm">
            <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
            <h2 className="font-serif text-lg font-bold text-[#252525]">Unable to Load Page</h2>
            <p className="text-xs text-[#666666]">{error}</p>
            <button
              onClick={() => fetchPublicData(lang)}
              className="btn-olive-primary px-5 py-2 text-xs font-semibold"
            >
              Try Again
            </button>
          </div>
        ) : !data?.isPublished || !data?.content ? (
          <div className="max-w-lg mx-4 sm:mx-auto my-24 p-8 rounded-2xl bg-white border border-[#E5E5DF] text-center space-y-6 shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-[#F5F5F1] flex items-center justify-center mx-auto text-[#85845C]">
              <Globe2 className="w-8 h-8 text-[#85845C]" />
            </div>
            <div className="space-y-2">
              <h2 className="font-serif text-xl font-bold text-[#252525]">About Us Under Preparation</h2>
              <p className="text-xs text-[#666666] leading-relaxed">
                Our global platform About Us story and overview are currently being updated.
                Please check back soon.
              </p>
            </div>
            <div>
              <Link
                to="/"
                className="btn-olive-primary inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Return to Home</span>
              </Link>
            </div>
          </div>
        ) : (
          <AboutUsContentView
            content={data.content}
            language={data.language || lang}
            direction={data.direction || (lang === 'ar' ? 'rtl' : 'ltr')}
            fieldMetadata={data.fieldMetadata}
          />
        )}
      </main>

      {/* Unified Public Footer with Deep Olive */}
      <PublicFooter />
    </div>
  );
}
