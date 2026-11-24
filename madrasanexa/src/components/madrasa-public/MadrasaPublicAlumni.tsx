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
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
  User,
} from 'lucide-react';
import type { MadrasaThemeTokens } from '../../services/api';
import {
  getPublicAlumni,
  type AlumniScholarItem,
  getScholarStatusInfo,
} from '../../services/scholar-alumni.service';
import { Pagination } from '../common/Pagination';

interface MadrasaPublicAlumniProps {
  madrasaCode: string;
  madrasaName: string;
  theme: MadrasaThemeTokens;
}

export const MadrasaPublicAlumni: React.FC<MadrasaPublicAlumniProps> = ({
  madrasaCode,
  madrasaName,
  theme,
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

  // Pagination state
  const [page, setPage] = useState<number>(1);
  const pageSize = 9;

  // Spotlight Stage carousel state
  const [spotlightIndex, setSpotlightIndex] = useState(0);
  const [isSpotlightPaused, setIsSpotlightPaused] = useState(false);

  // Royal Scholar Dossier Modal state
  const [dossierScholar, setDossierScholar] = useState<AlumniScholarItem | null>(null);

  // Expanded qualifications map for directory cards
  const [expandedQualMap, setExpandedQualMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setPage(1);
  }, [selectedBatch, selectedClass, selectedStatus, searchQuery]);

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

  const paginatedAlumni = filteredAlumni.slice((page - 1) * pageSize, page * pageSize);

  // Spotlight Scholars Pool: Prioritize featured scholars or all alumni
  const spotlightPool = alumni.length > 0 ? (alumni.some((a) => a.isFeatured) ? alumni.filter((a) => a.isFeatured) : alumni) : [];
  const activeSpotlight = spotlightPool[spotlightIndex % (spotlightPool.length || 1)] || null;

  // Auto-advance spotlight carousel every 6s when > 1 scholar exists and not paused
  useEffect(() => {
    if (spotlightPool.length <= 1 || isSpotlightPaused) return;
    const interval = setInterval(() => {
      setSpotlightIndex((prev) => (prev + 1) % spotlightPool.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [spotlightPool.length, isSpotlightPaused]);

  // Keyboard navigation for Dossier Modal (Esc to close)
  useEffect(() => {
    if (!dossierScholar) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDossierScholar(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dossierScholar]);

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
      aria-label="Alumni & Scholars Dossier Wall"
    >
      {/* Keyframes for Staggered Reveal, Shimmer, and Sheen */}
      <style>{`
        @keyframes scholarCardReveal {
          from {
            opacity: 0;
            transform: translateY(18px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
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
        .animate-scholar-reveal {
          animation: scholarCardReveal 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
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
      <div className="mb-10 pb-6 border-b border-[#E2E0D0] text-center sm:text-left">
        <div className="max-w-3xl">
          <div className="inline-flex items-center space-x-2 text-xs font-bold uppercase tracking-wider mb-2.5 px-3.5 py-1 rounded-full bg-[#F4F3EC] border border-[#E2E0D0] text-[#6B6A45] shadow-2xs">
            <GraduationCap className="w-3.5 h-3.5 text-[#6B6A45]" />
            <span>Regal Scholars Dossier</span>
          </div>
          <h2
            className="text-2xl sm:text-3xl lg:text-4xl font-serif font-bold tracking-tight text-[#232215]"
            style={{ color: theme.headingColor || '#232215' }}
          >
            Scholarly Alumni & Graduates
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
            Celebrating {madrasaName} graduates pursuing sacred knowledge, higher academic degrees, and community leadership worldwide.
          </p>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. FEATURED INTERACTIVE SCHOLAR SPOTLIGHT STAGE (Top Showcase)            */}
      {/* ========================================================================= */}
      {activeSpotlight && (
        <div
          className="max-w-5xl mx-auto rounded-3xl bg-white border border-[#D8D5C0] shadow-xl overflow-hidden mb-12 sm:mb-16 relative"
          onMouseEnter={() => setIsSpotlightPaused(true)}
          onMouseLeave={() => setIsSpotlightPaused(false)}
        >
          {/* Top Olive-Gold Gradient Accent Bar */}
          <div className="h-1.5 bg-gradient-to-r from-[#6B6A45] via-[#C5A059] to-[#8C8A58] w-full" />

          <div className="grid grid-cols-1 md:grid-cols-12 items-stretch">
            {/* Left Pane: Tall Gold-Bordered Portrait with Shimmer Halo */}
            <div className="md:col-span-5 lg:col-span-4 p-6 sm:p-7 bg-gradient-to-b from-[#F8F7F2] to-white flex flex-col items-center justify-between border-b md:border-b-0 md:border-r border-[#E2E0D0] relative">
              {/* Portrait Frame */}
              <div className="relative w-full max-w-[240px] aspect-[4/5] rounded-2xl p-1 bg-gradient-to-tr from-[#6B6A45] via-[#C5A059] to-[#8C8A58] shadow-lg ring-4 ring-[#C5A059]/20">
                <div className="w-full h-full rounded-xl overflow-hidden bg-[#F3F1E6] relative">
                  {activeSpotlight.photoUrl ? (
                    <img
                      src={activeSpotlight.photoUrl}
                      alt={activeSpotlight.fullName}
                      className="w-full h-full object-cover object-top transition-transform duration-700 hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-[#F4F3EC] to-[#E5E3D5] text-[#6B6A45]">
                      <span className="text-4xl font-serif font-bold">{getInitials(activeSpotlight.fullName)}</span>
                      <User className="w-8 h-8 mt-2 opacity-40" />
                    </div>
                  )}

                  {/* Batch Year Badge Overlay */}
                  <div className="absolute top-2.5 left-2.5">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#232215]/85 text-[#F8F7F2] backdrop-blur-xs border border-white/20 shadow-xs font-mono">
                      Batch {activeSpotlight.batchYear}
                    </span>
                  </div>
                </div>
              </div>

              {/* Animated Antique Gold "VERIFIED SCHOLAR" Seal */}
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

              {/* Multi-Scholar Carousel Controls */}
              {spotlightPool.length > 1 && (
                <div className="w-full flex items-center justify-between pt-4 mt-4 border-t border-[#E2E0D0]/80">
                  <button
                    type="button"
                    onClick={() =>
                      setSpotlightIndex((prev) => (prev - 1 + spotlightPool.length) % spotlightPool.length)
                    }
                    className="p-1.5 rounded-xl border border-[#E2E0D0] bg-white hover:bg-[#F4F3EC] text-[#6B6A45] transition-all cursor-pointer shadow-2xs"
                    title="Previous Scholar"
                    aria-label="Previous Scholar"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  {/* Clickable Scholar Avatar Pills */}
                  <div className="flex items-center gap-1.5 max-w-[150px] overflow-x-auto no-scrollbar py-1">
                    {spotlightPool.map((s, idx) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSpotlightIndex(idx)}
                        className={`w-6 h-6 rounded-full text-[10px] font-bold transition-all cursor-pointer flex items-center justify-center shrink-0 ${
                          idx === spotlightIndex % spotlightPool.length
                            ? 'bg-[#6B6A45] text-white ring-2 ring-[#C5A059] scale-110 shadow-xs'
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
                    onClick={() => setSpotlightIndex((prev) => (prev + 1) % spotlightPool.length)}
                    className="p-1.5 rounded-xl border border-[#E2E0D0] bg-white hover:bg-[#F4F3EC] text-[#6B6A45] transition-all cursor-pointer shadow-2xs"
                    title="Next Scholar"
                    aria-label="Next Scholar"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Right Pane: Scholar Details & Animated Gold Academic Journey Track */}
            <div className="md:col-span-7 lg:col-span-8 p-6 sm:p-8 flex flex-col justify-between bg-islamic-diamond-subtle relative">
              <div className="space-y-4">
                {/* Header Badge & Islamic Title */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-[#FAF8F2] text-[#8C8A58] border border-[#C5A059]/40 shadow-2xs flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-[#C5A059]" />
                      <span>Distinguished Scholar Spotlight</span>
                    </span>
                    {(() => {
                      const sInfo = getScholarStatusInfo(activeSpotlight.academicStatus, activeSpotlight.customStatusLabel);
                      return (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#6B6A45] text-[#F8F7F2] border border-[#8C8A58]/60 shadow-2xs">
                          {sInfo.label}
                        </span>
                      );
                    })()}
                  </div>

                  {activeSpotlight.classOrDivision && (
                    <span className="text-xs text-slate-500 font-semibold font-mono">
                      {activeSpotlight.classOrDivision}
                    </span>
                  )}
                </div>

                {/* Scholar Full Name */}
                <h3 className="text-2xl sm:text-3xl font-serif font-bold text-[#232215] tracking-tight">
                  {activeSpotlight.fullName}
                </h3>

                {/* Role & Location */}
                {(activeSpotlight.currentRole || activeSpotlight.cityCountry) && (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs sm:text-sm text-slate-700">
                    {activeSpotlight.currentRole && (
                      <div className="flex items-center gap-1.5 font-semibold text-[#504F34]">
                        <Award className="w-4 h-4 text-[#8C8A58] shrink-0" />
                        <span>{activeSpotlight.currentRole}</span>
                      </div>
                    )}
                    {activeSpotlight.cityCountry && (
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <MapPin className="w-3.5 h-3.5 text-[#8C8A58] shrink-0" />
                        <span>{activeSpotlight.cityCountry}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Biography Quote */}
                {activeSpotlight.bio && (
                  <p className="text-xs sm:text-sm leading-relaxed text-slate-700 italic bg-[#FAF8F2]/90 p-3.5 rounded-2xl border border-[#E2E0D0]/80">
                    "{activeSpotlight.bio}"
                  </p>
                )}

                {/* Animated Gold Academic Journey Track */}
                <div className="pt-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#6B6A45] mb-2.5 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-[#8C8A58]" />
                    <span>Academic Progression Track</span>
                  </div>

                  {(() => {
                    const spotlightQuals =
                      activeSpotlight.qualificationsList && activeSpotlight.qualificationsList.length > 0
                        ? activeSpotlight.qualificationsList
                        : activeSpotlight.qualification
                        ? [{ degree: activeSpotlight.qualification, university: activeSpotlight.university, year: activeSpotlight.batchYear }]
                        : [];

                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        {spotlightQuals.map((q, idx) => (
                          <div
                            key={idx}
                            className="bg-white/95 rounded-2xl p-3 border border-[#E2E0D0] shadow-2xs hover:border-[#C5A059] transition-all duration-300"
                          >
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="w-5 h-5 rounded-full bg-[#F4F3EC] text-[#6B6A45] text-[10px] font-bold flex items-center justify-center shrink-0 border border-[#E2E0D0]">
                                {idx + 1}
                              </span>
                              {q.year && (
                                <span className="text-[10px] font-mono font-bold text-[#8C8A58]">
                                  {q.year}
                                </span>
                              )}
                            </div>
                            <h4 className="font-bold text-xs sm:text-sm text-[#232215] line-clamp-1">
                              {q.degree || 'Degree / Award'}
                            </h4>
                            <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                              {q.university || 'University / Academy'}
                            </p>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Spotlight Bottom Actions */}
              <div className="pt-5 mt-4 border-t border-[#E2E0D0]/80 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setDossierScholar(activeSpotlight)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[#6B6A45] hover:bg-[#504F34] text-white shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <Award className="w-3.5 h-3.5 text-[#EFEFD0]" />
                  <span>View Full Royal Dossier</span>
                </button>

                {activeSpotlight.availableForMentorship && (
                  <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full inline-flex items-center gap-1.5 shadow-2xs">
                    <Sparkles className="w-3 h-3 text-emerald-600" />
                    <span>Open to Mentor Students</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. REGAL FILTER STRIP                                                     */}
      {/* ========================================================================= */}
      <div className="bg-[#F8F7F2] border border-[#E2E0D0] rounded-3xl p-4 sm:p-5 mb-8 space-y-4 shadow-xs">
        {/* Row 1: Full-Width Search Input */}
        <div className="relative w-full">
          <Search className="w-4 h-4 text-[#8C8A58] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search scholar name, degree, university, role, or location..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#E2E0D0] rounded-2xl text-xs sm:text-sm text-[#232215] placeholder-stone-400 focus:outline-hidden focus:ring-2 focus:ring-[#6B6A45]/30 shadow-2xs"
          />
        </div>

        {/* Row 2: Status Crest Pills */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <span className="font-semibold text-slate-600 text-xs mr-1 flex items-center gap-1 shrink-0">
            <Filter className="w-3 h-3 text-[#8C8A58]" />
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
                  ? 'bg-[#6B6A45] text-white shadow-2xs font-bold border border-[#504F34]'
                  : 'bg-white text-slate-700 hover:bg-[#F4F3EC] border border-[#E2E0D0] font-medium'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>

        {/* Row 3: Responsive Grid for Batch, Class/Division & Result Counter */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 sm:gap-3 items-end pt-3 border-t border-[#E2E0D0]/80">
          <div className="lg:col-span-4 space-y-1">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
              BATCH YEAR
            </label>
            <select
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-[#E2E0D0] bg-white text-xs sm:text-sm text-slate-800 focus:outline-hidden"
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
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
              CLASS / DIVISION
            </label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-[#E2E0D0] bg-white text-xs sm:text-sm text-slate-800 focus:outline-hidden"
            >
              <option value="ALL">All Classes & Divisions</option>
              {classOrDivisions.map((cd) => (
                <option key={cd} value={cd}>
                  {cd}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-3 text-xs font-medium text-slate-500 lg:text-right pb-2">
            Showing <strong className="text-slate-800">{filteredAlumni.length}</strong> of{' '}
            <strong className="text-slate-800">{alumni.length}</strong> scholars
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. INTERACTIVE DIRECTORY GRID BELOW (Centered for 1 or 2 scholars)        */}
      {/* ========================================================================= */}
      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#6B6A45] mb-3" />
          <p className="text-xs text-slate-600 font-medium">Loading scholarly alumni profiles...</p>
        </div>
      ) : error ? (
        <div className="p-8 text-center bg-white border border-[#E2E0D0] rounded-3xl text-xs text-slate-600">
          {error}
        </div>
      ) : filteredAlumni.length === 0 ? (
        <div className="p-12 text-center bg-white border border-[#E2E0D0] rounded-3xl space-y-3">
          <GraduationCap className="w-10 h-10 mx-auto text-[#8C8A58]/50" />
          <h4 className="text-base font-serif font-bold text-[#232215]">No Profiles Match Selection</h4>
          <p className="text-xs text-slate-600 max-w-sm mx-auto">
            Try adjusting your search query or selecting a different batch/status filter above.
          </p>
        </div>
      ) : (
        <>
          <div
            className={`w-full ${
              filteredAlumni.length === 1
                ? 'max-w-xl mx-auto'
                : filteredAlumni.length === 2
                ? 'max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6'
                : 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6'
            } items-start`}
          >
            {paginatedAlumni.map((item, index) => {
              const initials = getInitials(item.fullName);

              const qualList =
                item.qualificationsList && item.qualificationsList.length > 0
                  ? item.qualificationsList.filter((q) => q.degree?.trim() || q.university?.trim())
                  : item.qualification || item.university
                  ? [{ degree: item.qualification, university: item.university, year: item.batchYear }]
                  : [];

              const isQualExpanded = Boolean(expandedQualMap[item.id]);
              const displayedQuals = isQualExpanded ? qualList : qualList.slice(0, 2);
              const hasMoreQuals = qualList.length > 2;

              const sInfo = getScholarStatusInfo(item.academicStatus, item.customStatusLabel);

              return (
                <div
                  key={`${item.id}-${selectedBatch}-${selectedStatus}-${page}`}
                  onClick={() => setDossierScholar(item)}
                  className="group relative bg-white rounded-3xl border border-[#E2E0D0] overflow-hidden flex flex-col shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_14px_34px_rgba(107,106,69,0.14)] hover:border-[#C5A059]/70 animate-scholar-reveal cursor-pointer"
                  style={{ animationDelay: `${(index % pageSize) * 60}ms` }}
                >
                  {/* Top Olive-Gold Accent Bar */}
                  <div className="h-1 bg-gradient-to-r from-[#6B6A45] via-[#C5A059] to-[#8C8A58] w-full" />

                  {/* Header Band with Subtle Islamic Diamond Pattern */}
                  <div className="p-4 sm:p-5 pb-4 border-b border-[#E2E0D0] bg-islamic-diamond-subtle relative">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {/* Double Gold-Accented Portrait Frame */}
                        <div className="p-0.5 rounded-full bg-gradient-to-tr from-[#6B6A45] via-[#C5A059] to-[#8C8A58] shadow-sm shrink-0">
                          <div className="p-0.5 rounded-full bg-white">
                            {item.photoUrl ? (
                              <img
                                src={item.photoUrl}
                                alt={item.fullName}
                                loading="lazy"
                                className="w-13 h-13 sm:w-14 sm:h-14 rounded-full object-cover object-top border border-[#C5A059]/40"
                              />
                            ) : (
                              <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-full flex items-center justify-center text-white font-serif font-bold text-base sm:text-lg border border-[#C5A059]/40 bg-gradient-to-br from-[#6B6A45] to-[#504F34]">
                                {initials}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Scholar Name & Batch */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#FAF8F2] text-[#504F34] border border-[#C5A059]/40">
                              Batch {item.batchYear}
                            </span>
                            {/* Cohesive Institutional Olive-Gold Crest Pill */}
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#6B6A45] text-[#F8F7F2] border border-[#8C8A58]/60 shadow-2xs">
                              {sInfo.label}
                            </span>
                            {item.isFeatured && (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-300 flex items-center gap-0.5">
                                <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                                Featured
                              </span>
                            )}
                          </div>

                          <h3
                            className="font-serif font-bold text-base sm:text-lg text-[#232215] mt-1 line-clamp-1 tracking-tight group-hover:text-[#6B6A45] transition-colors"
                            style={{ color: theme.headingColor || '#232215' }}
                          >
                            {item.fullName}
                          </h3>

                          {item.classOrDivision && (
                            <p className="text-[11px] text-slate-500 line-clamp-1 font-medium">
                              {item.classOrDivision}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Animated Antique Gold Shimmer Verified Scholar Seal */}
                      <div
                        className="relative inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-gradient-to-r from-[#B58D3D] via-[#DFC076] to-[#B58D3D] bg-[length:200%_100%] animate-scholar-gold-shimmer text-[#1F1B0E] border border-[#F0D999]/80 shadow-[0_2px_8px_rgba(197,160,89,0.35)] overflow-hidden shrink-0"
                        title="Verified Madrasa Scholar & Alumnus"
                      >
                        <span
                          className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/50 to-transparent pointer-events-none animate-scholar-gold-sheen"
                          aria-hidden="true"
                        />
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#1F1B0E] shrink-0 relative z-10" />
                        <span className="relative z-10 hidden sm:inline">Verified</span>
                      </div>
                    </div>
                  </div>

                  {/* Core Body Content */}
                  <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div className="space-y-3.5 text-xs text-[#232215]">
                      {/* Expandable Vertical Gold Academic Timeline */}
                      {qualList.length > 0 && (
                        <div className="space-y-2">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-[#6B6A45] flex items-center gap-1.5">
                            <GraduationCap className="w-3.5 h-3.5 text-[#8C8A58]" />
                            <span>Academic Qualifications</span>
                          </div>

                          {/* Vertical Antique-Gold Timeline Thread */}
                          <div className="border-l-2 border-[#C5A059]/45 pl-3.5 space-y-2.5 relative ml-1.5 pt-1">
                            {displayedQuals.map((q, qIdx) => (
                              <div key={qIdx} className="relative group/qual">
                                {/* Gold Milestone Dot */}
                                <span
                                  className="absolute -left-[19px] top-1.5 w-2.5 h-2.5 rounded-full bg-[#C5A059] ring-2 ring-white shadow-2xs group-hover/qual:scale-125 transition-transform"
                                  aria-hidden="true"
                                />

                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm text-[#232215] leading-snug">
                                      <BookOpen className="w-3 h-3 text-[#8C8A58] shrink-0 mt-0.5" />
                                      <span className="line-clamp-1">{q.degree || 'Degree / Qualification'}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs text-slate-600 pl-4 mt-0.5">
                                      <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                                      <span className="line-clamp-1">{q.university || 'University / Institution'}</span>
                                    </div>
                                  </div>
                                  {q.year && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FAF8F2] border border-[#C5A059]/40 text-[#8C8A58] shrink-0 shadow-2xs font-mono">
                                      {q.year}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Expand/Collapse Toggle if > 2 qualifications */}
                          {hasMoreQuals && (
                            <div className="pl-4 pt-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedQualMap((prev) => ({ ...prev, [item.id]: !prev[item.id] }));
                                }}
                                className="text-[11px] font-bold text-[#6B6A45] hover:text-[#504F34] inline-flex items-center gap-1 cursor-pointer transition-colors"
                              >
                                <span>{isQualExpanded ? 'Show Less' : `+ Show All ${qualList.length} Qualifications`}</span>
                                <ChevronDown
                                  className={`w-3.5 h-3.5 transition-transform duration-300 ${
                                    isQualExpanded ? 'rotate-180' : ''
                                  }`}
                                />
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Current Role & Location */}
                      {(item.currentRole || item.cityCountry) && (
                        <div className="pt-2 space-y-1.5 border-t border-[#E2E0D0]/70">
                          {item.currentRole && (
                            <div className="flex items-start gap-2 text-slate-600">
                              <Award className="w-3.5 h-3.5 text-[#8C8A58] shrink-0 mt-0.5" />
                              <div>
                                <span className="font-bold text-[#232215]">Role: </span>
                                <span>{item.currentRole}</span>
                              </div>
                            </div>
                          )}
                          {item.cityCountry && (
                            <div className="flex items-center gap-2 text-slate-500 text-[11px]">
                              <MapPin className="w-3.5 h-3.5 text-[#8C8A58] shrink-0" />
                              <span>{item.cityCountry}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Card Footer: View Dossier Trigger & Mentorship Badge */}
                    <div className="pt-2 border-t border-[#E2E0D0]/70 flex items-center justify-between text-xs">
                      {item.availableForMentorship ? (
                        <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 shadow-2xs">
                          <Sparkles className="w-2.5 h-2.5 text-emerald-600" />
                          Open to Mentor
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">
                          {item.classOrDivision || 'Alumnus'}
                        </span>
                      )}

                      <span className="text-xs font-bold text-[#6B6A45] group-hover:text-[#504F34] flex items-center gap-1">
                        <span>View Dossier</span>
                        <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <Pagination
            currentPage={page}
            totalItems={filteredAlumni.length}
            pageSize={pageSize}
            onPageChange={setPage}
            itemLabel="scholars"
            className="mt-8 rounded-2xl border border-[#E2E0D0] shadow-2xs"
          />
        </>
      )}

      {/* ========================================================================= */}
      {/* 4. ROYAL SCHOLAR DOSSIER MODAL                                            */}
      {/* ========================================================================= */}
      {dossierScholar && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/75 backdrop-blur-xs overflow-y-auto"
          role="dialog"
          aria-modal="true"
          onClick={() => setDossierScholar(null)}
        >
          <div
            className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-[#D8D5C0] overflow-hidden my-auto animate-scholar-reveal"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Olive-Gold Accent Bar */}
            <div className="h-1.5 bg-gradient-to-r from-[#6B6A45] via-[#C5A059] to-[#8C8A58] w-full" />

            {/* Modal Header */}
            <div className="p-6 sm:p-7 border-b border-[#E2E0D0] bg-islamic-diamond-subtle flex items-start justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="p-1 rounded-full bg-gradient-to-tr from-[#6B6A45] via-[#C5A059] to-[#8C8A58] shadow-md shrink-0">
                  <div className="p-0.5 rounded-full bg-white">
                    {dossierScholar.photoUrl ? (
                      <img
                        src={dossierScholar.photoUrl}
                        alt={dossierScholar.fullName}
                        className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover object-top border border-[#C5A059]/40"
                      />
                    ) : (
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center text-white font-serif font-bold text-xl sm:text-2xl border border-[#C5A059]/40 bg-gradient-to-br from-[#6B6A45] to-[#504F34]">
                        {getInitials(dossierScholar.fullName)}
                      </div>
                    )}
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#FAF8F2] text-[#504F34] border border-[#C5A059]/40">
                      Batch {dossierScholar.batchYear}
                    </span>
                    {(() => {
                      const sInfo = getScholarStatusInfo(dossierScholar.academicStatus, dossierScholar.customStatusLabel);
                      return (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#6B6A45] text-[#F8F7F2] border border-[#8C8A58]/60 shadow-2xs">
                          {sInfo.label}
                        </span>
                      );
                    })()}
                  </div>

                  <h3 className="text-xl sm:text-2xl font-serif font-bold text-[#232215] mt-1 tracking-tight">
                    {dossierScholar.fullName}
                  </h3>

                  {dossierScholar.currentRole && (
                    <p className="text-xs sm:text-sm font-semibold text-[#6B6A45] mt-0.5 flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5 text-[#8C8A58]" />
                      <span>{dossierScholar.currentRole}</span>
                    </p>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setDossierScholar(null)}
                className="p-2 text-stone-400 hover:text-stone-700 hover:bg-[#F4F3EC] rounded-xl transition-colors cursor-pointer"
                aria-label="Close dossier dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 sm:p-7 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Biography Quote */}
              {dossierScholar.bio && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Scholarly Statement
                  </span>
                  <p className="text-xs sm:text-sm leading-relaxed text-slate-700 italic bg-[#FAF8F2] p-4 rounded-2xl border border-[#E2E0D0]/80 whitespace-pre-line">
                    "{dossierScholar.bio}"
                  </p>
                </div>
              )}

              {/* Complete Academic Timeline */}
              {(() => {
                const modalQuals =
                  dossierScholar.qualificationsList && dossierScholar.qualificationsList.length > 0
                    ? dossierScholar.qualificationsList
                    : dossierScholar.qualification
                    ? [{ degree: dossierScholar.qualification, university: dossierScholar.university, year: dossierScholar.batchYear }]
                    : [];

                if (modalQuals.length === 0) return null;

                return (
                  <div className="space-y-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B6A45] flex items-center gap-1.5">
                      <GraduationCap className="w-3.5 h-3.5 text-[#8C8A58]" />
                      <span>Complete Academic Journey</span>
                    </span>

                    <div className="border-l-2 border-[#C5A059]/60 pl-4 space-y-3.5 relative ml-2">
                      {modalQuals.map((q, idx) => (
                        <div key={idx} className="relative">
                          <span
                            className="absolute -left-[22px] top-1.5 w-3 h-3 rounded-full bg-[#C5A059] ring-4 ring-white shadow-xs"
                            aria-hidden="true"
                          />
                          <div className="bg-[#F8F7F2] p-3 rounded-2xl border border-[#E2E0D0] flex items-start justify-between gap-3">
                            <div>
                              <h4 className="font-bold text-xs sm:text-sm text-[#232215]">
                                {q.degree || 'Degree / Award'}
                              </h4>
                              <p className="text-xs text-slate-600 flex items-center gap-1.5 mt-0.5">
                                <Building2 className="w-3 h-3 text-[#8C8A58]" />
                                <span>{q.university || 'University / Institution'}</span>
                              </p>
                            </div>
                            {q.year && (
                              <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-white border border-[#C5A059]/40 text-[#8C8A58] shadow-2xs">
                                {q.year}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Mentorship Box */}
              {dossierScholar.availableForMentorship && (
                <div className="p-4 bg-emerald-50/90 border border-emerald-200/90 rounded-2xl flex items-start gap-3 text-xs text-emerald-900">
                  <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Open for Academic Guidance & Mentorship</span>
                    <span className="text-emerald-800 text-[11px] mt-0.5 block">
                      This scholar is open to guide junior students and prospective researchers in academic pathways, university applications, and sacred scholarship.
                    </span>
                  </div>
                </div>
              )}

              {/* Public Contact Channels */}
              {dossierScholar.showContactPublicly && (dossierScholar.email || dossierScholar.phone || dossierScholar.linkedinUrl) && (
                <div className="pt-4 border-t border-[#E2E0D0] space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Connect with Scholar
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    {dossierScholar.email && (
                      <a
                        href={`mailto:${dossierScholar.email}`}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#F4F3EC] hover:bg-[#E2E0D0] text-[#232215] rounded-xl text-xs font-semibold transition-colors"
                      >
                        <Mail className="w-3.5 h-3.5 text-[#6B6A45]" />
                        <span>{dossierScholar.email}</span>
                      </a>
                    )}
                    {dossierScholar.phone && (
                      <a
                        href={`tel:${dossierScholar.phone}`}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#F4F3EC] hover:bg-[#E2E0D0] text-[#232215] rounded-xl text-xs font-semibold transition-colors"
                      >
                        <Phone className="w-3.5 h-3.5 text-[#6B6A45]" />
                        <span>{dossierScholar.phone}</span>
                      </a>
                    )}
                    {dossierScholar.linkedinUrl && (
                      <a
                        href={dossierScholar.linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#FAF8F2] hover:bg-[#F4F3EC] text-[#6B6A45] border border-[#C5A059]/40 rounded-xl text-xs font-bold transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>LinkedIn Profile</span>
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 bg-[#FAF9F5] border-t border-[#E2E0D0] flex items-center justify-end">
              <button
                type="button"
                onClick={() => setDossierScholar(null)}
                className="px-5 py-2 border border-[#E2E0D0] text-slate-700 hover:text-slate-900 rounded-xl text-xs font-bold hover:bg-white transition-colors cursor-pointer"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default MadrasaPublicAlumni;
