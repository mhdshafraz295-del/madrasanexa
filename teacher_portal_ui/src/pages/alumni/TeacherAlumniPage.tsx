import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  Search,
  BookOpen,
  Building2,
  MapPin,
  Sparkles,
  ExternalLink,
  Mail,
  Phone,
  Loader2,
  X,
  CheckCircle2,
} from 'lucide-react';
import { alumniApi, TeacherAlumniItem, getScholarStatusInfo } from '../../services/api';

export const TeacherAlumniPage: React.FC = () => {
  const [alumni, setAlumni] = useState<TeacherAlumniItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBatch, setSelectedBatch] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  // Modal
  const [activeProfile, setActiveProfile] = useState<TeacherAlumniItem | null>(null);

  const fetchAlumni = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await alumniApi.getAlumniList();
      setAlumni(data || []);
    } catch (err: any) {
      console.error('Failed to load teacher alumni directory:', err);
      setError(err.message || 'Failed to load alumni directory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlumni();
  }, []);

  const batchYears = Array.from(
    new Set(alumni.map((a) => a.batchYear).filter(Boolean))
  ).sort((a, b) => b.localeCompare(a));

  const filtered = alumni.filter((item) => {
    if (selectedBatch !== 'ALL' && item.batchYear !== selectedBatch) return false;
    if (selectedStatus !== 'ALL' && item.academicStatus !== selectedStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = item.fullName.toLowerCase().includes(q);
      const matchQual = item.qualification.toLowerCase().includes(q);
      const matchUni = item.university.toLowerCase().includes(q);
      const matchRole = (item.currentRole || '').toLowerCase().includes(q);
      const matchQualList = item.qualificationsList?.some(
        (ql) => ql.degree.toLowerCase().includes(q) || ql.university.toLowerCase().includes(q)
      );
      if (!matchName && !matchQual && !matchUni && !matchRole && !matchQualList) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200/90 shadow-lg shadow-slate-200/70 ring-1 ring-slate-900/[0.03]">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-200/80 shrink-0">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                Institutional Directory
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 mt-0.5">
              Alumni & Scholarly Graduates
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Browse our past students now studying at higher academic institutions and serving communities worldwide.
            </p>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search scholar name, degree, university, role..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {batchYears.length > 0 && (
              <select
                value={selectedBatch}
                onChange={(e) => setSelectedBatch(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-hidden"
              >
                <option value="ALL">All Batches</option>
                {batchYears.map((b) => (
                  <option key={b} value={b}>
                    Batch {b}
                  </option>
                ))}
              </select>
            )}

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-hidden"
            >
              <option value="ALL">All Academic Statuses</option>
              <option value="UNDERGRADUATE">Undergraduates</option>
              <option value="GRADUATE">Graduates</option>
              <option value="POSTGRADUATE">Postgraduates</option>
              <option value="WORKING_SCHOLAR">Working Scholars</option>
              <option value="HAFIL">Hafil</option>
              <option value="AL_AALIM">Al Aalim</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
        </div>

        <div className="text-[11px] text-slate-400 flex items-center justify-between pt-2 border-t border-slate-100">
          <span>
            Showing <strong className="text-slate-700">{filtered.length}</strong> scholars
          </span>
          {alumni.some((a) => a.availableForMentorship) && (
            <span className="text-emerald-700 flex items-center gap-1 font-medium">
              <Sparkles className="w-3 h-3 text-emerald-600" />
              {alumni.filter((a) => a.availableForMentorship).length} available for student mentorship
            </span>
          )}
        </div>
      </div>

      {/* Directory Grid */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-3" />
          <p className="text-xs">Loading alumni profiles...</p>
        </div>
      ) : error ? (
        <div className="p-8 text-center bg-white border border-slate-200 rounded-2xl text-xs text-rose-600">
          {error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center space-y-3">
          <GraduationCap className="w-12 h-12 mx-auto text-slate-300" />
          <h3 className="text-base font-bold text-slate-800">No Alumni Profiles Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Try adjusting your search criteria or batch filter above.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => {
            const initials = item.fullName
              .split(' ')
              .filter(Boolean)
              .slice(0, 2)
              .map((w) => w[0]?.toUpperCase())
              .join('');

            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden"
              >
                <div className="p-4 sm:p-5 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {item.photoUrl ? (
                        <img
                          src={item.photoUrl}
                          alt={item.fullName}
                          className="w-13 h-13 rounded-full object-cover border-2 border-slate-100 shadow-xs shrink-0"
                        />
                      ) : (
                        <div className="w-13 h-13 rounded-full bg-emerald-600 text-white font-bold text-base flex items-center justify-center shrink-0">
                          {initials}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
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
                        <h4 className="text-sm font-bold text-slate-900 mt-1 truncate">
                          {item.fullName}
                        </h4>
                        {item.classOrDivision && (
                          <p className="text-[11px] text-slate-500 truncate">
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

                  <div className="mt-4 space-y-1.5 text-xs text-slate-700">
                    <div className="flex items-start gap-2">
                      <BookOpen className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span className="font-semibold line-clamp-1">{item.qualification}</span>
                    </div>
                    <div className="flex items-start gap-2 text-slate-500">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span className="line-clamp-1">{item.university}</span>
                    </div>
                    {item.qualificationsList && item.qualificationsList.length > 1 && (
                      <div className="pt-0.5">
                        <span className="inline-flex items-center text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">
                          +{item.qualificationsList.length - 1} more qualification{item.qualificationsList.length - 1 > 1 ? 's' : ''}
                        </span>
                      </div>
                    )}
                    {item.currentRole && (
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                        <span className="font-medium text-slate-400">Role:</span>
                        <span className="truncate">{item.currentRole}</span>
                      </div>
                    )}
                    {item.cityCountry && (
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span>{item.cityCountry}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                  {item.availableForMentorship ? (
                    <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5 text-emerald-600" />
                      Open to Mentor
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400">
                      {item.academicStatus.replace('_', ' ')}
                    </span>
                  )}

                  <button
                    onClick={() => setActiveProfile(item)}
                    className="px-3 py-1 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    View Details
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Profile Modal */}
      {activeProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                {activeProfile.photoUrl ? (
                  <img
                    src={activeProfile.photoUrl}
                    alt={activeProfile.fullName}
                    className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-xs"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center">
                    {activeProfile.fullName.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-base text-slate-900">{activeProfile.fullName}</h3>
                    {(() => {
                      const sInfo = getScholarStatusInfo(activeProfile.academicStatus, activeProfile.customStatusLabel);
                      return (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${sInfo.className}`}>
                          {sInfo.label}
                        </span>
                      );
                    })()}
                  </div>
                  <p className="text-xs text-slate-500">
                    Batch {activeProfile.batchYear} &bull; {activeProfile.classOrDivision || 'General'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveProfile(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Academic Credentials / Qualifications List */}
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Academic Credentials
                </span>
                {activeProfile.qualificationsList && activeProfile.qualificationsList.length > 0 ? (
                  <div className="space-y-2">
                    {activeProfile.qualificationsList.map((q, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-slate-50/90 rounded-xl border border-slate-200/80 flex items-start justify-between gap-3"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
                            <GraduationCap className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>{q.degree || 'Degree / Qualification'}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-600 text-[11px] pl-5">
                            <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{q.university || 'University / Institution'}</span>
                          </div>
                        </div>
                        {q.year && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-700 shrink-0">
                            {q.year}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Degree</span>
                      <span className="font-semibold text-slate-800">{activeProfile.qualification}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">University</span>
                      <span className="font-semibold text-slate-800">{activeProfile.university}</span>
                    </div>
                  </div>
                )}
              </div>

              {(activeProfile.currentRole || activeProfile.cityCountry) && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  {activeProfile.currentRole && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Role</span>
                      <span className="font-medium text-slate-800">{activeProfile.currentRole}</span>
                    </div>
                  )}
                  {activeProfile.cityCountry && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Location</span>
                      <span className="font-medium text-slate-800">{activeProfile.cityCountry}</span>
                    </div>
                  )}
                </div>
              )}

              {activeProfile.bio && (
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                    Academic Bio
                  </span>
                  <p className="p-3 bg-white border border-slate-200 rounded-xl text-slate-700 leading-relaxed whitespace-pre-line">
                    {activeProfile.bio}
                  </p>
                </div>
              )}

              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Contact Channels
                </span>
                {activeProfile.email && (
                  <div className="flex items-center gap-2 text-slate-700">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span>{activeProfile.email}</span>
                  </div>
                )}
                {activeProfile.phone && (
                  <div className="flex items-center gap-2 text-slate-700">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{activeProfile.phone}</span>
                  </div>
                )}
                {activeProfile.linkedinUrl && (
                  <div className="flex items-center gap-2 text-blue-600">
                    <ExternalLink className="w-3.5 h-3.5" />
                    <a
                      href={activeProfile.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline flex items-center gap-1"
                    >
                      <span>LinkedIn Profile</span>
                    </a>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
              <button
                onClick={() => setActiveProfile(null)}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold rounded-xl text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherAlumniPage;
