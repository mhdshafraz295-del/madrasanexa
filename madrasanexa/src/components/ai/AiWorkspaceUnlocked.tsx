import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Paperclip,
  ArrowUp,
  FileText,
  Clock,
  Image as ImageIcon,
  Languages,
  Copy,
  Check,
  RefreshCw,
  Plus,
  X,
  Megaphone,
  BookOpen,
  Mic,
  Layers,
  RotateCcw,
} from 'lucide-react';
import { aiService, type AiStatusResponse, type PosterGenerationResult } from '../../services/ai.service';
import AiRobotMascot from './AiRobotMascot';
import PosterCanvasRenderer from './PosterCanvasRenderer';
import AiMarkdownContent from './AiMarkdownContent';

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

interface AiWorkspaceUnlockedProps {
  statusData: AiStatusResponse;
  onRefresh?: () => void;
  isTeacher?: boolean;
}

// Smooth Typewriter / Streamed Text Renderer with Skip Option
function AiStreamedText({ text, onFinished }: { text: string; onFinished?: () => void }) {
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
    const chunkSize = Math.max(25, Math.floor(text.length / 80));
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
    }, 20);

    return () => clearInterval(interval);
  }, [text, isSkipped, prefersReducedMotion, onFinished]);

  const isComplete = displayedLength >= text.length;

  return (
    <div className="relative">
      {!isComplete && !isSkipped && !prefersReducedMotion && (
        <div className="sticky top-2 z-20 flex justify-end mb-2">
          <button
            type="button"
            onClick={() => {
              setIsSkipped(true);
              setDisplayedLength(text.length);
              onFinished?.();
            }}
            className="px-2.5 py-1 text-[11px] font-bold bg-[#0F172A] text-white rounded-lg shadow-sm hover:bg-[#1E293B] flex items-center gap-1 transition cursor-pointer"
          >
            <span>⏩ Skip to End</span>
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

export default function AiWorkspaceUnlocked({
  statusData,
  onRefresh,
}: AiWorkspaceUnlockedProps) {
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

  // Handle textarea auto-resize
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
        const res = await aiService.generatePoster({
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
            isStreaming: false,
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

        const res = await aiService.generateExamPaper(formData);
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

        const res = await aiService.generateLessonPlan(formData);
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

        const res = await aiService.translateContent({
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

        const res = await aiService.chatWithCopilot(formData);
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
      setAttachedFile(null);
    } catch (err: any) {
      if (
        err.response?.status === 403 &&
        (err.response?.data?.code === 'AI_LOCKED' || err.response?.data?.code === 'AI_SUBSCRIPTION_REQUIRED')
      ) {
        onRefresh?.();
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
      action: (e?: React.MouseEvent) => {
        e?.preventDefault();
        e?.stopPropagation();
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
      action: (e?: React.MouseEvent) => {
        e?.preventDefault();
        e?.stopPropagation();
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

  return (
    <div className="max-w-4xl mx-auto h-[calc(100dvh-5.5rem)] min-h-[520px] flex flex-col overflow-hidden pb-1 sm:pb-2 relative">
      {/* Hidden File Input for PDF uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only fixed -top-96 -left-96 opacity-0 pointer-events-none"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            const isPdf = f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
            if (!isPdf) {
              alert('Please select a valid PDF file.');
              return;
            }
            if (f.size > 25 * 1024 * 1024) {
              alert('PDF file must not exceed 25 MB.');
              return;
            }
            setAttachedFile(f);
          }
          e.target.value = '';
        }}
      />

      {/* Top Workspace Header Bar (Responsive 2-Row Layout on 345px Mobile) */}
      <div className="bg-white rounded-2xl sm:rounded-3xl p-3 sm:p-5 border border-[#E7E9EE] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 shrink-0 mb-2 sm:mb-3">
        {/* Row 1: Bot Avatar + Title + Active Tenant Badge */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-[#0F172A] text-[#37C6A3] flex items-center justify-center font-bold shadow-xs shrink-0">
            <AiRobotMascot variant="avatar" size={24} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <h1 className="text-sm sm:text-base md:text-lg font-extrabold text-[#0F172A] tracking-tight truncate">
                MadrasaNexa Smart AI Assistant
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                {statusData?.madrasaName || 'Active Tenant'}
              </span>
            </div>
            <p className="text-[10.5px] sm:text-[11px] text-[#7C8A9A] truncate hidden sm:block">
              Isolated Copilot • 0 MB storage • In-memory RAM processing
            </p>
          </div>
        </div>

        {/* Row 2 on mobile: Subtitle & Aligned Action Buttons */}
        <div className="flex items-center justify-between sm:justify-end gap-2 pt-1.5 sm:pt-0 border-t border-slate-100 sm:border-0">
          <p className="text-[10.5px] text-[#7C8A9A] sm:hidden truncate flex-1">
            0 MB storage • In-memory RAM
          </p>
          <div className="flex items-center gap-1.5 shrink-0">
            {messages.length > 0 && (
              <button
                type="button"
                onClick={handleNewChat}
                className="px-2.5 sm:px-3 py-1.5 min-h-[34px] sm:min-h-[38px] text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 text-[#0F172A] transition flex items-center gap-1 cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Chat</span>
              </button>
            )}

            {onRefresh && (
              <button
                onClick={onRefresh}
                className="p-1.5 sm:p-2 min-h-[34px] min-w-[34px] sm:min-h-[38px] sm:min-w-[38px] text-[#7C8A9A] hover:text-[#0F172A] rounded-xl border border-[#E7E9EE] bg-white transition cursor-pointer flex items-center justify-center shrink-0"
                title="Refresh Status"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SCROLLABLE CONVERSATION / WELCOME WORKSPACE (FLEX-1 OVERFLOW-Y-AUTO)       */}
      {/* ========================================================================= */}
      <div className="flex-1 overflow-y-auto min-h-0 pr-1 space-y-4">
        {messages.length === 0 ? (
          <div className="my-auto py-6 sm:py-10 flex flex-col items-center text-center px-4 space-y-6">
            <div className="relative">
              <div className="absolute -inset-4 rounded-full bg-[#37C6A3]/15 blur-2xl pointer-events-none" />
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center">
                <AiRobotMascot variant="wave" className="w-full h-full drop-shadow-xl" />
              </div>
            </div>

            <div className="max-w-xl space-y-2">
              <h2 className="text-lg sm:text-2xl font-extrabold text-[#0F172A] tracking-tight">
                Assalamu Alaikum! What can I help your Madrasa with today?
              </h2>
              <p className="text-xs sm:text-sm text-[#7C8A9A] leading-relaxed">
                Synthesize zero-storage exam papers from PDFs, craft 30-minute lesson plans, design event posters, or draft parent notices in Tamil, English, and Arabic.
              </p>
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
                    onClick={(e) => pill.action(e)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-[#0F172A] border border-[#E7E9EE] shadow-xs hover:border-[#37C6A3] hover:shadow-sm transition cursor-pointer text-left"
                  >
                    {pill.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6 px-1 sm:px-2 max-w-3xl mx-auto w-full">
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
                      <span className="text-xs font-bold text-[#0F172A]">Madrasa Copilot</span>
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
      </div>

      {/* ========================================================================= */}
      {/* 3. PERMANENTLY PINNED BOTTOM CHAT INPUT COMPOSER BOX                       */}
      {/* ========================================================================= */}
      <div className="shrink-0 pt-2 z-20 bg-gradient-to-t from-[#F7F6F1] via-[#F7F6F1] to-transparent">
          <div className="bg-white rounded-3xl p-3 sm:p-4 border-2 border-slate-200 focus-within:border-[#37C6A3] focus-within:ring-4 focus-within:ring-[#37C6A3]/15 shadow-xl transition-all">
            {attachedFile && (
              <div className="mb-2 p-2 sm:p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-2 text-xs text-emerald-900 shadow-2xs">
                <div className="flex items-center gap-2 truncate min-w-0">
                  <span className="text-sm shrink-0">📄</span>
                  <span className="font-bold truncate text-[#0F172A]">{attachedFile.name}</span>
                  <span className="text-[11px] text-emerald-700 font-mono shrink-0">
                    • {attachedFile.size < 1024 * 1024
                        ? `${(attachedFile.size / 1024).toFixed(0)} KB`
                        : `${(attachedFile.size / (1024 * 1024)).toFixed(2)} MB`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setAttachedFile(null);
                  }}
                  className="p-1 hover:bg-emerald-200/80 rounded-lg text-emerald-800 transition cursor-pointer shrink-0"
                  title="Remove attached PDF"
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
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl text-xs font-semibold border transition flex items-center gap-1 shrink-0 cursor-pointer ${
                    attachedFile
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : 'bg-slate-50 hover:bg-slate-100 text-[#0F172A] border-slate-200'
                  }`}
                  title="Attach PDF"
                >
                  <Paperclip className="w-3.5 h-3.5 text-[#37C6A3] shrink-0" />
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
      </div>
  );
}
