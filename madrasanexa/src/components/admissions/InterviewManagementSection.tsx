import React, { useEffect, useState, useMemo } from 'react';
import {
  apiListInterviewAppointments,
  apiGetInterviewDashboardStats,
  apiGetEligibleInterviewApplicants,
  apiCreateBulkInterviewSchedule,
  apiRescheduleInterviewAppointment,
  apiCancelInterviewAppointment,
  apiEvaluateInterviewAppointment,
  apiSendInterviewEmailNotification,
  apiMarkUncertainNotificationDelivered,
  apiConfirmUncertainNotificationFailed,
  apiDownloadInterviewInvitationPdf,
} from '../../services/api';
import type {
  InterviewAppointmentItem,
  InterviewDashboardStats,
  EligibleApplicantItem,
  AdmissionPeriodData,
  InterviewRound,
  InterviewSchedulingMethod,
  InterviewAppointmentStatus,
  InterviewAttendance,
  InterviewResult,
} from '../../services/api';
import {
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  AlertTriangle,
  Search,
  Plus,
  RefreshCw,
  Mail,
  FileDown,
  RotateCcw,
  UserCheck,
  Check,
  X,
  Loader2,
  CalendarClock,
  Sparkles,
  Award,
} from 'lucide-react';

interface InterviewManagementSectionProps {
  periods: AdmissionPeriodData[];
  onScheduleSuccess?: () => void;
  preSelectedAppId?: string | null;
}

