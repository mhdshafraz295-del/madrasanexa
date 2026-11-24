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
            transform: translateY(14px);
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
          animation: subjectCardReveal 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
      `}</style>

      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto px-4">
        <div className="inline-flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-[#6B6A45] mb-2.5 px-3.5 py-1 rounded-full bg-[#F4F3EC] border border-[#E2E0D0] shadow-2xs">
          <BookOpen className="w-3.5 h-3.5 text-[#6B6A45]" />
          <span>Curriculum & Academic Standards</span>
        </div>
        <h2
          className="text-2xl sm:text-3xl lg:text-4xl font-serif font-bold tracking-tight mb-3 text-[#232215]"
          style={{ color: theme.headingColor || '#232215' }}
        >
          Educational Pathways & Syllabus
        </h2>
        <div className="w-24 h-1 bg-gradient-to-r from-[#6B6A45] via-[#C5A059] to-[#8C8A58] mx-auto rounded-full" />
        <p className="text-xs sm:text-sm text-slate-600 max-w-2xl mx-auto mt-3 leading-relaxed">
          Comprehensive, structured Islamic education combining sacred classical sciences, Quranic mastery, and recognized academic curricula.
        </p>
      </div>

      {/* 1. Legacy Syllabus Briefing (Rendered as institutional intro if present) */}
      {syllabusInfo && (
        <div className="bg-white rounded-3xl border border-[#E2E0D0] p-6 sm:p-8 relative overflow-hidden shadow-xs max-w-5xl mx-auto bg-islamic-diamond-subtle">
          <div className="h-1 bg-gradient-to-r from-[#6B6A45] via-[#C5A059] to-[#8C8A58] absolute top-0 inset-x-0" />
          <div className="flex items-center space-x-2 text-xs font-bold text-[#6B6A45] uppercase tracking-wider mb-2.5">
            <Sparkles className="w-4 h-4 text-[#8C8A58]" />
            <span>Academic Framework & Overview</span>
          </div>
          <div
            className="text-xs sm:text-sm leading-relaxed whitespace-pre-line text-slate-700"
            style={{ color: theme.bodyTextColor || '#232215' }}
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
                className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                  selectedCatId === 'all'
                    ? 'bg-[#6B6A45] text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-[#E2E0D0] hover:bg-[#F4F3EC]'
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
                    className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                      selectedCatId === cat.id
                        ? 'bg-[#6B6A45] text-white shadow-xs'
                        : 'bg-white text-slate-700 border border-[#E2E0D0] hover:bg-[#F4F3EC]'
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

          {/* Programme Selector Cards - Centered & Balanced Layout with Islamic Diamond Pattern */}
          <div
            className={`w-full ${
              filteredProgrammes.length === 1
                ? 'max-w-xl mx-auto'
                : filteredProgrammes.length === 2
                ? 'max-w-3xl mx-auto flex flex-col sm:flex-row gap-4'
                : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'
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
                  className={`relative rounded-3xl border cursor-pointer transition-all duration-300 flex flex-col justify-between overflow-hidden ${
                    isSelected
                      ? 'bg-white border-[#6B6A45] shadow-lg ring-2 ring-[#C5A059]/40 scale-101'
                      : 'bg-[#F8F7F2] border-[#E2E0D0] hover:border-[#C5A059]/60 shadow-2xs hover:shadow-sm'
                  }`}
                >
                  <div className="p-5 sm:p-6 bg-islamic-diamond-subtle flex-1 flex flex-col justify-between">
                    <div>
                      {/* Top Row: Code & Animated Antique Gold Duration Badge */}
                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        {prog.code ? (
                          <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-[#FAF8F2] text-[#6B6A45] border border-[#E2E0D0]">
                            {prog.code}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C8A58]">
                            Academic Programme
                          </span>
                        )}

                        {/* Animated Antique Gold Duration Badge */}
                        <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-gradient-to-r from-[#B58D3D] via-[#DFC076] to-[#B58D3D] bg-[length:200%_100%] animate-curriculum-gold-shimmer text-[#1F1B0E] border border-[#F0D999]/80 shadow-2xs">
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
                    <div className="mt-4 pt-3 border-t border-[#E2E0D0]/80 flex items-center justify-between text-xs font-semibold text-[#504F34]">
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

                  {/* Animated Gold Bottom Indicator Bar */}
                  {isSelected && (
                    <div className="h-1 bg-gradient-to-r from-[#6B6A45] via-[#C5A059] to-[#8C8A58] w-full" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Active Programme Explorer Workspace */}
          {activeProgramme && activeProgramme.levels.length > 0 && (
            <div className="bg-white rounded-3xl border border-[#D8D5C0] p-5 sm:p-8 space-y-8 shadow-md relative overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-[#6B6A45] via-[#C5A059] to-[#8C8A58] absolute top-0 inset-x-0" />

              {/* Programme Details Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-[#E2E0D0] gap-4">
                <div>
                  <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-[#8C8A58]">
                    <span>{categories.find((c) => c.id === activeProgramme.categoryId)?.label || 'Discipline'}</span>
                    <span>•</span>
                    <span className="text-[#6B6A45]">Duration: {activeProgramme.durationYears || 'Flexible'}</span>
                  </div>
                  <h3
                    className="text-xl sm:text-2xl font-serif font-bold mt-1 text-[#232215]"
                    style={{ color: theme.headingColor || '#232215' }}
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
                  <div className="bg-[#FAF8F2] border border-[#E2E0D0] rounded-2xl p-3.5 max-w-xs text-xs shadow-2xs">
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
                  <div className="inline-flex items-center gap-2 sm:gap-3 min-w-max p-1 bg-[#F8F7F2] rounded-2xl border border-[#E2E0D0]">
                    {activeProgramme.levels.map((lvl, lvlIdx) => {
                      const isLvlSelected = activeLevel?.id === lvl.id;
                      const levelNumber = String(lvlIdx + 1).padStart(2, '0');

                      return (
                        <React.Fragment key={lvl.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedLevelId(lvl.id)}
                            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-2xs ${
                              isLvlSelected
                                ? 'bg-[#6B6A45] text-white ring-2 ring-[#C5A059] shadow-xs'
                                : 'bg-white text-slate-700 border border-[#E2E0D0] hover:bg-[#F4F3EC]'
                            }`}
                          >
                            <span
                              className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-mono font-bold ${
                                isLvlSelected
                                  ? 'bg-[#504F34] text-[#EFEFD0]'
                                  : 'bg-[#F4F3EC] text-[#6B6A45]'
                              }`}
                            >
                              {levelNumber}
                            </span>
                            <span>{lvl.levelLabel}</span>
                            {lvl.streamName && (
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                  isLvlSelected ? 'bg-white/20 text-white' : 'bg-[#E2E0D0]/80 text-[#504F34]'
                                }`}
                              >
                                {lvl.streamName}
                              </span>
                            )}
                          </button>

                          {/* Connecting arrow / track line */}
                          {lvlIdx < activeProgramme.levels.length - 1 && (
                            <div className="w-4 sm:w-6 h-0.5 bg-[#C5A059]/40 shrink-0" aria-hidden="true" />
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
                    <div className="p-8 text-center bg-[#F8F7F2] rounded-3xl border border-dashed border-[#E2E0D0]">
                      <p className="text-xs text-slate-600">
                        No subject records currently published for this academic level.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {activeLevel.subjects.map((sub, subIdx) => (
                        <div
                          key={sub.id}
                          className="bg-white border border-[#E2E0D0] rounded-3xl p-5 hover:border-[#C5A059]/70 hover:shadow-md transition-all duration-300 flex flex-col justify-between animate-subject-reveal"
                          style={{ animationDelay: `${subIdx * 55}ms` }}
                        >
                          <div>
                            {/* Card Top: Numbered Milestone Emblem, Subject Name with dir="auto", and Compulsory Badge */}
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                {/* Numbered Milestone Emblem */}
                                <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-[#6B6A45] to-[#504F34] text-[#F8F7F2] font-mono font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs border border-[#C5A059]/40 mt-0.5">
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

                              {/* Gold-Tinted Compulsory / Elective Badge */}
                              <span
                                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full shrink-0 shadow-2xs ${
                                  sub.isOptional
                                    ? 'bg-[#F4F3EC] text-[#6B6A45] border border-[#E2E0D0]'
                                    : 'bg-[#FAF8F2] text-[#8C8A58] border border-[#C5A059]/50'
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
                              <div className="mt-4 pt-3 border-t border-[#E2E0D0] space-y-2">
                                <span className="text-[10px] font-bold text-[#6B6A45] uppercase tracking-wider flex items-center space-x-1.5">
                                  <BookMarked className="w-3.5 h-3.5 text-[#8C8A58]" />
                                  <span>Prescribed Kitabs & Textbooks ({sub.books.length})</span>
                                </span>

                                <div className="space-y-1.5">
                                  {sub.books.map((bk) => (
                                    <div
                                      key={bk.id}
                                      className="bg-[#F8F7F2] rounded-2xl p-3 border border-[#E2E0D0] text-xs shadow-2xs"
                                    >
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <span dir="auto" className="font-bold text-[#232215] min-w-0 break-words">
                                          {bk.title}
                                        </span>
                                        {bk.completionNotes && (
                                          <span className="text-[10px] font-bold text-[#8C8A58] bg-white px-2 py-0.5 rounded-full border border-[#C5A059]/30">
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

      {/* 3. Rules & Regulations Card (Preserved with Regal Styling) */}
      <div id="rules" className="bg-white rounded-3xl border border-[#D8D5C0] p-6 sm:p-9 scroll-mt-28 shadow-xs max-w-5xl mx-auto bg-islamic-diamond-subtle relative overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-[#6B6A45] via-[#C5A059] to-[#8C8A58] absolute top-0 inset-x-0" />
        <div className="flex items-center space-x-2.5 text-xs font-bold text-[#6B6A45] uppercase tracking-wider mb-3">
          <div className="w-8 h-8 rounded-xl bg-[#F4F3EC] border border-[#E2E0D0] flex items-center justify-center text-[#6B6A45]">
            <ShieldCheck className="w-4 h-4 text-[#6B6A45]" />
          </div>
          <span>Institutional Conduct & Ethos</span>
        </div>

        <h3
          className="text-xl sm:text-2xl font-serif font-bold mb-3 tracking-tight text-[#232215]"
          style={{ color: theme.headingColor || '#232215' }}
        >
          Rules & Code of Conduct
        </h3>

        <div
          className="text-xs sm:text-sm leading-relaxed whitespace-pre-line flex-1 mb-6 text-slate-700"
          style={{ color: theme.bodyTextColor || '#232215' }}
        >
          {rulesAndRegulations ||
            'Students must observe strict punctuality, dignified Islamic attire, respectful etiquette toward teachers and fellow peers, and active participation in daily congregational prayers and assemblies.'}
        </div>

        <div className="pt-4 border-t border-[#E2E0D0] flex items-center space-x-2 text-xs font-semibold text-slate-600">
          <Award className="w-4 h-4 text-[#8C8A58]" />
          <span>Dedicated to nurturing discipline, reverence, and academic excellence</span>
        </div>
      </div>
    </section>
  );
};

export default MadrasaPublicCurriculum;
