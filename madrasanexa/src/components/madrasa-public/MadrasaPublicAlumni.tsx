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
  X,
  Mail,
  Phone,
  Filter,
  Loader2,
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

  // Selected profile for Detail Modal
  const [activeModalProfile, setActiveModalProfile] = useState<AlumniScholarItem | null>(null);

  const primaryColor = theme.primaryBtnBg || '#85845C';

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

  return (
    <section id="alumni" className="public-section-enter scroll-mt-28" aria-label="Alumni & Scholars">
      {/* Section Header */}
      <div className="mb-10 pb-6 border-b border-[#E5E5DF]">
        <div className="max-w-3xl">
          <div className="inline-flex items-center space-x-2 text-xs font-bold uppercase tracking-wider mb-2.5 px-3 py-1 rounded-full bg-[#F5F5F1] border border-[#E5E5DF] text-[#85845C]">
            <GraduationCap className="w-3.5 h-3.5" style={{ color: primaryColor }} />
            <span>Undergraduate & Alumni Hub</span>
          </div>
          <h2
            className="text-2xl sm:text-3xl lg:text-4xl font-serif font-bold tracking-tight text-[#252525]"
            style={{ color: theme.headingColor || '#252525' }}
          >
            Scholarly Alumni & Graduates
          </h2>
          <p className="mt-2 text-sm text-[#666666] leading-relaxed">
            Celebrating {madrasaName} students pursuing higher academic degrees, research, and leadership roles across universities and communities worldwide.
          </p>
        </div>
      </div>

      {/* Filter Strip */}
      <div className="bg-[#F5F5F1]/70 border border-[#E5E5DF] rounded-2xl p-4 sm:p-5 mb-8 space-y-4">
        {/* Row 1: Full-Width Search Input */}
        <div className="relative w-full">
          <Search className="w-4 h-4 text-[#85845C] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by scholar name, degree, university, role or location..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#E5E5DF] rounded-xl text-xs sm:text-sm text-[#252525] focus:outline-hidden focus:ring-2 focus:ring-[#85845C]/30 shadow-2xs"
          />
        </div>

        {/* Row 2: Status Pills */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <span className="font-semibold text-[#666666] text-xs mr-1 flex items-center gap-1 shrink-0">
            <Filter className="w-3 h-3 text-[#85845C]" />
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
              className={`h-8 px-3 text-xs font-medium rounded-full transition-all cursor-pointer flex items-center justify-center shrink-0 ${
                selectedStatus === st.id
                  ? 'bg-[#252525] text-white shadow-2xs font-semibold'
                  : 'bg-white text-[#666666] hover:bg-[#E5E5DF]/60 border border-[#E5E5DF]'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>

        {/* Row 3: Responsive Grid for Batch, Class/Division & Result Counter */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 sm:gap-3 items-end pt-3 border-t border-slate-100">
          <div className="lg:col-span-4 space-y-1">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
              BATCH YEAR
            </label>
            <select
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm text-slate-800 focus:outline-hidden"
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
              className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm text-slate-800 focus:outline-hidden"
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

      {/* Directory Grid */}
      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#85845C] mb-3" />
          <p className="text-xs text-[#666666]">Loading scholarly alumni profiles...</p>
        </div>
      ) : error ? (
        <div className="p-8 text-center bg-white border border-[#E5E5DF] rounded-2xl text-xs text-[#666666]">
          {error}
        </div>
      ) : filteredAlumni.length === 0 ? (
        <div className="p-12 text-center bg-white border border-[#E5E5DF] rounded-2xl space-y-3">
          <GraduationCap className="w-10 h-10 mx-auto text-[#85845C]/50" />
          <h4 className="text-base font-serif font-bold text-[#252525]">No Profiles Match Selection</h4>
          <p className="text-xs text-[#666666] max-w-sm mx-auto">
            Try adjusting your search criteria or batch/status filter above.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAlumni.map((item) => {
            const initials = item.fullName
              .split(' ')
              .filter(Boolean)
              .slice(0, 2)
              .map((w) => w[0]?.toUpperCase())
              .join('');

            return (
              <div
                key={item.id}
                className="group bg-white rounded-2xl border border-[#E5E5DF] overflow-hidden flex flex-col transition-all duration-300 hover:shadow-lg hover:border-[#85845C]/50 hover:-translate-y-1 shadow-xs"
              >
                {/* Header Band */}
                <div className="p-5 pb-4 border-b border-[#E5E5DF]/60 bg-gradient-to-b from-[#F5F5F1]/40 to-transparent">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {item.photoUrl ? (
                        <img
                          src={item.photoUrl}
                          alt={item.fullName}
                          className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-xs shrink-0"
                        />
                      ) : (
                        <div
                          className="w-14 h-14 rounded-full flex items-center justify-center text-white font-serif font-bold text-lg border-2 border-white shadow-xs shrink-0"
                          style={{ backgroundColor: primaryColor }}
                        >
                          {initials}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#F5F5F1] text-[#252525] border border-[#E5E5DF]">
                            Batch {item.batchYear}
                          </span>
                          {(() => {
                            const sInfo = getScholarStatusInfo(item.academicStatus, item.customStatusLabel);
                            return (
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${sInfo.className}`}>
                                {sInfo.label}
                              </span>
                            );
                          })()}
                          {item.isFeatured && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-0.5">
                              <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                              Featured
                            </span>
                          )}
                        </div>
                        <h3 className="font-serif font-bold text-sm sm:text-base text-[#252525] mt-1 line-clamp-1">
                          {item.fullName}
                        </h3>
                        {item.classOrDivision && (
                          <p className="text-[11px] text-[#666666] line-clamp-1">
                            {item.classOrDivision}
                          </p>
                        )}
                      </div>
                    </div>

                    <span
                      className="p-1 rounded-full text-emerald-600 bg-emerald-50 border border-emerald-200 shrink-0"
                      title="Verified Madrasa Scholar"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </span>
                  </div>
                </div>

                {/* Body Content */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-2.5 text-xs text-[#252525]">
                    <div className="flex items-start gap-2">
                      <BookOpen className="w-3.5 h-3.5 text-[#85845C] shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold">{item.qualification}</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-2 text-[#666666]">
                      <Building2 className="w-3.5 h-3.5 text-[#85845C] shrink-0 mt-0.5" />
                      <div>
                        <span>{item.university}</span>
                        {item.facultyOrDepartment && (
                          <span className="text-[11px] block text-[#666666]">
                            {item.facultyOrDepartment}
                          </span>
                        )}
                      </div>
                    </div>

                    {item.qualificationsList && item.qualificationsList.length > 1 && (
                      <div className="pt-0.5">
                        <span className="inline-flex items-center text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">
                          +{item.qualificationsList.length - 1} more qualification{item.qualificationsList.length - 1 > 1 ? 's' : ''}
                        </span>
                      </div>
                    )}

                    {item.currentRole && (
                      <div className="flex items-start gap-2 text-[#666666]">
                        <Award className="w-3.5 h-3.5 text-[#85845C] shrink-0 mt-0.5" />
                        <span>{item.currentRole}</span>
                      </div>
                    )}

                    {item.cityCountry && (
                      <div className="flex items-center gap-2 text-[#666666] text-[11px]">
                        <MapPin className="w-3 h-3 text-[#85845C] shrink-0" />
                        <span>{item.cityCountry}</span>
                      </div>
                    )}
                  </div>

                  {/* Badges & Actions */}
                  <div className="pt-3 border-t border-[#E5E5DF]/70 flex items-center justify-between gap-2">
                    {item.availableForMentorship ? (
                      <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5 text-emerald-600" />
                        Open to Mentor
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium text-[#666666]">
                        {item.academicStatus.replace('_', ' ')}
                      </span>
                    )}

                    <button
                      onClick={() => setActiveModalProfile(item)}
                      className="px-3 py-1 text-xs font-semibold rounded-lg text-[#252525] bg-[#F5F5F1] hover:bg-[#E5E5DF] transition cursor-pointer"
                    >
                      View Profile
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Profile Detail Modal */}
      {activeModalProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-[#E5E5DF] shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-5 border-b border-[#E5E5DF] flex items-center justify-between bg-[#F5F5F1]/50">
              <div className="flex items-center gap-3">
                {activeModalProfile.photoUrl ? (
                  <img
                    src={activeModalProfile.photoUrl}
                    alt={activeModalProfile.fullName}
                    className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-xs"
                  />
                ) : (
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white font-serif font-bold text-base"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {activeModalProfile.fullName.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-serif font-bold text-base sm:text-lg text-[#252525]">
                      {activeModalProfile.fullName}
                    </h3>
                    {(() => {
                      const sInfo = getScholarStatusInfo(activeModalProfile.academicStatus, activeModalProfile.customStatusLabel);
                      return (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${sInfo.className}`}>
                          {sInfo.label}
                        </span>
                      );
                    })()}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#666666] mt-0.5">
                    <span>Batch {activeModalProfile.batchYear}</span>
                    {activeModalProfile.classOrDivision && (
                      <>
                        <span>&bull;</span>
                        <span>{activeModalProfile.classOrDivision}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setActiveModalProfile(null)}
                className="p-1.5 text-[#666666] hover:text-[#252525] rounded-lg hover:bg-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs sm:text-sm text-[#252525]">
              {/* Academic Credentials / Qualifications List */}
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-[#666666] block">
                  Academic Credentials
                </span>
                {activeModalProfile.qualificationsList && activeModalProfile.qualificationsList.length > 0 ? (
                  <div className="space-y-2">
                    {activeModalProfile.qualificationsList.map((q, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-[#F5F5F1] rounded-xl border border-[#E5E5DF] flex items-start justify-between gap-3"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 font-bold text-[#252525] text-xs">
                            <GraduationCap className="w-3.5 h-3.5 text-[#85845C] shrink-0" />
                            <span>{q.degree || 'Degree / Qualification'}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[#666666] text-[11px] pl-5">
                            <Building2 className="w-3 h-3 text-[#85845C]/70 shrink-0" />
                            <span>{q.university || 'University / Institution'}</span>
                          </div>
                        </div>
                        {q.year && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border border-[#E5E5DF] text-[#252525] shrink-0">
                            {q.year}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 p-3.5 bg-[#F5F5F1] rounded-xl border border-[#E5E5DF]">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#666666] block">
                        Degree / Qualification
                      </span>
                      <span className="font-semibold text-xs mt-0.5 block">
                        {activeModalProfile.qualification}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#666666] block">
                        University / Institution
                      </span>
                      <span className="font-semibold text-xs mt-0.5 block">
                        {activeModalProfile.university}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Current Role & Location */}
              {(activeModalProfile.currentRole || activeModalProfile.cityCountry) && (
                <div className="grid grid-cols-2 gap-3 p-3.5 bg-[#F5F5F1] rounded-xl border border-[#E5E5DF]">
                  {activeModalProfile.currentRole && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#666666] block">
                        Current Role
                      </span>
                      <span className="font-medium text-xs mt-0.5 block">
                        {activeModalProfile.currentRole}
                      </span>
                    </div>
                  )}
                  {activeModalProfile.cityCountry && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#666666] block">
                        Location
                      </span>
                      <span className="font-medium text-xs mt-0.5 block">
                        {activeModalProfile.cityCountry}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {activeModalProfile.bio && (
                <div>
                  <h4 className="font-serif font-bold text-xs uppercase tracking-wider text-[#666666] mb-1.5">
                    Scholarly Journey & Bio
                  </h4>
                  <p className="text-xs text-[#252525] leading-relaxed whitespace-pre-line p-3 bg-white border border-[#E5E5DF] rounded-xl">
                    {activeModalProfile.bio}
                  </p>
                </div>
              )}

              {/* Public Contact / Mentorship */}
              <div className="space-y-2 pt-2 border-t border-[#E5E5DF]">
                {activeModalProfile.availableForMentorship && (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800">
                    <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Open to guide and mentor junior madrasa students in university academics.</span>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {activeModalProfile.email && (
                    <a
                      href={`mailto:${activeModalProfile.email}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#F5F5F1] hover:bg-[#E5E5DF] text-[#252525] rounded-lg text-xs font-medium"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span>{activeModalProfile.email}</span>
                    </a>
                  )}
                  {activeModalProfile.phone && (
                    <a
                      href={`tel:${activeModalProfile.phone}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#F5F5F1] hover:bg-[#E5E5DF] text-[#252525] rounded-lg text-xs font-medium"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>{activeModalProfile.phone}</span>
                    </a>
                  )}
                  {activeModalProfile.linkedinUrl && (
                    <a
                      href={activeModalProfile.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-medium"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>LinkedIn Profile</span>
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#E5E5DF] bg-[#F5F5F1]/40 flex justify-end">
              <button
                onClick={() => setActiveModalProfile(null)}
                className="px-4 py-2 bg-white border border-[#E5E5DF] hover:bg-[#E5E5DF] text-[#252525] text-xs font-semibold rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default MadrasaPublicAlumni;
