import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Loader2,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
} from 'lucide-react';
import {
  getAttendanceHistory,
  type AttendanceHistoryItem,
} from '../../services/attendance.service';

interface AttendanceHistoryTabProps {
  classId: string;
  academicYear: string;
  onSelectDate: (date: string) => void;
}

export const AttendanceHistoryTab: React.FC<AttendanceHistoryTabProps> = ({
  classId,
  academicYear,
  onSelectDate,
}) => {
  const [items, setItems] = useState<AttendanceHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const loadHistory = useCallback(async () => {
    if (!classId) return;
    try {
      setIsLoading(true);
      const res = await getAttendanceHistory({
        classId,
        academicYear: academicYear || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page,
        pageSize: 20,
      });
      setItems(res.items);
      setTotalPages(res.totalPages);
      setTotalItems(res.total);
    } catch (err) {
      console.error('Failed to load attendance history', err);
    } finally {
      setIsLoading(false);
    }
  }, [classId, academicYear, startDate, endDate, page]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  return (
    <div className="bg-white rounded-2xl border border-stone-200/80 shadow-xs overflow-hidden">
      {/* Filter Bar */}
      <div className="p-4 sm:p-5 border-b border-stone-200/80 bg-stone-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-stone-900">Attendance Session History</h3>
          <p className="text-xs text-stone-500">Review and re-open previously recorded class sessions</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Start Date */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-stone-500 font-medium">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-xs text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          {/* End Date */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-stone-500 font-medium">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-xs text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          {(startDate || endDate) && (
            <button
              type="button"
              onClick={() => {
                setStartDate('');
                setEndDate('');
                setPage(1);
              }}
              className="px-2.5 py-1.5 text-xs text-stone-500 hover:text-stone-800 underline font-medium"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-stone-50/80 border-b border-stone-200/80 text-stone-500 font-semibold uppercase tracking-wider whitespace-nowrap">
              <th className="py-3 px-4">Date</th>
              <th className="py-3 px-4">Academic Year</th>
              <th className="py-3 px-4 text-center">Total Students</th>
              <th className="py-3 px-4 text-center">Present</th>
              <th className="py-3 px-4 text-center">Absent</th>
              <th className="py-3 px-4 text-center">Attendance Rate</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-stone-400">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                    <span>Loading history...</span>
                  </div>
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-stone-400">
                  <div className="flex flex-col items-center justify-center">
                    <Calendar className="w-8 h-8 text-stone-300 mb-2" />
                    <span>No attendance sessions recorded for this filter.</span>
                  </div>
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="hover:bg-stone-50/60 transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-stone-900 flex items-center gap-2">
                    <CalendarCheck className="w-4 h-4 text-emerald-600" />
                    <span>{item.date}</span>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-stone-600">{item.academicYear}</td>
                  <td className="py-3.5 px-4 text-center font-semibold text-stone-800">
                    {item.totalStudents}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {item.presentCount}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                      {item.absentCount}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-center font-bold text-stone-900">
                    {item.attendanceRate.toFixed(1)}%
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => onSelectDate(item.date)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-semibold transition-all"
                    >
                      <span>Open Session</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="p-4 border-t border-stone-200/80 bg-stone-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-stone-500">
          <div>
            Total {totalItems} recorded session{totalItems > 1 ? 's' : ''}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page === 1 || isLoading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-stone-200 text-stone-600 hover:bg-white disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 font-semibold text-stone-700">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page === totalPages || isLoading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg border border-stone-200 text-stone-600 hover:bg-white disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
