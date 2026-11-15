import React, { useState, useEffect, useCallback } from 'react';
import {
  History,
  RotateCcw,
  LogIn,
  LogOut,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Info,
  Loader2,
  GraduationCap,
  Home,
} from 'lucide-react';
import {
  apiGetGateEvents,
  type GateEventItem,
  type GateEventType,
  type GateEmailStatus,
  type GateEventsPagination,
} from '../../services/gate.service';

export const GateEventsTab: React.FC = () => {
  // Query Filters State
  const [directionFilter, setDirectionFilter] = useState<'ALL' | GateEventType>('ALL');
  const [emailStatusFilter, setEmailStatusFilter] = useState<'ALL' | GateEmailStatus>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [studentSearch, setStudentSearch] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // Data & State
  const [events, setEvents] = useState<GateEventItem[]>([]);
  const [pagination, setPagination] = useState<GateEventsPagination>({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /**
   * Fetches gate events from backend API
   */
  const loadEvents = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const queryParams: any = {
        page: currentPage,
        limit: pageSize,
      };

      if (directionFilter !== 'ALL') {
        queryParams.eventType = directionFilter;
      }
      if (emailStatusFilter !== 'ALL') {
        queryParams.emailStatus = emailStatusFilter;
      }
      if (dateFilter) {
        queryParams.date = dateFilter;
      }
      if (studentSearch.trim()) {
        queryParams.studentId = studentSearch.trim();
      }

      const response = await apiGetGateEvents(queryParams);

      if (response.success && response.data) {
        setEvents(response.data.events || []);
        setPagination(response.data.pagination);
      }
    } catch (err: any) {
      console.error('Failed to load gate events:', err);
      setErrorMessage(
        err.response?.data?.message || err.message || 'Failed to load gate movement history.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, pageSize, directionFilter, emailStatusFilter, dateFilter, studentSearch]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  /**
   * Reset all filters
   */
  const handleClearFilters = () => {
    setDirectionFilter('ALL');
    setEmailStatusFilter('ALL');
    setDateFilter('');
    setStudentSearch('');
    setCurrentPage(1);
  };

  /**
   * Render badge for email status
   */
  const renderEmailStatusBadge = (status: GateEmailStatus, skipReason?: string | null) => {
    switch (status) {
      case 'SENT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5" /> Sent
          </span>
        );
      case 'QUEUED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
            <Clock className="w-3.5 h-3.5" /> Queued
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
            <XCircle className="w-3.5 h-3.5" /> Failed
          </span>
        );
      case 'SKIPPED_NO_RECIPIENT':
        return (
          <span
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200"
            title="Student has no registered guardian email address"
          >
            <AlertTriangle className="w-3.5 h-3.5" /> No Email
          </span>
        );
      case 'NOT_APPLICABLE':
      default:
        return (
          <span
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-stone-100 text-stone-600"
            title={skipReason || 'Notification not applicable'}
          >
            <Info className="w-3.5 h-3.5" /> Exempt
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* ============================================================== */}
      {/* 1. FILTER CONTROLS BAR */}
      {/* ============================================================== */}
      <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-stone-100">
          <div>
            <h3 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <History className="w-5 h-5 text-emerald-600" />
              Gate Movement & Audit History
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Comprehensive log of all student entries, exits, and parent email notifications.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => loadEvents()}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-200 bg-white text-xs font-semibold text-stone-700 hover:bg-stone-50 transition-colors"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-200 bg-white text-xs font-semibold text-stone-500 hover:text-stone-800 hover:bg-stone-50 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>

        {/* Filter Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-4">
          {/* Direction Filter */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-stone-500 block mb-1">
              Movement Direction
            </label>
            <select
              value={directionFilter}
              onChange={(e) => {
                setDirectionFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="w-full text-xs rounded-xl border border-stone-200 bg-stone-50/50 p-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              <option value="ALL">All Directions (Entry & Exit)</option>
              <option value="ENTRY">ENTRY (Check In)</option>
              <option value="EXIT">EXIT (Check Out)</option>
            </select>
          </div>

          {/* Email Status Filter */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-stone-500 block mb-1">
              Email Notification Status
            </label>
            <select
              value={emailStatusFilter}
              onChange={(e) => {
                setEmailStatusFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="w-full text-xs rounded-xl border border-stone-200 bg-stone-50/50 p-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              <option value="ALL">All Email Statuses</option>
              <option value="QUEUED">QUEUED (Pending dispatch)</option>
              <option value="PROCESSING">PROCESSING (In-flight)</option>
              <option value="SENT">SENT (Delivered)</option>
              <option value="FAILED">FAILED (Delivery failed)</option>
              <option value="SKIPPED_NO_RECIPIENT">SKIPPED (No guardian email)</option>
              <option value="NOT_APPLICABLE">EXEMPT (Boarding / Disabled)</option>
            </select>
          </div>

          {/* Date Picker Filter */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-stone-500 block mb-1">
              Calendar Date
            </label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full text-xs rounded-xl border border-stone-200 bg-stone-50/50 p-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          {/* Page Size Selector */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-stone-500 block mb-1">
              Rows Per Page
            </label>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="w-full text-xs rounded-xl border border-stone-200 bg-stone-50/50 p-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              <option value="10">10 entries</option>
              <option value="20">20 entries</option>
              <option value="50">50 entries</option>
            </select>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. ERROR DISPLAY */}
      {/* ============================================================== */}
      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl p-4 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => loadEvents()}
            className="px-3 py-1 bg-rose-600 text-white rounded-lg font-semibold hover:bg-rose-700 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* ============================================================== */}
      {/* 3. EVENTS TABLE / CARDS */}
      {/* ============================================================== */}
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-stone-400 flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
            <span className="text-sm font-medium">Loading gate movement logs...</span>
          </div>
        ) : events.length === 0 ? (
          <div className="p-12 text-center text-stone-400">
            <History className="w-10 h-10 mx-auto mb-2 text-stone-300" />
            <h4 className="text-sm font-semibold text-stone-600">No Gate Events Found</h4>
            <p className="text-xs text-stone-400 mt-1 max-w-sm mx-auto">
              No movement events match the selected filters. Clear filters or record new scans using the
              Smart Gate Scanner.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 border-b border-stone-200/80 text-[11px] font-bold uppercase text-stone-500">
                  <tr>
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Class</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Direction</th>
                    <th className="py-3 px-4">Scanned Time</th>
                    <th className="py-3 px-4">Operator</th>
                    <th className="py-3 px-4">Parent Notification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {events.map((ev) => (
                    <tr key={ev.id} className="hover:bg-stone-50/50 transition-colors">
                      {/* Student Info */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{ev.student.fullName}</div>
                        <div className="text-[11px] text-stone-400 font-mono">
                          {ev.student.admissionNo}
                        </div>
                      </td>

                      {/* Class */}
                      <td className="py-3 px-4 text-stone-600">
                        {ev.student.class?.name || (
                          <span className="text-stone-400 italic">Unassigned</span>
                        )}
                      </td>

                      {/* Student Category */}
                      <td className="py-3 px-4">
                        {ev.category === 'DAY_SCHOLAR' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-700">
                            <GraduationCap className="w-3.5 h-3.5" /> Day Scholar
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-cyan-800">
                            <Home className="w-3.5 h-3.5" /> Boarding
                          </span>
                        )}
                      </td>

                      {/* Direction */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            ev.eventType === 'ENTRY'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {ev.eventType === 'ENTRY' ? (
                            <LogIn className="w-3.5 h-3.5" />
                          ) : (
                            <LogOut className="w-3.5 h-3.5" />
                          )}
                          {ev.eventType}
                        </span>
                      </td>

                      {/* Scanned Time */}
                      <td className="py-3 px-4 text-stone-600">
                        <div>
                          {new Date(ev.scannedAt).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </div>
                        <div className="text-[11px] text-stone-400">
                          {new Date(ev.scannedAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </div>
                      </td>

                      {/* Operator */}
                      <td className="py-3 px-4 text-stone-500">
                        {ev.recordedByUser?.name || 'Gate Operator'}
                      </td>

                      {/* Parent Email Status */}
                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          {renderEmailStatusBadge(ev.emailStatus, ev.emailSkipReason)}
                          {ev.emailSkipReason && (
                            <div className="text-[10px] text-stone-400 font-mono">
                              {ev.emailSkipReason}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="md:hidden divide-y divide-stone-100">
              {events.map((ev) => (
                <div key={ev.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900 text-sm">{ev.student.fullName}</div>
                      <div className="text-xs text-stone-400 font-mono">{ev.student.admissionNo}</div>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        ev.eventType === 'ENTRY'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {ev.eventType}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-stone-500 pt-1">
                    <span>
                      {new Date(ev.scannedAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {' - '}
                      {new Date(ev.scannedAt).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    <div>{renderEmailStatusBadge(ev.emailStatus, ev.emailSkipReason)}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between p-4 bg-stone-50/50 border-t border-stone-200/80 text-xs">
              <span className="text-stone-500 font-medium">
                Showing{' '}
                <strong>
                  {pagination.total > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0}
                </strong>{' '}
                to{' '}
                <strong>
                  {Math.min(pagination.page * pagination.limit, pagination.total)}
                </strong>{' '}
                of <strong>{pagination.total}</strong> events
              </span>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={pagination.page <= 1 || isLoading}
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  className="p-1.5 rounded-lg border border-stone-200 bg-white text-stone-600 disabled:opacity-40 hover:bg-stone-50 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2 font-semibold text-slate-700">
                  Page {pagination.page} of {pagination.totalPages || 1}
                </span>
                <button
                  type="button"
                  disabled={pagination.page >= pagination.totalPages || isLoading}
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, pagination.totalPages))}
                  className="p-1.5 rounded-lg border border-stone-200 bg-white text-stone-600 disabled:opacity-40 hover:bg-stone-50 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
