import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Award,
  ShieldAlert,
  Users,
  CalendarClock,
  History,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  Download,
  Trash2,
  Edit2,
  Loader2,
  AlertCircle,
  CheckSquare,
  Bell,
  UserCheck,
  Filter,
  Upload,
} from 'lucide-react';
import {
  apiGetStudentQualifications,
  apiCreateStudentQualification,
  apiUpdateStudentQualification,
  apiVerifyStudentQualification,
  apiGetStudentQualificationCertificateUrl,
  apiDeleteStudentQualification,
  apiGetStudentIncidents,
  apiCreateStudentIncident,
  apiUpdateStudentIncident,
  apiGetStudentIncidentEvidenceUrl,
  apiDeleteStudentIncident,
  apiGetStudentMeetings,
  apiCreateStudentMeeting,
  apiUpdateStudentMeeting,
  apiDeleteStudentMeeting,
  apiGetStudentFollowUps,
  apiCreateStudentFollowUp,
  apiUpdateStudentFollowUp,
  apiDeleteStudentFollowUp,
  apiGetStudentTimeline,
  type StudentQualificationItem,
  type StudentIncidentItem,
  type StudentMeetingItem,
  type StudentFollowUpItem,
  type StudentTimelineEvent,
  type QualificationCategory,
  type QualificationProgressStatus,
  type CertificateVerificationStatus,
  type IncidentCategory,
  type IncidentSeverity,
  type IncidentVerificationStatus,
  type StudentMeetingType,
  type FollowUpPriority,
  type FollowUpStatus,
} from '../../services/api';
import { listUstadhs, type UstadhItem } from '../../services/ustadh.service';

const QUALIFICATION_CATEGORY_LABELS: Record<QualificationCategory, string> = {
  HIFZ_JUZ: 'Hifz / Juz Completion',
  QIRAATH: 'Qiraath',
  NAZIRA_QURAN: 'Nazira Quran',
  TAJWEED: 'Tajweed',
  ISLAMIC_STUDIES: 'Islamic Studies',
  ARABIC_LANGUAGE: 'Arabic Language',
  PREVIOUS_SCHOOLING: 'Previous Schooling',
  EXTERNAL_CERTIFICATE: 'External Certificate',
  AWARD_ACHIEVEMENT: 'Award / Competition Achievement',
  OTHER: 'Other',
};

const INCIDENT_CATEGORY_LABELS: Record<IncidentCategory, string> = {
  ATTENDANCE_TARDINESS: 'Attendance / Tardiness',
  BEHAVIOR_CONDUCT: 'Behavior & Conduct',
  ACADEMIC_INTEGRITY: 'Academic Integrity',
  DRESS_CODE: 'Dress Code',
  PEER_CONFLICT: 'Peer Conflict',
  PROPERTY_DAMAGE: 'Property Damage',
  SAFETY_CONCERN: 'Safety Concern',
  OTHER: 'Other',
};

const MEETING_TYPE_LABELS: Record<StudentMeetingType, string> = {
  GUARDIAN_CONFERENCE: 'Guardian Conference',
  ACADEMIC_REVIEW: 'Academic Review',
  DISCIPLINARY_HEARING: 'Disciplinary Hearing',
  COUNSELING: 'Student Counseling',
  GENERAL: 'General Meeting',
};

interface StudentRecordsPanelsProps {
  studentId: string;
  studentName: string;
  activeSubTab: 'QUALIFICATIONS' | 'DISCIPLINE' | 'MEETINGS' | 'FOLLOW_UPS' | 'TIMELINE';
}