export const InterviewManagementSection: React.FC<InterviewManagementSectionProps> = ({
  periods,
  onScheduleSuccess,
  preSelectedAppId,
}) => {
  // Appointments Table State
  const [appointments, setAppointments] = useState<InterviewAppointmentItem[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(true);
  const [totalAppointments, setTotalAppointments] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [periodFilter, setPeriodFilter] = useState<string>('ALL');
  const [roundFilter, setRoundFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [resultFilter, setResultFilter] = useState<string>('ALL');
  const [attendanceFilter, setAttendanceFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Dashboard KPI Stats State
  const [stats, setStats] = useState<InterviewDashboardStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Toast Feedback State
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);

  // Modals State
  const [showWizardModal, setShowWizardModal] = useState(false);
  const [showEvaluateModal, setShowEvaluateModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Active Selected Appointment for Modals
  const [selectedAppointment, setSelectedAppointment] = useState<InterviewAppointmentItem | null>(null);

  // -------------------------------------------------------------
  // Bulk Scheduling Wizard State
  // -------------------------------------------------------------
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [wizardPeriodId, setWizardPeriodId] = useState<string>('');
  const [wizardRound, setWizardRound] = useState<InterviewRound>('FIRST');
  const [eligibleApplicants, setEligibleApplicants] = useState<EligibleApplicantItem[]>([]);
  const [loadingEligible, setLoadingEligible] = useState(false);
  const [selectedAppIds, setSelectedAppIds] = useState<string[]>([]);
  const [applicantSearch, setApplicantSearch] = useState('');

  // Wizard Step 2 Configuration
  const [scheduleMethod, setScheduleMethod] = useState<InterviewSchedulingMethod>('SAME_TIME');
  const [sessionTitle, setSessionTitle] = useState('');
  const [interviewDate, setInterviewDate] = useState('');
  const [venue, setVenue] = useState('Main Administrative Office - Interview Hall A');
  const [defaultStartTime, setDefaultStartTime] = useState('09:00');
  const [defaultEndTime, setDefaultEndTime] = useState('12:00');
  const [slotDurationMinutes, setSlotDurationMinutes] = useState(15);
  const [sessionInstructions, setSessionInstructions] = useState('');
  const [requiredDocs, setRequiredDocs] = useState<string[]>([
    'Original Birth Certificate of Applicant',
    'Previous School Leaving Certificate / Reports',
    'Parent / Guardian National ID (NIC) Copy',
    'Two (2) recent passport-sized color photographs',
  ]);
  const [newDocItem, setNewDocItem] = useState('');

  // Wizard Step 3 Slot Customization
  const [customSlots, setCustomSlots] = useState<{ applicationId: string; startTime: string; endTime: string }[]>([]);
  const [submittingSchedule, setSubmittingSchedule] = useState(false);

  // -------------------------------------------------------------
  // Evaluation Modal State
  // -------------------------------------------------------------
  const [evalAttendance, setEvalAttendance] = useState<InterviewAttendance | 'UNRECORDED'>('PRESENT');
  const [evalQuranScore, setEvalQuranScore] = useState<string>('80');
  const [evalIslamicScore, setEvalIslamicScore] = useState<string>('80');
  const [evalAcademicScore, setEvalAcademicScore] = useState<string>('80');
  const [evalConductScore, setEvalConductScore] = useState<string>('90');
  const [evalInterviewerNotes, setEvalInterviewerNotes] = useState('');
  const [evalRecommendationNotes, setEvalRecommendationNotes] = useState('');
  const [evalResult, setEvalResult] = useState<InterviewResult>('PASSED');
  const [submittingEvaluation, setSubmittingEvaluation] = useState(false);

  // -------------------------------------------------------------
  // Reschedule & Cancel Modal State
  // -------------------------------------------------------------
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleStart, setRescheduleStart] = useState('');
  const [rescheduleEnd, setRescheduleEnd] = useState('');
  const [rescheduleVenue, setRescheduleVenue] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [submittingReschedule, setSubmittingReschedule] = useState(false);

  const [cancelReason, setCancelReason] = useState('');
  const [submittingCancel, setSubmittingCancel] = useState(false);

  // Email Action State
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);

  // -------------------------------------------------------------
  // Data Fetching
  // -------------------------------------------------------------
  const fetchDashboardStats = async () => {
    setLoadingStats(true);
    try {
      const data = await apiGetInterviewDashboardStats({
        admissionPeriodId: periodFilter !== 'ALL' ? periodFilter : undefined,
      });
      setStats(data);
    } catch (err: any) {
      console.warn('Failed to load dashboard stats:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchAppointments = async () => {
    setLoadingAppointments(true);
    try {
      const res = await apiListInterviewAppointments({
        page,
        limit: 15,
        admissionPeriodId: periodFilter !== 'ALL' ? periodFilter : undefined,
        interviewRound: roundFilter !== 'ALL' ? (roundFilter as InterviewRound) : undefined,
        status: statusFilter !== 'ALL' ? (statusFilter as InterviewAppointmentStatus) : undefined,
        result: resultFilter !== 'ALL' ? (resultFilter as InterviewResult) : undefined,
        attendance: attendanceFilter !== 'ALL' ? attendanceFilter : undefined,
        search: searchQuery.trim() || undefined,
      });
      const apts = Array.isArray(res) ? res : (res?.appointments || (res as any)?.data || []);
      const total = res?.pagination?.total ?? apts.length;
      const pages = res?.pagination?.totalPages ?? Math.max(1, Math.ceil(total / 15));
      setAppointments(apts);
      setTotalAppointments(total);
      setTotalPages(pages);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to load interview appointments.',
      });
    } finally {
      setLoadingAppointments(false);
    }
  };

  const hasActiveFilters =
    periodFilter !== 'ALL' ||
    roundFilter !== 'ALL' ||
    statusFilter !== 'ALL' ||
    resultFilter !== 'ALL' ||
    attendanceFilter !== 'ALL' ||
    Boolean(searchQuery.trim());

  const handleResetFilters = () => {
    setPeriodFilter('ALL');
    setRoundFilter('ALL');
    setStatusFilter('ALL');
    setResultFilter('ALL');
    setAttendanceFilter('ALL');
    setSearchQuery('');
    setPage(1);
  };

  useEffect(() => {
    fetchAppointments();
  }, [page, periodFilter, roundFilter, statusFilter, resultFilter, attendanceFilter, searchQuery]);

  useEffect(() => {
    fetchDashboardStats();
  }, [periodFilter]);

  // Handle pre-selection from external tab (e.g. applications list)
  useEffect(() => {
    if (preSelectedAppId) {
      setWizardPeriodId(periods[0]?.id || '');
      setSelectedAppIds([preSelectedAppId]);
      setShowWizardModal(true);
    }
  }, [preSelectedAppId, periods]);

  // -------------------------------------------------------------
  // Eligible Applicants Fetcher for Wizard
  // -------------------------------------------------------------
  const fetchEligible = async (periodId: string, round: InterviewRound) => {
    if (!periodId) return;
    setLoadingEligible(true);
    try {
      const data = await apiGetEligibleInterviewApplicants({
        admissionPeriodId: periodId,
        interviewRound: round,
        search: applicantSearch.trim() || undefined,
      });
      setEligibleApplicants(data);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to load eligible applicants.',
      });
    } finally {
      setLoadingEligible(false);
    }
  };

  useEffect(() => {
    if (showWizardModal && wizardPeriodId) {
      fetchEligible(wizardPeriodId, wizardRound);
    }
  }, [showWizardModal, wizardPeriodId, wizardRound, applicantSearch]);

  // Set default period when wizard opens
  useEffect(() => {
    if (showWizardModal && !wizardPeriodId && periods.length > 0) {
      setWizardPeriodId(periods[0].id);
    }
  }, [showWizardModal, periods, wizardPeriodId]);

  // -------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------
  const timeToMinutes = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  };

  const minutesToTime = (mins: number) => {
    const h = Math.floor(mins / 60) % 24;
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const formatTime12h = (timeStr: string) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return timeStr;
    const period = hours >= 12 ? 'PM' : 'AM';
    const h12 = hours % 12 || 12;
    return `${String(h12).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${period}`;
  };

  const formatDateColombo = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        timeZone: 'Asia/Colombo',
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  // Re-compute custom slots when transitioning to step 3 in individual slot mode
  const handleProceedToStep3 = () => {
    if (scheduleMethod === 'INDIVIDUAL_SLOTS') {
      let currentMin = timeToMinutes(defaultStartTime);
      const slots = selectedAppIds.map((appId) => {
        const start = minutesToTime(currentMin);
        const end = minutesToTime(currentMin + slotDurationMinutes);
        currentMin += slotDurationMinutes;
        return { applicationId: appId, startTime: start, endTime: end };
      });
      setCustomSlots(slots);
    }
    setWizardStep(3);
  };

  // -------------------------------------------------------------
  // Wizard Submit
  // -------------------------------------------------------------
  const handleScheduleSubmit = async () => {
    if (!wizardPeriodId || selectedAppIds.length === 0 || !interviewDate || !venue) {
      setFeedback({ type: 'warning', message: 'Please complete all required schedule fields.' });
      return;
    }

    setSubmittingSchedule(true);
    try {
      const payload: any = {
        admissionPeriodId: wizardPeriodId,
        interviewRound: wizardRound,
        schedulingMethod: scheduleMethod,
        title: sessionTitle.trim() || `${wizardRound === 'SECOND' ? 'Second' : 'First'} Round Admissions Interviews`,
        interviewDate,
        venue: venue.trim(),
        instructions: sessionInstructions.trim() || null,
        requiredDocuments: requiredDocs,
        applicationIds: selectedAppIds,
      };

      if (scheduleMethod === 'SAME_TIME') {
        payload.defaultStartTime = defaultStartTime;
        payload.defaultEndTime = defaultEndTime;
      } else {
        payload.defaultStartTime = defaultStartTime;
        payload.slotDurationMinutes = Number(slotDurationMinutes);
        payload.slotAllocations = customSlots;
      }

      const res = await apiCreateBulkInterviewSchedule(payload);
      setFeedback({
        type: 'success',
        message: `Successfully scheduled interviews for ${res.appointmentsCount} applicant(s). PDF letters and emails are being processed.`,
      });
      setShowWizardModal(false);
      setWizardStep(1);
      setSelectedAppIds([]);
      fetchAppointments();
      fetchDashboardStats();
      if (onScheduleSuccess) onScheduleSuccess();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to schedule interviews.',
      });
    } finally {
      setSubmittingSchedule(false);
    }
  };

  // -------------------------------------------------------------
  // Evaluation Submit
  // -------------------------------------------------------------
  const handleOpenEvaluate = (appointment: InterviewAppointmentItem) => {
    setSelectedAppointment(appointment);
    const existing = appointment.evaluation;
    setEvalAttendance(existing?.attendance || 'PRESENT');
    setEvalQuranScore(existing?.quranRecitationScore != null ? String(existing.quranRecitationScore) : '80');
    setEvalIslamicScore(existing?.islamicKnowledgeScore != null ? String(existing.islamicKnowledgeScore) : '80');
    setEvalAcademicScore(existing?.academicScore != null ? String(existing.academicScore) : '80');
    setEvalConductScore(existing?.conductScore != null ? String(existing.conductScore) : '90');
    setEvalInterviewerNotes(existing?.interviewerNotes || '');
    setEvalRecommendationNotes(existing?.recommendationNotes || '');
    setEvalResult(existing?.result || 'PASSED');
    setShowEvaluateModal(true);
  };

  const calculatedTotalScore = useMemo(() => {
    const q = parseFloat(evalQuranScore) || 0;
    const i = parseFloat(evalIslamicScore) || 0;
    const a = parseFloat(evalAcademicScore) || 0;
    const c = parseFloat(evalConductScore) || 0;
    return ((q + i + a + c) / 4).toFixed(1);
  }, [evalQuranScore, evalIslamicScore, evalAcademicScore, evalConductScore]);

  const handleSubmitEvaluation = async () => {
    if (!selectedAppointment) return;
    setSubmittingEvaluation(true);
    try {
      await apiEvaluateInterviewAppointment(selectedAppointment.id, {
        attendance: evalAttendance === 'UNRECORDED' ? null : evalAttendance,
        quranRecitationScore: parseFloat(evalQuranScore) || null,
        islamicKnowledgeScore: parseFloat(evalIslamicScore) || null,
        academicScore: parseFloat(evalAcademicScore) || null,
        conductScore: parseFloat(evalConductScore) || null,
        totalScore: parseFloat(calculatedTotalScore) || null,
        interviewerNotes: evalInterviewerNotes.trim() || null,
        recommendationNotes: evalRecommendationNotes.trim() || null,
        result: evalResult,
      });

      setFeedback({
        type: 'success',
        message: `Evaluation saved successfully for ${selectedAppointment.application.applicantName}.`,
      });
      setShowEvaluateModal(false);
      fetchAppointments();
      fetchDashboardStats();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to record interview evaluation.',
      });
    } finally {
      setSubmittingEvaluation(false);
    }
  };

  // -------------------------------------------------------------
  // Reschedule Submit
  // -------------------------------------------------------------
  const handleOpenReschedule = (appointment: InterviewAppointmentItem) => {
    setSelectedAppointment(appointment);
    setRescheduleDate(appointment.interviewDate ? appointment.interviewDate.slice(0, 10) : '');
    setRescheduleStart(appointment.startTime);
    setRescheduleEnd(appointment.endTime);
    setRescheduleVenue(appointment.venue);
    setRescheduleReason('');
    setShowRescheduleModal(true);
  };

  const handleSubmitReschedule = async () => {
    if (!selectedAppointment || !rescheduleDate || !rescheduleStart || !rescheduleEnd) {
      setFeedback({ type: 'warning', message: 'Please provide date, start time, and end time.' });
      return;
    }

    setSubmittingReschedule(true);
    try {
      await apiRescheduleInterviewAppointment(selectedAppointment.id, {
        interviewDate: rescheduleDate,
        startTime: rescheduleStart,
        endTime: rescheduleEnd,
        venue: rescheduleVenue.trim() || undefined,
        rescheduleReason: rescheduleReason.trim() || undefined,
      });

      setFeedback({
        type: 'success',
        message: `Appointment rescheduled. A new invitation letter is being generated and emailed.`,
      });
      setShowRescheduleModal(false);
      fetchAppointments();
      fetchDashboardStats();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to reschedule appointment.',
      });
    } finally {
      setSubmittingReschedule(false);
    }
  };

  // -------------------------------------------------------------
  // Cancel Submit
  // -------------------------------------------------------------
  const handleOpenCancel = (appointment: InterviewAppointmentItem) => {
    setSelectedAppointment(appointment);
    setCancelReason('');
    setShowCancelModal(true);
  };

  const handleSubmitCancel = async () => {
    if (!selectedAppointment || !cancelReason.trim()) {
      setFeedback({ type: 'warning', message: 'A cancellation reason is required.' });
      return;
    }

    setSubmittingCancel(true);
    try {
      await apiCancelInterviewAppointment(selectedAppointment.id, {
        cancellationReason: cancelReason.trim(),
      });

      setFeedback({
        type: 'success',
        message: 'Interview appointment cancelled successfully.',
      });
      setShowCancelModal(false);
      fetchAppointments();
      fetchDashboardStats();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to cancel appointment.',
      });
    } finally {
      setSubmittingCancel(false);
    }
  };

  // -------------------------------------------------------------
  // Email Dispatch & Retry Handlers
  // -------------------------------------------------------------
  const handleSendEmail = async (appointmentId: string, forceRetry = false) => {
    setSendingEmailId(appointmentId);
    try {
      const res = await apiSendInterviewEmailNotification(appointmentId, forceRetry);
      if (res.success) {
        setFeedback({ type: 'success', message: 'Invitation email dispatched successfully.' });
      } else {
        setFeedback({ type: 'warning', message: res.message || 'Email delivery status pending.' });
      }
      fetchAppointments();
      fetchDashboardStats();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to dispatch email.',
      });
    } finally {
      setSendingEmailId(null);
    }
  };

  const handleMarkDelivered = async (notificationId: string) => {
    try {
      await apiMarkUncertainNotificationDelivered(notificationId);
      setFeedback({ type: 'success', message: 'Notification verified and marked as delivered.' });
      fetchAppointments();
      fetchDashboardStats();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Action failed.' });
    }
  };

  const handleConfirmFailed = async (notificationId: string) => {
    try {
      await apiConfirmUncertainNotificationFailed(notificationId);
      setFeedback({ type: 'success', message: 'Notification reset to failed for retry.' });
      fetchAppointments();
      fetchDashboardStats();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Action failed.' });
    }
  };

  // -------------------------------------------------------------
  // PDF Download Helper
  // -------------------------------------------------------------
  const handleDownloadPdf = async (appointment: InterviewAppointmentItem) => {
    try {
      setFeedback({ type: 'success', message: 'Downloading invitation letter...' });
      await apiDownloadInterviewInvitationPdf(
        appointment.id,
        `Interview_Invitation_${appointment.invitationReference}.pdf`
      );
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to download invitation PDF.',
      });
    }
  };

  // -------------------------------------------------------------
  // Badges
  // -------------------------------------------------------------
  const getAppointmentStatusBadge = (status: InterviewAppointmentStatus) => {
    switch (status) {
      case 'SCHEDULED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Clock className="w-3 h-3 mr-1" /> Scheduled
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 mr-1" /> Completed
          </span>
        );
      case 'RESCHEDULED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            <RotateCcw className="w-3 h-3 mr-1" /> Rescheduled
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3 mr-1" /> Cancelled
          </span>
        );
      case 'NO_SHOW':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            <AlertTriangle className="w-3 h-3 mr-1" /> No-Show
          </span>
        );
    }
  };

  const getAttendanceBadge = (attendance?: InterviewAttendance | null) => {
    if (attendance === 'PRESENT') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-100 text-emerald-800">
          Present
        </span>
      );
    }
    if (attendance === 'ABSENT') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-rose-100 text-rose-800">
          Absent
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-600">
        Unrecorded
      </span>
    );
  };

  const getResultBadge = (result?: InterviewResult) => {
    switch (result) {
      case 'PASSED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-300">
            PASSED
          </span>
        );
      case 'NEEDS_SECOND_INTERVIEW':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-purple-50 text-purple-700 border border-purple-300">
            NEEDS 2ND ROUND
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-rose-50 text-rose-700 border border-rose-300">
            NOT RECOMMENDED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-500">
            Pending
          </span>
        );
    }
  };

  const getEmailStatusBadge = (note?: any) => {
    if (!note) {
      return <span className="text-xs text-slate-400">Not queued</span>;
    }
    switch (note.status) {
      case 'SENT':
        return (
          <span className="inline-flex items-center text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
            <Check className="w-3 h-3 mr-1" /> Sent
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center text-xs font-medium text-rose-700 bg-rose-50 px-2 py-0.5 rounded" title={note.errorDetails}>
            <X className="w-3 h-3 mr-1" /> Failed
          </span>
        );
      case 'UNCERTAIN':
        return (
          <span className="inline-flex items-center text-xs font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded" title="Delivery outcome uncertain">
            <AlertTriangle className="w-3 h-3 mr-1" /> Uncertain
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
            <Clock className="w-3 h-3 mr-1" /> {note.status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`p-4 rounded-xl text-sm flex items-center justify-between shadow-xs ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : feedback.type === 'warning'
              ? 'bg-amber-50 text-amber-800 border border-amber-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <div className="flex items-center space-x-2">
            {feedback.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
            {feedback.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />}
            {feedback.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
            <span className="font-medium">{feedback.message}</span>
          </div>
          <button type="button" onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Scheduled</div>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {loadingStats ? <Loader2 className="w-5 h-5 animate-spin text-slate-400" /> : stats?.statuses.scheduled ?? 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Total: {stats?.totalAppointments ?? 0} &bull; First: {stats?.rounds.first ?? 0}</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Completed</div>
          <div className="text-2xl font-black text-emerald-700 mt-1">
            {loadingStats ? <Loader2 className="w-5 h-5 animate-spin text-slate-400" /> : stats?.statuses.completed ?? 0}
          </div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1">
            {stats && stats.totalAppointments > 0
              ? `${Math.round(((stats.statuses.completed || 0) / stats.totalAppointments) * 100)}% conducted`
              : '0%'}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Passed</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">
            {loadingStats ? <Loader2 className="w-5 h-5 animate-spin text-slate-400" /> : stats?.results.passed ?? 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Passed interview round</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Needs 2nd Round</div>
          <div className="text-2xl font-black text-purple-700 mt-1">
            {loadingStats ? <Loader2 className="w-5 h-5 animate-spin text-slate-400" /> : stats?.results.needsSecondRound ?? 0}
          </div>
          <div className="text-[11px] text-purple-600 mt-1">Eligible for Round 2</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Attendance</div>
          <div className="text-2xl font-black text-slate-800 mt-1">
            {loadingStats ? (
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            ) : (
              `${stats?.attendance.present ?? 0}`
            )}
          </div>
          <div className="text-[11px] text-rose-500 mt-1">{stats?.attendance.absent ?? 0} Absent / No-Show</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email Delivery</div>
          <div className="text-2xl font-black text-blue-700 mt-1">
            {loadingStats ? <Loader2 className="w-5 h-5 animate-spin text-slate-400" /> : stats?.emails.sent ?? 0}
          </div>
          <div className="text-[11px] mt-1 flex items-center space-x-1">
            {(stats?.emails.failed ?? 0) > 0 ? (
              <span className="text-rose-600 font-bold">{stats?.emails.failed} failed</span>
            ) : (stats?.emails.uncertain ?? 0) > 0 ? (
              <span className="text-amber-600 font-bold">{stats?.emails.uncertain} uncertain</span>
            ) : (
              <span className="text-slate-400">All dispatched</span>
            )}
          </div>
        </div>
      </div>

      {/* Action Toolbar & Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setWizardStep(1);
                setSelectedAppIds([]);
                setShowWizardModal(true);
              }}
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Bulk Schedule Interviews</span>
            </button>

            <button
              type="button"
              onClick={() => {
                fetchAppointments();
                fetchDashboardStats();
              }}
              className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors cursor-pointer"
                title="Reset all search and filter options"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search candidate, ref, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setPage(1);
                  fetchAppointments();
                }
              }}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Filter Dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Intake Cycle</label>
            <select
              value={periodFilter}
              onChange={(e) => {
                setPeriodFilter(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs py-1.5 px-2.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="ALL">All Intake Cycles</option>
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.academicYear})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Round</label>
            <select
              value={roundFilter}
              onChange={(e) => {
                setRoundFilter(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs py-1.5 px-2.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="ALL">All Rounds</option>
              <option value="FIRST">First Round</option>
              <option value="SECOND">Second Round</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs py-1.5 px-2.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="COMPLETED">Completed</option>
              <option value="RESCHEDULED">Rescheduled</option>
              <option value="NO_SHOW">No-Show</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Result</label>
            <select
              value={resultFilter}
              onChange={(e) => {
                setResultFilter(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs py-1.5 px-2.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="ALL">All Results</option>
              <option value="PASSED">Passed</option>
              <option value="NEEDS_SECOND_INTERVIEW">Needs 2nd Round</option>
              <option value="REJECTED">Not Recommended</option>
              <option value="PENDING">Pending Evaluation</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Attendance</label>
            <select
              value={attendanceFilter}
              onChange={(e) => {
                setAttendanceFilter(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs py-1.5 px-2.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="ALL">All Attendance</option>
              <option value="PRESENT">Present</option>
              <option value="ABSENT">Absent</option>
              <option value="UNRECORDED">Unrecorded</option>
            </select>
          </div>
        </div>
      </div>

      {/* Appointments List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loadingAppointments ? (
          <div className="py-20 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-700 mb-2" />
            <p className="text-xs text-slate-500">Loading interview appointments...</p>
          </div>
        ) : appointments.length === 0 ? (
          <div className="py-16 text-center">
            <CalendarClock className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <h3 className="text-sm font-bold text-slate-800">
              {hasActiveFilters ? 'No Matching Interview Appointments' : 'No Interview Appointments Found'}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              {hasActiveFilters
                ? 'No scheduled appointments match the active filters. Try clearing your filters to view all scheduled interviews.'
                : 'Select eligible applicants and use the Bulk Scheduling wizard to create interview sessions.'}
            </p>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={handleResetFilters}
                className="mt-4 inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 text-white hover:bg-slate-900 shadow-sm cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reset Filters</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setWizardStep(1);
                  setShowWizardModal(true);
                }}
                className="mt-4 inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-700 text-white hover:bg-emerald-800 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Schedule First Interview Session</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Date & Time Slot</th>
                  <th className="py-3 px-4">Applicant & Reference</th>
                  <th className="py-3 px-4">Guardian Contact</th>
                  <th className="py-3 px-4">Round & Venue</th>
                  <th className="py-3 px-4">Status & Attendance</th>
                  <th className="py-3 px-4">Evaluation Result</th>
                  <th className="py-3 px-4">Invitation Email</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {appointments.map((apt) => {
                  const latestNotification = apt.notifications && apt.notifications[0];
                  return (
                    <tr key={apt.id} className="hover:bg-slate-50/75 transition-colors">
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-bold text-slate-900">{formatDateColombo(apt.interviewDate)}</div>
                        <div className="text-[11px] text-emerald-700 font-semibold mt-0.5">
                          {formatTime12h(apt.startTime)} – {formatTime12h(apt.endTime)}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{apt.invitationReference}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{apt.application.applicantName}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{apt.application.applicationNo}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {apt.application.appliedClass?.name || 'Standard Intake'} &bull; {apt.application.gender}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">{apt.application.guardianName}</div>
                        <div className="text-[11px] text-slate-500">{apt.application.guardianPhone}</div>
                        {apt.application.guardianEmail && (
                          <div className="text-[11px] text-slate-400 truncate max-w-[140px]" title={apt.application.guardianEmail}>
                            {apt.application.guardianEmail}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div>
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${
                              apt.interviewRound === 'SECOND'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {apt.interviewRound === 'SECOND' ? 'ROUND 2' : 'ROUND 1'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600 mt-1 line-clamp-1" title={apt.venue}>
                          {apt.venue}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 space-y-1">
                        <div>{getAppointmentStatusBadge(apt.status)}</div>
                        <div>{getAttendanceBadge(apt.evaluation?.attendance)}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div>{getResultBadge(apt.evaluation?.result)}</div>
                        {apt.evaluation?.totalScore != null && (
                          <div className="text-[11px] text-slate-500 font-semibold mt-1">
                            Score: <span className="text-slate-900 font-bold">{apt.evaluation.totalScore}%</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div>{getEmailStatusBadge(latestNotification)}</div>
                        {latestNotification?.status === 'UNCERTAIN' && (
                          <div className="mt-1 flex items-center space-x-1">
                            <button
                              type="button"
                              onClick={() => handleMarkDelivered(latestNotification.id)}
                              className="px-1.5 py-0.5 rounded bg-emerald-50 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100"
                              title="Verify delivered in external SMTP logs"
                            >
                              Confirm Sent
                            </button>
                            <button
                              type="button"
                              onClick={() => handleConfirmFailed(latestNotification.id)}
                              className="px-1.5 py-0.5 rounded bg-rose-50 text-[10px] font-bold text-rose-700 hover:bg-rose-100"
                              title="Mark failed and retry"
                            >
                              Reset
                            </button>
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center space-x-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEvaluate(apt)}
                            className="p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-50 font-bold transition-colors"
                            title="Record Attendance & Evaluation"
                          >
                            <UserCheck className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDownloadPdf(apt)}
                            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
                            title="Download PDF Invitation Letter"
                          >
                            <FileDown className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSendEmail(apt.id, true)}
                            disabled={sendingEmailId === apt.id}
                            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50"
                            title="Dispatch / Re-send Invitation Email"
                          >
                            {sendingEmailId === apt.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Mail className="w-4 h-4" />
                            )}
                          </button>

                          {apt.status === 'SCHEDULED' && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenReschedule(apt)}
                                className="p-1.5 rounded-lg text-purple-600 hover:bg-purple-50 transition-colors"
                                title="Reschedule Appointment"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenCancel(apt)}
                                className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors"
                                title="Cancel Appointment"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
            <div>
              Showing page <strong>{page}</strong> of <strong>{totalPages}</strong> ({totalAppointments} total)
            </div>
            <div className="flex items-center space-x-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================= */}
      {/* MODAL 1: Bulk Scheduling Wizard                              */}
      {/* ============================================================= */}
      {showWizardModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
                  <CalendarClock className="w-5 h-5 text-emerald-700" />
                  <span>Admissions Interview Scheduling Wizard</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Step {wizardStep} of 3: {wizardStep === 1 ? 'Select Eligible Candidates' : wizardStep === 2 ? 'Session & Timing Details' : 'Time Slot Verification'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowWizardModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Stepper Progress */}
            <div className="px-6 py-2 bg-slate-100 flex items-center space-x-4 text-xs font-semibold overflow-x-auto whitespace-nowrap shrink-0">
              <div className={`flex items-center space-x-1.5 ${wizardStep >= 1 ? 'text-emerald-700' : 'text-slate-400'}`}>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${wizardStep >= 1 ? 'bg-emerald-700 text-white' : 'bg-slate-300'}`}>1</span>
                <span>Candidates</span>
              </div>
              <span className="text-slate-300">&bull;&bull;&bull;</span>
              <div className={`flex items-center space-x-1.5 ${wizardStep >= 2 ? 'text-emerald-700' : 'text-slate-400'}`}>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${wizardStep >= 2 ? 'bg-emerald-700 text-white' : 'bg-slate-300'}`}>2</span>
                <span>Session Setup</span>
              </div>
              <span className="text-slate-300">&bull;&bull;&bull;</span>
              <div className={`flex items-center space-x-1.5 ${wizardStep >= 3 ? 'text-emerald-700' : 'text-slate-400'}`}>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${wizardStep >= 3 ? 'bg-emerald-700 text-white' : 'bg-slate-300'}`}>3</span>
                <span>Review & Schedule</span>
              </div>
            </div>

            {/* Step Body */}
            <div className="p-6 overflow-y-auto flex-1">
              {/* STEP 1: Select Candidates */}
              {wizardStep === 1 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Intake Cycle</label>
                      <select
                        value={wizardPeriodId}
                        onChange={(e) => setWizardPeriodId(e.target.value)}
                        className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        {periods.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.academicYear})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Interview Round</label>
                      <select
                        value={wizardRound}
                        onChange={(e) => {
                          setWizardRound(e.target.value as InterviewRound);
                          setSelectedAppIds([]);
                        }}
                        className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                      >
                        <option value="FIRST">First Round (New Applicants)</option>
                        <option value="SECOND">Second Round (Needs 2nd Interview)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Search Candidate</label>
                      <input
                        type="text"
                        placeholder="Search name or app #..."
                        value={applicantSearch}
                        onChange={(e) => setApplicantSearch(e.target.value)}
                        className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  {wizardRound === 'SECOND' && (
                    <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-900 flex items-start space-x-2">
                      <Sparkles className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
                      <div>
                        <strong>Second Round Mode Active:</strong> Only applicants whose first-round evaluation was marked as <em>"Needs Second Interview"</em> are shown and eligible for scheduling.
                      </div>
                    </div>
                  )}

                  {/* Eligible Candidates Table */}
                  <div className="border border-slate-200 rounded-2xl overflow-hidden mt-4">
                    <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between text-xs">
                      <label className="flex items-center space-x-2 font-bold text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={eligibleApplicants.length > 0 && selectedAppIds.length === eligibleApplicants.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedAppIds(eligibleApplicants.map((a) => a.id));
                            } else {
                              setSelectedAppIds([]);
                            }
                          }}
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>Select All ({eligibleApplicants.length} Eligible)</span>
                      </label>
                      <span className="font-bold text-emerald-700">{selectedAppIds.length} candidate(s) selected</span>
                    </div>

                    {loadingEligible ? (
                      <div className="py-12 text-center text-xs text-slate-500">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-600 mb-2" />
                        Fetching eligible applicants...
                      </div>
                    ) : eligibleApplicants.length === 0 ? (
                      <div className="py-10 text-center text-xs text-slate-400">
                        No eligible candidates found for this round and intake cycle.
                      </div>
                    ) : (
                      <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                        {eligibleApplicants.map((app) => {
                          const isSelected = selectedAppIds.includes(app.id);
                          return (
                            <div
                              key={app.id}
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedAppIds(selectedAppIds.filter((id) => id !== app.id));
                                } else {
                                  setSelectedAppIds([...selectedAppIds, app.id]);
                                }
                              }}
                              className={`p-3 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors ${
                                isSelected ? 'bg-emerald-50/60' : ''
                              }`}
                            >
                              <div className="flex items-center space-x-3">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {}} // handled by row click
                                  className="rounded text-emerald-600 focus:ring-emerald-500"
                                />
                                <div>
                                  <div className="font-bold text-slate-900 text-xs">{app.applicantName}</div>
                                  <div className="text-[11px] text-slate-500">
                                    App No: <span className="font-mono">{app.applicationNo}</span> &bull; Guardian: {app.guardianName} ({app.guardianPhone})
                                  </div>
                                </div>
                              </div>
                              <div className="text-right text-[11px] text-slate-400">
                                {app.appliedClass?.name || 'Standard'} &bull; {app.gender}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 2: Session Setup */}
              {wizardStep === 2 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Session Title (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. 2026 Academic Admissions - First Round Interviews"
                      value={sessionTitle}
                      onChange={(e) => setSessionTitle(e.target.value)}
                      className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Interview Date <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={interviewDate}
                        onChange={(e) => setInterviewDate(e.target.value)}
                        className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Venue / Room <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={venue}
                        onChange={(e) => setVenue(e.target.value)}
                        placeholder="e.g. Administrative Building - Room 102"
                        className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Scheduling Method Card Selector */}
                  <div className="mt-2">
                    <label className="block text-xs font-bold text-slate-700 mb-2">Scheduling Method</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div
                        onClick={() => setScheduleMethod('SAME_TIME')}
                        className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                          scheduleMethod === 'SAME_TIME'
                            ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-600/20'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center space-x-2 font-bold text-xs text-slate-900">
                          <Clock className="w-4 h-4 text-emerald-700" />
                          <span>Method A: Same Date & Time</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">
                          All {selectedAppIds.length} candidate(s) report at the exact same start and end time window.
                        </p>
                      </div>

                      <div
                        onClick={() => setScheduleMethod('INDIVIDUAL_SLOTS')}
                        className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                          scheduleMethod === 'INDIVIDUAL_SLOTS'
                            ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-600/20'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center space-x-2 font-bold text-xs text-slate-900">
                          <Calendar className="w-4 h-4 text-emerald-700" />
                          <span>Method B: Individual Time Slots</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Consecutive non-overlapping time slots allocated automatically or individually per candidate.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Method-Specific Inputs */}
                  {scheduleMethod === 'SAME_TIME' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Start Time (24h)</label>
                        <input
                          type="time"
                          value={defaultStartTime}
                          onChange={(e) => setDefaultStartTime(e.target.value)}
                          className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">End Time (24h)</label>
                        <input
                          type="time"
                          value={defaultEndTime}
                          onChange={(e) => setDefaultEndTime(e.target.value)}
                          className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 bg-white"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">First Candidate Start Time</label>
                        <input
                          type="time"
                          value={defaultStartTime}
                          onChange={(e) => setDefaultStartTime(e.target.value)}
                          className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Slot Duration (Minutes)</label>
                        <select
                          value={slotDurationMinutes}
                          onChange={(e) => setSlotDurationMinutes(Number(e.target.value))}
                          className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 bg-white"
                        >
                          <option value={10}>10 Minutes per candidate</option>
                          <option value={15}>15 Minutes per candidate</option>
                          <option value={20}>20 Minutes per candidate</option>
                          <option value={30}>30 Minutes per candidate</option>
                          <option value={45}>45 Minutes per candidate</option>
                          <option value={60}>60 Minutes per candidate</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Required Documents Checklist Builder */}
                  <div className="pt-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Required Documents Checklist (Printed on Official PDF Invitation)
                    </label>
                    <div className="space-y-1.5 mb-2">
                      {requiredDocs.map((doc, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 text-xs text-slate-800 border border-slate-200">
                          <span className="flex items-center space-x-2">
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{doc}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setRequiredDocs(requiredDocs.filter((_, i) => i !== idx))}
                            className="text-slate-400 hover:text-rose-600"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        placeholder="Add required document..."
                        value={newDocItem}
                        onChange={(e) => setNewDocItem(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newDocItem.trim()) {
                            e.preventDefault();
                            setRequiredDocs([...requiredDocs, newDocItem.trim()]);
                            setNewDocItem('');
                          }
                        }}
                        className="flex-1 text-xs py-1.5 px-3 rounded-xl border border-slate-200"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (newDocItem.trim()) {
                            setRequiredDocs([...requiredDocs, newDocItem.trim()]);
                            setNewDocItem('');
                          }
                        }}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Candidate Instructions / Remarks</label>
                    <textarea
                      rows={2}
                      value={sessionInstructions}
                      onChange={(e) => setSessionInstructions(e.target.value)}
                      placeholder="Special instructions for the candidates and parents..."
                      className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              )}

              {/* STEP 3: Review & Custom Slot Allocation */}
              {wizardStep === 3 && (
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-2xl text-xs text-emerald-900 space-y-1">
                    <div className="font-bold flex items-center space-x-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                      <span>Review Before Scheduling</span>
                    </div>
                    <div>Date: <strong>{formatDateColombo(interviewDate)}</strong> &bull; Venue: <strong>{venue}</strong></div>
                    <div>Method: <strong>{scheduleMethod === 'SAME_TIME' ? 'Same Time Window' : 'Individual Time Slots'}</strong></div>
                  </div>

                  {scheduleMethod === 'INDIVIDUAL_SLOTS' && (
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 mb-2">Allocated Time Slots per Candidate:</h4>
                      <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 max-h-72 overflow-y-auto">
                        {customSlots.map((slot, idx) => {
                          const app = eligibleApplicants.find((a) => a.id === slot.applicationId);
                          return (
                            <div key={slot.applicationId} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs hover:bg-slate-50">
                              <div className="min-w-0">
                                <span className="font-bold text-slate-900 break-words">#{idx + 1} {app?.applicantName}</span>
                                <span className="text-[11px] text-slate-500 ml-2 font-mono">({app?.applicationNo})</span>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <input
                                  type="time"
                                  value={slot.startTime}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setCustomSlots((prev) =>
                                      prev.map((s, i) => (i === idx ? { ...s, startTime: val } : s))
                                    );
                                  }}
                                  className="py-1 px-2 border border-slate-200 rounded-lg text-xs"
                                />
                                <span className="text-slate-400">to</span>
                                <input
                                  type="time"
                                  value={slot.endTime}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setCustomSlots((prev) =>
                                      prev.map((s, i) => (i === idx ? { ...s, endTime: val } : s))
                                    );
                                  }}
                                  className="py-1 px-2 border border-slate-200 rounded-lg text-xs"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-600">
                    <p>
                      <strong>Automatic Post-Commit Processing:</strong> Upon confirmation, MadrasaNexa will generate an official A4 PDF Invitation Letter with official institutional branding and dispatch personalized email notifications with the PDF attached to each candidate's registered guardian email.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/50 shrink-0">
              {wizardStep > 1 ? (
                <button
                  type="button"
                  onClick={() => setWizardStep((s) => (s - 1) as any)}
                  className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                >
                  Back
                </button>
              ) : (
                <div className="hidden sm:block" />
              )}

              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowWizardModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>

                {wizardStep === 1 ? (
                  <button
                    type="button"
                    disabled={selectedAppIds.length === 0}
                    onClick={() => setWizardStep(2)}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white disabled:opacity-40 shadow-sm"
                  >
                    Continue to Session Setup ({selectedAppIds.length})
                  </button>
                ) : wizardStep === 2 ? (
                  <button
                    type="button"
                    disabled={!interviewDate || !venue}
                    onClick={handleProceedToStep3}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white disabled:opacity-40 shadow-sm"
                  >
                    Continue to Slot Review
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={submittingSchedule}
                    onClick={handleScheduleSubmit}
                    className="px-6 py-2.5 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white disabled:opacity-40 shadow-sm flex items-center space-x-2"
                  >
                    {submittingSchedule ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Generating Schedules...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Confirm & Dispatch Invitations</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL 2: Attendance & Evaluation Dialog                       */}
      {/* ============================================================= */}
      {showEvaluateModal && selectedAppointment && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                  <UserCheck className="w-5 h-5 text-emerald-700" />
                  <span>Interview Evaluation & Scoring</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Candidate: <strong>{selectedAppointment.application.applicantName}</strong> &bull; Ref: {selectedAppointment.invitationReference}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEvaluateModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto max-h-[75vh]">
              {/* Mandatory Policy Notice */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <strong>Independent Workflow Rule:</strong> Recording interview evaluation scores does <em>not</em> automatically change the applicant's official admission status or convert them into an enrolled student. Official student enrollment remains in the Applications Review workflow.
                </div>
              </div>

              {/* Attendance Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">Candidate Attendance</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setEvalAttendance('PRESENT')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      evalAttendance === 'PRESENT'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-600/20'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Present
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEvalAttendance('ABSENT');
                      setEvalResult('REJECTED');
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      evalAttendance === 'ABSENT'
                        ? 'border-rose-600 bg-rose-50 text-rose-800 ring-2 ring-rose-600/20'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Absent / No-Show
                  </button>

                  <button
                    type="button"
                    onClick={() => setEvalAttendance('UNRECORDED')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      evalAttendance === 'UNRECORDED'
                        ? 'border-slate-600 bg-slate-100 text-slate-800'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Unrecorded
                  </button>
                </div>
              </div>

              {/* Scoring Grid */}
              {evalAttendance === 'PRESENT' && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Evaluation Scores (0 - 100)</span>
                    <span className="text-xs font-black text-emerald-700">Total: {calculatedTotalScore}%</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Quran Recitation & Tajweed</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={evalQuranScore}
                        onChange={(e) => setEvalQuranScore(e.target.value)}
                        className="w-full text-xs py-1.5 px-3 rounded-xl border border-slate-200 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Basic Islamic Knowledge</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={evalIslamicScore}
                        onChange={(e) => setEvalIslamicScore(e.target.value)}
                        className="w-full text-xs py-1.5 px-3 rounded-xl border border-slate-200 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Academic Literacy & General</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={evalAcademicScore}
                        onChange={(e) => setEvalAcademicScore(e.target.value)}
                        className="w-full text-xs py-1.5 px-3 rounded-xl border border-slate-200 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Conduct & Discipline</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={evalConductScore}
                        onChange={(e) => setEvalConductScore(e.target.value)}
                        className="w-full text-xs py-1.5 px-3 rounded-xl border border-slate-200 bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Evaluation Outcome / Result */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">Interview Committee Result</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div
                    onClick={() => setEvalResult('PASSED')}
                    className={`p-3 rounded-xl border cursor-pointer text-center transition-all ${
                      evalResult === 'PASSED'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-600/20 font-bold'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Award className="w-4 h-4 mx-auto mb-1 text-emerald-600" />
                    <span className="text-xs">Passed</span>
                  </div>

                  <div
                    onClick={() => setEvalResult('NEEDS_SECOND_INTERVIEW')}
                    className={`p-3 rounded-xl border cursor-pointer text-center transition-all ${
                      evalResult === 'NEEDS_SECOND_INTERVIEW'
                        ? 'border-purple-600 bg-purple-50 text-purple-800 ring-2 ring-purple-600/20 font-bold'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <RotateCcw className="w-4 h-4 mx-auto mb-1 text-purple-600" />
                    <span className="text-xs">Needs 2nd Round</span>
                  </div>

                  <div
                    onClick={() => setEvalResult('REJECTED')}
                    className={`p-3 rounded-xl border cursor-pointer text-center transition-all ${
                      evalResult === 'REJECTED'
                        ? 'border-rose-600 bg-rose-50 text-rose-800 ring-2 ring-rose-600/20 font-bold'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <XCircle className="w-4 h-4 mx-auto mb-1 text-rose-600" />
                    <span className="text-xs">Not Recommended</span>
                  </div>

                  <div
                    onClick={() => setEvalResult('PENDING')}
                    className={`p-3 rounded-xl border cursor-pointer text-center transition-all ${
                      evalResult === 'PENDING'
                        ? 'border-slate-600 bg-slate-100 text-slate-800 font-bold'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Clock className="w-4 h-4 mx-auto mb-1 text-slate-500" />
                    <span className="text-xs">Pending Decision</span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Interviewer Notes</label>
                <textarea
                  rows={2}
                  value={evalInterviewerNotes}
                  onChange={(e) => setEvalInterviewerNotes(e.target.value)}
                  placeholder="Specific observations regarding recitation, behavior, academic background..."
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Recommendation Notes</label>
                <textarea
                  rows={2}
                  value={evalRecommendationNotes}
                  onChange={(e) => setEvalRecommendationNotes(e.target.value)}
                  placeholder="Recommendations for admission committee..."
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200"
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 flex items-center justify-end space-x-2 bg-slate-50/50">
              <button
                type="button"
                onClick={() => setShowEvaluateModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingEvaluation}
                onClick={handleSubmitEvaluation}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm flex items-center space-x-1.5"
              >
                {submittingEvaluation ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>Save Evaluation</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL 3: Reschedule Dialog                                   */}
      {/* ============================================================= */}
      {showRescheduleModal && selectedAppointment && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
            <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <RotateCcw className="w-5 h-5 text-purple-700" />
                <span>Reschedule Interview</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowRescheduleModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="text-xs text-slate-600">
                Rescheduling for: <strong>{selectedAppointment.application.applicantName}</strong> (
                {selectedAppointment.invitationReference})
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">New Interview Date</label>
                <input
                  type="date"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Start Time</label>
                  <input
                    type="time"
                    value={rescheduleStart}
                    onChange={(e) => setRescheduleStart(e.target.value)}
                    className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">End Time</label>
                  <input
                    type="time"
                    value={rescheduleEnd}
                    onChange={(e) => setRescheduleEnd(e.target.value)}
                    className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Venue</label>
                <input
                  type="text"
                  value={rescheduleVenue}
                  onChange={(e) => setRescheduleVenue(e.target.value)}
                  className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Reason for Rescheduling</label>
                <textarea
                  rows={2}
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  placeholder="Requested by parent / administrative schedule change..."
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200"
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 flex items-center justify-end space-x-2 bg-slate-50/50">
              <button
                type="button"
                onClick={() => setShowRescheduleModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingReschedule || !rescheduleDate}
                onClick={handleSubmitReschedule}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-purple-700 hover:bg-purple-800 text-white shadow-sm flex items-center space-x-1.5"
              >
                {submittingReschedule ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>Confirm Reschedule</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL 4: Cancellation Dialog                                 */}
      {/* ============================================================= */}
      {showCancelModal && selectedAppointment && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
            <div className="p-5 border-b border-slate-200 bg-rose-50/50 flex items-center justify-between">
              <h3 className="text-base font-bold text-rose-900 flex items-center space-x-2">
                <XCircle className="w-5 h-5 text-rose-600" />
                <span>Cancel Interview Appointment</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600">
                Are you sure you want to cancel the interview appointment for{' '}
                <strong>{selectedAppointment.application.applicantName}</strong> (
                {selectedAppointment.invitationReference})?
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Cancellation Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Specify why this appointment is being cancelled..."
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200"
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 flex items-center justify-end space-x-2 bg-slate-50/50">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-800"
              >
                Keep Appointment
              </button>
              <button
                type="button"
                disabled={submittingCancel || !cancelReason.trim()}
                onClick={handleSubmitCancel}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-sm flex items-center space-x-1.5"
              >
                {submittingCancel ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                <span>Confirm Cancellation</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
