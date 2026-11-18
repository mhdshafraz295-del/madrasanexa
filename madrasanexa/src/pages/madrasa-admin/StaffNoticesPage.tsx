import React, { useState, useEffect, useMemo } from 'react';
import {
  Megaphone,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  AlertCircle,
  Users,
  Eye,
  Trash2,
  X,
  Send,
  Loader2,
  Layers,
  UserCheck,
} from 'lucide-react';
import { Pagination } from '../../components/common/Pagination';
import {
  getStaffNotices,
  createStaffNotice,
  deleteStaffNotice,
} from '../../services/staff-notice.service';
import type {
  StaffNoticeItem,
  StaffNoticeKPIs,
  CreateStaffNoticePayload,
} from '../../services/staff-notice.service';
import { apiClient } from '../../services/api';

export const StaffNoticesPage: React.FC = () => {
  // Data State
  const [loading, setLoading] = useState<boolean>(true);
  const [notices, setNotices] = useState<StaffNoticeItem[]>([]);
  const [kpis, setKpis] = useState<StaffNoticeKPIs>({
    totalSent: 0,
    urgentCount: 0,
    avgReadRate: 0,
    activeStaffCount: 0,
  });
  const [activeStaffList, setActiveStaffList] = useState<Array<{ id: string; ustadhCode: string; fullName: string; staffType: string }>>([]);
  const [classesList, setClassesList] = useState<Array<{ id: string; name: string; code?: string }>>([]);

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  // Pagination State
  const [page, setPage] = useState<number>(1);
  const pageSize = 8;

  // Modals State
  const [isComposeOpen, setIsComposeOpen] = useState<boolean>(false);
  const [isReceiptsOpen, setIsReceiptsOpen] = useState<boolean>(false);
  const [selectedNoticeForReceipts, setSelectedNoticeForReceipts] = useState<StaffNoticeItem | null>(null);
  const [receiptsTab, setReceiptsTab] = useState<'READ' | 'UNREAD'>('READ');

  // Form State for Compose
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formTitle, setFormTitle] = useState<string>('');
  const [formMessage, setFormMessage] = useState<string>('');
  const [formPriority, setFormPriority] = useState<'NORMAL' | 'IMPORTANT' | 'URGENT'>('NORMAL');
  const [formCategory, setFormCategory] = useState<'GENERAL' | 'SCHEDULE' | 'EXAM' | 'PAYROLL' | 'EVENT'>('GENERAL');
  const [formTargetType, setFormTargetType] = useState<'ALL_TEACHERS' | 'CLASS' | 'SPECIFIC_USTADHS'>('ALL_TEACHERS');
  const [formTargetClassId, setFormTargetClassId] = useState<string>('');
  const [formTargetUstadhIds, setFormTargetUstadhIds] = useState<string[]>([]);
  const [ustadhSearchInModal, setUstadhSearchInModal] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Load notices & metadata
  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await getStaffNotices();
      setNotices(res.notices || []);
      setKpis(res.kpis || { totalSent: 0, urgentCount: 0, avgReadRate: 0, activeStaffCount: 0 });
      setActiveStaffList(res.activeStaff || []);
    } catch (err: any) {
      console.error('Failed to load staff notices:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load classes for targeting
  const fetchClasses = async () => {
    try {
      const res = await apiClient.get<any>('/madrasa-admin/classes');
      const data = res.data?.data;
      const items = Array.isArray(data) ? data : data?.classes || data?.items || [];
      setClassesList(items);
    } catch (err) {
      console.error('Failed to load classes for targeting:', err);
    }
  };

  useEffect(() => {
    fetchData();
    fetchClasses();
  }, []);

  // Filtered notices
  const filteredNotices = useMemo(() => {
    return notices.filter((n) => {
      const matchesSearch =
        !searchQuery.trim() ||
        n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.message.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesPriority = priorityFilter === 'ALL' || n.priority === priorityFilter;
      const matchesCategory = categoryFilter === 'ALL' || n.category === categoryFilter;
      return matchesSearch && matchesPriority && matchesCategory;
    });
  }, [notices, searchQuery, priorityFilter, categoryFilter]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, priorityFilter, categoryFilter]);

  const paginatedNotices = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredNotices.slice(start, start + pageSize);
  }, [filteredNotices, page, pageSize]);

  // Recipient Count Preview in Compose Modal
  const recipientCountPreview = useMemo(() => {
    if (formTargetType === 'ALL_TEACHERS') {
      return activeStaffList.length;
    }
    if (formTargetType === 'CLASS') {
      return 'Class assigned teachers';
    }
    if (formTargetType === 'SPECIFIC_USTADHS') {
      return formTargetUstadhIds.length;
    }
    return activeStaffList.length;
  }, [formTargetType, activeStaffList, formTargetUstadhIds]);

  // Filtered staff list in multi-select
  const filteredModalStaff = useMemo(() => {
    if (!ustadhSearchInModal.trim()) return activeStaffList;
    const q = ustadhSearchInModal.toLowerCase();
    return activeStaffList.filter(
      (u) => u.fullName.toLowerCase().includes(q) || u.ustadhCode.toLowerCase().includes(q)
    );
  }, [activeStaffList, ustadhSearchInModal]);

  // Reset Compose Form
  const resetForm = () => {
    setFormTitle('');
    setFormMessage('');
    setFormPriority('NORMAL');
    setFormCategory('GENERAL');
    setFormTargetType('ALL_TEACHERS');
    setFormTargetClassId('');
    setFormTargetUstadhIds([]);
    setUstadhSearchInModal('');
    setErrorMessage(null);
  };

  // Submit Notice Broadcast
  const handleCreateNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!formTitle.trim()) {
      setErrorMessage('Please enter a notice title.');
      return;
    }
    if (!formMessage.trim()) {
      setErrorMessage('Please enter the notice message body.');
      return;
    }
    if (formTargetType === 'CLASS' && !formTargetClassId) {
      setErrorMessage('Please select a target class.');
      return;
    }
    if (formTargetType === 'SPECIFIC_USTADHS' && formTargetUstadhIds.length === 0) {
      setErrorMessage('Please select at least one teacher.');
      return;
    }

    try {
      setSubmitting(true);
      const payload: CreateStaffNoticePayload = {
        title: formTitle.trim(),
        message: formMessage.trim(),
        priority: formPriority,
        category: formCategory,
        targetType: formTargetType,
        targetClassId: formTargetType === 'CLASS' ? formTargetClassId : null,
        targetUstadhIds: formTargetType === 'SPECIFIC_USTADHS' ? formTargetUstadhIds : null,
      };

      await createStaffNotice(payload);
      setIsComposeOpen(false);
      resetForm();
      await fetchData();
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || err.message || 'Failed to publish staff notice.');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Notice
  const handleDeleteNotice = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this staff notice?')) return;
    try {
      setDeletingId(id);
      await deleteStaffNotice(id);
      await fetchData();
      if (selectedNoticeForReceipts?.id === id) {
        setIsReceiptsOpen(false);
        setSelectedNoticeForReceipts(null);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete notice.');
    } finally {
      setDeletingId(null);
    }
  };

  // Toggle teacher selection in specific ustadhs
  const toggleUstadhSelection = (id: string) => {
    setFormTargetUstadhIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Format date helper
  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (_) {
      return isoString;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 p-3 sm:p-6 lg:p-8 space-y-6">
      {/* Executive Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-sm">
        <div className="flex items-start sm:items-center gap-3">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-100 dark:border-emerald-900/60">
            <Megaphone className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Staff Notices
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Direct administrative announcements & live read receipts for teaching staff
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            resetForm();
            setIsComposeOpen(true);
          }}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-medium text-sm rounded-xl shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        >
          <Plus className="w-4 h-4" />
          <span>Broadcast New Notice</span>
        </button>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Sent */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Broadcasts</p>
            <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-1">
              {kpis.totalSent}
            </p>
          </div>
          <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl">
            <Send className="w-5 h-5" />
          </div>
        </div>

        {/* Urgent Alerts */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Urgent Notices</p>
            <p className="text-xl sm:text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
              {kpis.urgentCount}
            </p>
          </div>
          <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-xl">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        {/* Avg Read Rate */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Average Read Rate</p>
            <p className="text-xl sm:text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
              {kpis.avgReadRate}%
            </p>
          </div>
          <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <Eye className="w-5 h-5" />
          </div>
        </div>

        {/* Active Staff */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Active Teachers</p>
            <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-1">
              {kpis.activeStaffCount}
            </p>
          </div>
          <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <Users className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 sm:p-4 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notices by title or content..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="ALL">All Priorities</option>
            <option value="NORMAL">Normal</option>
            <option value="IMPORTANT">Important</option>
            <option value="URGENT">Urgent</option>
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="ALL">All Categories</option>
            <option value="GENERAL">General</option>
            <option value="SCHEDULE">Schedule</option>
            <option value="EXAM">Exam</option>
            <option value="PAYROLL">Payroll</option>
            <option value="EVENT">Event</option>
          </select>
        </div>
      </div>

      {/* Notices Feed List */}
      {loading ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center shadow-sm">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-600 dark:text-emerald-400 mb-3" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Loading staff notices...
          </p>
        </div>
      ) : filteredNotices.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 sm:p-12 text-center shadow-sm">
          <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-100 dark:border-emerald-900/60">
            <Megaphone className="w-7 h-7" />
          </div>
          <h3 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white">
            No notices found
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1 mb-5">
            {searchQuery || priorityFilter !== 'ALL' || categoryFilter !== 'ALL'
              ? 'No notices match your active filters. Try resetting search filters.'
              : 'Keep your teaching staff informed on schedule adjustments, exams, or urgent administrative memos.'}
          </p>
          <button
            onClick={() => {
              resetForm();
              setIsComposeOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Create First Notice</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {paginatedNotices.map((notice) => {
            const isUrgent = notice.priority === 'URGENT';
            const isImportant = notice.priority === 'IMPORTANT';

            return (
              <div
                key={notice.id}
                className={`bg-white dark:bg-slate-900 border rounded-2xl p-4 sm:p-6 shadow-sm transition-all hover:shadow-md ${
                  isUrgent
                    ? 'border-rose-300 dark:border-rose-900/60 ring-1 ring-rose-500/10'
                    : isImportant
                    ? 'border-amber-300 dark:border-amber-900/60'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                {/* Meta Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Priority Badge */}
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                        isUrgent
                          ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                          : isImportant
                          ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {isUrgent && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />}
                      {notice.priority}
                    </span>

                    {/* Category Tag */}
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700">
                      <Layers className="w-3 h-3" />
                      {notice.category}
                    </span>

                    {/* Audience Pill */}
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 rounded-lg text-xs font-medium border border-blue-100 dark:border-blue-900/60">
                      <Users className="w-3 h-3" />
                      {notice.targetType === 'ALL_TEACHERS'
                        ? 'All Staff'
                        : notice.targetType === 'CLASS'
                        ? `Class: ${notice.targetClass?.name || 'Class'}`
                        : `${notice.stats.totalRecipients} Selected Teachers`}
                    </span>
                  </div>

                  {/* Timestamp */}
                  <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                    <Clock className="w-3 h-3" />
                    {formatDate(notice.createdAt)}
                  </span>
                </div>

                {/* Title & Message */}
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mb-2 leading-snug">
                  {notice.title}
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed mb-4">
                  {notice.message}
                </p>

                {/* Live Read Progress Strip */}
                <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-xl p-3 mb-4">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5 text-indigo-500" />
                      Read Receipts: {notice.stats.readCount} of {notice.stats.totalRecipients} Teachers
                    </span>
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                      {notice.stats.readRate}% Read
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${notice.stats.readRate}%` }}
                    />
                  </div>
                </div>

                {/* Bottom Actions Row */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-xs text-slate-400">
                    Sent by: <strong className="text-slate-600 dark:text-slate-300">{notice.senderName}</strong>
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSelectedNoticeForReceipts(notice);
                        setReceiptsTab('READ');
                        setIsReceiptsOpen(true);
                      }}
                      className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-lg transition-colors"
                    >
                      <UserCheck className="w-3.5 h-3.5 text-slate-500" />
                      <span>View Read Receipts</span>
                    </button>

                    <button
                      onClick={() => handleDeleteNotice(notice.id)}
                      disabled={deletingId === notice.id}
                      className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                      title="Delete notice"
                    >
                      {deletingId === notice.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          <Pagination
            currentPage={page}
            totalItems={filteredNotices.length}
            pageSize={pageSize}
            onPageChange={setPage}
            itemLabel="notices"
            className="rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs"
          />
        </div>
      )}

      {/* Compose Notice Modal */}
      {isComposeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-xl animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                    Broadcast Staff Notice
                  </h3>
                  <p className="text-xs text-slate-400">
                    Deliver immediate notifications to Ustadhs & teachers
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsComposeOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCreateNotice} className="p-4 sm:p-6 overflow-y-auto space-y-4">
              {errorMessage && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl flex items-center gap-2 text-rose-700 dark:text-rose-400 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Notice Title *
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Schedule Revision for Safful Avval or Faculty Meeting"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              {/* Priority & Category Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Priority */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Priority Level
                  </label>
                  <select
                    value={formPriority}
                    onChange={(e: any) => setFormPriority(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="NORMAL">Normal Notice</option>
                    <option value="IMPORTANT">Important Memo</option>
                    <option value="URGENT">Urgent Action Alert</option>
                  </select>
                </div>

                {/* Category */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Category Tag
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e: any) => setFormCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="GENERAL">General</option>
                    <option value="SCHEDULE">Schedule & Periods</option>
                    <option value="EXAM">Examination</option>
                    <option value="PAYROLL">Payroll & Salary</option>
                    <option value="EVENT">Institution Event</option>
                  </select>
                </div>
              </div>

              {/* Target Audience */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Target Audience
                </label>
                <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setFormTargetType('ALL_TEACHERS')}
                    className={`py-2 text-xs font-medium rounded-lg transition-all ${
                      formTargetType === 'ALL_TEACHERS'
                        ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm font-semibold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    All Staff
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormTargetType('CLASS')}
                    className={`py-2 text-xs font-medium rounded-lg transition-all ${
                      formTargetType === 'CLASS'
                        ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm font-semibold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    Specific Class
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormTargetType('SPECIFIC_USTADHS')}
                    className={`py-2 text-xs font-medium rounded-lg transition-all ${
                      formTargetType === 'SPECIFIC_USTADHS'
                        ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm font-semibold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    Selected Ustadhs
                  </button>
                </div>
              </div>

              {/* Specific Class Dropdown */}
              {formTargetType === 'CLASS' && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Select Target Class *
                  </label>
                  <select
                    value={formTargetClassId}
                    onChange={(e) => setFormTargetClassId(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  >
                    <option value="">-- Choose Class --</option>
                    {classesList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.code ? `(${c.code})` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-400">
                    Delivered to Ustadhs currently scheduled to teach this class.
                  </p>
                </div>
              )}

              {/* Specific Ustadhs Multi-Select */}
              {formTargetType === 'SPECIFIC_USTADHS' && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      Select Ustadhs ({formTargetUstadhIds.length} chosen)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (formTargetUstadhIds.length === activeStaffList.length) {
                          setFormTargetUstadhIds([]);
                        } else {
                          setFormTargetUstadhIds(activeStaffList.map((u) => u.id));
                        }
                      }}
                      className="text-emerald-600 dark:text-emerald-400 hover:underline text-[11px]"
                    >
                      {formTargetUstadhIds.length === activeStaffList.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>

                  <input
                    type="text"
                    value={ustadhSearchInModal}
                    onChange={(e) => setUstadhSearchInModal(e.target.value)}
                    placeholder="Search teachers..."
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white mb-2"
                  />

                  <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                    {filteredModalStaff.map((u) => {
                      const isSelected = formTargetUstadhIds.includes(u.id);
                      return (
                        <div
                          key={u.id}
                          onClick={() => toggleUstadhSelection(u.id)}
                          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-xs transition-colors ${
                            isSelected
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                              : 'bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-transparent'
                          }`}
                        >
                          <div>
                            <span className="font-medium">{u.fullName}</span>
                            <span className="text-[11px] text-slate-400 ml-1.5 font-mono">({u.ustadhCode})</span>
                          </div>
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Message Content */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Notice Message *
                </label>
                <textarea
                  required
                  rows={4}
                  value={formMessage}
                  onChange={(e) => setFormMessage(e.target.value)}
                  placeholder="Enter detailed notice message for teachers..."
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              {/* Delivery Preview */}
              <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 rounded-xl flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Estimated delivery count:
                </span>
                <span className="font-bold">{recipientCountPreview} Recipient(s)</span>
              </div>

              {/* Modal Actions */}
              <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsComposeOpen(false)}
                  className="w-full sm:w-auto px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-medium text-sm rounded-xl shadow-sm transition-all disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Broadcasting...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Send Broadcast</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Read Receipts Drawer / Modal */}
      {isReceiptsOpen && selectedNoticeForReceipts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-xl animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Read Receipts Audit
                </span>
                <button
                  onClick={() => setIsReceiptsOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <h3 className="text-base font-bold text-slate-900 dark:text-white line-clamp-1">
                {selectedNoticeForReceipts.title}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {selectedNoticeForReceipts.stats.readCount} of {selectedNoticeForReceipts.stats.totalRecipients} read ({selectedNoticeForReceipts.stats.readRate}%)
              </p>

              {/* Tab Switcher */}
              <div className="grid grid-cols-2 gap-2 mt-4 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                <button
                  onClick={() => setReceiptsTab('READ')}
                  className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    receiptsTab === 'READ'
                      ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Read ({selectedNoticeForReceipts.stats.readBy.length})
                </button>
                <button
                  onClick={() => setReceiptsTab('UNREAD')}
                  className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    receiptsTab === 'UNREAD'
                      ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Unread ({selectedNoticeForReceipts.stats.unreadBy.length})
                </button>
              </div>
            </div>

            {/* Modal Body / Staff List */}
            <div className="p-4 overflow-y-auto space-y-2 flex-1">
              {receiptsTab === 'READ' ? (
                selectedNoticeForReceipts.stats.readBy.length === 0 ? (
                  <p className="text-center text-xs text-slate-400 py-8">
                    No teachers have read this notice yet.
                  </p>
                ) : (
                  selectedNoticeForReceipts.stats.readBy.map((user) => (
                    <div
                      key={user.ustadhId}
                      className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-xl text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-bold flex items-center justify-center text-xs">
                          {user.fullName.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {user.fullName}
                          </p>
                          <p className="text-[11px] text-slate-400 font-mono">
                            {user.ustadhCode}
                          </p>
                        </div>
                      </div>

                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        {user.readAt ? formatDate(user.readAt) : 'Read'}
                      </span>
                    </div>
                  ))
                )
              ) : selectedNoticeForReceipts.stats.unreadBy.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-900 dark:text-white">
                    100% Read Completion!
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Every targeted teacher has acknowledged this notice.
                  </p>
                </div>
              ) : (
                selectedNoticeForReceipts.stats.unreadBy.map((user) => (
                  <div
                    key={user.ustadhId}
                    className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-xl text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold flex items-center justify-center text-xs">
                        {user.fullName.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {user.fullName}
                        </p>
                        <p className="text-[11px] text-slate-400 font-mono">
                          {user.ustadhCode}
                        </p>
                      </div>
                    </div>

                    <span className="px-2 py-0.5 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 rounded-full text-[10px] font-medium border border-amber-200 dark:border-amber-900">
                      Pending Read
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setIsReceiptsOpen(false)}
                className="px-4 py-2 text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl"
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

export default StaffNoticesPage;
