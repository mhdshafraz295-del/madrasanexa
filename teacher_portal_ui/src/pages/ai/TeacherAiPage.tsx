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
  BookOpen,
  Palette,
  Megaphone,
  Mic,
  Award,
  Layers,
  Zap,
} from 'lucide-react';
import { teacherAiService, type AiStatusResponse } from '../../services/ai.service';
import AiRobotMascot from '../../components/ai/AiRobotMascot';

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
      {/* 3D Thinking AI Robot Mascot with Pulsing Emerald Aura */}
      <div className="relative mb-5 flex flex-col items-center">
        <div className="absolute -inset-4 rounded-full bg-[#37C6A3]/20 blur-xl animate-pulse pointer-events-none" />
        <div className="relative w-28 h-28 sm:w-32 sm:h-32 flex items-center justify-center">
          <AiRobotMascot variant="thinking" className="w-full h-full drop-shadow-xl" />
        </div>
        <span className="absolute bottom-1 right-2 flex h-4 w-4">
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
  const [activeTab, setActiveTab] = useState<
    'lesson' | 'exam' | 'poster' | 'translate' | 'circular' | 'hifz' | 'speech' | 'summarizer'
  >('lesson');
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

  const circularMessages = [
    'Composing Islamic greeting & respectful opening (Bismillah, Assalamu Alaikum)...',
    'Structuring Madrasa announcement details, key dates & venue...',
    'Applying respectful Islamic etiquette & Du\'a for parents...',
    'Polishing formatting ready for print and messaging distribution...',
  ];

  const hifzMessages = [
    'Selecting Quranic portion for memorization & revision verification...',
    'Formulating Tajweed rule drills (Makharij, Ghunnah, Idgham, Qalqalah)...',
    'Building oral recitation rubric & evaluation metrics...',
    'Generating complete Ustadh grading key with Ayah references...',
  ];

  const speechMessages = [
    'Drafting speech opening: Khutbah al-Hajah, Hamd, and Salawat...',
    'Synthesizing authentic Quranic Ayahs and Sahih Hadith citations...',
    'Formulating structured speech body with inspiring practical lessons...',
    'Composing memorable closing call-to-action & heartfelt Du\'a...',
  ];

  const summaryMessages = [
    'Parsing PDF textbook chapters strictly in RAM (0 MB saved to disk)...',
    'Extracting key learning objectives & Islamic core concepts...',
    'Synthesizing concise study notes and Islamic glossary terms...',
    'Compiling structured bullet points for Ustadh revision...',
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

  // Tool 5: Parent Circular & Notice Writer State
  const [circularOccasion, setCircularOccasion] = useState('Jummah Reminder & Student Etiquette');
  const [circularCustomTopic, setCircularCustomTopic] = useState('');
  const [circularAudience, setCircularAudience] = useState('Parents of All Students');
  const [circularLanguage, setCircularLanguage] = useState<'English' | 'Tamil' | 'Arabic' | 'Bilingual (Tamil + English)'>('English');
  const [circularKeyDates, setCircularKeyDates] = useState('');
  const [circularSender, setCircularSender] = useState('Madrasa Administration / Principal');
  const [generatingCircular, setGeneratingCircular] = useState(false);
  const [generatedCircular, setGeneratedCircular] = useState<string | null>(null);
  const [circularError, setCircularError] = useState<string | null>(null);

  // Tool 6: Hifz & Tajweed Worksheet Builder State
  const [hifzPortion, setHifzPortion] = useState('Juz 30 (Amma) - Selected Surahs');
  const [hifzFocus, setHifzFocus] = useState('Ayah Completion & Memorization Drill');
  const [hifzGrade, setHifzGrade] = useState('Intermediate Hifz');
  const [hifzLanguage, setHifzLanguage] = useState<'English' | 'Tamil' | 'Arabic'>('English');
  const [hifzCount, setHifzCount] = useState(5);
  const [generatingHifz, setGeneratingHifz] = useState(false);
  const [generatedHifz, setGeneratedHifz] = useState<string | null>(null);
  const [hifzError, setHifzError] = useState<string | null>(null);

  // Tool 7: Bayan & Student Speech Writer State
  const [speechTopic, setSpeechTopic] = useState('Respecting Parents in Islam (Birr al-Walidayn)');
  const [speechOccasion, setSpeechOccasion] = useState('Morning Assembly Speech (3-5 mins)');
  const [speechDuration, setSpeechDuration] = useState('5 Minutes');
  const [speechAudience, setSpeechAudience] = useState('Madrasa Students (All Grades)');
  const [speechLanguage, setSpeechLanguage] = useState<'English' | 'Tamil' | 'Arabic'>('English');
  const [generatingSpeech, setGeneratingSpeech] = useState(false);
  const [generatedSpeech, setGeneratedSpeech] = useState<string | null>(null);
  const [speechError, setSpeechError] = useState<string | null>(null);

  // Tool 8: PDF Syllabus & Chapter Summarizer State
  const [summaryFile, setSummaryFile] = useState<File | null>(null);
  const [summaryTitle, setSummaryTitle] = useState('');
  const [summaryType, setSummaryType] = useState('Comprehensive Chapter Study Notes & Key Concepts');
  const [summaryLanguage, setSummaryLanguage] = useState<'English' | 'Tamil' | 'Arabic'>('English');
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [generatedSummary, setGeneratedSummary] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);

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

  // Generate Circular
  const handleGenerateCircular = async (e: React.FormEvent) => {
    e.preventDefault();
    setCircularError(null);
    setGeneratingCircular(true);
    setMobileView('preview');
    try {
      const formData = new FormData();
      formData.append(
        'topic',
        `Official Madrasa Parent Circular on "${circularOccasion}". Key Dates/Deadlines: ${circularKeyDates || 'Standard school hours'}. Sender: ${circularSender}. Important notes: ${circularCustomTopic || 'Ensure students maintain strict Islamic punctuality and adab.'}. Format: Formal Madrasa letterhead with Bismillah, respectful opening, clear schedule, rules, and closing Du'a.`
      );
      formData.append('subject', 'Official Parent Notice & Circular');
      formData.append('gradeLevel', circularAudience);
      formData.append('durationMinutes', '0');
      formData.append('language', circularLanguage);

      const res = await teacherAiService.generateLessonPlan(formData);
      setGeneratedCircular(res.lessonPlan);
    } catch (err: any) {
      setCircularError(err.message || 'Failed to generate circular notice.');
    } finally {
      setGeneratingCircular(false);
    }
  };

  // Generate Hifz Worksheet
  const handleGenerateHifz = async (e: React.FormEvent) => {
    e.preventDefault();
    setHifzError(null);
    setGeneratingHifz(true);
    setMobileView('preview');
    try {
      const formData = new FormData();
      formData.append(
        'topic',
        `Hifz & Tajweed Assessment Worksheet. Quran Portion: ${hifzPortion}. Evaluation Focus: ${hifzFocus}. Generate: 1. Complete the Ayah drills with missing words, 2. Tajweed rule identification (Ghunnah, Ikhfa, Idgham, Qalqalah), 3. Oral recitation evaluation rubric with marking checklist, 4. Full Ustadh answer key.`
      );
      formData.append('subject', 'Hifz & Tajweed Assessment');
      formData.append('gradeLevel', hifzGrade);
      formData.append('language', hifzLanguage);
      formData.append('durationMinutes', '30');
      formData.append('totalMarks', '50');
      formData.append('mcqCount', '2');
      formData.append('shortCount', String(hifzCount));
      formData.append('essayCount', '1');

      const res = await teacherAiService.generateExamPaper(formData);
      setGeneratedHifz(res.examContent);
    } catch (err: any) {
      setHifzError(err.message || 'Failed to generate Hifz worksheet.');
    } finally {
      setGeneratingHifz(false);
    }
  };

  // Generate Speech
  const handleGenerateSpeech = async (e: React.FormEvent) => {
    e.preventDefault();
    setSpeechError(null);
    setGeneratingSpeech(true);
    setMobileView('preview');
    try {
      const formData = new FormData();
      formData.append(
        'topic',
        `Islamic Speech & Bayan on "${speechTopic}". Occasion: ${speechOccasion}. Duration: ${speechDuration}. Target Audience: ${speechAudience}. Include: Proper Arabic Khutbah/Hamd opening, 2 authentic Quranic Ayahs with meaning, 1-2 Sahih Hadiths with context, 3 practical actionable takeaways for daily life, and inspiring closing Du'a.`
      );
      formData.append('subject', 'Islamic Speech & Bayan Oratory');
      formData.append('gradeLevel', speechAudience);
      formData.append('durationMinutes', speechDuration.split(' ')[0] || '5');
      formData.append('language', speechLanguage);

      const res = await teacherAiService.generateLessonPlan(formData);
      setGeneratedSpeech(res.lessonPlan);
    } catch (err: any) {
      setSpeechError(err.message || 'Failed to generate Islamic speech.');
    } finally {
      setGeneratingSpeech(false);
    }
  };

  // Generate Summary
  const handleGenerateSummary = async (e: React.FormEvent) => {
    e.preventDefault();
    setSummaryError(null);
    setGeneratingSummary(true);
    setMobileView('preview');
    try {
      const formData = new FormData();
      if (summaryFile) formData.append('file', summaryFile);
      formData.append(
        'topic',
        `Curriculum Chapter Study Summary & Revision Notes on "${summaryTitle || 'Uploaded Islamic Textbook Chapter'}". Focus: ${summaryType}. Extract: 1. Core Learning Objectives, 2. Islamic Glossary & Terminology, 3. Comprehensive Chapter Summary in structured bullet points, 4. 5 Essential revision questions for students.`
      );
      formData.append('subject', 'Islamic Textbook Chapter Summary');
      formData.append('gradeLevel', 'All Levels');
      formData.append('durationMinutes', '15');
      formData.append('language', summaryLanguage);

      const res = await teacherAiService.generateLessonPlan(formData);
      setGeneratedSummary(res.lessonPlan);
    } catch (err: any) {
      setSummaryError(err.message || 'Failed to generate chapter summary.');
    } finally {
      setGeneratingSummary(false);
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
          /* 3D AI Robot Mascot Keyframe Animations */
          @keyframes robot-float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-7px); }
          }
          @keyframes robot-wave {
            0% { transform: rotate(0deg); }
            20% { transform: rotate(14deg); }
            40% { transform: rotate(-8deg); }
            60% { transform: rotate(12deg); }
            80% { transform: rotate(-4deg); }
            100% { transform: rotate(0deg); }
          }
          @keyframes robot-think {
            0%, 100% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-3px) rotate(2deg); }
          }
          @keyframes robot-blink {
            0%, 92%, 96%, 100% { transform: scaleY(1); }
            94% { transform: scaleY(0.1); }
          }
          @keyframes robot-pulse {
            0%, 100% { transform: scale(1); opacity: 0.8; }
            50% { transform: scale(1.15); opacity: 1; }
          }
          .animate-robot-float {
            animation: robot-float 3.5s ease-in-out infinite;
          }
          .animate-robot-wave {
            animation: robot-wave 2.2s ease-in-out infinite;
          }
          .animate-robot-think {
            animation: robot-think 3s ease-in-out infinite;
          }
          .animate-robot-blink {
            animation: robot-blink 4.5s ease-in-out infinite;
          }
          .animate-robot-pulse {
            animation: robot-pulse 2s ease-in-out infinite;
          }
          @media (prefers-reduced-motion: reduce) {
            .animate-hero-spin,
            .animate-hero-reverse,
            .animate-hero-pulse,
            .animate-sparkle,
            .animate-badge-shimmer,
            .animate-orb-halo,
            .animate-orb-float,
            .animate-robot-float,
            .animate-robot-wave,
            .animate-robot-think,
            .animate-robot-blink,
            .animate-robot-pulse {
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

          {/* 3D AI Robot Mascot (Waving) Floating on Hero Banner */}
          <div className="absolute right-3 sm:right-8 lg:right-12 top-1/2 -translate-y-1/2 z-20 pointer-events-none select-none">
            <div className="w-22 sm:w-28 lg:w-36 drop-shadow-2xl">
              <AiRobotMascot variant="wave" className="w-full h-auto" />
            </div>
          </div>

          <div className="relative z-10 max-w-xl sm:max-w-2xl">
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

        {/* 8 Feature Capability Cards with 3D Medallions & Quick-Scan Pills */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5">
          {/* Feature 1: Zero-Storage PDF Exam Paper Generator */}
          <div className="bg-white rounded-3xl p-5 border border-[#E7E9EE] shadow-xs hover:border-[#37C6A3]/60 hover:shadow-md hover:-translate-y-1 transition-all duration-300 group flex flex-col justify-between">
            <div>
              <div className="flex items-start gap-3.5">
                {/* 3D Glossy Emerald Medallion */}
                <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 text-white flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/25 border border-emerald-400/40 overflow-hidden group-hover:scale-105 transition-transform duration-300">
                  <span className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/35 to-transparent pointer-events-none" />
                  <FileText className="w-5 h-5 text-white relative z-10" />
                  <span className="absolute -bottom-1 -right-1 w-4.5 h-4.5 rounded-full bg-emerald-800 border border-emerald-400/50 flex items-center justify-center z-10">
                    <Sparkles className="w-2.5 h-2.5 text-[#37C6A3]" />
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1.5 flex-wrap">
                    <h3 className="text-sm font-bold text-[#0F172A] leading-snug">
                      Zero-Storage PDF Exam Generator
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                      RAM-Only
                    </span>
                  </div>
                  <p className="text-xs text-[#7C8A9A] mt-1 leading-relaxed">
                    Upload syllabus or textbook PDFs to instantly synthesize multi-section MCQs, short answers, essays, and answer keys.
                  </p>
                </div>
              </div>
            </div>

            {/* Quick-Scan Visual Pills */}
            <div className="mt-3.5 pt-3.5 border-t border-[#E7E9EE]/80 flex flex-wrap gap-1.5">
              <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-100 flex items-center gap-1">
                <span>📄</span> Upload PDF
              </span>
              <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-100 flex items-center gap-1">
                <span>📝</span> MCQs & Essays
              </span>
              <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-100 flex items-center gap-1">
                <span>✅</span> Answer Key
              </span>
              <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-100 flex items-center gap-1">
                <span>🖨️</span> A4 Print
              </span>
            </div>
          </div>

          {/* Feature 2: Ustadh 30-Min Lesson Planner */}
          <div className="bg-white rounded-3xl p-5 border border-[#E7E9EE] shadow-xs hover:border-[#37C6A3]/60 hover:shadow-md hover:-translate-y-1 transition-all duration-300 group flex flex-col justify-between">
            <div>
              <div className="flex items-start gap-3.5">
                {/* 3D Glossy Dark Navy & Emerald Medallion */}
                <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-[#0F172A] via-slate-800 to-emerald-700 text-white flex items-center justify-center shrink-0 shadow-lg shadow-slate-900/30 border border-slate-700 overflow-hidden group-hover:scale-105 transition-transform duration-300">
                  <span className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                  <Clock className="w-5 h-5 text-[#37C6A3] relative z-10" />
                  <span className="absolute -bottom-1 -right-1 w-4.5 h-4.5 rounded-full bg-slate-900 border border-emerald-500/50 flex items-center justify-center z-10">
                    <BookOpen className="w-2.5 h-2.5 text-emerald-400" />
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1.5 flex-wrap">
                    <h3 className="text-sm font-bold text-[#0F172A] leading-snug">
                      Ustadh 30-Min Lesson Planner
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200">
                      Ustadh Copilot
                    </span>
                  </div>
                  <p className="text-xs text-[#7C8A9A] mt-1 leading-relaxed">
                    Generate structured pedagogical lesson plans with classroom hook, core explanation, exercises, and blackboard diagrams.
                  </p>
                </div>
              </div>
            </div>

            {/* Quick-Scan Visual Pills */}
            <div className="mt-3.5 pt-3.5 border-t border-[#E7E9EE]/80 flex flex-wrap gap-1.5">
              <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-800 border border-slate-200 flex items-center gap-1">
                <span>⏱️</span> 30-Min Flow
              </span>
              <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-800 border border-slate-200 flex items-center gap-1">
                <span>📖</span> Quran Proofs
              </span>
              <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-800 border border-slate-200 flex items-center gap-1">
                <span>🧑‍🏫</span> Board Summary
              </span>
            </div>
          </div>

          {/* Feature 3: Madrasa Event Poster & Flyer Maker */}
          <div className="bg-white rounded-3xl p-5 border border-[#E7E9EE] shadow-xs hover:border-[#37C6A3]/60 hover:shadow-md hover:-translate-y-1 transition-all duration-300 group flex flex-col justify-between">
            <div>
              <div className="flex items-start gap-3.5">
                {/* 3D Glossy Teal-Cyan Medallion */}
                <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-500 via-teal-600 to-cyan-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-teal-500/25 border border-teal-400/40 overflow-hidden group-hover:scale-105 transition-transform duration-300">
                  <span className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/35 to-transparent pointer-events-none" />
                  <ImageIcon className="w-5 h-5 text-white relative z-10" />
                  <span className="absolute -bottom-1 -right-1 w-4.5 h-4.5 rounded-full bg-teal-800 border border-cyan-400/50 flex items-center justify-center z-10">
                    <Palette className="w-2.5 h-2.5 text-cyan-300" />
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1.5 flex-wrap">
                    <h3 className="text-sm font-bold text-[#0F172A] leading-snug">
                      Madrasa Event Poster Maker
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Flux 1 Schnell
                    </span>
                  </div>
                  <p className="text-xs text-[#7C8A9A] mt-1 leading-relaxed">
                    Synthesize Islamic announcement flyers, Hifz graduation posters, and admission banners with Cloudflare Workers AI.
                  </p>
                </div>
              </div>
            </div>

            {/* Quick-Scan Visual Pills */}
            <div className="mt-3.5 pt-3.5 border-t border-[#E7E9EE]/80 flex flex-wrap gap-1.5">
              <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-lg bg-teal-50 text-teal-800 border border-teal-100 flex items-center gap-1">
                <span>🎨</span> 1-Click Poster
              </span>
              <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-lg bg-teal-50 text-teal-800 border border-teal-100 flex items-center gap-1">
                <span>🕌</span> Islamic Design
              </span>
              <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-lg bg-teal-50 text-teal-800 border border-teal-100 flex items-center gap-1">
                <span>⬇️</span> Download
              </span>
            </div>
          </div>

          {/* Feature 4: Multilingual Islamic Translator */}
          <div className="bg-white rounded-3xl p-5 border border-[#E7E9EE] shadow-xs hover:border-[#37C6A3]/60 hover:shadow-md hover:-translate-y-1 transition-all duration-300 group flex flex-col justify-between">
            <div>
              <div className="flex items-start gap-3.5">
                {/* 3D Glossy Emerald-Green Medallion */}
                <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-green-800 text-white flex items-center justify-center shrink-0 shadow-lg shadow-emerald-600/25 border border-emerald-400/40 overflow-hidden group-hover:scale-105 transition-transform duration-300">
                  <span className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/35 to-transparent pointer-events-none" />
                  <Languages className="w-5 h-5 text-white relative z-10" />
                  <span className="absolute -bottom-1 -right-1 w-4.5 h-4.5 rounded-full bg-emerald-900 border border-emerald-400/50 flex items-center justify-center z-10">
                    <Sparkles className="w-2.5 h-2.5 text-[#37C6A3]" />
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1.5 flex-wrap">
                    <h3 className="text-sm font-bold text-[#0F172A] leading-snug">
                      Multilingual Islamic Translator
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200">
                      3 Languages
                    </span>
                  </div>
                  <p className="text-xs text-[#7C8A9A] mt-1 leading-relaxed">
                    Translate administrative circulars, exam questions, and curriculum text across Tamil, English, and Arabic.
                  </p>
                </div>
              </div>
            </div>

            {/* Quick-Scan Visual Pills */}
            <div className="mt-3.5 pt-3.5 border-t border-[#E7E9EE]/80 flex flex-wrap gap-1.5">
              <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-100 flex items-center gap-1">
                <span>🇱🇰/🇮🇳</span> தமிழ்
              </span>
              <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-100 flex items-center gap-1">
                <span>🇬🇧</span> English
              </span>
              <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-100 flex items-center gap-1 font-arabic">
                <span>🇸🇦</span> العربية
              </span>
            </div>
          </div>

          {/* Feature 5: Parent Circular & Notice Writer */}
          <div className="bg-white rounded-3xl p-5 border border-[#E7E9EE] shadow-xs hover:border-[#37C6A3]/60 hover:shadow-md hover:-translate-y-1 transition-all duration-300 group flex flex-col justify-between">
            <div>
              <div className="flex items-start gap-3.5">
                {/* 3D Glossy Indigo/Navy & Emerald Medallion */}
                <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-700 to-slate-900 text-white flex items-center justify-center shrink-0 shadow-lg shadow-indigo-600/25 border border-indigo-400/40 overflow-hidden group-hover:scale-105 transition-transform duration-300">
                  <span className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/35 to-transparent pointer-events-none" />
                  <Megaphone className="w-5 h-5 text-white relative z-10" />
                  <span className="absolute -bottom-1 -right-1 w-4.5 h-4.5 rounded-full bg-slate-900 border border-indigo-400/50 flex items-center justify-center z-10">
                    <FileText className="w-2.5 h-2.5 text-[#37C6A3]" />
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1.5 flex-wrap">
                    <h3 className="text-sm font-bold text-[#0F172A] leading-snug">
                      Parent Circular & Notice Writer
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                      Admin Copilot
                    </span>
                  </div>
                  <p className="text-xs text-[#7C8A9A] mt-1 leading-relaxed">
                    Generate polished parent announcements for Jummah reminders, Ramadan timings, fee circulars, and Annual Jalsa.
                  </p>
                </div>
              </div>
            </div>

            {/* Quick-Scan Visual Pills */}
            <div className="mt-3.5 pt-3.5 border-t border-[#E7E9EE]/80 flex flex-wrap gap-1.5">
              <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-800 border border-indigo-100 flex items-center gap-1">
                <span>📢</span> Parent Notices
              </span>
              <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-800 border border-indigo-100 flex items-center gap-1">
                <span>🕌</span> Islamic Etiquette
              </span>
              <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-800 border border-indigo-100 flex items-center gap-1">
                <span>📋</span> Ready to Send
              </span>
            </div>
          </div>

          {/* Feature 6: Hifz & Tajweed Worksheet Builder */}
          <div className="bg-white rounded-3xl p-5 border border-[#E7E9EE] shadow-xs hover:border-[#37C6A3]/60 hover:shadow-md hover:-translate-y-1 transition-all duration-300 group flex flex-col justify-between">
            <div>
              <div className="flex items-start gap-3.5">
                {/* 3D Glossy Emerald & Gold Medallion */}
                <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 via-teal-700 to-amber-700 text-white flex items-center justify-center shrink-0 shadow-lg shadow-emerald-700/25 border border-emerald-400/40 overflow-hidden group-hover:scale-105 transition-transform duration-300">
                  <span className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/35 to-transparent pointer-events-none" />
                  <BookOpen className="w-5 h-5 text-white relative z-10" />
                  <span className="absolute -bottom-1 -right-1 w-4.5 h-4.5 rounded-full bg-slate-900 border border-amber-400/50 flex items-center justify-center z-10">
                    <Award className="w-2.5 h-2.5 text-amber-300" />
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1.5 flex-wrap">
                    <h3 className="text-sm font-bold text-[#0F172A] leading-snug">
                      Hifz & Tajweed Worksheet Builder
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                      Hifz & Qira'ah
                    </span>
                  </div>
                  <p className="text-xs text-[#7C8A9A] mt-1 leading-relaxed">
                    Build Surah and Ayah completion drills, Makharij & Tajweed rule tests (Ghunnah, Idgham, Ikhfa), and teacher grading rubrics.
                  </p>
                </div>
              </div>
            </div>

            {/* Quick-Scan Visual Pills */}
            <div className="mt-3.5 pt-3.5 border-t border-[#E7E9EE]/80 flex flex-wrap gap-1.5">
              <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-lg bg-amber-50 text-amber-900 border border-amber-200/60 flex items-center gap-1">
                <span>📖</span> Juz/Surah Drills
              </span>
              <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-lg bg-amber-50 text-amber-900 border border-amber-200/60 flex items-center gap-1">
                <span>🎯</span> Tajweed Rules
              </span>
              <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-lg bg-amber-50 text-amber-900 border border-amber-200/60 flex items-center gap-1">
                <span>✅</span> Oral Rubric
              </span>
            </div>
          </div>

          {/* Feature 7: Bayan & Student Speech Writer */}
          <div className="bg-white rounded-3xl p-5 border border-[#E7E9EE] shadow-xs hover:border-[#37C6A3]/60 hover:shadow-md hover:-translate-y-1 transition-all duration-300 group flex flex-col justify-between">
            <div>
              <div className="flex items-start gap-3.5">
                {/* 3D Glossy Slate & Emerald Medallion */}
                <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-800 via-emerald-800 to-teal-900 text-white flex items-center justify-center shrink-0 shadow-lg shadow-slate-900/30 border border-slate-700 overflow-hidden group-hover:scale-105 transition-transform duration-300">
                  <span className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/35 to-transparent pointer-events-none" />
                  <Mic className="w-5 h-5 text-[#37C6A3] relative z-10" />
                  <span className="absolute -bottom-1 -right-1 w-4.5 h-4.5 rounded-full bg-slate-900 border border-emerald-400/50 flex items-center justify-center z-10">
                    <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1.5 flex-wrap">
                    <h3 className="text-sm font-bold text-[#0F172A] leading-snug">
                      Bayan & Student Speech Writer
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200">
                      Minbar & Assembly
                    </span>
                  </div>
                  <p className="text-xs text-[#7C8A9A] mt-1 leading-relaxed">
                    Draft inspiring 3 to 15-minute speeches with authentic Quranic Ayahs, Hadith references, and structured bullet points.
                  </p>
                </div>
              </div>
            </div>

            {/* Quick-Scan Visual Pills */}
            <div className="mt-3.5 pt-3.5 border-t border-[#E7E9EE]/80 flex flex-wrap gap-1.5">
              <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-lg bg-teal-50 text-teal-800 border border-teal-100 flex items-center gap-1">
                <span>🎙️</span> Assembly Talks
              </span>
              <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-lg bg-teal-50 text-teal-800 border border-teal-100 flex items-center gap-1">
                <span>📚</span> Authentic Proofs
              </span>
              <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-lg bg-teal-50 text-teal-800 border border-teal-100 flex items-center gap-1">
                <span>🌟</span> Student Prep
              </span>
            </div>
          </div>

          {/* Feature 8: PDF Syllabus & Chapter Summarizer */}
          <div className="bg-white rounded-3xl p-5 border border-[#E7E9EE] shadow-xs hover:border-[#37C6A3]/60 hover:shadow-md hover:-translate-y-1 transition-all duration-300 group flex flex-col justify-between">
            <div>
              <div className="flex items-start gap-3.5">
                {/* 3D Glossy Emerald & Slate Medallion */}
                <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-600 via-emerald-600 to-slate-900 text-white flex items-center justify-center shrink-0 shadow-lg shadow-emerald-700/25 border border-emerald-400/40 overflow-hidden group-hover:scale-105 transition-transform duration-300">
                  <span className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/35 to-transparent pointer-events-none" />
                  <Layers className="w-5 h-5 text-white relative z-10" />
                  <span className="absolute -bottom-1 -right-1 w-4.5 h-4.5 rounded-full bg-slate-900 border border-teal-400/50 flex items-center justify-center z-10">
                    <Zap className="w-2.5 h-2.5 text-teal-300" />
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1.5 flex-wrap">
                    <h3 className="text-sm font-bold text-[#0F172A] leading-snug">
                      PDF Syllabus Summarizer
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                      RAM-Only Notes
                    </span>
                  </div>
                  <p className="text-xs text-[#7C8A9A] mt-1 leading-relaxed">
                    Upload Islamic syllabus books or chapter PDFs to extract key learning takeaways, glossary terms, and revision bullet points in RAM.
                  </p>
                </div>
              </div>
            </div>

            {/* Quick-Scan Visual Pills */}
            <div className="mt-3.5 pt-3.5 border-t border-[#E7E9EE]/80 flex flex-wrap gap-1.5">
              <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-100 flex items-center gap-1">
                <span>⚡</span> Instant Summary
              </span>
              <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-100 flex items-center gap-1">
                <span>🗂️</span> Study Notes
              </span>
              <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-100 flex items-center gap-1">
                <span>🔒</span> 0 MB Stored
              </span>
            </div>
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

            {/* Round Circular Action Button with 3D AI Robot Mascot Avatar */}
            <button
              type="button"
              onClick={() => {
                document.getElementById('teacher-ai-notice')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className="relative w-14 h-14 min-h-[56px] min-w-[56px] rounded-full bg-[#0F172A] hover:bg-[#1E293B] text-[#37C6A3] border-2 border-[#37C6A3] shadow-[0_4px_24px_rgba(55,198,163,0.35)] hover:shadow-[0_6px_30px_rgba(55,198,163,0.55)] transition-all duration-300 flex items-center justify-center cursor-pointer animate-orb-float group-hover:scale-105 active:scale-95 overflow-visible"
              aria-label="Madrasa Subscription Required for AI Copilot"
              title="Madrasa Subscription Required for AI Copilot"
            >
              <div className="w-9 h-9 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <AiRobotMascot variant="avatar" size={36} />
              </div>
              <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 rounded-full bg-amber-500 text-slate-950 border-2 border-[#0F172A] flex items-center justify-center shadow-xs z-10">
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

        <button
          onClick={() => {
            setActiveTab('circular');
            setMobileView(generatedCircular ? 'preview' : 'config');
          }}
          className={`flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-2xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'circular'
              ? 'bg-[#0F172A] text-white shadow-xs'
              : 'text-[#7C8A9A] hover:text-[#0F172A] hover:bg-white'
          }`}
        >
          <Megaphone className="w-4 h-4 text-indigo-400" />
          <span>Parent Circular Writer</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('hifz');
            setMobileView(generatedHifz ? 'preview' : 'config');
          }}
          className={`flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-2xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'hifz'
              ? 'bg-[#0F172A] text-white shadow-xs'
              : 'text-[#7C8A9A] hover:text-[#0F172A] hover:bg-white'
          }`}
        >
          <BookOpen className="w-4 h-4 text-amber-400" />
          <span>Hifz & Tajweed Builder</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('speech');
            setMobileView(generatedSpeech ? 'preview' : 'config');
          }}
          className={`flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-2xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'speech'
              ? 'bg-[#0F172A] text-white shadow-xs'
              : 'text-[#7C8A9A] hover:text-[#0F172A] hover:bg-white'
          }`}
        >
          <Mic className="w-4 h-4 text-[#37C6A3]" />
          <span>Bayan & Speech Writer</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('summarizer');
            setMobileView(generatedSummary ? 'preview' : 'config');
          }}
          className={`flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-2xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'summarizer'
              ? 'bg-[#0F172A] text-white shadow-xs'
              : 'text-[#7C8A9A] hover:text-[#0F172A] hover:bg-white'
          }`}
        >
          <Layers className="w-4 h-4 text-emerald-400" />
          <span>PDF Syllabus Summarizer</span>
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

      {/* ========================================================================= */}
      {/* TAB 5: PARENT CIRCULAR & NOTICE WRITER                                     */}
      {/* ========================================================================= */}
      {activeTab === 'circular' && (
        <div>
          {/* Mobile Segmented Switch (< 1024px) */}
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
              <span>📄 Generated Circular</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Form Left Panel */}
            <div
              className={`${
                mobileView === 'config' ? 'block' : 'hidden'
              } lg:block lg:col-span-5 bg-white rounded-3xl p-5 sm:p-6 border border-[#E7E9EE] shadow-xs`}
            >
              <div className="flex items-center gap-2 mb-4">
                <Megaphone className="w-5 h-5 text-indigo-500" />
                <h2 className="text-base font-bold text-[#0F172A]">Parent Circular & Notice Writer</h2>
              </div>
              <p className="text-xs text-[#7C8A9A] mb-5 leading-relaxed">
                Draft professional, Islamic-compliant circulars with Bismillah, respectful greetings, key dates, and parent adab reminders.
              </p>

              {circularError && (
                <div className="mb-4 p-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{circularError}</span>
                </div>
              )}

              <form onSubmit={handleGenerateCircular} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                    Notice Occasion / Purpose
                  </label>
                  <select
                    value={circularOccasion}
                    onChange={(e) => setCircularOccasion(e.target.value)}
                    className="w-full h-11 px-3 text-xs rounded-xl border border-[#E7E9EE] bg-white focus:outline-hidden focus:border-[#37C6A3] font-semibold"
                  >
                    <option value="Jummah Reminder & Student Etiquette">Jummah Reminder & Student Etiquette</option>
                    <option value="Ramadan Schedule & Taraweeh Attendance">Ramadan Schedule & Taraweeh Attendance</option>
                    <option value="Eid-ul-Fitr / Eid-ul-Adha Vacation Notice">Eid Vacation Notice & Reopening Date</option>
                    <option value="Term Examination Timetable & Rules">Term Examination Timetable & Rules</option>
                    <option value="Monthly Madrasa Fee Due Notice">Monthly Madrasa Fee Due Notice</option>
                    <option value="Annual Jalsa & Graduation Ceremony">Annual Jalsa & Graduation Ceremony Invitation</option>
                    <option value="Parent-Teacher Meeting (PTM) Invitation">Parent-Teacher Meeting (PTM) Invitation</option>
                    <option value="Student Discipline, Uniform & Adab Notice">Student Discipline, Uniform & Adab Notice</option>
                    <option value="General Madrasa Announcement">General Madrasa Announcement</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                      Target Audience
                    </label>
                    <select
                      value={circularAudience}
                      onChange={(e) => setCircularAudience(e.target.value)}
                      className="w-full h-11 px-3 text-xs rounded-xl border border-[#E7E9EE] bg-white focus:outline-hidden focus:border-[#37C6A3]"
                    >
                      <option value="Parents of All Students">Parents of All Students</option>
                      <option value="Primary Section Parents">Primary Section Parents</option>
                      <option value="Hifz Department Parents">Hifz Department Parents</option>
                      <option value="Alim / Kitab Section Parents">Alim / Kitab Section Parents</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#0F172A] mb-1.5">Language</label>
                    <select
                      value={circularLanguage}
                      onChange={(e) => setCircularLanguage(e.target.value as any)}
                      className="w-full h-11 px-3 text-xs rounded-xl border border-[#E7E9EE] bg-white focus:outline-hidden focus:border-[#37C6A3]"
                    >
                      <option value="English">English</option>
                      <option value="Tamil">Tamil (தமிழ்)</option>
                      <option value="Arabic">Arabic (العربية)</option>
                      <option value="Bilingual (Tamil + English)">Bilingual (Tamil + English)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                    Key Dates, Timings & Venue
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 15th Ramadan, 8:00 AM - 1:00 PM at Main Hall"
                    value={circularKeyDates}
                    onChange={(e) => setCircularKeyDates(e.target.value)}
                    className="w-full h-11 px-3.5 text-xs rounded-xl border border-[#E7E9EE] bg-white focus:outline-hidden focus:border-[#37C6A3]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                    Sign-off / Sender Title
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Madrasa Administration / Principal Ustadh"
                    value={circularSender}
                    onChange={(e) => setCircularSender(e.target.value)}
                    className="w-full h-11 px-3.5 text-xs rounded-xl border border-[#E7E9EE] bg-white focus:outline-hidden focus:border-[#37C6A3]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                    Specific Instructions or Special Notes (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Ensure boys wear clean white thobe; bring Quran notebooks; late arrivals will not be permitted."
                    value={circularCustomTopic}
                    onChange={(e) => setCircularCustomTopic(e.target.value)}
                    className="w-full p-3 text-xs rounded-xl border border-[#E7E9EE] bg-white focus:outline-hidden focus:border-[#37C6A3]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={generatingCircular}
                  className="w-full py-3.5 min-h-[48px] px-4 rounded-2xl bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs sm:text-sm font-bold tracking-wide transition flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                >
                  {generatingCircular ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-[#37C6A3]" />
                      <span>Composing Parent Notice...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-[#37C6A3]" />
                      <span>Draft Parent Circular</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Generated Output Preview Right Panel */}
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
                    <h3 className="text-sm font-bold text-[#0F172A]">Notice Preview</h3>
                  </div>

                  {generatedCircular && (
                    <div className="flex items-center gap-2 print:hidden">
                      <button
                        type="button"
                        onClick={() => handleCopy(generatedCircular)}
                        className="px-3 py-1.5 min-h-[36px] text-xs font-semibold rounded-xl border border-[#E7E9EE] text-[#0F172A] hover:bg-slate-50 flex items-center gap-1.5 transition cursor-pointer"
                      >
                        {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedText ? 'Copied' : 'Copy'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="px-3 py-1.5 min-h-[36px] text-xs font-semibold rounded-xl bg-[#0F172A] text-white hover:bg-[#1E293B] flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5 text-[#37C6A3]" />
                        <span>Print</span>
                      </button>
                    </div>
                  )}
                </div>

                {generatingCircular ? (
                  <AiSparkleLoader title="Madrasa Copilot is composing notice..." messages={circularMessages} />
                ) : generatedCircular ? (
                  <AiStreamedText text={generatedCircular} />
                ) : (
                  <div className="py-20 flex flex-col items-center justify-center text-center text-[#7C8A9A]">
                    <div className="w-14 h-14 rounded-2xl bg-[#F7F6F1] flex items-center justify-center mb-3">
                      <Megaphone className="w-7 h-7 text-indigo-400 opacity-60" />
                    </div>
                    <p className="text-sm font-bold text-[#0F172A]">No Circular Generated Yet</p>
                    <p className="text-xs mt-1 max-w-xs">
                      Select your notice occasion and click &quot;Draft Parent Circular&quot; to synthesize an official letter ready for WhatsApp and printing.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: HIFZ & TAJWEED WORKSHEET BUILDER                                     */}
      {/* ========================================================================= */}
      {activeTab === 'hifz' && (
        <div>
          {/* Mobile Segmented Switch (< 1024px) */}
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
              <span>📖 Generated Worksheet</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Form Left Panel */}
            <div
              className={`${
                mobileView === 'config' ? 'block' : 'hidden'
              } lg:block lg:col-span-5 bg-white rounded-3xl p-5 sm:p-6 border border-[#E7E9EE] shadow-xs`}
            >
              <div className="flex items-center gap-2 mb-4">
                <BookOpen className="w-5 h-5 text-amber-500" />
                <h2 className="text-base font-bold text-[#0F172A]">Hifz & Tajweed Worksheet Builder</h2>
              </div>
              <p className="text-xs text-[#7C8A9A] mb-5 leading-relaxed">
                Build Surah drills, Makharij & Tajweed rule tests, and oral recitation grading rubrics with answer keys.
              </p>

              {hifzError && (
                <div className="mb-4 p-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{hifzError}</span>
                </div>
              )}

              <form onSubmit={handleGenerateHifz} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                    Quran Portion / Surah Range
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Juz 30 (Surah An-Naba to An-Nas) or Surah Al-Mulk"
                    value={hifzPortion}
                    onChange={(e) => setHifzPortion(e.target.value)}
                    className="w-full h-11 px-3.5 text-xs rounded-xl border border-[#E7E9EE] bg-white focus:outline-hidden focus:border-[#37C6A3]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                    Assessment Focus
                  </label>
                  <select
                    value={hifzFocus}
                    onChange={(e) => setHifzFocus(e.target.value)}
                    className="w-full h-11 px-3 text-xs rounded-xl border border-[#E7E9EE] bg-white focus:outline-hidden focus:border-[#37C6A3]"
                  >
                    <option value="Ayah Completion & Memorization Drill">Ayah Completion & Memorization Drill</option>
                    <option value="Tajweed Rules (Makharij, Ghunnah, Idgham, Ikhfa)">Tajweed Rules (Makharij, Ghunnah, Idgham, Ikhfa)</option>
                    <option value="Mutashabihat (Similar Ayahs) Identification">Mutashabihat (Similar Ayahs) Identification</option>
                    <option value="Oral Recitation Rubric & Ustadh Scorecard">Oral Recitation Rubric & Ustadh Scorecard</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#0F172A] mb-1.5">Hifz Level</label>
                    <select
                      value={hifzGrade}
                      onChange={(e) => setHifzGrade(e.target.value)}
                      className="w-full h-11 px-3 text-xs rounded-xl border border-[#E7E9EE] bg-white focus:outline-hidden focus:border-[#37C6A3]"
                    >
                      <option value="Beginner (Noorani / Qaida)">Beginner (Noorani / Qaida)</option>
                      <option value="Intermediate Hifz (5 - 15 Juz)">Intermediate Hifz (5 - 15 Juz)</option>
                      <option value="Advanced Sanad / Complete Hafiz">Advanced Sanad / Complete Hafiz</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#0F172A] mb-1.5">Language</label>
                    <select
                      value={hifzLanguage}
                      onChange={(e) => setHifzLanguage(e.target.value as any)}
                      className="w-full h-11 px-3 text-xs rounded-xl border border-[#E7E9EE] bg-white focus:outline-hidden focus:border-[#37C6A3]"
                    >
                      <option value="English">English</option>
                      <option value="Tamil">Tamil (தமிழ்)</option>
                      <option value="Arabic">Arabic (العربية)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                    Number of Drill Questions: {hifzCount}
                  </label>
                  <input
                    type="range"
                    min="3"
                    max="10"
                    value={hifzCount}
                    onChange={(e) => setHifzCount(Number(e.target.value))}
                    className="w-full accent-[#37C6A3]"
                  />
                  <div className="flex justify-between text-[10px] text-[#7C8A9A]">
                    <span>3 Drills</span>
                    <span>5 Standard</span>
                    <span>10 Intensive</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={generatingHifz || !hifzPortion.trim()}
                  className="w-full py-3.5 min-h-[48px] px-4 rounded-2xl bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs sm:text-sm font-bold tracking-wide transition flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                >
                  {generatingHifz ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-[#37C6A3]" />
                      <span>Synthesizing Hifz Worksheet...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-[#37C6A3]" />
                      <span>Build Hifz Worksheet</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Generated Output Preview Right Panel */}
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
                    <h3 className="text-sm font-bold text-[#0F172A]">Hifz Worksheet & Rubric Preview</h3>
                  </div>

                  {generatedHifz && (
                    <div className="flex items-center gap-2 print:hidden">
                      <button
                        type="button"
                        onClick={() => handleCopy(generatedHifz)}
                        className="px-3 py-1.5 min-h-[36px] text-xs font-semibold rounded-xl border border-[#E7E9EE] text-[#0F172A] hover:bg-slate-50 flex items-center gap-1.5 transition cursor-pointer"
                      >
                        {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedText ? 'Copied' : 'Copy'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="px-3 py-1.5 min-h-[36px] text-xs font-semibold rounded-xl bg-[#0F172A] text-white hover:bg-[#1E293B] flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5 text-[#37C6A3]" />
                        <span>Print</span>
                      </button>
                    </div>
                  )}
                </div>

                {generatingHifz ? (
                  <AiSparkleLoader title="Generating Hifz Drills & Tajweed Rules..." messages={hifzMessages} />
                ) : generatedHifz ? (
                  <AiStreamedText text={generatedHifz} />
                ) : (
                  <div className="py-20 flex flex-col items-center justify-center text-center text-[#7C8A9A]">
                    <div className="w-14 h-14 rounded-2xl bg-[#F7F6F1] flex items-center justify-center mb-3">
                      <BookOpen className="w-7 h-7 text-amber-500 opacity-60" />
                    </div>
                    <p className="text-sm font-bold text-[#0F172A]">No Hifz Worksheet Generated</p>
                    <p className="text-xs mt-1 max-w-xs">
                      Enter a Surah or Juz range and click &quot;Build Hifz Worksheet&quot; to synthesize completion tests and oral scoring rubrics.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 7: BAYAN & STUDENT SPEECH WRITER                                       */}
      {/* ========================================================================= */}
      {activeTab === 'speech' && (
        <div>
          {/* Mobile Segmented Switch (< 1024px) */}
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
              <span>🎙️ Generated Speech</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Form Left Panel */}
            <div
              className={`${
                mobileView === 'config' ? 'block' : 'hidden'
              } lg:block lg:col-span-5 bg-white rounded-3xl p-5 sm:p-6 border border-[#E7E9EE] shadow-xs`}
            >
              <div className="flex items-center gap-2 mb-4">
                <Mic className="w-5 h-5 text-[#37C6A3]" />
                <h2 className="text-base font-bold text-[#0F172A]">Bayan & Student Speech Writer</h2>
              </div>
              <p className="text-xs text-[#7C8A9A] mb-5 leading-relaxed">
                Draft timed speeches with authentic Quranic Ayahs, Hadith proofs, practical life lessons, and inspiring closing Du&apos;a.
              </p>

              {speechError && (
                <div className="mb-4 p-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{speechError}</span>
                </div>
              )}

              <form onSubmit={handleGenerateSpeech} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                    Speech Topic / Theme
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Respecting Parents in Islam (Birr al-Walidayn)"
                    value={speechTopic}
                    onChange={(e) => setSpeechTopic(e.target.value)}
                    className="w-full h-11 px-3.5 text-xs rounded-xl border border-[#E7E9EE] bg-white focus:outline-hidden focus:border-[#37C6A3]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                    Occasion / Event Type
                  </label>
                  <select
                    value={speechOccasion}
                    onChange={(e) => setSpeechOccasion(e.target.value)}
                    className="w-full h-11 px-3 text-xs rounded-xl border border-[#E7E9EE] bg-white focus:outline-hidden focus:border-[#37C6A3]"
                  >
                    <option value="Morning Assembly Speech (3-5 mins)">Morning Assembly Speech (3-5 mins)</option>
                    <option value="Friday Bayan / Jumu'ah Sermon">Friday Bayan / Jumu&apos;ah Sermon</option>
                    <option value="Madrasa Public Speech Competition">Madrasa Public Speech Competition</option>
                    <option value="Annual Day / Prize Giving Jalsa">Annual Day / Prize Giving Jalsa</option>
                    <option value="Youth Character Building & Akhlaaq Talk">Youth Character Building & Akhlaaq Talk</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#0F172A] mb-1.5">Speech Duration</label>
                    <select
                      value={speechDuration}
                      onChange={(e) => setSpeechDuration(e.target.value)}
                      className="w-full h-11 px-3 text-xs rounded-xl border border-[#E7E9EE] bg-white focus:outline-hidden focus:border-[#37C6A3]"
                    >
                      <option value="3 Minutes">3 Minutes (Quick Talk)</option>
                      <option value="5 Minutes">5 Minutes (Assembly Standard)</option>
                      <option value="10 Minutes">10 Minutes (Comprehensive)</option>
                      <option value="15 Minutes">15 Minutes (Formal Bayan)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#0F172A] mb-1.5">Language</label>
                    <select
                      value={speechLanguage}
                      onChange={(e) => setSpeechLanguage(e.target.value as any)}
                      className="w-full h-11 px-3 text-xs rounded-xl border border-[#E7E9EE] bg-white focus:outline-hidden focus:border-[#37C6A3]"
                    >
                      <option value="English">English</option>
                      <option value="Tamil">Tamil (தமிழ்)</option>
                      <option value="Arabic">Arabic (العربية)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                    Target Audience
                  </label>
                  <select
                    value={speechAudience}
                    onChange={(e) => setSpeechAudience(e.target.value)}
                    className="w-full h-11 px-3 text-xs rounded-xl border border-[#E7E9EE] bg-white focus:outline-hidden focus:border-[#37C6A3]"
                  >
                    <option value="Madrasa Students (All Grades)">Madrasa Students (All Grades)</option>
                    <option value="Youth & Teenagers">Youth & Teenagers</option>
                    <option value="General Madrasa Community & Parents">General Madrasa Community & Parents</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={generatingSpeech || !speechTopic.trim()}
                  className="w-full py-3.5 min-h-[48px] px-4 rounded-2xl bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs sm:text-sm font-bold tracking-wide transition flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                >
                  {generatingSpeech ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-[#37C6A3]" />
                      <span>Drafting Inspiring Bayan...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-[#37C6A3]" />
                      <span>Draft Islamic Speech</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Generated Output Preview Right Panel */}
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
                    <h3 className="text-sm font-bold text-[#0F172A]">Speech Script Preview</h3>
                  </div>

                  {generatedSpeech && (
                    <div className="flex items-center gap-2 print:hidden">
                      <button
                        type="button"
                        onClick={() => handleCopy(generatedSpeech)}
                        className="px-3 py-1.5 min-h-[36px] text-xs font-semibold rounded-xl border border-[#E7E9EE] text-[#0F172A] hover:bg-slate-50 flex items-center gap-1.5 transition cursor-pointer"
                      >
                        {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedText ? 'Copied' : 'Copy'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="px-3 py-1.5 min-h-[36px] text-xs font-semibold rounded-xl bg-[#0F172A] text-white hover:bg-[#1E293B] flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5 text-[#37C6A3]" />
                        <span>Print</span>
                      </button>
                    </div>
                  )}
                </div>

                {generatingSpeech ? (
                  <AiSparkleLoader title="Madrasa Copilot is drafting your speech..." messages={speechMessages} />
                ) : generatedSpeech ? (
                  <AiStreamedText text={generatedSpeech} />
                ) : (
                  <div className="py-20 flex flex-col items-center justify-center text-center text-[#7C8A9A]">
                    <div className="w-14 h-14 rounded-2xl bg-[#F7F6F1] flex items-center justify-center mb-3">
                      <Mic className="w-7 h-7 text-[#37C6A3] opacity-60" />
                    </div>
                    <p className="text-sm font-bold text-[#0F172A]">No Speech Drafted Yet</p>
                    <p className="text-xs mt-1 max-w-xs">
                      Enter a topic and occasion, then click &quot;Draft Islamic Speech&quot; to synthesize an authentic, time-calibrated oratory talk.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 8: PDF SYLLABUS & CHAPTER SUMMARIZER                                   */}
      {/* ========================================================================= */}
      {activeTab === 'summarizer' && (
        <div>
          {/* Mobile Segmented Switch (< 1024px) */}
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
              <span>⚡ Study Summary</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Form Left Panel */}
            <div
              className={`${
                mobileView === 'config' ? 'block' : 'hidden'
              } lg:block lg:col-span-5 bg-white rounded-3xl p-5 sm:p-6 border border-[#E7E9EE] shadow-xs`}
            >
              <div className="flex items-center gap-2 mb-4">
                <Layers className="w-5 h-5 text-emerald-500" />
                <h2 className="text-base font-bold text-[#0F172A]">PDF Syllabus & Chapter Summarizer</h2>
              </div>
              <p className="text-xs text-[#7C8A9A] mb-5 leading-relaxed">
                Parse syllabus or book chapters in volatile RAM to extract key learning takeaways, Islamic glossary, and revision bullet points.
              </p>

              {summaryError && (
                <div className="mb-4 p-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{summaryError}</span>
                </div>
              )}

              <form onSubmit={handleGenerateSummary} className="space-y-4">
                {/* Zero-Storage RAM-Only PDF Upload */}
                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                    Upload Syllabus Chapter PDF (RAM-Only, 0 MB Stored)
                  </label>
                  <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-[#E7E9EE] hover:border-[#37C6A3] rounded-2xl cursor-pointer bg-[#F7F6F1]/50 hover:bg-[#F7F6F1] transition">
                    <div className="flex flex-col items-center justify-center text-center p-2">
                      <Upload className="w-5 h-5 text-[#37C6A3] mb-1" />
                      <p className="text-xs font-bold text-[#0F172A]">
                        {summaryFile ? summaryFile.name : 'Select or drop chapter PDF'}
                      </p>
                      <p className="text-[10px] text-[#7C8A9A]">Parsed in RAM & discarded (max 10MB)</p>
                    </div>
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={(e) => setSummaryFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                    Book / Subject & Chapter Title
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Kitab at-Tawheed - Chapter 3: Virtues of Tawheed"
                    value={summaryTitle}
                    onChange={(e) => setSummaryTitle(e.target.value)}
                    className="w-full h-11 px-3.5 text-xs rounded-xl border border-[#E7E9EE] bg-white focus:outline-hidden focus:border-[#37C6A3]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                    Summary Structure & Depth
                  </label>
                  <select
                    value={summaryType}
                    onChange={(e) => setSummaryType(e.target.value)}
                    className="w-full h-11 px-3 text-xs rounded-xl border border-[#E7E9EE] bg-white focus:outline-hidden focus:border-[#37C6A3]"
                  >
                    <option value="Comprehensive Chapter Study Notes & Key Concepts">Comprehensive Chapter Notes & Key Concepts</option>
                    <option value="Executive Ustadh Teaching Summary & Glossary">Executive Ustadh Teaching Summary & Glossary</option>
                    <option value="Revision Flashcard & Quick-Review Bullets">Revision Flashcards & Quick-Review Bullets</option>
                    <option value="Exam Preparation Summary with Key Questions">Exam Preparation Summary with Key Questions</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1.5">Output Language</label>
                  <select
                    value={summaryLanguage}
                    onChange={(e) => setSummaryLanguage(e.target.value as any)}
                    className="w-full h-11 px-3 text-xs rounded-xl border border-[#E7E9EE] bg-white focus:outline-hidden focus:border-[#37C6A3]"
                  >
                    <option value="English">English</option>
                    <option value="Tamil">Tamil (தமிழ்)</option>
                    <option value="Arabic">Arabic (العربية)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={generatingSummary || (!summaryFile && !summaryTitle.trim())}
                  className="w-full py-3.5 min-h-[48px] px-4 rounded-2xl bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs sm:text-sm font-bold tracking-wide transition flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                >
                  {generatingSummary ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-[#37C6A3]" />
                      <span>Synthesizing Chapter Summary in RAM...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-[#37C6A3]" />
                      <span>Synthesize Chapter Summary</span>
                    </>
                  )}
                </button>

                <p className="text-[10px] text-[#7C8A9A] text-center">
                  🔒 Zero-Storage: PDF is parsed strictly in server RAM and immediately discarded.
                </p>
              </form>
            </div>

            {/* Generated Output Preview Right Panel */}
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
                    <h3 className="text-sm font-bold text-[#0F172A]">Chapter Summary & Notes Preview</h3>
                  </div>

                  {generatedSummary && (
                    <div className="flex items-center gap-2 print:hidden">
                      <button
                        type="button"
                        onClick={() => handleCopy(generatedSummary)}
                        className="px-3 py-1.5 min-h-[36px] text-xs font-semibold rounded-xl border border-[#E7E9EE] text-[#0F172A] hover:bg-slate-50 flex items-center gap-1.5 transition cursor-pointer"
                      >
                        {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedText ? 'Copied' : 'Copy'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="px-3 py-1.5 min-h-[36px] text-xs font-semibold rounded-xl bg-[#0F172A] text-white hover:bg-[#1E293B] flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5 text-[#37C6A3]" />
                        <span>Print</span>
                      </button>
                    </div>
                  )}
                </div>

                {generatingSummary ? (
                  <AiSparkleLoader title="Reading in RAM & Synthesizing Chapter Notes..." messages={summaryMessages} />
                ) : generatedSummary ? (
                  <AiStreamedText text={generatedSummary} />
                ) : (
                  <div className="py-20 flex flex-col items-center justify-center text-center text-[#7C8A9A]">
                    <div className="w-14 h-14 rounded-2xl bg-[#F7F6F1] flex items-center justify-center mb-3">
                      <Layers className="w-7 h-7 text-emerald-500 opacity-60" />
                    </div>
                    <p className="text-sm font-bold text-[#0F172A]">No Chapter Summary Generated</p>
                    <p className="text-xs mt-1 max-w-xs">
                      Upload a PDF syllabus chapter or provide a book title to extract structured study notes and revision flashcards.
                    </p>
                  </div>
                )}
              </div>
            </div>
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
                <div className="text-[10px] text-slate-400 mt-0.5 leading-none">8 Active Ustadh AI Tools</div>
              </div>
              <div className="w-2 h-2 bg-[#0F172A] border-r border-t border-emerald-500/30 rotate-45 absolute -right-1 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <span className="absolute inset-0 rounded-full bg-[#37C6A3]/30 animate-orb-halo pointer-events-none" />

          {/* Round Circular Action Button with 3D AI Robot Mascot Avatar */}
          <button
            type="button"
            onClick={() => {
              document.getElementById('teacher-workspace-top')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className="relative w-14 h-14 min-h-[56px] min-w-[56px] rounded-full bg-[#0F172A] hover:bg-[#1E293B] text-[#37C6A3] border-2 border-[#37C6A3] shadow-[0_4px_24px_rgba(55,198,163,0.35)] hover:shadow-[0_6px_30px_rgba(55,198,163,0.55)] transition-all duration-300 flex items-center justify-center cursor-pointer animate-orb-float group-hover:scale-105 active:scale-95 overflow-visible"
            aria-label="Ustadh AI Copilot Active"
            title="Ustadh AI Copilot Active"
          >
            <div className="w-9 h-9 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <AiRobotMascot variant="avatar" size={36} />
            </div>
            <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 z-10">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#37C6A3] opacity-75" />
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-[#0F172A]" />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
