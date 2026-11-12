import React, { useState, useEffect } from 'react';
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

  // History Mode State
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

  // ==========================================
  // HISTORY LOGIC
  // ==========================================

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

          {/* Daily Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-xs text-slate-500 font-medium">Total Sessions</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{totalCount}</div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-xs text-emerald-600 font-medium">Present</div>
              <div className="text-2xl font-bold text-emerald-700 mt-1">{presentCount}</div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-xs text-red-600 font-medium">Absent</div>
              <div className="text-2xl font-bold text-red-700 mt-1">{absentCount}</div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-xs text-amber-600 font-medium">Not Marked</div>
              <div className="text-2xl font-bold text-amber-700 mt-1">{notMarkedCount}</div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm col-span-2 sm:col-span-1">
              <div className="text-xs text-slate-500 font-medium">Attendance Rate</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{rate}%</div>
            </div>
          </div>

          {/* Daily Session Roster Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4">Staff Member</th>
                    <th className="py-3.5 px-4">Class</th>
                    <th className="py-3.5 px-4">Subject</th>
                    <th className="py-3.5 px-4">Time Slot</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingDaily ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-600 mb-2" />
                        <span>Loading daily sessions...</span>
                      </td>
                    </tr>
                  ) : sessions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-500">
                        No teaching sessions scheduled for this day ({dailyData?.weekday || 'Selected Date'}).
                      </td>
                    </tr>
                  ) : (
                    sessions.map((s) => (
                      <tr key={s.scheduleId} className="hover:bg-slate-50/75 transition-colors">
                        {/* Ustadh */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs flex-shrink-0">
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

                        {/* Status Buttons */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleStatusChange(s.scheduleId, 'PRESENT')}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                                s.status === 'PRESENT'
                                  ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-600/20'
                                  : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
                              }`}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Present</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStatusChange(s.scheduleId, 'ABSENT')}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                                s.status === 'ABSENT'
                                  ? 'bg-red-600 text-white shadow-sm ring-2 ring-red-600/20'
                                  : 'bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-700'
                              }`}
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Absent</span>
                            </button>
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
