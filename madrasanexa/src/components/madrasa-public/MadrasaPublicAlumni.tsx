import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  Award,
  BookOpen,
  Building2,
  MapPin,
  Sparkles,
  ExternalLink,
  Search,
  CheckCircle2,
  Mail,
  Phone,
  Filter,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  User,
  Quote,
} from 'lucide-react';
import type { MadrasaThemeTokens } from '../../services/api';
import {
  getPublicAlumni,
  type AlumniScholarItem,
  getScholarStatusInfo,
} from '../../services/scholar-alumni.service';

interface MadrasaPublicAlumniProps {
  madrasaCode: string;
  madrasaName: string;
  theme: MadrasaThemeTokens;
}

export const MadrasaPublicAlumni: React.FC<MadrasaPublicAlumniProps> = ({
  madrasaCode,
  madrasaName,
  theme: _theme,
}) => {
  const [alumni, setAlumni] = useState<AlumniScholarItem[]>([]);
  const [batchYears, setBatchYears] = useState<string[]>([]);
  const [classOrDivisions, setClassOrDivisions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active filters
  const [selectedBatch, setSelectedBatch] = useState<string>('ALL');
  const [selectedClass, setSelectedClass] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Persistent-Card Expanding Deck active scholar
  const [activeScholarId, setActiveScholarId] = useState<string | null>(null);

  // 4-Side Expanding Royal Dossier Stage state
  const [isDossierExpanded, setIsDossierExpanded] = useState<boolean>(false);

  const loadAlumni = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getPublicAlumni(madrasaCode);
      setAlumni(data.alumni || []);
      setBatchYears(data.batchYears || []);
      setClassOrDivisions(data.classOrDivisions || []);
    } catch (err: any) {
      console.error('Failed to load public alumni directory:', err);
      setError('Unable to load the alumni directory at this moment.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (madrasaCode) {
      loadAlumni();
    }
  }, [madrasaCode]);

  // Client-side filtering
  const filteredAlumni = alumni.filter((item) => {
    if (selectedBatch !== 'ALL' && item.batchYear !== selectedBatch) {
      return false;
    }
    if (selectedClass !== 'ALL' && item.classOrDivision !== selectedClass) {
      return false;
    }
    if (selectedStatus !== 'ALL' && item.academicStatus !== selectedStatus) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const inName = item.fullName.toLowerCase().includes(q);
      const inQual = item.qualification?.toLowerCase().includes(q);
      const inUni = item.university?.toLowerCase().includes(q);
      const inRole = item.currentRole?.toLowerCase().includes(q);
      const inLoc = item.cityCountry?.toLowerCase().includes(q);
      const inBatch = item.batchYear.toLowerCase().includes(q);
      const inQualList = item.qualificationsList?.some(
        (ql) => ql.degree.toLowerCase().includes(q) || ql.university.toLowerCase().includes(q)
      );
      return inName || inQual || inUni || inRole || inLoc || inBatch || inQualList;
    }
    return true;
  });

  // Synchronize activeScholarId with filtered results
  useEffect(() => {
    if (filteredAlumni.length > 0) {
      if (!activeScholarId || !filteredAlumni.some((a) => a.id === activeScholarId)) {
        setActiveScholarId(filteredAlumni[0].id);
      }
    } else {
      setActiveScholarId(null);
    }
  }, [filteredAlumni, activeScholarId]);

  // Automatically reset dossier expansion on scholar selection or filter change
  useEffect(() => {
    setIsDossierExpanded(false);
  }, [activeScholarId, selectedBatch, selectedClass, selectedStatus, searchQuery]);

  const activeScholarIdx = Math.max(
    0,
    filteredAlumni.findIndex((s) => s.id === activeScholarId)
  );
  const activeScholar = filteredAlumni[activeScholarIdx] || filteredAlumni[0] || null;

  const handlePrevScholar = () => {
    if (filteredAlumni.length <= 1) return;
    const prevIdx = (activeScholarIdx - 1 + filteredAlumni.length) % filteredAlumni.length;
    setActiveScholarId(filteredAlumni[prevIdx].id);
  };

  const handleNextScholar = () => {
    if (filteredAlumni.length <= 1) return;
    const nextIdx = (activeScholarIdx + 1) % filteredAlumni.length;
    setActiveScholarId(filteredAlumni[nextIdx].id);
  };

  // Window visible cards for persistent expanding track (max 5 around active)
  const getVisibleScholarCards = () => {
    const len = filteredAlumni.length;
    if (len <= 5) return filteredAlumni;
    const idx = activeScholarIdx;
    const windowedIndices = [
      (idx - 2 + len) % len,
      (idx - 1 + len) % len,
      idx,
      (idx + 1) % len,
      (idx + 2) % len,
    ];
    return windowedIndices.map((i) => filteredAlumni[i]);
  };

  const visibleScholarCards = getVisibleScholarCards();

  const getInitials = (name: string) =>
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('');

  return (
    <section
      id="alumni"
      className="public-section-enter scroll-mt-28 py-8 sm:py-12 overflow-x-clip w-full max-w-full"
      aria-label="Alumni & Scholars Showcase"
    >
      {/* Keyframes for Gold Shimmer & Sheen */}
      <style>{`
        @keyframes scholarGoldSweep {
          0% { background-position: 200% center; }
          100% { background-position: -200% center; }
        }
        @keyframes scholarGoldSheen {
          0% { transform: translateX(-150%); opacity: 0; }
          25% { opacity: 0.65; }
          50% { opacity: 0.65; }
          100% { transform: translateX(250%); opacity: 0; }
        }
        .animate-scholar-gold-shimmer {
          background-size: 200% 100%;
          animation: scholarGoldSweep 4s ease-in-out infinite;
        }
        .animate-scholar-gold-sheen {
          animation: scholarGoldSheen 3.2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
      `}</style>

      {/* Section Header */}
      <div className="mb-8 pb-6 border-b border-[#E2E0D0] text-center sm:text-left">
        <div className="max-w-3xl">
          <div className="inline-flex items-center space-x-2 text-xs font-bold uppercase tracking-wider mb-2.5 px-3.5 py-1 rounded-full public-section-badge shadow-2xs">
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Regal Scholars Dossier</span>
          </div>
          <h2
            className="text-2xl sm:text-3xl lg:text-4xl font-serif font-bold tracking-tight public-night-h2"
          >
            Scholarly Alumni & Graduates
          </h2>
          <p className="mt-2 text-xs sm:text-sm leading-relaxed public-night-subtext">
            Celebrating {madrasaName} graduates pursuing sacred knowledge, higher academic degrees, and community leadership worldwide.
          </p>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. SINGLE CENTERED SEARCH & FILTER BAR                                    */}
      {/* ========================================================================= */}
      <div className="max-w-5xl mx-auto bg-[#F8F7F2] dark:bg-[#141820] border border-[#E2E0D0] dark:border-[#242936] rounded-3xl p-4 sm:p-5 mb-10 space-y-4 shadow-xs">
        {/* Full-Width Search Input */}
        <div className="relative w-full">
          <Search className="w-4 h-4 text-[#8C8A58] dark:text-[#84CC16] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search scholar name, degree, university, role, or location..."
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#1C222D] border border-[#E2E0D0] dark:border-[#242936] rounded-2xl text-xs sm:text-sm text-[#232215] dark:text-[#F9FAFB] placeholder-stone-400 dark:placeholder-gray-500 focus:outline-hidden focus:ring-2 focus:ring-[#6B6A45]/30 dark:focus:ring-[#84CC16]/30 shadow-2xs"
          />
        </div>

        {/* Status Crest Pills */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <span className="font-semibold text-slate-600 dark:text-[#F9FAFB] text-xs mr-1 flex items-center gap-1 shrink-0">
            <Filter className="w-3 h-3 text-[#8C8A58] dark:text-[#84CC16]" />
            Status:
          </span>
          {[
            { id: 'ALL', label: 'All Statuses' },
            { id: 'UNDERGRADUATE', label: 'Undergraduates' },
            { id: 'GRADUATE', label: 'Graduates' },
            { id: 'POSTGRADUATE', label: 'Postgraduates' },
            { id: 'WORKING_SCHOLAR', label: 'Working Scholars' },
            { id: 'HAFIL', label: 'Hafil' },
            { id: 'AL_AALIM', label: 'Al Aalim' },
            { id: 'OTHER', label: 'Other' },
          ].map((st) => (
            <button
              key={st.id}
              onClick={() => setSelectedStatus(st.id)}
              className={`h-8 px-3 text-xs rounded-full transition-all cursor-pointer flex items-center justify-center shrink-0 ${
                selectedStatus === st.id
                  ? 'bg-[#6B6A45] dark:bg-[#84CC16] text-white dark:text-[#0B0D11] shadow-2xs font-bold border border-[#504F34] dark:border-0'
                  : 'bg-white dark:bg-[#1C222D] text-slate-700 dark:text-[#D1D5DB] hover:bg-[#F4F3EC] dark:hover:bg-[#242936] border border-[#E2E0D0] dark:border-[#242936] font-medium'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>

        {/* Batch Year, Class/Division & Result Counter */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 sm:gap-3 items-end pt-3 border-t border-[#E2E0D0]/80 dark:border-[#242936]">
          <div className="lg:col-span-4 space-y-1">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#9CA3AF]">
              BATCH YEAR
            </label>
            <select
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-[#E2E0D0] dark:border-[#242936] bg-white dark:bg-[#1C222D] text-xs sm:text-sm text-slate-800 dark:text-[#F9FAFB] focus:outline-hidden"
            >
              <option value="ALL">All Batches</option>
              {batchYears.map((by) => (
                <option key={by} value={by}>
                  Batch of {by}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-5 space-y-1">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#9CA3AF]">
              CLASS / DIVISION
            </label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-[#E2E0D0] dark:border-[#242936] bg-white dark:bg-[#1C222D] text-xs sm:text-sm text-slate-800 dark:text-[#F9FAFB] focus:outline-hidden"
            >
              <option value="ALL">All Classes & Divisions</option>
              {classOrDivisions.map((cd) => (
                <option key={cd} value={cd}>
                  {cd}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-3 text-xs font-medium text-slate-500 dark:text-[#9CA3AF] lg:text-right pb-2">
            Showing <strong className="text-slate-800 dark:text-[#F9FAFB]">{filteredAlumni.length}</strong> of{' '}
            <strong className="text-slate-800 dark:text-[#F9FAFB]">{alumni.length}</strong> scholars
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. 4-SIDE EXPANDING ROYAL DOSSIER STAGE & EXPANDING DECK                  */}
      {/* ========================================================================= */}
      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#6B6A45] mb-3" />
          <p className="text-xs text-slate-600 font-medium">Loading scholarly alumni profiles...</p>
        </div>
      ) : error ? (
        <div className="p-8 text-center bg-white border border-[#E2E0D0] rounded-3xl text-xs text-slate-600 max-w-2xl mx-auto shadow-sm">
          {error}
        </div>
      ) : filteredAlumni.length === 0 ? (
        <div className="p-12 text-center bg-white border border-[#E2E0D0] rounded-3xl space-y-3 max-w-2xl mx-auto shadow-sm">
          <GraduationCap className="w-10 h-10 mx-auto text-[#8C8A58]/50" />
          <h4 className="text-base font-serif font-bold text-[#232215]">No Profiles Match Selection</h4>
          <p className="text-xs text-slate-600 max-w-sm mx-auto">
            Try adjusting your search query or selecting a different batch/status filter above.
          </p>
        </div>
      ) : filteredAlumni.length === 1 && activeScholar ? (
        /* ========================================================================= */
        /* SINGLE SCHOLAR: 4-SIDE SMOOTH EXPANDING ROYAL DOSSIER STAGE               */
        /* ========================================================================= */
        <div
          className={`w-full mx-auto rounded-3xl bg-white dark:bg-[#141820] overflow-hidden relative transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            isDossierExpanded
              ? 'max-w-5xl border border-[#C5A059] dark:border-[#242936] ring-2 ring-[#C5A059]/35 shadow-[0_24px_60px_rgba(107,106,69,0.22)]'
              : 'max-w-3xl border border-[#D8D5C0] dark:border-[#242936] shadow-xl'
          }`}
        >
          {/* Top Olive-Gold Gradient Accent Bar */}
          <div className="h-1.5 bg-gradient-to-r from-[#6B6A45] via-[#C5A059] to-[#8C8A58] w-full" />

          <div className="grid grid-cols-1 md:grid-cols-12 items-stretch">
            {/* Left Portrait */}
            <div
              className={`p-6 sm:p-7 bg-gradient-to-b from-[#F8F7F2] to-white dark:from-[#1C222D] dark:to-[#141820] flex flex-col items-center justify-between border-b md:border-b-0 md:border-r border-[#E2E0D0] dark:border-[#242936] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                isDossierExpanded ? 'md:col-span-4' : 'md:col-span-5'
              }`}
            >
              <div
                className={`relative w-full aspect-[4/5] rounded-2xl p-1 bg-gradient-to-tr from-[#6B6A45] via-[#C5A059] to-[#8C8A58] shadow-lg ring-4 ring-[#C5A059]/20 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  isDossierExpanded ? 'max-w-[250px]' : 'max-w-[210px]'
                }`}
              >
                <div className="w-full h-full rounded-xl overflow-hidden bg-[#F3F1E6] dark:bg-[#1C222D] relative">
                  {activeScholar.photoUrl ? (
                    <img
                      src={activeScholar.photoUrl}
                      alt={activeScholar.fullName}
                      className="w-full h-full object-cover object-top transition-transform duration-700 hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-[#F4F3EC] to-[#E5E3D5] dark:from-[#1C222D] dark:to-[#242936] text-[#6B6A45] dark:text-[#84CC16]">
                      <span className="text-4xl font-serif font-bold">{getInitials(activeScholar.fullName)}</span>
                      <User className="w-8 h-8 mt-2 opacity-40" />
                    </div>
                  )}
                  <div className="absolute top-2.5 left-2.5">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#232215]/85 text-[#F8F7F2] backdrop-blur-xs border border-white/20 shadow-xs font-mono">
                      Batch {activeScholar.batchYear}
                    </span>
                  </div>
                </div>
              </div>

              {/* Verified Scholar Seal */}
              <div className="mt-4 flex items-center justify-center">
                <div className="relative inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider bg-gradient-to-r from-[#B58D3D] via-[#DFC076] to-[#B58D3D] bg-[length:200%_100%] animate-scholar-gold-shimmer text-[#1F1B0E] border border-[#F0D999]/90 shadow-[0_4px_14px_rgba(197,160,89,0.4)] overflow-hidden">
                  <span
                    className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/50 to-transparent pointer-events-none animate-scholar-gold-sheen"
                    aria-hidden="true"
                  />
                  <CheckCircle2 className="w-4 h-4 text-[#1F1B0E] shrink-0 relative z-10" />
                  <span className="relative z-10">Verified Scholar</span>
                </div>
              </div>
            </div>

            {/* Right Details & 4-Side Expanding Dossier Stage */}
            <div
              className={`p-6 sm:p-7 flex flex-col justify-between bg-islamic-diamond-subtle dark:bg-[#141820] relative transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                isDossierExpanded ? 'md:col-span-8' : 'md:col-span-7'
              }`}
            >
              <div className="space-y-3.5">
                {/* Header Pills */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-[#FAF8F2] dark:bg-[#1C222D] text-[#8C8A58] dark:text-[#84CC16] border border-[#C5A059]/40 dark:border-[#242936] shadow-2xs flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-[#C5A059] dark:text-[#84CC16]" />
                      <span>{isDossierExpanded ? 'Royal Scholar Dossier Stage' : 'Distinguished Scholar Spotlight'}</span>
                    </span>
                    {(() => {
                      const sInfo = getScholarStatusInfo(activeScholar.academicStatus, activeScholar.customStatusLabel);
                      return (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#6B6A45] text-[#F8F7F2] border border-[#8C8A58]/60 shadow-2xs">
                          {sInfo.label}
                        </span>
                      );
                    })()}
                  </div>
                  {activeScholar.classOrDivision && (
                    <span className="text-xs text-slate-500 dark:text-[#9CA3AF] font-semibold font-mono">
                      {activeScholar.classOrDivision}
                    </span>
                  )}
                </div>

                {/* Full Name */}
                <h3 className="text-2xl sm:text-3xl font-serif font-bold text-[#232215] dark:text-[#F9FAFB] tracking-tight">
                  {activeScholar.fullName}
                </h3>

                {/* Role & Location */}
                {(activeScholar.currentRole || activeScholar.cityCountry) && (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs sm:text-sm text-slate-700 dark:text-[#D1D5DB]">
                    {activeScholar.currentRole && (
                      <div className="flex items-center gap-1.5 font-semibold text-[#504F34] dark:text-[#84CC16]">
                        <Award className="w-4 h-4 text-[#8C8A58] dark:text-[#84CC16] shrink-0" />
                        <span>{activeScholar.currentRole}</span>
                      </div>
                    )}
                    {activeScholar.cityCountry && (
                      <div className="flex items-center gap-1.5 text-slate-600 dark:text-[#9CA3AF]">
                        <MapPin className="w-3.5 h-3.5 text-[#8C8A58] dark:text-[#84CC16] shrink-0" />
                        <span>{activeScholar.cityCountry}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* ============================================================= */}
                {/* COMPACT VIEW: Short Quote & 2-Item Track Preview              */}
                {/* ============================================================= */}
                {!isDossierExpanded && (
                  <div className="space-y-3 pt-1 animate-in fade-in duration-300">
                    {activeScholar.bio && (
                      <p className="text-xs sm:text-sm leading-relaxed text-slate-700 dark:text-[#D1D5DB] italic bg-[#FAF8F2]/90 dark:bg-[#1C222D] p-3 rounded-2xl border border-[#E2E0D0]/80 dark:border-[#242936] line-clamp-3">
                        "{activeScholar.bio}"
                      </p>
                    )}

                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[#6B6A45] dark:text-[#84CC16] mb-2 flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-[#8C8A58] dark:text-[#84CC16]" />
                        <span>Academic Progression Track</span>
                      </div>
                      {(() => {
                        const quals =
                          activeScholar.qualificationsList && activeScholar.qualificationsList.length > 0
                            ? activeScholar.qualificationsList
                            : activeScholar.qualification
                            ? [{ degree: activeScholar.qualification, university: activeScholar.university, year: activeScholar.batchYear }]
                            : [];
                        return (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {quals.slice(0, 2).map((q, idx) => (
                              <div
                                key={idx}
                                className="bg-white/95 dark:bg-[#1C222D] rounded-2xl p-2.5 border border-[#E2E0D0] dark:border-[#242936] shadow-2xs hover:border-[#C5A059] dark:hover:border-[#84CC16]/50 transition-all"
                              >
                                <div className="flex items-center justify-between gap-1 mb-1">
                                  <span className="w-4 h-4 rounded-full bg-[#F4F3EC] dark:bg-[#242936] text-[#6B6A45] dark:text-[#84CC16] text-[9px] font-bold flex items-center justify-center shrink-0 border border-[#E2E0D0] dark:border-[#242936]">
                                    {idx + 1}
                                  </span>
                                  {q.year && (
                                    <span className="text-[10px] font-mono font-bold text-[#8C8A58] dark:text-[#84CC16]">
                                      {q.year}
                                    </span>
                                  )}
                                </div>
                                <h4 className="font-bold text-xs text-[#232215] dark:text-[#F9FAFB] truncate">
                                  {q.degree || 'Degree / Award'}
                                </h4>
                                <p className="text-[11px] text-slate-500 dark:text-[#9CA3AF] truncate mt-0.5">
                                  {q.university || 'University / Academy'}
                                </p>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {/* ============================================================= */}
                {/* 4-SIDE EXPANDED VIEW: Complete Vertical Timeline & Dossier     */}
                {/* ============================================================= */}
                {isDossierExpanded && (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-2 animate-in fade-in duration-400">
                    {/* Left Column: Complete Academic Journey Timeline */}
                    <div className="md:col-span-7 space-y-2.5">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[#6B6A45] dark:text-[#84CC16] flex items-center gap-1.5">
                        <GraduationCap className="w-3.5 h-3.5 text-[#8C8A58] dark:text-[#84CC16]" />
                        <span>Complete Academic Journey</span>
                      </div>
                      {(() => {
                        const quals =
                          activeScholar.qualificationsList && activeScholar.qualificationsList.length > 0
                            ? activeScholar.qualificationsList
                            : activeScholar.qualification
                            ? [{ degree: activeScholar.qualification, university: activeScholar.university, year: activeScholar.batchYear }]
                            : [];
                        return (
                          <div className="border-l-2 border-[#C5A059]/70 dark:border-[#84CC16]/50 pl-3.5 space-y-2.5 relative ml-1.5">
                            {quals.map((q, idx) => (
                              <div key={idx} className="relative">
                                <span
                                  className="absolute -left-[19px] top-1.5 w-2.5 h-2.5 rounded-full bg-[#C5A059] dark:bg-[#84CC16] ring-2 ring-white dark:ring-[#141820] shadow-2xs"
                                  aria-hidden="true"
                                />
                                <div className="bg-white/95 dark:bg-[#1C222D] p-2.5 rounded-xl border border-[#E2E0D0] dark:border-[#242936] shadow-2xs flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <h4 className="font-bold text-xs text-[#232215] dark:text-[#F9FAFB] truncate">
                                      {q.degree || 'Degree / Award'}
                                    </h4>
                                    <p className="text-[11px] text-slate-600 dark:text-[#D1D5DB] flex items-center gap-1 mt-0.5 truncate">
                                      <Building2 className="w-3 h-3 text-[#8C8A58] dark:text-[#84CC16] shrink-0" />
                                      <span className="truncate">{q.university || 'University'}</span>
                                    </p>
                                  </div>
                                  {q.year && (
                                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#FAF8F2] dark:bg-[#242936] border border-[#C5A059]/40 dark:border-[#242936] text-[#8C8A58] dark:text-[#84CC16] shrink-0">
                                      {q.year}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Right Column: Statement, Mentorship & Connect */}
                    <div className="md:col-span-5 space-y-2.5">
                      {activeScholar.bio && (
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#9CA3AF]">
                            Scholarly Statement
                          </span>
                          <p className="text-xs leading-relaxed text-slate-700 dark:text-[#D1D5DB] italic bg-[#FAF8F2] dark:bg-[#1C222D] p-3 rounded-xl border border-[#E2E0D0]/80 dark:border-[#242936]">
                            "{activeScholar.bio}"
                          </p>
                        </div>
                      )}

                      {activeScholar.availableForMentorship && (
                        <div className="p-2.5 bg-emerald-50/90 dark:bg-emerald-950/30 border border-emerald-200/90 dark:border-emerald-900/50 rounded-xl flex items-start gap-2 text-xs text-emerald-900 dark:text-emerald-300">
                          <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold block text-[11px]">Academic Mentorship</span>
                            <span className="text-emerald-800 dark:text-emerald-300 text-[10px] leading-tight block">
                              Open to guide students in higher studies & scholarship.
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Connect Buttons */}
                      {activeScholar.showContactPublicly &&
                        (activeScholar.email || activeScholar.phone || activeScholar.linkedinUrl) && (
                          <div className="pt-2 border-t border-[#E2E0D0]/80 dark:border-[#242936] space-y-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#9CA3AF] block">
                              Connect with Scholar
                            </span>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {activeScholar.email && (
                                <a
                                  href={`mailto:${activeScholar.email}`}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#F4F3EC] dark:bg-[#1C222D] hover:bg-[#E2E0D0] dark:hover:bg-[#242936] text-[#232215] dark:text-[#F9FAFB] border border-transparent dark:border-[#242936] rounded-lg text-[11px] font-semibold transition-colors"
                                >
                                  <Mail className="w-3 h-3 text-[#6B6A45] dark:text-[#84CC16]" />
                                  <span>Email</span>
                                </a>
                              )}
                              {activeScholar.phone && (
                                <a
                                  href={`tel:${activeScholar.phone}`}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#F4F3EC] dark:bg-[#1C222D] hover:bg-[#E2E0D0] dark:hover:bg-[#242936] text-[#232215] dark:text-[#F9FAFB] border border-transparent dark:border-[#242936] rounded-lg text-[11px] font-semibold transition-colors"
                                >
                                  <Phone className="w-3 h-3 text-[#6B6A45] dark:text-[#84CC16]" />
                                  <span>Call / WhatsApp</span>
                                </a>
                              )}
                              {activeScholar.linkedinUrl && (
                                <a
                                  href={activeScholar.linkedinUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#FAF8F2] dark:bg-[#1C222D] hover:bg-[#F4F3EC] dark:hover:bg-[#242936] text-[#6B6A45] dark:text-[#84CC16] border border-[#C5A059]/40 dark:border-[#242936] rounded-lg text-[11px] font-bold transition-colors"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  <span>LinkedIn</span>
                                </a>
                              )}
                            </div>
                          </div>
                        )}
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Action Button (Toggles 4-Side Expansion) */}
              <div className="pt-5 mt-4 border-t border-[#E2E0D0]/80 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setIsDossierExpanded((prev) => !prev)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer active:scale-95 shadow-xs ${
                    isDossierExpanded
                      ? 'bg-[#504F34] hover:bg-[#3D3C27] text-white border border-[#C5A059]/60 ring-2 ring-[#C5A059]/20'
                      : 'bg-[#6B6A45] hover:bg-[#504F34] text-white'
                  }`}
                >
                  <Award className="w-3.5 h-3.5 text-[#EFEFD0]" />
                  <span>{isDossierExpanded ? 'Collapse Royal Dossier' : 'View Full Royal Dossier'}</span>
                  {isDossierExpanded ? (
                    <ChevronUp className="w-3.5 h-3.5 text-[#DFC076]" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-[#DFC076]" />
                  )}
                </button>

                {activeScholar.availableForMentorship && (
                  <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full inline-flex items-center gap-1.5 shadow-2xs">
                    <Sparkles className="w-3 h-3 text-emerald-600" />
                    <span>Open to Mentor Students</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* MULTIPLE SCHOLARS: 4-SIDE EXPANDING PERSISTENT-CARD DECK                  */
        /* ========================================================================= */
        <div className="w-full">
          {/* --------------------------------------------------------------------- */}
          {/* DESKTOP VIEW: PERSISTENT-CARD DECK (lg+)                              */}
          {/* --------------------------------------------------------------------- */}
          <div className="hidden lg:block">
            <div className="flex items-stretch justify-center gap-3 xl:gap-3.5 max-w-6xl mx-auto overflow-hidden py-3">
              {visibleScholarCards.map((scholar) => {
                const isCurrent = scholar.id === activeScholarId;
                const quals =
                  scholar.qualificationsList && scholar.qualificationsList.length > 0
                    ? scholar.qualificationsList
                    : scholar.qualification
                    ? [{ degree: scholar.qualification, university: scholar.university, year: scholar.batchYear }]
                    : [];

                return (
                  <div
                    key={scholar.id}
                    onClick={() => {
                      if (!isCurrent) {
                        setActiveScholarId(scholar.id);
                        setIsDossierExpanded(false);
                      }
                    }}
                    className={`overflow-hidden shrink-0 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                      isCurrent
                        ? isDossierExpanded
                          ? 'w-[860px] xl:w-[960px] min-h-[500px] rounded-3xl bg-white border border-[#C5A059] ring-2 ring-[#C5A059]/35 shadow-[0_24px_60px_rgba(107,106,69,0.22)] relative flex select-text'
                          : 'w-[580px] xl:w-[640px] min-h-[410px] rounded-3xl bg-white border border-[#D8D5C0] shadow-xl relative flex select-text'
                        : isDossierExpanded
                        ? 'w-[75px] xl:w-[85px] min-h-[500px] rounded-2xl cursor-pointer relative group border border-[#E2E0D0] bg-[#F3F1E6] shadow-sm hover:shadow-md hover:-translate-y-1.5 select-none opacity-80 hover:opacity-100'
                        : 'w-[115px] xl:w-[130px] min-h-[410px] rounded-2xl cursor-pointer relative group border border-[#E2E0D0] bg-[#F3F1E6] shadow-sm hover:shadow-md hover:-translate-y-1.5 select-none'
                    }`}
                    title={!isCurrent ? `View ${scholar.fullName} (Batch ${scholar.batchYear})` : undefined}
                  >
                    {isCurrent ? (
                      /* ACTIVE CARD: 4-SIDE EXPANDING STAGE */
                      <div className="w-full h-full flex items-stretch">
                        {/* Left Portrait Frame */}
                        <div
                          className={`shrink-0 p-5 bg-gradient-to-b from-[#F8F7F2] to-white flex flex-col items-center justify-between border-r border-[#E2E0D0] relative transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                            isDossierExpanded ? 'w-[250px] xl:w-[270px]' : 'w-[220px] xl:w-[240px]'
                          }`}
                        >
                          <div
                            className={`relative w-full aspect-[4/5] rounded-2xl p-1 bg-gradient-to-tr from-[#6B6A45] via-[#C5A059] to-[#8C8A58] shadow-lg ring-4 ring-[#C5A059]/20 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                              isDossierExpanded ? 'max-w-[230px]' : 'max-w-[190px]'
                            }`}
                          >
                            <div className="w-full h-full rounded-xl overflow-hidden bg-[#F3F1E6] relative">
                              {scholar.photoUrl ? (
                                <img
                                  src={scholar.photoUrl}
                                  alt={scholar.fullName}
                                  className="w-full h-full object-cover object-top transition-transform duration-700 hover:scale-105"
                                />
                              ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-[#F4F3EC] to-[#E5E3D5] text-[#6B6A45]">
                                  <span className="text-3xl font-serif font-bold">{getInitials(scholar.fullName)}</span>
                                  <User className="w-7 h-7 mt-1.5 opacity-40" />
                                </div>
                              )}
                              <div className="absolute top-2 left-2">
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-[#232215]/85 text-[#F8F7F2] backdrop-blur-xs border border-white/20 shadow-xs font-mono">
                                  Batch {scholar.batchYear}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Animated Gold Shimmer Seal */}
                          <div className="mt-3 flex items-center justify-center">
                            <div className="relative inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-gradient-to-r from-[#B58D3D] via-[#DFC076] to-[#B58D3D] bg-[length:200%_100%] animate-scholar-gold-shimmer text-[#1F1B0E] border border-[#F0D999]/90 shadow-[0_3px_10px_rgba(197,160,89,0.35)] overflow-hidden">
                              <span
                                className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/50 to-transparent pointer-events-none animate-scholar-gold-sheen"
                                aria-hidden="true"
                              />
                              <CheckCircle2 className="w-3.5 h-3.5 text-[#1F1B0E] shrink-0 relative z-10" />
                              <span className="relative z-10">Verified Scholar</span>
                            </div>
                          </div>
                        </div>

                        {/* Right Details Pane */}
                        <div className="flex-1 p-5 xl:p-6 flex flex-col justify-between bg-islamic-diamond-subtle relative overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]">
                          <div className="space-y-3">
                            {/* Status & Class */}
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#FAF8F2] text-[#8C8A58] border border-[#C5A059]/40 shadow-2xs flex items-center gap-1">
                                  <Sparkles className="w-3 h-3 text-[#C5A059]" />
                                  <span>{isDossierExpanded ? 'Royal Scholar Dossier Stage' : 'Distinguished Spotlight'}</span>
                                </span>
                                {(() => {
                                  const sInfo = getScholarStatusInfo(scholar.academicStatus, scholar.customStatusLabel);
                                  return (
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#6B6A45] text-[#F8F7F2] border border-[#8C8A58]/60 shadow-2xs">
                                      {sInfo.label}
                                    </span>
                                  );
                                })()}
                              </div>
                              {scholar.classOrDivision && (
                                <span className="text-[11px] text-slate-500 font-semibold font-mono">
                                  {scholar.classOrDivision}
                                </span>
                              )}
                            </div>

                            {/* Scholar Name */}
                            <h3 className="text-xl xl:text-2xl font-serif font-bold text-[#232215] tracking-tight truncate">
                              {scholar.fullName}
                            </h3>

                            {/* Role & Location */}
                            {(scholar.currentRole || scholar.cityCountry) && (
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-700">
                                {scholar.currentRole && (
                                  <div className="flex items-center gap-1 font-semibold text-[#504F34]">
                                    <Award className="w-3.5 h-3.5 text-[#8C8A58] shrink-0" />
                                    <span className="truncate">{scholar.currentRole}</span>
                                  </div>
                                )}
                                {scholar.cityCountry && (
                                  <div className="flex items-center gap-1 text-slate-600">
                                    <MapPin className="w-3 h-3 text-[#8C8A58] shrink-0" />
                                    <span className="truncate">{scholar.cityCountry}</span>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* COMPACT MODE PREVIEW */}
                            {!isDossierExpanded && (
                              <div className="space-y-2.5 animate-in fade-in duration-300">
                                {scholar.bio && (
                                  <div className="relative my-1">
                                    <Quote className="w-4 h-4 text-[#6B6A45]/20 absolute -top-1 -left-1 pointer-events-none" />
                                    <p className="text-xs leading-relaxed text-slate-700 italic pl-3 line-clamp-2">
                                      "{scholar.bio}"
                                    </p>
                                  </div>
                                )}

                                <div>
                                  <div className="text-[9px] font-bold uppercase tracking-wider text-[#6B6A45] dark:text-[#84CC16] mb-1.5 flex items-center gap-1">
                                    <BookOpen className="w-3 h-3 text-[#8C8A58] dark:text-[#84CC16]" />
                                    <span>Academic Progression Track</span>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {quals.slice(0, 2).map((q, idx) => (
                                      <div
                                        key={idx}
                                        className="bg-white/95 dark:bg-[#1C222D] rounded-xl p-2 border border-[#E2E0D0] dark:border-[#242936] shadow-2xs"
                                      >
                                        <div className="flex items-center justify-between gap-1 mb-0.5">
                                          <span className="w-4 h-4 rounded-full bg-[#F4F3EC] dark:bg-[#242936] text-[#6B6A45] dark:text-[#84CC16] text-[9px] font-bold flex items-center justify-center shrink-0 border border-[#E2E0D0] dark:border-[#242936]">
                                            {idx + 1}
                                          </span>
                                          {q.year && (
                                            <span className="text-[9px] font-mono font-bold text-[#8C8A58] dark:text-[#84CC16]">
                                              {q.year}
                                            </span>
                                          )}
                                        </div>
                                        <h4 className="font-bold text-xs text-[#232215] dark:text-[#F9FAFB] truncate">
                                          {q.degree || 'Degree / Award'}
                                        </h4>
                                        <p className="text-[10px] text-slate-500 dark:text-[#9CA3AF] truncate mt-0.5">
                                          {q.university || 'University'}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* 4-SIDE EXPANDED STAGE (2-Column Dossier Body) */}
                            {isDossierExpanded && (
                              <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 pt-1 animate-in fade-in duration-400">
                                {/* Left Column: Complete Academic Journey Timeline */}
                                <div className="md:col-span-7 space-y-2">
                                  <div className="text-[9px] font-bold uppercase tracking-wider text-[#6B6A45] dark:text-[#84CC16] flex items-center gap-1">
                                    <GraduationCap className="w-3 h-3 text-[#8C8A58] dark:text-[#84CC16]" />
                                    <span>Complete Academic Journey</span>
                                  </div>
                                  <div className="border-l-2 border-[#C5A059]/70 dark:border-[#84CC16]/50 pl-3 space-y-2 relative ml-1 max-h-[175px] overflow-y-auto pr-1">
                                    {quals.map((q, idx) => (
                                      <div key={idx} className="relative">
                                        <span
                                          className="absolute -left-[17px] top-1.5 w-2 h-2 rounded-full bg-[#C5A059] dark:bg-[#84CC16] ring-2 ring-white dark:ring-[#141820] shadow-2xs"
                                          aria-hidden="true"
                                        />
                                        <div className="bg-white/95 dark:bg-[#1C222D] p-2 rounded-xl border border-[#E2E0D0] dark:border-[#242936] shadow-2xs flex items-start justify-between gap-2">
                                          <div className="min-w-0">
                                            <h4 className="font-bold text-xs text-[#232215] dark:text-[#F9FAFB] truncate">
                                              {q.degree || 'Degree / Award'}
                                            </h4>
                                            <p className="text-[10px] text-slate-600 dark:text-[#D1D5DB] flex items-center gap-1 mt-0.5 truncate">
                                              <Building2 className="w-3 h-3 text-[#8C8A58] dark:text-[#84CC16] shrink-0" />
                                              <span className="truncate">{q.university || 'University'}</span>
                                            </p>
                                          </div>
                                          {q.year && (
                                            <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#FAF8F2] dark:bg-[#242936] border border-[#C5A059]/40 dark:border-[#242936] text-[#8C8A58] dark:text-[#84CC16] shrink-0">
                                              {q.year}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* Right Column: Statement, Mentorship & Connect */}
                                <div className="md:col-span-5 space-y-2">
                                  {scholar.bio && (
                                    <div className="space-y-0.5">
                                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#9CA3AF] block">
                                        Scholarly Statement
                                      </span>
                                      <p className="text-[11px] leading-relaxed text-slate-700 dark:text-[#D1D5DB] italic bg-[#FAF8F2] dark:bg-[#1C222D] p-2.5 rounded-xl border border-[#E2E0D0]/80 dark:border-[#242936] line-clamp-3">
                                        "{scholar.bio}"
                                      </p>
                                    </div>
                                  )}

                                  {scholar.availableForMentorship && (
                                    <div className="p-2 bg-emerald-50/90 dark:bg-emerald-950/30 border border-emerald-200/90 dark:border-emerald-900/50 rounded-xl flex items-start gap-1.5 text-xs text-emerald-900 dark:text-emerald-300">
                                      <Sparkles className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                                      <div>
                                        <span className="font-bold block text-[10px]">Academic Mentorship</span>
                                        <span className="text-emerald-800 dark:text-emerald-300 text-[9px] leading-tight block">
                                          Open to guide junior students in higher studies.
                                        </span>
                                      </div>
                                    </div>
                                  )}

                                  {/* Direct Connect Buttons */}
                                  {scholar.showContactPublicly &&
                                    (scholar.email || scholar.phone || scholar.linkedinUrl) && (
                                      <div className="pt-1 border-t border-[#E2E0D0]/80 dark:border-[#242936] space-y-1">
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#9CA3AF] block">
                                          Connect with Scholar
                                        </span>
                                        <div className="flex flex-wrap items-center gap-1">
                                          {scholar.email && (
                                            <a
                                              href={`mailto:${scholar.email}`}
                                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#F4F3EC] dark:bg-[#1C222D] hover:bg-[#E2E0D0] dark:hover:bg-[#242936] text-[#232215] dark:text-[#F9FAFB] border border-transparent dark:border-[#242936] rounded-md text-[10px] font-semibold transition-colors"
                                            >
                                              <Mail className="w-2.5 h-2.5 text-[#6B6A45] dark:text-[#84CC16]" />
                                              <span>Email</span>
                                            </a>
                                          )}
                                          {scholar.phone && (
                                            <a
                                              href={`tel:${scholar.phone}`}
                                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#F4F3EC] dark:bg-[#1C222D] hover:bg-[#E2E0D0] dark:hover:bg-[#242936] text-[#232215] dark:text-[#F9FAFB] border border-transparent dark:border-[#242936] rounded-md text-[10px] font-semibold transition-colors"
                                            >
                                              <Phone className="w-2.5 h-2.5 text-[#6B6A45] dark:text-[#84CC16]" />
                                              <span>Call</span>
                                            </a>
                                          )}
                                          {scholar.linkedinUrl && (
                                            <a
                                              href={scholar.linkedinUrl}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#FAF8F2] dark:bg-[#1C222D] hover:bg-[#F4F3EC] dark:hover:bg-[#242936] text-[#6B6A45] dark:text-[#84CC16] border border-[#C5A059]/40 dark:border-[#242936] rounded-md text-[10px] font-bold transition-colors"
                                            >
                                              <ExternalLink className="w-2.5 h-2.5" />
                                              <span>LinkedIn</span>
                                            </a>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Action Button: Smooth Toggle */}
                          <div className="pt-3 mt-3 border-t border-[#E2E0D0]/70 flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => setIsDossierExpanded((prev) => !prev)}
                              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-xs ${
                                isDossierExpanded
                                  ? 'bg-[#504F34] hover:bg-[#3D3C27] text-white border border-[#C5A059]/60 ring-2 ring-[#C5A059]/20'
                                  : 'bg-[#6B6A45] hover:bg-[#504F34] text-white'
                              }`}
                            >
                              <Award className="w-3.5 h-3.5 text-[#EFEFD0]" />
                              <span>{isDossierExpanded ? 'Collapse Royal Dossier' : 'View Full Royal Dossier'}</span>
                              {isDossierExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5 text-[#DFC076]" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5 text-[#DFC076]" />
                              )}
                            </button>
                            {scholar.availableForMentorship && (
                              <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                <Sparkles className="w-3 h-3 text-emerald-600" />
                                <span>Mentorship</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* COLLAPSED NARROW VERTICAL PORTRAIT STRIP */
                      <div className="w-full h-full relative">
                        {scholar.photoUrl ? (
                          <img
                            src={scholar.photoUrl}
                            alt={scholar.fullName}
                            className="w-full h-full object-cover object-top brightness-90 group-hover:brightness-100 group-hover:scale-105 transition-all duration-500"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-[#F4F3EC] to-[#E5E3D5] text-[#6B6A45]">
                            <span className="text-xl font-bold font-serif">{getInitials(scholar.fullName)}</span>
                            <User className="w-4 h-4 mt-1 opacity-50" />
                          </div>
                        )}
                        {/* Bottom Dark Olive Gradient Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-[#1F1E12]/95 via-[#1F1E12]/35 to-transparent flex flex-col justify-end p-2 text-center">
                          <span className="inline-block px-1 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-[#6B6A45]/90 text-white truncate max-w-full mb-0.5">
                            Batch {scholar.batchYear}
                          </span>
                          <span className="text-[11px] font-bold text-white truncate drop-shadow-sm">
                            {scholar.fullName.split(' ')[0]}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Desktop Navigation Bar (< Prev, Avatar Pills, Next >) */}
            <div className="flex items-center justify-center gap-3 pt-4">
              <button
                type="button"
                onClick={handlePrevScholar}
                className="p-2 rounded-xl border border-[#E2E0D0] bg-white hover:bg-[#F4F3EC] text-[#6B6A45] transition-all cursor-pointer shadow-2xs"
                title="Previous Scholar"
                aria-label="Previous Scholar"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1.5 max-w-[280px] overflow-x-auto no-scrollbar py-1">
                {filteredAlumni.map((s, idx) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setActiveScholarId(s.id);
                      setIsDossierExpanded(false);
                    }}
                    className={`h-7 px-2.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center justify-center shrink-0 ${
                      s.id === activeScholarId
                        ? 'bg-[#6B6A45] text-white ring-2 ring-[#C5A059] shadow-xs'
                        : 'bg-white text-slate-600 border border-[#E2E0D0] hover:bg-[#F4F3EC]'
                    }`}
                    title={s.fullName}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleNextScholar}
                className="p-2 rounded-xl border border-[#E2E0D0] bg-white hover:bg-[#F4F3EC] text-[#6B6A45] transition-all cursor-pointer shadow-2xs"
                title="Next Scholar"
                aria-label="Next Scholar"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* --------------------------------------------------------------------- */}
          {/* MOBILE VIEW: SINGLE SPOTLIGHT CARD + CAROUSEL CONTROLS (< lg)          */}
          {/* --------------------------------------------------------------------- */}
          <div className="lg:hidden w-full max-w-lg mx-auto">
            {activeScholar && (
              <div
                className={`rounded-3xl bg-white dark:bg-[#141820] overflow-hidden relative transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  isDossierExpanded
                    ? 'border border-[#C5A059] dark:border-[#C5A059]/60 ring-2 ring-[#C5A059]/35 shadow-[0_24px_60px_rgba(107,106,69,0.22)] dark:shadow-black/50'
                    : 'border border-[#D8D5C0] dark:border-[#242936] shadow-xl dark:shadow-black/40'
                }`}
              >
                <div className="h-1.5 bg-gradient-to-r from-[#6B6A45] via-[#C5A059] to-[#8C8A58] w-full" />
                <div className="p-6 bg-gradient-to-b from-[#F8F7F2] to-white dark:from-[#1C222D] dark:to-[#141820] flex flex-col items-center border-b border-[#E2E0D0] dark:border-[#242936]">
                  <div
                    className={`relative aspect-[4/5] rounded-2xl p-1 bg-gradient-to-tr from-[#6B6A45] via-[#C5A059] to-[#8C8A58] shadow-lg ring-4 ring-[#C5A059]/20 transition-all duration-500 ${
                      isDossierExpanded ? 'w-48' : 'w-40'
                    }`}
                  >
                    <div className="w-full h-full rounded-xl overflow-hidden bg-[#F3F1E6] dark:bg-[#1C222D] relative">
                      {activeScholar.photoUrl ? (
                        <img
                          src={activeScholar.photoUrl}
                          alt={activeScholar.fullName}
                          className="w-full h-full object-cover object-top"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-[#F4F3EC] to-[#E5E3D5] text-[#6B6A45]">
                          <span className="text-3xl font-serif font-bold">{getInitials(activeScholar.fullName)}</span>
                          <User className="w-7 h-7 mt-1.5 opacity-40" />
                        </div>
                      )}
                      <div className="absolute top-2 left-2">
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-[#232215]/85 text-[#F8F7F2] backdrop-blur-xs border border-white/20 shadow-xs font-mono">
                          Batch {activeScholar.batchYear}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-center">
                    <div className="relative inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider bg-gradient-to-r from-[#B58D3D] via-[#DFC076] to-[#B58D3D] bg-[length:200%_100%] animate-scholar-gold-shimmer text-[#1F1B0E] border border-[#F0D999]/90 shadow-[0_3px_10px_rgba(197,160,89,0.35)] overflow-hidden">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#1F1B0E] shrink-0" />
                      <span>Verified Scholar</span>
                    </div>
                  </div>
                </div>

                <div className="p-5 sm:p-6 bg-islamic-diamond-subtle dark:bg-[#141820] space-y-3.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    {(() => {
                      const sInfo = getScholarStatusInfo(activeScholar.academicStatus, activeScholar.customStatusLabel);
                      return (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#6B6A45] dark:bg-[#84CC16] text-[#F8F7F2] dark:text-[#0B0D11] border border-[#8C8A58]/60 dark:border-[#84CC16] shadow-2xs">
                          {sInfo.label}
                        </span>
                      );
                    })()}
                    {activeScholar.classOrDivision && (
                      <span className="text-xs text-slate-500 dark:text-gray-400 font-semibold font-mono">
                        {activeScholar.classOrDivision}
                      </span>
                    )}
                  </div>

                  <h3 className="text-xl font-serif font-bold text-[#232215] dark:text-[#F9FAFB]">
                    {activeScholar.fullName}
                  </h3>

                  {(activeScholar.currentRole || activeScholar.cityCountry) && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-700 dark:text-gray-300">
                      {activeScholar.currentRole && (
                        <div className="flex items-center gap-1 font-semibold text-[#504F34] dark:text-[#84CC16]">
                          <Award className="w-3.5 h-3.5 text-[#8C8A58] dark:text-[#84CC16] shrink-0" />
                          <span>{activeScholar.currentRole}</span>
                        </div>
                      )}
                      {activeScholar.cityCountry && (
                        <div className="flex items-center gap-1 text-slate-600 dark:text-gray-400">
                          <MapPin className="w-3 h-3 text-[#8C8A58] dark:text-[#84CC16] shrink-0" />
                          <span>{activeScholar.cityCountry}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Compact Statement */}
                  {!isDossierExpanded && activeScholar.bio && (
                    <p className="text-xs leading-relaxed text-slate-700 dark:text-[#D1D5DB] italic bg-[#FAF8F2]/90 dark:bg-[#1C222D] p-3 rounded-2xl border border-[#E2E0D0]/80 dark:border-[#242936] line-clamp-3">
                      "{activeScholar.bio}"
                    </p>
                  )}

                  {/* Expanded 4-Side Mobile Body */}
                  {isDossierExpanded && (
                    <div className="space-y-3 pt-1 animate-in fade-in duration-300">
                      {/* Timeline */}
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B6A45] dark:text-[#84CC16] flex items-center gap-1.5">
                          <GraduationCap className="w-3.5 h-3.5 text-[#8C8A58] dark:text-[#84CC16]" />
                          <span>Complete Academic Journey</span>
                        </span>
                        {(() => {
                          const quals =
                            activeScholar.qualificationsList && activeScholar.qualificationsList.length > 0
                              ? activeScholar.qualificationsList
                              : activeScholar.qualification
                              ? [{ degree: activeScholar.qualification, university: activeScholar.university, year: activeScholar.batchYear }]
                              : [];
                          return (
                            <div className="border-l-2 border-[#C5A059]/70 dark:border-[#84CC16]/50 pl-3.5 space-y-2.5 relative ml-1">
                              {quals.map((q, idx) => (
                                <div key={idx} className="relative">
                                  <span
                                    className="absolute -left-[19px] top-1.5 w-2.5 h-2.5 rounded-full bg-[#C5A059] dark:bg-[#84CC16] ring-2 ring-white dark:ring-[#141820] shadow-2xs"
                                    aria-hidden="true"
                                  />
                                  <div className="bg-white/95 dark:bg-[#1C222D] p-2.5 rounded-xl border border-[#E2E0D0] dark:border-[#242936] shadow-2xs flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <h4 className="font-bold text-xs text-[#232215] dark:text-[#F9FAFB] truncate">
                                        {q.degree || 'Degree / Award'}
                                      </h4>
                                      <p className="text-[11px] text-slate-600 dark:text-[#D1D5DB] flex items-center gap-1 mt-0.5 truncate">
                                        <Building2 className="w-3 h-3 text-[#8C8A58] dark:text-[#84CC16] shrink-0" />
                                        <span className="truncate">{q.university || 'University'}</span>
                                      </p>
                                    </div>
                                    {q.year && (
                                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#FAF8F2] dark:bg-[#242936] border border-[#C5A059]/40 dark:border-[#242936] text-[#8C8A58] dark:text-[#84CC16] shrink-0">
                                        {q.year}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </div>

                      {/* Full Bio */}
                      {activeScholar.bio && (
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 block">
                            Scholarly Statement
                          </span>
                          <p className="text-xs leading-relaxed text-slate-700 dark:text-[#D1D5DB] italic bg-[#FAF8F2] dark:bg-[#1C222D] p-3 rounded-xl border border-[#E2E0D0]/80 dark:border-[#242936]">
                            "{activeScholar.bio}"
                          </p>
                        </div>
                      )}

                      {/* Mentorship */}
                      {activeScholar.availableForMentorship && (
                        <div className="p-3 bg-emerald-50/90 dark:bg-emerald-950/30 border border-emerald-200/90 dark:border-emerald-900/50 rounded-xl flex items-start gap-2 text-xs text-emerald-900 dark:text-emerald-300">
                          <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold block text-[11px]">Academic Mentorship</span>
                            <span className="text-emerald-800 dark:text-emerald-300/80 text-[10px] leading-tight block">
                              Open to guide junior students in higher studies.
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Connect Buttons */}
                      {activeScholar.showContactPublicly &&
                        (activeScholar.email || activeScholar.phone || activeScholar.linkedinUrl) && (
                          <div className="pt-2 border-t border-[#E2E0D0]/80 dark:border-[#242936] space-y-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 block">
                              Connect with Scholar
                            </span>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {activeScholar.email && (
                                <a
                                  href={`mailto:${activeScholar.email}`}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#F4F3EC] dark:bg-[#1C222D] hover:bg-[#E2E0D0] dark:hover:bg-[#242936] text-[#232215] dark:text-[#F9FAFB] border border-transparent dark:border-[#242936] rounded-lg text-[11px] font-semibold transition-colors"
                                >
                                  <Mail className="w-3 h-3 text-[#6B6A45] dark:text-[#84CC16]" />
                                  <span>Email</span>
                                </a>
                              )}
                              {activeScholar.phone && (
                                <a
                                  href={`tel:${activeScholar.phone}`}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#F4F3EC] dark:bg-[#1C222D] hover:bg-[#E2E0D0] dark:hover:bg-[#242936] text-[#232215] dark:text-[#F9FAFB] border border-transparent dark:border-[#242936] rounded-lg text-[11px] font-semibold transition-colors"
                                >
                                  <Phone className="w-3 h-3 text-[#6B6A45] dark:text-[#84CC16]" />
                                  <span>Call</span>
                                </a>
                              )}
                              {activeScholar.linkedinUrl && (
                                <a
                                  href={activeScholar.linkedinUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#FAF8F2] dark:bg-[#1C222D] hover:bg-[#F4F3EC] dark:hover:bg-[#242936] text-[#6B6A45] dark:text-[#84CC16] border border-[#C5A059]/40 dark:border-[#242936] rounded-lg text-[11px] font-bold transition-colors"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  <span>LinkedIn</span>
                                </a>
                              )}
                            </div>
                          </div>
                        )}
                    </div>
                  )}

                  {/* Mobile Actions: Smooth Toggle Button */}
                  <div className="pt-3 border-t border-[#E2E0D0]/80 dark:border-[#242936] flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => setIsDossierExpanded((prev) => !prev)}
                      className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        isDossierExpanded
                          ? 'bg-[#504F34] dark:bg-[#242936] hover:bg-[#3D3C27] dark:hover:bg-[#2c3342] text-white dark:text-[#F9FAFB] border border-[#C5A059]/60 dark:border-[#C5A059]/40 ring-2 ring-[#C5A059]/20'
                          : 'bg-[#6B6A45] dark:bg-[#1C222D] hover:bg-[#504F34] dark:hover:bg-[#242936] text-white dark:text-[#F9FAFB] border border-transparent dark:border-[#242936] shadow-xs'
                      }`}
                    >
                      <Award className="w-3.5 h-3.5 text-[#EFEFD0] dark:text-[#84CC16]" />
                      <span>{isDossierExpanded ? 'Collapse Royal Dossier' : 'View Full Royal Dossier'}</span>
                      {isDossierExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5 text-[#DFC076] dark:text-[#84CC16]" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-[#DFC076] dark:text-[#84CC16]" />
                      )}
                    </button>
                    {!isDossierExpanded && activeScholar.availableForMentorship && (
                      <span className="text-xs text-center font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 px-3 py-1 rounded-full flex items-center justify-center gap-1.5 shadow-2xs">
                        <Sparkles className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        <span>Open to Mentor Students</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Mobile Carousel Controls */}
            <div className="flex items-center justify-between pt-4">
              <button
                type="button"
                onClick={handlePrevScholar}
                className="p-2 rounded-xl border border-[#E2E0D0] dark:border-[#242936] bg-white dark:bg-[#1C222D] text-[#6B6A45] dark:text-[#84CC16] cursor-pointer shadow-2xs"
                aria-label="Previous Scholar"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-[200px] px-2 py-1">
                {filteredAlumni.map((s, idx) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setActiveScholarId(s.id);
                      setIsDossierExpanded(false);
                    }}
                    className={`w-7 h-7 rounded-full text-xs font-bold transition-all shrink-0 flex items-center justify-center ${
                      s.id === activeScholarId
                        ? 'bg-[#6B6A45] dark:bg-[#84CC16] text-white dark:text-[#0B0D11] ring-2 ring-[#C5A059] dark:ring-[#84CC16]/50'
                        : 'bg-white dark:bg-[#1C222D] text-slate-600 dark:text-gray-300 border border-[#E2E0D0] dark:border-[#242936]'
                    }`}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleNextScholar}
                className="p-2 rounded-xl border border-[#E2E0D0] dark:border-[#242936] bg-white dark:bg-[#1C222D] text-[#6B6A45] dark:text-[#84CC16] cursor-pointer shadow-2xs"
                aria-label="Next Scholar"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default MadrasaPublicAlumni;
