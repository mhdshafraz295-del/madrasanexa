import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  GraduationCap,
  Search,
  ShieldCheck,
  Award,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Lock,
  Download,
  Send,
  Eye,
  Plus,
  RefreshCw,
  Building2,
  Sparkles,
  UserCheck,
  History,
  X,
  FileUp,
  ShieldAlert,
} from 'lucide-react';
import {
  apiListAlumni,
  apiCreateAlumniProfile,
  apiRecordConsent,
  apiRenewConsent,
  apiWithdrawConsent,
  apiPublishAlumniProfile,
  apiUnpublishAlumniProfile,
  apiRevokeAlumniProfile,
  apiGetEligibleStudents,
  apiSearchGlobalDirectory,
  apiGetGlobalAlumniProfile,
  apiCreateVerificationRequest,
  apiListIncomingVerificationRequests,
  apiListOutgoingVerificationRequests,
  apiRespondToVerificationRequest,
  apiDownloadAlumniCertificate,
  type AlumniProfileItem,
  type EligibleStudentItem,
  type GlobalDirectorySearchResult,
  type GlobalAlumniProfileView,
  type VerificationRequestItem,
  type CharacterConductRating,
  type AlumniPublicationStatus,
  type AlumniConsentParty,
  type AlumniConsentProofType,
} from '../../services/api';

