import React, { useState } from 'react';
import {
  BookOpen,
  ShieldCheck,
  CheckCircle2,
  Award,
  Layers,
  Sparkles,
  BookMarked,
  GraduationCap,
  Clock,
  Compass,
} from 'lucide-react';
import type {
  MadrasaThemeTokens,
  CurriculumPayload,
  CurriculumProgramme,
  CurriculumLevel,
} from '../../services/api';

interface MadrasaPublicCurriculumProps {
  syllabusInfo?: string | null;
  rulesAndRegulations?: string | null;
  curriculum?: CurriculumPayload | null;
  theme: MadrasaThemeTokens;
}

export const MadrasaPublicCurriculum: React.FC<MadrasaPublicCurriculumProps> = ({
  syllabusInfo,
  rulesAndRegulations,
  curriculum,
  theme,
}) => {
  // Published programmes only
  const publishedProgrammes = (curriculum?.programmes || []).filter((p) => p.isPublished);
  const categories = curriculum?.categories || [];

  // Filter & Selected State
  const [selectedCatId, setSelectedCatId] = useState<string>('all');
  const [selectedProgId, setSelectedProgId] = useState<string | null>(() => {
    return publishedProgrammes[0]?.id || null;
  });
  const [selectedLevelId, setSelectedLevelId] = useState<string | null>(null);

  // Filtered programmes by category
  const filteredProgrammes =
    selectedCatId === 'all'
      ? publishedProgrammes
      : publishedProgrammes.filter((p) => p.categoryId === selectedCatId);

  // Active programme
  const activeProgramme: CurriculumProgramme | null =
    filteredProgrammes.find((p) => p.id === selectedProgId) ||
    filteredProgrammes[0] ||
    null;

  // Active Level (defaults to first level of active programme)
  const activeLevel: CurriculumLevel | null =
    activeProgramme?.levels.find((lvl) => lvl.id === selectedLevelId) ||
    activeProgramme?.levels[0] ||
    null;

  const hasStructuredCurriculum = publishedProgrammes.length > 0;

  return (
    <section
      id="curriculum"
      className="scroll-mt-28 space-y-12 public-section-enter py-8 sm:py-12 overflow-x-clip w-full max-w-full"
      aria-label="Educational Pathways & Syllabus"
    >
      {/* Keyframes for Curriculum Shimmer and Subject Card Reveal */}
      <style>{`
        @keyframes curriculumGoldSweep {
          0% { background-position: 200% center; }
          100% { background-position: -200% center; }
        }
        @keyframes subjectCardReveal {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-curriculum-gold-shimmer {
          background-size: 200% 100%;
          animation: curriculumGoldSweep 4s ease-in-out infinite;
        }
        .animate-subject-reveal {
          animation: subjectCardReveal 0.4s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
      `}</style>

      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-10 px-4">
        <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase mb-3 public-section-badge">
          <BookOpen className="w-3.5 h-3.5" />
          <span>Curriculum & Academic Standards</span>
        </div>
        <h2
          className="text-2xl sm:text-3xl lg:text-4xl font-serif font-bold tracking-tight mb-3 public-night-h2"
        >
          Educational Pathways & Syllabus
        </h2>
        <div className="w-24 h-1 bg-gradient-to-r from-[#85845C] via-[#DFC076] to-[#85845C] mx-auto rounded-full" />
        <p className="text-xs sm:text-sm max-w-2xl mx-auto mt-3 leading-relaxed public-night-subtext">
          Comprehensive, structured Islamic education combining sacred classical sciences, Quranic mastery, and recognized academic curricula.
        </p>
      </div>

      {/* 1. Legacy Syllabus Briefing (Rendered as institutional intro if present) */}
      {syllabusInfo && (
        <div className="glass-panel-gold rounded-3xl p-6 sm:p-8 relative overflow-hidden max-w-5xl mx-auto bg-islamic-diamond-subtle">
          <div className="flex items-center space-x-2 text-xs font-bold text-[#6B6A45] uppercase tracking-wider mb-2.5">
            <Sparkles className="w-4 h-4 text-[#8C8A58]" />
            <span>Academic Framework & Overview</span>
          </div>
          <div
            className="text-xs sm:text-sm leading-relaxed whitespace-pre-line text-slate-700"
            style={{ color: theme.bodyTextColor || undefined }}
          >
            {syllabusInfo}
          </div>
        </div>
      )}

      {/* 2. Structured Curriculum Explorer */}
      {hasStructuredCurriculum ? (
        <div className="space-y-8 max-w-6xl mx-auto px-4">
          {/* Category Filter Pills (if multiple categories exist) */}
          {categories.length > 1 && (
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedCatId('all');
                  const firstInAll = publishedProgrammes[0];
                  if (firstInAll) {
                    setSelectedProgId(firstInAll.id);
                    setSelectedLevelId(firstInAll.levels[0]?.id || null);
                  }
                }}
                className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                  selectedCatId === 'all'
                    ? 'glass-pill-active'
                    : 'glass-pill-inactive'
                }`}
              >
                All Disciplines ({publishedProgrammes.length})
              </button>

              {categories.map((cat) => {
                const count = publishedProgrammes.filter((p) => p.categoryId === cat.id).length;
                if (count === 0) return null;

                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setSelectedCatId(cat.id);
                      const firstInCat = publishedProgrammes.find((p) => p.categoryId === cat.id);
                      if (firstInCat) {
                        setSelectedProgId(firstInCat.id);
                        setSelectedLevelId(firstInCat.levels[0]?.id || null);
                      }
                    }}
                    className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all duration-200 flex items-center space-x-1.5 cursor-pointer ${
                      selectedCatId === cat.id
                        ? 'glass-pill-active'
                        : 'glass-pill-inactive'
                    }`}
                  >
                    <span>{cat.label}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/10">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Programme Selector Cards - Glassmorphism with Soft Glow and Drop Shadow */}
          <div
            className={`w-full ${
              filteredProgrammes.length === 1
                ? 'max-w-xl mx-auto'
                : filteredProgrammes.length === 2
                ? 'max-w-3xl mx-auto flex flex-col sm:flex-row gap-4'
                : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5'
            }`}
          >
            {filteredProgrammes.map((prog) => {
              const isSelected = activeProgramme?.id === prog.id;
              const totalSubjects = prog.levels.reduce((acc, l) => acc + l.subjects.length, 0);

              return (
                <div
                  key={prog.id}
                  onClick={() => {
                    setSelectedProgId(prog.id);
                    setSelectedLevelId(prog.levels[0]?.id || null);
                  }}
                  className={`relative rounded-3xl cursor-pointer transition-all duration-300 ease-out flex flex-col justify-between overflow-hidden ${
                    isSelected
                      ? 'glass-panel-gold -translate-y-1 ring-1 ring-[#C5A059]/50 shadow-[0_16px_36px_-6px_rgba(60,50,30,0.12),0_0_24px_rgba(197,160,89,0.30)]'
                      : 'glass-card-elevated hover:-translate-y-1'
                  }`}
                >
                  <div className="p-5 sm:p-6 bg-islamic-diamond-subtle flex-1 flex flex-col justify-between">
                    <div>
                      {/* Top Row: Code & Animated Antique Gold Duration Badge */}
                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        {prog.code ? (
                          <span
                            className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border border-[#C5A059]/30 ${
                              isSelected
                                ? 'bg-white/90 text-[#6B6A45] shadow-[0_0_8px_rgba(197,160,89,0.15)]'
                                : 'bg-white/70 text-[#5C533D]'
                            }`}
                          >
                            {prog.code}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C8A58]">
                            Academic Programme
                          </span>
                        )}

                        {/* Animated Antique Gold Duration Badge */}
                        <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-gradient-to-r from-[#B58D3D] via-[#DFC076] to-[#B58D3D] bg-[length:200%_100%] animate-curriculum-gold-shimmer text-[#1F1B0E] shadow-[0_0_10px_rgba(197,160,89,0.22)]">
                          <Clock className="w-3 h-3 text-[#1F1B0E]" />
                          <span>{prog.durationYears || 'Flexible'}</span>
                        </span>
                      </div>

                      {/* Programme Name */}
                      <h3 className="text-base sm:text-lg font-serif font-bold text-[#232215] leading-snug">
                        {prog.name}
                      </h3>

                      {/* Programme Description */}
                      {prog.description && (
                        <p className="text-xs text-slate-600 mt-2 line-clamp-2 leading-relaxed">
                          {prog.description}
                        </p>
                      )}
                    </div>

                    {/* Academic Stat Pills */}
                    <div className="mt-4 pt-3 flex items-center justify-between text-xs font-semibold text-[#504F34]">
                      <span className="flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-[#8C8A58]" />
                        <span>{prog.levels.length} Levels</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-[#8C8A58]" />
                        <span>{totalSubjects} Subjects</span>
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Active Programme Explorer Workspace - Frosted Glass Container */}
          {activeProgramme && activeProgramme.levels.length > 0 && (
            <div className="glass-panel-gold rounded-3xl p-5 sm:p-8 space-y-8 relative overflow-hidden">
              {/* Programme Details Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 gap-4">
                <div>
                  <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-[#8C8A58] dark:text-[#84CC16]">
                    <span>{categories.find((c) => c.id === activeProgramme.categoryId)?.label || 'Discipline'}</span>
                    <span>•</span>
                    <span className="text-[#6B6A45] dark:text-[#D1D5DB]">Duration: {activeProgramme.durationYears || 'Flexible'}</span>
                  </div>
                  <h3
                    className="text-xl sm:text-2xl font-serif font-bold mt-1 text-[#232215] dark:text-[#F9FAFB]"
                    style={{ color: theme.headingColor || undefined }}
                  >
                    {activeProgramme.name}
                  </h3>
                  {activeProgramme.description && (
                    <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
                      {activeProgramme.description}
                    </p>
                  )}
                </div>

                {activeProgramme.admissionRequirements && (
                  <div className="bg-white/80 backdrop-blur-sm border border-[#C5A059]/30 rounded-2xl p-3.5 max-w-xs text-xs shadow-[0_4px_16px_rgba(60,50,30,0.06),0_0_12px_rgba(197,160,89,0.12)]">
                    <span className="font-bold text-[#232215] block mb-0.5 flex items-center gap-1">
                      <Compass className="w-3.5 h-3.5 text-[#8C8A58]" />
                      Admission Criteria
                    </span>
                    <span className="text-slate-600 leading-relaxed block">
                      {activeProgramme.admissionRequirements}
                    </span>
                  </div>
                )}
              </div>

              {/* Connected Year / Level Stepper Track */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-[#6B6A45] uppercase tracking-wider block">
                  Academic Progression Stepper
                </span>

                {/* Horizontal Stepper Track with Connected Line */}
                <div className="w-full overflow-x-auto no-scrollbar py-2">
                  <div className="inline-flex items-center gap-2 sm:gap-3 min-w-max p-1.5 bg-white/70 backdrop-blur-sm rounded-2xl border border-[#C5A059]/30 shadow-[inset_0_1px_3px_rgba(60,50,30,0.05)]">
                    {activeProgramme.levels.map((lvl, lvlIdx) => {
                      const isLvlSelected = activeLevel?.id === lvl.id;
                      const levelNumber = String(lvlIdx + 1).padStart(2, '0');

                      return (
                        <React.Fragment key={lvl.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedLevelId(lvl.id)}
                            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-250 ease-out flex items-center gap-2 cursor-pointer ${
                              isLvlSelected
                                ? 'glass-pill-active -translate-y-0.5'
                                : 'bg-white/80 border border-[#C5A059]/25 hover:border-[#C5A059]/50 hover:bg-white text-slate-700 shadow-[0_2px_8px_rgba(60,50,30,0.04)] hover:-translate-y-0.5'
                            }`}
                          >
                            <span
                              className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-mono font-bold ${
                                isLvlSelected
                                  ? 'bg-[#504F34] text-[#EFEFD0]'
                                  : 'bg-[#DAD5C8] text-[#504F34]'
                              }`}
                            >
                              {levelNumber}
                            </span>
                            <span>{lvl.levelLabel}</span>
                            {lvl.streamName && (
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                  isLvlSelected ? 'bg-white/20 text-white' : 'bg-[#D8D3C6] text-[#504F34]'
                                }`}
                              >
                                {lvl.streamName}
                              </span>
                            )}
                          </button>

                          {/* Connecting track line */}
                          {lvlIdx < activeProgramme.levels.length - 1 && (
                            <div className="w-4 sm:w-6 h-0.5 bg-[#C5A059]/40 rounded-full shrink-0 shadow-[0_0_6px_rgba(197,160,89,0.3)]" aria-hidden="true" />
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Active Level's Classical Arabic Kitab & Subject Cards */}
              {activeLevel && (
                <div className="space-y-4 pt-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center space-x-2 min-w-0">
                      <GraduationCap className="w-4 h-4 shrink-0 text-[#6B6A45]" />
                      <h4 className="text-sm font-bold text-[#232215]">
                        {activeLevel.levelLabel} {activeLevel.streamName ? `(${activeLevel.streamName})` : ''} Syllabus
                      </h4>
                    </div>
                    <span className="text-xs font-semibold text-[#8C8A58]">
                      {activeLevel.subjects.length} Subjects Offered
                    </span>
                  </div>

                  {activeLevel.subjects.length === 0 ? (
                    <div className="p-8 text-center glass-card-elevated rounded-3xl">
                      <p className="text-xs text-slate-600">
                        No subject records currently published for this academic level.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {activeLevel.subjects.map((sub, subIdx) => (
                        <div
                          key={sub.id}
                          className="glass-card-elevated rounded-3xl p-5 sm:p-6 transition-all duration-250 ease-out flex flex-col justify-between animate-subject-reveal"
                          style={{ animationDelay: `${subIdx * 55}ms` }}
                        >
                          <div>
                            {/* Card Top: Numbered Milestone Emblem, Subject Name with dir="auto", and Compulsory Badge */}
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                {/* Numbered Milestone Emblem */}
                                <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-[#6B6A45] to-[#504F34] text-[#F8F7F2] font-mono font-bold text-xs flex items-center justify-center shrink-0 border border-[#C5A059]/40 shadow-[0_2px_8px_rgba(107,106,69,0.3)] mt-0.5">
                                  {String(subIdx + 1).padStart(2, '0')}
                                </div>

                                <div className="min-w-0 flex-1">
                                  <h5
                                    dir="auto"
                                    className="text-sm sm:text-base font-serif font-bold text-[#232215] leading-snug"
                                  >
                                    {sub.name}
                                  </h5>
                                  {sub.code && (
                                    <span className="text-[10px] font-mono font-bold text-[#8C8A58]">
                                      {sub.code}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Borderless Tinted Compulsory / Elective Badge */}
                              <span
                                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full shrink-0 border border-[#C5A059]/25 ${
                                  sub.isOptional
                                    ? 'bg-white/80 text-[#6B6A45]'
                                    : 'bg-white/90 text-[#5C533D]'
                                }`}
                              >
                                {sub.isOptional ? 'Elective' : 'Compulsory'}
                              </span>
                            </div>

                            {/* Subject Description with dir="auto" */}
                            {sub.description && (
                              <p dir="auto" className="text-xs text-slate-600 mt-2.5 leading-relaxed">
                                {sub.description}
                              </p>
                            )}

                            {/* Prescribed Kitabs & Textbooks Multi-Book Drawer */}
                            {sub.books.length > 0 && (
                              <div className="mt-4 pt-3 space-y-2">
                                <span className="text-[10px] font-bold text-[#6B6A45] uppercase tracking-wider flex items-center space-x-1.5">
                                  <BookMarked className="w-3.5 h-3.5 text-[#8C8A58]" />
                                  <span>Prescribed Kitabs & Textbooks ({sub.books.length})</span>
                                </span>

                                <div className="space-y-1.5">
                                  {sub.books.map((bk) => (
                                    <div
                                      key={bk.id}
                                      className="bg-white/75 backdrop-blur-sm rounded-2xl p-3 border border-[#C5A059]/25 text-xs shadow-[0_2px_8px_rgba(60,50,30,0.04)]"
                                    >
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <span dir="auto" className="font-bold text-[#232215] min-w-0 break-words">
                                          {bk.title}
                                        </span>
                                        {bk.completionNotes && (
                                          <span className="text-[10px] font-bold text-[#8C8A58] bg-white px-2 py-0.5 rounded-full border border-[#C5A059]/25 shadow-2xs">
                                            {bk.completionNotes}
                                          </span>
                                        )}
                                      </div>
                                      {bk.author && (
                                        <span className="text-[11px] text-slate-600 block mt-0.5">
                                          Author / Muallif: <strong className="text-[#232215]">{bk.author}</strong>
                                        </span>
                                      )}
                                      {bk.description && (
                                        <p dir="auto" className="text-[11px] text-slate-500 mt-1">
                                          {bk.description}
                                        </p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Learning Outcomes */}
                            {sub.learningOutcomes && sub.learningOutcomes.length > 0 && (
                              <div className="mt-3 pt-2 text-[11px] text-slate-600 space-y-1">
                                {sub.learningOutcomes.map((out, idx) => (
                                  <div key={idx} className="flex items-start space-x-1.5">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-[#6B6A45] shrink-0 mt-0.5" />
                                    <span>{out}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ) : null}

      {/* 3. Rules & Regulations Card (Frosted Glass Container with Gold Glow) */}
      <div id="rules" className="glass-panel-gold rounded-3xl p-6 sm:p-9 scroll-mt-28 max-w-5xl mx-auto bg-islamic-diamond-subtle relative overflow-hidden">
        <div className="flex items-center space-x-2.5 text-xs font-bold text-[#6B6A45] uppercase tracking-wider mb-3">
          <div className="w-8 h-8 rounded-xl bg-white/90 border border-[#C5A059]/35 shadow-[0_0_10px_rgba(197,160,89,0.16)] flex items-center justify-center text-[#6B6A45]">
            <ShieldCheck className="w-4 h-4 text-[#6B6A45]" />
          </div>
          <span>Institutional Conduct & Ethos</span>
        </div>

        <h3
          className="text-xl sm:text-2xl font-serif font-bold mb-3 tracking-tight text-[#232215]"
          style={{ color: theme.headingColor || undefined }}
        >
          Rules & Code of Conduct
        </h3>

        <div
          className="text-xs sm:text-sm leading-relaxed whitespace-pre-line flex-1 mb-6 text-slate-700"
          style={{ color: theme.bodyTextColor || undefined }}
        >
          {rulesAndRegulations ||
            'Students must observe strict punctuality, dignified Islamic attire, respectful etiquette toward teachers and fellow peers, and active participation in daily congregational prayers and assemblies.'}
        </div>

        <div className="pt-4 flex items-center space-x-2 text-xs font-semibold text-slate-600">
          <Award className="w-4 h-4 text-[#8C8A58]" />
          <span>Dedicated to nurturing discipline, reverence, and academic excellence</span>
        </div>
      </div>
    </section>
  );
};

export default MadrasaPublicCurriculum;
