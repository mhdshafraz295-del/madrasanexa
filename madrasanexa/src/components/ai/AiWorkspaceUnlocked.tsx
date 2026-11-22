import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  FileText,
  Clock,
  Image as ImageIcon,
  Languages,
  Upload,
  Printer,
  Copy,
  Check,
  Download,
  RefreshCw,
  AlertCircle,
  ArrowRightLeft,
  ChevronLeft,
} from 'lucide-react';
import { aiService, type AiStatusResponse } from '../../services/ai.service';

interface AiWorkspaceUnlockedProps {
  statusData: AiStatusResponse;
  onRefresh?: () => void;
  isTeacher?: boolean;
}

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
      {/* Pulsing Emerald Aura & Rotating Sparkle */}
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

      {/* Rotating Status Message */}
      <div className="h-6 mt-2 flex items-center justify-center overflow-hidden">
        <p key={msgIndex} className="text-xs font-semibold text-emerald-700 animate-fade-in transition-all">
          ✨ {messages[msgIndex]}
        </p>
      </div>

      {/* Indeterminate Gradient Progress Bar */}
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
// Main Workspace Component
// =========================================================================
export default function AiWorkspaceUnlocked({
  statusData,
  onRefresh,
}: AiWorkspaceUnlockedProps) {
  const [activeTab, setActiveTab] = useState<'exam' | 'lesson' | 'poster' | 'translate'>('exam');
  const [mobileView, setMobileView] = useState<'config' | 'preview'>('config');
  const [copiedText, setCopiedText] = useState(false);

  // Status cycling messages
  const examMessages = [
    'Parsing PDF syllabus strictly in RAM memory (0 MB saved)...',
    'Analyzing curriculum objectives & Islamic concepts...',
    'Generating multiple choice questions with authentic options...',
    'Drafting structured short questions & essay rubrics...',
    'Synthesizing comprehensive answer keys with Quran/Hadith references...',
  ];

  const lessonMessages = [
    'Structuring 30-minute Islamic lesson pedagogy...',
    'Crafting 5-minute engaging Starter Hook...',
    'Designing 15-minute Core Instruction with authentic proofs...',
    'Creating 7-minute interactive student activity...',
    'Synthesizing blackboard summary flow and plenary...',
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

  // Tool 1: Exam Generator State
  const [examFile, setExamFile] = useState<File | null>(null);
  const [examTopic, setExamTopic] = useState('');
  const [examSubject, setExamSubject] = useState('Islamic Studies');
  const [examGrade, setExamGrade] = useState('Grade 6-8 (Middle)');
  const [examLanguage, setExamLanguage] = useState<'English' | 'Tamil' | 'Arabic' | 'Bilingual (English + Tamil)'>('English');
  const [examDuration, setExamDuration] = useState('60');
  const [examMarks, setExamMarks] = useState('50');
  const [mcqCount, setMcqCount] = useState(5);
  const [shortCount, setShortCount] = useState(4);
  const [essayCount, setEssayCount] = useState(2);
  const [generatingExam, setGeneratingExam] = useState(false);
  const [generatedExam, setGeneratedExam] = useState<string | null>(null);
  const [examError, setExamError] = useState<string | null>(null);

  // Tool 2: Ustadh Lesson Planner State
  const [lessonTopic, setLessonTopic] = useState('');
  const [lessonSubject, setLessonSubject] = useState('Fiqh & Ahkam');
  const [lessonGrade, setLessonGrade] = useState('Intermediate');
  const [lessonDuration, setLessonDuration] = useState('30');
  const [lessonLanguage, setLessonLanguage] = useState<'English' | 'Tamil' | 'Arabic'>('English');
  const [generatingLesson, setGeneratingLesson] = useState(false);
  const [generatedLesson, setGeneratedLesson] = useState<string | null>(null);
  const [lessonError, setLessonError] = useState<string | null>(null);

  // Tool 3: Poster Maker State
  const [posterTitle, setPosterTitle] = useState('');
  const [posterCategory, setPosterCategory] = useState('Hifz Convocation');
  const [posterDate, setPosterDate] = useState('');
  const [posterVenue, setPosterVenue] = useState('');
  const [posterTheme, setPosterTheme] = useState('Classic Emerald Green & Gold Calligraphy Arabesque');
  const [generatingPoster, setGeneratingPoster] = useState(false);
  const [generatedPoster, setGeneratedPoster] = useState<{
    imageDataUrl: string;
    title: string;
    modelUsed: string;
  } | null>(null);
  const [posterError, setPosterError] = useState<string | null>(null);

  // Tool 4: Multilingual Translator State
  const [sourceLang, setSourceLang] = useState<'English' | 'Tamil' | 'Arabic'>('English');
  const [targetLang, setTargetLang] = useState<'Tamil' | 'English' | 'Arabic'>('Tamil');
  const [inputText, setInputText] = useState('');
  const [translating, setTranslating] = useState(false);
  const [translatedResult, setTranslatedResult] = useState<string | null>(null);
  const [translationError, setTranslationError] = useState<string | null>(null);

  // Copy helper
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  // Print helper for exam paper
  const printExamPaper = () => {
    window.print();
  };

  // Swap translation languages
  const handleSwapLanguages = () => {
    const temp = sourceLang;
    setSourceLang(targetLang as any);
    setTargetLang(temp as any);
    if (translatedResult) {
      setInputText(translatedResult);
      setTranslatedResult('');
    }
  };

  // Submit Exam Generator
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

      const res = await aiService.generateExamPaper(formData);
      setGeneratedExam(res.examContent);
    } catch (err: any) {
      setExamError(err.response?.data?.message || err.message || 'Failed to generate exam paper.');
    } finally {
      setGeneratingExam(false);
    }
  };

  // Submit Lesson Planner
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

      const res = await aiService.generateLessonPlan(formData);
      setGeneratedLesson(res.lessonPlan);
    } catch (err: any) {
      setLessonError(err.response?.data?.message || err.message || 'Failed to generate lesson plan.');
    } finally {
      setGeneratingLesson(false);
    }
  };

  // Submit Poster Maker
  const handleGeneratePoster = async (e: React.FormEvent) => {
    e.preventDefault();
    setPosterError(null);
    setGeneratingPoster(true);
    setMobileView('preview');
    try {
      const res = await aiService.generatePoster({
        title: posterTitle,
        category: posterCategory,
        dateText: posterDate,
        venue: posterVenue,
        themePrompt: posterTheme,
      });
      setGeneratedPoster(res);
    } catch (err: any) {
      setPosterError(err.response?.data?.message || err.message || 'Failed to generate poster.');
    } finally {
      setGeneratingPoster(false);
    }
  };

  // Submit Translator
  const handleTranslate = async (e: React.FormEvent) => {
    e.preventDefault();
    setTranslationError(null);
    setTranslating(true);
    try {
      const res = await aiService.translateContent({
        text: inputText,
        sourceLanguage: sourceLang,
        targetLanguage: targetLang,
      });
      setTranslatedResult(res.translatedText);
    } catch (err: any) {
      setTranslationError(err.response?.data?.message || err.message || 'Failed to translate text.');
    } finally {
      setTranslating(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Workspace Header */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-[#E7E9EE] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-[#0F172A] text-[#37C6A3] flex items-center justify-center font-bold shadow-xs shrink-0">
            <Sparkles className="w-6 h-6 text-[#37C6A3]" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-extrabold text-[#0F172A] tracking-tight">
                MadrasaNexa Smart AI Assistant
              </h1>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                Active Subscription
              </span>
            </div>
            <p className="text-xs text-[#7C8A9A] mt-0.5">
              Isolated Islamic Copilot • Zero database queries • In-memory RAM processing
            </p>
          </div>
        </div>

        {/* Expiry Pill & Refresh */}
        <div className="flex items-center gap-3">
          {statusData.aiExpiresAt && (
            <div className="text-right">
              <div className="text-[10px] text-[#7C8A9A] uppercase tracking-wider font-bold">Expires On</div>
              <div className="text-xs font-mono font-bold text-[#0F172A]">
                {new Date(statusData.aiExpiresAt).toLocaleDateString()}
                {statusData.daysRemaining !== null && (
                  <span className="text-[#37C6A3] ml-1">({statusData.daysRemaining}d left)</span>
                )}
              </div>
            </div>
          )}
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-2.5 min-h-[44px] min-w-[44px] text-[#7C8A9A] hover:text-[#0F172A] rounded-xl border border-[#E7E9EE] bg-white transition cursor-pointer flex items-center justify-center"
              title="Refresh AI Status"
              aria-label="Refresh AI Status"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-[#E7E9EE] pb-2 overflow-x-auto print:hidden">
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
          <span>Zero-Storage PDF Exam Generator</span>
        </button>

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
          <span>Ustadh 30-Min Lesson Planner</span>
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
          <span>Madrasa Poster Maker (Flux)</span>
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
      {/* TAB 1: ZERO-STORAGE PDF EXAM GENERATOR                                     */}
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
            {/* Controls Column */}
            <div
              className={`${
                mobileView === 'config' ? 'block' : 'hidden'
              } lg:block lg:col-span-5 bg-white rounded-3xl p-5 sm:p-6 border border-[#E7E9EE] shadow-sm space-y-4 print:hidden`}
            >
              <div className="border-b border-[#E7E9EE] pb-3">
                <h2 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#37C6A3]" />
                  <span>Exam Configuration</span>
                </h2>
                <p className="text-[11px] text-[#7C8A9A] mt-0.5">
                  Upload book/syllabus PDF (RAM only, 0 MB saved) or enter topic
                </p>
              </div>

              {examError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{examError}</span>
                </div>
              )}

              <form onSubmit={handleGenerateExam} className="space-y-4">
                {/* PDF Upload */}
                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1">
                    Upload Syllabus / Textbook PDF (Optional)
                  </label>
                  <div className="border border-dashed border-[#E7E9EE] hover:border-[#37C6A3] rounded-2xl p-4 text-center bg-[#F7F6F1]/50 cursor-pointer transition">
                    <input
                      type="file"
                      id="exam-pdf"
                      accept="application/pdf"
                      onChange={(e) => setExamFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                    <label htmlFor="exam-pdf" className="cursor-pointer block min-h-[44px]">
                      <Upload className="w-5 h-5 text-[#37C6A3] mx-auto mb-1" />
                      {examFile ? (
                        <div className="text-xs font-bold text-[#0F172A] truncate">
                          {examFile.name} ({(examFile.size / 1024).toFixed(0)} KB)
                        </div>
                      ) : (
                        <div>
                          <div className="text-xs font-semibold text-[#0F172A]">Choose Syllabus PDF</div>
                          <div className="text-[10px] text-[#7C8A9A]">RAM In-Memory extraction only</div>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                {/* Topic / Scope */}
                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1">
                    Exam Topic / Scope <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Surah Al-Kahf Tafseer, Pillars of Islam, Janazah Fiqh"
                    value={examTopic}
                    onChange={(e) => setExamTopic(e.target.value)}
                    required={!examFile}
                    className="w-full px-3.5 py-2.5 min-h-[44px] text-xs rounded-xl border border-[#E7E9EE] focus:outline-hidden focus:border-[#37C6A3] bg-white font-medium"
                  />
                </div>

                {/* Subject & Grade Level */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#0F172A] mb-1">Subject</label>
                    <select
                      value={examSubject}
                      onChange={(e) => setExamSubject(e.target.value)}
                      className="w-full px-3 py-2.5 min-h-[44px] text-xs rounded-xl border border-[#E7E9EE] focus:outline-hidden focus:border-[#37C6A3] bg-white font-medium"
                    >
                      <option value="Islamic Studies">Islamic Studies</option>
                      <option value="Quran & Tajweed">Quran & Tajweed</option>
                      <option value="Fiqh & Hadith">Fiqh & Hadith</option>
                      <option value="Arabic Language">Arabic Language</option>
                      <option value="Seerah & Islamic History">Seerah</option>
                      <option value="Aqeedah & Akhlaq">Aqeedah & Akhlaq</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#0F172A] mb-1">Grade / Level</label>
                    <select
                      value={examGrade}
                      onChange={(e) => setExamGrade(e.target.value)}
                      className="w-full px-3 py-2.5 min-h-[44px] text-xs rounded-xl border border-[#E7E9EE] focus:outline-hidden focus:border-[#37C6A3] bg-white font-medium"
                    >
                      <option value="Primary (Grade 1-5)">Primary (Gr 1-5)</option>
                      <option value="Grade 6-8 (Middle)">Middle (Gr 6-8)</option>
                      <option value="Senior (Grade 9-11)">Senior (Gr 9-11)</option>
                      <option value="Hifz Program">Hifz Program</option>
                      <option value="Alim / Alimah Course">Alim / Alimah</option>
                    </select>
                  </div>
                </div>

                {/* Output Language */}
                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1">Target Language</label>
                  <select
                    value={examLanguage}
                    onChange={(e) => setExamLanguage(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 min-h-[44px] text-xs rounded-xl border border-[#E7E9EE] focus:outline-hidden focus:border-[#37C6A3] bg-white font-bold text-[#0F172A]"
                  >
                    <option value="English">English</option>
                    <option value="Tamil">Tamil (தமிழ்)</option>
                    <option value="Arabic">Arabic (العربية)</option>
                    <option value="Bilingual (English + Tamil)">Bilingual (English + Tamil)</option>
                  </select>
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

                {/* Generate Button */}
                <button
                  type="submit"
                  disabled={generatingExam}
                  className="w-full py-3.5 min-h-[48px] px-4 rounded-2xl bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs sm:text-sm font-bold tracking-wide transition flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                >
                  {generatingExam ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-[#37C6A3]" />
                      <span>Generating Exam & Answer Key...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-[#37C6A3]" />
                      <span>Generate Structured Exam Paper</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Output Preview Column */}
            <div
              className={`${
                mobileView === 'preview' ? 'block' : 'hidden'
              } lg:block lg:col-span-7 bg-white rounded-3xl p-5 sm:p-8 border border-[#E7E9EE] shadow-sm min-h-[500px] flex flex-col justify-between`}
            >
              <div>
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
                    <h3 className="text-sm font-bold text-[#0F172A]">A4 Exam Paper & Answer Key</h3>
                  </div>

                  {generatedExam && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopy(generatedExam)}
                        className="px-3 py-2 min-h-[40px] text-xs font-semibold rounded-xl border border-[#E7E9EE] hover:bg-slate-50 transition flex items-center gap-1.5 cursor-pointer"
                      >
                        {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedText ? 'Copied' : 'Copy Text'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={printExamPaper}
                        className="px-3.5 py-2 min-h-[40px] text-xs font-bold text-white bg-[#0F172A] hover:bg-[#1E293B] rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs"
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
                    <div className="w-16 h-16 rounded-3xl bg-[#F7F6F1] flex items-center justify-center text-[#7C8A9A] mb-3">
                      <FileText className="w-8 h-8 text-slate-400" />
                    </div>
                    <h4 className="text-sm font-bold text-[#0F172A]">No Exam Paper Generated Yet</h4>
                    <p className="text-xs max-w-sm mt-1 leading-relaxed">
                      Configure your exam parameters on the left or upload a syllabus PDF. Your complete examination paper with MCQ choices,
                      rubrics, and full answer keys will appear here.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: USTADH 30-MIN LESSON PLANNER                                        */}
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
              <div className="border-b border-[#E7E9EE] pb-3">
                <h2 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                  <Clock className="w-4 h-4 text-teal-500" />
                  <span>Ustadh Lesson Planner</span>
                </h2>
                <p className="text-[11px] text-[#7C8A9A] mt-0.5">
                  Generate 30-minute structured Islamic lessons with blackboard diagrams
                </p>
              </div>

              {lessonError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{lessonError}</span>
                </div>
              )}

              <form onSubmit={handleGenerateLesson} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1">
                    Lesson Topic <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Adab of Eating in Islam, Conditions of Wudu, Treaty of Hudaybiyyah"
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
                      className="w-full px-3 py-2.5 min-h-[44px] text-xs rounded-xl border border-[#E7E9EE] focus:outline-hidden focus:border-[#37C6A3] bg-white font-medium"
                    >
                      <option value="Fiqh & Ahkam">Fiqh & Ahkam</option>
                      <option value="Aqeedah & Tawheed">Aqeedah & Tawheed</option>
                      <option value="Seerah & Hadith">Seerah & Hadith</option>
                      <option value="Adab & Akhlaq">Adab & Akhlaq</option>
                      <option value="Quranic Studies">Quranic Studies</option>
                      <option value="Arabic Grammar">Arabic Grammar</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#0F172A] mb-1">Class Level</label>
                    <select
                      value={lessonGrade}
                      onChange={(e) => setLessonGrade(e.target.value)}
                      className="w-full px-3 py-2.5 min-h-[44px] text-xs rounded-xl border border-[#E7E9EE] focus:outline-hidden focus:border-[#37C6A3] bg-white font-medium"
                    >
                      <option value="Beginner / Maktab">Beginner / Maktab</option>
                      <option value="Intermediate">Intermediate</option>
                      <option value="Senior Madrasa">Senior Madrasa</option>
                      <option value="Hifz Students">Hifz Students</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#0F172A] mb-1">Duration</label>
                    <select
                      value={lessonDuration}
                      onChange={(e) => setLessonDuration(e.target.value)}
                      className="w-full px-3 py-2.5 min-h-[44px] text-xs rounded-xl border border-[#E7E9EE] focus:outline-hidden focus:border-[#37C6A3] bg-white font-medium"
                    >
                      <option value="30">30 Minutes (Standard)</option>
                      <option value="45">45 Minutes</option>
                      <option value="60">60 Minutes</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#0F172A] mb-1">Language</label>
                    <select
                      value={lessonLanguage}
                      onChange={(e) => setLessonLanguage(e.target.value as any)}
                      className="w-full px-3 py-2.5 min-h-[44px] text-xs rounded-xl border border-[#E7E9EE] focus:outline-hidden focus:border-[#37C6A3] bg-white font-bold"
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
                  className="w-full py-3.5 min-h-[48px] px-4 rounded-2xl bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs sm:text-sm font-bold tracking-wide transition flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                >
                  {generatingLesson ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-[#37C6A3]" />
                      <span>Crafting 30-Min Lesson Plan...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-[#37C6A3]" />
                      <span>Generate Structured Lesson Plan</span>
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
                  <h3 className="text-sm font-bold text-[#0F172A]">Lesson Plan & Whiteboard Flow</h3>
                </div>

                {generatedLesson && (
                  <button
                    type="button"
                    onClick={() => handleCopy(generatedLesson)}
                    className="px-3 py-2 min-h-[40px] text-xs font-semibold rounded-xl border border-[#E7E9EE] hover:bg-slate-50 transition flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedText ? 'Copied' : 'Copy Plan'}</span>
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
                    Enter your topic and let the Ustadh Copilot break down a 30-minute pedagogical flow with Starter Hook, Core Instruction, Student Activity, and Blackboard Layout.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: MADRASA EVENT POSTER & FLYER MAKER                                   */}
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
              <div className="border-b border-[#E7E9EE] pb-3">
                <h2 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-[#37C6A3]" />
                  <span>Event Poster Generator</span>
                </h2>
                <p className="text-[11px] text-[#7C8A9A] mt-0.5">
                  Generate high-res Islamic posters powered by Cloudflare Flux 1 Schnell
                </p>
              </div>

              {posterError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{posterError}</span>
                </div>
              )}

              <form onSubmit={handleGeneratePoster} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1">
                    Event Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Annual Hifz Convocation & Khatm-ul-Quran"
                    value={posterTitle}
                    onChange={(e) => setPosterTitle(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 min-h-[44px] text-xs rounded-xl border border-[#E7E9EE] focus:outline-hidden focus:border-[#37C6A3] bg-white font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1">Event Category</label>
                  <select
                    value={posterCategory}
                    onChange={(e) => setPosterCategory(e.target.value)}
                    className="w-full px-3 py-2.5 min-h-[44px] text-xs rounded-xl border border-[#E7E9EE] focus:outline-hidden focus:border-[#37C6A3] bg-white font-medium"
                  >
                    <option value="Hifz Convocation">Hifz Graduation / Convocation</option>
                    <option value="Admissions Open">Admissions Open 2026</option>
                    <option value="Annual Jalsa">Annual Madrasa Jalsa / Prize Giving</option>
                    <option value="Special Islamic Lecture">Special Bayaan / Islamic Lecture</option>
                    <option value="Ramadan Program">Ramadan & Taraweeh Program</option>
                    <option value="Youth Workshop">Youth Islamic Workshop</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#0F172A] mb-1">Date & Time</label>
                    <input
                      type="text"
                      placeholder="e.g. Sunday, Dec 15 at 9 AM"
                      value={posterDate}
                      onChange={(e) => setPosterDate(e.target.value)}
                      className="w-full px-3 py-2.5 min-h-[44px] text-xs rounded-xl border border-[#E7E9EE] focus:outline-hidden focus:border-[#37C6A3] bg-white text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#0F172A] mb-1">Venue</label>
                    <input
                      type="text"
                      placeholder="e.g. Main Auditorium"
                      value={posterVenue}
                      onChange={(e) => setPosterVenue(e.target.value)}
                      className="w-full px-3 py-2.5 min-h-[44px] text-xs rounded-xl border border-[#E7E9EE] focus:outline-hidden focus:border-[#37C6A3] bg-white text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1">Theme / Artistic Style</label>
                  <select
                    value={posterTheme}
                    onChange={(e) => setPosterTheme(e.target.value)}
                    className="w-full px-3 py-2.5 min-h-[44px] text-xs rounded-xl border border-[#E7E9EE] focus:outline-hidden focus:border-[#37C6A3] bg-white font-medium"
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
                  className="w-full py-3.5 min-h-[48px] px-4 rounded-2xl bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs sm:text-sm font-bold tracking-wide transition flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                >
                  {generatingPoster ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-[#37C6A3]" />
                      <span>Rendering Poster with Flux 1 Schnell...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-[#37C6A3]" />
                      <span>Generate Poster Image</span>
                    </>
                  )}
                </button>

                <p className="text-[10px] text-[#7C8A9A] text-center">
                  Zero Cloud Storage: Generated image is delivered directly as high-res download to your device.
                </p>
              </form>
            </div>

            <div
              className={`${
                mobileView === 'preview' ? 'block' : 'hidden'
              } lg:block lg:col-span-7 bg-white rounded-3xl p-5 sm:p-8 border border-[#E7E9EE] shadow-sm min-h-[500px] flex flex-col justify-between`}
            >
              <div>
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
                      alt={generatedPoster.title}
                    />
                    <div className="mt-3 text-center">
                      <span className="text-[10px] font-mono text-[#7C8A9A]">
                        Generated via {generatedPoster.modelUsed} • Direct In-Memory Stream
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: MULTILINGUAL TRANSLATOR                                             */}
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
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{translationError}</span>
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
              aria-label="Swap Source and Target Languages"
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
            {/* Input Box */}
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

            {/* Output Box */}
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
              className="w-full sm:w-auto py-3.5 min-h-[48px] px-6 rounded-2xl bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs sm:text-sm font-bold tracking-wide transition flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
            >
              {translating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-[#37C6A3]" />
                  <span>Translating Text...</span>
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
    </div>
  );
}
