import React, { useState } from 'react';
import {
  Sparkles,
  FileText,
  Clock,
  Palette,
  Languages,
  Megaphone,
  BookOpen,
  Mic,
  Layers,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Zap,
  Lock,
} from 'lucide-react';
import AiRobotMascot from './AiRobotMascot';

export interface OrbitalFeature {
  id: string;
  name: string;
  shortName: string;
  category: string;
  emoji: string;
  iconNode: React.ReactNode;
  ring: 'inner' | 'outer';
  angleDeg: number;
  badgeBg: string;
  glowColor: string;
  description: string;
  pills: string[];
}

export const ORBITAL_AI_FEATURES: OrbitalFeature[] = [
  // Inner Orbital Ring (4 Core Pedagogical & Synthesis Engines)
  {
    id: 'exam-generator',
    name: 'Zero-Storage PDF Exam Generator',
    shortName: 'Exam Generator',
    category: 'RAM-Only Synthesis',
    emoji: '📝',
    iconNode: <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-300" />,
    ring: 'inner',
    angleDeg: 0, // Top
    badgeBg: 'from-emerald-600 to-teal-800',
    glowColor: 'rgba(16, 185, 129, 0.4)',
    description: 'Upload syllabus or textbook PDFs to instantly synthesize multi-section MCQs, short answers, essays, and complete teacher answer keys in RAM with zero storage footprint.',
    pills: ['📄 Upload PDF', '📝 MCQs & Essays', '✅ Answer Keys', '📋 Term Exams'],
  },
  {
    id: 'lesson-planner',
    name: 'Ustadh 30-Min Lesson Planner',
    shortName: 'Lesson Planner',
    category: 'Classroom Ready',
    emoji: '⏱️',
    iconNode: <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-300" />,
    ring: 'inner',
    angleDeg: 90, // Right
    badgeBg: 'from-teal-600 to-cyan-800',
    glowColor: 'rgba(20, 184, 166, 0.4)',
    description: 'Generate structured 30-minute pedagogical lesson plans with interactive warm-ups, blackboard notes, student activities, and homework in 1-click.',
    pills: ['⏱️ 30-Min Flow', '📊 Blackboard Notes', '🎯 Student Activity', '📝 Daily Homework'],
  },
  {
    id: 'poster-maker',
    name: 'Madrasa Event Poster Maker',
    shortName: 'Poster Maker',
    category: 'Visual Media',
    emoji: '🎨',
    iconNode: <Palette className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-300" />,
    ring: 'inner',
    angleDeg: 180, // Bottom
    badgeBg: 'from-amber-600 to-orange-800',
    glowColor: 'rgba(245, 158, 11, 0.4)',
    description: 'Synthesize Islamic announcement flyers, Hifz graduation posters, and admission banners with Cloudflare Flux AI art-direction and crisp typography.',
    pills: ['🎨 1-Click Poster', '🕌 Islamic Design', '🖼️ High Resolution', '⬇️ Instant PNG'],
  },
  {
    id: 'multilingual-translator',
    name: 'Multilingual Islamic Translator',
    shortName: 'Translator',
    category: '3 Languages',
    emoji: '🌐',
    iconNode: <Languages className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-300" />,
    ring: 'inner',
    angleDeg: 270, // Left
    badgeBg: 'from-cyan-600 to-blue-800',
    glowColor: 'rgba(6, 182, 212, 0.4)',
    description: 'Translate administrative circulars, exam questions, and curriculum text across Tamil, English, and Arabic accurately preserving Islamic terminologies.',
    pills: ['🇱🇰/🇮🇳 தமிழ்', '🇬🇧 English', '🇸🇦 العربية', '✨ Accurate Terms'],
  },

  // Outer Orbital Ring (4 Institutional & Quranic Extension Engines)
  {
    id: 'circular-writer',
    name: 'Parent Circular & Notice Writer',
    shortName: 'Notice Writer',
    category: 'Communication',
    emoji: '📢',
    iconNode: <Megaphone className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-300" />,
    ring: 'outer',
    angleDeg: 45, // Top-Right
    badgeBg: 'from-blue-600 to-indigo-800',
    glowColor: 'rgba(59, 130, 246, 0.4)',
    description: 'Draft professional parent notices, fees reminders, Ramadan and holiday circulars in Tamil, English, or Arabic with Islamic etiquette and formal headers.',
    pills: ['📢 Parent Letters', '🕌 Islamic Etiquette', '🌙 Ramadan & Eid', '📋 1-Click Print'],
  },
  {
    id: 'hifz-tajweed',
    name: 'Hifz & Tajweed Worksheet Builder',
    shortName: 'Hifz & Tajweed',
    category: 'Quran Studies',
    emoji: '📖',
    iconNode: <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />,
    ring: 'outer',
    angleDeg: 135, // Bottom-Right
    badgeBg: 'from-amber-600 to-yellow-800',
    glowColor: 'rgba(217, 119, 6, 0.4)',
    description: 'Create custom Surah revision trackers, Tajweed rule drill sheets (Ghunnah, Qalqalah, Madd), and oral examination evaluation rubrics.',
    pills: ['📖 Juz/Surah Drills', '🎯 Tajweed Rules', '✅ Oral Rubric', '📊 Progress Tracker'],
  },
  {
    id: 'speech-writer',
    name: 'Bayan & Student Speech Writer',
    shortName: 'Speech Writer',
    category: 'Minbar & Assembly',
    emoji: '🎙️',
    iconNode: <Mic className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-300" />,
    ring: 'outer',
    angleDeg: 225, // Bottom-Left
    badgeBg: 'from-purple-600 to-indigo-900',
    glowColor: 'rgba(147, 51, 234, 0.4)',
    description: 'Draft inspiring 3 to 15-minute speeches with authentic Quranic Ayahs, Hadith references, and structured bullet points for assemblies and Jumu’ah bayans.',
    pills: ['🎙️ Assembly Talks', '📚 Authentic Proofs', '🌟 Student Prep', '⏱️ Timed Outlines'],
  },
  {
    id: 'syllabus-summarizer',
    name: 'PDF Syllabus & Chapter Summarizer',
    shortName: 'PDF Summarizer',
    category: 'RAM-Only Notes',
    emoji: '⚡',
    iconNode: <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />,
    ring: 'outer',
    angleDeg: 315, // Top-Left
    badgeBg: 'from-emerald-700 to-slate-900',
    glowColor: 'rgba(16, 185, 129, 0.4)',
    description: 'Upload Islamic syllabus books or chapter PDFs to extract key learning takeaways, glossary terms, and revision bullet points in RAM with zero disk storage.',
    pills: ['⚡ Instant Summary', '🗂️ Study Notes', '🔒 0 MB Stored', '📚 Key Terms'],
  },
];

