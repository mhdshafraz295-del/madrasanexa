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

  const loadProfile = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await profileApi.getProfile();
      if (data) setProfile(data);
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
        ...prev.emergencyContact,
        [field]: value,
      },
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await profileApi.updateProfile({
        phoneNumber: profile.phone,
        whatsappNumber: profile.whatsapp,
        address: profile.residentialAddress,
        emergencyContact: profile.emergencyContact,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err: any) {
      alert(err.message || 'Failed to save profile changes.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddDocument = (e: React.FormEvent) => {
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

    setProfile((prev) => ({
      ...prev,
      documents: [newDoc, ...prev.documents],
      profileCompletionPercentage: Math.min(100, prev.profileCompletionPercentage + 5),
    }));

    setNewDocTitle('');
    setUploadModalOpen(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
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

  return (
    <div className="space-y-6">
      {/* 1. Profile Hero & Photo Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
          <div className="relative">
            <div className="w-24 h-24 rounded-2xl bg-[#0F172A] text-[#37C6A3] font-bold text-3xl flex items-center justify-center border-4 border-slate-100 shadow-md">
              AF
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
              {profile.fullName}
            </h1>
            <p className="text-sm font-arabic text-emerald-800 font-semibold mt-0.5">
              {profile.arabicName}
            </p>
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
          <span>Profile changes saved successfully in local prototype session.</span>
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
                    value={profile.emergencyContact.name}
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
                    value={profile.emergencyContact.relationship}
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
                    value={profile.emergencyContact.phone}
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
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Academic Degrees & University Diplomas
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Verified university transcripts and degree records
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {profile.academicQualifications.map((aq) => (
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
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3" />
                    Verified
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 5: Professional Qualifications & Sanads */}
        {activeTab === 'professional' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Traditional Sanads, Ijazahs & Licenses
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Continuous transmission chains in Quran recitation and Shariah certificates
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {profile.professionalQualifications.map((pq) => (
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
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    Authenticated
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 6: Teaching Experience */}
        {activeTab === 'experience' && (
          <div className="space-y-6">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Prior Pedagogical & Teaching Experience
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Past institutional posts and teaching appointments
              </p>
            </div>

            <div className="space-y-4">
              {profile.teachingExperience.map((te) => (
                <div
                  key={te.id}
                  className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-slate-900">{te.role}</h3>
                      <div className="text-xs text-[#0D9488] font-semibold mt-0.5">{te.institution}</div>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                      {te.period}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                    {te.responsibilities}
                  </p>
                </div>
              ))}
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
              {profile.documents.map((doc) => (
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

                  <div className="mt-3 pt-3 border-t border-slate-200/80 flex items-center justify-between text-xs">
                    <span className="text-[10px] text-slate-400">Uploaded {doc.uploadedDate}</span>
                    <button
                      type="button"
                      onClick={() => alert(`Simulated preview for: ${doc.fileName}`)}
                      className="text-xs font-semibold text-[#0D9488] hover:underline cursor-pointer"
                    >
                      View File
                    </button>
                  </div>
                </div>
              ))}
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
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#0F172A] hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-xs cursor-pointer"
            >
              <Save className="w-4 h-4 text-[#37C6A3]" />
              <span>Save Profile Changes</span>
            </button>
          </div>
        </div>
      </form>

      {/* Upload Document Modal (Prototype Interactive) */}
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
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-[#0D9488] hover:bg-[#0F766E] rounded-xl"
                >
                  Upload & Attach
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
