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
  Plus,
  Mail,
  Phone,
  Filter,
  Loader2,
} from 'lucide-react';
import type { MadrasaThemeTokens } from '../../services/api';
import {
  getPublicAlumni,
  submitPublicAlumni,
  type AlumniScholarItem,
  type AcademicStatus,
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

  // Self-submission modal
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    fullName: '',
    photoUrl: '',
    batchYear: '',
    classOrDivision: '',
    academicStatus: 'UNDERGRADUATE' as AcademicStatus,
    qualification: '',
    university: '',
    facultyOrDepartment: '',
    currentRole: '',
    cityCountry: '',
    bio: '',
    email: '',
    phone: '',
    linkedinUrl: '',
    showContactPublicly: false,
    availableForMentorship: true,
  });

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

  // Handle client-side image compression for public submission
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (PNG, JPG, WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setFormData((prev) => ({ ...prev, photoUrl: dataUrl }));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName.trim() || !formData.batchYear.trim() || !formData.qualification.trim() || !formData.university.trim()) {
      setSubmitError('Please fill in all required fields (Name, Batch, Qualification, University).');
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError(null);
      await submitPublicAlumni(madrasaCode, formData);
      setSubmitSuccess(true);
      setTimeout(() => {
        setIsSubmitModalOpen(false);
        setSubmitSuccess(false);
        setFormData({
          fullName: '',
          photoUrl: '',
          batchYear: '',
          classOrDivision: '',
          academicStatus: 'UNDERGRADUATE',
          qualification: '',
          university: '',
          facultyOrDepartment: '',
          currentRole: '',
          cityCountry: '',
          bio: '',
          email: '',
          phone: '',
          linkedinUrl: '',
          showContactPublicly: false,
          availableForMentorship: true,
        });
      }, 2500);
    } catch (err: any) {
      setSubmitError(err.response?.data?.message || err.message || 'Failed to submit profile.');
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered alumni list
  const filteredAlumni = alumni.filter((item) => {
    if (selectedBatch !== 'ALL' && item.batchYear !== selectedBatch) return false;
    if (selectedClass !== 'ALL' && item.classOrDivision !== selectedClass) return false;
    if (selectedStatus !== 'ALL' && item.academicStatus !== selectedStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = item.fullName.toLowerCase().includes(q);
      const matchQual = item.qualification.toLowerCase().includes(q);
      const matchUni = item.university.toLowerCase().includes(q);
      const matchRole = (item.currentRole || '').toLowerCase().includes(q);
      const matchLoc = (item.cityCountry || '').toLowerCase().includes(q);
      if (!matchName && !matchQual && !matchUni && !matchRole && !matchLoc) return false;
    }
    return true;
  });

  return (
    <section id="alumni" className="public-section-enter scroll-mt-28" aria-label="Alumni & Scholars">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10 pb-6 border-b border-[#E5E5DF]">
        <div className="max-w-2xl">
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
            Celebrating our students pursuing higher academic degrees and leadership roles across universities and communities worldwide.
          </p>
        </div>

        <button
          onClick={() => setIsSubmitModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white shadow-xs transition-transform hover:scale-102 cursor-pointer self-start sm:self-auto shrink-0"
          style={{ backgroundColor: primaryColor }}
        >
          <Plus className="w-4 h-4" />
          <span>Submit Your Profile</span>
        </button>
      </div>

      {/* Filter Strip */}
      <div className="bg-[#F5F5F1]/70 border border-[#E5E5DF] rounded-2xl p-4 sm:p-5 mb-8 space-y-4">
        {/* Search Row */}
        <div className="relative">
          <Search className="w-4 h-4 text-[#85845C] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by scholar name, degree, university, role or location..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-[#E5E5DF] rounded-xl text-xs sm:text-sm text-[#252525] focus:outline-hidden focus:ring-2 focus:ring-[#85845C]/30"
          />
        </div>

        {/* Dynamic Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-[#666666] mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3 text-[#85845C]" />
            Status:
          </span>
          {[
            { id: 'ALL', label: 'All Statuses' },
            { id: 'UNDERGRADUATE', label: 'Undergraduates' },
            { id: 'GRADUATE', label: 'Graduates' },
            { id: 'POSTGRADUATE', label: 'Postgraduates' },
            { id: 'WORKING_SCHOLAR', label: 'Working Scholars' },
          ].map((st) => (
            <button
              key={st.id}
              onClick={() => setSelectedStatus(st.id)}
              className={`px-3 py-1 rounded-full font-medium transition cursor-pointer ${
                selectedStatus === st.id
                  ? 'bg-[#252525] text-white shadow-2xs font-semibold'
                  : 'bg-white text-[#666666] hover:bg-[#E5E5DF]/60 border border-[#E5E5DF]'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>

        {/* Batch & Class/Division Secondary Filters */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[#E5E5DF]/70 text-xs text-[#666666]">
          {batchYears.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-[#666666]">Batch:</span>
              <select
                value={selectedBatch}
                onChange={(e) => setSelectedBatch(e.target.value)}
                className="bg-white border border-[#E5E5DF] rounded-lg px-2.5 py-1 text-xs text-[#252525] focus:outline-hidden"
              >
                <option value="ALL">All Batches</option>
                {batchYears.map((by) => (
                  <option key={by} value={by}>
                    Batch of {by}
                  </option>
                ))}
              </select>
            </div>
          )}

          {classOrDivisions.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-[#666666]">Class / Division:</span>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="bg-white border border-[#E5E5DF] rounded-lg px-2.5 py-1 text-xs text-[#252525] focus:outline-hidden"
              >
                <option value="ALL">All Classes & Divisions</option>
                {classOrDivisions.map((cd) => (
                  <option key={cd} value={cd}>
                    {cd}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="ml-auto text-[11px] text-[#666666]">
            Showing <strong className="text-[#252525]">{filteredAlumni.length}</strong> of{' '}
            <strong className="text-[#252525]">{alumni.length}</strong> scholars
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
                  <h3 className="font-serif font-bold text-base sm:text-lg text-[#252525]">
                    {activeModalProfile.fullName}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-[#666666]">
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

      {/* Self-Submission Modal */}
      {isSubmitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-xl w-full border border-[#E5E5DF] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="p-5 border-b border-[#E5E5DF] flex items-center justify-between bg-[#F5F5F1]/60">
              <div>
                <h3 className="font-serif font-bold text-base sm:text-lg text-[#252525]">
                  Alumni & Scholar Profile Submission
                </h3>
                <p className="text-xs text-[#666666]">
                  Register your academic journey to appear in the official {madrasaName} alumni directory.
                </p>
              </div>
              <button
                onClick={() => setIsSubmitModalOpen(false)}
                className="p-1.5 text-[#666666] hover:text-[#252525] rounded-lg hover:bg-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleFormSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs">
              {submitSuccess ? (
                <div className="py-12 text-center space-y-3">
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-200">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h4 className="font-serif font-bold text-base text-[#252525]">
                    Profile Submitted Successfully!
                  </h4>
                  <p className="text-xs text-[#666666] max-w-sm mx-auto">
                    JazakAllah Khair! Your submission has been received and will be reviewed by the madrasa administration before going live.
                  </p>
                </div>
              ) : (
                <>
                  {submitError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
                      {submitError}
                    </div>
                  )}

                  {/* Profile Photo Uploader */}
                  <div className="flex items-center gap-4 p-3 bg-[#F5F5F1] rounded-xl border border-[#E5E5DF]">
                    {formData.photoUrl ? (
                      <img
                        src={formData.photoUrl}
                        alt="Preview"
                        className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-xs shrink-0"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-white border border-[#E5E5DF] flex items-center justify-center text-[#85845C] shrink-0 font-serif font-bold text-lg">
                        <GraduationCap className="w-6 h-6" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <label className="block font-semibold text-[#252525] mb-1">
                        Profile Photo (Recommended 400x400)
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        className="text-xs file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#85845C] file:text-white hover:file:opacity-90 cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Full Name & Batch */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-[#252525] mb-1">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.fullName}
                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                        placeholder="e.g. Mohamed Safras"
                        className="w-full px-3 py-2 bg-white border border-[#E5E5DF] rounded-xl text-xs text-[#252525] focus:outline-hidden focus:ring-1 focus:ring-[#85845C]"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#252525] mb-1">
                        Batch Year *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.batchYear}
                        onChange={(e) => setFormData({ ...formData, batchYear: e.target.value })}
                        placeholder="e.g. 2021"
                        className="w-full px-3 py-2 bg-white border border-[#E5E5DF] rounded-xl text-xs text-[#252525] focus:outline-hidden focus:ring-1 focus:ring-[#85845C]"
                      />
                    </div>
                  </div>

                  {/* Class / Division & Status */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-[#252525] mb-1">
                        Class / Division at Madrasa
                      </label>
                      <input
                        type="text"
                        value={formData.classOrDivision}
                        onChange={(e) => setFormData({ ...formData, classOrDivision: e.target.value })}
                        placeholder="e.g. Alim Final Year / Hifz"
                        className="w-full px-3 py-2 bg-white border border-[#E5E5DF] rounded-xl text-xs text-[#252525] focus:outline-hidden focus:ring-1 focus:ring-[#85845C]"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#252525] mb-1">
                        Current Academic Status
                      </label>
                      <select
                        value={formData.academicStatus}
                        onChange={(e) => setFormData({ ...formData, academicStatus: e.target.value as AcademicStatus })}
                        className="w-full px-3 py-2 bg-white border border-[#E5E5DF] rounded-xl text-xs text-[#252525] focus:outline-hidden focus:ring-1 focus:ring-[#85845C]"
                      >
                        <option value="UNDERGRADUATE">Undergraduate</option>
                        <option value="GRADUATE">Graduate</option>
                        <option value="POSTGRADUATE">Postgraduate</option>
                        <option value="WORKING_SCHOLAR">Working Scholar</option>
                      </select>
                    </div>
                  </div>

                  {/* Qualification & University */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-[#252525] mb-1">
                        Degree / Qualification *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.qualification}
                        onChange={(e) => setFormData({ ...formData, qualification: e.target.value })}
                        placeholder="e.g. B.A. (Hons) in Arabic"
                        className="w-full px-3 py-2 bg-white border border-[#E5E5DF] rounded-xl text-xs text-[#252525] focus:outline-hidden focus:ring-1 focus:ring-[#85845C]"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#252525] mb-1">
                        University / Institution *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.university}
                        onChange={(e) => setFormData({ ...formData, university: e.target.value })}
                        placeholder="e.g. SEUSL / University of Peradeniya"
                        className="w-full px-3 py-2 bg-white border border-[#E5E5DF] rounded-xl text-xs text-[#252525] focus:outline-hidden focus:ring-1 focus:ring-[#85845C]"
                      />
                    </div>
                  </div>

                  {/* Current Role & Location */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-[#252525] mb-1">
                        Current Role / Title
                      </label>
                      <input
                        type="text"
                        value={formData.currentRole}
                        onChange={(e) => setFormData({ ...formData, currentRole: e.target.value })}
                        placeholder="e.g. Final Year Student / Lecturer"
                        className="w-full px-3 py-2 bg-white border border-[#E5E5DF] rounded-xl text-xs text-[#252525] focus:outline-hidden focus:ring-1 focus:ring-[#85845C]"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#252525] mb-1">
                        City & Country
                      </label>
                      <input
                        type="text"
                        value={formData.cityCountry}
                        onChange={(e) => setFormData({ ...formData, cityCountry: e.target.value })}
                        placeholder="e.g. Oluvil, Sri Lanka"
                        className="w-full px-3 py-2 bg-white border border-[#E5E5DF] rounded-xl text-xs text-[#252525] focus:outline-hidden focus:ring-1 focus:ring-[#85845C]"
                      />
                    </div>
                  </div>

                  {/* Bio */}
                  <div>
                    <label className="block font-semibold text-[#252525] mb-1">
                      Academic Bio & Aspirations
                    </label>
                    <textarea
                      rows={3}
                      value={formData.bio}
                      onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                      placeholder="Briefly describe your field of study, research, or career aspirations..."
                      className="w-full px-3 py-2 bg-white border border-[#E5E5DF] rounded-xl text-xs text-[#252525] focus:outline-hidden focus:ring-1 focus:ring-[#85845C]"
                    />
                  </div>

                  {/* Contact Channels */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold text-[#252525] mb-1">Email</label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="scholar@example.com"
                        className="w-full px-3 py-2 bg-white border border-[#E5E5DF] rounded-xl text-xs text-[#252525] focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#252525] mb-1">Phone</label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="+94 77 ..."
                        className="w-full px-3 py-2 bg-white border border-[#E5E5DF] rounded-xl text-xs text-[#252525] focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#252525] mb-1">LinkedIn URL</label>
                      <input
                        type="url"
                        value={formData.linkedinUrl}
                        onChange={(e) => setFormData({ ...formData, linkedinUrl: e.target.value })}
                        placeholder="https://linkedin.com/in/..."
                        className="w-full px-3 py-2 bg-white border border-[#E5E5DF] rounded-xl text-xs text-[#252525] focus:outline-hidden"
                      />
                    </div>
                  </div>

                  {/* Checkboxes */}
                  <div className="space-y-2 pt-2 border-t border-[#E5E5DF]">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.availableForMentorship}
                        onChange={(e) => setFormData({ ...formData, availableForMentorship: e.target.checked })}
                        className="rounded text-[#85845C]"
                      />
                      <span className="text-[#252525] font-medium">
                        I am open to mentoring current madrasa students entering university
                      </span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.showContactPublicly}
                        onChange={(e) => setFormData({ ...formData, showContactPublicly: e.target.checked })}
                        className="rounded text-[#85845C]"
                      />
                      <span className="text-[#666666]">
                        Display my email / phone publicly on the website (otherwise visible to admin only)
                      </span>
                    </label>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-4 border-t border-[#E5E5DF] flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setIsSubmitModalOpen(false)}
                      className="px-4 py-2 bg-white border border-[#E5E5DF] hover:bg-[#E5E5DF] text-[#252525] font-semibold rounded-xl cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-5 py-2 text-white font-semibold rounded-xl shadow-xs transition hover:opacity-95 cursor-pointer disabled:opacity-50 flex items-center gap-2"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Submitting...</span>
                        </>
                      ) : (
                        <span>Submit for Verification</span>
                      )}
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}
    </section>
  );
};

export default MadrasaPublicAlumni;
