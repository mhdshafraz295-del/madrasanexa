import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  X,
  ExternalLink,
  Sparkles,
  Lock,
  ArrowUp,
  Paperclip,
  Plus,
  Copy,
  Check,
  FileText,
  Clock,
  Image as ImageIcon,
  Languages,
  Megaphone,
  BookOpen,
  Mic,
  Layers,
  RotateCcw,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { teacherAiService, type AiStatusResponse, type PosterGenerationResult } from '../../services/ai.service';
import AiRobotMascot from './AiRobotMascot';
import AiMarkdownContent from './AiMarkdownContent';
import PosterCanvasRenderer from './PosterCanvasRenderer';

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
            className="px-2 py-0.5 text-[10px] font-bold bg-[#0F172A] text-white rounded shadow-sm hover:bg-[#1E293B] flex items-center gap-1 transition cursor-pointer"
          >
            <span>⏩ Skip</span>
          </button>
        </div>
      )}

      <div className="prose prose-slate max-w-none text-xs leading-relaxed font-sans text-[#0F172A] dark:text-gray-100 dark:prose-invert">
        <AiMarkdownContent content={text.slice(0, displayedLength)} />
        {!isComplete && (
          <span className="inline-block w-1.5 h-3.5 ml-1 bg-[#37C6A3] animate-pulse align-middle" />
        )}
      </div>
    </div>
  );
}

