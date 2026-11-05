import React, { useState } from 'react';
import {
  BookOpen,
  ShieldCheck,
  CheckCircle2,
  Award,
  Layers,
  Sparkles,
  BookMarked,
  GraduationCap
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
  const filteredProgrammes = selectedCatId === 'all'
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
    <section id="curriculum" className="scroll-mt-28 space-y-12 public-section-enter">
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-[#85845C] mb-2 px-3.5 py-1 rounded-full bg-[#F5F5F1] border border-[#E5E5DF] shadow-2xs">
          <BookOpen className="w-3.5 h-3.5 text-[#85845C]" />
          <span>Curriculum & Academic Standards</span>
        </div>
        <h2
          className="text-2xl sm:text-4xl font-serif font-bold tracking-tight mb-3 text-[#252525]"
          style={{ color: theme.headingColor || '#252525' }}
        >
          Educational Pathways & Syllabus
        </h2>
        <div className="w-20 h-1 bg-gradient-to-r from-[#85845C] via-[#A5A477] to-[#85845C] mx-auto rounded-full" />
        <p className="text-xs sm:text-sm text-[#666666] max-w-2xl mx-auto mt-3">
          Comprehensive, balanced education combining traditional Islamic sciences, Quranic memorization, and structured general schooling.
        </p>
      </div>

      {/* 1. Legacy Syllabus Briefing (Rendered as institutional intro if present) */}
      {syllabusInfo && (
        <div className="bg-white rounded-2xl border border-[#E5E5DF] p-6 sm:p-8 relative overflow-hidden shadow-xs">
          <div className="absolute top-0 right-0 w-32 h-32 bg-radial from-[#A5A477]/10 to-transparent pointer-events-none rounded-bl-full" />
          <div className="flex items-center space-x-2.5 text-xs font-bold text-[#85845C] uppercase tracking-wider mb-3">
            <Sparkles className="w-4 h-4 text-[#85845C]" />
            <span>Academic Framework & Overview</span>
          </div>
          <div
            className="text-xs sm:text-sm leading-relaxed whitespace-pre-line text-[#252525]"
            style={{ color: theme.bodyTextColor || '#252525' }}
          >
            {syllabusInfo}
          </div>
        </div>
      )}

      {/* 2. Structured Curriculum Explorer (When published programmes exist) */}
      {hasStructuredCurriculum ? (
        <div className="space-y-8">
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
                    ? 'bg-[#85845C] text-white shadow-xs scale-102'
                    : 'bg-white text-[#252525] border border-[#E5E5DF] hover:bg-[#F5F5F1]'
                }`}
              >
                All Disciplines ({publishedProgrammes.length})
              </button>

              {categories.map((cat) => {
                const count = publishedProgrammes.filter((p) => p.categoryId === cat.id).length;
                if (count === 0) return null; // Don't show empty categories publicly

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
                        ? 'bg-[#85845C] text-white shadow-xs scale-102'
                        : 'bg-white text-[#252525] border border-[#E5E5DF] hover:bg-[#F5F5F1]'
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

          {/* Programme Selector Cards - Centered & Balanced Layout */}
          <div className="flex flex-wrap justify-center gap-4">
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
                  className={`w-full sm:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.75rem)] max-w-md p-5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'bg-[#85845C] text-white border-[#85845C] shadow-md scale-101'
                      : 'bg-white border-[#E5E5DF] hover:border-[#85845C]/50 shadow-2xs hover:shadow-xs'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      {prog.code && (
                        <span
                          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                            isSelected
                              ? 'bg-white/20 text-white'
                              : 'bg-[#F5F5F1] text-[#666666]'
                          }`}
                        >
                          {prog.code}
                        </span>
                      )}
                      <h3
                        className={`text-sm sm:text-base font-serif font-bold mt-2 ${
                          isSelected ? 'text-white' : 'text-[#252525]'
                        }`}
                      >
                        {prog.name}
                      </h3>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isSelected
                          ? 'bg-white text-[#85845C]'
                          : 'bg-[#F5F5F1] text-[#85845C] border border-[#E5E5DF]'
                      }`}
                    >
                      {prog.durationYears || 'Flexible'}
                    </span>
                  </div>

                  {prog.description && (
                    <p
                      className={`text-xs mt-2 line-clamp-2 ${
                        isSelected ? 'text-white/80' : 'text-[#666666]'
                      }`}
                    >
                      {prog.description}
                    </p>
                  )}

                  <div
                    className={`mt-4 pt-3 border-t text-[11px] font-semibold flex items-center justify-between ${
                      isSelected
                        ? 'border-white/20 text-white/90'
                        : 'border-[#E5E5DF] text-[#666666]'
                    }`}
                  >
                    <span>{prog.levels.length} Academic Levels</span>
                    <span>{totalSubjects} Subjects</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Active Programme Explorer Workspace */}
          {activeProgramme && activeProgramme.levels.length > 0 && (
            <div className="bg-white rounded-2xl border border-[#E5E5DF] p-6 sm:p-9 space-y-8 shadow-xs">
              {/* Programme Details Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-[#E5E5DF] gap-4">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#85845C]">
                      {categories.find((c) => c.id === activeProgramme.categoryId)?.label || 'Programme'}
                    </span>
                    <span>•</span>
                    <span className="text-xs font-bold text-[#E56A45]">
                      Duration: {activeProgramme.durationYears || 'Flexible'}
                    </span>
                  </div>
                  <h3
                    className="text-xl sm:text-2xl font-serif font-bold mt-1 text-[#252525]"
                    style={{ color: theme.headingColor || '#252525' }}
                  >
                    {activeProgramme.name}
                  </h3>
                  {activeProgramme.description && (
                    <p className="text-xs sm:text-sm text-[#666666] mt-1 max-w-2xl">
                      {activeProgramme.description}
                    </p>
                  )}
                </div>

                {activeProgramme.admissionRequirements && (
                  <div className="bg-[#F5F5F1] border border-[#E5E5DF] rounded-2xl p-3.5 max-w-xs text-xs">
                    <span className="font-bold text-[#252525] block mb-0.5">
                      Admission Criteria
                    </span>
                    <span className="text-[#666666]">
                      {activeProgramme.admissionRequirements}
                    </span>
                  </div>
                )}
              </div>

              {/* Level / Stream / Year Selector Tabs */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-[#666666] uppercase tracking-wider">
                  Select Grade / Academic Level / Stream
                </span>

                <div className="flex flex-wrap gap-2">
                  {activeProgramme.levels.map((lvl) => {
                    const isLvlSelected = activeLevel?.id === lvl.id;
                    return (
                      <button
                        key={lvl.id}
                        type="button"
                        onClick={() => setSelectedLevelId(lvl.id)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
                          isLvlSelected
                            ? 'bg-[#85845C] text-white shadow-xs ring-2 ring-[#A5A477]'
                            : 'bg-[#F5F5F1] text-[#252525] border border-[#E5E5DF] hover:bg-slate-100'
                        }`}
                      >
                        <Layers className={`w-3.5 h-3.5 ${isLvlSelected ? 'text-white' : 'text-[#85845C]'}`} />
                        <span>{lvl.levelLabel}</span>
                        {lvl.streamName && (
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded font-normal ${
                              isLvlSelected ? 'bg-white/20 text-white' : 'bg-[#E5E5DF] text-[#252525]'
                            }`}
                          >
                            {lvl.streamName}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Active Level's Subjects & Multi-Book Grid */}
              {activeLevel && (
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <GraduationCap className="w-4 h-4 text-[#85845C]" />
                      <h4 className="text-sm font-bold text-[#252525]">
                        {activeLevel.levelLabel} {activeLevel.streamName ? `(${activeLevel.streamName})` : ''} Subjects
                      </h4>
                    </div>
                    <span className="text-xs font-medium text-[#666666]">
                      {activeLevel.subjects.length} Subjects Offered
                    </span>
                  </div>

                  {activeLevel.subjects.length === 0 ? (
                    <div className="p-8 text-center bg-[#F5F5F1] rounded-2xl border border-dashed border-[#E5E5DF]">
                      <p className="text-xs text-[#666666]">
                        No subject records currently published for this academic level.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-wrap justify-center gap-4">
                      {activeLevel.subjects.map((sub) => (
                        <div
                          key={sub.id}
                          className="w-full md:w-[calc(50%-0.5rem)] max-w-xl bg-white border border-[#E5E5DF] rounded-2xl p-5 hover:border-[#85845C]/50 hover:shadow-xs transition-all flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h5 className="text-sm font-serif font-bold text-[#252525]">
                                  {sub.name}
                                </h5>
                                {sub.code && (
                                  <span className="text-[10px] font-mono text-[#666666]">
                                    {sub.code}
                                  </span>
                                )}
                              </div>

                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  sub.isOptional
                                    ? 'bg-[#F5F5F1] text-[#666666] border border-[#E5E5DF]'
                                    : 'bg-[#F5F5F1] text-[#85845C] border border-[#85845C]/30'
                                }`}
                              >
                                {sub.isOptional ? 'Elective' : 'Compulsory'}
                              </span>
                            </div>

                            {sub.description && (
                              <p className="text-xs text-[#666666] mt-2 leading-relaxed">
                                {sub.description}
                              </p>
                            )}

                            {/* Multi-Book Drawer under Subject */}
                            {sub.books.length > 0 && (
                              <div className="mt-4 pt-3 border-t border-[#E5E5DF] space-y-2">
                                <span className="text-[10px] font-bold text-[#85845C] uppercase tracking-wider flex items-center space-x-1.5">
                                  <BookMarked className="w-3.5 h-3.5 text-[#85845C]" />
                                  <span>Prescribed Kitabs & Textbooks ({sub.books.length})</span>
                                </span>

                                <div className="space-y-1.5">
                                  {sub.books.map((bk) => (
                                    <div
                                      key={bk.id}
                                      className="bg-[#F5F5F1] rounded-xl p-2.5 border border-[#E5E5DF] text-xs shadow-2xs"
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="font-bold text-[#252525]">
                                          {bk.title}
                                        </span>
                                        {bk.completionNotes && (
                                          <span className="text-[10px] font-semibold text-[#85845C] bg-white px-2 py-0.5 rounded-full border border-[#E5E5DF]">
                                            {bk.completionNotes}
                                          </span>
                                        )}
                                      </div>
                                      {bk.author && (
                                        <span className="text-[11px] text-[#666666] block mt-0.5">
                                          Author / Muallif: <strong className="text-[#252525]">{bk.author}</strong>
                                        </span>
                                      )}
                                      {bk.description && (
                                        <p className="text-[11px] text-[#666666] mt-1">
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
                              <div className="mt-3 pt-2 text-[11px] text-[#666666] space-y-1">
                                {sub.learningOutcomes.map((out, idx) => (
                                  <div key={idx} className="flex items-start space-x-1.5">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-[#85845C] shrink-0 mt-0.5" />
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

      {/* 3. Rules & Regulations Card (Always preserved) */}
      <div id="rules" className="bg-white rounded-2xl border border-[#E5E5DF] p-7 sm:p-9 scroll-mt-28 shadow-xs">
        <div className="flex items-center space-x-2.5 text-xs font-bold text-[#85845C] uppercase tracking-wider mb-4">
          <div className="w-8 h-8 rounded-lg bg-[#F5F5F1] border border-[#E5E5DF] flex items-center justify-center text-[#85845C]">
            <ShieldCheck className="w-4 h-4 text-[#85845C]" />
          </div>
          <span>Institutional Conduct</span>
        </div>

        <h3
          className="text-xl sm:text-2xl font-serif font-bold mb-4 tracking-tight text-[#252525]"
          style={{ color: theme.headingColor || '#252525' }}
        >
          Rules & Code of Conduct
        </h3>

        <div
          className="text-xs sm:text-sm leading-relaxed whitespace-pre-line flex-1 mb-6 text-[#252525]"
          style={{ color: theme.bodyTextColor || '#252525' }}
        >
          {rulesAndRegulations ||
            'Students must observe strict punctuality, dignified Islamic attire, respectful etiquette toward teachers and fellow peers, and active participation in daily congregational prayers and assemblies.'}
        </div>

        <div className="pt-4 border-t border-[#E5E5DF] flex items-center space-x-2 text-xs font-semibold text-[#666666]">
          <Award className="w-4 h-4 text-[#85845C]" />
          <span>Dedicated to nurturing discipline, reverence, and academic excellence</span>
        </div>
      </div>
    </section>
  );
};