export default function AlumniManagementPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'roster'; // 'roster' | 'directory' | 'verifications'

  const setActiveTab = (tab: string) => {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set('tab', tab);
      return p;
    });
  };

  // Notification Banner
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const showBanner = (type: 'success' | 'error', message: string) => {
    setBanner({ type, message });
    setTimeout(() => setBanner(null), 6000);
  };

  // ============================================================================
  // TAB 1: INSTITUTION ALUMNI ROSTER STATE
  // ============================================================================
  const [alumniList, setAlumniList] = useState<AlumniProfileItem[]>([]);
  const [alumniTotal, setAlumniTotal] = useState(0);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterSearch, setRosterSearch] = useState('');
  const [pubFilter, setPubFilter] = useState('');
  const [consentFilter, setConsentFilter] = useState('');
  const [rosterPage, setRosterPage] = useState(1);

  // Modals for Roster
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState<AlumniProfileItem | null>(null);
  const [consentModalMode, setConsentModalMode] = useState<'RECORD' | 'RENEW'>('RECORD');
  const [showWithdrawModal, setShowWithdrawModal] = useState<AlumniProfileItem | null>(null);
  const [showRevokeModal, setShowRevokeModal] = useState<AlumniProfileItem | null>(null);
  const [showAuditDrawer, setShowAuditDrawer] = useState<AlumniProfileItem | null>(null);

  // Form states for Create Modal
  const [eligibleStudents, setEligibleStudents] = useState<EligibleStudentItem[]>([]);
  const [eligibleSearch, setEligibleSearch] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [leavingDate, setLeavingDate] = useState('');
  const [leavingReason, setLeavingReason] = useState('GRADUATION');
  const [characterAssessment, setCharacterAssessment] = useState<CharacterConductRating | ''>('');
  const [characterNotes, setCharacterNotes] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [createSubmitting, setCreateSubmitting] = useState(false);

  // Consent Modal Form states
  const [consentParty, setConsentParty] = useState<AlumniConsentParty>('STUDENT');
  const [consentSignerName, setConsentSignerName] = useState('');
  const [consentProofType, setConsentProofType] = useState<AlumniConsentProofType>('SIGNED_PHYSICAL_FORM');
  const [consentFile, setConsentFile] = useState<File | null>(null);
  const [consentNotes, setConsentNotes] = useState('');
  const [consentSubmitting, setConsentSubmitting] = useState(false);

  // Withdraw / Revoke Form states
  const [actionReason, setActionReason] = useState('');
  const [actionSubmitting, setActionSubmitting] = useState(false);

  // Load Institution Alumni
  const fetchRoster = useCallback(async () => {
    setRosterLoading(true);
    try {
      const res = await apiListAlumni({
        search: rosterSearch.trim() || undefined,
        publicationStatus: pubFilter || undefined,
        consentStatus: consentFilter || undefined,
        page: rosterPage,
        limit: 15,
      });
      setAlumniList(res.data);
      setAlumniTotal(res.pagination.total);
    } catch (err: any) {
      showBanner('error', err.response?.data?.message || 'Failed to load alumni roster.');
    } finally {
      setRosterLoading(false);
    }
  }, [rosterSearch, pubFilter, consentFilter, rosterPage]);

  useEffect(() => {
    if (activeTab === 'roster') {
      fetchRoster();
    }
  }, [activeTab, fetchRoster]);

  // Load eligible students for create modal
  const fetchEligibleStudents = async (query = '') => {
    try {
      const res = await apiGetEligibleStudents(query);
      setEligibleStudents(res);
    } catch (err: any) {
      console.error('Failed to load eligible students:', err);
    }
  };

  const openCreateModal = () => {
    fetchEligibleStudents();
    setSelectedStudentId('');
    setLeavingDate(new Date().toISOString().split('T')[0]);
    setLeavingReason('GRADUATION');
    setCharacterAssessment('');
    setCharacterNotes('');
    setAdminNotes('');
    setShowCreateModal(true);
  };

  const handleCreateAlumni = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId) {
      showBanner('error', 'Please select an eligible student.');
      return;
    }
    if (!leavingDate) {
      showBanner('error', 'Please specify the leaving date.');
      return;
    }

    setCreateSubmitting(true);
    try {
      await apiCreateAlumniProfile({
        studentId: selectedStudentId,
        leavingDate,
        leavingReason,
        characterAssessment: characterAssessment ? (characterAssessment as CharacterConductRating) : undefined,
        characterAssessmentNotes: characterNotes || undefined,
        adminPrivateNotes: adminNotes || undefined,
      });
      showBanner('success', 'Alumni Profile created successfully with permanent index sequence.');
      setShowCreateModal(false);
      fetchRoster();
    } catch (err: any) {
      showBanner('error', err.response?.data?.message || 'Failed to create alumni profile.');
    } finally {
      setCreateSubmitting(false);
    }
  };

  // Consent Actions
  const handleRecordConsent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showConsentModal) return;
    if (!consentSignerName.trim()) {
      showBanner('error', 'Signer name is required.');
      return;
    }
    if (consentModalMode === 'RENEW' && !consentFile) {
      showBanner('error', 'Fresh proof document is mandatory for consent renewal.');
      return;
    }

    setConsentSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('consentParty', consentParty);
      formData.append('signerName', consentSignerName.trim());
      formData.append('proofType', consentProofType);
      formData.append('consentVersion', 'v1.0-2026');
      if (consentNotes.trim()) formData.append('consentNotes', consentNotes.trim());
      if (consentFile) formData.append('consentFile', consentFile);

      if (consentModalMode === 'RECORD') {
        await apiRecordConsent(showConsentModal.id, formData);
        showBanner('success', 'Student consent recorded and verified.');
      } else {
        await apiRenewConsent(showConsentModal.id, formData);
        showBanner('success', 'Consent renewed successfully with verified document.');
      }
      setShowConsentModal(null);
      fetchRoster();
    } catch (err: any) {
      showBanner('error', err.response?.data?.message || 'Failed to submit consent.');
    } finally {
      setConsentSubmitting(false);
    }
  };

  const handleWithdrawConsent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showWithdrawModal) return;
    if (!actionReason.trim()) {
      showBanner('error', 'Withdrawal reason is required.');
      return;
    }

    setActionSubmitting(true);
    try {
      await apiWithdrawConsent(showWithdrawModal.id, actionReason.trim());
      showBanner('success', 'Consent withdrawn. Profile unpublished and file access blocked immediately.');
      setShowWithdrawModal(null);
      setActionReason('');
      fetchRoster();
    } catch (err: any) {
      showBanner('error', err.response?.data?.message || 'Failed to withdraw consent.');
    } finally {
      setActionSubmitting(false);
    }
  };

  const handlePublish = async (alumni: AlumniProfileItem) => {
    if (alumni.consentStatus !== 'GRANTED') {
      showBanner('error', 'Publication requires valid student/guardian consent.');
      return;
    }
    try {
      await apiPublishAlumniProfile(alumni.id);
      showBanner('success', 'Profile published to the Global Alumni Directory.');
      fetchRoster();
    } catch (err: any) {
      showBanner('error', err.response?.data?.message || 'Failed to publish profile.');
    }
  };

  const handleUnpublish = async (alumni: AlumniProfileItem) => {
    try {
      await apiUnpublishAlumniProfile(alumni.id);
      showBanner('success', 'Profile unpublished from Global Alumni Directory.');
      fetchRoster();
    } catch (err: any) {
      showBanner('error', err.response?.data?.message || 'Failed to unpublish profile.');
    }
  };

  const handleRevoke = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showRevokeModal) return;
    setActionSubmitting(true);
    try {
      await apiRevokeAlumniProfile(showRevokeModal.id, actionReason.trim() || 'Administrative revocation');
      showBanner('success', 'Publication revoked.');
      setShowRevokeModal(null);
      setActionReason('');
      fetchRoster();
    } catch (err: any) {
      showBanner('error', err.response?.data?.message || 'Failed to revoke publication.');
    } finally {
      setActionSubmitting(false);
    }
  };

  // ============================================================================
  // TAB 2: GLOBAL ALUMNI DIRECTORY STATE
  // ============================================================================
  const [dirIndexNumber, setDirIndexNumber] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [dirResults, setDirResults] = useState<GlobalDirectorySearchResult[]>([]);
  const [dirTotal, setDirTotal] = useState(0);
  const [dirLoading, setDirLoading] = useState(false);
  const [, setDirPage] = useState(1);
  const [selectedGlobalProfile, setSelectedGlobalProfile] = useState<GlobalAlumniProfileView | null>(null);
  const [globalProfileLoading, setGlobalProfileLoading] = useState(false);
  const [viewingIndexNumber, setViewingIndexNumber] = useState<string | null>(null);

  // Inquire Verification Modal
  const [showInquireModal, setShowInquireModal] = useState<GlobalAlumniProfileView | null>(null);
  const [inquirePurpose, setInquirePurpose] = useState('ACADEMIC_ADMISSION');
  const [inquireNotes, setInquireNotes] = useState('');
  const [inquireSubmitting, setInquireSubmitting] = useState(false);

  const searchDirectory = useCallback(async (pageToLoad = 1) => {
    const trimmed = dirIndexNumber.trim();
    if (!trimmed) {
      showBanner('error', 'Please enter an Alumni Index Number to search.');
      return;
    }

    setDirLoading(true);
    setHasSearched(true);
    try {
      const res = await apiSearchGlobalDirectory({
        indexNumber: trimmed,
        q: trimmed,
        page: pageToLoad,
        limit: 12,
      });
      setDirResults(res.data);
      setDirTotal(res.pagination.total);
      setDirPage(pageToLoad);
    } catch (err: any) {
      setDirResults([]);
      setDirTotal(0);
      showBanner('error', err.response?.data?.message || 'Directory search failed.');
    } finally {
      setDirLoading(false);
    }
  }, [dirIndexNumber]);

  const handleClearDirectorySearch = () => {
    setDirIndexNumber('');
    setDirResults([]);
    setDirTotal(0);
    setHasSearched(false);
    setDirPage(1);
  };

  const viewGlobalProfile = async (indexNumber: string) => {
    if (!indexNumber) return;
    setViewingIndexNumber(indexNumber);
    setGlobalProfileLoading(true);
    try {
      const profile = await apiGetGlobalAlumniProfile(indexNumber);
      setSelectedGlobalProfile(profile);
    } catch (err: any) {
      showBanner('error', err.response?.data?.message || 'Failed to load alumni profile.');
    } finally {
      setGlobalProfileLoading(false);
      setViewingIndexNumber(null);
    }
  };

  const handleInquireVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showInquireModal) return;
    setInquireSubmitting(true);
    try {
      await apiCreateVerificationRequest({
        alumniIndexNumber: showInquireModal.alumniIndexNumber,
        purpose: inquirePurpose,
        notes: inquireNotes.trim() || undefined,
      });
      showBanner('success', 'Verification inquiry dispatched to issuing madrasa administration.');
      setShowInquireModal(null);
      setInquireNotes('');
      // Refresh profile view
      viewGlobalProfile(showInquireModal.alumniIndexNumber);
    } catch (err: any) {
      showBanner('error', err.response?.data?.message || 'Failed to submit verification inquiry.');
    } finally {
      setInquireSubmitting(false);
    }
  };

  // Certificate Download
  const handleDownloadCertificate = async (alumniId: string, qualId: string, title: string) => {
    try {
      showBanner('success', 'Fetching verified certificate stream...');
      await apiDownloadAlumniCertificate(alumniId, qualId, `${title.replace(/\s+/g, '_')}_Certificate.pdf`);
    } catch (err: any) {
      showBanner('error', err.response?.data?.message || 'Failed to download certificate.');
    }
  };

  // ============================================================================
  // TAB 3: ACADEMIC VERIFICATION HUB STATE
  // ============================================================================
  const [hubSubTab, setHubSubTab] = useState<'incoming' | 'outgoing'>('incoming');
  const [incomingList, setIncomingList] = useState<VerificationRequestItem[]>([]);
  const [incomingTotal, setIncomingTotal] = useState(0);
  const [outgoingList, setOutgoingList] = useState<VerificationRequestItem[]>([]);
  const [outgoingTotal, setOutgoingTotal] = useState(0);
  const [hubLoading, setHubLoading] = useState(false);

  // Response Modal for Incoming Request
  const [showRespondModal, setShowRespondModal] = useState<VerificationRequestItem | null>(null);
  const [respondAction, setRespondAction] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [respondNotes, setRespondNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [respondSubmitting, setRespondSubmitting] = useState(false);

  const fetchHubRequests = useCallback(async () => {
    setHubLoading(true);
    try {
      if (hubSubTab === 'incoming') {
        const res = await apiListIncomingVerificationRequests();
        setIncomingList(res.data);
        setIncomingTotal(res.pagination.total);
      } else {
        const res = await apiListOutgoingVerificationRequests();
        setOutgoingList(res.data);
        setOutgoingTotal(res.pagination.total);
      }
    } catch (err: any) {
      showBanner('error', err.response?.data?.message || 'Failed to load verification requests.');
    } finally {
      setHubLoading(false);
    }
  }, [hubSubTab]);

  useEffect(() => {
    if (activeTab === 'verifications') {
      fetchHubRequests();
    }
  }, [activeTab, hubSubTab, fetchHubRequests]);

  const handleRespondToRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showRespondModal) return;
    if (respondAction === 'REJECT' && !rejectionReason.trim()) {
      showBanner('error', 'Rejection reason is required.');
      return;
    }

    setRespondSubmitting(true);
    try {
      await apiRespondToVerificationRequest(showRespondModal.id, {
        action: respondAction,
        notes: respondNotes.trim() || undefined,
        rejectionReason: respondAction === 'REJECT' ? rejectionReason.trim() : undefined,
      });
      showBanner('success', `Verification request ${respondAction === 'APPROVE' ? 'approved' : 'rejected'}.`);
      setShowRespondModal(null);
      setRespondNotes('');
      setRejectionReason('');
      fetchHubRequests();
    } catch (err: any) {
      showBanner('error', err.response?.data?.message || 'Failed to respond to request.');
    } finally {
      setRespondSubmitting(false);
    }
  };

  // Helper Badge Renderers
  const renderPublicationBadge = (status: AlumniPublicationStatus) => {
    switch (status) {
      case 'PUBLISHED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Published
          </span>
        );
      case 'DRAFT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" /> Draft
          </span>
        );
      case 'UNPUBLISHED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-300">
            <Lock className="w-3 h-3 text-gray-500" /> Unpublished
          </span>
        );
      case 'REVOKED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200">
            <XCircle className="w-3 h-3 text-rose-600" /> Revoked
          </span>
        );
    }
  };

  const renderConsentBadge = (status: string) => {
    switch (status) {
      case 'GRANTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <ShieldCheck className="w-3 h-3 text-emerald-600" /> Consent Granted
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" /> Awaiting Consent
          </span>
        );
      case 'WITHDRAWN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200">
            <ShieldAlert className="w-3 h-3 text-rose-600" /> Withdrawn
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-300">
            {status}
          </span>
        );
    }
  };

  const renderConductBadge = (rating?: CharacterConductRating | null) => {
    if (!rating) return <span className="text-xs text-gray-400 italic">Not Assessed</span>;
    const colors: Record<CharacterConductRating, string> = {
      EXCELLENT: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      VERY_GOOD: 'bg-teal-50 text-teal-800 border-teal-200',
      GOOD: 'bg-blue-50 text-blue-800 border-blue-200',
      SATISFACTORY: 'bg-amber-50 text-amber-800 border-amber-200',
      UNDER_OBSERVATION: 'bg-purple-50 text-purple-800 border-purple-200',
    };
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
          colors[rating] || 'bg-gray-50 text-gray-700 border-gray-200'
        }`}
      >
        {rating.replace('_', ' ')}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-gradient-to-r from-[#0B3028] via-[#075E46] to-[#043D2D] rounded-2xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#D8B66A]/20 via-transparent to-transparent pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-[#D8B66A] text-xs font-semibold uppercase tracking-wider mb-1">
              <Sparkles className="w-4 h-4" />
              <span>Institutional Network & Credential Integrity</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-white tracking-tight">
              Alumni & Academic Verification Network
            </h1>
            <p className="text-sm text-emerald-100/90 mt-1 max-w-2xl">
              Publish verified alumni profiles, manage consent audit trails, search participating madrasa records,
              and process cross-institutional academic verification requests.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#D8B66A] to-[#B38F39] text-[#0B3028] text-xs font-bold rounded-xl shadow-md hover:brightness-105 active:scale-95 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Create Alumni Profile</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 mt-6 pt-6 border-t border-emerald-700/50">
          <button
            onClick={() => setActiveTab('roster')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
              activeTab === 'roster'
                ? 'bg-white text-[#0B3028] shadow-md'
                : 'text-emerald-100/80 hover:text-white hover:bg-emerald-800/40'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            <span>Institution Alumni Roster</span>
            <span
              className={`ml-1 text-[10px] px-2 py-0.5 rounded-full ${
                activeTab === 'roster' ? 'bg-[#0B3028] text-white' : 'bg-emerald-800 text-emerald-200'
              }`}
            >
              {alumniTotal}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('directory')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
              activeTab === 'directory'
                ? 'bg-white text-[#0B3028] shadow-md'
                : 'text-emerald-100/80 hover:text-white hover:bg-emerald-800/40'
            }`}
          >
            <Search className="w-4 h-4" />
            <span>Global Alumni Directory</span>
          </button>

          <button
            onClick={() => setActiveTab('verifications')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
              activeTab === 'verifications'
                ? 'bg-white text-[#0B3028] shadow-md'
                : 'text-emerald-100/80 hover:text-white hover:bg-emerald-800/40'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Verification Hub</span>
            {incomingTotal > 0 && (
              <span className="ml-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-500 text-white font-bold animate-pulse">
                {incomingTotal}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {banner && (
        <div
          className={`p-4 rounded-xl text-xs font-medium flex items-center justify-between border ${
            banner.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {banner.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{banner.message}</span>
          </div>
          <button onClick={() => setBanner(null)} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: INSTITUTION ALUMNI ROSTER                                          */}
      {/* ========================================================================= */}
      {activeTab === 'roster' && (
        <div className="space-y-6">
          {/* Filters Bar */}
          <div className="bg-white rounded-2xl border border-[#E7E9EE] p-4 shadow-xs flex flex-col md:flex-row items-center gap-3 justify-between">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={rosterSearch}
                onChange={(e) => setRosterSearch(e.target.value)}
                placeholder="Search alumni by name or index..."
                className="w-full pl-10 pr-4 py-2 text-xs border border-[#E7E9EE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#075E46]/20 focus:border-[#075E46]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <select
                value={pubFilter}
                onChange={(e) => setPubFilter(e.target.value)}
                className="text-xs border border-[#E7E9EE] rounded-xl px-3 py-2 bg-white text-gray-700 focus:outline-none focus:border-[#075E46]"
              >
                <option value="">All Publications</option>
                <option value="PUBLISHED">Published</option>
                <option value="DRAFT">Draft</option>
                <option value="UNPUBLISHED">Unpublished</option>
                <option value="REVOKED">Revoked</option>
              </select>

              <select
                value={consentFilter}
                onChange={(e) => setConsentFilter(e.target.value)}
                className="text-xs border border-[#E7E9EE] rounded-xl px-3 py-2 bg-white text-gray-700 focus:outline-none focus:border-[#075E46]"
              >
                <option value="">All Consent States</option>
                <option value="GRANTED">Consent Granted</option>
                <option value="PENDING">Awaiting Consent</option>
                <option value="WITHDRAWN">Withdrawn</option>
              </select>

              <button
                onClick={fetchRoster}
                className="p-2 text-gray-500 hover:text-gray-900 border border-[#E7E9EE] rounded-xl hover:bg-gray-50 transition"
                title="Refresh Roster"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Alumni Table */}
          <div className="bg-white rounded-2xl border border-[#E7E9EE] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAFBF9] border-b border-[#E7E9EE] text-gray-500 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Alumni Index</th>
                    <th className="py-3 px-4">Student Name</th>
                    <th className="py-3 px-4">Leaving Date</th>
                    <th className="py-3 px-4">Publication</th>
                    <th className="py-3 px-4">Consent Status</th>
                    <th className="py-3 px-4">Conduct Assessment</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7E9EE]">
                  {rosterLoading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-gray-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#075E46]" />
                        <span>Loading alumni directory...</span>
                      </td>
                    </tr>
                  ) : alumniList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-gray-500">
                        <GraduationCap className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                        <p className="font-semibold text-gray-700">No Alumni Records Found</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          Create an alumni profile for graduating or leaving students.
                        </p>
                        <button
                          onClick={openCreateModal}
                          className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#075E46] text-white text-xs font-semibold rounded-lg hover:bg-[#043D2D] transition"
                        >
                          <Plus className="w-3.5 h-3.5" /> Create Profile
                        </button>
                      </td>
                    </tr>
                  ) : (
                    alumniList.map((alumni) => (
                      <tr key={alumni.id} className="hover:bg-gray-50/70 transition">
                        <td className="py-3.5 px-4">
                          <span className="font-mono text-xs font-bold text-[#0B3028] bg-emerald-50/80 px-2.5 py-1 rounded-md border border-emerald-200">
                            {alumni.alumniIndexNumber}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-medium text-gray-900">
                          <div>{alumni.student?.fullName || '—'}</div>
                          <div className="text-[10px] text-gray-400 font-mono">
                            Adm: {alumni.student?.admissionNumber || '—'}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-gray-600">
                          {alumni.leavingDate?.split('T')[0] || '—'}
                          <div className="text-[10px] text-gray-400 capitalize">
                            {alumni.leavingReason?.toLowerCase() || 'Graduation'}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">{renderPublicationBadge(alumni.publicationStatus)}</td>
                        <td className="py-3.5 px-4">
                          {renderConsentBadge(alumni.consentStatus)}
                          {alumni.consentSignerName && (
                            <div className="text-[10px] text-gray-400">By {alumni.consentSignerName}</div>
                          )}
                        </td>
                        <td className="py-3.5 px-4">{renderConductBadge(alumni.characterAssessment)}</td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Consent Button */}
                            {alumni.consentStatus !== 'GRANTED' ? (
                              <button
                                onClick={() => {
                                  setShowConsentModal(alumni);
                                  setConsentModalMode(alumni.consentStatus === 'WITHDRAWN' ? 'RENEW' : 'RECORD');
                                  setConsentParty('STUDENT');
                                  setConsentSignerName(alumni.student.fullName);
                                  setConsentProofType('SIGNED_PHYSICAL_FORM');
                                  setConsentFile(null);
                                  setConsentNotes('');
                                }}
                                className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition"
                              >
                                {alumni.consentStatus === 'WITHDRAWN' ? 'Renew Consent' : 'Record Consent'}
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  setShowWithdrawModal(alumni);
                                  setActionReason('');
                                }}
                                className="px-2.5 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 rounded-lg border border-rose-200 transition"
                                title="Withdraw consent (unpublishes profile)"
                              >
                                Withdraw
                              </button>
                            )}

                            {/* Publish / Unpublish Toggle */}
                            {alumni.publicationStatus === 'PUBLISHED' ? (
                              <button
                                onClick={() => handleUnpublish(alumni)}
                                className="px-2.5 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-100 rounded-lg border border-gray-300 transition"
                              >
                                Unpublish
                              </button>
                            ) : (
                              <button
                                onClick={() => handlePublish(alumni)}
                                disabled={alumni.consentStatus !== 'GRANTED'}
                                className="px-2.5 py-1 text-[11px] font-semibold bg-[#0B3028] text-white hover:bg-[#075E46] disabled:opacity-40 disabled:pointer-events-none rounded-lg transition"
                              >
                                Publish
                              </button>
                            )}

                            {/* Audit / Details Drawer */}
                            <button
                              onClick={() => setShowAuditDrawer(alumni)}
                              className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
                              title="View dossier & audit trail"
                            >
                              <History className="w-4 h-4" />
                            </button>

                            {alumni.publicationStatus === 'PUBLISHED' && (
                              <button
                                onClick={() => {
                                  setShowRevokeModal(alumni);
                                  setActionReason('');
                                }}
                                className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition"
                                title="Revoke publication"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {alumniTotal > 15 && (
              <div className="p-4 border-t border-[#E7E9EE] flex items-center justify-between text-xs text-gray-500">
                <span>
                  Showing page {rosterPage} of {Math.ceil(alumniTotal / 15)}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setRosterPage((p) => Math.max(1, p - 1))}
                    disabled={rosterPage === 1}
                    className="px-2.5 py-1 rounded-lg border border-gray-200 disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setRosterPage((p) => p + 1)}
                    disabled={rosterPage >= Math.ceil(alumniTotal / 15)}
                    className="px-2.5 py-1 rounded-lg border border-gray-200 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: GLOBAL ALUMNI DIRECTORY                                            */}
      {/* ========================================================================= */}
      {activeTab === 'directory' && (
        <div className="space-y-6">
          {/* Directory Search Filters */}
          <div className="bg-white rounded-2xl border border-[#E7E9EE] p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-[#075E46] font-semibold uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4" />
                <span>Participating Madrasas Verified Directory</span>
              </div>
              {hasSearched && dirTotal > 0 && (
                <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  Verified match found ({dirTotal})
                </span>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                searchDirectory(1);
              }}
              className="space-y-2"
            >
              <label className="block text-xs font-semibold text-gray-700">
                Alumni Index Number
              </label>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={dirIndexNumber}
                    onChange={(e) => setDirIndexNumber(e.target.value)}
                    placeholder="Enter Alumni Index Number (e.g. ALM-MAD-2026-0001)"
                    className="w-full pl-9 pr-3 py-2.5 text-xs font-mono uppercase tracking-wider border border-[#E7E9EE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#075E46]/20 focus:border-[#075E46]"
                  />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="submit"
                    disabled={dirLoading || !dirIndexNumber.trim()}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#0B3028] hover:bg-[#075E46] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-xs transition"
                  >
                    {dirLoading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                    <span>Search</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleClearDirectorySearch}
                    disabled={!dirIndexNumber && !hasSearched}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 text-xs font-semibold rounded-xl transition"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Clear</span>
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Directory Cards Grid */}
          {dirLoading ? (
            <div className="bg-white rounded-2xl border border-[#E7E9EE] p-16 text-center text-gray-400">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-[#075E46]" />
              <p className="text-xs font-medium">Querying verified inter-madrasa directory...</p>
            </div>
          ) : hasSearched && dirResults.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#E7E9EE] p-16 text-center text-gray-500">
              <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-2" />
              <p className="font-semibold text-gray-800 text-base">No alumni found with this Index Number</p>
              <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
                Please check that the Alumni Index Number is entered correctly (e.g. ALM-MAD-2026-0001). The alumni record must also be published with active consent.
              </p>
            </div>
          ) : !hasSearched ? (
            <div className="bg-white rounded-2xl border border-[#E7E9EE] p-16 text-center text-gray-500">
              <Search className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="font-semibold text-gray-700 text-base">Search Global Alumni Directory</p>
              <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
                Enter a permanent Alumni Index Number above to verify an alumni record and inspect verified academic qualifications.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {dirResults.map((result) => {
                const initials = (result.fullName || result.studentName || 'A')
                  .split(' ')
                  .map((n) => n[0])
                  .filter(Boolean)
                  .slice(0, 2)
                  .join('')
                  .toUpperCase();
                const madrasaName = result.issuingMadrasa?.name || result.madrasaName || 'Associated Institution';
                const madrasaCode = result.issuingMadrasa?.code || result.madrasaCode || 'INST';
                const isViewingThis = globalProfileLoading && viewingIndexNumber === result.alumniIndexNumber;

                return (
                  <div
                    key={result.alumniIndexNumber}
                    className="bg-white rounded-2xl border border-[#E7E9EE] hover:border-[#075E46] p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-4">
                      {/* Top Badges Row */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-[#0B3028] bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                          {result.alumniIndexNumber}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Verified Alumni</span>
                        </span>
                      </div>

                      {/* Student Info & Photo Row */}
                      <div className="flex items-start gap-3.5 pt-1">
                        <div className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 border border-[#E7E9EE] bg-emerald-900/5 shadow-2xs flex items-center justify-center">
                          {result.photoUrl ? (
                            <img
                              src={result.photoUrl}
                              alt={result.fullName}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                                if ((e.target as HTMLElement).parentElement) {
                                  (e.target as HTMLElement).parentElement!.classList.add('bg-[#0B3028]', 'text-white');
                                  (e.target as HTMLElement).parentElement!.innerHTML = `<span class="font-bold text-sm tracking-wider">${initials}</span>`;
                                }
                              }}
                            />
                          ) : (
                            <div className="w-full h-full bg-[#0B3028] text-white flex items-center justify-center font-bold text-sm tracking-wider">
                              {initials}
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <h3 className="font-serif font-bold text-gray-900 text-base leading-snug truncate" title={result.fullName}>
                            {result.fullName || result.studentName || 'Alumni Student'}
                          </h3>
                          <div className="flex items-center gap-1.5 text-xs text-gray-600 mt-1">
                            <Building2 className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            <span className="truncate" title={madrasaName}>{madrasaName}</span>
                            <span className="text-gray-300">•</span>
                            <span className="font-mono text-[10px] text-gray-400 shrink-0">({madrasaCode})</span>
                          </div>
                          {result.leavingYear && (
                            <div className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 mt-1">
                              <GraduationCap className="w-3.5 h-3.5 text-[#075E46]" />
                              <span>Class of {result.leavingYear}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Verified Qualifications Metric & Preview */}
                      <div className="pt-3 border-t border-gray-100 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                            <Award className="w-3.5 h-3.5 text-[#D8B66A]" />
                            <span>Verified Qualifications</span>
                          </span>
                          <span className="font-bold text-gray-800 bg-gray-100 px-2 py-0.5 rounded-full text-[11px]">
                            {result.qualificationsCount ?? (result as any).verifiedQualificationsCount ?? 0}
                          </span>
                        </div>

                        {((result.featuredQualifications || (result as any).topQualifications) || []).length > 0 && (
                          <div className="space-y-1 pt-0.5">
                            {((result.featuredQualifications || (result as any).topQualifications) || []).slice(0, 2).map((q: any, idx: number) => (
                              <div key={idx} className="flex items-center gap-1.5 text-xs text-gray-700 bg-gray-50 px-2.5 py-1 rounded-lg">
                                <Award className="w-3 h-3 text-[#D8B66A] shrink-0" />
                                <span className="truncate flex-1">{q.title}</span>
                                {q.completionYear && (
                                  <span className="text-[10px] text-gray-400 shrink-0">({q.completionYear})</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* View Full Profile Action Button */}
                    <button
                      onClick={() => viewGlobalProfile(result.alumniIndexNumber)}
                      disabled={globalProfileLoading}
                      className="mt-5 w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-[#0B3028] hover:bg-[#075E46] text-white text-xs font-bold rounded-xl shadow-xs hover:shadow transition disabled:opacity-50"
                    >
                      {isViewingThis ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Opening Profile...</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Full Profile</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: ACADEMIC VERIFICATION HUB                                          */}
      {/* ========================================================================= */}
      {activeTab === 'verifications' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4 border-b border-[#E7E9EE] pb-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setHubSubTab('incoming')}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition ${
                  hubSubTab === 'incoming'
                    ? 'bg-[#0B3028] text-white shadow-xs'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Incoming Inquiries ({incomingTotal})
              </button>
              <button
                onClick={() => setHubSubTab('outgoing')}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition ${
                  hubSubTab === 'outgoing'
                    ? 'bg-[#0B3028] text-white shadow-xs'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Outgoing Inquiries ({outgoingTotal})
              </button>
            </div>

            <button
              onClick={fetchHubRequests}
              className="p-1.5 text-gray-500 hover:text-gray-900 border border-[#E7E9EE] rounded-lg hover:bg-gray-50 transition"
              title="Refresh Hub"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {hubLoading ? (
            <div className="bg-white rounded-2xl border border-[#E7E9EE] p-16 text-center text-gray-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#075E46]" />
              <p className="text-xs">Loading verification requests...</p>
            </div>
          ) : hubSubTab === 'incoming' ? (
            /* Incoming Requests Table */
            <div className="bg-white rounded-2xl border border-[#E7E9EE] shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAFBF9] border-b border-[#E7E9EE] text-gray-500 font-semibold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-4">Requesting Madrasa</th>
                      <th className="py-3 px-4">Target Alumni</th>
                      <th className="py-3 px-4">Inquiry Purpose</th>
                      <th className="py-3 px-4">Date Dispatched</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E7E9EE]">
                    {incomingList.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-gray-400">
                          <CheckCircle2 className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                          <p className="font-semibold text-gray-700">No Pending Inquiries</p>
                          <p className="text-[11px] text-gray-400">All incoming academic verifications are fulfilled.</p>
                        </td>
                      </tr>
                    ) : (
                      incomingList.map((req) => (
                        <tr key={req.id} className="hover:bg-gray-50/70 transition">
                          <td className="py-3.5 px-4 font-medium text-gray-900">
                            <div>{req.requestingMadrasa?.name || 'Authorized Madrasa'}</div>
                            <div className="text-[10px] text-gray-400 font-mono">
                              Code: {req.requestingMadrasa?.code}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-medium text-gray-900">
                              {req.alumniProfile?.student?.fullName}
                            </div>
                            <span className="font-mono text-[10px] text-[#075E46]">
                              {req.alumniProfile?.alumniIndexNumber}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-gray-600">
                            <span className="font-medium capitalize">{req.purpose.toLowerCase().replace('_', ' ')}</span>
                            {req.notes && <div className="text-[10px] text-gray-400 truncate max-w-xs">{req.notes}</div>}
                          </td>
                          <td className="py-3.5 px-4 text-gray-500">
                            {req.requestedAt?.split('T')[0]}
                          </td>
                          <td className="py-3.5 px-4">
                            {req.status === 'APPROVED_VERIFIED' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Approved
                              </span>
                            ) : req.status === 'REJECTED' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200">
                                <XCircle className="w-3 h-3 text-rose-600" /> Rejected
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                <Clock className="w-3 h-3 text-amber-600" /> Pending Action
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {req.status === 'PENDING' ? (
                              <button
                                onClick={() => {
                                  setShowRespondModal(req);
                                  setRespondAction('APPROVE');
                                  setRespondNotes('');
                                  setRejectionReason('');
                                }}
                                className="px-3 py-1.5 text-xs font-semibold bg-[#0B3028] text-white hover:bg-[#075E46] rounded-lg transition"
                              >
                                Review & Respond
                              </button>
                            ) : (
                              <span className="text-gray-400 text-[11px] italic">Fulfilled</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Outgoing Requests Table */
            <div className="bg-white rounded-2xl border border-[#E7E9EE] shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAFBF9] border-b border-[#E7E9EE] text-gray-500 font-semibold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-4">Target Madrasa</th>
                      <th className="py-3 px-4">Target Alumni</th>
                      <th className="py-3 px-4">Purpose</th>
                      <th className="py-3 px-4">Dispatched At</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E7E9EE]">
                    {outgoingList.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-gray-400">
                          <Send className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                          <p className="font-semibold text-gray-700">No Outgoing Inquiries</p>
                          <p className="text-[11px] text-gray-400">You have not submitted verification inquiries to other madrasas.</p>
                        </td>
                      </tr>
                    ) : (
                      outgoingList.map((req) => (
                        <tr key={req.id} className="hover:bg-gray-50/70 transition">
                          <td className="py-3.5 px-4 font-medium text-gray-900">
                            <div>{req.issuingMadrasa?.name || 'Issuing Madrasa'}</div>
                            <div className="text-[10px] text-gray-400 font-mono">
                              Code: {req.issuingMadrasa?.code}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-medium text-gray-900">{req.alumniProfile?.student?.fullName}</div>
                            <span className="font-mono text-[10px] text-[#075E46]">
                              {req.alumniProfile?.alumniIndexNumber}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-gray-600 capitalize">
                            {req.purpose.toLowerCase().replace('_', ' ')}
                          </td>
                          <td className="py-3.5 px-4 text-gray-500">
                            {req.requestedAt?.split('T')[0]}
                          </td>
                          <td className="py-3.5 px-4">
                            {req.status === 'APPROVED_VERIFIED' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Approved
                              </span>
                            ) : req.status === 'REJECTED' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200">
                                <XCircle className="w-3 h-3 text-rose-600" /> Rejected
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                <Clock className="w-3 h-3 text-amber-600" /> Pending Review
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => viewGlobalProfile(req.alumniProfile?.alumniIndexNumber)}
                              className="px-2.5 py-1 text-xs font-semibold text-[#075E46] hover:bg-emerald-50 rounded-lg transition"
                            >
                              View Dossier
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CREATE ALUMNI PROFILE                                              */}
      {/* ========================================================================= */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-[#075E46]" />
                <h3 className="font-serif font-bold text-gray-900 text-lg">Create Alumni Profile</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAlumni} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Select Eligible Student *</label>
                <div className="relative mb-2">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={eligibleSearch}
                    onChange={(e) => {
                      setEligibleSearch(e.target.value);
                      fetchEligibleStudents(e.target.value);
                    }}
                    placeholder="Search student by name or admission number..."
                    className="w-full pl-9 pr-3 py-1.5 border border-[#E7E9EE] rounded-xl text-xs focus:outline-none focus:border-[#075E46]"
                  />
                </div>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-[#E7E9EE] rounded-xl bg-white text-gray-800 focus:outline-none focus:border-[#075E46]"
                >
                  <option value="">
                    {(eligibleStudents || []).length === 0
                      ? '-- No eligible students found without alumni profiles --'
                      : '-- Choose student --'}
                  </option>
                  {(eligibleStudents || []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.displayName || `${s.fullName} (${s.admissionNumber || s.admissionNo}) – ${s.status}`}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-400 mt-1">
                  Only students without an existing alumni record are listed.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Leaving Date *</label>
                  <input
                    type="date"
                    value={leavingDate}
                    onChange={(e) => setLeavingDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-[#E7E9EE] rounded-xl text-xs focus:outline-none focus:border-[#075E46]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Leaving Reason</label>
                  <select
                    value={leavingReason}
                    onChange={(e) => setLeavingReason(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E7E9EE] rounded-xl bg-white text-xs focus:outline-none focus:border-[#075E46]"
                  >
                    <option value="GRADUATION">Graduation</option>
                    <option value="PROGRAM_COMPLETION">Program Completion</option>
                    <option value="TRANSFER">Transfer to Another Madrasa</option>
                    <option value="RELOCATION">Family Relocation</option>
                    <option value="VOLUNTARY_WITHDRAWAL">Voluntary Withdrawal</option>
                  </select>
                </div>
              </div>

              {/* Character Conduct Rating: Explicit deliberate choice required with NO default */}
              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Institutional Character Assessment (Deliberate Choice)
                </label>
                <select
                  value={characterAssessment}
                  onChange={(e) => setCharacterAssessment(e.target.value as CharacterConductRating | '')}
                  className="w-full px-3 py-2 border border-[#E7E9EE] rounded-xl bg-white text-xs focus:outline-none focus:border-[#075E46]"
                >
                  <option value="">-- No Assessment / Under Review --</option>
                  <option value="EXCELLENT">Excellent (Mumtaz)</option>
                  <option value="VERY_GOOD">Very Good (Jayyid Jiddan)</option>
                  <option value="GOOD">Good (Jayyid)</option>
                  <option value="SATISFACTORY">Satisfactory (Maqbool)</option>
                  <option value="UNDER_OBSERVATION">Under Observation</option>
                </select>
                <p className="text-[10px] text-amber-700 bg-amber-50/60 p-2 rounded-lg mt-1 border border-amber-200">
                  Note: There is no default "Excellent" assessment. Each assessment must be a deliberate institutional decision.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Assessment Notes</label>
                <textarea
                  rows={2}
                  value={characterNotes}
                  onChange={(e) => setCharacterNotes(e.target.value)}
                  placeholder="Official observations regarding academic commitment and moral conduct..."
                  className="w-full px-3 py-2 border border-[#E7E9EE] rounded-xl text-xs focus:outline-none focus:border-[#075E46]"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Private Admin Notes</label>
                <textarea
                  rows={2}
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Internal administrative reference (never shared across madrasas)..."
                  className="w-full px-3 py-2 border border-[#E7E9EE] rounded-xl text-xs focus:outline-none focus:border-[#075E46]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSubmitting}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-[#0B3028] hover:bg-[#075E46] text-white text-xs font-bold rounded-xl shadow-xs transition"
                >
                  {createSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  <span>Generate Index & Create</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: RECORD / RENEW CONSENT                                             */}
      {/* ========================================================================= */}
      {showConsentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="font-serif font-bold text-gray-900 text-lg">
                  {consentModalMode === 'RECORD' ? 'Record Consent' : 'Renew Expired/Withdrawn Consent'}
                </h3>
              </div>
              <button
                onClick={() => setShowConsentModal(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordConsent} className="space-y-4 text-xs">
              <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200">
                <div className="text-[11px] font-semibold text-emerald-900">
                  Target: {showConsentModal.student.fullName} ({showConsentModal.alumniIndexNumber})
                </div>
                <p className="text-[10px] text-emerald-700 mt-0.5">
                  Recording consent creates an immutable audit record and authorizes publication in the Global Directory.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Consenting Party *</label>
                <select
                  value={consentParty}
                  onChange={(e) => setConsentParty(e.target.value as AlumniConsentParty)}
                  className="w-full px-3 py-2 border border-[#E7E9EE] rounded-xl bg-white text-xs focus:outline-none focus:border-[#075E46]"
                >
                  <option value="STUDENT">Student (Adult / Self)</option>
                  <option value="GUARDIAN">Parent / Legal Guardian</option>
                  <option value="AUTHORIZED_REPRESENTATIVE">Authorized Representative</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Signer Full Name *</label>
                <input
                  type="text"
                  value={consentSignerName}
                  onChange={(e) => setConsentSignerName(e.target.value)}
                  placeholder="e.g. Muhammad Farooq (Father)"
                  required
                  className="w-full px-3 py-2 border border-[#E7E9EE] rounded-xl text-xs focus:outline-none focus:border-[#075E46]"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Proof of Consent Type *</label>
                <select
                  value={consentProofType}
                  onChange={(e) => setConsentProofType(e.target.value as AlumniConsentProofType)}
                  className="w-full px-3 py-2 border border-[#E7E9EE] rounded-xl bg-white text-xs focus:outline-none focus:border-[#075E46]"
                >
                  <option value="SIGNED_PHYSICAL_FORM">Physical Signed Consent Form</option>
                  <option value="DIGITAL_SIGNATURE">Digital / Electronic Signature</option>
                  <option value="GUARDIAN_AFFIDAVIT">Guardian / Legal Affidavit</option>
                  <option value="DIRECT_APPLICATION">Direct Application</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Upload Consent Evidence Document {consentModalMode === 'RENEW' && '* (Mandatory for Renewal)'}
                </label>
                <div className="border-2 border-dashed border-[#E7E9EE] rounded-xl p-4 text-center hover:border-[#075E46] transition">
                  <input
                    type="file"
                    id="consentFileUpload"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={(e) => setConsentFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                  <label htmlFor="consentFileUpload" className="cursor-pointer">
                    <FileUp className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                    <span className="text-xs font-semibold text-[#075E46]">
                      {consentFile ? consentFile.name : 'Click to upload signed document'}
                    </span>
                    <p className="text-[10px] text-gray-400 mt-0.5">PDF or image up to 5 MB</p>
                  </label>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Consent Notes</label>
                <textarea
                  rows={2}
                  value={consentNotes}
                  onChange={(e) => setConsentNotes(e.target.value)}
                  placeholder="Optional archival notes or physical binder reference..."
                  className="w-full px-3 py-2 border border-[#E7E9EE] rounded-xl text-xs focus:outline-none focus:border-[#075E46]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowConsentModal(null)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={consentSubmitting}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs transition"
                >
                  {consentSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  <span>Save & Verify Consent</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: WITHDRAW CONSENT                                                   */}
      {/* ========================================================================= */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-rose-600">
              <ShieldAlert className="w-5 h-5" />
              <h3 className="font-serif font-bold text-gray-900 text-lg">Withdraw Student Consent</h3>
            </div>
            <p className="text-xs text-gray-600">
              Withdrawing consent will <strong>immediately unpublish</strong> this profile from the Global Alumni
              Directory and instantly block access to all related restricted documents.
            </p>
            <form onSubmit={handleWithdrawConsent} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Reason for Withdrawal *</label>
                <textarea
                  rows={3}
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="e.g. Student requested removal from public directory..."
                  required
                  className="w-full px-3 py-2 border border-[#E7E9EE] rounded-xl text-xs focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowWithdrawModal(null)}
                  className="px-3.5 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionSubmitting}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition"
                >
                  {actionSubmitting ? 'Withdrawing...' : 'Confirm Withdrawal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: REVOKE PUBLICATION                                                 */}
      {/* ========================================================================= */}
      {showRevokeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-rose-600">
              <ShieldAlert className="w-5 h-5" />
              <h3 className="font-serif font-bold text-gray-900 text-lg">Revoke Alumni Publication</h3>
            </div>
            <p className="text-xs text-gray-600">
              Revoking publication changes the status to <strong>REVOKED</strong> and removes the profile from the
              Global Directory.
            </p>
            <form onSubmit={handleRevoke} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Reason for Revocation *</label>
                <textarea
                  rows={3}
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="e.g. Administrative revocation..."
                  required
                  className="w-full px-3 py-2 border border-[#E7E9EE] rounded-xl text-xs focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRevokeModal(null)}
                  className="px-3.5 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionSubmitting}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition"
                >
                  {actionSubmitting ? 'Revoking...' : 'Confirm Revocation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: FULL GLOBAL ALUMNI PROFILE VIEW                                    */}
      {/* ========================================================================= */}
      {selectedGlobalProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 sm:p-7 shadow-2xl space-y-6 my-8 max-h-[90vh] overflow-y-auto">
            {/* Header: Photo, Name, Index Number & Badges */}
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-5">
              <div className="flex items-start gap-4">
                {/* Profile Photo or Fallback Avatar */}
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden shrink-0 border border-[#E7E9EE] bg-emerald-900/5 shadow-xs flex items-center justify-center">
                  {selectedGlobalProfile.photoUrl ? (
                    <img
                      src={selectedGlobalProfile.photoUrl}
                      alt={selectedGlobalProfile.fullName}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                        if ((e.target as HTMLElement).parentElement) {
                          (e.target as HTMLElement).parentElement!.classList.add('bg-[#0B3028]', 'text-white');
                          (e.target as HTMLElement).parentElement!.innerHTML = `<span class="font-bold text-lg tracking-wider">${(selectedGlobalProfile.fullName || 'A').split(' ').map((n) => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()}</span>`;
                        }
                      }}
                    />
                  ) : (
                    <div className="w-full h-full bg-[#0B3028] text-white flex items-center justify-center font-bold text-lg tracking-wider">
                      {(selectedGlobalProfile.fullName || 'A')
                        .split(' ')
                        .map((n) => n[0])
                        .filter(Boolean)
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()}
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className="font-mono text-xs font-bold text-[#0B3028] bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                      {selectedGlobalProfile.alumniIndexNumber}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Verified Alumni</span>
                    </span>
                  </div>
                  <h2 className="font-serif font-bold text-2xl text-gray-900">
                    {selectedGlobalProfile.fullName}
                  </h2>
                  <div className="flex items-center gap-2 text-xs text-gray-600 mt-1">
                    <Building2 className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span className="font-semibold text-gray-800">
                      {(selectedGlobalProfile.issuingMadrasa || selectedGlobalProfile.madrasa)?.name}
                    </span>
                    <span className="text-gray-300">•</span>
                    <span className="font-mono text-[11px] text-gray-500">
                      ({(selectedGlobalProfile.issuingMadrasa || selectedGlobalProfile.madrasa)?.code})
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedGlobalProfile(null)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-xl hover:bg-gray-100 transition shrink-0"
                title="Close Profile"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Zero-Leakage Privacy Banner */}
            <div className="p-3.5 bg-emerald-50/50 rounded-xl border border-emerald-200/60 flex items-center gap-2.5 text-xs text-emerald-900">
              <Lock className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>
                <strong>Privacy Guaranteed:</strong> Guardian contact details, private phone numbers, home addresses, family information, and disciplinary records are strictly withheld under privacy rules.
              </span>
            </div>

            {/* Issuing Madrasa Information */}
            <div className="bg-gray-50/60 rounded-xl border border-[#E7E9EE] p-4 space-y-2">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-[#075E46]" />
                <span>Issuing Madrasa Information</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-700 pt-1">
                <div>
                  <span className="text-gray-500">Institution:</span>{' '}
                  <strong className="text-gray-900">
                    {(selectedGlobalProfile.issuingMadrasa || selectedGlobalProfile.madrasa)?.name}
                  </strong>
                </div>
                <div>
                  <span className="text-gray-500">Institution Code:</span>{' '}
                  <span className="font-mono font-semibold text-gray-900">
                    {(selectedGlobalProfile.issuingMadrasa || selectedGlobalProfile.madrasa)?.code}
                  </span>
                </div>
                {(selectedGlobalProfile.issuingMadrasa || selectedGlobalProfile.madrasa)?.address && (
                  <div className="sm:col-span-2">
                    <span className="text-gray-500">Address:</span>{' '}
                    <span>{(selectedGlobalProfile.issuingMadrasa || selectedGlobalProfile.madrasa)?.address}</span>
                  </div>
                )}
                {(selectedGlobalProfile.issuingMadrasa || selectedGlobalProfile.madrasa)?.email && (
                  <div>
                    <span className="text-gray-500">Email:</span>{' '}
                    <span>{(selectedGlobalProfile.issuingMadrasa || selectedGlobalProfile.madrasa)?.email}</span>
                  </div>
                )}
                {(selectedGlobalProfile.issuingMadrasa || selectedGlobalProfile.madrasa)?.phone && (
                  <div>
                    <span className="text-gray-500">Phone:</span>{' '}
                    <span>{(selectedGlobalProfile.issuingMadrasa || selectedGlobalProfile.madrasa)?.phone}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Academic History & Tenure */}
            <div className="bg-white rounded-xl border border-[#E7E9EE] p-4 space-y-3">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-[#075E46]" />
                <span>Academic History & Tenure</span>
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-gray-50 rounded-xl">
                  <div className="text-[10px] text-gray-400 font-semibold uppercase">Admission Date</div>
                  <div className="font-semibold text-gray-900 mt-0.5">
                    {selectedGlobalProfile.admissionDate || (selectedGlobalProfile.admissionYear ? `Year ${selectedGlobalProfile.admissionYear}` : '—')}
                  </div>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl">
                  <div className="text-[10px] text-gray-400 font-semibold uppercase">Leaving Date</div>
                  <div className="font-semibold text-gray-900 mt-0.5">
                    {selectedGlobalProfile.leavingDate || (selectedGlobalProfile.leavingYear ? `Class of ${selectedGlobalProfile.leavingYear}` : '—')}
                  </div>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl">
                  <div className="text-[10px] text-gray-400 font-semibold uppercase">Leaving Reason</div>
                  <div className="font-semibold text-gray-900 mt-0.5">
                    {selectedGlobalProfile.leavingReason || 'Graduation'}
                  </div>
                </div>
              </div>

              {/* Completed Programmes */}
              {selectedGlobalProfile.completedProgrammes && selectedGlobalProfile.completedProgrammes.length > 0 && (
                <div className="pt-2">
                  <div className="text-[11px] font-semibold text-gray-500 mb-1.5">Completed Programmes</div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedGlobalProfile.completedProgrammes.map((prog, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 bg-emerald-50 text-emerald-800 text-xs font-medium rounded-lg border border-emerald-200"
                      >
                        {prog}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Academic Highlights */}
              {selectedGlobalProfile.academicHighlights && selectedGlobalProfile.academicHighlights.length > 0 && (
                <div className="pt-2">
                  <div className="text-[11px] font-semibold text-gray-500 mb-1.5">Academic Highlights</div>
                  <ul className="list-disc list-inside text-xs text-gray-700 space-y-1">
                    {selectedGlobalProfile.academicHighlights.map((hl, idx) => (
                      <li key={idx}>{hl}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Verified Academic Qualifications & Certificates */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-[#D8B66A]" />
                  <span>
                    Verified Academic Qualifications ({selectedGlobalProfile.qualifications?.length || 0})
                  </span>
                </h4>
              </div>

              {(!selectedGlobalProfile.qualifications || selectedGlobalProfile.qualifications.length === 0) ? (
                <div className="p-4 text-center text-xs text-gray-400 bg-gray-50 rounded-xl border border-[#E7E9EE]">
                  No formal qualifications recorded.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {selectedGlobalProfile.qualifications.map((q) => (
                    <div
                      key={q.id}
                      className="p-3.5 bg-white rounded-xl border border-[#E7E9EE] hover:border-gray-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs transition"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-gray-900">{q.title}</span>
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-medium">
                            {q.category || q.recordType || 'ACADEMIC'}
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-500 mt-1 flex flex-wrap items-center gap-2">
                          <span>{q.issuingAuthority || (selectedGlobalProfile.issuingMadrasa || selectedGlobalProfile.madrasa)?.name}</span>
                          {(q.achievedDate || q.completionYear) && (
                            <>
                              <span className="text-gray-300">•</span>
                              <span>Year: {q.completionYear || q.achievedDate}</span>
                            </>
                          )}
                          {q.gradeOrScore && (
                            <>
                              <span className="text-gray-300">•</span>
                              <span className="font-semibold text-emerald-700">Grade: {q.gradeOrScore}</span>
                            </>
                          )}
                          {q.certificateNumber && (
                            <>
                              <span className="text-gray-300">•</span>
                              <span className="font-mono text-[10px] text-gray-400">Cert #{q.certificateNumber}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        {q.canStreamCertificate ? (
                          <button
                            onClick={() =>
                              handleDownloadCertificate(selectedGlobalProfile.alumniIndexNumber, q.id, q.title)
                            }
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-semibold border border-emerald-200 transition"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Stream Certificate</span>
                          </button>
                        ) : (q.hasCertificateFile || (q as any).hasCertificateDocument) ? (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200"
                            title="Certificate is on file but requires approved inter-institution academic verification to view."
                          >
                            <Lock className="w-3 h-3 text-amber-600" />
                            <span>Requires Verification</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-gray-400 italic">No File</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Institutional Character Assessment */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-[#075E46]" />
                <span>Institutional Character Assessment</span>
              </h4>
              {selectedGlobalProfile.characterAssessment ? (
                <div className="p-3.5 bg-gray-50/70 rounded-xl border border-gray-200 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-700">Conduct Rating:</span>
                    {renderConductBadge(
                      selectedGlobalProfile.characterAssessment.conductRating ||
                      selectedGlobalProfile.characterAssessment.rating
                    )}
                  </div>
                  {(selectedGlobalProfile.characterAssessment.officialNotes ||
                    selectedGlobalProfile.characterAssessment.remarks) && (
                    <p className="text-xs text-gray-600 italic mt-1 bg-white p-2.5 rounded-lg border border-gray-200">
                      "{selectedGlobalProfile.characterAssessment.officialNotes || selectedGlobalProfile.characterAssessment.remarks}"
                    </p>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-gray-50 text-xs text-gray-500 rounded-xl border border-dashed border-gray-200 flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span>
                    Character conduct assessment is private to the issuing institution or released upon approved inter-institution verification inquiry.
                  </span>
                </div>
              )}
            </div>

            {/* Footer with Verification Status & Request CTA */}
            <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-gray-600">
                <span className="font-semibold text-gray-700">Inter-Madrasa Status:</span>{' '}
                <span className="font-medium">
                  {selectedGlobalProfile.verificationAccessStatus === 'APPROVED'
                    ? 'Verified Cross-Madrasa Access Granted'
                    : selectedGlobalProfile.verificationAccessStatus === 'PENDING'
                    ? 'Inquiry Pending with Issuing Madrasa'
                    : selectedGlobalProfile.verificationAccessStatus === 'OWNER'
                    ? 'Direct Owner Institution (Full Access)'
                    : 'Standard Public View'}
                </span>
              </div>

              {selectedGlobalProfile.verificationAccessStatus === 'NONE' && (
                <button
                  onClick={() => setShowInquireModal(selectedGlobalProfile)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#0B3028] hover:bg-[#075E46] text-white text-xs font-bold rounded-xl shadow-xs transition shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Request Full Verification</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: SUBMIT ACADEMIC VERIFICATION INQUIRY                               */}
      {/* ========================================================================= */}
      {showInquireModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-[#075E46]" />
                <h3 className="font-serif font-bold text-gray-900 text-base">Request Academic Verification</h3>
              </div>
              <button onClick={() => setShowInquireModal(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-gray-600">
              Submit an official verification inquiry to <strong>{showInquireModal.madrasa?.name || 'the issuing madrasa'}</strong> to unlock
              verified certificates and full academic endorsements.
            </p>

            <form onSubmit={handleInquireVerification} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Inquiry Purpose *</label>
                <select
                  value={inquirePurpose}
                  onChange={(e) => setInquirePurpose(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E7E9EE] rounded-xl bg-white text-xs focus:outline-none focus:border-[#075E46]"
                >
                  <option value="ACADEMIC_ADMISSION">Student Academic Admission / Transfer</option>
                  <option value="EMPLOYMENT_TEACHER">Madrasa Teacher / Ustadh Employment</option>
                  <option value="SCHOLARSHIP_AWARD">Scholarship / Educational Grant Award</option>
                  <option value="GOVERNMENT_ATTESTATION">Official Attestation / Legal Recognition</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Official Notes for Issuing Admin</label>
                <textarea
                  rows={3}
                  value={inquireNotes}
                  onChange={(e) => setInquireNotes(e.target.value)}
                  placeholder="Detail the intake program or verification reference..."
                  className="w-full px-3 py-2 border border-[#E7E9EE] rounded-xl text-xs focus:outline-none focus:border-[#075E46]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInquireModal(null)}
                  className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inquireSubmitting}
                  className="px-4 py-2 bg-[#0B3028] hover:bg-[#075E46] text-white text-xs font-bold rounded-xl transition"
                >
                  {inquireSubmitting ? 'Dispatching...' : 'Dispatch Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: RESPOND TO VERIFICATION INQUIRY                                    */}
      {/* ========================================================================= */}
      {showRespondModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="font-serif font-bold text-gray-900 text-base">Respond to Verification Inquiry</h3>
              </div>
              <button onClick={() => setShowRespondModal(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-gray-600 space-y-1 bg-gray-50 p-3 rounded-xl">
              <div>
                <strong>Requesting Madrasa:</strong> {showRespondModal.requestingMadrasa?.name}
              </div>
              <div>
                <strong>Student:</strong> {showRespondModal.alumniProfile?.student?.fullName} (
                {showRespondModal.alumniProfile?.alumniIndexNumber})
              </div>
              <div>
                <strong>Purpose:</strong> {showRespondModal.purpose}
              </div>
            </div>

            <form onSubmit={handleRespondToRequest} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Decision *</label>
                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center gap-1.5 cursor-pointer font-medium text-emerald-800">
                    <input
                      type="radio"
                      name="decision"
                      checked={respondAction === 'APPROVE'}
                      onChange={() => setRespondAction('APPROVE')}
                    />
                    <span>Approve & Grant Certificate Access</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer font-medium text-rose-800">
                    <input
                      type="radio"
                      name="decision"
                      checked={respondAction === 'REJECT'}
                      onChange={() => setRespondAction('REJECT')}
                    />
                    <span>Reject Inquiry</span>
                  </label>
                </div>
              </div>

              {respondAction === 'REJECT' && (
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Rejection Reason *</label>
                  <textarea
                    rows={2}
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    required
                    placeholder="Specify why verification cannot be completed..."
                    className="w-full px-3 py-2 border border-rose-200 rounded-xl text-xs focus:outline-none focus:border-rose-500"
                  />
                </div>
              )}

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Notes / Endorsement</label>
                <textarea
                  rows={2}
                  value={respondNotes}
                  onChange={(e) => setRespondNotes(e.target.value)}
                  placeholder="Official institutional endorsement notes..."
                  className="w-full px-3 py-2 border border-[#E7E9EE] rounded-xl text-xs focus:outline-none focus:border-[#075E46]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRespondModal(null)}
                  className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={respondSubmitting}
                  className={`px-4 py-2 text-white text-xs font-bold rounded-xl transition ${
                    respondAction === 'APPROVE'
                      ? 'bg-emerald-700 hover:bg-emerald-800'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {respondSubmitting ? 'Submitting...' : 'Submit Response'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DRAWER: AUDIT & CONSENT DOSSIER                                           */}
      {/* ========================================================================= */}
      {showAuditDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md h-full p-6 shadow-2xl flex flex-col justify-between overflow-y-auto">
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-[#075E46]" />
                  <h3 className="font-serif font-bold text-gray-900 text-lg">Alumni Dossier & Audit</h3>
                </div>
                <button onClick={() => setShowAuditDrawer(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Student Bio */}
              <div className="space-y-2 text-xs bg-gray-50 p-4 rounded-xl">
                <div className="font-serif font-bold text-base text-gray-900">
                  {showAuditDrawer.student.fullName}
                </div>
                <div className="font-mono text-emerald-800 font-bold">
                  Index: {showAuditDrawer.alumniIndexNumber}
                </div>
                <div className="text-gray-600">
                  Admission: {showAuditDrawer.admissionDate?.split('T')[0]} | Leaving:{' '}
                  {showAuditDrawer.leavingDate?.split('T')[0]}
                </div>
                <div className="text-gray-600">
                  Reason: <span className="capitalize">{showAuditDrawer.leavingReason || 'Graduation'}</span>
                </div>
              </div>

              {/* Consent History Timeline */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Consent Audit Log</span>
                </h4>

                <div className="space-y-2 text-xs">
                  {showAuditDrawer.consentRecords && showAuditDrawer.consentRecords.length > 0 ? (
                    showAuditDrawer.consentRecords.map((rec) => (
                      <div key={rec.id} className="p-3 border border-[#E7E9EE] rounded-xl bg-white shadow-2xs">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-emerald-800">{rec.action}</span>
                          <span className="text-[10px] text-gray-400">{rec.createdAt?.split('T')[0]}</span>
                        </div>
                        <div className="text-[11px] text-gray-600 mt-1">
                          Signer: {rec.signerName} ({rec.consentParty})
                        </div>
                        <div className="text-[10px] text-gray-400">
                          Proof: {rec.proofType} • Ver: {rec.consentVersion}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-3 text-center text-gray-400 border border-dashed rounded-xl">
                      No consent actions recorded yet.
                    </div>
                  )}
                </div>
              </div>

              {/* Admin Private Notes */}
              {showAuditDrawer.adminPrivateNotes && (
                <div className="space-y-1">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Private Notes</h4>
                  <p className="text-xs text-gray-600 p-3 bg-amber-50/50 rounded-xl border border-amber-200">
                    {showAuditDrawer.adminPrivateNotes}
                  </p>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-gray-100">
              <button
                onClick={() => setShowAuditDrawer(null)}
                className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold rounded-xl transition"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