interface AiConcentricOrbitShowcaseProps {
  portalType?: 'admin' | 'teacher';
  onSelectFeature?: (feature: OrbitalFeature) => void;
}

export default function AiConcentricOrbitShowcase({
  portalType = 'teacher',
  onSelectFeature,
}: AiConcentricOrbitShowcaseProps) {
  const [selectedTool, setSelectedTool] = useState<OrbitalFeature>(ORBITAL_AI_FEATURES[0]);
  const [isPaused, setIsPaused] = useState(false);
  const [showAllGrid, setShowAllGrid] = useState(false);

  const innerTools = ORBITAL_AI_FEATURES.filter((f) => f.ring === 'inner');
  const outerTools = ORBITAL_AI_FEATURES.filter((f) => f.ring === 'outer');

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Component-scoped CSS for concentric orbital mechanics */}
      <style>{`
        @keyframes orbit-cw {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes orbit-ccw {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        @keyframes counter-orbit-cw {
          from { transform: rotate(0deg); }
          to { transform: rotate(-360deg); }
        }
        @keyframes counter-orbit-ccw {
          from { transform: rotate(-360deg); }
          to { transform: rotate(0deg); }
        }
        @keyframes orbit-pulse-glow {
          0%, 100% { opacity: 0.25; transform: scale(1); }
          50% { opacity: 0.55; transform: scale(1.06); }
        }
        @keyframes orbit-radar-sweep {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .anim-orbit-cw-inner {
          animation: orbit-cw 38s linear infinite;
        }
        .anim-orbit-ccw-outer {
          animation: orbit-ccw 52s linear infinite;
        }
        .anim-counter-cw-inner {
          animation: counter-orbit-cw 38s linear infinite;
        }
        .anim-counter-ccw-outer {
          animation: counter-orbit-ccw 52s linear infinite;
        }
        .anim-orbit-pulse {
          animation: orbit-pulse-glow 5s ease-in-out infinite;
        }
        .anim-radar-sweep {
          animation: orbit-radar-sweep 12s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .anim-orbit-cw-inner,
          .anim-orbit-ccw-outer,
          .anim-counter-cw-inner,
          .anim-counter-ccw-outer,
          .anim-orbit-pulse,
          .anim-radar-sweep {
            animation: none !important;
          }
        }
      `}</style>

      {/* Hero Header with Top Padding to avoid navbar clipping on mobile */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0B1120] via-[#0F172A] to-[#050811] text-white p-5 sm:p-8 md:p-10 border border-slate-800 shadow-2xl">
        {/* Ambient Glow Orbs */}
        <div className="absolute -top-24 -right-24 w-72 sm:w-96 h-72 sm:h-96 rounded-full bg-[#37C6A3]/15 blur-3xl pointer-events-none anim-orbit-pulse" />
        <div className="absolute -bottom-24 -left-24 w-72 sm:w-80 h-72 sm:h-80 rounded-full bg-teal-500/10 blur-3xl pointer-events-none anim-orbit-pulse" style={{ animationDelay: '2.5s' }} />

        {/* Top Header Text with Zero Mobile Clipping (345px-420px tested) */}
        <div className="relative z-10 text-center max-w-3xl mx-auto space-y-3 pt-2 sm:pt-0">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#37C6A3]/20 border border-[#37C6A3]/40 text-[#37C6A3] text-xs font-semibold shadow-xs">
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>MadrasaNexa Ustadh Smart AI Ecosystem</span>
            <span className="text-slate-500">|</span>
            <span className="flex items-center gap-1 text-slate-300">
              <Lock className="w-3 h-3 text-amber-400" />
              Locked Preview
            </span>
          </div>

          <h1 className="text-xl xs:text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white leading-tight break-words px-1">
            Ustadh Lesson Planning & <span className="text-[#37C6A3]">Exam Preparation Copilot</span>
          </h1>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-2xl mx-auto px-2">
            Explore our 8 specialized pedagogical tools orbiting around the secure in-memory engine. Tap any tool on the concentric orbital rings below to inspect its capabilities.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 pt-1 text-[11px] sm:text-xs font-medium text-slate-300">
            <div className="flex items-center gap-1.5 bg-slate-900/80 px-2.5 sm:px-3 py-1.5 rounded-xl border border-slate-700/80">
              <ShieldCheck className="w-3.5 h-3.5 text-[#37C6A3]" />
              <span>Zero-Storage In-Memory RAM</span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-900/80 px-2.5 sm:px-3 py-1.5 rounded-xl border border-slate-700/80">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Google Gemini 2.5 & Workers AI</span>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* CONCENTRIC ORBITAL RING SHOWCASE                                          */}
        {/* ========================================================================= */}
        <div className="mt-8 sm:mt-10 relative flex justify-center items-center select-none overflow-visible">
          {/* Main Orbital Stage (305px-325px mobile down to 345px viewport, 460px sm, 540px md) */}
          <div
            className="relative w-[305px] h-[305px] xs:w-[325px] xs:h-[325px] sm:w-[460px] sm:h-[460px] md:w-[540px] md:h-[540px] flex items-center justify-center shrink-0"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
          >
            {/* Ambient Circular Glow Base */}
            <div className="absolute inset-4 rounded-full bg-radial from-[#37C6A3]/10 via-[#0F172A]/40 to-transparent pointer-events-none" />

            {/* Subtle Radar Sweep Arc */}
            <div
              className="absolute inset-2 rounded-full pointer-events-none anim-radar-sweep opacity-30"
              style={{
                background: 'conic-gradient(from 0deg, transparent 0deg, transparent 270deg, rgba(55, 198, 163, 0.22) 360deg)',
              }}
            />

            {/* =================================================================== */}
            {/* 1. OUTER ORBITAL RING (Diameter: ~88% of container)                 */}
            {/* =================================================================== */}
            <div
              className="absolute inset-0 m-auto rounded-full border border-dashed border-slate-700/80 sm:border-[#37C6A3]/25 anim-orbit-ccw-outer pointer-events-none"
              style={{
                width: '88%',
                height: '88%',
                animationPlayState: isPaused ? 'paused' : 'running',
              }}
            >
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-[#37C6A3]/60 blur-[1px]" />
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-teal-400/40 blur-[1px]" />

              {/* 4 Outer Tools */}
              {outerTools.map((tool) => {
                const rad = (tool.angleDeg * Math.PI) / 180;
                const leftPercent = 50 + 50 * Math.sin(rad);
                const topPercent = 50 - 50 * Math.cos(rad);
                const isSelected = selectedTool.id === tool.id;

                return (
                  <div
                    key={tool.id}
                    className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto"
                    style={{
                      left: `${leftPercent}%`,
                      top: `${topPercent}%`,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTool(tool);
                        onSelectFeature?.(tool);
                      }}
                      className={`group relative flex items-center gap-1 sm:gap-1.5 p-1 sm:px-2.5 sm:py-1.5 rounded-full sm:rounded-2xl border transition-all duration-300 cursor-pointer shadow-lg backdrop-blur-md anim-counter-ccw-outer ${
                        isSelected
                          ? 'bg-[#0F172A] border-[#37C6A3] ring-2 ring-[#37C6A3]/60 scale-110 shadow-[#37C6A3]/30 z-30'
                          : 'bg-[#0B1120]/90 border-slate-700/80 hover:border-[#37C6A3]/70 hover:scale-105 z-10'
                      }`}
                      style={{
                        animationPlayState: isPaused ? 'paused' : 'running',
                      }}
                      title={tool.name}
                    >
                      <span className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-xs shadow-xs bg-gradient-to-br ${tool.badgeBg} text-white shrink-0`}>
                        {tool.emoji}
                      </span>
                      <span className={`text-[10px] sm:text-xs font-bold whitespace-nowrap transition-colors ${
                        isSelected ? 'text-[#37C6A3]' : 'text-slate-300 group-hover:text-white'
                      } ${isSelected ? 'inline-block' : 'hidden sm:inline-block'}`}>
                        {tool.shortName}
                      </span>

                      {isSelected && (
                        <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#37C6A3] opacity-75" />
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
                        </span>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* =================================================================== */}
            {/* 2. INNER ORBITAL RING (Diameter: ~58% of container)                 */}
            {/* =================================================================== */}
            <div
              className="absolute inset-0 m-auto rounded-full border border-dashed border-[#37C6A3]/45 anim-orbit-cw-inner pointer-events-none"
              style={{
                width: '58%',
                height: '58%',
                animationPlayState: isPaused ? 'paused' : 'running',
              }}
            >
              <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 rounded-full bg-emerald-400/60 blur-[1px]" />
              <div className="absolute top-1/2 -right-1 -translate-y-1/2 w-2 h-2 rounded-full bg-[#37C6A3]/70 blur-[1px]" />

              {/* 4 Inner Tools */}
              {innerTools.map((tool) => {
                const rad = (tool.angleDeg * Math.PI) / 180;
                const leftPercent = 50 + 50 * Math.sin(rad);
                const topPercent = 50 - 50 * Math.cos(rad);
                const isSelected = selectedTool.id === tool.id;

                return (
                  <div
                    key={tool.id}
                    className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto"
                    style={{
                      left: `${leftPercent}%`,
                      top: `${topPercent}%`,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTool(tool);
                        onSelectFeature?.(tool);
                      }}
                      className={`group relative flex items-center gap-1 sm:gap-1.5 p-1 sm:px-2.5 sm:py-1.5 rounded-full sm:rounded-2xl border transition-all duration-300 cursor-pointer shadow-lg backdrop-blur-md anim-counter-cw-inner ${
                        isSelected
                          ? 'bg-[#0F172A] border-[#37C6A3] ring-2 ring-[#37C6A3]/60 scale-110 shadow-[#37C6A3]/30 z-30'
                          : 'bg-[#0B1120]/90 border-slate-700/80 hover:border-[#37C6A3]/70 hover:scale-105 z-10'
                      }`}
                      style={{
                        animationPlayState: isPaused ? 'paused' : 'running',
                      }}
                      title={tool.name}
                    >
                      <span className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-xs shadow-xs bg-gradient-to-br ${tool.badgeBg} text-white shrink-0`}>
                        {tool.emoji}
                      </span>
                      <span className={`text-[10px] sm:text-xs font-bold whitespace-nowrap transition-colors ${
                        isSelected ? 'text-[#37C6A3]' : 'text-slate-300 group-hover:text-white'
                      } ${isSelected ? 'inline-block' : 'hidden sm:inline-block'}`}>
                        {tool.shortName}
                      </span>

                      {isSelected && (
                        <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#37C6A3] opacity-75" />
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
                        </span>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* =================================================================== */}
            {/* 3. CENTER HUB: 3D AI ROBOT MASCOT IN GLOWING CORE                   */}
            {/* =================================================================== */}
            <div className="relative z-20 flex flex-col items-center justify-center pointer-events-none">
              <div className="absolute w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br from-[#37C6A3]/30 to-teal-500/10 blur-xl pointer-events-none" />
              
              <div className="w-16 h-16 xs:w-20 xs:h-20 sm:w-28 sm:h-28 rounded-full bg-[#0F172A]/90 border-2 border-[#37C6A3]/60 shadow-2xl flex items-center justify-center relative overflow-hidden">
                <span className="absolute inset-0 bg-radial from-emerald-500/10 to-transparent pointer-events-none" />
                <div className="w-12 xs:w-14 sm:w-20 drop-shadow-2xl">
                  <AiRobotMascot variant="wave" className="w-full h-auto" />
                </div>
              </div>

              <div className="mt-1.5 px-2 py-0.5 rounded-full bg-[#0F172A]/90 border border-[#37C6A3]/40 text-[9px] sm:text-[10px] font-bold text-[#37C6A3] shadow-xs">
                In-Memory Core
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* INTERACTIVE ACTIVE TOOL DETAIL CARD (BELOW ORBIT)                         */}
        {/* ========================================================================= */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 relative z-10 max-w-2xl mx-auto">
          <div className="bg-slate-900/90 rounded-2xl p-4 sm:p-5 border border-slate-700/80 shadow-xl transition-all">
            <div className="flex items-start justify-between gap-3 flex-wrap sm:flex-nowrap">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-lg sm:text-xl shrink-0 bg-gradient-to-br ${selectedTool.badgeBg} shadow-md`}>
                  {selectedTool.emoji}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-extrabold text-white">
                      {selectedTool.name}
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#37C6A3]/20 text-[#37C6A3] border border-[#37C6A3]/30">
                      {selectedTool.category}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                      {selectedTool.ring === 'inner' ? 'Inner Orbit • Core Engine' : 'Outer Orbit • Extension'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                    {selectedTool.description}
                  </p>
                </div>
              </div>
            </div>

            {/* Quick-Scan Capability Pills */}
            <div className="mt-3.5 pt-3 border-t border-slate-800 flex flex-wrap gap-1.5">
              {selectedTool.pills.map((pill, i) => (
                <span
                  key={i}
                  className="text-[10.5px] font-semibold px-2.5 py-1 rounded-lg bg-slate-800/90 text-slate-200 border border-slate-700/70 flex items-center gap-1 shadow-2xs"
                >
                  {pill}
                </span>
              ))}
            </div>

            <div className="mt-2.5 text-[11px] text-slate-400 flex items-center justify-between">
              <span>💡 Tip: Click any badge along the orbital rings to inspect each tool</span>
              <span className="text-[#37C6A3] font-semibold hidden sm:inline">Active Feature</span>
            </div>
          </div>
        </div>

        {/* Toggleable "View All 8 Tools Grid" Button */}
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => setShowAllGrid(!showAllGrid)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-xs font-bold text-slate-200 border border-slate-700 transition cursor-pointer"
          >
            <span>{showAllGrid ? 'Hide 8-Tool Grid' : 'View All 8 Tools in Grid'}</span>
            {showAllGrid ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* EXPANDABLE ALL 8 TOOLS COMPREHENSIVE GRID VIEW                            */}
      {/* ========================================================================= */}
      {showAllGrid && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 animate-fade-in">
          {ORBITAL_AI_FEATURES.map((tool) => (
            <div
              key={tool.id}
              onClick={() => setSelectedTool(tool)}
              className={`bg-white rounded-3xl p-5 border transition-all duration-300 group flex flex-col justify-between cursor-pointer ${
                selectedTool.id === tool.id
                  ? 'border-[#37C6A3] ring-2 ring-[#37C6A3]/30 shadow-md -translate-y-1'
                  : 'border-[#E7E9EE] shadow-xs hover:border-[#37C6A3]/60 hover:shadow-md hover:-translate-y-1'
              }`}
            >
              <div>
                <div className="flex items-start gap-3.5">
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${tool.badgeBg} text-white flex items-center justify-center shrink-0 shadow-lg border border-white/20 group-hover:scale-105 transition-transform text-xl`}>
                    {tool.emoji}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 flex-wrap">
                      <h3 className="text-sm font-bold text-[#0F172A] leading-snug">
                        {tool.name}
                      </h3>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                        {tool.category}
                      </span>
                    </div>
                    <p className="text-xs text-[#7C8A9A] mt-1 leading-relaxed">
                      {tool.description}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-3.5 pt-3.5 border-t border-[#E7E9EE]/80 flex flex-wrap gap-1.5">
                {tool.pills.map((pill, pi) => (
                  <span
                    key={pi}
                    className="text-[10.5px] font-semibold px-2 py-0.5 rounded-lg bg-slate-50 text-slate-700 border border-slate-200/60"
                  >
                    {pill}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