export const StudentRecordsPanels: React.FC<StudentRecordsPanelsProps> = ({
  studentId,
  studentName,
  activeSubTab,
}) => {
  const [ustadhs, setUstadhs] = useState<UstadhItem[]>([]);

  // Qualifications State
  const [qualifications, setQualifications] = useState<StudentQualificationItem[]>([]);
  const [qualSummary, setQualSummary] = useState({
    total: 0,
    verifiedCount: 0,
    pendingCount: 0,
    rejectedCount: 0,
    inProgressCount: 0,
    completedCount: 0,
  });
  const [qualLoading, setQualLoading] = useState(false);
  const [isQualModalOpen, setIsQualModalOpen] = useState(false);
  const [editingQual, setEditingQual] = useState<StudentQualificationItem | null>(null);
  const [qualForm, setQualForm] = useState({
    recordType: 'QUALIFICATION',
    category: 'QIRAATH' as QualificationCategory,
    title: '',
    issuingAuthority: '',
    certificateNumber: '',
    progressStatus: 'COMPLETED' as QualificationProgressStatus,
    verificationStatus: 'PENDING' as CertificateVerificationStatus,
    achievedDate: new Date().toISOString().split('T')[0],
    expiryDate: '',
    gradeOrScore: '',
    description: '',
    examinerUstadhId: '',
    rejectionReason: '',
  });
  const [qualFile, setQualFile] = useState<File | null>(null);
  const qualFileInputRef = useRef<HTMLInputElement>(null);
  const [qualSubmitting, setQualSubmitting] = useState(false);
  const [qualError, setQualError] = useState<string | null>(null);

  // Verify/Reject Certificate Modal
  const [reviewingQual, setReviewingQual] = useState<StudentQualificationItem | null>(null);
  const [reviewStatus, setReviewStatus] = useState<CertificateVerificationStatus>('VERIFIED');
  const [reviewRejectionReason, setReviewRejectionReason] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  // Incidents State
  const [incidents, setIncidents] = useState<StudentIncidentItem[]>([]);
  const [incidentSummary, setIncidentSummary] = useState({
    total: 0,
    unconfirmedCount: 0,
    confirmedCount: 0,
    resolvedCount: 0,
    dismissedCount: 0,
  });
  const [incidentLoading, setIncidentLoading] = useState(false);
  const [isIncidentModalOpen, setIsIncidentModalOpen] = useState(false);
  const [editingIncident, setEditingIncident] = useState<StudentIncidentItem | null>(null);
  const [incidentForm, setIncidentForm] = useState({
    title: '',
    category: 'BEHAVIOR_CONDUCT' as IncidentCategory,
    severity: 'LOW' as IncidentSeverity,
    occurredAt: new Date().toISOString().slice(0, 16),
    location: '',
    isConfidential: true,
    reportedDescription: '',
    reportedByUstadhId: '',
    verificationStatus: 'REPORTED' as IncidentVerificationStatus,
    investigatedFindings: '',
    actionTaken: '',
    dismissalReason: '',
    guardianNotified: false,
  });
  const [incidentFile, setIncidentFile] = useState<File | null>(null);
  const incidentFileInputRef = useRef<HTMLInputElement>(null);
  const [incidentSubmitting, setIncidentSubmitting] = useState(false);
  const [incidentError, setIncidentError] = useState<string | null>(null);

  // Meetings State
  const [meetings, setMeetings] = useState<StudentMeetingItem[]>([]);
  const [meetingsLoading, setMeetingsLoading] = useState(false);
  const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<StudentMeetingItem | null>(null);
  const [meetingForm, setMeetingForm] = useState({
    meetingType: 'GUARDIAN_CONFERENCE' as StudentMeetingType,
    title: '',
    meetingAt: new Date().toISOString().slice(0, 16),
    location: '',
    participantsSummary: '',
    ustadhId: '',
    incidentId: '',
    discussionNotes: '',
    outcomeSummary: '',
  });
  const [meetingSubmitting, setMeetingSubmitting] = useState(false);
  const [meetingError, setMeetingError] = useState<string | null>(null);

  // Follow-Ups State
  const [followUps, setFollowUps] = useState<StudentFollowUpItem[]>([]);
  const [followUpSummary, setFollowUpSummary] = useState({
    total: 0,
    overdueCount: 0,
    dueTodayCount: 0,
    upcomingCount: 0,
    completedCount: 0,
  });
  const [followUpsLoading, setFollowUpsLoading] = useState(false);
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);
  const [editingFollowUp, setEditingFollowUp] = useState<StudentFollowUpItem | null>(null);
  const [followUpForm, setFollowUpForm] = useState({
    title: '',
    notes: '',
    dueDate: new Date().toISOString().split('T')[0],
    reminderAt: '',
    priority: 'NORMAL' as FollowUpPriority,
    status: 'PENDING' as FollowUpStatus,
    assignedToUstadhId: '',
    incidentId: '',
    outcomeNotes: '',
  });
  const [followUpSubmitting, setFollowUpSubmitting] = useState(false);
  const [followUpError, setFollowUpError] = useState<string | null>(null);

  // Timeline State
  const [timelineEvents, setTimelineEvents] = useState<StudentTimelineEvent[]>([]);
  const [timelineFilter, setTimelineFilter] = useState<string>('ALL');
  const [timelineLoading, setTimelineLoading] = useState(false);

  useEffect(() => {
    listUstadhs({ isActive: true })
      .then((res) => setUstadhs(res.items || []))
      .catch(() => {});
  }, []);

  const loadQualifications = useCallback(async () => {
    try {
      setQualLoading(true);
      const data = await apiGetStudentQualifications(studentId);
      setQualifications(data.items);
      setQualSummary(data.summary);
    } catch (err) {
      console.error('Failed to load qualifications:', err);
    } finally {
      setQualLoading(false);
    }
  }, [studentId]);

  const loadIncidents = useCallback(async () => {
    try {
      setIncidentLoading(true);
      const data = await apiGetStudentIncidents(studentId);
      setIncidents(data.items);
      setIncidentSummary(data.summary);
    } catch (err) {
      console.error('Failed to load incidents:', err);
    } finally {
      setIncidentLoading(false);
    }
  }, [studentId]);

  const loadMeetings = useCallback(async () => {
    try {
      setMeetingsLoading(true);
      const data = await apiGetStudentMeetings(studentId);
      setMeetings(data.items);
    } catch (err) {
      console.error('Failed to load meetings:', err);
    } finally {
      setMeetingsLoading(false);
    }
  }, [studentId]);

  const loadFollowUps = useCallback(async () => {
    try {
      setFollowUpsLoading(true);
      const data = await apiGetStudentFollowUps(studentId);
      setFollowUps(data.items);
      setFollowUpSummary(data.summary);
    } catch (err) {
      console.error('Failed to load follow-ups:', err);
    } finally {
      setFollowUpsLoading(false);
    }
  }, [studentId]);

  const loadTimeline = useCallback(async () => {
    try {
      setTimelineLoading(true);
      const data = await apiGetStudentTimeline(studentId, timelineFilter);
      setTimelineEvents(data.items);
    } catch (err) {
      console.error('Failed to load timeline:', err);
    } finally {
      setTimelineLoading(false);
    }
  }, [studentId, timelineFilter]);

  useEffect(() => {
    if (activeSubTab === 'QUALIFICATIONS') loadQualifications();
    if (activeSubTab === 'DISCIPLINE') loadIncidents();
    if (activeSubTab === 'MEETINGS') {
      loadMeetings();
      loadIncidents();
    }
    if (activeSubTab === 'FOLLOW_UPS') {
      loadFollowUps();
      loadIncidents();
    }
    if (activeSubTab === 'TIMELINE') loadTimeline();
  }, [activeSubTab, loadQualifications, loadIncidents, loadMeetings, loadFollowUps, loadTimeline]);

  // Handlers: Qualifications
  const openCreateQualModal = () => {
    setEditingQual(null);
    setQualForm({
      recordType: 'QUALIFICATION',
      category: 'QIRAATH',
      title: '',
      issuingAuthority: '',
      certificateNumber: '',
      progressStatus: 'COMPLETED',
      verificationStatus: 'PENDING',
      achievedDate: new Date().toISOString().split('T')[0],
      expiryDate: '',
      gradeOrScore: '',
      description: '',
      examinerUstadhId: '',
      rejectionReason: '',
    });
    setQualFile(null);
    setQualError(null);
    setIsQualModalOpen(true);
  };

  const openEditQualModal = (q: StudentQualificationItem) => {
    setEditingQual(q);
    setQualForm({
      recordType: q.recordType,
      category: q.category,
      title: q.title,
      issuingAuthority: q.issuingAuthority || '',
      certificateNumber: q.certificateNumber || '',
      progressStatus: q.progressStatus,
      verificationStatus: q.verificationStatus,
      achievedDate: q.achievedDate || '',
      expiryDate: q.expiryDate || '',
      gradeOrScore: q.gradeOrScore || '',
      description: q.description || '',
      examinerUstadhId: q.examinerUstadhId || '',
      rejectionReason: q.rejectionReason || '',
    });
    setQualFile(null);
    setQualError(null);
    setIsQualModalOpen(true);
  };

  const handleSaveQualification = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setQualSubmitting(true);
      setQualError(null);

      const fd = new FormData();
      fd.append('recordType', qualForm.recordType);
      fd.append('category', qualForm.category);
      fd.append('title', qualForm.title);
      fd.append('issuingAuthority', qualForm.issuingAuthority);
      fd.append('certificateNumber', qualForm.certificateNumber);
      fd.append('progressStatus', qualForm.progressStatus);
      fd.append('verificationStatus', qualForm.verificationStatus);
      if (qualForm.achievedDate) fd.append('achievedDate', qualForm.achievedDate);
      if (qualForm.expiryDate) fd.append('expiryDate', qualForm.expiryDate);
      fd.append('gradeOrScore', qualForm.gradeOrScore);
      fd.append('description', qualForm.description);
      fd.append('examinerUstadhId', qualForm.examinerUstadhId);
      if (qualForm.verificationStatus === 'REJECTED') {
        fd.append('rejectionReason', qualForm.rejectionReason);
      }
      if (qualFile) {
        fd.append('certificate', qualFile);
      }

      if (editingQual) {
        await apiUpdateStudentQualification(studentId, editingQual.id, fd);
      } else {
        await apiCreateStudentQualification(studentId, fd);
      }

      setIsQualModalOpen(false);
      loadQualifications();
    } catch (err: any) {
      setQualError(err.response?.data?.message || 'Failed to save qualification record.');
    } finally {
      setQualSubmitting(false);
    }
  };

  const handleVerifyOrRejectQual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingQual) return;
    try {
      setReviewSubmitting(true);
      setReviewError(null);
      await apiVerifyStudentQualification(studentId, reviewingQual.id, {
        verificationStatus: reviewStatus,
        rejectionReason: reviewStatus === 'REJECTED' ? reviewRejectionReason : undefined,
      });
      setReviewingQual(null);
      loadQualifications();
    } catch (err: any) {
      setReviewError(err.response?.data?.message || 'Failed to update verification status.');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleAccessCertificate = async (qualId: string, mode: 'inline' | 'download') => {
    try {
      const res = await apiGetStudentQualificationCertificateUrl(studentId, qualId, mode);
      window.open(res.url, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Unable to access private certificate.');
    }
  };

  const handleDeleteQualification = async (qualId: string) => {
    if (!window.confirm('Are you sure you want to delete this qualification record?')) return;
    try {
      await apiDeleteStudentQualification(studentId, qualId);
      loadQualifications();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete qualification.');
    }
  };

  // Handlers: Incidents
  const openCreateIncidentModal = () => {
    setEditingIncident(null);
    setIncidentForm({
      title: '',
      category: 'BEHAVIOR_CONDUCT',
      severity: 'LOW',
      occurredAt: new Date().toISOString().slice(0, 16),
      location: '',
      isConfidential: true,
      reportedDescription: '',
      reportedByUstadhId: '',
      verificationStatus: 'REPORTED',
      investigatedFindings: '',
      actionTaken: '',
      dismissalReason: '',
      guardianNotified: false,
    });
    setIncidentFile(null);
    setIncidentError(null);
    setIsIncidentModalOpen(true);
  };

  const openEditIncidentModal = (inc: StudentIncidentItem) => {
    setEditingIncident(inc);
    setIncidentForm({
      title: inc.title,
      category: inc.category,
      severity: inc.severity,
      occurredAt: inc.occurredAt ? new Date(inc.occurredAt).toISOString().slice(0, 16) : '',
      location: inc.location || '',
      isConfidential: inc.isConfidential,
      reportedDescription: inc.reportedDescription,
      reportedByUstadhId: inc.reportedByUstadhId || '',
      verificationStatus: inc.verificationStatus,
      investigatedFindings: inc.investigatedFindings || '',
      actionTaken: inc.actionTaken || '',
      dismissalReason: inc.dismissalReason || '',
      guardianNotified: inc.guardianNotified,
    });
    setIncidentFile(null);
    setIncidentError(null);
    setIsIncidentModalOpen(true);
  };

  const handleSaveIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIncidentSubmitting(true);
      setIncidentError(null);

      if (incidentForm.verificationStatus === 'DISMISSED' && !incidentForm.dismissalReason.trim()) {
        setIncidentError('An explicit dismissal reason is required to mark an incident as DISMISSED.');
        setIncidentSubmitting(false);
        return;
      }

      if (incidentForm.verificationStatus === 'CONFIRMED' && !incidentForm.investigatedFindings.trim()) {
        setIncidentError('Investigated findings are required to mark an incident as CONFIRMED.');
        setIncidentSubmitting(false);
        return;
      }

      if (
        incidentForm.verificationStatus === 'RESOLVED' &&
        !incidentForm.investigatedFindings.trim() &&
        !incidentForm.actionTaken.trim()
      ) {
        setIncidentError('Investigated findings or action taken are required to mark an incident as RESOLVED.');
        setIncidentSubmitting(false);
        return;
      }

      const fd = new FormData();
      fd.append('title', incidentForm.title);
      fd.append('category', incidentForm.category);
      fd.append('severity', incidentForm.severity);
      fd.append('occurredAt', new Date(incidentForm.occurredAt).toISOString());
      fd.append('location', incidentForm.location);
      fd.append('isConfidential', String(incidentForm.isConfidential));
      fd.append('reportedDescription', incidentForm.reportedDescription);
      fd.append('reportedByUstadhId', incidentForm.reportedByUstadhId);
      fd.append('verificationStatus', incidentForm.verificationStatus);
      fd.append('investigatedFindings', incidentForm.investigatedFindings);
      fd.append('actionTaken', incidentForm.actionTaken);
      fd.append('dismissalReason', incidentForm.dismissalReason);
      fd.append('guardianNotified', String(incidentForm.guardianNotified));
      if (incidentFile) {
        fd.append('evidence', incidentFile);
      }

      if (editingIncident) {
        await apiUpdateStudentIncident(studentId, editingIncident.id, fd);
      } else {
        await apiCreateStudentIncident(studentId, fd);
      }

      setIsIncidentModalOpen(false);
      loadIncidents();
    } catch (err: any) {
      setIncidentError(err.response?.data?.message || 'Failed to save incident record.');
    } finally {
      setIncidentSubmitting(false);
    }
  };

  const handleAccessEvidence = async (incidentId: string, mode: 'inline' | 'download') => {
    try {
      const res = await apiGetStudentIncidentEvidenceUrl(studentId, incidentId, mode);
      window.open(res.url, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Unable to access private incident evidence.');
    }
  };

  const handleDeleteIncident = async (incidentId: string) => {
    if (!window.confirm('Are you sure you want to delete this incident record?')) return;
    try {
      await apiDeleteStudentIncident(studentId, incidentId);
      loadIncidents();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete incident.');
    }
  };

  // Handlers: Meetings
  const openCreateMeetingModal = () => {
    setEditingMeeting(null);
    setMeetingForm({
      meetingType: 'GUARDIAN_CONFERENCE',
      title: '',
      meetingAt: new Date().toISOString().slice(0, 16),
      location: '',
      participantsSummary: '',
      ustadhId: '',
      incidentId: '',
      discussionNotes: '',
      outcomeSummary: '',
    });
    setMeetingError(null);
    setIsMeetingModalOpen(true);
  };

  const openEditMeetingModal = (m: StudentMeetingItem) => {
    setEditingMeeting(m);
    setMeetingForm({
      meetingType: m.meetingType,
      title: m.title,
      meetingAt: m.meetingAt ? new Date(m.meetingAt).toISOString().slice(0, 16) : '',
      location: m.location || '',
      participantsSummary: m.participantsSummary,
      ustadhId: m.ustadhId || '',
      incidentId: m.incidentId || '',
      discussionNotes: m.discussionNotes,
      outcomeSummary: m.outcomeSummary || '',
    });
    setMeetingError(null);
    setIsMeetingModalOpen(true);
  };

  const handleSaveMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setMeetingSubmitting(true);
      setMeetingError(null);
      const payload = {
        ...meetingForm,
        meetingAt: new Date(meetingForm.meetingAt).toISOString(),
      };
      if (editingMeeting) {
        await apiUpdateStudentMeeting(studentId, editingMeeting.id, payload);
      } else {
        await apiCreateStudentMeeting(studentId, payload);
      }
      setIsMeetingModalOpen(false);
      loadMeetings();
    } catch (err: any) {
      setMeetingError(err.response?.data?.message || 'Failed to save meeting record.');
    } finally {
      setMeetingSubmitting(false);
    }
  };

  const handleDeleteMeeting = async (meetingId: string) => {
    if (!window.confirm('Are you sure you want to delete this meeting record?')) return;
    try {
      await apiDeleteStudentMeeting(studentId, meetingId);
      loadMeetings();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete meeting.');
    }
  };

  // Handlers: Follow-Ups
  const openCreateFollowUpModal = () => {
    setEditingFollowUp(null);
    setFollowUpForm({
      title: '',
      notes: '',
      dueDate: new Date().toISOString().split('T')[0],
      reminderAt: '',
      priority: 'NORMAL',
      status: 'PENDING',
      assignedToUstadhId: '',
      incidentId: '',
      outcomeNotes: '',
    });
    setFollowUpError(null);
    setIsFollowUpModalOpen(true);
  };

  const openEditFollowUpModal = (f: StudentFollowUpItem) => {
    setEditingFollowUp(f);
    setFollowUpForm({
      title: f.title,
      notes: f.notes || '',
      dueDate: f.dueDate,
      reminderAt: f.reminderAt ? new Date(f.reminderAt).toISOString().slice(0, 16) : '',
      priority: f.priority,
      status: f.status,
      assignedToUstadhId: f.assignedToUstadhId || '',
      incidentId: f.incidentId || '',
      outcomeNotes: f.outcomeNotes || '',
    });
    setFollowUpError(null);
    setIsFollowUpModalOpen(true);
  };

  const handleSaveFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setFollowUpSubmitting(true);
      setFollowUpError(null);
      const payload = {
        ...followUpForm,
        reminderAt: followUpForm.reminderAt ? new Date(followUpForm.reminderAt).toISOString() : null,
      };
      if (editingFollowUp) {
        await apiUpdateStudentFollowUp(studentId, editingFollowUp.id, payload);
      } else {
        await apiCreateStudentFollowUp(studentId, payload);
      }
      setIsFollowUpModalOpen(false);
      loadFollowUps();
    } catch (err: any) {
      setFollowUpError(err.response?.data?.message || 'Failed to save follow-up.');
    } finally {
      setFollowUpSubmitting(false);
    }
  };

  const handleQuickCompleteFollowUp = async (f: StudentFollowUpItem) => {
    const notes = window.prompt('Enter completion outcome notes (optional):', f.outcomeNotes || '');
    if (notes === null) return;
    try {
      await apiUpdateStudentFollowUp(studentId, f.id, {
        status: 'COMPLETED',
        outcomeNotes: notes,
      });
      loadFollowUps();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to complete follow-up.');
    }
  };

  const handleDeleteFollowUp = async (followUpId: string) => {
    if (!window.confirm('Are you sure you want to delete this follow-up?')) return;
    try {
      await apiDeleteStudentFollowUp(studentId, followUpId);
      loadFollowUps();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete follow-up.');
    }
  };

  return (
    <div className="space-y-6">
      {/* =====================================================================
          1. QUALIFICATIONS & CERTIFICATES TAB
      ===================================================================== */}
      {activeSubTab === 'QUALIFICATIONS' && (
        <div className="space-y-5">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-[#E7E9EE] shadow-xs">
              <span className="text-[11px] font-bold text-[#7C8A9A] uppercase">Total Records</span>
              <div className="text-xl font-black text-[#0F172A] mt-1">{qualSummary.total}</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-[#E7E9EE] shadow-xs">
              <span className="text-[11px] font-bold text-blue-700 uppercase">In Progress</span>
              <div className="text-xl font-black text-blue-700 mt-1">{qualSummary.inProgressCount}</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-[#E7E9EE] shadow-xs">
              <span className="text-[11px] font-bold text-emerald-700 uppercase">Verified Certs</span>
              <div className="text-xl font-black text-emerald-700 mt-1">{qualSummary.verifiedCount}</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-[#E7E9EE] shadow-xs">
              <span className="text-[11px] font-bold text-amber-700 uppercase">Pending Review</span>
              <div className="text-xl font-black text-amber-700 mt-1">{qualSummary.pendingCount}</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-[#E7E9EE] shadow-xs">
              <span className="text-[11px] font-bold text-rose-700 uppercase">Rejected</span>
              <div className="text-xl font-black text-rose-700 mt-1">{qualSummary.rejectedCount}</div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-[#E7E9EE] shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[#E7E9EE]">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-[#08483A]" />
                <h2 className="text-sm font-bold text-[#0F172A]">
                  Qualifications, Qiraath & Certificates ({studentName})
                </h2>
              </div>
              <button
                onClick={openCreateQualModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#08483A] hover:bg-[#073d31] rounded-xl transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Qualification / Certificate</span>
              </button>
            </div>

            {qualLoading ? (
              <div className="py-12 text-center text-[#7C8A9A]">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#08483A]" />
                <p className="text-xs">Loading qualifications & certificates...</p>
              </div>
            ) : qualifications.length === 0 ? (
              <div className="py-12 text-center text-[#7C8A9A] bg-[#F8F9FA] rounded-xl border border-dashed border-[#E7E9EE]">
                <Award className="w-8 h-8 mx-auto mb-2 text-[#7C8A9A]/60" />
                <p className="text-xs font-semibold text-[#0F172A]">No qualifications or certificates recorded yet</p>
                <p className="text-[11px] mt-0.5">
                  Record Hifz Juz completions, Qiraath tracks, Tajweed certificates, or competition achievements.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {qualifications.map((q) => (
                  <div
                    key={q.id}
                    className="p-4 rounded-xl border border-[#E7E9EE] hover:border-[#08483A]/30 transition bg-white space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#08483A]/10 text-[#08483A]">
                            {QUALIFICATION_CATEGORY_LABELS[q.category] || q.category}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                            {q.recordType}
                          </span>
                          {/* Progress Status Badge */}
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              q.progressStatus === 'COMPLETED'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            }`}
                          >
                            Progress: {q.progressStatus === 'COMPLETED' ? 'Completed' : 'In Progress'}
                          </span>
                          {/* Certificate Verification Badge */}
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              q.verificationStatus === 'VERIFIED'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : q.verificationStatus === 'REJECTED'
                                ? 'bg-rose-50 text-rose-800 border-rose-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}
                          >
                            {q.verificationStatus === 'VERIFIED' && <CheckCircle2 className="w-3 h-3" />}
                            {q.verificationStatus === 'REJECTED' && <XCircle className="w-3 h-3" />}
                            {q.verificationStatus === 'PENDING' && <Clock className="w-3 h-3" />}
                            Verification: {q.verificationStatus}
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-[#0F172A]">{q.title}</h3>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#5B6B7F]">
                          {q.achievedDate && <span>Date: {q.achievedDate}</span>}
                          {q.gradeOrScore && <span>Grade/Score: {q.gradeOrScore}</span>}
                          {q.certificateNumber && <span>Cert #: {q.certificateNumber}</span>}
                          {q.issuingAuthority && <span>Issued By: {q.issuingAuthority}</span>}
                          {q.examinerUstadh && <span>Examiner: {q.examinerUstadh.fullName}</span>}
                        </div>
                        {q.description && <p className="text-xs text-[#0F172A]/80 mt-1">{q.description}</p>}
                        {q.reviewedByUser && (
                          <p className="text-[11px] text-[#7C8A9A] mt-1">
                            Reviewed by <span className="font-semibold text-[#0F172A]">{q.reviewedByUser.name}</span>
                            {q.reviewedAt ? ` on ${new Date(q.reviewedAt).toLocaleString()}` : ''}
                          </p>
                        )}
                        {q.verificationStatus === 'REJECTED' && q.rejectionReason && (
                          <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 mt-1">
                            <span className="font-bold">Rejection Reason:</span> {q.rejectionReason}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {q.hasCertificateFile && (
                          <>
                            <button
                              onClick={() => handleAccessCertificate(q.id, 'inline')}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-[#08483A] bg-emerald-50 hover:bg-emerald-100 rounded-lg transition cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View Cert</span>
                            </button>
                            <button
                              onClick={() => handleAccessCertificate(q.id, 'download')}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Download</span>
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => {
                            setReviewingQual(q);
                            setReviewStatus(q.verificationStatus === 'REJECTED' ? 'REJECTED' : 'VERIFIED');
                            setReviewRejectionReason(q.rejectionReason || '');
                            setReviewError(null);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 rounded-lg transition cursor-pointer"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Verify / Reject</span>
                        </button>
                        <button
                          onClick={() => openEditQualModal(q)}
                          className="p-1.5 text-[#5B6B7F] hover:text-[#0F172A] hover:bg-gray-100 rounded-lg transition cursor-pointer"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteQualification(q.id)}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          2. DISCIPLINE & INCIDENTS TAB
      ===================================================================== */}
      {activeSubTab === 'DISCIPLINE' && (
        <div className="space-y-5">
          {/* KPI Summary Cards separating Unconfirmed, Confirmed, and Dismissed */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-[#E7E9EE] shadow-xs">
              <span className="text-[11px] font-bold text-[#7C8A9A] uppercase">Total Logged</span>
              <div className="text-xl font-black text-[#0F172A] mt-1">{incidentSummary.total}</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-xs">
              <span className="text-[11px] font-bold text-amber-700 uppercase">Unconfirmed</span>
              <div className="text-xl font-black text-amber-700 mt-1">{incidentSummary.unconfirmedCount}</div>
              <p className="text-[10px] text-[#7C8A9A] mt-0.5">Reported / Under Review</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-rose-200 shadow-xs">
              <span className="text-[11px] font-bold text-rose-700 uppercase">Confirmed</span>
              <div className="text-xl font-black text-rose-700 mt-1">{incidentSummary.confirmedCount}</div>
              <p className="text-[10px] text-[#7C8A9A] mt-0.5">Proven Misconduct</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-xs">
              <span className="text-[11px] font-bold text-emerald-700 uppercase">Resolved</span>
              <div className="text-xl font-black text-emerald-700 mt-1">{incidentSummary.resolvedCount ?? 0}</div>
              <p className="text-[10px] text-[#7C8A9A] mt-0.5">Resolved Incidents</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-600 uppercase">Dismissed</span>
              <div className="text-xl font-black text-slate-700 mt-1">{incidentSummary.dismissedCount}</div>
              <p className="text-[10px] text-[#7C8A9A] mt-0.5">Not Proven Misconduct</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-[#E7E9EE] shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[#E7E9EE]">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-[#08483A]" />
                <h2 className="text-sm font-bold text-[#0F172A]">
                  Student Discipline & Incident Records
                </h2>
              </div>
              <button
                onClick={openCreateIncidentModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#08483A] hover:bg-[#073d31] rounded-xl transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Log Incident Report</span>
              </button>
            </div>

            {incidentLoading ? (
              <div className="py-12 text-center text-[#7C8A9A]">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#08483A]" />
                <p className="text-xs">Loading incident records...</p>
              </div>
            ) : incidents.length === 0 ? (
              <div className="py-12 text-center text-[#7C8A9A] bg-[#F8F9FA] rounded-xl border border-dashed border-[#E7E9EE]">
                <ShieldAlert className="w-8 h-8 mx-auto mb-2 text-[#7C8A9A]/60" />
                <p className="text-xs font-semibold text-[#0F172A]">Clean disciplinary record</p>
                <p className="text-[11px] mt-0.5">No incident reports have been logged for this student.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {incidents.map((inc) => (
                  <div
                    key={inc.id}
                    className={`p-4 rounded-xl border transition space-y-3 ${
                      inc.isDismissed
                        ? 'bg-slate-50/70 border-slate-200'
                        : inc.isConfirmedMisconduct
                        ? 'bg-white border-rose-200'
                        : inc.verificationStatus === 'RESOLVED' || inc.isResolved
                        ? 'bg-white border-emerald-200'
                        : 'bg-white border-amber-200'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800">
                            {INCIDENT_CATEGORY_LABELS[inc.category] || inc.category}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              inc.severity === 'CRITICAL' || inc.severity === 'HIGH'
                                ? 'bg-rose-100 text-rose-800'
                                : inc.severity === 'MEDIUM'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-blue-50 text-blue-700'
                            }`}
                          >
                            Severity: {inc.severity}
                          </span>
                          {/* Verification Classification Badge */}
                          {inc.isDismissed ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                              DISMISSED — Not Proven Misconduct
                            </span>
                          ) : inc.isConfirmedMisconduct ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                              Confirmed Finding
                            </span>
                          ) : inc.verificationStatus === 'RESOLVED' || inc.isResolved ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              Resolved Incident
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              Unconfirmed Report ({inc.verificationStatus})
                            </span>
                          )}
                        </div>
                        <h3 className="text-sm font-bold text-[#0F172A]">{inc.title}</h3>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#5B6B7F]">
                          <span>Incident Date & Time: {new Date(inc.occurredAt).toLocaleString()}</span>
                          {inc.location && <span>Location: {inc.location}</span>}
                          {inc.reportedByUstadh && <span>Reported By: {inc.reportedByUstadh.fullName}</span>}
                          {inc.guardianNotified && (
                            <span className="text-emerald-700 font-semibold">✓ Guardian Notified</span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {inc.hasEvidenceFile && (
                          <>
                            <button
                              onClick={() => handleAccessEvidence(inc.id, 'inline')}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-[#08483A] bg-emerald-50 hover:bg-emerald-100 rounded-lg transition cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View Evidence</span>
                            </button>
                            <button
                              onClick={() => handleAccessEvidence(inc.id, 'download')}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Download</span>
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => openEditIncidentModal(inc)}
                          className="p-1.5 text-[#5B6B7F] hover:text-[#0F172A] hover:bg-gray-100 rounded-lg transition cursor-pointer"
                          title="Investigate / Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteIncident(inc.id)}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Explicit Separation of Original Report vs Investigated Findings vs Action Taken */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-[#E7E9EE]">
                      <div className="p-3 rounded-lg bg-[#F8F9FA] text-xs space-y-1">
                        <span className="font-bold text-[#5B6B7F] uppercase text-[10px] block">
                          1. Original Incident Report
                        </span>
                        <p className="text-[#0F172A]">{inc.reportedDescription}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-[#F8F9FA] text-xs space-y-1">
                        <span className="font-bold text-[#5B6B7F] uppercase text-[10px] block">
                          2. Investigated Findings
                        </span>
                        <p className="text-[#0F172A]">
                          {inc.investigatedFindings || (
                            <span className="italic text-[#7C8A9A]">Pending investigation findings</span>
                          )}
                        </p>
                        {inc.isDismissed && inc.dismissalReason && (
                          <p className="text-slate-700 font-medium mt-1">
                            Dismissal Reason: {inc.dismissalReason}
                          </p>
                        )}
                      </div>
                      <div className="p-3 rounded-lg bg-[#F8F9FA] text-xs space-y-1">
                        <span className="font-bold text-[#5B6B7F] uppercase text-[10px] block">
                          3. Action Taken
                        </span>
                        <p className="text-[#0F172A]">
                          {inc.actionTaken || <span className="italic text-[#7C8A9A]">No action recorded</span>}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          3. MEETINGS TAB
      ===================================================================== */}
      {activeSubTab === 'MEETINGS' && (
        <div className="bg-white p-6 rounded-2xl border border-[#E7E9EE] shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[#E7E9EE]">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#08483A]" />
              <h2 className="text-sm font-bold text-[#0F172A]">Student & Guardian Meetings</h2>
            </div>
            <button
              onClick={openCreateMeetingModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#08483A] hover:bg-[#073d31] rounded-xl transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record Meeting</span>
            </button>
          </div>

          {meetingsLoading ? (
            <div className="py-12 text-center text-[#7C8A9A]">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#08483A]" />
              <p className="text-xs">Loading meetings...</p>
            </div>
          ) : meetings.length === 0 ? (
            <div className="py-12 text-center text-[#7C8A9A] bg-[#F8F9FA] rounded-xl border border-dashed border-[#E7E9EE]">
              <Users className="w-8 h-8 mx-auto mb-2 text-[#7C8A9A]/60" />
              <p className="text-xs font-semibold text-[#0F172A]">No meetings recorded yet</p>
              <p className="text-[11px] mt-0.5">
                Log guardian conferences, academic reviews, or counseling sessions.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {meetings.map((m) => (
                <div key={m.id} className="p-4 rounded-xl border border-[#E7E9EE] space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#08483A]/10 text-[#08483A]">
                          {MEETING_TYPE_LABELS[m.meetingType] || m.meetingType}
                        </span>
                        <span className="text-[11px] text-[#5B6B7F]">
                          {new Date(m.meetingAt).toLocaleString()}
                        </span>
                        {m.location && <span className="text-[11px] text-[#5B6B7F]">• {m.location}</span>}
                      </div>
                      <h3 className="text-sm font-bold text-[#0F172A]">{m.title}</h3>
                      <p className="text-xs text-[#5B6B7F]">
                        <span className="font-semibold text-[#0F172A]">Participants:</span> {m.participantsSummary}
                        {m.ustadh ? ` • Ustadh: ${m.ustadh.fullName}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditMeetingModal(m)}
                        className="p-1.5 text-[#5B6B7F] hover:text-[#0F172A] hover:bg-gray-100 rounded-lg transition cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteMeeting(m.id)}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-[#E7E9EE] text-xs">
                    <div>
                      <span className="font-bold text-[#5B6B7F] uppercase text-[10px] block">Discussion Notes</span>
                      <p className="text-[#0F172A] mt-0.5">{m.discussionNotes}</p>
                    </div>
                    <div>
                      <span className="font-bold text-[#5B6B7F] uppercase text-[10px] block">Agreed Outcome</span>
                      <p className="text-[#0F172A] mt-0.5">{m.outcomeSummary || '—'}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          4. FOLLOW-UPS & REMINDERS TAB
      ===================================================================== */}
      {activeSubTab === 'FOLLOW_UPS' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-rose-200 shadow-xs">
              <span className="text-[11px] font-bold text-rose-700 uppercase">Overdue</span>
              <div className="text-xl font-black text-rose-700 mt-1">{followUpSummary.overdueCount}</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-xs">
              <span className="text-[11px] font-bold text-amber-700 uppercase">Due Today</span>
              <div className="text-xl font-black text-amber-700 mt-1">{followUpSummary.dueTodayCount}</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-blue-200 shadow-xs">
              <span className="text-[11px] font-bold text-blue-700 uppercase">Upcoming</span>
              <div className="text-xl font-black text-blue-700 mt-1">{followUpSummary.upcomingCount}</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-xs">
              <span className="text-[11px] font-bold text-emerald-700 uppercase">Completed</span>
              <div className="text-xl font-black text-emerald-700 mt-1">{followUpSummary.completedCount}</div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-[#E7E9EE] shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[#E7E9EE]">
              <div className="flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-[#08483A]" />
                <h2 className="text-sm font-bold text-[#0F172A]">Follow-Ups & Scheduled Reminders</h2>
              </div>
              <button
                onClick={openCreateFollowUpModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#08483A] hover:bg-[#073d31] rounded-xl transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Schedule Follow-Up</span>
              </button>
            </div>

            {followUpsLoading ? (
              <div className="py-12 text-center text-[#7C8A9A]">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#08483A]" />
                <p className="text-xs">Loading follow-ups...</p>
              </div>
            ) : followUps.length === 0 ? (
              <div className="py-12 text-center text-[#7C8A9A] bg-[#F8F9FA] rounded-xl border border-dashed border-[#E7E9EE]">
                <CalendarClock className="w-8 h-8 mx-auto mb-2 text-[#7C8A9A]/60" />
                <p className="text-xs font-semibold text-[#0F172A]">No follow-ups scheduled</p>
                <p className="text-[11px] mt-0.5">
                  Schedule follow-up dates and automated email reminders for Ustadhs or Admins.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {followUps.map((f) => (
                  <div
                    key={f.id}
                    className={`p-4 rounded-xl border transition space-y-2 ${
                      f.isOverdue
                        ? 'border-rose-200 bg-rose-50/20'
                        : f.isDueToday
                        ? 'border-amber-200 bg-amber-50/20'
                        : 'border-[#E7E9EE] bg-white'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              f.status === 'COMPLETED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : f.status === 'CANCELLED'
                                ? 'bg-slate-200 text-slate-700'
                                : f.isOverdue
                                ? 'bg-rose-100 text-rose-800'
                                : f.isDueToday
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-blue-50 text-blue-700'
                            }`}
                          >
                            {f.isOverdue ? 'OVERDUE' : f.isDueToday ? 'DUE TODAY' : f.status}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                            Priority: {f.priority}
                          </span>
                          <span className="text-[11px] font-semibold text-[#0F172A]">Due: {f.dueDate}</span>
                          {f.reminderAt && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-[#5B6B7F]">
                              <Bell className="w-3 h-3 text-[#37C6A3]" />
                              Reminder: {new Date(f.reminderAt).toLocaleString()}
                              {f.reminderSentAt ? ' (Sent ✓)' : ''}
                            </span>
                          )}
                        </div>
                        <h3 className="text-sm font-bold text-[#0F172A]">{f.title}</h3>
                        {f.notes && <p className="text-xs text-[#5B6B7F]">{f.notes}</p>}
                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#7C8A9A]">
                          {f.assignedToUstadh && (
                            <span>Assigned Ustadh: {f.assignedToUstadh.fullName}</span>
                          )}
                          {f.incident && <span>Linked Incident: {f.incident.title}</span>}
                        </div>
                        {f.outcomeNotes && (
                          <div className="p-2 rounded bg-emerald-50/60 border border-emerald-200 text-xs text-emerald-900 mt-1">
                            <span className="font-bold">Outcome:</span> {f.outcomeNotes}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {(f.status === 'PENDING' || f.status === 'IN_PROGRESS') && (
                          <button
                            onClick={() => handleQuickCompleteFollowUp(f)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition cursor-pointer"
                          >
                            <CheckSquare className="w-3.5 h-3.5" />
                            <span>Mark Complete</span>
                          </button>
                        )}
                        <button
                          onClick={() => openEditFollowUpModal(f)}
                          className="p-1.5 text-[#5B6B7F] hover:text-[#0F172A] hover:bg-gray-100 rounded-lg transition cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteFollowUp(f.id)}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          5. CHRONOLOGICAL TIMELINE TAB
      ===================================================================== */}
      {activeSubTab === 'TIMELINE' && (
        <div className="bg-white p-6 rounded-2xl border border-[#E7E9EE] shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[#E7E9EE]">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-[#08483A]" />
              <h2 className="text-sm font-bold text-[#0F172A]">Unified Student Chronological Timeline</h2>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-[#7C8A9A] mr-1" />
              {['ALL', 'ENROLLMENT', 'QUALIFICATION', 'ACHIEVEMENT', 'DISCIPLINE', 'MEETING', 'FOLLOW_UP'].map(
                (cat) => (
                  <button
                    key={cat}
                    onClick={() => setTimelineFilter(cat)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                      timelineFilter === cat
                        ? 'bg-[#08483A] text-white'
                        : 'bg-[#F8F9FA] text-[#5B6B7F] hover:text-[#0F172A]'
                    }`}
                  >
                    {cat.replace('_', ' ')}
                  </button>
                )
              )}
            </div>
          </div>

          {timelineLoading ? (
            <div className="py-12 text-center text-[#7C8A9A]">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#08483A]" />
              <p className="text-xs">Loading chronological timeline...</p>
            </div>
          ) : timelineEvents.length === 0 ? (
            <div className="py-12 text-center text-[#7C8A9A]">
              <p className="text-xs">No timeline events found for the selected filter.</p>
            </div>
          ) : (
            <div className="relative pl-6 border-l-2 border-[#E7E9EE] space-y-5">
              {timelineEvents.map((ev) => (
                <div key={ev.id} className="relative bg-[#F8F9FA] p-4 rounded-xl border border-[#E7E9EE]">
                  <span className="absolute -left-[31px] top-4 w-3.5 h-3.5 rounded-full bg-[#08483A] border-2 border-white" />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white border border-[#E7E9EE] text-[#08483A]">
                      {ev.type}
                    </span>
                    <span className="text-[11px] font-mono text-[#7C8A9A]">
                      {new Date(ev.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-[#0F172A] mt-1">{ev.title}</h3>
                  <p className="text-xs font-medium text-[#5B6B7F]">{ev.subtitle}</p>
                  {ev.description && <p className="text-xs text-[#0F172A]/80 mt-1">{ev.description}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          MODAL: CREATE / EDIT QUALIFICATION
      ===================================================================== */}
      {isQualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-[#E7E9EE] shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#E7E9EE] pb-3">
              <h3 className="text-sm font-bold text-[#0F172A]">
                {editingQual ? 'Edit Qualification / Certificate' : 'Add Qualification / Certificate'}
              </h3>
              <button onClick={() => setIsQualModalOpen(false)} className="text-[#7C8A9A] hover:text-[#0F172A]">
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveQualification} className="space-y-3 text-xs">
              {qualError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{qualError}</span>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#0F172A] mb-1">Record Type</label>
                  <select
                    value={qualForm.recordType}
                    onChange={(e) => setQualForm({ ...qualForm, recordType: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F8F9FA] border border-[#E7E9EE] rounded-xl"
                  >
                    <option value="QUALIFICATION">Qualification / Certificate</option>
                    <option value="ACHIEVEMENT">Achievement / Award</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#0F172A] mb-1">Category</label>
                  <select
                    value={qualForm.category}
                    onChange={(e) =>
                      setQualForm({ ...qualForm, category: e.target.value as QualificationCategory })
                    }
                    className="w-full px-3 py-2 bg-[#F8F9FA] border border-[#E7E9EE] rounded-xl"
                  >
                    {Object.entries(QUALIFICATION_CATEGORY_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#0F172A] mb-1">Title *</label>
                <input
                  type="text"
                  required
                  value={qualForm.title}
                  onChange={(e) => setQualForm({ ...qualForm, title: e.target.value })}
                  placeholder="e.g., Sab'ah Qiraath Level 1 or Juz 30 Completion"
                  className="w-full px-3 py-2 bg-[#F8F9FA] border border-[#E7E9EE] rounded-xl"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#0F172A] mb-1">Qualification Progress Status</label>
                  <select
                    value={qualForm.progressStatus}
                    onChange={(e) =>
                      setQualForm({
                        ...qualForm,
                        progressStatus: e.target.value as QualificationProgressStatus,
                      })
                    }
                    className="w-full px-3 py-2 bg-[#F8F9FA] border border-[#E7E9EE] rounded-xl"
                  >
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="COMPLETED">Completed</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#0F172A] mb-1">Certificate Verification Status</label>
                  <select
                    value={qualForm.verificationStatus}
                    onChange={(e) =>
                      setQualForm({
                        ...qualForm,
                        verificationStatus: e.target.value as CertificateVerificationStatus,
                      })
                    }
                    className="w-full px-3 py-2 bg-[#F8F9FA] border border-[#E7E9EE] rounded-xl"
                  >
                    <option value="PENDING">Pending Verification</option>
                    <option value="VERIFIED">Verified</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                </div>
              </div>

              {qualForm.verificationStatus === 'REJECTED' && (
                <div>
                  <label className="block font-semibold text-rose-700 mb-1">Rejection Reason *</label>
                  <input
                    type="text"
                    required
                    value={qualForm.rejectionReason}
                    onChange={(e) => setQualForm({ ...qualForm, rejectionReason: e.target.value })}
                    placeholder="Reason for rejecting this certificate"
                    className="w-full px-3 py-2 bg-rose-50 border border-rose-200 rounded-xl"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#0F172A] mb-1">Achieved Date</label>
                  <input
                    type="date"
                    value={qualForm.achievedDate}
                    onChange={(e) => setQualForm({ ...qualForm, achievedDate: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F8F9FA] border border-[#E7E9EE] rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#0F172A] mb-1">Grade / Score</label>
                  <input
                    type="text"
                    value={qualForm.gradeOrScore}
                    onChange={(e) => setQualForm({ ...qualForm, gradeOrScore: e.target.value })}
                    placeholder="e.g., Mumtaz (95%)"
                    className="w-full px-3 py-2 bg-[#F8F9FA] border border-[#E7E9EE] rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#0F172A] mb-1">Issuing Authority</label>
                  <input
                    type="text"
                    value={qualForm.issuingAuthority}
                    onChange={(e) => setQualForm({ ...qualForm, issuingAuthority: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F8F9FA] border border-[#E7E9EE] rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#0F172A] mb-1">Examiner Ustadh</label>
                  <select
                    value={qualForm.examinerUstadhId}
                    onChange={(e) => setQualForm({ ...qualForm, examinerUstadhId: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F8F9FA] border border-[#E7E9EE] rounded-xl"
                  >
                    <option value="">— None —</option>
                    {ustadhs.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName} ({u.ustadhCode})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#0F172A] mb-1">Notes / Description</label>
                <textarea
                  rows={2}
                  value={qualForm.description}
                  onChange={(e) => setQualForm({ ...qualForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F8F9FA] border border-[#E7E9EE] rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#0F172A] mb-1">
                  Private Certificate File (PDF, JPG, PNG, WebP — Max 5MB)
                </label>
                <input
                  ref={qualFileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    if (file && file.size > 5 * 1024 * 1024) {
                      setQualError('File size exceeds 5MB limit.');
                      setQualFile(null);
                      e.target.value = '';
                      return;
                    }
                    setQualError(null);
                    setQualFile(file);
                  }}
                  className="hidden"
                />
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => qualFileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#FFD978] hover:bg-[#f5cf6d] text-[#0F172A] font-semibold text-xs rounded-xl shadow-xs transition cursor-pointer"
                  >
                    <Upload className="w-4 h-4 text-[#0F172A]" />
                    <span>Upload Certificate</span>
                  </button>

                  {qualFile && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#F8F9FA] border border-[#E7E9EE] rounded-xl text-xs max-w-full">
                      <span className="font-mono text-[#0F172A] max-w-[180px] sm:max-w-xs truncate" title={qualFile.name}>
                        {qualFile.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setQualFile(null);
                          if (qualFileInputRef.current) {
                            qualFileInputRef.current.value = '';
                          }
                        }}
                        className="p-0.5 text-[#5B6B7F] hover:text-rose-600 rounded cursor-pointer transition"
                        title="Clear selected file"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E7E9EE]">
                <button
                  type="button"
                  onClick={() => setIsQualModalOpen(false)}
                  className="px-4 py-2 font-semibold text-[#5B6B7F] hover:text-[#0F172A]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={qualSubmitting}
                  className="px-4 py-2 bg-[#08483A] text-white font-bold rounded-xl disabled:opacity-50"
                >
                  {qualSubmitting ? 'Saving...' : 'Save Qualification'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: VERIFY OR REJECT CERTIFICATE
      ===================================================================== */}
      {reviewingQual && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-[#E7E9EE] shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#E7E9EE] pb-3">
              <h3 className="text-sm font-bold text-[#0F172A]">Verify or Reject Certificate</h3>
              <button onClick={() => setReviewingQual(null)} className="text-[#7C8A9A] hover:text-[#0F172A]">
                ✕
              </button>
            </div>
            <form onSubmit={handleVerifyOrRejectQual} className="space-y-3 text-xs">
              {reviewError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700">{reviewError}</div>
              )}
              <p className="text-[#5B6B7F]">
                Reviewing: <span className="font-bold text-[#0F172A]">{reviewingQual.title}</span>
              </p>
              <div>
                <label className="block font-semibold text-[#0F172A] mb-1">Verification Decision</label>
                <select
                  value={reviewStatus}
                  onChange={(e) => setReviewStatus(e.target.value as CertificateVerificationStatus)}
                  className="w-full px-3 py-2 bg-[#F8F9FA] border border-[#E7E9EE] rounded-xl"
                >
                  <option value="VERIFIED">VERIFIED — Approve Certificate</option>
                  <option value="REJECTED">REJECTED — Reject with Reason</option>
                  <option value="PENDING">PENDING — Reset to Pending</option>
                </select>
              </div>
              {reviewStatus === 'REJECTED' && (
                <div>
                  <label className="block font-semibold text-rose-700 mb-1">Rejection Reason *</label>
                  <textarea
                    required
                    rows={3}
                    value={reviewRejectionReason}
                    onChange={(e) => setReviewRejectionReason(e.target.value)}
                    placeholder="Provide clear reason for rejection..."
                    className="w-full px-3 py-2 bg-rose-50 border border-rose-200 rounded-xl"
                  />
                </div>
              )}
              <div className="flex justify-end gap-2 pt-3 border-t border-[#E7E9EE]">
                <button
                  type="button"
                  onClick={() => setReviewingQual(null)}
                  className="px-4 py-2 font-semibold text-[#5B6B7F]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reviewSubmitting}
                  className="px-4 py-2 bg-[#08483A] text-white font-bold rounded-xl"
                >
                  {reviewSubmitting ? 'Updating...' : 'Save Decision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: CREATE / EDIT INCIDENT
      ===================================================================== */}
      {isIncidentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-[#E7E9EE] shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#E7E9EE] pb-3">
              <h3 className="text-sm font-bold text-[#0F172A]">
                {editingIncident ? 'Investigate / Update Incident Record' : 'Log Student Incident Report'}
              </h3>
              <button onClick={() => setIsIncidentModalOpen(false)} className="text-[#7C8A9A] hover:text-[#0F172A]">
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveIncident} className="space-y-3 text-xs">
              {incidentError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700">{incidentError}</div>
              )}
              <div>
                <label className="block font-semibold text-[#0F172A] mb-1">Incident Title *</label>
                <input
                  type="text"
                  required
                  value={incidentForm.title}
                  onChange={(e) => setIncidentForm({ ...incidentForm, title: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F8F9FA] border border-[#E7E9EE] rounded-xl"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-[#0F172A] mb-1">Category</label>
                  <select
                    value={incidentForm.category}
                    onChange={(e) =>
                      setIncidentForm({ ...incidentForm, category: e.target.value as IncidentCategory })
                    }
                    className="w-full px-3 py-2 bg-[#F8F9FA] border border-[#E7E9EE] rounded-xl"
                  >
                    {Object.entries(INCIDENT_CATEGORY_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#0F172A] mb-1">Severity</label>
                  <select
                    value={incidentForm.severity}
                    onChange={(e) =>
                      setIncidentForm({ ...incidentForm, severity: e.target.value as IncidentSeverity })
                    }
                    className="w-full px-3 py-2 bg-[#F8F9FA] border border-[#E7E9EE] rounded-xl"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#0F172A] mb-1">Verification Status</label>
                  <select
                    value={incidentForm.verificationStatus}
                    onChange={(e) =>
                      setIncidentForm({
                        ...incidentForm,
                        verificationStatus: e.target.value as IncidentVerificationStatus,
                      })
                    }
                    className="w-full px-3 py-2 bg-[#F8F9FA] border border-[#E7E9EE] rounded-xl"
                  >
                    <option value="REPORTED">Reported (Unconfirmed)</option>
                    <option value="UNDER_REVIEW">Under Review (Unconfirmed)</option>
                    <option value="CONFIRMED">Confirmed Finding</option>
                    <option value="RESOLVED">Resolved</option>
                    <option value="DISMISSED">Dismissed (Not Misconduct)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#0F172A] mb-1">Incident Date & Time *</label>
                  <input
                    type="datetime-local"
                    required
                    value={incidentForm.occurredAt}
                    onChange={(e) => setIncidentForm({ ...incidentForm, occurredAt: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F8F9FA] border border-[#E7E9EE] rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#0F172A] mb-1">Reporting Ustadh</label>
                  <select
                    value={incidentForm.reportedByUstadhId}
                    onChange={(e) => setIncidentForm({ ...incidentForm, reportedByUstadhId: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F8F9FA] border border-[#E7E9EE] rounded-xl"
                  >
                    <option value="">— Admin / Direct —</option>
                    {ustadhs.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#0F172A] mb-1">
                  1. Original Reported Description *
                </label>
                <textarea
                  rows={2}
                  required
                  value={incidentForm.reportedDescription}
                  onChange={(e) => setIncidentForm({ ...incidentForm, reportedDescription: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F8F9FA] border border-[#E7E9EE] rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#0F172A] mb-1">
                  2. Investigated Findings{' '}
                  {incidentForm.verificationStatus === 'CONFIRMED' && (
                    <span className="text-rose-600 font-bold">* (Required for Confirmed Findings)</span>
                  )}
                  {incidentForm.verificationStatus === 'RESOLVED' && (
                    <span className="text-amber-600 font-normal">
                      (Required if no Action Taken recorded)
                    </span>
                  )}
                </label>
                <textarea
                  rows={2}
                  value={incidentForm.investigatedFindings}
                  onChange={(e) => setIncidentForm({ ...incidentForm, investigatedFindings: e.target.value })}
                  placeholder="Document verified findings separately from the initial report..."
                  className="w-full px-3 py-2 bg-[#F8F9FA] border border-[#E7E9EE] rounded-xl"
                />
              </div>

              {incidentForm.verificationStatus === 'DISMISSED' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Dismissal Reason *</label>
                  <input
                    type="text"
                    required
                    value={incidentForm.dismissalReason}
                    onChange={(e) => setIncidentForm({ ...incidentForm, dismissalReason: e.target.value })}
                    placeholder="Reason report was dismissed as unsubstantiated..."
                    className="w-full px-3 py-2 bg-[#F8F9FA] border border-[#E7E9EE] rounded-xl"
                  />
                </div>
              )}

              <div>
                <label className="block font-semibold text-[#0F172A] mb-1">3. Action Taken</label>
                <textarea
                  rows={2}
                  value={incidentForm.actionTaken}
                  onChange={(e) => setIncidentForm({ ...incidentForm, actionTaken: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F8F9FA] border border-[#E7E9EE] rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#0F172A] mb-1">
                  Private Evidence File (Optional PDF, JPG, PNG, WebP — Max 5MB)
                </label>
                <input
                  ref={incidentFileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    if (file && file.size > 5 * 1024 * 1024) {
                      setIncidentError('File size exceeds 5MB limit.');
                      setIncidentFile(null);
                      e.target.value = '';
                      return;
                    }
                    setIncidentError(null);
                    setIncidentFile(file);
                  }}
                  className="hidden"
                />
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => incidentFileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#FFD978] hover:bg-[#f5cf6d] text-[#0F172A] font-semibold text-xs rounded-xl shadow-xs transition cursor-pointer"
                  >
                    <Upload className="w-4 h-4 text-[#0F172A]" />
                    <span>Upload Evidence</span>
                  </button>

                  {incidentFile && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#F8F9FA] border border-[#E7E9EE] rounded-xl text-xs max-w-full">
                      <span className="font-mono text-[#0F172A] max-w-[180px] sm:max-w-xs truncate" title={incidentFile.name}>
                        {incidentFile.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setIncidentFile(null);
                          if (incidentFileInputRef.current) {
                            incidentFileInputRef.current.value = '';
                          }
                        }}
                        className="p-0.5 text-[#5B6B7F] hover:text-rose-600 rounded cursor-pointer transition"
                        title="Clear selected file"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E7E9EE]">
                <button
                  type="button"
                  onClick={() => setIsIncidentModalOpen(false)}
                  className="px-4 py-2 font-semibold text-[#5B6B7F]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={incidentSubmitting}
                  className="px-4 py-2 bg-[#08483A] text-white font-bold rounded-xl"
                >
                  {incidentSubmitting ? 'Saving...' : 'Save Incident Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: CREATE / EDIT MEETING
      ===================================================================== */}
      {isMeetingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-[#E7E9EE] shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#E7E9EE] pb-3">
              <h3 className="text-sm font-bold text-[#0F172A]">
                {editingMeeting ? 'Edit Meeting Record' : 'Record Student / Guardian Meeting'}
              </h3>
              <button onClick={() => setIsMeetingModalOpen(false)} className="text-[#7C8A9A] hover:text-[#0F172A]">
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveMeeting} className="space-y-3 text-xs">
              {meetingError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700">{meetingError}</div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#0F172A] mb-1">Meeting Type</label>
                  <select
                    value={meetingForm.meetingType}
                    onChange={(e) =>
                      setMeetingForm({ ...meetingForm, meetingType: e.target.value as StudentMeetingType })
                    }
                    className="w-full px-3 py-2 bg-[#F8F9FA] border border-[#E7E9EE] rounded-xl"
                  >
                    {Object.entries(MEETING_TYPE_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#0F172A] mb-1">Date & Time *</label>
                  <input
                    type="datetime-local"
                    required
                    value={meetingForm.meetingAt}
                    onChange={(e) => setMeetingForm({ ...meetingForm, meetingAt: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F8F9FA] border border-[#E7E9EE] rounded-xl"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-[#0F172A] mb-1">Meeting Title *</label>
                <input
                  type="text"
                  required
                  value={meetingForm.title}
                  onChange={(e) => setMeetingForm({ ...meetingForm, title: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F8F9FA] border border-[#E7E9EE] rounded-xl"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#0F172A] mb-1">Participants Summary *</label>
                <input
                  type="text"
                  required
                  value={meetingForm.participantsSummary}
                  onChange={(e) => setMeetingForm({ ...meetingForm, participantsSummary: e.target.value })}
                  placeholder="e.g., Father, Class Ustadh, Principal"
                  className="w-full px-3 py-2 bg-[#F8F9FA] border border-[#E7E9EE] rounded-xl"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#0F172A] mb-1">Discussion Notes *</label>
                <textarea
                  rows={3}
                  required
                  value={meetingForm.discussionNotes}
                  onChange={(e) => setMeetingForm({ ...meetingForm, discussionNotes: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F8F9FA] border border-[#E7E9EE] rounded-xl"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#0F172A] mb-1">Agreed Outcome</label>
                <textarea
                  rows={2}
                  value={meetingForm.outcomeSummary}
                  onChange={(e) => setMeetingForm({ ...meetingForm, outcomeSummary: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F8F9FA] border border-[#E7E9EE] rounded-xl"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[#E7E9EE]">
                <button
                  type="button"
                  onClick={() => setIsMeetingModalOpen(false)}
                  className="px-4 py-2 font-semibold text-[#5B6B7F]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={meetingSubmitting}
                  className="px-4 py-2 bg-[#08483A] text-white font-bold rounded-xl"
                >
                  {meetingSubmitting ? 'Saving...' : 'Save Meeting'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: CREATE / EDIT FOLLOW-UP
      ===================================================================== */}
      {isFollowUpModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-[#E7E9EE] shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#E7E9EE] pb-3">
              <h3 className="text-sm font-bold text-[#0F172A]">
                {editingFollowUp ? 'Update / Reschedule Follow-Up' : 'Schedule Student Follow-Up'}
              </h3>
              <button onClick={() => setIsFollowUpModalOpen(false)} className="text-[#7C8A9A] hover:text-[#0F172A]">
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveFollowUp} className="space-y-3 text-xs">
              {followUpError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700">{followUpError}</div>
              )}
              <div>
                <label className="block font-semibold text-[#0F172A] mb-1">Follow-Up Title *</label>
                <input
                  type="text"
                  required
                  value={followUpForm.title}
                  onChange={(e) => setFollowUpForm({ ...followUpForm, title: e.target.value })}
                  placeholder="e.g., Review 2-week attendance & Qiraath revision"
                  className="w-full px-3 py-2 bg-[#F8F9FA] border border-[#E7E9EE] rounded-xl"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#0F172A] mb-1">Due Date *</label>
                  <input
                    type="date"
                    required
                    value={followUpForm.dueDate}
                    onChange={(e) => setFollowUpForm({ ...followUpForm, dueDate: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F8F9FA] border border-[#E7E9EE] rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#0F172A] mb-1">
                    Scheduled Reminder Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    value={followUpForm.reminderAt}
                    onChange={(e) => setFollowUpForm({ ...followUpForm, reminderAt: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F8F9FA] border border-[#E7E9EE] rounded-xl"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-[#0F172A] mb-1">Priority</label>
                  <select
                    value={followUpForm.priority}
                    onChange={(e) =>
                      setFollowUpForm({ ...followUpForm, priority: e.target.value as FollowUpPriority })
                    }
                    className="w-full px-3 py-2 bg-[#F8F9FA] border border-[#E7E9EE] rounded-xl"
                  >
                    <option value="LOW">Low</option>
                    <option value="NORMAL">Normal</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#0F172A] mb-1">Status</label>
                  <select
                    value={followUpForm.status}
                    onChange={(e) =>
                      setFollowUpForm({ ...followUpForm, status: e.target.value as FollowUpStatus })
                    }
                    className="w-full px-3 py-2 bg-[#F8F9FA] border border-[#E7E9EE] rounded-xl"
                  >
                    <option value="PENDING">Pending</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#0F172A] mb-1">Assign to Ustadh</label>
                  <select
                    value={followUpForm.assignedToUstadhId}
                    onChange={(e) => setFollowUpForm({ ...followUpForm, assignedToUstadhId: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F8F9FA] border border-[#E7E9EE] rounded-xl"
                  >
                    <option value="">— Madrasa Admin —</option>
                    {ustadhs.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-semibold text-[#0F172A] mb-1">Action Notes</label>
                <textarea
                  rows={2}
                  value={followUpForm.notes}
                  onChange={(e) => setFollowUpForm({ ...followUpForm, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F8F9FA] border border-[#E7E9EE] rounded-xl"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#0F172A] mb-1">Outcome / Completion Notes</label>
                <textarea
                  rows={2}
                  value={followUpForm.outcomeNotes}
                  onChange={(e) => setFollowUpForm({ ...followUpForm, outcomeNotes: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F8F9FA] border border-[#E7E9EE] rounded-xl"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[#E7E9EE]">
                <button
                  type="button"
                  onClick={() => setIsFollowUpModalOpen(false)}
                  className="px-4 py-2 font-semibold text-[#5B6B7F]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={followUpSubmitting}
                  className="px-4 py-2 bg-[#08483A] text-white font-bold rounded-xl"
                >
                  {followUpSubmitting ? 'Saving...' : 'Save Follow-Up'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
