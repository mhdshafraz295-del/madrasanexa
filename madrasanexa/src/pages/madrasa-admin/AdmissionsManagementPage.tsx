import React, { useEffect, useState } from 'react';
import {
  apiListAdmissionPeriods,
  apiCreateAdmissionPeriod,
  apiToggleAdmissionPeriod,
  apiListStudentApplications,
  apiGetStudentApplication,
  apiReviewStudentApplication,
  apiConvertStudentApplication,
} from '../../services/api';
import type {
  AdmissionPeriodData,
  StudentApplicationItem,
} from '../../services/api';
import {
  FileText,
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Plus,
  Search,
  ExternalLink,
  UserCheck,
  ChevronRight,
  User,
  ArrowRight,
  ShieldCheck,
  Loader2,
  Check,
  X,
  GraduationCap,
  CalendarClock,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { InterviewManagementSection } from '../../components/admissions/InterviewManagementSection';

export const AdmissionsManagementPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'applications' | 'periods' | 'interviews'>('applications');
  const [interviewPreSelectedAppId, setInterviewPreSelectedAppId] = useState<string | null>(null);

  // Applications State
  const [applications, setApplications] = useState<StudentApplicationItem[]>([]);
  const [totalApplications, setTotalApplications] = useState(0);
  const [loadingApps, setLoadingApps] = useState(true);
  const [appSearch, setAppSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [periodFilter, setPeriodFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Periods State
  const [periods, setPeriods] = useState<AdmissionPeriodData[]>([]);
  const [loadingPeriods, setLoadingPeriods] = useState(true);
  const [showCreatePeriodModal, setShowCreatePeriodModal] = useState(false);
  const [newPeriodCode, setNewPeriodCode] = useState('');
  const [newPeriodName, setNewPeriodName] = useState('');
  const [newPeriodYear, setNewPeriodYear] = useState<number>(new Date().getFullYear());
  const [newPeriodStart, setNewPeriodStart] = useState('');
  const [newPeriodEnd, setNewPeriodEnd] = useState('');
  const [newPeriodCapacity, setNewPeriodCapacity] = useState<string>('');
  const [newPeriodInstructions, setNewPeriodInstructions] = useState('');
  const [savingPeriod, setSavingPeriod] = useState(false);

  // Selected Application for Review
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [selectedApp, setSelectedApp] = useState<StudentApplicationItem | null>(null);
  const [loadingAppDetail, setLoadingAppDetail] = useState(false);
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [reviewing, setReviewing] = useState(false);

  // Convert to Student Modal State
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convertAdmissionNo, setConvertAdmissionNo] = useState('');
  const [convertClassId, setConvertClassId] = useState('');
  const [converting, setConverting] = useState(false);

  // Global Feedback Toast
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchPeriods = async () => {
    setLoadingPeriods(true);
    try {
      const data = await apiListAdmissionPeriods();
      setPeriods(data);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to load intake periods.',
      });
    } finally {
      setLoadingPeriods(false);
    }
  };

  const fetchApplications = async () => {
    setLoadingApps(true);
    try {
      const data = await apiListStudentApplications({
        page,
        pageSize: 15,
        status: statusFilter,
        admissionPeriodId: periodFilter,
        search: appSearch.trim(),
      });
      setApplications(data.items);
      setTotalApplications(data.total);
      setTotalPages(data.totalPages);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to load applications.',
      });
    } finally {
      setLoadingApps(false);
    }
  };

  useEffect(() => {
    fetchPeriods();
  }, []);

  useEffect(() => {
    fetchApplications();
  }, [page, statusFilter, periodFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchApplications();
  };

  const handleOpenAppDetail = async (id: string) => {
    setSelectedAppId(id);
    setLoadingAppDetail(true);
    setReviewRemarks('');
    try {
      const app = await apiGetStudentApplication(id);
      setSelectedApp(app);
      setReviewRemarks(app.reviewRemarks || '');
      setConvertAdmissionNo(`ADM-${app.admissionPeriod?.academicYear || 2026}-${app.applicationNo.slice(-4)}`);
      setConvertClassId(app.appliedClassId || '');
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to load application details.',
      });
      setSelectedAppId(null);
    } finally {
      setLoadingAppDetail(false);
    }
  };

  const handleReviewStatus = async (status: 'APPROVED' | 'REJECTED') => {
    if (!selectedApp) return;
    setReviewing(true);
    try {
      const updated = await apiReviewStudentApplication(selectedApp.id, {
        status,
        reviewRemarks: reviewRemarks.trim() || null,
      });
      setSelectedApp(updated);
      setApplications((prev) =>
        prev.map((item) => (item.id === updated.id ? { ...item, status: updated.status } : item))
      );
      setFeedback({
        type: 'success',
        message: `Application marked as ${status}. Notification dispatched to guardian.`,
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to update application review status.',
      });
    } finally {
      setReviewing(false);
    }
  };

  const handleConvertStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp) return;
    if (!convertAdmissionNo.trim()) {
      setFeedback({ type: 'error', message: 'Admission number is required for enrollment.' });
      return;
    }

    setConverting(true);
    try {
      const result = await apiConvertStudentApplication(selectedApp.id, {
        admissionNo: convertAdmissionNo.trim(),
        classId: convertClassId || null,
      });

      setSelectedApp(result.application);
      setApplications((prev) =>
        prev.map((item) => (item.id === result.application.id ? result.application : item))
      );
      setShowConvertModal(false);
      setFeedback({
        type: 'success',
        message: `Applicant successfully enrolled as active student (${result.student.admissionNo})!`,
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to convert applicant to enrolled student.',
      });
    } finally {
      setConverting(false);
    }
  };

  const handleCreatePeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPeriod(true);
    try {
      await apiCreateAdmissionPeriod({
        code: newPeriodCode.trim().toUpperCase(),
        name: newPeriodName.trim(),
        academicYear: Number(newPeriodYear),
        startDate: newPeriodStart,
        endDate: newPeriodEnd,
        capacity: newPeriodCapacity ? Number(newPeriodCapacity) : null,
        instructions: newPeriodInstructions.trim() || null,
        isOpen: true,
      });
      setShowCreatePeriodModal(false);
      setNewPeriodCode('');
      setNewPeriodName('');
      setNewPeriodStart('');
      setNewPeriodEnd('');
      setNewPeriodCapacity('');
      setNewPeriodInstructions('');
      fetchPeriods();
      setFeedback({ type: 'success', message: 'New intake period created successfully.' });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to create intake period.',
      });
    } finally {
      setSavingPeriod(false);
    }
  };

  const handleTogglePeriod = async (id: string) => {
    try {
      const updated = await apiToggleAdmissionPeriod(id);
      setPeriods((prev) => prev.map((p) => (p.id === id ? { ...p, isOpen: updated.isOpen } : p)));
      setFeedback({
        type: 'success',
        message: `Intake period is now ${updated.isOpen ? 'open' : 'closed'}.`,
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to toggle intake period status.',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" />
            <span>Pending Review</span>
          </span>
        );
      case 'APPROVED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>Approved</span>
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200">
            <XCircle className="w-3 h-3 text-rose-600" />
            <span>Rejected</span>
          </span>
        );
      case 'CONVERTED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-800 border border-purple-200">
            <GraduationCap className="w-3 h-3 text-purple-600" />
            <span>Enrolled Student</span>
          </span>
        );
      default:
        return <span>{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <FileText className="w-6 h-6 text-emerald-700" />
            <span>Admissions & Student Applications</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Manage online intake cycles, review incoming applications, and enroll verified applicants.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {activeTab === 'periods' ? (
            <button
              type="button"
              onClick={() => setShowCreatePeriodModal(true)}
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-emerald-700 text-white hover:bg-emerald-800 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>New Intake Cycle</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setActiveTab('periods')}
              className="inline-flex items-center space-x-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm"
            >
              <Calendar className="w-4 h-4 text-emerald-700" />
              <span>Manage Intake Cycles</span>
            </button>
          )}
        </div>
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl text-xs flex items-center justify-between shadow-xs ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <div className="flex items-center space-x-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-medium">{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 space-x-4 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('applications')}
          className={`pb-3 text-sm font-semibold transition-colors flex items-center space-x-2 border-b-2 whitespace-nowrap shrink-0 ${
            activeTab === 'applications'
              ? 'border-emerald-700 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Applications Hub</span>
          <span className="px-2 py-0.5 rounded-full text-[11px] bg-slate-100 text-slate-700 font-bold">
            {totalApplications}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('periods')}
          className={`pb-3 text-sm font-semibold transition-colors flex items-center space-x-2 border-b-2 whitespace-nowrap shrink-0 ${
            activeTab === 'periods'
              ? 'border-emerald-700 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Intake Cycles</span>
          <span className="px-2 py-0.5 rounded-full text-[11px] bg-slate-100 text-slate-700 font-bold">
            {periods.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setInterviewPreSelectedAppId(null);
            setActiveTab('interviews');
          }}
          className={`pb-3 text-sm font-semibold transition-colors flex items-center space-x-2 border-b-2 whitespace-nowrap shrink-0 ${
            activeTab === 'interviews'
              ? 'border-emerald-700 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <CalendarClock className="w-4 h-4" />
          <span>Interview Management</span>
        </button>
      </div>

      {/* Tab 1: Applications Hub */}
      {activeTab === 'applications' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
            <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={appSearch}
                onChange={(e) => setAppSearch(e.target.value)}
                placeholder="Search by name, reference number, guardian..."
                className="w-full pl-10 pr-3.5 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </form>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending Review</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="CONVERTED">Enrolled as Student</option>
              </select>

              <select
                value={periodFilter}
                onChange={(e) => {
                  setPeriodFilter(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                <option value="ALL">All Intake Cycles</option>
                {periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.academicYear})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Applications Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            {loadingApps ? (
              <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center">
                <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mb-2" />
                <p className="text-xs font-medium">Loading applications...</p>
              </div>
            ) : applications.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <h4 className="text-sm font-bold text-slate-700">No applications found</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Try adjusting your search criteria or intake filter.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 text-slate-600 uppercase font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Reference No</th>
                      <th className="px-4 py-3">Applicant Name</th>
                      <th className="px-4 py-3">Intake Cycle</th>
                      <th className="px-4 py-3">Requested Class</th>
                      <th className="px-4 py-3">Guardian Contact</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Submitted</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {applications.map((app) => (
                      <tr key={app.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3.5 font-mono font-bold text-slate-900">
                          {app.applicationNo}
                        </td>
                        <td className="px-4 py-3.5 font-medium text-slate-900">
                          <div>{app.applicantName}</div>
                          <span className="text-[10px] text-slate-400 capitalize">
                            {app.gender.toLowerCase()} • DOB: {new Date(app.dateOfBirth).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-slate-600">
                          {app.admissionPeriod?.name || 'N/A'}
                        </td>
                        <td className="px-4 py-3.5 text-slate-600">
                          {app.appliedClass?.name || 'Unassigned'}
                        </td>
                        <td className="px-4 py-3.5 text-slate-600">
                          <div>{app.guardianName}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{app.guardianPhone}</div>
                        </td>
                        <td className="px-4 py-3.5">{getStatusBadge(app.status)}</td>
                        <td className="px-4 py-3.5 text-slate-500">
                          {new Date(app.submittedAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => handleOpenAppDetail(app.id)}
                            className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition-colors"
                          >
                            <span>Review</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
                <span>
                  Page {page} of {totalPages}
                </span>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Intake Cycles Management */}
      {activeTab === 'periods' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {loadingPeriods ? (
              <div className="col-span-full p-12 text-center text-slate-500">
                <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-2" />
                <p className="text-xs font-medium">Loading intake cycles...</p>
              </div>
            ) : periods.length === 0 ? (
              <div className="col-span-full bg-white rounded-2xl border border-slate-200/80 p-12 text-center text-slate-500">
                <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <h4 className="text-sm font-bold text-slate-700">No intake cycles configured yet</h4>
                <p className="text-xs text-slate-400 mt-1 mb-4">
                  Create an intake cycle to allow public applicants to submit admission applications.
                </p>
                <button
                  type="button"
                  onClick={() => setShowCreatePeriodModal(true)}
                  className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-700 text-white hover:bg-emerald-800 transition-colors shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create First Intake</span>
                </button>
              </div>
            ) : (
              periods.map((period) => (
                <div
                  key={period.id}
                  className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm flex flex-col justify-between space-y-4 hover:border-slate-300 transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                        {period.code}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleTogglePeriod(period.id)}
                        className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                          period.isOpen
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            period.isOpen ? 'bg-emerald-600' : 'bg-slate-400'
                          }`}
                        />
                        <span>{period.isOpen ? 'Open (Accepting)' : 'Closed'}</span>
                      </button>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 leading-snug">{period.name}</h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      Academic Year: {period.academicYear}
                    </p>

                    <div className="space-y-1.5 text-xs text-slate-600 mt-3 pt-3 border-t border-slate-100">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Date Range:</span>
                        <span className="font-medium text-slate-800">
                          {new Date(period.startDate).toLocaleDateString()} – {new Date(period.endDate).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Total Applications:</span>
                        <span className="font-bold text-emerald-700">{period.totalApplications ?? 0}</span>
                      </div>
                      {period.capacity && (
                        <div className="flex justify-between">
                          <span className="text-slate-400">Capacity Limit:</span>
                          <span className="font-medium text-slate-800">{period.capacity} Students</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPeriodFilter(period.id);
                        setActiveTab('applications');
                      }}
                      className="w-full inline-flex items-center justify-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors border border-slate-200/60"
                    >
                      <span>View Applications</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Interview Management */}
      {activeTab === 'interviews' && (
        <InterviewManagementSection
          periods={periods}
          onScheduleSuccess={() => {
            fetchApplications();
          }}
          preSelectedAppId={interviewPreSelectedAppId}
        />
      )}

      {/* Application Details & Review Modal */}
      {selectedAppId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full my-8 p-6 sm:p-8 shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
              <div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                  Ref: {selectedApp?.applicationNo}
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-1">
                  Application Review
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedAppId(null);
                  setSelectedApp(null);
                }}
                className="w-8 h-8 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingAppDetail || !selectedApp ? (
              <div className="py-16 text-center text-slate-500">
                <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-2" />
                <p className="text-xs font-medium">Loading application record...</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto py-4 space-y-6">
                {/* Header Status & Intake Banner */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-400">Intake Cycle</span>
                    <h4 className="text-sm font-bold text-slate-900">
                      {selectedApp.admissionPeriod?.name} ({selectedApp.admissionPeriod?.academicYear})
                    </h4>
                  </div>
                  <div>{getStatusBadge(selectedApp.status)}</div>
                </div>

                {/* Section 1: Applicant Details */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase text-slate-700 flex items-center space-x-1.5">
                    <User className="w-4 h-4 text-emerald-700" />
                    <span>Applicant Details</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-3.5 rounded-xl border border-slate-100 text-xs">
                    <div>
                      <span className="text-slate-400 block">Full Name:</span>
                      <span className="font-bold text-slate-900">{selectedApp.applicantName}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Date of Birth:</span>
                      <span className="font-medium text-slate-800">
                        {new Date(selectedApp.dateOfBirth).toLocaleDateString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Gender:</span>
                      <span className="font-medium text-slate-800">{selectedApp.gender}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Requested Class:</span>
                      <span className="font-medium text-slate-800">
                        {selectedApp.appliedClass?.name || 'Unspecified'}
                      </span>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-slate-400 block">Previous School:</span>
                      <span className="font-medium text-slate-800">
                        {selectedApp.previousSchool || 'None recorded'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Section 2: Guardian Details & Contact */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase text-slate-700 flex items-center space-x-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-700" />
                    <span>Parent / Guardian & Contact</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-3.5 rounded-xl border border-slate-100 text-xs">
                    <div>
                      <span className="text-slate-400 block">Guardian:</span>
                      <span className="font-bold text-slate-900">{selectedApp.guardianName}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Relationship:</span>
                      <span className="font-medium text-slate-800">{selectedApp.guardianRelationship}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Phone:</span>
                      <a
                        href={`tel:${selectedApp.guardianPhone}`}
                        className="font-mono text-emerald-700 hover:underline"
                      >
                        {selectedApp.guardianPhone}
                      </a>
                    </div>
                    <div className="sm:col-span-3">
                      <span className="text-slate-400 block">Home Address:</span>
                      <span className="font-medium text-slate-800">{selectedApp.address}</span>
                    </div>
                  </div>
                </div>

                {/* Section 3: Supporting Documents */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase text-slate-700 flex items-center space-x-1.5">
                    <FileText className="w-4 h-4 text-emerald-700" />
                    <span>Supporting Documents</span>
                  </h4>
                  {selectedApp.documents && selectedApp.documents.length > 0 ? (
                    <div className="space-y-2">
                      {selectedApp.documents.map((doc, idx) => (
                        <div
                          key={doc.fileId || idx}
                          className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                        >
                          <div className="flex items-center space-x-2 truncate">
                            <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                            <span className="font-medium text-slate-800 truncate">{doc.name}</span>
                          </div>
                          {doc.fileUrl && (
                            <a
                              href={doc.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center space-x-1 px-3 py-1 rounded-lg bg-white border border-slate-200 text-emerald-700 hover:bg-slate-100 font-semibold"
                            >
                              <span>View File</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No supporting documents attached.</p>
                  )}
                </div>

                {/* Section 4: Review Decision & Enrollment Actions */}
                <div className="space-y-4 pt-4 border-t border-slate-200">
                  <h4 className="text-xs font-bold uppercase text-slate-800">
                    Review Decision & Enrollment
                  </h4>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                      Reviewer Remarks (Notified to Guardian)
                    </label>
                    <textarea
                      rows={2}
                      value={reviewRemarks}
                      onChange={(e) => setReviewRemarks(e.target.value)}
                      placeholder="e.g. Approved for entrance oral test on Saturday at 9:00 AM."
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>

                  {/* Actions for Non-Converted Applications */}
                  {selectedApp.status !== 'CONVERTED' ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        disabled={reviewing}
                        onClick={() => handleReviewStatus('APPROVED')}
                        className="inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-emerald-700 text-white hover:bg-emerald-800 transition-colors shadow-sm disabled:opacity-50"
                      >
                        <Check className="w-4 h-4" />
                        <span>Approve Application</span>
                      </button>

                      <button
                        type="button"
                        disabled={reviewing}
                        onClick={() => handleReviewStatus('REJECTED')}
                        className="inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 transition-colors shadow-sm disabled:opacity-50"
                      >
                        <X className="w-4 h-4" />
                        <span>Reject Application</span>
                      </button>

                      {selectedApp.status === 'APPROVED' && (
                        <button
                          type="button"
                          onClick={() => setShowConvertModal(true)}
                          className="inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-purple-700 text-white hover:bg-purple-800 transition-colors shadow-sm"
                        >
                          <UserCheck className="w-4 h-4" />
                          <span>Convert to Enrolled Student</span>
                        </button>
                      )}

                      {!selectedApp.convertedStudentId && selectedApp.status !== 'REJECTED' && (
                        <button
                          type="button"
                          onClick={() => {
                            const appId = selectedApp.id;
                            setSelectedAppId(null);
                            setSelectedApp(null);
                            setInterviewPreSelectedAppId(appId);
                            setActiveTab('interviews');
                          }}
                          className="inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors shadow-sm"
                        >
                          <CalendarClock className="w-4 h-4 text-emerald-700" />
                          <span>Schedule Interview</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-purple-50 border border-purple-200 text-xs text-purple-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        <GraduationCap className="w-5 h-5 text-purple-700 shrink-0" />
                        <div>
                          <p className="font-bold">Active Enrolled Student</p>
                          <p className="text-purple-700">
                            Admission No: {selectedApp.convertedStudent?.admissionNo} •{' '}
                            {selectedApp.convertedStudent?.fullName}
                          </p>
                        </div>
                      </div>
                      {selectedApp.convertedStudentId && (
                        <Link
                          to={`/madrasa-admin/students/${selectedApp.convertedStudentId}`}
                          className="inline-flex items-center space-x-1 font-semibold text-purple-800 hover:underline"
                        >
                          <span>Open Student Profile</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Convert to Enrolled Student Modal */}
      {showConvertModal && selectedApp && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center space-x-3 text-purple-700">
              <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Enroll as Active Student</h3>
                <p className="text-xs text-slate-500">{selectedApp.applicantName}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              This will officially create an active Student record in your Madrasa database, assign their admission number, and notify the guardian.
            </p>

            <form onSubmit={handleConvertStudent} className="space-y-4 pt-2">
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                  Admission Number *
                </label>
                <input
                  type="text"
                  required
                  value={convertAdmissionNo}
                  onChange={(e) => setConvertAdmissionNo(e.target.value)}
                  placeholder="e.g. ADM-2026-001"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-purple-600"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={converting}
                  onClick={() => setShowConvertModal(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={converting}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-purple-700 text-white hover:bg-purple-800 shadow-sm disabled:opacity-50"
                >
                  {converting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Enrolling...</span>
                    </>
                  ) : (
                    <span>Confirm Enrollment</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Intake Cycle Modal */}
      {showCreatePeriodModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-4 sm:p-8 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">Create New Intake Cycle</h3>
              <button
                type="button"
                onClick={() => setShowCreatePeriodModal(false)}
                className="w-7 h-7 rounded-full text-slate-400 hover:text-slate-600 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePeriod} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                    Period Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={newPeriodCode}
                    onChange={(e) => setNewPeriodCode(e.target.value)}
                    placeholder="e.g. INTAKE-2026-01"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs uppercase font-mono font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                    Academic Year *
                  </label>
                  <input
                    type="number"
                    required
                    value={newPeriodYear}
                    onChange={(e) => setNewPeriodYear(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                  Intake Title / Name *
                </label>
                <input
                  type="text"
                  required
                  value={newPeriodName}
                  onChange={(e) => setNewPeriodName(e.target.value)}
                  placeholder="e.g. Primary Islamic Studies Intake 2026"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={newPeriodStart}
                    onChange={(e) => setNewPeriodStart(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                    End Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={newPeriodEnd}
                    onChange={(e) => setNewPeriodEnd(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                  Student Capacity Limit (Optional)
                </label>
                <input
                  type="number"
                  value={newPeriodCapacity}
                  onChange={(e) => setNewPeriodCapacity(e.target.value)}
                  placeholder="e.g. 50 (leave empty for unlimited)"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                  Public Instructions / Guidelines
                </label>
                <textarea
                  rows={2}
                  value={newPeriodInstructions}
                  onChange={(e) => setNewPeriodInstructions(e.target.value)}
                  placeholder="e.g. Please bring original birth certificates for in-person review."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={savingPeriod}
                  onClick={() => setShowCreatePeriodModal(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPeriod}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-700 text-white hover:bg-emerald-800 shadow-sm disabled:opacity-50"
                >
                  {savingPeriod ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <span>Create Intake</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdmissionsManagementPage;
