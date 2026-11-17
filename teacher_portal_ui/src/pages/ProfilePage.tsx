import React, { useState, useEffect } from 'react';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  GraduationCap,
  Award,
  Briefcase,
  FileText,
  Upload,
  CheckCircle2,
  Clock,
  AlertCircle,
  Save,
  Plus,
  Trash2,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  Info,
} from 'lucide-react';
import { MOCK_TEACHER_PROFILE, TeacherProfile } from '../mock/teacherMockData';
import { profileApi } from '../services/api';
import LoadingState from '../components/common/LoadingState';
import ErrorState from '../components/common/ErrorState';

type TabKey = 'personal' | 'contact' | 'address' | 'academic' | 'professional' | 'experience' | 'documents';

export default function ProfilePage() {
  const [profile, setProfile] = useState<TeacherProfile>(MOCK_TEACHER_PROFILE);
  const [activeTab, setActiveTab] = useState<TabKey>('personal');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocCategory, setNewDocCategory] = useState<'Degree' | 'Ijazah' | 'Identity' | 'Clearance'>('Degree');

  // Qualification Modals State
  const [degreeModalOpen, setDegreeModalOpen] = useState(false);
  const [degreeForm, setDegreeForm] = useState({ degree: '', institution: '', year: '', gradeHonor: '' });

  const [sanadModalOpen, setSanadModalOpen] = useState(false);
  const [sanadForm, setSanadForm] = useState({ title: '', issuingBody: '', year: '', credentialId: '' });

  const [expModalOpen, setExpModalOpen] = useState(false);
  const [expForm, setExpForm] = useState({ role: '', institution: '', period: '', responsibilities: '' });

  const loadProfile = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await profileApi.getProfile();
      if (data) {
        setProfile((prev) => ({
          ...prev,
          ...data,
          fullName: data.fullName ?? prev.fullName ?? '',
          arabicName: data.arabicName !== undefined ? data.arabicName : '',
          nicPassport: data.nicPassport !== undefined ? data.nicPassport : '',
          dateOfBirth: data.dateOfBirth !== undefined ? data.dateOfBirth : '',
          gender: data.gender || prev.gender || 'Male',
          maritalStatus: data.maritalStatus || prev.maritalStatus || 'Married',
          bloodGroup: data.bloodGroup || prev.bloodGroup || 'O+',
          residentialAddress: data.residentialAddress !== undefined ? data.residentialAddress : (prev.residentialAddress || ''),
          district: data.district !== undefined ? data.district : (prev.district || ''),
          postalCode: data.postalCode !== undefined ? data.postalCode : (prev.postalCode || ''),
          country: data.country || prev.country || 'Sri Lanka',
          emergencyContact: {
            name: data.emergencyContact?.name || prev.emergencyContact?.name || '',
            relationship: data.emergencyContact?.relationship || prev.emergencyContact?.relationship || '',
            phone: data.emergencyContact?.phone || prev.emergencyContact?.phone || '',
          },
          academicQualifications: Array.isArray(data.academicQualifications) ? data.academicQualifications : (prev.academicQualifications || []),
          professionalQualifications: Array.isArray(data.professionalQualifications) ? data.professionalQualifications : (prev.professionalQualifications || []),
          teachingExperience: Array.isArray(data.teachingExperience) ? data.teachingExperience : (prev.teachingExperience || []),
          documents: Array.isArray(data.documents) ? data.documents : (prev.documents || []),
        }));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load teacher profile.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleInputChange = (field: keyof TeacherProfile, value: any) => {
    setProfile((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleEmergencyChange = (field: 'name' | 'relationship' | 'phone', value: string) => {
    setProfile((prev) => ({
      ...prev,
      emergencyContact: {
        name: prev.emergencyContact?.name || '',
        relationship: prev.emergencyContact?.relationship || '',
        phone: prev.emergencyContact?.phone || '',
        [field]: value,
      },
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await profileApi.updateProfile({
        fullName: profile.fullName,
        arabicName: profile.arabicName,
        phoneNumber: profile.phone,
        whatsappNumber: profile.whatsapp,
        address: profile.residentialAddress,
        residentialAddress: profile.residentialAddress,
        nicPassport: profile.nicPassport,
        dateOfBirth: profile.dateOfBirth,
        gender: profile.gender,
        maritalStatus: profile.maritalStatus,
        bloodGroup: profile.bloodGroup,
        district: profile.district,
        postalCode: profile.postalCode,
        country: profile.country,
        avatarUrl: profile.avatarUrl,
        emergencyContact: profile.emergencyContact,
        academicQualifications: profile.academicQualifications || [],
        professionalQualifications: profile.professionalQualifications || [],
        teachingExperience: profile.teachingExperience || [],
        documents: profile.documents || [],
      });

      // Synchronize updated user name and notify layout of changes
      try {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          const u = JSON.parse(storedUser);
          if (profile.fullName) u.name = profile.fullName;
          localStorage.setItem('user', JSON.stringify(u));
        }
        window.dispatchEvent(new CustomEvent('teacher:profile-updated', { detail: profile }));
      } catch {
        // Ignore storage error
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err: any) {
      alert(err.message || 'Failed to save profile changes.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddDegree = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!degreeForm.degree || !degreeForm.institution) return;
    const newEntry = {
      id: `deg-${Date.now()}`,
      degree: degreeForm.degree,
      institution: degreeForm.institution,
      year: degreeForm.year || new Date().getFullYear().toString(),
      gradeHonor: degreeForm.gradeHonor || 'First Class',
    };
    const updated = [...(profile.academicQualifications || []), newEntry];
    setProfile((prev) => ({ ...prev, academicQualifications: updated }));
    setDegreeModalOpen(false);
    setDegreeForm({ degree: '', institution: '', year: '', gradeHonor: '' });
    try {
      await profileApi.updateProfile({ academicQualifications: updated });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.warn('Background update warning:', err);
    }
  };

  const handleDeleteDegree = async (id: string) => {
    const updated = (profile.academicQualifications || []).filter((q) => q.id !== id);
    setProfile((prev) => ({ ...prev, academicQualifications: updated }));
    try {
      await profileApi.updateProfile({ academicQualifications: updated });
    } catch (err) {
      console.warn('Delete warning:', err);
    }
  };

  const handleAddSanad = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sanadForm.title || !sanadForm.issuingBody) return;
    const newEntry = {
      id: `snd-${Date.now()}`,
      title: sanadForm.title,
      issuingBody: sanadForm.issuingBody,
      year: sanadForm.year || new Date().getFullYear().toString(),
      credentialId: sanadForm.credentialId || undefined,
    };
    const updated = [...(profile.professionalQualifications || []), newEntry];
    setProfile((prev) => ({ ...prev, professionalQualifications: updated }));
    setSanadModalOpen(false);
    setSanadForm({ title: '', issuingBody: '', year: '', credentialId: '' });
    try {
      await profileApi.updateProfile({ professionalQualifications: updated });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.warn('Background update warning:', err);
    }
  };

  const handleDeleteSanad = async (id: string) => {
    const updated = (profile.professionalQualifications || []).filter((s) => s.id !== id);
    setProfile((prev) => ({ ...prev, professionalQualifications: updated }));
    try {
      await profileApi.updateProfile({ professionalQualifications: updated });
    } catch (err) {
      console.warn('Delete warning:', err);
    }
  };

  const handleAddExperience = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expForm.role || !expForm.institution) return;
    const newEntry = {
      id: `exp-${Date.now()}`,
      role: expForm.role,
      institution: expForm.institution,
      period: expForm.period || '2023 - Present',
      responsibilities: expForm.responsibilities || 'Conducting daily curriculum instruction and student mentoring.',
    };
    const updated = [...(profile.teachingExperience || []), newEntry];
    setProfile((prev) => ({ ...prev, teachingExperience: updated }));
    setExpModalOpen(false);
    setExpForm({ role: '', institution: '', period: '', responsibilities: '' });
    try {
      await profileApi.updateProfile({ teachingExperience: updated });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.warn('Background update warning:', err);
    }
  };

  const handleDeleteExperience = async (id: string) => {
    const updated = (profile.teachingExperience || []).filter((e) => e.id !== id);
    setProfile((prev) => ({ ...prev, teachingExperience: updated }));
    try {
      await profileApi.updateProfile({ teachingExperience: updated });
    } catch (err) {
      console.warn('Delete warning:', err);
    }
  };

  const handleAddDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocTitle) return;

    const newDoc = {
      id: `doc-${Date.now()}`,
      title: newDocTitle,
      fileName: `${newDocTitle.toLowerCase().replace(/\s+/g, '_')}.pdf`,
      fileSize: '1.4 MB',
      uploadedDate: new Date().toISOString().split('T')[0],
      status: 'Pending Review' as const,
      category: newDocCategory,
    };

    const updated = [newDoc, ...(profile.documents || [])];
    setProfile((prev) => ({
      ...prev,
      documents: updated,
      profileCompletionPercentage: Math.min(100, prev.profileCompletionPercentage + 5),
    }));

    setNewDocTitle('');
    setUploadModalOpen(false);
    try {
      await profileApi.updateProfile({ documents: updated });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.warn('Upload save warning:', err);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    const updated = (profile.documents || []).filter((d) => d.id !== docId);
    setProfile((prev) => ({
      ...prev,
      documents: updated,
    }));
    try {
      await profileApi.updateProfile({ documents: updated });
    } catch (err) {
      console.warn('Delete doc warning:', err);
    }
  };

  const TABS: { key: TabKey; label: string; icon: any }[] = [
    { key: 'personal', label: 'Personal Information', icon: User },
    { key: 'contact', label: 'Contact & Emergency', icon: Phone },
    { key: 'address', label: 'Residential Address', icon: MapPin },
    { key: 'academic', label: 'Academic Qualifications', icon: GraduationCap },
    { key: 'professional', label: 'Professional Sanads & Ijazahs', icon: Award },
    { key: 'experience', label: 'Teaching Experience', icon: Briefcase },
  ];

  if (isLoading) {
    return <LoadingState message="Loading teacher profile and credentials..." className="my-8" />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadProfile} className="my-8" />;
  }

  const getInitials = (name?: string) => {
    if (!name) return 'TR';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <div className="space-y-6">
      {/* 1. Profile Hero & Photo Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
          <div className="relative">
            <div className="w-24 h-24 rounded-2xl bg-[#0F172A] text-[#37C6A3] font-bold text-3xl flex items-center justify-center border-4 border-slate-100 shadow-md">
              {getInitials(profile.fullName)}
            </div>
            <span className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-white ring-1 ring-emerald-600/20" title="Active Faculty Status" />
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                {profile.status}
              </span>
              <span className="text-xs text-slate-500 font-mono">
                {profile.employeeCode}
              </span>
              <span className="text-xs text-slate-400">• Joined {profile.dateOfJoining}</span>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {profile.fullName || 'Ustadh Profile'}
            </h1>
            {profile.arabicName && (
              <p className="text-sm font-arabic text-emerald-800 font-semibold mt-0.5">
                {profile.arabicName}
              </p>
            )}
            <div className="text-xs text-slate-500 mt-1">
              {profile.designation} — {profile.department}
            </div>
          </div>
        </div>

        {/* Profile Completion Indicator Pill & Skip Notice */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col items-start sm:items-end justify-center shrink-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-slate-700">Profile Completion:</span>
            <span className="text-xs font-black text-[#0D9488]">{profile.profileCompletionPercentage}%</span>
          </div>
          <div className="w-48 bg-slate-200 rounded-full h-2 overflow-hidden mb-2">
            <div
              className="bg-[#0D9488] h-2 rounded-full transition-all duration-300"
              style={{ width: `${profile.profileCompletionPercentage}%` }}
            />
          </div>
          <span className="text-[10px] text-slate-500">
            Completion is <span className="font-bold text-slate-700">optional</span>. You may skip and complete later.
          </span>
        </div>
      </div>

      {/* Save Success Toast */}
      {saveSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-bold text-emerald-900 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Profile changes saved successfully.</span>
        </div>
      )}

      {/* 2. Interactive Navigation Tabs (Desktop Grid & Mobile Horizontal Scroll) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-2 shadow-xs">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-[#0F172A] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#37C6A3]' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Tab Contents Form */}
      <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-7 shadow-xs">
        {/* Tab 1: Personal Information */}
        {activeTab === 'personal' && (
          <div className="space-y-6">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Personal Identity Details
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Official civil and institutional records
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Full English Name
                </label>
                <input
                  type="text"
                  value={profile.fullName}
                  onChange={(e) => handleInputChange('fullName', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Arabic Name (Optional)
                </label>
                <input
                  type="text"
                  dir="rtl"
                  value={profile.arabicName}
                  onChange={(e) => handleInputChange('arabicName', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-arabic text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  National Identity Card (NIC) / Passport
                </label>
                <input
                  type="text"
                  value={profile.nicPassport}
                  onChange={(e) => handleInputChange('nicPassport', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Date of Birth
                </label>
                <input
                  type="text"
                  value={profile.dateOfBirth}
                  onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Gender
                </label>
                <select
                  value={profile.gender}
                  onChange={(e) => handleInputChange('gender', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D9488] bg-white"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Blood Group
                </label>
                <select
                  value={profile.bloodGroup}
                  onChange={(e) => handleInputChange('bloodGroup', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D9488] bg-white"
                >
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Contact Information */}
        {activeTab === 'contact' && (
          <div className="space-y-6">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Contact & Emergency Reachability
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Official institutional communication and family emergency contacts
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Faculty Official Email
                </label>
                <input
                  type="email"
                  value={profile.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mobile Telephone
                </label>
                <input
                  type="text"
                  value={profile.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  WhatsApp Contact
                </label>
                <input
                  type="text"
                  value={profile.whatsapp}
                  onChange={(e) => handleInputChange('whatsapp', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
                Emergency Contact Person
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Contact Name
                  </label>
                  <input
                    type="text"
                    value={profile.emergencyContact?.name || ''}
                    onChange={(e) => handleEmergencyChange('name', e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Relationship
                  </label>
                  <input
                    type="text"
                    value={profile.emergencyContact?.relationship || ''}
                    onChange={(e) => handleEmergencyChange('relationship', e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Emergency Phone
                  </label>
                  <input
                    type="text"
                    value={profile.emergencyContact?.phone || ''}
                    onChange={(e) => handleEmergencyChange('phone', e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Residential Address */}
        {activeTab === 'address' && (
          <div className="space-y-6">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Permanent & Residential Address
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Primary mailing and residential coordinates
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Street Address & House Number
                </label>
                <input
                  type="text"
                  value={profile.residentialAddress}
                  onChange={(e) => handleInputChange('residentialAddress', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  District / Province
                </label>
                <input
                  type="text"
                  value={profile.district}
                  onChange={(e) => handleInputChange('district', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Postal Code
                </label>
                <input
                  type="text"
                  value={profile.postalCode}
                  onChange={(e) => handleInputChange('postalCode', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Country
                </label>
                <input
                  type="text"
                  value={profile.country}
                  onChange={(e) => handleInputChange('country', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Academic Qualifications */}
        {activeTab === 'academic' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Academic Degrees & University Diplomas
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Verified university transcripts and degree records
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDegreeModalOpen(true)}
                className="px-3.5 py-1.5 rounded-xl bg-[#0F172A] hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 transition self-start sm:self-auto cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-[#37C6A3]" />
                <span>Add Qualification</span>
              </button>
            </div>

            <div className="space-y-3">
              {(profile.academicQualifications || []).length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <GraduationCap className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-600">No academic degrees recorded yet.</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Click "Add Qualification" above to add your university degree or diploma.</p>
                </div>
              ) : (
                (profile.academicQualifications || []).map((aq) => (
                  <div
                    key={aq.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex items-start justify-between gap-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-teal-100 text-[#0D9488] flex items-center justify-center font-bold text-sm shrink-0">
                        <GraduationCap className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-slate-900">{aq.degree}</h3>
                        <div className="text-xs text-slate-600 mt-0.5">{aq.institution}</div>
                        <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
                          <span>Year: <strong className="text-slate-700">{aq.year}</strong></span>
                          <span>•</span>
                          <span>Honor: <strong className="text-emerald-700">{aq.gradeHonor}</strong></span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" />
                        Verified
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteDegree(aq.id)}
                        className="text-slate-400 hover:text-rose-600 transition p-1 cursor-pointer"
                        title="Delete Qualification"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 5: Professional Qualifications & Sanads */}
        {activeTab === 'professional' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Traditional Sanads, Ijazahs & Licenses
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Continuous transmission chains in Quran recitation and Shariah certificates
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSanadModalOpen(true)}
                className="px-3.5 py-1.5 rounded-xl bg-[#0F172A] hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 transition self-start sm:self-auto cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-[#37C6A3]" />
                <span>Add Sanad / Ijazah</span>
              </button>
            </div>

            <div className="space-y-3">
              {(profile.professionalQualifications || []).length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <Award className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-600">No traditional sanads or ijazahs on record.</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Click "Add Sanad / Ijazah" above to register your traditional sanad or teaching license.</p>
                </div>
              ) : (
                (profile.professionalQualifications || []).map((pq) => (
                  <div
                    key={pq.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex items-start justify-between gap-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-sm shrink-0">
                        <Award className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-slate-900">{pq.title}</h3>
                        <div className="text-xs text-slate-600 mt-0.5">{pq.issuingBody}</div>
                        <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
                          <span>Year: <strong className="text-slate-700">{pq.year}</strong></span>
                          {pq.credentialId && (
                            <>
                              <span>•</span>
                              <span className="font-mono text-slate-600">ID: {pq.credentialId}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        Authenticated
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteSanad(pq.id)}
                        className="text-slate-400 hover:text-rose-600 transition p-1 cursor-pointer"
                        title="Delete Sanad"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 6: Teaching Experience */}
        {activeTab === 'experience' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Prior Pedagogical & Teaching Experience
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Past institutional posts and teaching appointments
                </p>
              </div>
              <button
                type="button"
                onClick={() => setExpModalOpen(true)}
                className="px-3.5 py-1.5 rounded-xl bg-[#0F172A] hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 transition self-start sm:self-auto cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-[#37C6A3]" />
                <span>Add Experience</span>
              </button>
            </div>

            <div className="space-y-4">
              {(profile.teachingExperience || []).length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <Briefcase className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-600">No prior appointments listed.</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Click "Add Experience" above to list previous madrasa or school teaching positions.</p>
                </div>
              ) : (
                (profile.teachingExperience || []).map((te) => (
                  <div
                    key={te.id}
                    className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-xs font-bold text-slate-900">{te.role}</h3>
                        <div className="text-xs text-[#0D9488] font-semibold mt-0.5">{te.institution}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                          {te.period}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteExperience(te.id)}
                          className="text-slate-400 hover:text-rose-600 transition p-1 cursor-pointer"
                          title="Delete Experience"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                      {te.responsibilities}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 7: Certificates & Documents */}
        {activeTab === 'documents' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Faculty Credential Documents & Scans
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  PDF / JPEG copies of Sanads, national identity, and educational certificates
                </p>
              </div>
              <button
                type="button"
                onClick={() => setUploadModalOpen(true)}
                className="px-3.5 py-1.5 rounded-xl bg-[#0F172A] hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 transition self-start sm:self-auto cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-[#37C6A3]" />
                <span>Upload New Document</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(profile.documents || []).length === 0 ? (
                <div className="sm:col-span-2 p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-600">No faculty documents uploaded yet.</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Click "Upload New Document" above to upload certificates, degree scans, or ID.</p>
                </div>
              ) : (
                (profile.documents || []).map((doc) => (
                  <div
                    key={doc.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-200 text-slate-700 uppercase">
                          {doc.category}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            doc.status === 'Verified'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {doc.status}
                        </span>
                      </div>
                      <h3 className="text-xs font-bold text-slate-900 leading-snug">
                        {doc.title}
                      </h3>
                      <div className="text-[11px] text-slate-500 font-mono mt-1 truncate">
                        {doc.fileName} • {doc.fileSize}
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-200/80 flex items-center justify-between text-[11px] text-slate-500">
                      <span>Uploaded {doc.uploadedDate}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteDocument(doc.id)}
                        className="text-slate-400 hover:text-rose-600 transition"
                        title="Delete Document"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Global Save Controls Footer */}
        <div className="mt-8 pt-5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Info className="w-4 h-4 text-slate-400 shrink-0" />
            <span>Profile updates are optional and can be resumed at any point.</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="submit"
              disabled={isSaving}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#0F172A] hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4 text-[#37C6A3]" />
              <span>{isSaving ? 'Saving Changes...' : 'Save Profile Changes'}</span>
            </button>
          </div>
        </div>
      </form>

      {/* Upload Document Modal */}
      {uploadModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-2">Upload Faculty Credential</h3>
            <p className="text-xs text-slate-600 mb-4">
              Select certificate category and provide a descriptive label. Files are verified by institutional administrators.
            </p>
            <form onSubmit={handleAddDocument} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Document Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Master in Arabic Pedagogy Sanad"
                  value={newDocTitle}
                  onChange={(e) => setNewDocTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Category
                </label>
                <select
                  value={newDocCategory}
                  onChange={(e) => setNewDocCategory(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D9488] bg-white"
                >
                  <option value="Degree">Degree / Academic Diploma</option>
                  <option value="Ijazah">Sanad / Ijazah Certificate</option>
                  <option value="Identity">Civil Identity / Passport</option>
                  <option value="Clearance">Police / Medical Clearance</option>
                </select>
              </div>

              <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 text-center bg-slate-50">
                <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
                <span className="text-xs font-semibold text-slate-700 block">
                  Simulated File Dropzone
                </span>
                <span className="text-[10px] text-slate-500">
                  Accepts PDF, JPG, PNG up to 10MB
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setUploadModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-[#0D9488] hover:bg-[#0F766E] rounded-xl cursor-pointer"
                >
                  Upload & Attach
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Degree Modal */}
      {degreeModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-2 mb-2">
              <GraduationCap className="w-5 h-5 text-[#0D9488]" />
              <h3 className="text-base font-bold text-slate-900">Add Academic Degree / Diploma</h3>
            </div>
            <p className="text-xs text-slate-600 mb-4">
              Enter details of your university degree, diploma, or higher educational qualification.
            </p>
            <form onSubmit={handleAddDegree} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Degree / Diploma Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bachelor of Arts in Islamic Studies"
                  value={degreeForm.degree}
                  onChange={(e) => setDegreeForm({ ...degreeForm, degree: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Institution / University *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Jamiah Naleemiah / University of Peradeniya"
                  value={degreeForm.institution}
                  onChange={(e) => setDegreeForm({ ...degreeForm, institution: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Graduation Year
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 2023"
                    value={degreeForm.year}
                    onChange={(e) => setDegreeForm({ ...degreeForm, year: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Class / Grade Honor
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. First Class / Distinction"
                    value={degreeForm.gradeHonor}
                    onChange={(e) => setDegreeForm({ ...degreeForm, gradeHonor: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDegreeModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-[#0D9488] hover:bg-[#0F766E] rounded-xl cursor-pointer"
                >
                  Save Qualification
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Sanad Modal */}
      {sanadModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-2 mb-2">
              <Award className="w-5 h-5 text-amber-600" />
              <h3 className="text-base font-bold text-slate-900">Add Traditional Sanad / Ijazah</h3>
            </div>
            <p className="text-xs text-slate-600 mb-4">
              Enter your continuous transmission chain (Sanad) in Qira'at or Islamic Sciences certificate.
            </p>
            <form onSubmit={handleAddSanad} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Sanad / Ijazah Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sanad in Hafs 'an 'Asim (Shatibiyyah)"
                  value={sanadForm.title}
                  onChange={(e) => setSanadForm({ ...sanadForm, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Issuing Sheikh / Academy *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Markaz al-Qira'at / Sheikh Abdullah"
                  value={sanadForm.issuingBody}
                  onChange={(e) => setSanadForm({ ...sanadForm, issuingBody: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Certification Year
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 2022"
                    value={sanadForm.year}
                    onChange={(e) => setSanadForm({ ...sanadForm, year: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Credential / Sanad ID
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. IJZ-8821 (Optional)"
                    value={sanadForm.credentialId}
                    onChange={(e) => setSanadForm({ ...sanadForm, credentialId: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSanadModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-[#0D9488] hover:bg-[#0F766E] rounded-xl cursor-pointer"
                >
                  Save Sanad
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Experience Modal */}
      {expModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-2 mb-2">
              <Briefcase className="w-5 h-5 text-[#0F172A]" />
              <h3 className="text-base font-bold text-slate-900">Add Teaching Experience</h3>
            </div>
            <p className="text-xs text-slate-600 mb-4">
              Enter prior teaching appointments at madrasas, colleges, or Islamic institutes.
            </p>
            <form onSubmit={handleAddExperience} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Designation / Role *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Senior Tajweed & Qira'at Lecturer"
                  value={expForm.role}
                  onChange={(e) => setExpForm({ ...expForm, role: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Madrasa / School / Institute *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Madrasathul Falah Arabic College"
                  value={expForm.institution}
                  onChange={(e) => setExpForm({ ...expForm, institution: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tenure / Period
                </label>
                <input
                  type="text"
                  placeholder="e.g. 2020 – 2024"
                  value={expForm.period}
                  onChange={(e) => setExpForm({ ...expForm, period: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Key Responsibilities / Subjects
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Supervised senior Hifz curriculum and taught Qira'at al-Sab'ah."
                  value={expForm.responsibilities}
                  onChange={(e) => setExpForm({ ...expForm, responsibilities: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setExpModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-[#0D9488] hover:bg-[#0F766E] rounded-xl cursor-pointer"
                >
                  Save Experience
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
