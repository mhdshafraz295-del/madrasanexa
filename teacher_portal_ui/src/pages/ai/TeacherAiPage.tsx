import React, { useState, useEffect, useRef } from 'react';
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
  Copy,
  Check,
  BookOpen,
  Palette,
  Megaphone,
  Mic,
  Award,
  Layers,
  Zap,
  Paperclip,
  ArrowUp,
  Plus,
  X,
  RotateCcw,
} from 'lucide-react';
import { teacherAiService, type AiStatusResponse, type PosterGenerationResult } from '../../services/ai.service';
import AiRobotMascot from '../../components/ai/AiRobotMascot';
import PosterCanvasRenderer from '../../components/ai/PosterCanvasRenderer';
import AiMarkdownContent from '../../components/ai/AiMarkdownContent';

export type ToolMode =
  | 'auto'
  | 'exam'
  | 'lesson'
  | 'poster'
  | 'translate'
  | 'circular'
  | 'hifz'
  | 'speech'
  | 'summarizer';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
  content: string;
  mode: ToolMode;
  file?: {
    name: string;
    size: number;
  };
  posterData?: PosterGenerationResult;
  isStreaming?: boolean;
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
        <div className="sticky top-2 z-20 flex justify-end mb-3">
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

      <div className="prose prose-slate max-w-none text-xs sm:text-sm leading-relaxed font-sans text-[#0F172A]">
        <AiMarkdownContent content={text.slice(0, displayedLength)} />
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

  // Conversational Copilot State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [toolMode, setToolMode] = useState<ToolMode>('auto');
  const [language, setLanguage] = useState<'English' | 'Tamil' | 'Arabic' | 'Bilingual (Tamil + English)'>('English');
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (messages.length > 0) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isGenerating]);

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

    // Re-check live status on window focus (e.g., when Super Admin disables AI in another tab)
    const handleFocus = () => {
      loadStatus();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputPrompt(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 180)}px`;
  };

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleNewChat = () => {
    setMessages([]);
    setInputPrompt('');
    setAttachedFile(null);
    setToolMode('auto');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleRegenerate = (lastPrompt?: string, mode?: ToolMode) => {
    if (isGenerating) return;
    const promptToRun =
      lastPrompt ||
      messages.filter((m) => m.sender === 'user').slice(-1)[0]?.content;
    if (promptToRun) {
      handleSubmitPrompt(promptToRun, mode);
    }
  };

  const handleSubmitPrompt = async (promptOverride?: string, modeOverride?: ToolMode, fileOverride?: File | null) => {
    const query = (promptOverride !== undefined ? promptOverride : inputPrompt).trim();
    const file = fileOverride !== undefined ? fileOverride : attachedFile;
    const currentMode = modeOverride || toolMode;

    if (!query && !file) return;

    const userMsgId = Date.now().toString();
    const userMsg: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      timestamp: new Date(),
      content: query || (file ? `Attached file: ${file.name}` : ''),
      mode: currentMode,
      file: file ? { name: file.name, size: file.size } : undefined,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputPrompt('');
    setAttachedFile(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setIsGenerating(true);

    try {
      let resolvedMode = currentMode;
      const assistantMsgId = (Date.now() + 1).toString();

      if (resolvedMode === 'auto') {
        const lower = query.toLowerCase();
        if (file && (lower.includes('exam') || lower.includes('mcq') || lower.includes('question paper') || lower.includes('வினாத்தாள்') || lower.includes('பரீட்சை வினா'))) {
          resolvedMode = 'exam';
        } else if (lower.includes('poster') || lower.includes('flyer') || lower.includes('banner') || lower.includes('சுவரொட்டி')) {
          resolvedMode = 'poster';
        } else if (
          lower.startsWith('translate ') ||
          lower.includes('translate this') ||
          lower.includes('translate to ') ||
          lower.includes('மொழிபெயர்க்க') ||
          lower.includes('மொழிபெயர்ப்பு')
        ) {
          resolvedMode = 'translate';
        } else if (
          lower.includes('circular') ||
          lower.includes('parent notice') ||
          lower.includes('ramadan notice') ||
          lower.includes('leave notice') ||
          lower.includes('சுற்றறிக்கை') ||
          lower.includes('விடுமுறை அறிவிப்பு') ||
          lower.includes('notice onnu')
        ) {
          resolvedMode = 'circular';
        } else if (
          lower.includes('summarize') ||
          lower.includes('summary') ||
          lower.includes('surukki') ||
          lower.includes('surukkam') ||
          lower.includes('சுருக்கம்') ||
          lower.includes('executive summary')
        ) {
          resolvedMode = 'summarizer';
        } else if (
          lower.includes('speech') ||
          lower.includes('bayan') ||
          lower.includes('assembly speech') ||
          lower.includes('உரை') ||
          lower.includes('பயான்')
        ) {
          resolvedMode = 'speech';
        } else if (lower.includes('hifz') || lower.includes('tajweed quiz') || lower.includes('ஹிஃப்ழு') || lower.includes('தஜ்வீத்')) {
          resolvedMode = 'hifz';
        } else if (lower.includes('lesson plan') || lower.includes('30-min lesson') || lower.includes('பாடத் திட்டம்')) {
          resolvedMode = 'lesson';
        }
      }

      if (resolvedMode === 'poster') {
        const res = await teacherAiService.generatePoster({
          title: query || 'Annual Madrasa Event',
          category: 'Madrasa Event',
          language,
        });
        setMessages((prev) => [
          ...prev,
          {
            id: assistantMsgId,
            sender: 'assistant',
            timestamp: new Date(),
            content: `Islamic Event Poster Synthesized: "${res.title}"`,
            posterData: res,
            mode: 'poster',
            isStreaming: true,
          },
        ]);
      } else if (resolvedMode === 'exam') {
        const formData = new FormData();
        if (file) formData.append('file', file);
        formData.append('topic', query || 'Islamic Curriculum Examination');
        formData.append('subject', 'Islamic Studies');
        formData.append('gradeLevel', 'Standard');
        formData.append('language', language);
        formData.append('durationMinutes', '60');
        formData.append('totalMarks', '50');
        formData.append('mcqCount', '5');
        formData.append('shortCount', '4');
        formData.append('essayCount', '2');

        const res = await teacherAiService.generateExamPaper(formData);
        setMessages((prev) => [
          ...prev,
          {
            id: assistantMsgId,
            sender: 'assistant',
            timestamp: new Date(),
            content: res.examContent,
            mode: 'exam',
            isStreaming: true,
          },
        ]);
      } else if (resolvedMode === 'lesson') {
        const formData = new FormData();
        if (file) formData.append('file', file);
        formData.append('topic', query || 'Islamic Studies Lesson');
        formData.append('subject', 'Ustadh 30-Min Lesson Plan');
        formData.append('gradeLevel', 'Standard');
        formData.append('durationMinutes', '30');
        formData.append('language', language);

        const res = await teacherAiService.generateLessonPlan(formData);
        setMessages((prev) => [
          ...prev,
          {
            id: assistantMsgId,
            sender: 'assistant',
            timestamp: new Date(),
            content: res.lessonPlan,
            mode: 'lesson',
            isStreaming: true,
          },
        ]);
      } else if (resolvedMode === 'translate') {
        const targetLang =
          language === 'Arabic'
            ? 'Arabic'
            : language === 'Tamil'
            ? 'Tamil'
            : language.includes('Bilingual')
            ? 'Bilingual (Tamil + English)'
            : 'English';

        const res = await teacherAiService.translateContent({
          text: query,
          sourceLanguage: 'Auto-Detect',
          targetLanguage: targetLang,
          language: targetLang,
        });
        setMessages((prev) => [
          ...prev,
          {
            id: assistantMsgId,
            sender: 'assistant',
            timestamp: new Date(),
            content: res.translatedText,
            mode: 'translate',
            isStreaming: true,
          },
        ]);
      } else {
        // Authentic dedicated output for: 'auto', 'circular', 'hifz', 'speech', 'summarizer'
        const formData = new FormData();
        if (file) formData.append('file', file);
        formData.append('message', query || (file ? `Attached document: ${file.name}` : 'Assalamu Alaikum'));
        formData.append('language', language);
        formData.append('mode', resolvedMode);
        formData.append(
          'history',
          JSON.stringify(
            messages.slice(-8).map((m) => ({
              role: m.sender === 'user' ? 'user' : 'assistant',
              content: m.content,
            }))
          )
        );

        const res = await teacherAiService.chatWithCopilot(formData);
        setMessages((prev) => [
          ...prev,
          {
            id: assistantMsgId,
            sender: 'assistant',
            timestamp: new Date(),
            content: res.reply,
            mode: resolvedMode,
            isStreaming: true,
          },
        ]);
      }
    } catch (err: any) {
      if (
        err.response?.status === 403 &&
        (err.response?.data?.code === 'AI_LOCKED' || err.response?.data?.code === 'AI_SUBSCRIPTION_REQUIRED')
      ) {
        loadStatus();
        return;
      }
      const errorMsg = err.response?.data?.message || err.message || 'Generation failed. Please try again.';
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'assistant',
          timestamp: new Date(),
          content: `⚠️ Request failed: ${errorMsg}`,
          mode: currentMode,
          isStreaming: false,
        },
      ]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmitPrompt();
    }
  };

  const quickPills = [
    {
      label: '📝 Exam Paper from PDF',
      action: () => {
        setToolMode('exam');
        fileInputRef.current?.click();
      },
    },
    {
      label: '⏱️ 30-Min Lesson Plan',
      action: () => {
        setToolMode('lesson');
        handleSubmitPrompt(
          'Create a 30-minute structured Islamic lesson plan on Fiqh of Taharah and Salah with classroom hook, exercises, and blackboard summary.',
          'lesson'
        );
      },
    },
    {
      label: '🎨 Hifz Graduation Event Poster',
      action: () => {
        setToolMode('poster');
        handleSubmitPrompt(
          'Annual Hifz Convocation Ceremony and Quran Graduation Celebration on Friday 15th Ramadan at Madrasa Main Auditorium Hall.',
          'poster'
        );
      },
    },
    {
      label: '📢 Parent Notice for Ramadan',
      action: () => {
        setToolMode('circular');
        handleSubmitPrompt(
          'Draft an official parent circular announcing Madrasa Ramadan school timings, Taraweeh attendance guidelines, and Eid vacation schedule.',
          'circular'
        );
      },
    },
    {
      label: '📖 Hifz & Tajweed Quiz (Juz 30)',
      action: () => {
        setToolMode('hifz');
        handleSubmitPrompt(
          'Create a Hifz & Tajweed assessment drill worksheet for Juz 30 (Surah An-Naba to An-Nas) with missing Ayah words and recitation rubric.',
          'hifz'
        );
      },
    },
    {
      label: '🎙️ Assembly Speech on Parents',
      action: () => {
        setToolMode('speech');
        handleSubmitPrompt(
          'Write an inspiring 5-minute Madrasa morning assembly speech on Respecting Parents (Birr al-Walidayn) with authentic Quran and Hadith citations.',
          'speech'
        );
      },
    },
    {
      label: '⚡ Summarize Textbook Chapter',
      action: () => {
        setToolMode('summarizer');
        fileInputRef.current?.click();
      },
    },
    {
      label: '🌐 Translate to Tamil & Arabic',
      action: () => {
        setToolMode('translate');
        handleSubmitPrompt(
          'Translate this Madrasa notice into Tamil and Arabic preserving Islamic terminology: Assalamu Alaikum, please be informed that school fees are due before the 10th of this month.',
          'translate'
        );
      },
    },
  ];

  const modeLabels: Record<ToolMode, { label: string; icon: React.ReactNode }> = {
    auto: { label: '✨ Auto Copilot', icon: <Sparkles className="w-3.5 h-3.5 text-[#37C6A3]" /> },
    exam: { label: '📄 PDF Exam Paper', icon: <FileText className="w-3.5 h-3.5 text-emerald-400" /> },
    lesson: { label: '⏱️ 30-Min Lesson Plan', icon: <Clock className="w-3.5 h-3.5 text-teal-400" /> },
    poster: { label: '🎨 Event Poster (Flux)', icon: <ImageIcon className="w-3.5 h-3.5 text-cyan-400" /> },
    translate: { label: '🌐 3-Language Translator', icon: <Languages className="w-3.5 h-3.5 text-indigo-400" /> },
    circular: { label: '📢 Parent Circular', icon: <Megaphone className="w-3.5 h-3.5 text-indigo-400" /> },
    hifz: { label: '📖 Hifz & Tajweed Quiz', icon: <BookOpen className="w-3.5 h-3.5 text-amber-400" /> },
    speech: { label: '🎙️ Bayan / Speech', icon: <Mic className="w-3.5 h-3.5 text-emerald-400" /> },
    summarizer: { label: '⚡ PDF Summarizer', icon: <Layers className="w-3.5 h-3.5 text-teal-400" /> },
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

  const isAiActive = Boolean(
    statusData.isActive !== undefined
      ? statusData.isActive
      : (statusData.aiEnabled && !statusData.isExpired)
  );

  // ==========================================
  // VIEW A: LOCKED PREVIEW (AI DISABLED)
  // ==========================================
  if (!isAiActive) {
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

          {/* Responsive Flex Hero Layout: Content first, 3D Mascot stacked cleanly below on mobile (360px+) */}
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="w-full md:max-w-xl lg:max-w-2xl flex-1">
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

            {/* 3D AI Robot Mascot (Waving): Centered & Cleanly Stacked Below on Mobile, On Right on Desktop */}
            <div className="shrink-0 w-28 sm:w-32 md:w-36 lg:w-40 mt-4 md:mt-0 mx-auto md:mx-0 flex justify-center items-center pointer-events-none select-none drop-shadow-2xl">
              <AiRobotMascot variant="wave" className="w-full h-auto" />
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
                <span>📋</span> Exam Papers
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
        <div className="fixed bottom-5 right-5 z-40">
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
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW B: UNLOCKED TEACHER AI WORKSPACE
  // ==========================================
  return (
    <div id="teacher-workspace-top" className="max-w-4xl mx-auto space-y-6 pb-20 relative min-h-[calc(100vh-140px)] flex flex-col justify-between">
      {/* Hidden File Input for PDF uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            setAttachedFile(f);
            if (toolMode === 'auto') setToolMode('exam');
          }
        }}
      />

      {/* Top Workspace Header Bar */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-[#E7E9EE] shadow-xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#0F172A] text-[#37C6A3] flex items-center justify-center font-bold shadow-xs shrink-0">
            <AiRobotMascot variant="avatar" size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg font-extrabold text-[#0F172A] tracking-tight">
                Ustadh Smart AI Assistant
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                Active Tenant
              </span>
            </div>
            <p className="text-[11px] text-[#7C8A9A]">
              Isolated Teaching Copilot • 0 MB storage • In-memory RAM processing
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleNewChat}
              className="px-3 py-1.5 min-h-[38px] text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 text-[#0F172A] transition flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Chat</span>
            </button>
          )}

          <button
            onClick={loadStatus}
            className="p-2 min-h-[38px] min-w-[38px] text-[#7C8A9A] hover:text-[#0F172A] rounded-xl border border-[#E7E9EE] bg-white transition cursor-pointer flex items-center justify-center"
            title="Refresh Status"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. WELCOME HERO STATE (WHEN NO MESSAGES YET)                                */}
      {/* ========================================================================= */}
      {messages.length === 0 ? (
        <div className="my-auto py-8 sm:py-12 flex flex-col items-center text-center px-4 space-y-6">
          <div className="relative">
            <div className="absolute -inset-4 rounded-full bg-[#37C6A3]/15 blur-2xl pointer-events-none" />
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center">
              <AiRobotMascot variant="wave" className="w-full h-full drop-shadow-xl" />
            </div>
          </div>

          <div className="max-w-xl space-y-2">
            <h2 className="text-xl sm:text-2xl font-extrabold text-[#0F172A] tracking-tight">
              Assalamu Alaikum Ustadh! What can I help you prepare today?
            </h2>
            <p className="text-xs sm:text-sm text-[#7C8A9A] leading-relaxed">
              Synthesize zero-storage exam papers from PDFs, craft 30-minute lesson plans, design event posters, or draft parent notices in Tamil, English, and Arabic.
            </p>
          </div>

          {/* Centered Omni-Prompt Input Box */}
          <div className="w-full max-w-2xl bg-white rounded-3xl p-3 sm:p-4 border-2 border-slate-200 focus-within:border-[#37C6A3] focus-within:ring-4 focus-within:ring-[#37C6A3]/15 shadow-xl transition-all">
            {/* Attached PDF Preview Chip */}
            {attachedFile && (
              <div className="mb-2 p-2 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-2 text-xs text-emerald-900">
                <div className="flex items-center gap-2 truncate">
                  <FileText className="w-4 h-4 text-[#37C6A3] shrink-0" />
                  <span className="font-semibold truncate">{attachedFile.name}</span>
                  <span className="text-[10px] text-emerald-700">({(attachedFile.size / 1024).toFixed(0)} KB)</span>
                </div>
                <button
                  type="button"
                  onClick={() => setAttachedFile(null)}
                  className="p-1 hover:bg-emerald-200 rounded-lg text-emerald-800 transition cursor-pointer"
                  title="Remove attachment"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <textarea
              ref={textareaRef}
              rows={2}
              placeholder="Ask anything — paste a syllabus topic, write a circular, or describe an event poster..."
              value={inputPrompt}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              className="w-full text-xs sm:text-sm text-[#0F172A] placeholder-[#7C8A9A] bg-transparent focus:outline-hidden resize-none leading-relaxed"
            />

            {/* Bottom Controls Bar inside Input Box */}
            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5 flex-nowrap overflow-x-hidden">
              <div className="flex items-center gap-1 min-w-0">
                {/* PDF Attach Button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl text-xs font-semibold border transition flex items-center gap-1 shrink-0 cursor-pointer ${
                    attachedFile
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : 'bg-slate-50 hover:bg-slate-100 text-[#0F172A] border-slate-200'
                  }`}
                  title="Upload Syllabus PDF (in-memory RAM only)"
                >
                  <Paperclip className="w-3.5 h-3.5 text-[#37C6A3]" />
                  <span className="hidden sm:inline">{attachedFile ? 'PDF Attached' : 'Attach PDF'}</span>
                </button>

                {/* Mode Selector Pill */}
                <select
                  value={toolMode}
                  onChange={(e) => setToolMode(e.target.value as ToolMode)}
                  className="h-8 px-1.5 sm:px-2 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[#0F172A] focus:outline-hidden focus:border-[#37C6A3] shrink-0 max-w-[100px] sm:max-w-none truncate"
                >
                  <option value="auto">✨ Auto</option>
                  <option value="exam">📄 Exam</option>
                  <option value="lesson">⏱️ Lesson</option>
                  <option value="poster">🎨 Poster</option>
                  <option value="circular">📢 Notice</option>
                  <option value="hifz">📖 Hifz</option>
                  <option value="speech">🎙️ Bayan</option>
                  <option value="summarizer">⚡ Summary</option>
                  <option value="translate">🌐 Translate</option>
                </select>

                {/* Language Quick Pill */}
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as any)}
                  className="h-8 px-1.5 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[#0F172A] focus:outline-hidden shrink-0 max-w-[70px] sm:max-w-none"
                >
                  <option value="English">🇬🇧 EN</option>
                  <option value="Tamil">🇱🇰 தமிழ்</option>
                  <option value="Arabic">🇸🇦 عربي</option>
                  <option value="Bilingual (Tamil + English)">Bi-Lang</option>
                </select>
              </div>

              {/* Glowing Send Button */}
              <button
                type="button"
                disabled={(!inputPrompt.trim() && !attachedFile) || isGenerating}
                onClick={() => handleSubmitPrompt()}
                className="w-8 h-8 sm:w-9 sm:h-9 min-h-[32px] min-w-[32px] sm:min-h-[36px] sm:min-w-[36px] rounded-xl bg-[#0F172A] hover:bg-[#1E293B] text-[#37C6A3] border border-emerald-500/40 shadow-md flex items-center justify-center transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed group shrink-0"
                title="Send Prompt (Enter)"
              >
                <ArrowUp className="w-4 h-4 text-[#37C6A3] group-hover:-translate-y-0.5 transition-transform" />
              </button>
            </div>
          </div>

          {/* 8 Quick-Start Suggestion Pills */}
          <div className="w-full max-w-2xl pt-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#7C8A9A] mb-3 text-center">
              Quick Islamic Copilot Actions
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {quickPills.map((pill, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={pill.action}
                  className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-[#0F172A] border border-[#E7E9EE] shadow-xs hover:border-[#37C6A3] hover:shadow-sm transition cursor-pointer text-left"
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* 2. ACTIVE CONVERSATION THREAD STATE                                       */
        /* ========================================================================= */
        <div className="flex-1 space-y-7 px-1 sm:px-2 max-w-3xl mx-auto w-full">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              {/* User Bubble */}
              {msg.sender === 'user' ? (
                <div className="bg-[#0F172A] text-white rounded-3xl rounded-tr-md p-4 sm:p-5 max-w-[85%] sm:max-w-[78%] shadow-md space-y-2 text-left">
                  {msg.file && (
                    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs text-emerald-300">
                      <FileText className="w-3.5 h-3.5 text-[#37C6A3]" />
                      <span className="font-mono truncate max-w-[200px]">{msg.file.name}</span>
                    </div>
                  )}
                  <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-sans">
                    {msg.content}
                  </p>
                  <div className="flex items-center justify-end gap-1.5 text-[10px] text-slate-400 pt-0.5">
                    <span>{modeLabels[msg.mode]?.label || 'Copilot'}</span>
                    <span>•</span>
                    <span>{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              ) : (
                /* Assistant Message: Clean Gemini / ChatGPT Conversational Flow */
                <div className="w-full flex items-start gap-3.5 sm:gap-4 text-left group">
                  {/* Left Avatar Badge */}
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-[#0F172A] border border-emerald-500/40 flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                    <AiRobotMascot variant="avatar" size={24} />
                  </div>

                  {/* Right Response Body */}
                  <div className="flex-1 min-w-0 space-y-2 pt-0.5">
                    {/* Header meta */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#0F172A]">Ustadh Copilot</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                        {modeLabels[msg.mode]?.label || 'General'}
                      </span>
                    </div>

                    {/* Formatted Content */}
                    <div className="text-xs sm:text-sm leading-relaxed text-[#0F172A]">
                      {msg.posterData ? (
                        <PosterCanvasRenderer poster={msg.posterData} />
                      ) : (
                        <AiStreamedText text={msg.content} />
                      )}
                    </div>

                    {/* Subtle Gemini / ChatGPT Bottom Action Bar */}
                    {msg.content && (
                      <div className="flex items-center gap-1.5 pt-1.5 text-slate-400">
                        <button
                          type="button"
                          onClick={() => handleCopyText(msg.content, msg.id)}
                          className="px-2 py-1 text-[11px] font-semibold rounded-lg text-slate-500 hover:text-[#0F172A] hover:bg-slate-100 transition flex items-center gap-1 cursor-pointer"
                          title="Copy response"
                        >
                          {copiedId === msg.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          <span>{copiedId === msg.id ? 'Copied' : 'Copy'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleRegenerate()}
                          className="px-2 py-1 text-[11px] font-semibold rounded-lg text-slate-500 hover:text-[#0F172A] hover:bg-slate-100 transition flex items-center gap-1 cursor-pointer"
                          title="Regenerate response"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                          <span>Regenerate</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Minimalist Inline Animated "Thinking..." Indicator */}
          {isGenerating && (
            <div className="w-full flex items-center gap-3 text-left animate-fade-in py-1">
              <div className="relative shrink-0">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-2xl bg-[#0F172A] border border-[#37C6A3]/50 flex items-center justify-center shadow-md p-1">
                  <AiRobotMascot variant="thinking" size={24} />
                </div>
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#37C6A3] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-xs sm:text-sm font-bold text-[#0F172A]">Thinking</span>
                <span className="inline-flex gap-1 text-[#37C6A3] text-sm font-extrabold animate-pulse">
                  <span>.</span><span>.</span><span>.</span>
                </span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. DOCKED BOTTOM PROMPT INPUT BAR (WHEN THREAD HAS MESSAGES)              */}
      {/* ========================================================================= */}
      {messages.length > 0 && (
        <div className="sticky bottom-3 z-30 pt-3 bg-gradient-to-t from-[#F7F6F1] via-[#F7F6F1] to-transparent">
          <div className="bg-white rounded-3xl p-3 sm:p-4 border-2 border-slate-200 focus-within:border-[#37C6A3] focus-within:ring-4 focus-within:ring-[#37C6A3]/15 shadow-xl transition-all">
            {attachedFile && (
              <div className="mb-2 p-2 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-2 text-xs text-emerald-900">
                <div className="flex items-center gap-2 truncate">
                  <FileText className="w-4 h-4 text-[#37C6A3] shrink-0" />
                  <span className="font-semibold truncate">{attachedFile.name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setAttachedFile(null)}
                  className="p-1 hover:bg-emerald-200 rounded-lg text-emerald-800 transition cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <textarea
              ref={textareaRef}
              rows={2}
              placeholder="Ask follow-up, request modifications, or paste a new topic..."
              value={inputPrompt}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              className="w-full text-xs sm:text-sm text-[#0F172A] placeholder-[#7C8A9A] bg-transparent focus:outline-hidden resize-none leading-relaxed"
            />

            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5 flex-nowrap overflow-x-hidden">
              <div className="flex items-center gap-1 min-w-0">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl text-xs font-semibold border transition flex items-center gap-1 shrink-0 cursor-pointer ${
                    attachedFile
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : 'bg-slate-50 hover:bg-slate-100 text-[#0F172A] border-slate-200'
                  }`}
                  title="Attach PDF"
                >
                  <Paperclip className="w-3.5 h-3.5 text-[#37C6A3]" />
                  <span className="hidden sm:inline">Attach PDF</span>
                </button>

                <select
                  value={toolMode}
                  onChange={(e) => setToolMode(e.target.value as ToolMode)}
                  className="h-8 px-1.5 sm:px-2 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[#0F172A] focus:outline-hidden focus:border-[#37C6A3] shrink-0 max-w-[100px] sm:max-w-none truncate"
                >
                  <option value="auto">✨ Auto</option>
                  <option value="exam">📄 Exam</option>
                  <option value="lesson">⏱️ Lesson</option>
                  <option value="poster">🎨 Poster</option>
                  <option value="circular">📢 Notice</option>
                  <option value="hifz">📖 Hifz</option>
                  <option value="speech">🎙️ Bayan</option>
                  <option value="summarizer">⚡ Summary</option>
                  <option value="translate">🌐 Translate</option>
                </select>

                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as any)}
                  className="h-8 px-1.5 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[#0F172A] focus:outline-hidden shrink-0 max-w-[70px] sm:max-w-none"
                >
                  <option value="English">🇬🇧 EN</option>
                  <option value="Tamil">🇱🇰 தமிழ்</option>
                  <option value="Arabic">🇸🇦 عربي</option>
                  <option value="Bilingual (Tamil + English)">Bi-Lang</option>
                </select>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={handleNewChat}
                    className="p-1.5 sm:px-2 sm:py-1.5 rounded-xl border border-slate-200 text-slate-500 hover:text-[#0F172A] hover:bg-slate-100 transition flex items-center gap-1 cursor-pointer shrink-0"
                    title="Start New Chat"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span className="hidden md:inline text-xs font-medium">New</span>
                  </button>
                )}

                <button
                  type="button"
                  disabled={(!inputPrompt.trim() && !attachedFile) || isGenerating}
                  onClick={() => handleSubmitPrompt()}
                  className="w-8 h-8 sm:w-9 sm:h-9 min-h-[32px] min-w-[32px] sm:min-h-[36px] sm:min-w-[36px] rounded-xl bg-[#0F172A] hover:bg-[#1E293B] text-[#37C6A3] border border-emerald-500/40 shadow-md flex items-center justify-center transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed group shrink-0"
                  title="Send Prompt (Enter)"
                >
                  <ArrowUp className="w-4 h-4 text-[#37C6A3] group-hover:-translate-y-0.5 transition-transform" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
