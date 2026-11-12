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
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Reference Date (Historical & Active)
            </label>
            <input
              type="date"
              value={referenceDate}
              onChange={(e) => onChangeReferenceDate(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Quick Search (Class / Subject / Staff)
            </label>
            <input
              type="text"
              placeholder="Search by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={onDownloadPdf}
              disabled={isDownloadingPdf || entries.length === 0}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 shadow-sm"
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
            <div className="text-[11px] font-bold text-slate-500 uppercase">Total Sessions</div>
            <div className="text-lg font-bold text-slate-800 mt-0.5">{entries.length}</div>
          </div>
          <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-100">
            <div className="text-[11px] font-bold text-emerald-700 uppercase">Teaching Periods</div>
            <div className="text-lg font-bold text-emerald-800 mt-0.5">{totalTeaching}</div>
          </div>
          <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-100">
            <div className="text-[11px] font-bold text-amber-700 uppercase">Breaks / Intervals</div>
            <div className="text-lg font-bold text-amber-800 mt-0.5">{totalBreaks}</div>
          </div>
          <div className="bg-blue-50/60 p-3 rounded-xl border border-blue-100">
            <div className="text-[11px] font-bold text-blue-700 uppercase">Participating Staff</div>
            <div className="text-lg font-bold text-blue-800 mt-0.5">{uniqueStaffCount}</div>
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
              ? 'bg-slate-900 text-white shadow-sm'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
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
                  ? 'bg-emerald-700 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span>{day.slice(0, 3)}</span>
              {count > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    activeDayFilter === day ? 'bg-emerald-800 text-white' : 'bg-slate-100 text-slate-600'
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
        <div className="p-16 text-center bg-white rounded-2xl border border-slate-200">
          <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-600">Loading master timetable...</p>
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-2xl border border-slate-200">
          <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800 mb-1">No Sessions Found</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            No matching timetable sessions found for the chosen filters on {referenceDate}.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[650px]">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Day</th>
                  <th className="py-3 px-4">Time Slot</th>
                  <th className="py-3 px-4">Class</th>
                  <th className="py-3 px-4">Subject / Activity</th>
                  <th className="py-3 px-4">Teaching Staff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredEntries.map((session) => {
                  if (session.type === 'BREAK') {
                    return (
                      <tr key={session.id} className="bg-amber-50/40 hover:bg-amber-50/70 transition-colors">
                        <td className="py-3 px-4 font-bold text-amber-900">{session.dayOfWeek}</td>
                        <td className="py-3 px-4 font-semibold text-amber-800">
                          {formatMinutesToDisplayTime(session.startMinutes)} –{' '}
                          {formatMinutesToDisplayTime(session.endMinutes)}
                        </td>
                        <td className="py-3 px-4 font-semibold text-amber-900">
                          {session.class?.name || 'Class'}
                        </td>
                        <td colSpan={2} className="py-3 px-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-200/70 text-amber-950 uppercase">
                            <Coffee className="w-3.5 h-3.5" />
                            [BREAK] {session.name}
                          </span>
                        </td>
                      </tr>
                    );
                  }

                  const isTeacher = session.staff?.staffType === 'SCHOOL_TEACHER';
                  return (
                    <tr key={session.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-800">{session.dayOfWeek}</td>
                      <td className="py-3 px-4 font-semibold text-emerald-700">
                        {formatMinutesToDisplayTime(session.startMinutes)} –{' '}
                        {formatMinutesToDisplayTime(session.endMinutes)}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {session.class?.name || 'Class'}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800">
                        {session.subject?.name || 'Subject'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="font-medium text-slate-800 truncate max-w-[180px]"
                            title={session.staff?.fullName || 'Staff'}
                          >
                            {session.staff?.fullName || 'Staff'}
                          </span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                              isTeacher
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
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
