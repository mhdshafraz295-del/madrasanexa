import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Lock,
  FileText,
  Clock,
  Image as ImageIcon,
  Languages,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  Upload,
  Copy,
  Check,
  Printer,
  Download,
  ArrowRightLeft,
  ChevronLeft,
} from 'lucide-react';
import { teacherAiService, type AiStatusResponse } from '../../services/ai.service';

// =========================================================================
// AI Pulsing Sparkle Loader with Rotating Status Messages
// =========================================================================
function AiSparkleLoader({
  title,
  messages,
}: {
  title: string;
  messages: string[];
}) {
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIndex((prev) => (prev + 1) % messages.length);
    }, 2400);
    return () => clearInterval(interval);
  }, [messages.length]);

  return (
    <div className="py-12 px-4 flex flex-col items-center justify-center text-center">
      <div className="relative mb-6">
        <div className="absolute inset-0 rounded-full bg-[#37C6A3]/25 blur-xl animate-pulse" />
        <div className="relative w-16 h-16 rounded-2xl bg-[#0F172A] text-[#37C6A3] flex items-center justify-center shadow-lg border border-emerald-500/30">
          <Sparkles className="w-8 h-8 animate-spin" style={{ animationDuration: '6s' }} />
        </div>
        <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#37C6A3] opacity-75" />
          <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-white" />
        </span>
      </div>

      <h4 className="text-sm sm:text-base font-extrabold text-[#0F172A] tracking-tight">{title}</h4>

      <div className="h-6 mt-2 flex items-center justify-center overflow-hidden">
        <p key={msgIndex} className="text-xs font-semibold text-emerald-700 animate-fade-in transition-all">
          ✨ {messages[msgIndex]}
        </p>
      </div>

      <div className="w-56 bg-slate-100 rounded-full h-1.5 mt-4 overflow-hidden border border-slate-200">
        <div className="h-full bg-gradient-to-r from-emerald-500 via-[#37C6A3] to-teal-400 rounded-full animate-pulse" />
      </div>

      <span className="text-[10px] text-[#7C8A9A] mt-3">
        Zero Cloud Storage • Powered by Cloudflare Workers AI
      </span>
    </div>
  );
}

// =========================================================================
// Smooth Typewriter / Streamed Text Renderer with Skip Option
// =========================================================================
function AiStreamedText({
  text,
  onFinished,
}: {
  text: string;
  onFinished?: () => void;
}) {
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

  const [displayedLength, setDisplayedLength] = useState(prefersReducedMotion ? text.length : 0);
  const [isSkipped, setIsSkipped] = useState(Boolean(prefersReducedMotion));

  useEffect(() => {
    if (prefersReducedMotion || isSkipped) {
      setDisplayedLength(text.length);
      onFinished?.();
      return;
    }

    setDisplayedLength(0);
    const chunkSize = Math.max(30, Math.floor(text.length / 75));
    const interval = setInterval(() => {
      setDisplayedLength((prev) => {
        const next = prev + chunkSize;
        if (next >= text.length) {
          clearInterval(interval);
          onFinished?.();
          return text.length;
        }
        return next;
      });
    }, 22);

    return () => clearInterval(interval);
  }, [text, isSkipped, prefersReducedMotion, onFinished]);

  const isComplete = displayedLength >= text.length;

  return (
    <div className="relative">
      {!isComplete && !isSkipped && !prefersReducedMotion && (
        <div className="sticky top-2 z-20 flex justify-end mb-3 print:hidden">
          <button
            type="button"
            onClick={() => {
              setIsSkipped(true);
              setDisplayedLength(text.length);
              onFinished?.();
            }}
            className="px-3 py-1.5 min-h-[36px] text-xs font-bold bg-[#0F172A] text-white rounded-xl shadow-md hover:bg-[#1E293B] flex items-center gap-1.5 transition cursor-pointer"
          >
            <span>⏩ Skip to Full Output</span>
          </button>
        </div>
      )}

      <div className="prose prose-slate max-w-none text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-sans text-[#0F172A]">
        {text.slice(0, displayedLength)}
        {!isComplete && (
          <span className="inline-block w-2 h-4 ml-1 bg-[#37C6A3] animate-pulse align-middle" />
        )}
      </div>
    </div>
  );
}

