import React, { useState } from 'react';
import {
  Calendar,
  Download,
  Coffee,
  Loader2,
} from 'lucide-react';
import {
  formatMinutesToDisplayTime,
  WEEKDAYS,
  type TimetableEntry,
} from '../../services/timetable.service';

interface FullTimetableViewProps {
  referenceDate: string;
  onChangeReferenceDate: (date: string) => void;
  entries: TimetableEntry[];
  isLoading: boolean;
  onDownloadPdf: () => Promise<void>;
  isDownloadingPdf: boolean;
}

export const FullTimetableView: React.FC<FullTimetableViewProps> = ({
  referenceDate,
  onChangeReferenceDate,
  entries,
  isLoading,
  onDownloadPdf,
  isDownloadingPdf,
}) => {
  const [activeDayFilter, setActiveDayFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter entries
  const filteredEntries = entries.filter((e) => {
    if (activeDayFilter !== 'ALL' && e.dayOfWeek !== activeDayFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const className = e.class?.name?.toLowerCase() || '';
      const subjName = e.subject?.name?.toLowerCase() || '';
      const staffName = e.staff?.fullName?.toLowerCase() || '';
      const breakName = e.name?.toLowerCase() || '';
      if (!className.includes(q) && !subjName.includes(q) && !staffName.includes(q) && !breakName.includes(q)) {
        return false;
      }
    }
    return true;
  });

  const totalTeaching = entries.filter((e) => e.type === 'TEACHING').length;
  const totalBreaks = entries.filter((e) => e.type === 'BREAK').length;
  const uniqueStaffCount = new Set(entries.map((e) => e.staff?.id).filter(Boolean)).size;

  return (
    <div className="space-y-6">
      {/* Top Filter & Download Bar */}
      <div className="bg-white dark:bg-[#141820] p-5 rounded-2xl border border-slate-200 dark:border-[#242936] shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-[#9CA3AF] mb-1.5">
              Reference Date (Historical & Active)
            </label>
            <input
              type="date"
              value={referenceDate}
              onChange={(e) => onChangeReferenceDate(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white dark:bg-[#1C222D] border border-slate-200 dark:border-[#242936] text-slate-900 dark:text-[#F9FAFB] rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-[#9CA3AF] mb-1.5">
              Quick Search (Class / Subject / Staff)
            </label>
            <input
              type="text"
              placeholder="Search by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white dark:bg-[#1C222D] border border-slate-200 dark:border-[#242936] text-slate-900 dark:text-[#F9FAFB] rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={onDownloadPdf}
              disabled={isDownloadingPdf || entries.length === 0}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 dark:bg-[#84CC16] hover:bg-emerald-700 dark:hover:bg-[#65A30D] text-white dark:text-[#0B0D11] rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 shadow-sm"
            >
              {isDownloadingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>Export Full Timetable PDF</span>
            </button>
          </div>
        </div>

        {/* Master Metrics Pill */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 dark:border-[#242936]">
          <div className="bg-slate-50 dark:bg-[#141820] p-3 rounded-xl border border-slate-100 dark:border-[#242936]">
            <div className="text-[11px] font-bold text-slate-500 dark:text-[#9CA3AF] uppercase">Total Sessions</div>
            <div className="text-lg font-bold text-slate-800 dark:text-[#F9FAFB] mt-0.5">{entries.length}</div>
          </div>
          <div className="bg-emerald-50/60 dark:bg-[#141820] p-3 rounded-xl border border-emerald-100 dark:border-[#242936]">
            <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase">Teaching Periods</div>
            <div className="text-lg font-bold text-emerald-800 dark:text-[#F9FAFB] mt-0.5">{totalTeaching}</div>
          </div>
          <div className="bg-amber-50/60 dark:bg-[#141820] p-3 rounded-xl border border-amber-100 dark:border-[#242936]">
            <div className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase">Breaks / Intervals</div>
            <div className="text-lg font-bold text-amber-800 dark:text-[#F9FAFB] mt-0.5">{totalBreaks}</div>
          </div>
          <div className="bg-blue-50/60 dark:bg-[#141820] p-3 rounded-xl border border-blue-100 dark:border-[#242936]">
            <div className="text-[11px] font-bold text-blue-700 dark:text-blue-400 uppercase">Participating Staff</div>
            <div className="text-lg font-bold text-blue-800 dark:text-[#F9FAFB] mt-0.5">{uniqueStaffCount}</div>
          </div>
        </div>
      </div>

      {/* Day Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setActiveDayFilter('ALL')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
            activeDayFilter === 'ALL'
              ? 'bg-slate-900 dark:bg-[#1C222D] text-white dark:text-[#84CC16] border border-transparent dark:border-[#84CC16]/40 shadow-sm'
              : 'bg-white dark:bg-[#141820] text-slate-600 dark:text-[#9CA3AF] border border-slate-200 dark:border-[#242936] hover:bg-slate-50 dark:hover:bg-[#1C222D]'
          }`}
        >
          All Days ({entries.length})
        </button>
        {WEEKDAYS.map((day) => {
          const count = entries.filter((e) => e.dayOfWeek === day).length;
          return (
            <button
              key={day}
              type="button"
              onClick={() => setActiveDayFilter(day)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                activeDayFilter === day
                  ? 'bg-emerald-700 dark:bg-[#1C222D] text-white dark:text-[#84CC16] border border-transparent dark:border-[#84CC16]/40 shadow-sm'
                  : 'bg-white dark:bg-[#141820] text-slate-600 dark:text-[#9CA3AF] border border-slate-200 dark:border-[#242936] hover:bg-slate-50 dark:hover:bg-[#1C222D]'
              }`}
            >
              <span>{day.slice(0, 3)}</span>
              {count > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    activeDayFilter === day
                      ? 'bg-emerald-800 dark:bg-[#84CC16]/20 text-white dark:text-[#84CC16]'
                      : 'bg-slate-100 dark:bg-[#1C222D] text-slate-600 dark:text-[#9CA3AF]'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Table Content */}
      {isLoading ? (
        <div className="p-16 text-center bg-white dark:bg-[#141820] rounded-2xl border border-slate-200 dark:border-[#242936]">
          <Loader2 className="w-8 h-8 text-emerald-600 dark:text-[#84CC16] animate-spin mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-600 dark:text-[#9CA3AF]">Loading master timetable...</p>
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="p-16 text-center bg-white dark:bg-[#141820] rounded-2xl border border-slate-200 dark:border-[#242936]">
          <Calendar className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800 dark:text-[#F9FAFB] mb-1">No Sessions Found</h3>
          <p className="text-sm text-slate-500 dark:text-[#9CA3AF] max-w-md mx-auto">
            No matching timetable sessions found for the chosen filters on {referenceDate}.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#141820] rounded-2xl border border-slate-200 dark:border-[#242936] overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[650px]">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-[#1C222D] border-b border-slate-200 dark:border-[#242936] text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-[#9CA3AF]">
                  <th className="py-3 px-4">Day</th>
                  <th className="py-3 px-4">Time Slot</th>
                  <th className="py-3 px-4">Class</th>
                  <th className="py-3 px-4">Subject / Activity</th>
                  <th className="py-3 px-4">Teaching Staff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#242936] text-sm">
                {filteredEntries.map((session) => {
                  if (session.type === 'BREAK') {
                    return (
                      <tr key={session.id} className="bg-amber-50/40 dark:bg-amber-500/10 hover:bg-amber-50/70 dark:hover:bg-amber-500/15 transition-colors">
                        <td className="py-3 px-4 font-bold text-amber-900 dark:text-amber-300">{session.dayOfWeek}</td>
                        <td className="py-3 px-4 font-semibold text-amber-800 dark:text-amber-400">
                          {formatMinutesToDisplayTime(session.startMinutes)} –{' '}
                          {formatMinutesToDisplayTime(session.endMinutes)}
                        </td>
                        <td className="py-3 px-4 font-semibold text-amber-900 dark:text-amber-300">
                          {session.class?.name || 'Class'}
                        </td>
                        <td colSpan={2} className="py-3 px-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-200/70 dark:bg-amber-500/20 text-amber-950 dark:text-amber-200 border border-transparent dark:border-amber-500/30 uppercase">
                            <Coffee className="w-3.5 h-3.5 text-amber-800 dark:text-amber-400" />
                            [BREAK] {session.name}
                          </span>
                        </td>
                      </tr>
                    );
                  }

                  const isTeacher = session.staff?.staffType === 'SCHOOL_TEACHER';
                  return (
                    <tr key={session.id} className="hover:bg-slate-50/80 dark:hover:bg-[#1C222D]/60 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-800 dark:text-[#F9FAFB]">{session.dayOfWeek}</td>
                      <td className="py-3 px-4 font-semibold text-emerald-700 dark:text-emerald-400">
                        {formatMinutesToDisplayTime(session.startMinutes)} –{' '}
                        {formatMinutesToDisplayTime(session.endMinutes)}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-[#F9FAFB]">
                        {session.class?.name || 'Class'}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800 dark:text-[#F9FAFB]">
                        {session.subject?.name || 'Subject'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="font-medium text-slate-800 dark:text-[#D1D5DB] truncate max-w-[180px]"
                            title={session.staff?.fullName || 'Staff'}
                          >
                            {session.staff?.fullName || 'Staff'}
                          </span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                              isTeacher
                                ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40'
                                : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40'
                            }`}
                          >
                            {isTeacher ? 'Teacher' : 'Ustadh'}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