export default function GlobalAiCopilotDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [statusData, setStatusData] = useState<AiStatusResponse | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [toolMode, setToolMode] = useState<ToolMode>('auto');
  const [language, setLanguage] = useState<'English' | 'Tamil' | 'Arabic' | 'Bilingual (Tamil + English)'>('English');
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const location = useLocation();
  const navigate = useNavigate();
  const isOnAiPage = location.pathname.includes('ai-assistant');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await teacherAiService.getAiStatus();
      setStatusData((prev) => {
        if (!prev) return data;
        const prevActive = prev.isActive !== undefined ? prev.isActive : (prev.aiEnabled && !prev.isExpired);
        const newActive = data.isActive !== undefined ? data.isActive : (data.aiEnabled && !data.isExpired);
        if (
          prevActive === newActive &&
          prev.aiEnabled === data.aiEnabled &&
          prev.isExpired === data.isExpired
        ) {
          return prev;
        }
        return data;
      });
      setLoadingStatus(false);
    } catch {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();

    // Re-check live AI status on window focus (never wipe attached file or generating session)
    const handleFocus = () => {
      if (attachedFile || isGenerating) return;
      fetchStatus();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchStatus, location.pathname, attachedFile, isGenerating]);

  // Re-check AI entitlement whenever the slide-over Copilot drawer opens
  useEffect(() => {
    if (isOpen) {
      fetchStatus();
    }
  }, [isOpen, fetchStatus]);

  useEffect(() => {
    if (messages.length > 0 && isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isGenerating, isOpen]);

  // Close drawer or exit expanded mode on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (isExpanded) {
          setIsExpanded(false);
        } else {
          setIsOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isExpanded]);

  // Hide the floating orb on full studio page to avoid duplicate orbs
  const isAiStudioPage = location.pathname === '/ai' || location.pathname.endsWith('/ai');
  if (isAiStudioPage) {
    return null;
  }

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

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputPrompt(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmitPrompt();
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
            isStreaming: false,
          },
        ]);
      } else {
        // Unified Copilot routing with multi-turn context: 'auto', 'exam', 'lesson', 'translate', 'circular', 'hifz', 'speech', 'summarizer'
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
            isStreaming: false,
          },
        ]);
      }
      setAttachedFile(null);
    } catch (err: any) {
      const isLocked =
        err.response?.status === 403 &&
        (err.response?.data?.code === 'AI_LOCKED' ||
          err.response?.data?.code === 'AI_SUBSCRIPTION_REQUIRED');
      if (isLocked) {
        setStatusData((prev) =>
          prev
            ? { ...prev, isActive: false, aiEnabled: false }
            : ({
                isActive: false,
                aiEnabled: false,
                isExpired: false,
                settings: {} as any,
                latestRequest: null,
                daysRemaining: 0,
                aiExpiresAt: null,
              } as AiStatusResponse)
        );
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

  const quickPills = [
    {
      label: '✨ Ask Anything',
      action: () => {
        setToolMode('auto');
        handleSubmitPrompt('Assalamu Alaikum Ustadh! How can you help me prepare for my classes today?', 'auto');
      },
    },
    {
      label: '⏱️ Lesson Plan',
      action: () => {
        setToolMode('lesson');
        handleSubmitPrompt('Create a 30-minute structured Islamic lesson plan on Fiqh of Taharah and Wudu.', 'lesson');
      },
    },
    {
      label: '📖 Hifz Quiz (Juz 30)',
      action: () => {
        setToolMode('hifz');
        handleSubmitPrompt('Create a Hifz & Tajweed quiz for Juz 30 with missing words and recitation evaluation rubric.', 'hifz');
      },
    },
    {
      label: '📢 Ramadan Notice',
      action: () => {
        setToolMode('circular');
        handleSubmitPrompt('Draft an official parent circular announcing Madrasa Ramadan school timings and Eid schedule.', 'circular');
      },
    },
  ];

  const modeLabels: Record<ToolMode, { label: string; icon: React.ReactNode }> = {
    auto: { label: '✨ Auto Copilot', icon: <Sparkles className="w-3.5 h-3.5 text-[#37C6A3]" /> },
    exam: { label: '📄 PDF Exam Paper', icon: <FileText className="w-3.5 h-3.5 text-emerald-400" /> },
    lesson: { label: '⏱️ 30-Min Lesson', icon: <Clock className="w-3.5 h-3.5 text-teal-400" /> },
    poster: { label: '🎨 Event Poster', icon: <ImageIcon className="w-3.5 h-3.5 text-cyan-400" /> },
    translate: { label: '🌐 Translator', icon: <Languages className="w-3.5 h-3.5 text-indigo-400" /> },
    circular: { label: '📢 Notice/Circular', icon: <Megaphone className="w-3.5 h-3.5 text-indigo-400" /> },
    hifz: { label: '📖 Hifz Quiz', icon: <BookOpen className="w-3.5 h-3.5 text-amber-400" /> },
    speech: { label: '🎙️ Assembly Bayan', icon: <Mic className="w-3.5 h-3.5 text-emerald-400" /> },
    summarizer: { label: '⚡ PDF Summary', icon: <Layers className="w-3.5 h-3.5 text-teal-400" /> },
  };

  const isUnlocked = Boolean(
    statusData?.isActive !== undefined
      ? statusData.isActive
      : (statusData?.aiEnabled && !statusData?.isExpired)
  );

  return (
    <>
      {/* ========================================================================= */}
      {/* 1. PERSISTENT FLOATING 3D AI ROBOT ORB (HIDDEN ON DEDICATED AI PAGE)       */}
      {/* ========================================================================= */}
      {!isOnAiPage && (
        <div className="fixed bottom-5 right-5 z-40">
          <div className="relative group">
            {/* Tooltip on Hover */}
            <div className="absolute right-16 top-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-2 group-hover:translate-x-0 whitespace-nowrap z-50">
              <div className="bg-[#0F172A] text-white px-3 py-1.5 rounded-xl border border-emerald-500/30 shadow-2xl flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-[#37C6A3]" />
                <div className="text-left">
                  <div className="text-xs font-bold leading-none text-white">Ustadh AI Copilot</div>
                  <div className="text-[10px] text-slate-400 mt-0.5 leading-none">
                    {isUnlocked ? 'Click to open slide-over chat' : 'Institutional AI Required'}
                  </div>
                </div>
                <div className="w-2 h-2 bg-[#0F172A] border-r border-t border-emerald-500/30 rotate-45 absolute -right-1 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            {/* Glowing Halo Ripple */}
            <span className="absolute inset-0 rounded-full bg-[#37C6A3]/30 animate-ping pointer-events-none" style={{ animationDuration: '3s' }} />

            {/* Round Circular Floating Action Button */}
            <button
              type="button"
              onClick={() => setIsOpen((prev) => !prev)}
              className="relative w-14 h-14 min-h-[56px] min-w-[56px] rounded-full bg-[#0F172A] hover:bg-[#1E293B] text-[#37C6A3] border-2 border-[#37C6A3] shadow-[0_4px_24px_rgba(55,198,163,0.4)] hover:shadow-[0_6px_30px_rgba(55,198,163,0.6)] transition-all duration-300 flex items-center justify-center cursor-pointer group-hover:scale-105 active:scale-95 overflow-visible"
              aria-label="Toggle Ustadh AI Copilot"
              title="Toggle Ustadh AI Copilot"
            >
              <div className="w-9 h-9 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <AiRobotMascot variant="avatar" size={36} />
              </div>

              {/* Badge Indicator Dot */}
              {isUnlocked ? (
                <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 z-10">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#37C6A3] opacity-75" />
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-[#0F172A]" />
                </span>
              ) : (
                <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 rounded-full bg-amber-500 text-slate-950 border-2 border-[#0F172A] flex items-center justify-center shadow-xs z-10">
                  <Lock className="w-2.5 h-2.5" />
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. SLIDE-OVER AI COPILOT SIDE DRAWER                                      */}
      {/* ========================================================================= */}
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden pointer-events-none">
          {/* Backdrop Blur Overlay - ONLY on mobile (< 640px), hidden on desktop for non-blocking interaction */}
          <div
            className="fixed inset-0 bg-slate-900/30 transition-opacity animate-fade-in block sm:hidden pointer-events-auto"
            onClick={() => setIsOpen(false)}
          />

          {/* Right Slide-over Panel - Non-blocking on desktop, sits directly on right edge */}
          <div className={isExpanded ? "fixed inset-0 z-50 flex pointer-events-none" : "fixed inset-y-0 right-0 max-w-full flex pointer-events-none"}>
            <div className={`${isExpanded ? 'w-full max-w-full' : 'w-screen max-w-full sm:w-[430px]'} bg-white dark:bg-[#121614] shadow-2xl border-l border-[#E7E9EE] dark:border-[#222925] flex flex-col h-full transform transition-transform duration-300 ease-in-out pointer-events-auto`}>
              {/* Drawer Top Header */}
              <div className={`px-4 py-3.5 border-b border-[#E7E9EE] dark:border-[#222925] bg-[#0F172A] dark:bg-[#121614] text-white flex items-center justify-between gap-3 shrink-0 ${isExpanded ? 'max-w-5xl w-full mx-auto' : ''}`}>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-slate-800 dark:bg-[#1A1F1C] flex items-center justify-center shrink-0 border border-emerald-500/40">
                    <AiRobotMascot variant="avatar" size={22} />
                  </div>
                  <div>
                    <div className="text-xs font-extrabold flex items-center gap-1.5 text-white">
                      <span>Ustadh AI Copilot</span>
                      {isUnlocked ? (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          Active
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          Locked
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      RAM-Only • Zero Storage • Islamic Copilot
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {isUnlocked && messages.length > 0 && (
                    <button
                      type="button"
                      onClick={handleNewChat}
                      className="px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:text-white bg-slate-800/80 hover:bg-slate-800 dark:bg-[#1A1F1C] dark:hover:bg-[#222925] rounded-lg border border-slate-700 dark:border-[#2A332E] transition flex items-center gap-1 cursor-pointer"
                      title="Start New Chat (Auto Copilot)"
                    >
                      <Plus className="w-3 h-3 text-[#37C6A3]" />
                      <span>New Chat</span>
                    </button>
                  )}

                  {isUnlocked && (
                    <button
                      type="button"
                      onClick={() => setIsExpanded((prev) => !prev)}
                      className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 dark:hover:bg-[#1A1F1C] rounded-lg transition cursor-pointer"
                      title={isExpanded ? "Exit Full Screen (Esc)" : "Expand Focus Reading Mode"}
                      aria-label={isExpanded ? "Exit Full Screen" : "Expand Focus Mode"}
                    >
                      {isExpanded ? (
                        <Minimize2 className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Maximize2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      navigate('/ai');
                    }}
                    className="px-2.5 py-1 text-[11px] font-semibold text-emerald-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 dark:bg-[#1A1F1C] dark:hover:bg-[#222925] rounded-lg border border-slate-700 dark:border-[#2A332E] transition flex items-center gap-1 cursor-pointer"
                    title="Open Full AI Studio"
                  >
                    <span>Full Studio</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsExpanded(false);
                      setIsOpen(false);
                    }}
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 dark:hover:bg-[#1A1F1C] rounded-lg transition cursor-pointer"
                    title="Close Drawer (Esc)"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Drawer Content */}
              {loadingStatus ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-3">
                  <div className="w-12 h-12 flex items-center justify-center">
                    <AiRobotMascot variant="thinking" size={48} />
                  </div>
                  <span className="text-xs font-semibold text-slate-500">Checking AI Assistant entitlement...</span>
                </div>
              ) : !isUnlocked ? (
                /* ========================================================================= */
                /* LOCKED PREVIEW INSIDE SIDE DRAWER                                         */
                /* ========================================================================= */
                <div className="flex-1 overflow-y-auto p-5 sm:p-6 flex flex-col justify-between space-y-6">
                  <div className="space-y-4 text-center my-auto">
                    <div className="w-20 h-20 mx-auto flex items-center justify-center">
                      <AiRobotMascot variant="wave" className="w-full h-full drop-shadow-md" />
                    </div>

                    <div className="space-y-1.5">
                      <h3 className="text-base font-extrabold text-[#0F172A] dark:text-white">
                        Ustadh Smart AI Assistant
                      </h3>
                      <p className="text-xs text-[#7C8A9A] dark:text-[#9CA3AF] leading-relaxed max-w-sm mx-auto">
                        Your institution has not yet activated the Smart AI Assistant module.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-left pt-2">
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#1A1F1C] border border-slate-200 dark:border-[#2A332E]">
                        <div className="text-[11px] font-bold text-[#0F172A] dark:text-white flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5 text-[#37C6A3]" />
                          <span>PDF Exam Maker</span>
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-[#9CA3AF] mt-0.5">MCQs, essays & answer key</div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#1A1F1C] border border-slate-200 dark:border-[#2A332E]">
                        <div className="text-[11px] font-bold text-[#0F172A] dark:text-white flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-teal-500" />
                          <span>30-Min Lesson Plan</span>
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-[#9CA3AF] mt-0.5">Hook, core & blackboard</div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#1A1F1C] border border-slate-200 dark:border-[#2A332E]">
                        <div className="text-[11px] font-bold text-[#0F172A] dark:text-white flex items-center gap-1">
                          <ImageIcon className="w-3.5 h-3.5 text-cyan-500" />
                          <span>Event Poster Maker</span>
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-[#9CA3AF] mt-0.5">Flux 1 Schnell background</div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#1A1F1C] border border-slate-200 dark:border-[#2A332E]">
                        <div className="text-[11px] font-bold text-[#0F172A] dark:text-white flex items-center gap-1">
                          <Languages className="w-3.5 h-3.5 text-indigo-500" />
                          <span>3-Lang Translator</span>
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-[#9CA3AF] mt-0.5">Tamil, Arabic & English</div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 dark:border-[#222925]">
                    <button
                      type="button"
                      onClick={() => {
                        setIsOpen(false);
                        navigate('/ai');
                      }}
                      className="w-full py-3 px-4 rounded-xl bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs font-bold shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4 text-[#37C6A3]" />
                      <span>Learn More in AI Studio →</span>
                    </button>
                    <p className="text-[10px] text-center text-slate-400 mt-2">
                      Please contact your Madrasa Administrator to activate AI Assistant access.
                    </p>
                  </div>
                </div>
              ) : (
                /* ========================================================================= */
                /* UNLOCKED CONVERSATIONAL COPILOT CHAT IN SIDE DRAWER                       */
                /* ========================================================================= */
                <div className="flex-1 flex flex-col justify-between overflow-hidden bg-slate-50/50 dark:bg-[#0A0D0C]">
                  {/* Messages Scroll Area */}
                  <div className={`flex-1 overflow-y-auto p-4 space-y-4 ${isExpanded ? 'max-w-5xl w-full mx-auto px-4 sm:px-6 py-4' : ''}`}>
                    {messages.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-4 space-y-4 my-auto">
                        <div className="w-16 h-16 flex items-center justify-center">
                          <AiRobotMascot variant="wave" className="w-full h-full drop-shadow-md" />
                        </div>
                        <div>
                          <h4 className="text-sm font-extrabold text-[#0F172A] dark:text-white">
                            Assalamu Alaikum Ustadh!
                          </h4>
                          <p className="text-[11px] text-[#7C8A9A] dark:text-[#9CA3AF] mt-1 leading-relaxed">
                            How can I assist you with your classes or teaching today?
                          </p>
                        </div>

                        {/* Quick Start Pills */}
                        <div className="flex flex-wrap items-center justify-center gap-1.5 pt-2">
                          {quickPills.map((pill, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={pill.action}
                              className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#1A1F1C] hover:bg-slate-100 dark:hover:bg-[#222925] text-[#0F172A] dark:text-white border border-[#E7E9EE] dark:border-[#2A332E] shadow-xs hover:border-[#37C6A3] dark:hover:border-[#10B981] transition cursor-pointer"
                            >
                              {pill.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-4">
                          {messages.map((msg) => (
                            <div
                              key={msg.id}
                              className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                            >
                              {msg.sender === 'user' ? (
                                <div className="bg-[#0F172A] dark:bg-[#1A1F1C] text-white dark:text-gray-100 rounded-2xl rounded-tr-xs p-3 max-w-[85%] shadow-sm space-y-1.5 text-left border border-transparent dark:border-[#2A332E]">
                                  {msg.file && (
                                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-800 text-[10px] text-emerald-300">
                                      <FileText className="w-3 h-3 text-[#37C6A3]" />
                                      <span className="font-mono truncate max-w-[180px]">{msg.file.name}</span>
                                    </div>
                                  )}
                                  <p className="text-xs leading-relaxed whitespace-pre-wrap font-sans">
                                    {msg.content}
                                  </p>
                                </div>
                              ) : (
                                <div className="w-full flex items-start gap-2.5 text-left">
                                  <div className="w-7 h-7 rounded-xl bg-[#0F172A] border border-emerald-500/40 flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                                    <AiRobotMascot variant="avatar" size={18} />
                                  </div>

                                  <div className="flex-1 min-w-0 space-y-1.5">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[11px] font-bold text-[#0F172A] dark:text-white">Ustadh Copilot</span>
                                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-[#1E2521] text-slate-700 dark:text-gray-200 border border-slate-200 dark:border-[#323D37]">
                                        {modeLabels[msg.mode]?.label || 'Copilot'}
                                      </span>
                                    </div>

                                    <div className="text-xs leading-relaxed text-[#0F172A] dark:text-gray-100 bg-white dark:bg-[#121614] p-3 rounded-2xl rounded-tl-xs border border-slate-200/80 dark:border-[#222925] shadow-xs">
                                      {msg.posterData ? (
                                        <PosterCanvasRenderer poster={msg.posterData} />
                                      ) : (
                                        <AiStreamedText text={msg.content} />
                                      )}
                                    </div>

                                    {msg.content && (
                                      <div className="flex items-center gap-1 pt-1 text-slate-400">
                                        <button
                                          type="button"
                                          onClick={() => handleCopyText(msg.content, msg.id)}
                                          className="px-1.5 py-0.5 text-[10px] font-semibold rounded-md text-slate-500 hover:text-[#0F172A] dark:text-gray-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1E2521] transition flex items-center gap-1 cursor-pointer"
                                          title="Copy response"
                                        >
                                          {copiedId === msg.id ? (
                                            <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                          ) : (
                                            <Copy className="w-3 h-3" />
                                          )}
                                          <span>{copiedId === msg.id ? 'Copied' : 'Copy'}</span>
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => handleRegenerate()}
                                          className="px-1.5 py-0.5 text-[10px] font-semibold rounded-md text-slate-500 hover:text-[#0F172A] dark:text-gray-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1E2521] transition flex items-center gap-1 cursor-pointer"
                                          title="Regenerate response"
                                        >
                                          <RotateCcw className="w-3 h-3 text-slate-500 dark:text-gray-400" />
                                          <span>Regenerate</span>
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}

                          {/* Inline Minimalist Thinking Robot Indicator */}
                          {isGenerating && (
                            <div className="w-full flex items-center gap-2.5 text-left animate-fade-in py-1">
                              <div className="relative shrink-0">
                                <div className="w-7 h-7 rounded-xl bg-[#0F172A] border border-[#37C6A3]/50 flex items-center justify-center shadow-md p-0.5">
                                  <AiRobotMascot variant="thinking" size={20} />
                                </div>
                                <span className="absolute -top-1 -right-1 flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#37C6A3] opacity-75" />
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-[#0F172A] dark:text-white">Thinking</span>
                                <span className="inline-flex gap-0.5 text-[#37C6A3] text-xs font-extrabold animate-pulse">
                                  <span>.</span><span>.</span><span>.</span>
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                        <div ref={chatEndRef} />
                      </>
                    )}
                  </div>

                  {/* Docked Prompt Input Bar */}
                  <div className={`p-3 border-t border-[#E7E9EE] dark:border-[#222925] bg-white dark:bg-[#121614] space-y-2 shrink-0 ${isExpanded ? 'max-w-5xl w-full mx-auto' : ''}`}>
                    {attachedFile && (
                      <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between gap-2 text-[11px] text-emerald-900 dark:text-emerald-200 shadow-2xs">
                        <div className="flex items-center gap-1.5 truncate min-w-0">
                          <span className="text-xs shrink-0">📄</span>
                          <span className="font-bold truncate text-[#0F172A] dark:text-white">{attachedFile.name}</span>
                          <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-mono shrink-0">
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
                          className="p-0.5 hover:bg-emerald-200/80 dark:hover:bg-emerald-800/80 rounded text-emerald-800 dark:text-emerald-200 transition cursor-pointer shrink-0"
                          title="Remove attached PDF"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    <div className="bg-slate-50 dark:bg-[#1A1F1C] rounded-2xl p-2 border border-slate-200 dark:border-[#2A332E] focus-within:border-[#37C6A3] dark:focus-within:border-[#10B981] focus-within:ring-2 focus-within:ring-[#37C6A3]/20 dark:focus-within:ring-[#10B981]/20 transition-all">
                      <textarea
                        ref={textareaRef}
                        rows={2}
                        placeholder="Ask anything or request exam/notice..."
                        value={inputPrompt}
                        onChange={handleTextareaChange}
                        onKeyDown={handleKeyDown}
                        className="w-full text-xs text-[#0F172A] dark:text-white placeholder-[#7C8A9A] dark:placeholder-[#7A857F] bg-transparent focus:outline-hidden resize-none leading-relaxed"
                      />

                      <div className="pt-1.5 border-t border-slate-200/60 dark:border-[#2A332E]/60 flex items-center justify-between gap-1 flex-nowrap overflow-x-hidden">
                        <div className="flex items-center gap-1 min-w-0">
                          {/* Inline Hidden File Input for in-memory PDF uploads (zero focus-scroll) */}
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="application/pdf,.pdf"
                            className="hidden"
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

                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              fileInputRef.current?.click();
                            }}
                            className={`p-1.5 rounded-lg text-xs border transition shrink-0 cursor-pointer ${
                              attachedFile
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : 'bg-white dark:bg-[#1A1F1C] hover:bg-slate-100 dark:hover:bg-[#222925] text-[#0F172A] dark:text-white border-slate-200 dark:border-[#2A332E]'
                            }`}
                            title="Attach PDF (In-Memory RAM)"
                          >
                            <Paperclip className="w-3.5 h-3.5 text-[#37C6A3]" />
                          </button>

                          <select
                            value={toolMode}
                            onChange={(e) => setToolMode(e.target.value as ToolMode)}
                            className="h-7 px-1.5 text-[11px] font-bold rounded-lg border border-slate-200 dark:border-[#2A332E] bg-white dark:bg-[#1A1F1C] text-[#0F172A] dark:text-white focus:outline-hidden shrink-0 max-w-[85px] sm:max-w-none truncate"
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
                            className="h-7 px-1 text-[11px] font-semibold rounded-lg border border-slate-200 dark:border-[#2A332E] bg-white dark:bg-[#1A1F1C] text-[#0F172A] dark:text-white focus:outline-hidden shrink-0 max-w-[65px] sm:max-w-none"
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
                              className="p-1.5 text-slate-500 hover:text-[#0F172A] dark:text-gray-400 dark:hover:text-white rounded-lg hover:bg-slate-200 dark:hover:bg-[#1E2521] transition cursor-pointer shrink-0"
                              title="New Chat"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={(!inputPrompt.trim() && !attachedFile) || isGenerating}
                            onClick={() => handleSubmitPrompt()}
                            className="w-7 h-7 min-w-[28px] min-h-[28px] rounded-lg bg-[#0F172A] hover:bg-[#1E293B] text-[#37C6A3] border border-emerald-500/40 shadow-xs flex items-center justify-center transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                            title="Send Message"
                          >
                            <ArrowUp className="w-3.5 h-3.5 text-[#37C6A3]" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