// =========================================================================
// Blur-to-Sharp Fade-in Reveal for Generated Posters
// =========================================================================
function AiPosterReveal({
  src,
  alt,
}: {
  src: string;
  alt: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

  return (
    <div className="relative rounded-2xl overflow-hidden shadow-xl border border-slate-200 max-h-[550px] max-w-md w-full bg-slate-900 mx-auto">
      <img
        src={src}
        alt={alt}
        onLoad={() => setLoaded(true)}
        className={`w-full h-auto object-contain transform-gpu transition-all duration-700 ease-out ${
          loaded || prefersReducedMotion
            ? 'filter-none opacity-100 scale-100'
            : 'blur-md opacity-0 scale-95'
        }`}
      />
    </div>
  );
}

// =========================================================================
// Teacher AI Page Main Component
// =========================================================================
export default function TeacherAiPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusData, setStatusData] = useState<AiStatusResponse | null>(null);

  // Unlocked Workspace State
  const [activeTab, setActiveTab] = useState<'lesson' | 'exam' | 'poster' | 'translate'>('lesson');
  const [mobileView, setMobileView] = useState<'config' | 'preview'>('config');
  const [copiedText, setCopiedText] = useState(false);

  // Status cycling messages
  const lessonMessages = [
    'Structuring 30-minute Islamic lesson pedagogy...',
    'Crafting 5-minute engaging Starter Hook...',
    'Designing 15-minute Core Instruction with authentic proofs...',
    'Creating 7-minute interactive student activity...',
    'Synthesizing blackboard summary flow and plenary...',
  ];

  const examMessages = [
    'Parsing PDF syllabus strictly in RAM memory (0 MB saved)...',
    'Analyzing curriculum objectives & Islamic concepts...',
    'Generating multiple choice questions with authentic options...',
    'Drafting structured short questions & essay rubrics...',
    'Synthesizing comprehensive answer keys with Quran/Hadith references...',
  ];

  const posterMessages = [
    'Analyzing event details & title typography...',
    'Composing Islamic geometric patterns & ornamental arches...',
    'Rendering calligraphy & aesthetic palette with Flux 1 Schnell...',
    'Synthesizing crisp visual artwork directly in memory...',
  ];

  const translateMessages = [
    'Preserving Islamic terminology (Du\'a, Hadith, Salah, Adab)...',
    'Translating grammatical structures across Tamil, English & Arabic...',
    'Polishing output for formal circular or lesson distribution...',
  ];

  // Tool 1: Exam Generator
  const [examFile, setExamFile] = useState<File | null>(null);
  const [examTopic, setExamTopic] = useState('');
  const [examSubject, setExamSubject] = useState('Islamic Studies');
  const [examGrade, setExamGrade] = useState('Intermediate');
  const [examLanguage, setExamLanguage] = useState<'English' | 'Tamil' | 'Arabic' | 'Bilingual (English + Tamil)'>('English');
  const [examDuration, setExamDuration] = useState('60');
  const [examMarks, setExamMarks] = useState('50');
  const [mcqCount, setMcqCount] = useState(5);
  const [shortCount, setShortCount] = useState(4);
  const [essayCount, setEssayCount] = useState(2);
  const [generatingExam, setGeneratingExam] = useState(false);
  const [generatedExam, setGeneratedExam] = useState<string | null>(null);
  const [examError, setExamError] = useState<string | null>(null);

  // Tool 2: Ustadh Lesson Planner
  const [lessonTopic, setLessonTopic] = useState('');
  const [lessonSubject, setLessonSubject] = useState('Fiqh & Ahkam');
  const [lessonGrade, setLessonGrade] = useState('Intermediate');
  const [lessonDuration, setLessonDuration] = useState('30');
  const [lessonLanguage, setLessonLanguage] = useState<'English' | 'Tamil' | 'Arabic'>('English');
  const [generatingLesson, setGeneratingLesson] = useState(false);
  const [generatedLesson, setGeneratedLesson] = useState<string | null>(null);
  const [lessonError, setLessonError] = useState<string | null>(null);

  // Tool 3: Poster Maker
  const [posterTitle, setPosterTitle] = useState('');
  const [posterCategory, setPosterCategory] = useState('Hifz Convocation');
  const [posterDate, setPosterDate] = useState('');
  const [posterVenue, setPosterVenue] = useState('');
  const [posterTheme, setPosterTheme] = useState('Classic Emerald Green & Gold Calligraphy Arabesque');
  const [generatingPoster, setGeneratingPoster] = useState(false);
  const [generatedPoster, setGeneratedPoster] = useState<any>(null);
  const [posterError, setPosterError] = useState<string | null>(null);

  // Tool 4: Multilingual Translator
  const [sourceLang, setSourceLang] = useState<'English' | 'Tamil' | 'Arabic'>('English');
  const [targetLang, setTargetLang] = useState<'Tamil' | 'English' | 'Arabic'>('Tamil');
  const [inputText, setInputText] = useState('');
  const [translating, setTranslating] = useState(false);
  const [translatedResult, setTranslatedResult] = useState<string | null>(null);
  const [translationError, setTranslationError] = useState<string | null>(null);

  const loadStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await teacherAiService.getAiStatus();
      setStatusData(res);
    } catch (err: any) {
      console.error('Failed to load AI status:', err);
      setError(err.message || 'Failed to load AI Assistant.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const handleSwapLanguages = () => {
    const temp = sourceLang;
    setSourceLang(targetLang as any);
    setTargetLang(temp as any);
    if (translatedResult) {
      setInputText(translatedResult);
      setTranslatedResult('');
    }
  };

  // Generate Exam
  const handleGenerateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    setExamError(null);
    setGeneratingExam(true);
    setMobileView('preview');
    try {
      const formData = new FormData();
      if (examFile) formData.append('file', examFile);
      formData.append('topic', examTopic);
      formData.append('subject', examSubject);
      formData.append('gradeLevel', examGrade);
      formData.append('language', examLanguage);
      formData.append('durationMinutes', examDuration);
      formData.append('totalMarks', examMarks);
      formData.append('mcqCount', String(mcqCount));
      formData.append('shortCount', String(shortCount));
      formData.append('essayCount', String(essayCount));

      const res = await teacherAiService.generateExamPaper(formData);
      setGeneratedExam(res.examContent);
    } catch (err: any) {
      setExamError(err.message || 'Failed to generate exam paper.');
    } finally {
      setGeneratingExam(false);
    }
  };

  // Generate Lesson
  const handleGenerateLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    setLessonError(null);
    setGeneratingLesson(true);
    setMobileView('preview');
    try {
      const formData = new FormData();
      formData.append('topic', lessonTopic);
      formData.append('subject', lessonSubject);
      formData.append('gradeLevel', lessonGrade);
      formData.append('durationMinutes', lessonDuration);
      formData.append('language', lessonLanguage);

      const res = await teacherAiService.generateLessonPlan(formData);
      setGeneratedLesson(res.lessonPlan);
    } catch (err: any) {
      setLessonError(err.message || 'Failed to generate lesson plan.');
    } finally {
      setGeneratingLesson(false);
    }
  };

  // Generate Poster
  const handleGeneratePoster = async (e: React.FormEvent) => {
    e.preventDefault();
    setPosterError(null);
    setGeneratingPoster(true);
    setMobileView('preview');
    try {
      const res = await teacherAiService.generatePoster({
        title: posterTitle,
        category: posterCategory,
        dateText: posterDate,
        venue: posterVenue,
        themePrompt: posterTheme,
      });
      setGeneratedPoster(res);
    } catch (err: any) {
      setPosterError(err.message || 'Failed to generate poster.');
    } finally {
      setGeneratingPoster(false);
    }
  };

  // Translate
  const handleTranslate = async (e: React.FormEvent) => {
    e.preventDefault();
    setTranslationError(null);
    setTranslating(true);
    try {
      const res = await teacherAiService.translateContent({
        text: inputText,
        sourceLanguage: sourceLang,
        targetLanguage: targetLang,
      });
      setTranslatedResult(res.translatedText);
    } catch (err: any) {
      setTranslationError(err.message || 'Failed to translate content.');
    } finally {
      setTranslating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[450px] space-y-3">
        <RefreshCw className="w-8 h-8 text-[#37C6A3] animate-spin" />
        <span className="text-xs font-semibold text-[#7C8A9A]">Loading Ustadh Smart AI Assistant...</span>
      </div>
    );
  }

  if (error || !statusData) {
    return (
      <div className="max-w-xl mx-auto my-12 bg-white rounded-3xl p-8 border border-red-200 text-center shadow-xs">
        <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
        <h3 className="text-base font-bold text-[#0F172A]">Unable to Load AI Assistant</h3>
        <p className="text-xs text-[#7C8A9A] mt-1.5">{error || 'Unknown error occurred.'}</p>
        <button
          onClick={loadStatus}
          className="mt-5 px-5 py-2.5 min-h-[44px] text-xs font-bold text-white bg-[#0F172A] rounded-xl hover:bg-[#1E293B] transition cursor-pointer inline-flex items-center justify-center"
        >
          Try Again
        </button>
      </div>
    );
  }

  // ==========================================
  // VIEW A: LOCKED PREVIEW (AI DISABLED)
  // ==========================================
  if (!statusData.aiEnabled) {
    return (
      <div className="p-3 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-8 relative">
        {/* Component-scoped GPU-accelerated Keyframe Styles */}
        <style>{`
          @keyframes hero-spin-slow {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes hero-spin-reverse {
            from { transform: rotate(360deg); }
            to { transform: rotate(0deg); }
          }
          @keyframes hero-pulse-glow {
            0%, 100% { transform: scale(1); opacity: 0.14; }
            50% { transform: scale(1.18); opacity: 0.28; }
          }
          @keyframes hero-float-sparkle {
            0%, 100% { transform: translateY(0px) scale(0.9); opacity: 0.25; }
            50% { transform: translateY(-7px) scale(1.2); opacity: 0.9; }
          }
          @keyframes badge-shimmer-sweep {
            0% { transform: translateX(-160%); }
            40%, 100% { transform: translateX(260%); }
          }
          @keyframes orb-halo-ripple {
            0% { transform: scale(0.92); opacity: 0.8; }
            50% { transform: scale(1.28); opacity: 0.25; }
            100% { transform: scale(1.48); opacity: 0; }
          }
          @keyframes orb-float-gentle {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-4px); }
          }
          .animate-hero-spin {
            animation: hero-spin-slow 40s linear infinite;
          }
          .animate-hero-reverse {
            animation: hero-spin-reverse 55s linear infinite;
          }
          .animate-hero-pulse {
            animation: hero-pulse-glow 9s ease-in-out infinite;
          }
          .animate-sparkle {
            animation: hero-float-sparkle 3.5s ease-in-out infinite;
          }
          .animate-badge-shimmer {
            animation: badge-shimmer-sweep 4.5s ease-in-out infinite;
          }
          .animate-orb-halo {
            animation: orb-halo-ripple 2.8s cubic-bezier(0, 0, 0.2, 1) infinite;
          }
          .animate-orb-float {
            animation: orb-float-gentle 4s ease-in-out infinite;
          }
          @media (prefers-reduced-motion: reduce) {
            .animate-hero-spin,
            .animate-hero-reverse,
            .animate-hero-pulse,
            .animate-sparkle,
            .animate-badge-shimmer,
            .animate-orb-halo,
            .animate-orb-float {
              animation: none !important;
            }
          }
        `}</style>

        {/* Hero with Ambient Islamic Geometric Animation */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0A0F1D] text-white p-6 sm:p-10 border border-slate-800 shadow-xl">
          {/* Breathing Emerald Glow Orbs */}
          <div className="absolute -top-20 -right-20 w-80 h-80 sm:w-96 sm:h-96 rounded-full bg-[#37C6A3]/15 blur-3xl pointer-events-none animate-hero-pulse" />
          <div
            className="absolute top-1/2 right-20 w-56 h-56 rounded-full bg-teal-500/10 blur-2xl pointer-events-none animate-hero-pulse"
            style={{ animationDelay: '3s' }}
          />

          {/* Ambient Rotating Islamic 8-Point Geometric Star Emblem */}
          <div className="absolute -right-12 sm:right-4 top-1/2 -translate-y-1/2 pointer-events-none select-none opacity-20 sm:opacity-35 transition-opacity">
            <div className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center">
              {/* Outer Reverse Rotating Dashed Halo Ring */}
              <div className="absolute inset-0 flex items-center justify-center animate-hero-reverse">
                <svg viewBox="0 0 240 240" className="w-full h-full text-[#37C6A3]/50 stroke-current fill-none">
                  <circle cx="120" cy="120" r="112" strokeWidth="1" strokeDasharray="6 8" />
                  <circle cx="120" cy="120" r="100" strokeWidth="0.8" strokeDasharray="3 5" opacity="0.6" />
                </svg>
              </div>

              {/* Primary Rotating Islamic 8-Point Geometric Star */}
              <div className="absolute inset-4 sm:inset-6 flex items-center justify-center animate-hero-spin">
                <svg viewBox="0 0 200 200" className="w-full h-full text-[#37C6A3] stroke-current fill-none">
                  <circle cx="100" cy="100" r="90" strokeWidth="1.2" opacity="0.35" />
                  <rect x="35" y="35" width="130" height="130" rx="3" strokeWidth="1.6" opacity="0.5" />
                  <rect
                    x="35"
                    y="35"
                    width="130"
                    height="130"
                    rx="3"
                    strokeWidth="1.6"
                    opacity="0.5"
                    transform="rotate(45 100 100)"
                  />
                  <circle cx="100" cy="100" r="34" strokeWidth="1.2" strokeDasharray="4 4" opacity="0.5" />
                  <circle cx="100" cy="100" r="18" strokeWidth="1.5" opacity="0.65" />
                  <circle cx="100" cy="100" r="5" fill="#37C6A3" opacity="0.85" />
                </svg>
              </div>

              {/* Floating Twinkle Sparkle Particles */}
              <span
                className="absolute top-6 left-12 text-[#37C6A3] text-sm animate-sparkle"
                style={{ animationDelay: '0s' }}
              >
                ✦
              </span>
              <span
                className="absolute bottom-8 right-8 text-emerald-300 text-xs animate-sparkle"
                style={{ animationDelay: '1.6s' }}
              >
                ✧
              </span>
              <span
                className="absolute top-1/2 right-4 text-[#37C6A3] text-base animate-sparkle"
                style={{ animationDelay: '2.8s' }}
              >
                ✦
              </span>
            </div>
          </div>

          <div className="relative z-10">
            {/* Shimmer Sweep Badge */}
            <div className="relative overflow-hidden inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#37C6A3]/20 border border-[#37C6A3]/30 text-[#37C6A3] text-xs font-semibold mb-4 shadow-xs">
              <span className="absolute inset-0 -translate-x-full animate-badge-shimmer bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none" />
              <Sparkles className="w-3.5 h-3.5 shrink-0 relative z-10" />
              <span className="relative z-10">MadrasaNexa Ustadh Smart AI</span>
              <span className="text-slate-400 relative z-10">|</span>
              <span className="flex items-center gap-1 text-slate-300 relative z-10">
                <Lock className="w-3 h-3 text-amber-400" />
                Locked Preview
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">
              Your Islamic Teaching & Exam Preparation <span className="text-[#37C6A3]">Copilot</span>
            </h1>

            <p className="mt-3 text-xs sm:text-sm text-slate-300 leading-relaxed max-w-2xl">
              Design structured term examinations, generate 30-minute interactive lesson plans with blackboard summaries,
              create event announcement posters, and translate materials in Tamil, Arabic, and English.
            </p>

            <div
              id="teacher-ai-notice"
              className="mt-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-3 scroll-mt-6"
            >
              <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Subscription Required for Your Madrasa:</span> AI Assistant is activated
                at the institutional level. Please contact your Madrasa Administrator to activate the subscription
                from the Admin Dashboard. All Ustadhs receive instant full access upon Super Admin approval.
              </div>
            </div>
          </div>
        </div>

        {/* Feature Cards - Emerald & Brand Themed */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-[#E7E9EE] shadow-xs hover:border-[#37C6A3]/50 transition">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3 border border-emerald-100">
              <FileText className="w-5 h-5 text-emerald-600" />
            </div>
            <h3 className="text-sm font-bold text-[#0F172A]">Zero-Storage PDF Exam Generator</h3>
            <p className="text-xs text-[#7C8A9A] mt-1 leading-relaxed">
              Upload textbook or syllabus PDFs in RAM only (0 MB stored). Instantly generate MCQs, short questions, and full answer keys in Tamil, English, and Arabic.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-[#E7E9EE] shadow-xs hover:border-[#37C6A3]/50 transition">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center mb-3 border border-teal-100">
              <Clock className="w-5 h-5 text-teal-600" />
            </div>
            <h3 className="text-sm font-bold text-[#0F172A]">Ustadh 30-Min Lesson Planner</h3>
            <p className="text-xs text-[#7C8A9A] mt-1 leading-relaxed">
              Pedagogical lesson plans with 5m hook, 15m core explanation, 7m active student exercise, 3m plenary, and visual blackboard summary layouts.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-[#E7E9EE] shadow-xs hover:border-[#37C6A3]/50 transition">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#37C6A3] flex items-center justify-center mb-3 border border-emerald-100">
              <ImageIcon className="w-5 h-5 text-emerald-600" />
            </div>
            <h3 className="text-sm font-bold text-[#0F172A]">Madrasa Event Poster Maker</h3>
            <p className="text-xs text-[#7C8A9A] mt-1 leading-relaxed">
              Generate beautiful event flyers and Hifz graduation posters with Cloudflare Flux 1 Schnell and direct one-click image download.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-[#E7E9EE] shadow-xs hover:border-[#37C6A3]/50 transition">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center mb-3 border border-teal-100">
              <Languages className="w-5 h-5 text-teal-600" />
            </div>
            <h3 className="text-sm font-bold text-[#0F172A]">Multilingual Islamic Translator</h3>
            <p className="text-xs text-[#7C8A9A] mt-1 leading-relaxed">
              High-accuracy translation between Tamil, English, and Arabic preserving Islamic terminology, Du'a, and religious context.
            </p>
          </div>
        </div>

        {/* Floating Bottom-Right Round AI Orb / Quick-Action Button */}
        <div className="fixed bottom-5 right-5 z-40 print:hidden">
          <div className="relative group">
            <div className="absolute right-16 top-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-2 group-hover:translate-x-0 whitespace-nowrap z-50">
              <div className="bg-[#0F172A] text-white px-3.5 py-2 rounded-xl border border-emerald-500/30 shadow-2xl flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-[#37C6A3]" />
                <div className="text-left">
                  <div className="text-xs font-bold leading-none text-white">Ustadh AI Copilot</div>
                  <div className="text-[10px] text-slate-400 mt-0.5 leading-none">Madrasa Subscription Required</div>
                </div>
                <div className="w-2 h-2 bg-[#0F172A] border-r border-t border-emerald-500/30 rotate-45 absolute -right-1 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <span className="absolute inset-0 rounded-full bg-[#37C6A3]/30 animate-orb-halo pointer-events-none" />

            <button
              type="button"
              onClick={() => {
                document.getElementById('teacher-ai-notice')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className="relative w-14 h-14 min-h-[56px] min-w-[56px] rounded-full bg-[#0F172A] hover:bg-[#1E293B] text-[#37C6A3] border-2 border-[#37C6A3] shadow-[0_4px_24px_rgba(55,198,163,0.35)] hover:shadow-[0_6px_30px_rgba(55,198,163,0.55)] transition-all duration-300 flex items-center justify-center cursor-pointer animate-orb-float group-hover:scale-105 active:scale-95"
              aria-label="Madrasa Subscription Required for AI Copilot"
              title="Madrasa Subscription Required for AI Copilot"
            >
              <Sparkles className="w-6 h-6 text-[#37C6A3] group-hover:rotate-12 transition-transform duration-300" />
              <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 rounded-full bg-amber-500 text-slate-950 border-2 border-[#0F172A] flex items-center justify-center shadow-xs">
                <Lock className="w-2.5 h-2.5" />
              </span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW B: UNLOCKED TEACHER AI WORKSPACE
  // ==========================================
  return (
    <div id="teacher-workspace-top" className="p-3 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 relative">
      {/* Workspace Header */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-[#E7E9EE] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-[#0F172A] text-[#37C6A3] flex items-center justify-center font-bold shrink-0">
            <Sparkles className="w-6 h-6 text-[#37C6A3]" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-extrabold text-[#0F172A] tracking-tight">
                Ustadh Smart AI Assistant
              </h1>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Active Tenant Access
              </span>
            </div>
            <p className="text-xs text-[#7C8A9A] mt-0.5">
              Isolated Islamic Teaching Copilot • Zero database queries • In-memory RAM processing
            </p>
          </div>
        </div>

        <button
          onClick={loadStatus}
          className="p-2.5 min-h-[44px] min-w-[44px] text-[#7C8A9A] hover:text-[#0F172A] rounded-xl border border-[#E7E9EE] bg-white transition cursor-pointer self-start md:self-auto flex items-center justify-center"
          title="Refresh Status"
          aria-label="Refresh Status"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#E7E9EE] pb-2 overflow-x-auto print:hidden">
        <button
          onClick={() => {
            setActiveTab('lesson');
            setMobileView(generatedLesson ? 'preview' : 'config');
          }}
          className={`flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-2xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'lesson'
              ? 'bg-[#0F172A] text-white shadow-xs'
              : 'text-[#7C8A9A] hover:text-[#0F172A] hover:bg-white'
          }`}
        >
          <Clock className="w-4 h-4 text-teal-400" />
          <span>30-Min Lesson Planner</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('exam');
            setMobileView(generatedExam ? 'preview' : 'config');
          }}
          className={`flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-2xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'exam'
              ? 'bg-[#0F172A] text-white shadow-xs'
              : 'text-[#7C8A9A] hover:text-[#0F172A] hover:bg-white'
          }`}
        >
          <FileText className="w-4 h-4 text-[#37C6A3]" />
          <span>Exam Paper & Answer Key</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('poster');
            setMobileView(generatedPoster ? 'preview' : 'config');
          }}
          className={`flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-2xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'poster'
              ? 'bg-[#0F172A] text-white shadow-xs'
              : 'text-[#7C8A9A] hover:text-[#0F172A] hover:bg-white'
          }`}
        >
          <ImageIcon className="w-4 h-4 text-emerald-400" />
          <span>Event Poster Maker</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('translate');
            setMobileView('config');
          }}
          className={`flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-2xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'translate'
              ? 'bg-[#0F172A] text-white shadow-xs'
              : 'text-[#7C8A9A] hover:text-[#0F172A] hover:bg-white'
          }`}
        >
          <Languages className="w-4 h-4 text-teal-300" />
          <span>Multilingual Translator</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: LESSON PLANNER                                                     */}
      {/* ========================================================================= */}
      {activeTab === 'lesson' && (
        <div>
          {/* Mobile Segemented Switch (< 1024px) */}
          <div className="lg:hidden flex items-center p-1 bg-[#F7F6F1] rounded-2xl border border-[#E7E9EE] mb-4 print:hidden">
            <button
              type="button"
              onClick={() => setMobileView('config')}
              className={`flex-1 py-2.5 min-h-[44px] text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
                mobileView === 'config'
                  ? 'bg-white text-[#0F172A] shadow-xs border border-[#E7E9EE]'
                  : 'text-[#7C8A9A] hover:text-[#0F172A]'
              }`}
            >
              <span>⚙️ Configuration</span>
            </button>
            <button
              type="button"
              onClick={() => setMobileView('preview')}
              className={`flex-1 py-2.5 min-h-[44px] text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
                mobileView === 'preview'
                  ? 'bg-white text-[#0F172A] shadow-xs border border-[#E7E9EE]'
                  : 'text-[#7C8A9A] hover:text-[#0F172A]'
              }`}
            >
              <span>📄 Lesson Plan</span>
              {generatingLesson && (
                <span className="w-2 h-2 rounded-full bg-[#37C6A3] animate-pulse" />
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div
              className={`${
                mobileView === 'config' ? 'block' : 'hidden'
              } lg:block lg:col-span-5 bg-white rounded-3xl p-5 sm:p-6 border border-[#E7E9EE] shadow-sm space-y-4 print:hidden`}
            >
              <h2 className="text-sm font-bold text-[#0F172A] flex items-center gap-2 border-b border-[#E7E9EE] pb-3">
                <Clock className="w-4 h-4 text-teal-500" />
                <span>Lesson Parameters</span>
              </h2>

              {lessonError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                  {lessonError}
                </div>
              )}

              <form onSubmit={handleGenerateLesson} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1">Lesson Topic *</label>
                  <input
                    type="text"
                    placeholder="e.g. Etiquette of Seeking Knowledge, Virtues of Dhikr"
                    value={lessonTopic}
                    onChange={(e) => setLessonTopic(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 min-h-[44px] text-xs rounded-xl border border-[#E7E9EE] focus:outline-hidden focus:border-[#37C6A3] bg-white font-medium"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#0F172A] mb-1">Subject</label>
                    <select
                      value={lessonSubject}
                      onChange={(e) => setLessonSubject(e.target.value)}
                      className="w-full px-3 py-2.5 min-h-[44px] text-xs rounded-xl border border-[#E7E9EE] bg-white font-medium"
                    >
                      <option value="Fiqh & Ahkam">Fiqh & Ahkam</option>
                      <option value="Aqeedah & Tawheed">Aqeedah & Tawheed</option>
                      <option value="Seerah & Hadith">Seerah & Hadith</option>
                      <option value="Adab & Akhlaq">Adab & Akhlaq</option>
                      <option value="Arabic Grammar">Arabic Grammar</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#0F172A] mb-1">Class Level</label>
                    <select
                      value={lessonGrade}
                      onChange={(e) => setLessonGrade(e.target.value)}
                      className="w-full px-3 py-2.5 min-h-[44px] text-xs rounded-xl border border-[#E7E9EE] bg-white font-medium"
                    >
                      <option value="Beginner / Maktab">Beginner / Maktab</option>
                      <option value="Intermediate">Intermediate</option>
                      <option value="Senior Madrasa">Senior Madrasa</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#0F172A] mb-1">Duration</label>
                    <select
                      value={lessonDuration}
                      onChange={(e) => setLessonDuration(e.target.value)}
                      className="w-full px-3 py-2.5 min-h-[44px] text-xs rounded-xl border border-[#E7E9EE] bg-white font-medium"
                    >
                      <option value="30">30 Mins (Standard)</option>
                      <option value="45">45 Mins</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#0F172A] mb-1">Language</label>
                    <select
                      value={lessonLanguage}
                      onChange={(e) => setLessonLanguage(e.target.value as any)}
                      className="w-full px-3 py-2.5 min-h-[44px] text-xs rounded-xl border border-[#E7E9EE] bg-white font-bold"
                    >
                      <option value="English">English</option>
                      <option value="Tamil">Tamil (தமிழ்)</option>
                      <option value="Arabic">Arabic (العربية)</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={generatingLesson}
                  className="w-full py-3.5 min-h-[48px] px-4 rounded-2xl bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                >
                  {generatingLesson ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-[#37C6A3]" />
                      <span>Preparing Lesson Plan...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-[#37C6A3]" />
                      <span>Generate 30-Min Lesson Plan</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            <div
              className={`${
                mobileView === 'preview' ? 'block' : 'hidden'
              } lg:block lg:col-span-7 bg-white rounded-3xl p-5 sm:p-8 border border-[#E7E9EE] shadow-sm min-h-[500px]`}
            >
              <div className="flex items-center justify-between border-b border-[#E7E9EE] pb-4 mb-4 gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMobileView('config')}
                    className="lg:hidden p-1.5 rounded-lg border border-[#E7E9EE] text-[#7C8A9A] hover:text-[#0F172A]"
                    title="Back to Configuration"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <h3 className="text-sm font-bold text-[#0F172A]">Lesson Plan & Blackboard Structure</h3>
                </div>

                {generatedLesson && (
                  <button
                    type="button"
                    onClick={() => handleCopy(generatedLesson)}
                    className="px-3 py-2 min-h-[40px] text-xs font-semibold rounded-xl border border-[#E7E9EE] hover:bg-slate-50 transition flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedText ? 'Copied' : 'Copy'}</span>
                  </button>
                )}
              </div>

              {generatingLesson ? (
                <AiSparkleLoader
                  title="Crafting Pedagogical Lesson Flow & Whiteboard Notes"
                  messages={lessonMessages}
                />
              ) : generatedLesson ? (
                <AiStreamedText text={generatedLesson} />
              ) : (
                <div className="h-96 flex flex-col items-center justify-center text-center p-6 text-[#7C8A9A]">
                  <Clock className="w-12 h-12 mb-3 opacity-30 text-teal-600" />
                  <h4 className="text-sm font-bold text-[#0F172A]">No Lesson Plan Generated Yet</h4>
                  <p className="text-xs max-w-sm mt-1 leading-relaxed">
                    Enter your topic on the left to generate a step-by-step 30-min Islamic lesson flow with starter hook, explanation, activity, and blackboard diagram.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: EXAM GENERATOR                                                     */}
      {/* ========================================================================= */}
      {activeTab === 'exam' && (
        <div>
          {/* Mobile Segemented Switch (< 1024px) */}
          <div className="lg:hidden flex items-center p-1 bg-[#F7F6F1] rounded-2xl border border-[#E7E9EE] mb-4 print:hidden">
            <button
              type="button"
              onClick={() => setMobileView('config')}
              className={`flex-1 py-2.5 min-h-[44px] text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
                mobileView === 'config'
                  ? 'bg-white text-[#0F172A] shadow-xs border border-[#E7E9EE]'
                  : 'text-[#7C8A9A] hover:text-[#0F172A]'
              }`}
            >
              <span>⚙️ Configuration</span>
            </button>
            <button
              type="button"
              onClick={() => setMobileView('preview')}
              className={`flex-1 py-2.5 min-h-[44px] text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
                mobileView === 'preview'
                  ? 'bg-white text-[#0F172A] shadow-xs border border-[#E7E9EE]'
                  : 'text-[#7C8A9A] hover:text-[#0F172A]'
              }`}
            >
              <span>📄 Exam Preview</span>
              {generatingExam && (
                <span className="w-2 h-2 rounded-full bg-[#37C6A3] animate-pulse" />
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div
              className={`${
                mobileView === 'config' ? 'block' : 'hidden'
              } lg:block lg:col-span-5 bg-white rounded-3xl p-5 sm:p-6 border border-[#E7E9EE] shadow-sm space-y-4 print:hidden`}
            >
              <h2 className="text-sm font-bold text-[#0F172A] flex items-center gap-2 border-b border-[#E7E9EE] pb-3">
                <FileText className="w-4 h-4 text-[#37C6A3]" />
                <span>Exam Paper Configuration</span>
              </h2>

              {examError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                  {examError}
                </div>
              )}

              <form onSubmit={handleGenerateExam} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1">Upload Syllabus PDF (Optional)</label>
                  <div className="border border-dashed border-[#E7E9EE] hover:border-[#37C6A3] rounded-2xl p-4 text-center bg-[#F7F6F1]/50 cursor-pointer transition">
                    <input
                      type="file"
                      id="teacher-exam-pdf"
                      accept="application/pdf"
                      onChange={(e) => setExamFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                    <label htmlFor="teacher-exam-pdf" className="cursor-pointer block min-h-[44px]">
                      <Upload className="w-5 h-5 text-[#37C6A3] mx-auto mb-1" />
                      {examFile ? (
                        <div className="text-xs font-bold text-[#0F172A] truncate">
                          {examFile.name} ({(examFile.size / 1024).toFixed(0)} KB)
                        </div>
                      ) : (
                        <div>
                          <div className="text-xs font-semibold text-[#0F172A]">Choose Syllabus PDF</div>
                          <div className="text-[10px] text-[#7C8A9A]">Parsed in RAM only • 0 MB stored</div>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1">Exam Topic / Scope *</label>
                  <input
                    type="text"
                    placeholder="e.g. Surah Al-Kahf, Pillars of Iman, Purification"
                    value={examTopic}
                    onChange={(e) => setExamTopic(e.target.value)}
                    required={!examFile}
                    className="w-full px-3.5 py-2.5 min-h-[44px] text-xs rounded-xl border border-[#E7E9EE] focus:outline-hidden focus:border-[#37C6A3] bg-white font-medium"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#0F172A] mb-1">Subject</label>
                    <select
                      value={examSubject}
                      onChange={(e) => setExamSubject(e.target.value)}
                      className="w-full px-3 py-2.5 min-h-[44px] text-xs rounded-xl border border-[#E7E9EE] bg-white font-medium"
                    >
                      <option value="Islamic Studies">Islamic Studies</option>
                      <option value="Quran & Tajweed">Quran & Tajweed</option>
                      <option value="Fiqh & Hadith">Fiqh & Hadith</option>
                      <option value="Arabic Language">Arabic Language</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#0F172A] mb-1">Target Language</label>
                    <select
                      value={examLanguage}
                      onChange={(e) => setExamLanguage(e.target.value as any)}
                      className="w-full px-3 py-2.5 min-h-[44px] text-xs rounded-xl border border-[#E7E9EE] bg-white font-bold"
                    >
                      <option value="English">English</option>
                      <option value="Tamil">Tamil (தமிழ்)</option>
                      <option value="Arabic">Arabic (العربية)</option>
                      <option value="Bilingual (English + Tamil)">Bilingual (English + Tamil)</option>
                    </select>
                  </div>
                </div>

                {/* Duration & Marks */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-[#7C8A9A] mb-1">Time (Minutes)</label>
                    <input
                      type="number"
                      min={15}
                      max={180}
                      value={examDuration}
                      onChange={(e) => setExamDuration(e.target.value)}
                      className="w-full px-3 py-2 min-h-[44px] text-xs rounded-xl border border-[#E7E9EE] text-center font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#7C8A9A] mb-1">Total Marks</label>
                    <input
                      type="number"
                      min={10}
                      max={100}
                      value={examMarks}
                      onChange={(e) => setExamMarks(e.target.value)}
                      className="w-full px-3 py-2 min-h-[44px] text-xs rounded-xl border border-[#E7E9EE] text-center font-bold"
                    />
                  </div>
                </div>

                {/* Counts */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold text-[#7C8A9A] mb-1">MCQs</label>
                    <input
                      type="number"
                      min={0}
                      max={25}
                      value={mcqCount}
                      onChange={(e) => setMcqCount(Number(e.target.value))}
                      className="w-full px-2.5 py-2 min-h-[44px] text-xs rounded-xl border border-[#E7E9EE] text-center font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#7C8A9A] mb-1">Short Qs</label>
                    <input
                      type="number"
                      min={0}
                      max={15}
                      value={shortCount}
                      onChange={(e) => setShortCount(Number(e.target.value))}
                      className="w-full px-2.5 py-2 min-h-[44px] text-xs rounded-xl border border-[#E7E9EE] text-center font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#7C8A9A] mb-1">Essays</label>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={essayCount}
                      onChange={(e) => setEssayCount(Number(e.target.value))}
                      className="w-full px-2.5 py-2 min-h-[44px] text-xs rounded-xl border border-[#E7E9EE] text-center font-bold"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={generatingExam}
                  className="w-full py-3.5 min-h-[48px] px-4 rounded-2xl bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                >
                  {generatingExam ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-[#37C6A3]" />
                      <span>Generating Exam & Answers...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-[#37C6A3]" />
                      <span>Generate Exam Paper</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            <div
              className={`${
                mobileView === 'preview' ? 'block' : 'hidden'
              } lg:block lg:col-span-7 bg-white rounded-3xl p-5 sm:p-8 border border-[#E7E9EE] shadow-sm min-h-[500px]`}
            >
              <div className="flex items-center justify-between border-b border-[#E7E9EE] pb-4 mb-4 print:hidden gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMobileView('config')}
                    className="lg:hidden p-1.5 rounded-lg border border-[#E7E9EE] text-[#7C8A9A] hover:text-[#0F172A]"
                    title="Back to Configuration"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <h3 className="text-sm font-bold text-[#0F172A]">Exam Paper & Answer Key</h3>
                </div>

                {generatedExam && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopy(generatedExam)}
                      className="px-3 py-2 min-h-[40px] text-xs font-semibold rounded-xl border border-[#E7E9EE] hover:bg-slate-50 transition flex items-center gap-1.5 cursor-pointer"
                    >
                      {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedText ? 'Copied' : 'Copy'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="px-3.5 py-2 min-h-[40px] text-xs font-bold text-white bg-[#0F172A] hover:bg-[#1E293B] rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5 text-[#37C6A3]" />
                      <span>Print / PDF</span>
                    </button>
                  </div>
                )}
              </div>

              {generatingExam ? (
                <AiSparkleLoader
                  title="Synthesizing Madrasa Exam Paper & Answer Key"
                  messages={examMessages}
                />
              ) : generatedExam ? (
                <AiStreamedText text={generatedExam} />
              ) : (
                <div className="h-96 flex flex-col items-center justify-center text-center p-6 text-[#7C8A9A]">
                  <FileText className="w-12 h-12 mb-3 opacity-30 text-emerald-600" />
                  <h4 className="text-sm font-bold text-[#0F172A]">No Exam Paper Generated Yet</h4>
                  <p className="text-xs max-w-sm mt-1 leading-relaxed">
                    Configure your exam parameters on the left or upload a syllabus PDF to generate structured questions and complete answer key.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: POSTER MAKER                                                       */}
      {/* ========================================================================= */}
      {activeTab === 'poster' && (
        <div>
          {/* Mobile Segemented Switch (< 1024px) */}
          <div className="lg:hidden flex items-center p-1 bg-[#F7F6F1] rounded-2xl border border-[#E7E9EE] mb-4 print:hidden">
            <button
              type="button"
              onClick={() => setMobileView('config')}
              className={`flex-1 py-2.5 min-h-[44px] text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
                mobileView === 'config'
                  ? 'bg-white text-[#0F172A] shadow-xs border border-[#E7E9EE]'
                  : 'text-[#7C8A9A] hover:text-[#0F172A]'
              }`}
            >
              <span>⚙️ Configuration</span>
            </button>
            <button
              type="button"
              onClick={() => setMobileView('preview')}
              className={`flex-1 py-2.5 min-h-[44px] text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
                mobileView === 'preview'
                  ? 'bg-white text-[#0F172A] shadow-xs border border-[#E7E9EE]'
                  : 'text-[#7C8A9A] hover:text-[#0F172A]'
              }`}
            >
              <span>🖼️ Poster Preview</span>
              {generatingPoster && (
                <span className="w-2 h-2 rounded-full bg-[#37C6A3] animate-pulse" />
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div
              className={`${
                mobileView === 'config' ? 'block' : 'hidden'
              } lg:block lg:col-span-5 bg-white rounded-3xl p-5 sm:p-6 border border-[#E7E9EE] shadow-sm space-y-4`}
            >
              <h2 className="text-sm font-bold text-[#0F172A] flex items-center gap-2 border-b border-[#E7E9EE] pb-3">
                <ImageIcon className="w-4 h-4 text-[#37C6A3]" />
                <span>Event Poster Generator</span>
              </h2>

              {posterError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                  {posterError}
                </div>
              )}

              <form onSubmit={handleGeneratePoster} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1">Event Title *</label>
                  <input
                    type="text"
                    placeholder="e.g. Annual Hifz Graduation & Prize Giving"
                    value={posterTitle}
                    onChange={(e) => setPosterTitle(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 min-h-[44px] text-xs rounded-xl border border-[#E7E9EE] focus:outline-hidden focus:border-[#37C6A3] bg-white font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1">Category</label>
                  <select
                    value={posterCategory}
                    onChange={(e) => setPosterCategory(e.target.value)}
                    className="w-full px-3 py-2.5 min-h-[44px] text-xs rounded-xl border border-[#E7E9EE] bg-white font-medium"
                  >
                    <option value="Hifz Convocation">Hifz Convocation</option>
                    <option value="Admissions Open">Admissions Open 2026</option>
                    <option value="Annual Jalsa">Annual Madrasa Jalsa</option>
                    <option value="Special Islamic Lecture">Special Bayaan / Lecture</option>
                    <option value="Ramadan Program">Ramadan Program</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#0F172A] mb-1">Date & Time</label>
                    <input
                      type="text"
                      placeholder="e.g. Sunday at 9 AM"
                      value={posterDate}
                      onChange={(e) => setPosterDate(e.target.value)}
                      className="w-full px-3 py-2.5 min-h-[44px] text-xs rounded-xl border border-[#E7E9EE] bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#0F172A] mb-1">Venue</label>
                    <input
                      type="text"
                      placeholder="e.g. Main Hall"
                      value={posterVenue}
                      onChange={(e) => setPosterVenue(e.target.value)}
                      className="w-full px-3 py-2.5 min-h-[44px] text-xs rounded-xl border border-[#E7E9EE] bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1">Artistic Theme</label>
                  <select
                    value={posterTheme}
                    onChange={(e) => setPosterTheme(e.target.value)}
                    className="w-full px-3 py-2.5 min-h-[44px] text-xs rounded-xl border border-[#E7E9EE] bg-white font-medium"
                  >
                    <option value="Classic Emerald Green & Gold Calligraphy Arabesque">Classic Emerald Green & Gold</option>
                    <option value="Midnight Royal Blue & Silver Crescent Archway">Midnight Royal Blue & Silver</option>
                    <option value="Warm Terracotta & Moroccan Geometric Patterns">Warm Terracotta & Moroccan Mosaic</option>
                    <option value="Clean Minimalist Modern Islamic Typography">Minimalist Modern Islamic</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={generatingPoster}
                  className="w-full py-3.5 min-h-[48px] px-4 rounded-2xl bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                >
                  {generatingPoster ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-[#37C6A3]" />
                      <span>Rendering Poster with Flux...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-[#37C6A3]" />
                      <span>Generate Poster Image</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            <div
              className={`${
                mobileView === 'preview' ? 'block' : 'hidden'
              } lg:block lg:col-span-7 bg-white rounded-3xl p-5 sm:p-8 border border-[#E7E9EE] shadow-sm min-h-[500px]`}
            >
              <div className="flex items-center justify-between border-b border-[#E7E9EE] pb-4 mb-4 gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMobileView('config')}
                    className="lg:hidden p-1.5 rounded-lg border border-[#E7E9EE] text-[#7C8A9A] hover:text-[#0F172A]"
                    title="Back to Configuration"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <h3 className="text-sm font-bold text-[#0F172A]">Rendered Poster Preview</h3>
                </div>

                {generatedPoster && (
                  <a
                    href={generatedPoster.imageDataUrl}
                    download={`madrasa_poster_${Date.now()}.jpg`}
                    className="px-4 py-2 min-h-[40px] text-xs font-bold text-white bg-[#0F172A] hover:bg-[#1E293B] rounded-xl transition flex items-center gap-2 cursor-pointer shadow-sm"
                  >
                    <Download className="w-4 h-4 text-[#37C6A3]" />
                    <span>Download Image</span>
                  </a>
                )}
              </div>

              {generatingPoster ? (
                <AiSparkleLoader
                  title="Synthesizing High-Resolution Islamic Poster"
                  messages={posterMessages}
                />
              ) : generatedPoster ? (
                <div className="flex flex-col items-center">
                  <AiPosterReveal
                    src={generatedPoster.imageDataUrl}
                    alt={generatedPoster.title || 'Islamic Event Poster'}
                  />
                  <div className="mt-3 text-center">
                    <span className="text-[10px] font-mono text-[#7C8A9A]">
                      Generated via {generatedPoster.modelUsed || 'Flux 1 Schnell'} • Direct In-Memory Stream
                    </span>
                  </div>
                </div>
              ) : (
                <div className="h-96 flex flex-col items-center justify-center text-center p-6 text-[#7C8A9A]">
                  <ImageIcon className="w-12 h-12 mb-3 opacity-30 text-emerald-600" />
                  <h4 className="text-sm font-bold text-[#0F172A]">No Poster Rendered Yet</h4>
                  <p className="text-xs max-w-sm mt-1 leading-relaxed">
                    Enter event details and click generate to create a custom Islamic flyer with Cloudflare Workers AI.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: TRANSLATOR                                                         */}
      {/* ========================================================================= */}
      {activeTab === 'translate' && (
        <div className="bg-white rounded-3xl p-5 sm:p-8 border border-[#E7E9EE] shadow-sm space-y-6">
          <div className="border-b border-[#E7E9EE] pb-4">
            <h2 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
              <Languages className="w-4 h-4 text-teal-500" />
              <span>3-Language Islamic Translator</span>
            </h2>
            <p className="text-xs text-[#7C8A9A] mt-0.5">
              High-accuracy translation between Tamil, English, and Arabic preserving Islamic terminology
            </p>
          </div>

          {translationError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
              {translationError}
            </div>
          )}

          <div className="flex items-center justify-center gap-3 sm:gap-4 py-2 flex-wrap">
            <select
              value={sourceLang}
              onChange={(e) => setSourceLang(e.target.value as any)}
              className="px-4 py-2.5 min-h-[44px] rounded-xl border border-[#E7E9EE] text-xs font-bold text-[#0F172A] bg-white cursor-pointer"
            >
              <option value="English">English</option>
              <option value="Tamil">Tamil (தமிழ்)</option>
              <option value="Arabic">Arabic (العربية)</option>
            </select>

            <button
              type="button"
              onClick={handleSwapLanguages}
              className="p-2.5 min-h-[44px] min-w-[44px] rounded-xl border border-[#E7E9EE] hover:bg-slate-50 transition cursor-pointer text-[#7C8A9A] hover:text-[#0F172A] flex items-center justify-center"
              title="Swap Languages"
              aria-label="Swap Languages"
            >
              <ArrowRightLeft className="w-4 h-4" />
            </button>

            <select
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value as any)}
              className="px-4 py-2.5 min-h-[44px] rounded-xl border border-[#E7E9EE] text-xs font-bold text-[#0F172A] bg-white cursor-pointer"
            >
              <option value="Tamil">Tamil (தமிழ்)</option>
              <option value="English">English</option>
              <option value="Arabic">Arabic (العربية)</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-[#0F172A]">
                <span>Source Text ({sourceLang})</span>
                <span className="text-[10px] text-[#7C8A9A] font-normal">{inputText.length} characters</span>
              </div>
              <textarea
                rows={8}
                placeholder="Enter circular, announcement, or lesson text to translate..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="w-full p-4 text-xs sm:text-sm rounded-2xl border border-[#E7E9EE] focus:outline-hidden focus:border-[#37C6A3] bg-[#F7F6F1]/50 font-sans leading-relaxed"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-[#0F172A]">
                <span>Translated Output ({targetLang})</span>
                {translatedResult && (
                  <button
                    type="button"
                    onClick={() => handleCopy(translatedResult)}
                    className="text-[11px] font-semibold text-[#37C6A3] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedText ? 'Copied' : 'Copy'}</span>
                  </button>
                )}
              </div>
              <div className="w-full h-[190px] sm:h-[200px] p-4 text-xs sm:text-sm rounded-2xl border border-[#E7E9EE] bg-white overflow-y-auto leading-relaxed whitespace-pre-wrap">
                {translating ? (
                  <div className="h-full flex flex-col items-center justify-center text-center">
                    <RefreshCw className="w-5 h-5 text-[#37C6A3] animate-spin mb-2" />
                    <span className="text-xs text-[#7C8A9A] font-medium animate-pulse">
                      {translateMessages[0]}
                    </span>
                  </div>
                ) : translatedResult ? (
                  <span className="text-[#0F172A]">{translatedResult}</span>
                ) : (
                  <span className="text-[#7C8A9A] italic">Translation will appear here...</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={handleTranslate}
              disabled={translating || !inputText.trim()}
              className="w-full sm:w-auto py-3.5 min-h-[48px] px-6 rounded-2xl bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
            >
              {translating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-[#37C6A3]" />
                  <span>Translating...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-[#37C6A3]" />
                  <span>Translate to {targetLang}</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Floating Bottom-Right Round AI Orb / Quick-Action Button */}
      <div className="fixed bottom-5 right-5 z-40 print:hidden">
        <div className="relative group">
          <div className="absolute right-16 top-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-2 group-hover:translate-x-0 whitespace-nowrap z-50">
            <div className="bg-[#0F172A] text-white px-3.5 py-2 rounded-xl border border-emerald-500/30 shadow-2xl flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-[#37C6A3]" />
              <div className="text-left">
                <div className="text-xs font-bold leading-none text-white">Ask AI Copilot</div>
                <div className="text-[10px] text-slate-400 mt-0.5 leading-none">Exam, Lesson & Poster Tools</div>
              </div>
              <div className="w-2 h-2 bg-[#0F172A] border-r border-t border-emerald-500/30 rotate-45 absolute -right-1 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <span className="absolute inset-0 rounded-full bg-[#37C6A3]/30 animate-orb-halo pointer-events-none" />

          <button
            type="button"
            onClick={() => {
              document.getElementById('teacher-workspace-top')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className="relative w-14 h-14 min-h-[56px] min-w-[56px] rounded-full bg-[#0F172A] hover:bg-[#1E293B] text-[#37C6A3] border-2 border-[#37C6A3] shadow-[0_4px_24px_rgba(55,198,163,0.35)] hover:shadow-[0_6px_30px_rgba(55,198,163,0.55)] transition-all duration-300 flex items-center justify-center cursor-pointer animate-orb-float group-hover:scale-105 active:scale-95"
            aria-label="Ustadh AI Copilot Active"
            title="Ustadh AI Copilot Active"
          >
            <Sparkles className="w-6 h-6 text-[#37C6A3] group-hover:rotate-12 transition-transform duration-300" />
            <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#37C6A3] opacity-75" />
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-[#0F172A]" />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
