import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  Sparkles,
  Clock,
  Search,
  Plus,
  Copy,
  Check,
  Globe,
  Eye,
  Trash2,
  Edit,
  ExternalLink,
  BookOpen,
  Building2,
  MapPin,
  Mail,
  Phone,
  Loader2,
  X,
  ShieldCheck,
  Star,
} from 'lucide-react';
import { Pagination } from '../../components/common/Pagination';
import {
  getAdminAlumniHub,
  toggleWebsiteVisibility,
  createAdminScholar,
  updateAdminScholar,
  updateAdminScholarStatus,
  deleteAdminScholar,
  type AlumniScholarItem,
  type AlumniHubResponse,
  type AcademicStatus,
  type ScholarApprovalStatus,
  type ScholarCreatePayload,
  type QualificationEntry,
  getScholarStatusInfo,
} from '../../services/scholar-alumni.service';

export const ScholarAlumniHubPage: React.FC = () => {
  const [hubData, setHubData] = useState<AlumniHubResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'verified' | 'pending'>('verified');

  // Filter States
  const [selectedBatch, setSelectedBatch] = useState<string>('ALL');
  const [selectedClass, setSelectedClass] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Pagination State
  const [page, setPage] = useState<number>(1);
  const pageSize = 9;

  // Toggling Website Visibility
  const [togglingVisibility, setTogglingVisibility] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Modal States
  const [isEditorModalOpen, setIsEditorModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AlumniScholarItem | null>(null);
  const [savingEditor, setSavingEditor] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);

  const [activeDetailItem, setActiveDetailItem] = useState<AlumniScholarItem | null>(null);
  const [actionProcessingId, setActionProcessingId] = useState<string | null>(null);

  // Editor Form State
  const [editorForm, setEditorForm] = useState<ScholarCreatePayload>({
    fullName: '',
    photoUrl: '',
    batchYear: '',
    classOrDivision: '',
    academicStatus: 'UNDERGRADUATE',
    customStatusLabel: '',
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
    approvalStatus: 'APPROVED',
    isFeatured: false,
  });

  const fetchHub = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAdminAlumniHub({
        batchYear: selectedBatch !== 'ALL' ? selectedBatch : undefined,
        classOrDivision: selectedClass !== 'ALL' ? selectedClass : undefined,
        search: searchQuery.trim() || undefined,
      });
      setHubData(data);
    } catch (err: any) {
      console.error('Failed to load Alumni Hub data:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load Alumni Hub.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHub();
  }, [selectedBatch, selectedClass, searchQuery]);

  useEffect(() => {
    setPage(1);
  }, [activeTab, selectedBatch, selectedClass, selectedStatus, searchQuery]);

  const handleToggleWebsiteVisibility = async () => {
    if (!hubData || togglingVisibility) return;
    const nextState = !hubData.showAlumniOnWebsite;
    try {
      setTogglingVisibility(true);
      await toggleWebsiteVisibility(nextState);
      setHubData((prev) => (prev ? { ...prev, showAlumniOnWebsite: nextState } : null));
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update website visibility.');
    } finally {
      setTogglingVisibility(false);
    }
  };

  const handleCopyRegistrationLink = () => {
    if (!hubData) return;
    const code = hubData.madrasa?.code || hubData.madrasa?.slug;
    const url = `${window.location.origin}/alumni/${code}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const [editorQualifications, setEditorQualifications] = useState<QualificationEntry[]>([
    { degree: '', university: '', year: '' },
  ]);

  const handleQualificationChange = (index: number, field: 'degree' | 'university' | 'year', value: string) => {
    setEditorQualifications((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleAddQualification = () => {
    setEditorQualifications((prev) => [...prev, { degree: '', university: '', year: '' }]);
  };

  const handleRemoveQualification = (index: number) => {
    setEditorQualifications((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  };

  const openCreateModal = () => {
    setEditingItem(null);
    setEditorError(null);
    setEditorQualifications([{ degree: '', university: '', year: '' }]);
    setEditorForm({
      fullName: '',
      photoUrl: '',
      batchYear: new Date().getFullYear().toString(),
      classOrDivision: '',
      academicStatus: 'UNDERGRADUATE',
      customStatusLabel: '',
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
      approvalStatus: 'APPROVED',
      isFeatured: false,
    });
    setIsEditorModalOpen(true);
  };

  const openEditModal = (item: AlumniScholarItem) => {
    setEditingItem(item);
    setEditorError(null);
    const qualList = (item.qualificationsList && item.qualificationsList.length > 0)
      ? item.qualificationsList.map((q) => ({ degree: q.degree || '', university: q.university || '', year: q.year || '' }))
      : [{ degree: item.qualification || '', university: item.university || '', year: item.batchYear || '' }];
    setEditorQualifications(qualList);
    setEditorForm({
      fullName: item.fullName,
      photoUrl: item.photoUrl || '',
      batchYear: item.batchYear,
      classOrDivision: item.classOrDivision || '',
      academicStatus: item.academicStatus,
      customStatusLabel: item.customStatusLabel || '',
      qualification: item.qualification,
      university: item.university,
      facultyOrDepartment: item.facultyOrDepartment || '',
      currentRole: item.currentRole || '',
      cityCountry: item.cityCountry || '',
      bio: item.bio || '',
      email: item.email || '',
      phone: item.phone || '',
      linkedinUrl: item.linkedinUrl || '',
      showContactPublicly: item.showContactPublicly,
      availableForMentorship: item.availableForMentorship,
      approvalStatus: item.approvalStatus,
      isFeatured: item.isFeatured,
    });
    setIsEditorModalOpen(true);
  };

  const handleEditorPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
        setEditorForm((prev) => ({ ...prev, photoUrl: dataUrl }));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveEditor = async (e: React.FormEvent) => {
    e.preventDefault();
    const validQuals = editorQualifications.filter((q) => q.degree.trim() || q.university.trim());
    if (!editorForm.fullName.trim() || !editorForm.batchYear.trim() || validQuals.length === 0 || !validQuals[0].degree.trim() || !validQuals[0].university.trim()) {
      setEditorError('Please provide Full Name, Batch Year, and at least one Degree / University pair.');
      return;
    }

    const payloadToSave: ScholarCreatePayload = {
      ...editorForm,
      customStatusLabel: editorForm.academicStatus === 'OTHER' ? (editorForm.customStatusLabel?.trim() || null) : null,
      qualification: validQuals[0].degree.trim(),
      university: validQuals[0].university.trim(),
      qualificationsList: validQuals,
    };

    try {
      setSavingEditor(true);
      setEditorError(null);
      if (editingItem) {
        await updateAdminScholar(editingItem.id, payloadToSave);
      } else {
        await createAdminScholar(payloadToSave);
      }
      setIsEditorModalOpen(false);
      fetchHub();
    } catch (err: any) {
      setEditorError(err.response?.data?.message || err.message || 'Failed to save scholar.');
    } finally {
      setSavingEditor(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: ScholarApprovalStatus) => {
    try {
      setActionProcessingId(id);
      await updateAdminScholarStatus(id, { approvalStatus: status });
      setHubData((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          items: prev.items.map((it) => (it.id === id ? { ...it, approvalStatus: status } : it)),
        };
      });
      fetchHub();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update status.');
    } finally {
      setActionProcessingId(null);
    }
  };

  const handleToggleFeatured = async (id: string, currentFeatured: boolean) => {
    try {
      setActionProcessingId(id);
      const nextFeatured = !currentFeatured;
      await updateAdminScholarStatus(id, { isFeatured: nextFeatured });
      setHubData((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          items: prev.items.map((it) => (it.id === id ? { ...it, isFeatured: nextFeatured } : it)),
        };
      });
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to toggle featured status.');
    } finally {
      setActionProcessingId(null);
    }
  };

  const handleDeleteScholar = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete scholar profile for '${name}'? This cannot be undone.`)) {
      return;
    }
    try {
      setActionProcessingId(id);
      await deleteAdminScholar(id);
      setHubData((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          items: prev.items.filter((it) => it.id !== id),
        };
      });
      fetchHub();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete scholar profile.');
    } finally {
      setActionProcessingId(null);
    }
  };

  const allItems: AlumniScholarItem[] = hubData?.items || [];
  const verifiedList = allItems.filter((i) => i.approvalStatus === 'APPROVED');
  const pendingList = allItems.filter((i) => i.approvalStatus === 'PENDING' || i.approvalStatus === 'REJECTED');

  const currentList = (activeTab === 'verified' ? verifiedList : pendingList).filter((item: AlumniScholarItem) => {
    if (selectedStatus !== 'ALL' && item.academicStatus !== selectedStatus) return false;
    return true;
  });

  const paginatedList = currentList.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. Website Visibility Control Card */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200/90 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/80 flex items-center justify-center shrink-0">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Show Alumni & Scholars on Madrasa Website
              </h2>
              {hubData?.showAlumniOnWebsite ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  Live on Website
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                  Hidden from Website
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Controls whether the public 'Alumni & Scholars' tab and showcase section appears on your institutional website.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
          {/* Toggle Switch */}
          <button
            onClick={handleToggleWebsiteVisibility}
            disabled={togglingVisibility || !hubData}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              hubData?.showAlumniOnWebsite
                ? 'bg-slate-900 text-white hover:bg-slate-800'
                : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-600/20'
            }`}
          >
            {togglingVisibility ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : hubData?.showAlumniOnWebsite ? (
              <span>Turn OFF Section</span>
            ) : (
              <span>Enable Section ON</span>
            )}
          </button>

          {/* Copy Public Link */}
          <button
            onClick={handleCopyRegistrationLink}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
            title="Copy self-submission registration link to share on WhatsApp or Email"
          >
            {copiedLink ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                <span className="text-emerald-700">Copied Link!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-slate-500" />
                <span>Copy Self-Submission Link</span>
              </>
            )}
          </button>

          {/* Add Scholar CTA */}
          <button
            onClick={openCreateModal}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition shadow-sm shadow-emerald-600/20 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Scholar</span>
          </button>
        </div>
      </div>

      {/* 2. Executive KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Verified Alumni</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-slate-900">
            {hubData?.kpis.totalApproved || 0}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Live in scholar directory</p>
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Pending Review</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-2">
            <span>{hubData?.kpis.pendingCount || 0}</span>
            {(hubData?.kpis.pendingCount || 0) > 0 && (
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
            )}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Awaiting verification</p>
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Undergraduates</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-slate-900">
            {hubData?.kpis.undergraduatesCount || 0}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Enrolled in university degrees</p>
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Active Mentors</span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-slate-900">
            {hubData?.kpis.mentorsCount || 0}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Open for student mentorship</p>
        </div>
      </div>

      {/* 3. Filter & Tabs Strip */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-sm space-y-4">
        {/* Tab Selector & Search Row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
            <button
              onClick={() => setActiveTab('verified')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === 'verified'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Verified Directory ({verifiedList.length})
            </button>
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'pending'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Submissions & Review</span>
              {(hubData?.kpis.pendingCount || 0) > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                  {hubData?.kpis.pendingCount}
                </span>
              )}
            </button>
          </div>

          {/* Live Search Input */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search scholar name, degree, university..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Secondary Batch & Class Dropdowns */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100 text-xs text-slate-600">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-500">Batch Year:</span>
            <select
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 focus:outline-hidden"
            >
              <option value="ALL">All Batches</option>
              {hubData?.availableBatchYears.map((by) => (
                <option key={by} value={by}>
                  Batch {by}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-500">Class / Division:</span>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 focus:outline-hidden"
            >
              <option value="ALL">All Classes & Divisions</option>
              {hubData?.availableClassOrDivisions.map((cd) => (
                <option key={cd} value={cd}>
                  {cd}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-500">Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 focus:outline-hidden"
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

          <div className="ml-auto text-[11px] text-slate-400">
            Showing <strong className="text-slate-700">{currentList.length}</strong> scholars
          </div>
        </div>
      </div>

      {/* 4. Scholars Roster Cards / Table */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs">
          {error}
        </div>
      )}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-3" />
          <p className="text-xs">Loading alumni profiles...</p>
        </div>
      ) : currentList.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 border border-slate-200/90 text-center space-y-3">
          <GraduationCap className="w-12 h-12 mx-auto text-slate-300" />
          <h3 className="text-base font-bold text-slate-800">No Alumni Profiles Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {activeTab === 'verified'
              ? 'No verified alumni match the filters. Click "+ Add Scholar" or review pending submissions.'
              : 'Zero pending submissions awaiting review right now.'}
          </p>
          {activeTab === 'verified' && (
            <button
              onClick={openCreateModal}
              className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold cursor-pointer"
            >
              + Add First Scholar
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedList.map((item: AlumniScholarItem) => {
            const initials = item.fullName
              .split(' ')
              .filter(Boolean)
              .slice(0, 2)
              .map((w: string) => w[0]?.toUpperCase())
              .join('');
            const isProcessing = actionProcessingId === item.id;

            return (
              <div
                key={item.id}
                className={`bg-white rounded-2xl border transition-all shadow-sm flex flex-col justify-between overflow-hidden ${
                  item.isFeatured
                    ? 'border-amber-300/80 ring-1 ring-amber-300/40'
                    : 'border-slate-200/90 hover:border-slate-300'
                }`}
              >
                {/* Card Top */}
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
                        <div className="w-13 h-13 rounded-full bg-slate-900 text-emerald-400 font-bold text-base flex items-center justify-center shrink-0">
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
                          {item.approvalStatus === 'APPROVED' ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Approved
                            </span>
                          ) : item.approvalStatus === 'PENDING' ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                              Pending
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                              Rejected
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

                    <button
                      onClick={() => handleToggleFeatured(item.id, item.isFeatured)}
                      disabled={isProcessing}
                      title={item.isFeatured ? 'Featured Scholar (click to unfeature)' : 'Mark as Featured'}
                      className={`p-1.5 rounded-lg border transition cursor-pointer ${
                        item.isFeatured
                          ? 'bg-amber-50 text-amber-600 border-amber-200'
                          : 'bg-slate-50 text-slate-300 border-slate-200 hover:text-amber-500'
                      }`}
                    >
                      <Star className={`w-4 h-4 ${item.isFeatured ? 'fill-amber-500' : ''}`} />
                    </button>
                  </div>

                  {/* Academic Details */}
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
                        <span className="inline-flex items-center text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">
                          +{item.qualificationsList.length - 1} more qualification{item.qualificationsList.length - 1 > 1 ? 's' : ''}
                        </span>
                      </div>
                    )}
                    {item.currentRole && (
                      <div className="flex items-center gap-2 text-slate-600 text-[11px]">
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

                {/* Card Footer / Action Buttons */}
                <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setActiveDetailItem(item)}
                      className="p-1.5 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-200/60 cursor-pointer"
                      title="View Full Profile"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openEditModal(item)}
                      className="p-1.5 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-200/60 cursor-pointer"
                      title="Edit Scholar"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteScholar(item.id, item.fullName)}
                      disabled={isProcessing}
                      className="p-1.5 text-rose-500 hover:text-rose-700 rounded-lg hover:bg-rose-50 cursor-pointer"
                      title="Delete Profile"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Approve / Reject Controls */}
                  <div className="flex items-center gap-1.5">
                    {item.approvalStatus !== 'APPROVED' && (
                      <button
                        onClick={() => handleUpdateStatus(item.id, 'APPROVED')}
                        disabled={isProcessing}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-xs cursor-pointer flex items-center gap-1"
                      >
                        <Check className="w-3 h-3 stroke-[3]" />
                        <span>Approve</span>
                      </button>
                    )}
                    {item.approvalStatus === 'PENDING' && (
                      <button
                        onClick={() => handleUpdateStatus(item.id, 'REJECTED')}
                        disabled={isProcessing}
                        className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold rounded-lg text-xs cursor-pointer border border-rose-200"
                      >
                        Reject
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <Pagination
          currentPage={page}
          totalItems={currentList.length}
          pageSize={pageSize}
          onPageChange={setPage}
          itemLabel="scholars"
          className="mt-4 rounded-2xl border border-slate-200/90 shadow-2xs"
        />
      </>
      )}

      {/* Editor Modal (Add / Edit) */}
      {isEditorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-bold text-base text-slate-900">
                {editingItem ? 'Edit Scholar Profile' : 'Add New Verified Scholar'}
              </h3>
              <button
                onClick={() => setIsEditorModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditor} className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs">
              {editorError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700">
                  {editorError}
                </div>
              )}

              {/* Photo Upload & Preview */}
              <div className="flex items-center gap-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                {editorForm.photoUrl ? (
                  <img
                    src={editorForm.photoUrl}
                    alt="Preview"
                    className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-xs shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center shrink-0">
                    <GraduationCap className="w-7 h-7" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <label className="block font-semibold text-slate-800 mb-1">
                    Profile Photograph (Square recommended)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleEditorPhotoUpload}
                    className="text-xs file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-900 file:text-white hover:file:opacity-90 cursor-pointer"
                  />
                </div>
              </div>

              {/* Full Name & Batch */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-800 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={editorForm.fullName}
                    onChange={(e) => setEditorForm({ ...editorForm, fullName: e.target.value })}
                    placeholder="e.g. Mohamed Safras"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-800 mb-1">Batch Year *</label>
                  <input
                    type="text"
                    required
                    value={editorForm.batchYear}
                    onChange={(e) => setEditorForm({ ...editorForm, batchYear: e.target.value })}
                    placeholder="e.g. 2021"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Class & Academic Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-800 mb-1">
                    Class / Division at Madrasa
                  </label>
                  <input
                    type="text"
                    value={editorForm.classOrDivision || ''}
                    onChange={(e) => setEditorForm({ ...editorForm, classOrDivision: e.target.value })}
                    placeholder="e.g. Alim Final Year / Hifz"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-800 mb-1">Academic Status</label>
                  <select
                    value={editorForm.academicStatus}
                    onChange={(e) => setEditorForm({ ...editorForm, academicStatus: e.target.value as AcademicStatus })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="UNDERGRADUATE">Undergraduate</option>
                    <option value="GRADUATE">Graduate</option>
                    <option value="POSTGRADUATE">Postgraduate</option>
                    <option value="WORKING_SCHOLAR">Working Scholar</option>
                    <option value="HAFIL">Hafil</option>
                    <option value="AL_AALIM">Al Aalim</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                {editorForm.academicStatus === 'OTHER' && (
                  <div className="sm:col-span-2 animate-in fade-in slide-in-from-top-1 duration-150">
                    <label className="block font-semibold text-slate-800 mb-1 text-xs">
                      Specify Position / Status *
                    </label>
                    <input
                      type="text"
                      required
                      value={editorForm.customStatusLabel || ''}
                      onChange={(e) => setEditorForm({ ...editorForm, customStatusLabel: e.target.value })}
                      placeholder="e.g., Businessman, Imam, Entrepreneur, Lecturer..."
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                )}
              </div>

              {/* Dynamic Qualifications List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block font-semibold text-slate-800 text-xs">
                    Degrees & Universities *
                  </label>
                  <span className="text-[10px] text-slate-400">Add undergraduate, graduate or alim degrees</span>
                </div>
                <div className="space-y-2.5">
                  {editorQualifications.map((item, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-1 sm:grid-cols-12 gap-2 p-3 rounded-xl bg-slate-50/80 border border-slate-200/80 items-end"
                    >
                      <div className="sm:col-span-5">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                          Degree / Qualification *
                        </label>
                        <input
                          type="text"
                          required={index === 0}
                          value={item.degree}
                          onChange={(e) => handleQualificationChange(index, 'degree', e.target.value)}
                          placeholder="e.g. Alim / B.A. (Hons)"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                      <div className="sm:col-span-5">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                          University / Institution *
                        </label>
                        <input
                          type="text"
                          required={index === 0}
                          value={item.university}
                          onChange={(e) => handleQualificationChange(index, 'university', e.target.value)}
                          placeholder="e.g. South Eastern University"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                      <div className="sm:col-span-2 flex items-center gap-1.5">
                        <div className="flex-1 min-w-0">
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                            Year
                          </label>
                          <input
                            type="text"
                            value={item.year || ''}
                            onChange={(e) => handleQualificationChange(index, 'year', e.target.value)}
                            placeholder="e.g. 2024"
                            className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden"
                          />
                        </div>
                        {editorQualifications.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveQualification(index)}
                            className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl cursor-pointer self-end mb-0.5 shrink-0"
                            title="Remove degree"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleAddQualification}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-2 rounded-xl transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add Another Degree / University</span>
                </button>
              </div>

              {/* Current Role & Location */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-800 mb-1">Current Role / Title</label>
                  <input
                    type="text"
                    value={editorForm.currentRole || ''}
                    onChange={(e) => setEditorForm({ ...editorForm, currentRole: e.target.value })}
                    placeholder="e.g. Lecturer / Software Engineer"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-800 mb-1">City & Country</label>
                  <input
                    type="text"
                    value={editorForm.cityCountry || ''}
                    onChange={(e) => setEditorForm({ ...editorForm, cityCountry: e.target.value })}
                    placeholder="e.g. Oluvil, Sri Lanka"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Bio */}
              <div>
                <label className="block font-semibold text-slate-800 mb-1">Academic Bio</label>
                <textarea
                  rows={3}
                  value={editorForm.bio || ''}
                  onChange={(e) => setEditorForm({ ...editorForm, bio: e.target.value })}
                  placeholder="Summary of study, achievements, research..."
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden"
                />
              </div>

              {/* Contact Information */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-800 mb-1">Email</label>
                  <input
                    type="email"
                    value={editorForm.email || ''}
                    onChange={(e) => setEditorForm({ ...editorForm, email: e.target.value })}
                    placeholder="email@example.com"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-800 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={editorForm.phone || ''}
                    onChange={(e) => setEditorForm({ ...editorForm, phone: e.target.value })}
                    placeholder="+94 ..."
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-800 mb-1">LinkedIn URL</label>
                  <input
                    type="url"
                    value={editorForm.linkedinUrl || ''}
                    onChange={(e) => setEditorForm({ ...editorForm, linkedinUrl: e.target.value })}
                    placeholder="https://linkedin.com/in/..."
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Checkboxes */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editorForm.isFeatured}
                    onChange={(e) => setEditorForm({ ...editorForm, isFeatured: e.target.checked })}
                    className="rounded text-emerald-600"
                  />
                  <span className="text-slate-800 font-semibold">
                    Pin as Featured Scholar on Public Website
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editorForm.availableForMentorship}
                    onChange={(e) => setEditorForm({ ...editorForm, availableForMentorship: e.target.checked })}
                    className="rounded text-emerald-600"
                  />
                  <span className="text-slate-700">Open for Student Mentorship</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editorForm.showContactPublicly}
                    onChange={(e) => setEditorForm({ ...editorForm, showContactPublicly: e.target.checked })}
                    className="rounded text-emerald-600"
                  />
                  <span className="text-slate-500">Show email/phone publicly on website directory</span>
                </label>
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsEditorModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEditor}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  {savingEditor ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  <span>{editingItem ? 'Save Changes' : 'Create Scholar'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Viewer Modal */}
      {activeDetailItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                {activeDetailItem.photoUrl ? (
                  <img
                    src={activeDetailItem.photoUrl}
                    alt={activeDetailItem.fullName}
                    className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-xs"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-slate-900 text-emerald-400 font-bold flex items-center justify-center">
                    {activeDetailItem.fullName.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-base text-slate-900">{activeDetailItem.fullName}</h3>
                    {(() => {
                      const sInfo = getScholarStatusInfo(activeDetailItem.academicStatus, activeDetailItem.customStatusLabel);
                      return (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${sInfo.className}`}>
                          {sInfo.label}
                        </span>
                      );
                    })()}
                  </div>
                  <p className="text-xs text-slate-500">
                    Batch {activeDetailItem.batchYear} &bull; {activeDetailItem.classOrDivision || 'General'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveDetailItem(null)}
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
                {activeDetailItem.qualificationsList && activeDetailItem.qualificationsList.length > 0 ? (
                  <div className="space-y-2">
                    {activeDetailItem.qualificationsList.map((q, idx) => (
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
                      <span className="font-semibold text-slate-800">{activeDetailItem.qualification}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">University</span>
                      <span className="font-semibold text-slate-800">{activeDetailItem.university}</span>
                    </div>
                  </div>
                )}
              </div>

              {(activeDetailItem.currentRole || activeDetailItem.cityCountry) && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  {activeDetailItem.currentRole && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Role</span>
                      <span className="font-medium text-slate-800">{activeDetailItem.currentRole}</span>
                    </div>
                  )}
                  {activeDetailItem.cityCountry && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Location</span>
                      <span className="font-medium text-slate-800">{activeDetailItem.cityCountry}</span>
                    </div>
                  )}
                </div>
              )}

              {activeDetailItem.bio && (
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                    Academic Bio
                  </span>
                  <p className="p-3 bg-white border border-slate-200 rounded-xl text-slate-700 leading-relaxed whitespace-pre-line">
                    {activeDetailItem.bio}
                  </p>
                </div>
              )}

              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Contact Channels
                </span>
                {activeDetailItem.email && (
                  <div className="flex items-center gap-2 text-slate-700">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span>{activeDetailItem.email}</span>
                  </div>
                )}
                {activeDetailItem.phone && (
                  <div className="flex items-center gap-2 text-slate-700">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{activeDetailItem.phone}</span>
                  </div>
                )}
                {activeDetailItem.linkedinUrl && (
                  <div className="flex items-center gap-2 text-blue-600">
                    <ExternalLink className="w-3.5 h-3.5" />
                    <a
                      href={activeDetailItem.linkedinUrl}
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
                onClick={() => setActiveDetailItem(null)}
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

export default ScholarAlumniHubPage;
