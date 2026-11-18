import React, { useState, useEffect, useMemo } from 'react';
import {
  CalendarCheck,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  Save,
  AlertCircle,
  Loader2,
  TrendingUp,
  History as HistoryIcon,
  Info,
  Search,
  RotateCcw,
  Users,
  BookOpen,
  Layers,
  ChevronDown,
  ChevronUp,
  QrCode,
  UserCheck,
  GraduationCap,
  X,
} from 'lucide-react';
import {
  getStaffAttendance,
  saveStaffAttendance,
  getStaffAttendanceHistory,
  getMonthlyStaffAttendanceSummary,
  formatMinutesToTime,
  type StaffDailySessionItem,
  type StaffDailyAttendanceData,
  type StaffAttendanceHistoryItem,
  type MonthlyStaffAttendanceItem,
} from '../../services/ustadh.service';
import { formatDateOnly } from '../../utils/dateTime';

interface StaffAttendanceTabProps {
  ustadhsList: Array<{ id: string; fullName: string; ustadhCode: string; staffType?: any }>;
  classesList: Array<{ id: string; name: string; code?: string | null }>;
  refreshKey: number;
}

type SubTab = 'daily' | 'history' | 'monthly';

export const StaffAttendanceTab: React.FC<StaffAttendanceTabProps> = ({
  ustadhsList,
  classesList,
  refreshKey,
}) => {
  const [subTab, setSubTab] = useState<SubTab>('daily');

  // Daily Mode State
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [dailyData, setDailyData] = useState<StaffDailyAttendanceData | null>(null);
  const [sessions, setSessions] = useState<StaffDailySessionItem[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [loadingDaily, setLoadingDaily] = useState(false);
  const [savingDaily, setSavingDaily] = useState(false);
  const [dailyMessage, setDailyMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Daily Filters & View State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUstadhFilter, setSelectedUstadhFilter] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState('');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PRESENT' | 'ABSENT' | 'NOT_MARKED'>('ALL');
  const [viewMode, setViewMode] = useState<'by_ustadh' | 'by_class' | 'all'>('by_ustadh');

  // Accordion Collapsed Sets (default: all open)
  const [collapsedUstadhIds, setCollapsedUstadhIds] = useState<Set<string>>(new Set());
  const [collapsedClassIds, setCollapsedClassIds] = useState<Set<string>>(new Set());
  const [historyItems, setHistoryItems] = useState<StaffAttendanceHistoryItem[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyUstadhId, setHistoryUstadhId] = useState<string>('');
  const [historyClassId, setHistoryClassId] = useState<string>('');
  const [historyStartDate, setHistoryStartDate] = useState<string>('');
  const [historyEndDate, setHistoryEndDate] = useState<string>('');
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Monthly Mode State
  const currentMonthStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [monthlyUstadhId, setMonthlyUstadhId] = useState<string>('');
  const [monthlyItems, setMonthlyItems] = useState<MonthlyStaffAttendanceItem[]>([]);
  const [monthlyTotalRecords, setMonthlyTotalRecords] = useState(0);
  const [loadingMonthly, setLoadingMonthly] = useState(false);

  // ==========================================
  // DAILY ATTENDANCE LOGIC
  // ==========================================

  const fetchDaily = async (date: string) => {
    setLoadingDaily(true);
    setDailyMessage(null);
    setIsDirty(false);
    try {
      const data = await getStaffAttendance(date);
      setDailyData(data);
      setSessions(data.sessions);
    } catch (err: any) {
      setDailyMessage({
        type: 'error',
        text: err?.response?.data?.message || err.message || 'Failed to load staff attendance',
      });
    } finally {
      setLoadingDaily(false);
    }
  };

  useEffect(() => {
    if (subTab === 'daily') {
      fetchDaily(selectedDate);
    }
  }, [selectedDate, subTab, refreshKey]);

  const handleStatusChange = (scheduleId: string, newStatus: 'PRESENT' | 'ABSENT') => {
    setSessions((prev) =>
      prev.map((s) => (s.scheduleId === scheduleId ? { ...s, status: newStatus } : s))
    );
    setIsDirty(true);
  };

  const handleMarkAll = (status: 'PRESENT' | 'ABSENT') => {
    setSessions((prev) => prev.map((s) => ({ ...s, status })));
    setIsDirty(true);
  };

  const handleSaveAttendance = async () => {
    // Only persist sessions with explicit status
    const recordsToSave = sessions
      .filter((s) => s.status === 'PRESENT' || s.status === 'ABSENT')
      .map((s) => ({ scheduleId: s.scheduleId, status: s.status as 'PRESENT' | 'ABSENT' }));

    if (recordsToSave.length === 0) {
      setDailyMessage({
        type: 'error',
        text: 'Please mark at least one session as Present or Absent before saving.',
      });
      return;
    }

    setSavingDaily(true);
    setDailyMessage(null);
    try {
      const updated = await saveStaffAttendance({
        date: selectedDate,
        records: recordsToSave,
      });
      setDailyData(updated);
      setSessions(updated.sessions);
      setIsDirty(false);
      setDailyMessage({
        type: 'success',
        text: `Attendance saved successfully for ${recordsToSave.length} teaching session(s).`,
      });
    } catch (err: any) {
      setDailyMessage({
        type: 'error',
        text: err?.response?.data?.message || err.message || 'Failed to save attendance',
      });
    } finally {
      setSavingDaily(false);
    }
  };

  // Live calculation of summary from local state
  const totalCount = sessions.length;
  const presentCount = sessions.filter((s) => s.status === 'PRESENT').length;
  const absentCount = sessions.filter((s) => s.status === 'ABSENT').length;
  const notMarkedCount = sessions.filter((s) => !s.status).length;
  const rate = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

  // Dynamic Dropdown Lists from active sessions
  const availableUstadhs = useMemo(() => {
    const map = new Map<string, { id: string; name: string; code: string }>();
    for (const s of sessions) {
      if (s.ustadhId && !map.has(s.ustadhId)) {
        map.set(s.ustadhId, { id: s.ustadhId, name: s.ustadhName, code: s.ustadhCode });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [sessions]);

  const availableClasses = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    for (const s of sessions) {
      if (s.classId && !map.has(s.classId)) {
        map.set(s.classId, { id: s.classId, name: s.className });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [sessions]);

  const availableSubjects = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    for (const s of sessions) {
      if (s.subjectId && !map.has(s.subjectId)) {
        map.set(s.subjectId, { id: s.subjectId, name: s.subjectName });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [sessions]);

  // Filtered Sessions
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = s.ustadhName?.toLowerCase().includes(q);
        const matchCode = s.ustadhCode?.toLowerCase().includes(q);
        const matchClass = s.className?.toLowerCase().includes(q);
        const matchSubject = s.subjectName?.toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchClass && !matchSubject) return false;
      }
      if (selectedUstadhFilter && s.ustadhId !== selectedUstadhFilter) {
        return false;
      }
      if (selectedClassFilter && s.classId !== selectedClassFilter) {
        return false;
      }
      if (selectedSubjectFilter && s.subjectId !== selectedSubjectFilter) {
        return false;
      }
      if (statusFilter === 'PRESENT' && s.status !== 'PRESENT') {
        return false;
      }
      if (statusFilter === 'ABSENT' && s.status !== 'ABSENT') {
        return false;
      }
      if (statusFilter === 'NOT_MARKED' && s.status !== null) {
        return false;
      }
      return true;
    });
  }, [sessions, searchQuery, selectedUstadhFilter, selectedClassFilter, selectedSubjectFilter, statusFilter]);

  const hasActiveFilters = Boolean(
    searchQuery.trim() ||
    selectedUstadhFilter ||
    selectedClassFilter ||
    selectedSubjectFilter ||
    statusFilter !== 'ALL'
  );

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedUstadhFilter('');
    setSelectedClassFilter('');
    setSelectedSubjectFilter('');
    setStatusFilter('ALL');
  };

  // Grouped by Ustadh
  const ustadhGroups = useMemo(() => {
    const map = new Map<string, {
      ustadhId: string;
      ustadhName: string;
      ustadhCode: string;
      staffType?: string;
      phoneNumber?: string | null;
      whatsappNumber?: string | null;
      sessions: StaffDailySessionItem[];
    }>();

    for (const s of filteredSessions) {
      if (!map.has(s.ustadhId)) {
        map.set(s.ustadhId, {
          ustadhId: s.ustadhId,
          ustadhName: s.ustadhName,
          ustadhCode: s.ustadhCode,
          staffType: s.staffType,
          phoneNumber: s.phoneNumber,
          whatsappNumber: s.whatsappNumber,
          sessions: [],
        });
      }
      map.get(s.ustadhId)!.sessions.push(s);
    }

    return Array.from(map.values()).sort((a, b) => a.ustadhName.localeCompare(b.ustadhName));
  }, [filteredSessions]);

  // Grouped by Class
  const classGroups = useMemo(() => {
    const map = new Map<string, {
      classId: string;
      className: string;
      sessions: StaffDailySessionItem[];
    }>();

    for (const s of filteredSessions) {
      if (!map.has(s.classId)) {
        map.set(s.classId, {
          classId: s.classId,
          className: s.className,
          sessions: [],
        });
      }
      map.get(s.classId)!.sessions.push(s);
    }

    return Array.from(map.values()).sort((a, b) => a.className.localeCompare(b.className));
  }, [filteredSessions]);

  // Accordion toggle helpers
  const toggleUstadhCollapse = (ustadhId: string) => {
    setCollapsedUstadhIds((prev) => {
      const next = new Set(prev);
      if (next.has(ustadhId)) next.delete(ustadhId);
      else next.add(ustadhId);
      return next;
    });
  };

  const toggleClassCollapse = (classId: string) => {
    setCollapsedClassIds((prev) => {
      const next = new Set(prev);
      if (next.has(classId)) next.delete(classId);
      else next.add(classId);
      return next;
    });
  };

  const handleExpandAll = () => {
    if (viewMode === 'by_ustadh') {
      setCollapsedUstadhIds(new Set());
    } else if (viewMode === 'by_class') {
      setCollapsedClassIds(new Set());
    }
  };

  const handleCollapseAll = () => {
    if (viewMode === 'by_ustadh') {
      setCollapsedUstadhIds(new Set(ustadhGroups.map((g) => g.ustadhId)));
    } else if (viewMode === 'by_class') {
      setCollapsedClassIds(new Set(classGroups.map((g) => g.classId)));
    }
  };

  // Grouped mark all helpers
  const handleMarkUstadhAll = (ustadhId: string, status: 'PRESENT' | 'ABSENT') => {
    setSessions((prev) =>
      prev.map((s) => (s.ustadhId === ustadhId ? { ...s, status } : s))
    );
    setIsDirty(true);
  };

  const handleMarkClassAll = (classId: string, status: 'PRESENT' | 'ABSENT') => {
    setSessions((prev) =>
      prev.map((s) => (s.classId === classId ? { ...s, status } : s))
    );
    setIsDirty(true);
  };

  const renderVerificationPill = (s: StaffDailySessionItem) => {
    let timeStr: string | null = s.checkInTime || null;
    if (!timeStr && (s.markedAt || s.updatedAt || s.createdAt)) {
      try {
        const rawDate = new Date(s.markedAt || s.updatedAt || s.createdAt!);
        if (!isNaN(rawDate.getTime())) {
          timeStr = rawDate.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          });
        }
      } catch {}
    }

    const rawMethod = (s.checkInMethod || '').toUpperCase();
    const isQr = rawMethod.includes('QR');
    const isManual = rawMethod.includes('MANUAL');

    if (s.status === 'PRESENT') {
      if (isQr) {
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
            <QrCode className="w-3.5 h-3.5 text-emerald-600" />
            <span>QR Scanned{timeStr ? ` • ${timeStr}` : ''}</span>
          </span>
        );
      }
      if (isManual) {
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
            <UserCheck className="w-3.5 h-3.5 text-slate-500" />
            <span>Manual{timeStr ? ` • ${timeStr}` : ''}</span>
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>Present{timeStr ? ` • ${timeStr}` : ''}</span>
        </span>
      );
    }

    if (s.status === 'ABSENT') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 shrink-0">
          <XCircle className="w-3.5 h-3.5 text-rose-500" />
          <span>Absent</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
        <Clock className="w-3.5 h-3.5 text-amber-500" />
        <span>Not Marked</span>
      </span>
    );
  };

  const getUstadhCompletionBadge = (groupSessions: StaffDailySessionItem[]) => {
    const total = groupSessions.length;
    const present = groupSessions.filter((s) => s.status === 'PRESENT').length;
    const absent = groupSessions.filter((s) => s.status === 'ABSENT').length;
    const pending = groupSessions.filter((s) => !s.status).length;

    if (present === total && total > 0) {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 shrink-0">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>{total} / {total} Present</span>
        </span>
      );
    }

    if (pending > 0) {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1 shrink-0">
          <Clock className="w-3.5 h-3.5 text-amber-600" />
          <span>{present} / {total} Present • {pending} Pending</span>
        </span>
      );
    }

    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-300 flex items-center gap-1 shrink-0">
        <span>{present} / {total} Present • {absent} Absent</span>
      </span>
    );
  };

  const getClassCompletionBadge = (groupSessions: StaffDailySessionItem[]) => {
    const total = groupSessions.length;
    const present = groupSessions.filter((s) => s.status === 'PRESENT').length;
    const pending = groupSessions.filter((s) => !s.status).length;

    if (present === total && total > 0) {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 shrink-0">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>{total} / {total} Covered</span>
        </span>
      );
    }

    if (pending > 0) {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1 shrink-0">
          <Clock className="w-3.5 h-3.5 text-amber-600" />
          <span>{present} / {total} Covered • {pending} Pending</span>
        </span>
      );
    }

    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-300 flex items-center gap-1 shrink-0">
        <span>{present} / {total} Covered</span>
      </span>
    );
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await getStaffAttendanceHistory({
        ustadhId: historyUstadhId || undefined,
        classId: historyClassId || undefined,
        startDate: historyStartDate || undefined,
        endDate: historyEndDate || undefined,
        page: historyPage,
        pageSize: 20,
      });
      setHistoryItems(res.items);
      setHistoryTotal(res.total);
      setHistoryTotalPages(res.totalPages);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (subTab === 'history') {
      fetchHistory();
    }
  }, [subTab, historyPage, historyUstadhId, historyClassId, historyStartDate, historyEndDate]);

  // ==========================================
  // MONTHLY SUMMARY LOGIC
  // ==========================================

  const fetchMonthly = async () => {
    setLoadingMonthly(true);
    try {
      const res = await getMonthlyStaffAttendanceSummary(selectedMonth, monthlyUstadhId || undefined);
      setMonthlyItems(res.items);
      setMonthlyTotalRecords(res.totalRecords);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingMonthly(false);
    }
  };

  useEffect(() => {
    if (subTab === 'monthly') {
      fetchMonthly();
    }
  }, [subTab, selectedMonth, monthlyUstadhId]);

  return (
    <div className="space-y-6">
      {/* Sub-tab Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-1 overflow-x-auto max-w-full">
          <button
            type="button"
            onClick={() => setSubTab('daily')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'daily'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <CalendarCheck className="w-4 h-4" />
            <span>Daily Attendance</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('history')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'history'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <HistoryIcon className="w-4 h-4" />
            <span>Attendance History</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('monthly')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'monthly'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Monthly Analytics</span>
          </button>
        </div>

        {subTab === 'daily' && isDirty && (
          <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200 animate-pulse">
            <AlertCircle className="w-3.5 h-3.5" />
            <span className="font-medium">Unsaved changes</span>
          </div>
        )}
      </div>

      {/* ========================================== */}
      {/* 1. DAILY ATTENDANCE VIEW */}
      {/* ========================================== */}
      {subTab === 'daily' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-600" />
                <label className="text-sm font-medium text-slate-700">Date:</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              {dailyData?.weekday && (
                <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold">
                  {dailyData.weekday}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => handleMarkAll('PRESENT')}
                disabled={sessions.length === 0}
                className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-medium rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-50"
              >
                Mark All Present
              </button>
              <button
                type="button"
                onClick={() => handleMarkAll('ABSENT')}
                disabled={sessions.length === 0}
                className="px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 text-xs font-medium rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                Mark All Absent
              </button>
              <button
                type="button"
                onClick={handleSaveAttendance}
                disabled={savingDaily || sessions.length === 0 || !isDirty}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50"
              >
                {savingDaily ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>Save Attendance</span>
              </button>
            </div>
          </div>

          {/* Feedback message */}
          {dailyMessage && (
            <div
              className={`p-4 rounded-lg flex items-center gap-3 text-sm border ${
                dailyMessage.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}
            >
              {dailyMessage.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500" />
              )}
              <span>{dailyMessage.text}</span>
            </div>
          )}

          {/* Daily Metric KPI Cards (Clickable Filter Triggers) */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {/* Total Sessions */}
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                statusFilter === 'ALL'
                  ? 'bg-slate-50 border-slate-700 ring-2 ring-slate-800 shadow-xs'
                  : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">Total Sessions</span>
                {statusFilter === 'ALL' && (
                  <span className="w-2 h-2 rounded-full bg-slate-700" />
                )}
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{totalCount}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Click to view all</div>
            </button>

            {/* Present */}
            <button
              type="button"
              onClick={() => setStatusFilter((prev) => (prev === 'PRESENT' ? 'ALL' : 'PRESENT'))}
              className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                statusFilter === 'PRESENT'
                  ? 'bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-600 shadow-xs'
                  : 'bg-white border-slate-200 hover:border-emerald-300 shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-emerald-600 font-medium">Present</span>
                {statusFilter === 'PRESENT' && (
                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                )}
              </div>
              <div className="text-2xl font-bold text-emerald-700 mt-1">{presentCount}</div>
              <div className="text-[10px] text-emerald-600/80 mt-0.5">
                {statusFilter === 'PRESENT' ? 'Active filter' : 'Filter present'}
              </div>
            </button>

            {/* Absent */}
            <button
              type="button"
              onClick={() => setStatusFilter((prev) => (prev === 'ABSENT' ? 'ALL' : 'ABSENT'))}
              className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                statusFilter === 'ABSENT'
                  ? 'bg-rose-50/70 border-rose-500 ring-2 ring-rose-600 shadow-xs'
                  : 'bg-white border-slate-200 hover:border-rose-300 shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-red-600 font-medium">Absent</span>
                {statusFilter === 'ABSENT' && (
                  <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse" />
                )}
              </div>
              <div className="text-2xl font-bold text-red-700 mt-1">{absentCount}</div>
              <div className="text-[10px] text-red-600/80 mt-0.5">
                {statusFilter === 'ABSENT' ? 'Active filter' : 'Filter absent'}
              </div>
            </button>

            {/* Not Marked */}
            <button
              type="button"
              onClick={() => setStatusFilter((prev) => (prev === 'NOT_MARKED' ? 'ALL' : 'NOT_MARKED'))}
              className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                statusFilter === 'NOT_MARKED'
                  ? 'bg-amber-50/70 border-amber-500 ring-2 ring-amber-500 shadow-xs'
                  : 'bg-white border-slate-200 hover:border-amber-300 shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-amber-600 font-medium">Not Marked</span>
                {statusFilter === 'NOT_MARKED' && (
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                )}
              </div>
              <div className="text-2xl font-bold text-amber-700 mt-1">{notMarkedCount}</div>
              <div className="text-[10px] text-amber-600/80 mt-0.5">
                {statusFilter === 'NOT_MARKED' ? 'Active filter' : 'Filter pending'}
              </div>
            </button>

            {/* Attendance Rate */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs col-span-2 sm:col-span-1">
              <div className="text-xs text-slate-500 font-medium">Attendance Rate</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{rate}%</div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
                <div
                  className="bg-emerald-600 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${rate}%` }}
                />
              </div>
            </div>
          </div>

          {/* Smart Multi-Filter & Search Strip */}
          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Live Search Input */}
              <div className="relative flex-1 min-w-0">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter by Ustadh name or staff code (e.g. Safras, UST001)..."
                  className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg bg-slate-50/50 hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Reset Filters Pill */}
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-colors shrink-0 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Filters</span>
                </button>
              )}
            </div>

            {/* Dynamic Dropdowns Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Ustadh Dropdown */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Teacher / Ustadh
                </label>
                <select
                  value={selectedUstadhFilter}
                  onChange={(e) => setSelectedUstadhFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">All Ustadhs ({availableUstadhs.length})</option>
                  {availableUstadhs.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Class Dropdown */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Class
                </label>
                <select
                  value={selectedClassFilter}
                  onChange={(e) => setSelectedClassFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">All Classes ({availableClasses.length})</option>
                  {availableClasses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Subject Dropdown */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Subject
                </label>
                <select
                  value={selectedSubjectFilter}
                  onChange={(e) => setSelectedSubjectFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">All Subjects ({availableSubjects.length})</option>
                  {availableSubjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* View Mode Segmented Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200 shadow-xs">
            <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg self-start sm:self-auto overflow-x-auto max-w-full">
              <button
                type="button"
                onClick={() => setViewMode('by_ustadh')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  viewMode === 'by_ustadh'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Group by Ustadh</span>
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-700">
                  {ustadhGroups.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('by_class')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  viewMode === 'by_class'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Group by Class</span>
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-700">
                  {classGroups.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('all')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  viewMode === 'all'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>All Sessions</span>
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-700">
                  {filteredSessions.length}
                </span>
              </button>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3 text-xs text-slate-500">
              <span>
                Showing <strong className="text-slate-800">{filteredSessions.length}</strong> of{' '}
                <strong>{sessions.length}</strong> session(s)
              </span>

              {viewMode !== 'all' && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleExpandAll}
                    className="px-2 py-1 text-[11px] font-medium text-slate-600 hover:text-emerald-700 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                  >
                    Expand All
                  </button>
                  <span className="text-slate-300">•</span>
                  <button
                    type="button"
                    onClick={handleCollapseAll}
                    className="px-2 py-1 text-[11px] font-medium text-slate-600 hover:text-emerald-700 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                  >
                    Collapse All
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Main Sessions Container */}
          {loadingDaily ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400 shadow-xs">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-600 mb-2" />
              <span>Loading daily sessions...</span>
            </div>
          ) : sessions.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500 shadow-xs">
              No teaching sessions scheduled for this day ({dailyData?.weekday || 'Selected Date'}).
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-3 shadow-xs">
              <p className="text-sm text-slate-500">No sessions match your active filters.</p>
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Filters</span>
              </button>
            </div>
          ) : viewMode === 'by_ustadh' ? (
            /* VIEW 1: GROUP BY USTADH (Collapsible Accordion Cards) */
            <div className="space-y-4">
              {ustadhGroups.map((group) => {
                const isCollapsed = collapsedUstadhIds.has(group.ustadhId);
                return (
                  <div
                    key={group.ustadhId}
                    className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden transition-all"
                  >
                    {/* Header Card */}
                    <div
                      onClick={() => toggleUstadhCollapse(group.ustadhId)}
                      className="p-3.5 sm:p-4 bg-slate-50/70 hover:bg-slate-100/70 cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 select-none"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-sm shrink-0 border border-emerald-200">
                          {group.ustadhName.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-sm sm:text-base text-slate-900 truncate">
                              {group.ustadhName}
                            </h3>
                            <span className="text-xs font-mono font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              {group.ustadhCode}
                            </span>
                            {group.staffType && (
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase ${
                                  group.staffType === 'SCHOOL_TEACHER'
                                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                }`}
                              >
                                {group.staffType === 'SCHOOL_TEACHER' ? 'Teacher' : 'Ustadh'}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {group.sessions.length} period session(s) scheduled today
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-2.5 w-full sm:w-auto">
                        {getUstadhCompletionBadge(group.sessions)}

                        {/* Quick Mark Actions for this Ustadh */}
                        <div
                          className="flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => handleMarkUstadhAll(group.ustadhId, 'PRESENT')}
                            title="Mark all sessions for this Ustadh as Present"
                            className="px-2 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 transition-colors cursor-pointer"
                          >
                            All Present
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMarkUstadhAll(group.ustadhId, 'ABSENT')}
                            title="Mark all sessions for this Ustadh as Absent"
                            className="px-2 py-1 text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded border border-rose-200 transition-colors cursor-pointer"
                          >
                            All Absent
                          </button>
                        </div>

                        {/* Accordion Chevron */}
                        <div className="text-slate-400 hover:text-slate-600 p-1">
                          {isCollapsed ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronUp className="w-4 h-4" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Collapsible Content */}
                    {!isCollapsed && (
                      <div className="p-3 sm:p-4 space-y-2.5 bg-white">
                        {group.sessions.map((s) => (
                          <div
                            key={s.scheduleId}
                            className="p-3 sm:p-3.5 bg-slate-50/70 hover:bg-slate-50 rounded-xl border border-slate-200/80 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                          >
                            <div className="flex flex-wrap items-center gap-2 sm:gap-3 min-w-0">
                              {/* Time Slot */}
                              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-xs">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                <span>
                                  {formatMinutesToTime(s.startMinutes)} – {formatMinutesToTime(s.endMinutes)}
                                </span>
                              </div>

                              {/* Class Badge */}
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-teal-50 text-teal-800 border border-teal-200">
                                <BookOpen className="w-3 h-3 text-teal-600" />
                                <span>{s.className}</span>
                              </span>

                              {/* Subject Badge */}
                              <span className="text-xs font-medium text-slate-800 bg-white px-2.5 py-1 rounded-lg border border-slate-200/70">
                                {s.subjectName}
                              </span>
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-2.5 w-full sm:w-auto">
                              {renderVerificationPill(s)}

                              {/* Status Toggle Buttons */}
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleStatusChange(s.scheduleId, 'PRESENT')}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                                    s.status === 'PRESENT'
                                      ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-600/30'
                                      : 'bg-white text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200'
                                  }`}
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Present</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleStatusChange(s.scheduleId, 'ABSENT')}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                                    s.status === 'ABSENT'
                                      ? 'bg-rose-600 text-white shadow-xs ring-2 ring-rose-600/30'
                                      : 'bg-white text-slate-600 hover:bg-rose-50 hover:text-rose-700 border border-slate-200'
                                  }`}
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>Absent</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : viewMode === 'by_class' ? (
            /* VIEW 2: GROUP BY CLASS (Collapsible Class Cards) */
            <div className="space-y-4">
              {classGroups.map((group) => {
                const isCollapsed = collapsedClassIds.has(group.classId);
                return (
                  <div
                    key={group.classId}
                    className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden transition-all"
                  >
                    {/* Header Card */}
                    <div
                      onClick={() => toggleClassCollapse(group.classId)}
                      className="p-3.5 sm:p-4 bg-slate-50/70 hover:bg-slate-100/70 cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 select-none"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-800 font-bold flex items-center justify-center shrink-0 border border-teal-200">
                          <GraduationCap className="w-5 h-5 text-teal-700" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-sm sm:text-base text-slate-900 truncate">
                            {group.className}
                          </h3>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {group.sessions.length} class period session(s) scheduled today
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-2.5 w-full sm:w-auto">
                        {getClassCompletionBadge(group.sessions)}

                        {/* Quick Mark Actions for this Class */}
                        <div
                          className="flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => handleMarkClassAll(group.classId, 'PRESENT')}
                            title="Mark all sessions for this Class as Present"
                            className="px-2 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 transition-colors cursor-pointer"
                          >
                            All Present
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMarkClassAll(group.classId, 'ABSENT')}
                            title="Mark all sessions for this Class as Absent"
                            className="px-2 py-1 text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded border border-rose-200 transition-colors cursor-pointer"
                          >
                            All Absent
                          </button>
                        </div>

                        {/* Accordion Chevron */}
                        <div className="text-slate-400 hover:text-slate-600 p-1">
                          {isCollapsed ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronUp className="w-4 h-4" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Collapsible Content */}
                    {!isCollapsed && (
                      <div className="p-3 sm:p-4 space-y-2.5 bg-white">
                        {group.sessions.map((s) => (
                          <div
                            key={s.scheduleId}
                            className="p-3 sm:p-3.5 bg-slate-50/70 hover:bg-slate-50 rounded-xl border border-slate-200/80 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                          >
                            <div className="flex flex-wrap items-center gap-2 sm:gap-3 min-w-0">
                              {/* Time Slot */}
                              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-xs">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                <span>
                                  {formatMinutesToTime(s.startMinutes)} – {formatMinutesToTime(s.endMinutes)}
                                </span>
                              </div>

                              {/* Ustadh Info */}
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs shrink-0">
                                  {s.ustadhName.slice(0, 2).toUpperCase()}
                                </div>
                                <span className="font-semibold text-xs text-slate-900">
                                  {s.ustadhName}
                                </span>
                                <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                  {s.ustadhCode}
                                </span>
                              </div>

                              {/* Subject Badge */}
                              <span className="text-xs font-medium text-slate-800 bg-white px-2.5 py-1 rounded-lg border border-slate-200/70">
                                {s.subjectName}
                              </span>
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-2.5 w-full sm:w-auto">
                              {renderVerificationPill(s)}

                              {/* Status Toggle Buttons */}
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleStatusChange(s.scheduleId, 'PRESENT')}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                                    s.status === 'PRESENT'
                                      ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-600/30'
                                      : 'bg-white text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200'
                                  }`}
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Present</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleStatusChange(s.scheduleId, 'ABSENT')}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                                    s.status === 'ABSENT'
                                      ? 'bg-rose-600 text-white shadow-xs ring-2 ring-rose-600/30'
                                      : 'bg-white text-slate-600 hover:bg-rose-50 hover:text-rose-700 border border-slate-200'
                                  }`}
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>Absent</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* VIEW 3: ALL SESSIONS (Desktop Table + Mobile Responsive Cards) */
            <div className="space-y-3">
              {/* Desktop Table View (hidden on mobile) */}
              <div className="hidden sm:block bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-700">
                    <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="py-3.5 px-4">Staff Member</th>
                        <th className="py-3.5 px-4">Class</th>
                        <th className="py-3.5 px-4">Subject</th>
                        <th className="py-3.5 px-4">Time Slot</th>
                        <th className="py-3.5 px-4">Verification</th>
                        <th className="py-3.5 px-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredSessions.map((s) => (
                        <tr key={s.scheduleId} className="hover:bg-slate-50/75 transition-colors">
                          {/* Staff Member */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs shrink-0">
                                {s.ustadhName.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-semibold text-slate-900">{s.ustadhName}</span>
                                  {s.staffType && (
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase ${
                                        s.staffType === 'SCHOOL_TEACHER'
                                          ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      }`}
                                    >
                                      {s.staffType === 'SCHOOL_TEACHER' ? 'Teacher' : 'Ustadh'}
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs font-mono text-emerald-700">{s.ustadhCode}</div>
                              </div>
                            </div>
                          </td>

                          {/* Class */}
                          <td className="py-3.5 px-4 text-slate-800 font-medium">
                            {s.className}
                          </td>

                          {/* Subject */}
                          <td className="py-3.5 px-4 text-slate-600">
                            {s.subjectName}
                          </td>

                          {/* Time Slot */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5 text-xs text-slate-700">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              <span>
                                {formatMinutesToTime(s.startMinutes)} – {formatMinutesToTime(s.endMinutes)}
                              </span>
                            </div>
                          </td>

                          {/* Verification */}
                          <td className="py-3.5 px-4">
                            {renderVerificationPill(s)}
                          </td>

                          {/* Status Actions */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleStatusChange(s.scheduleId, 'PRESENT')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                                  s.status === 'PRESENT'
                                    ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-600/20'
                                    : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
                                }`}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Present</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleStatusChange(s.scheduleId, 'ABSENT')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                                  s.status === 'ABSENT'
                                    ? 'bg-red-600 text-white shadow-xs ring-2 ring-red-600/20'
                                    : 'bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-700'
                                }`}
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Absent</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile Stacked Cards View (hidden on sm+) */}
              <div className="sm:hidden space-y-3">
                {filteredSessions.map((s) => (
                  <div
                    key={s.scheduleId}
                    className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-3"
                  >
                    {/* Top Row: Teacher & Class */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs shrink-0">
                          {s.ustadhName.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-xs text-slate-900 truncate">
                            {s.ustadhName}
                          </div>
                          <div className="text-[11px] font-mono text-emerald-700">
                            {s.ustadhCode}
                          </div>
                        </div>
                      </div>

                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-teal-50 text-teal-800 border border-teal-200 shrink-0">
                        {s.className}
                      </span>
                    </div>

                    {/* Middle Row: Subject & Time */}
                    <div className="flex items-center justify-between text-xs text-slate-600 pt-2 border-t border-slate-100">
                      <span className="font-medium text-slate-800 truncate mr-2">
                        {s.subjectName}
                      </span>
                      <div className="flex items-center gap-1 shrink-0 text-slate-500 font-medium">
                        <Clock className="w-3 h-3" />
                        <span>
                          {formatMinutesToTime(s.startMinutes)} – {formatMinutesToTime(s.endMinutes)}
                        </span>
                      </div>
                    </div>

                    {/* Bottom Row: Verification Pill & Action Buttons */}
                    <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          Status
                        </span>
                        {renderVerificationPill(s)}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => handleStatusChange(s.scheduleId, 'PRESENT')}
                          className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            s.status === 'PRESENT'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-emerald-50'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Present</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStatusChange(s.scheduleId, 'ABSENT')}
                          className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            s.status === 'ABSENT'
                              ? 'bg-rose-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-rose-50'
                          }`}
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Absent</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================== */}
      {/* 2. ATTENDANCE HISTORY VIEW */}
      {/* ========================================== */}
      {subTab === 'history' && (
        <div className="space-y-6">
          {/* History Filters */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Teacher / Ustadh</label>
                <select
                  value={historyUstadhId}
                  onChange={(e) => {
                    setHistoryUstadhId(e.target.value);
                    setHistoryPage(1);
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  <option value="">All Teachers & Ustadhs</option>
                  {ustadhsList.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} ({u.ustadhCode}){u.staffType === 'SCHOOL_TEACHER' ? ' — Teacher' : ' — Ustadh'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Class</label>
                <select
                  value={historyClassId}
                  onChange={(e) => {
                    setHistoryClassId(e.target.value);
                    setHistoryPage(1);
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  <option value="">All Classes</option>
                  {classesList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">From Date</label>
                <input
                  type="date"
                  value={historyStartDate}
                  onChange={(e) => {
                    setHistoryStartDate(e.target.value);
                    setHistoryPage(1);
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">To Date</label>
                <input
                  type="date"
                  value={historyEndDate}
                  onChange={(e) => {
                    setHistoryEndDate(e.target.value);
                    setHistoryPage(1);
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                />
              </div>
            </div>
          </div>

          {/* History Records Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4">Date</th>
                    <th className="py-3.5 px-4">Ustadh</th>
                    <th className="py-3.5 px-4">Class & Subject</th>
                    <th className="py-3.5 px-4">Slot</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Recorded At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingHistory ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-600 mb-2" />
                        <span>Loading attendance history...</span>
                      </td>
                    </tr>
                  ) : historyItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-500">
                        No saved attendance records found.
                      </td>
                    </tr>
                  ) : (
                    historyItems.map((h) => (
                      <tr key={h.id} className="hover:bg-slate-50/75 transition-colors">
                        <td className="py-3.5 px-4 font-medium text-slate-900">
                          {formatDateOnly(h.date)}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900">{h.ustadh.fullName}</div>
                          <div className="text-xs font-mono text-emerald-700">{h.ustadh.ustadhCode}</div>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-700">
                          <div className="font-medium">{h.schedule.class.name}</div>
                          <div className="text-slate-500">{h.schedule.subject.name}</div>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-600">
                          {formatMinutesToTime(h.schedule.startMinutes)} – {formatMinutesToTime(h.schedule.endMinutes)}
                        </td>
                        <td className="py-3.5 px-4">
                          {h.status === 'PRESENT' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Present</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                              <XCircle className="w-3 h-3" />
                              <span>Absent</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-400">
                          {new Date(h.updatedAt).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {historyTotalPages > 1 && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 border-t border-slate-200 bg-slate-50 text-xs text-slate-600">
                <div>
                  Showing {historyItems.length} of {historyTotal} records
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={historyPage <= 1}
                    onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                    className="px-2.5 py-1 bg-white border border-slate-200 rounded disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="px-2 font-medium">
                    {historyPage} / {historyTotalPages}
                  </span>
                  <button
                    type="button"
                    disabled={historyPage >= historyTotalPages}
                    onClick={() => setHistoryPage((p) => Math.min(historyTotalPages, p + 1))}
                    className="px-2.5 py-1 bg-white border border-slate-200 rounded disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* 3. MONTHLY SUMMARY VIEW */}
      {/* ========================================== */}
      {subTab === 'monthly' && (
        <div className="space-y-6">
          {/* Informational Banner */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3 text-blue-900 text-xs leading-relaxed">
            <Info className="w-5 h-5 flex-shrink-0 text-blue-600 mt-0.5" />
            <div>
              <span className="font-bold">Informational Attendance Policy:</span> Staff attendance (Ustadhs & School Teachers) is tracked for management, class continuity, and supervision. Base monthly salaries are fixed and are NOT automatically deducted for absences. Any salary deduction or bonus must be manually adjusted with a mandatory recorded reason.
            </div>
          </div>

          {/* Monthly Filter */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <label className="text-xs font-semibold text-slate-700">Month:</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white"
              />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto min-w-0">
              <label className="text-xs font-semibold text-slate-700 shrink-0">Teacher / Ustadh:</label>
              <select
                value={monthlyUstadhId}
                onChange={(e) => setMonthlyUstadhId(e.target.value)}
                className="w-full sm:w-auto sm:max-w-xs min-w-0 px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white"
              >
                <option value="">All Staff</option>
                {ustadhsList.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName} ({u.ustadhCode}){u.staffType === 'SCHOOL_TEACHER' ? ' — Teacher' : ' — Ustadh'}
                  </option>
                ))}
              </select>
            </div>
            {monthlyTotalRecords > 0 && (
              <span className="text-xs px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg font-medium">
                Total Sessions: {monthlyTotalRecords}
              </span>
            )}
          </div>

          {/* Monthly Summary Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4">Ustadh</th>
                    <th className="py-3.5 px-4">Recorded Sessions</th>
                    <th className="py-3.5 px-4">Present</th>
                    <th className="py-3.5 px-4">Absent</th>
                    <th className="py-3.5 px-4">Attendance Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingMonthly ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-600 mb-2" />
                        <span>Calculating monthly attendance...</span>
                      </td>
                    </tr>
                  ) : monthlyItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-500">
                        No recorded attendance sessions found for {selectedMonth}.
                      </td>
                    </tr>
                  ) : (
                    monthlyItems.map((m) => (
                      <tr key={m.ustadhId} className="hover:bg-slate-50/75 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900">{m.ustadhName}</div>
                          <div className="text-xs font-mono text-emerald-700">{m.ustadhCode}</div>
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-700">
                          {m.recordedSessions}
                        </td>
                        <td className="py-3.5 px-4 text-emerald-700 font-semibold">
                          {m.presentSessions}
                        </td>
                        <td className="py-3.5 px-4 text-red-700 font-semibold">
                          {m.absentSessions}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-slate-200 rounded-full h-2 overflow-hidden">
                              <div
                                className="bg-emerald-600 h-2 rounded-full"
                                style={{ width: `${m.attendancePercentage}%` }}
                              />
                            </div>
                            <span className="font-semibold text-slate-900 text-xs">
                              {m.attendancePercentage}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
