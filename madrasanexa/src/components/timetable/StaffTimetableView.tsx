import React, { useState } from 'react';
import {
  Clock,
  Download,
  User,
  School,
  Loader2,
} from 'lucide-react';
import type { Weekday, TeachingStaffType } from '../../services/ustadh.service';
import {
  formatMinutesToDisplayTime,
  WEEKDAYS,
  type TimetableEntry,
} from '../../services/timetable.service';

interface StaffTimetableViewProps {
  staffList: Array<{
    id: string;
    fullName: string;
    ustadhCode: string;
    staffType?: TeachingStaffType;
  }>;
  selectedStaffId: string;
  onSelectStaffId: (id: string) => void;
  staffTypeFilter: string;
  onChangeStaffTypeFilter: (type: string) => void;
  referenceDate: string;
  onChangeReferenceDate: (date: string) => void;
  entries: TimetableEntry[];
  isLoading: boolean;
  onDownloadPdf: () => Promise<void>;
  isDownloadingPdf: boolean;
}

export const StaffTimetableView: React.FC<StaffTimetableViewProps> = ({
  staffList,
  selectedStaffId,
  onSelectStaffId,
  staffTypeFilter,
  onChangeStaffTypeFilter,
  referenceDate,
  onChangeReferenceDate,
  entries,
  isLoading,
  onDownloadPdf,
  isDownloadingPdf,
}) => {
  const [activeDayFilter, setActiveDayFilter] = useState<string>('ALL');

  // Filter staff list based on staffTypeFilter
  const filteredStaffList = staffList.filter((s) => {
    if (!staffTypeFilter || staffTypeFilter === 'ALL') return true;
    return s.staffType === staffTypeFilter;
  });

  const selectedStaff = staffList.find((s) => s.id === selectedStaffId);

  // Group entries by day
  const entriesByDay: Record<Weekday, TimetableEntry[]> = {
    MONDAY: [],
    TUESDAY: [],
    WEDNESDAY: [],
    THURSDAY: [],
    FRIDAY: [],
    SATURDAY: [],
    SUNDAY: [],
  };

  // Staff timetable only contains TEACHING sessions
  entries.forEach((e) => {
    if (entriesByDay[e.dayOfWeek]) {
      entriesByDay[e.dayOfWeek].push(e);
    }
  });

  const displayedDays =
    activeDayFilter === 'ALL'
      ? WEEKDAYS
      : WEEKDAYS.filter((d) => d === activeDayFilter);

  // Total weekly minutes
  const totalMinutes = entries.reduce((acc, curr) => acc + (curr.endMinutes - curr.startMinutes), 0);
  const totalHours = (totalMinutes / 60).toFixed(1);

  return (
    <div className="space-y-6">
      {/* Filters & Actions Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Staff Type
            </label>
            <select
              value={staffTypeFilter}
              onChange={(e) => {
                onChangeStaffTypeFilter(e.target.value);
                // If currently selected staff doesn't match new filter, reset or let parent handle
              }}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              <option value="ALL">All Teaching Staff</option>
              <option value="USTADH">Ustadh Only</option>
              <option value="SCHOOL_TEACHER">School Teacher Only</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Teaching Staff Member
            </label>
            <select
              value={selectedStaffId}
              onChange={(e) => onSelectStaffId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              <option value="">-- All Filtered Staff --</option>
              {filteredStaffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName} ({s.ustadhCode}) - {s.staffType === 'SCHOOL_TEACHER' ? 'Teacher' : 'Ustadh'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Reference Date
            </label>
            <input
              type="date"
              value={referenceDate}
              onChange={(e) => onChangeReferenceDate(e.target.value)}
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
              <span>Export Staff PDF</span>
            </button>
          </div>
        </div>

        {/* Stats Pill */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-900">
              {selectedStaff ? selectedStaff.fullName : 'All Teaching Staff'}
            </span>
            <span>•</span>
            <span>Effective Date: <strong>{referenceDate}</strong></span>
          </div>
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              {entries.length} Teaching Period{entries.length === 1 ? '' : 's'}
            </span>
            <span className="inline-flex items-center gap-1.5 text-blue-700 font-medium">
              <Clock className="w-3.5 h-3.5" />
              {totalHours} Weekly Hours
            </span>
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
          All Days
        </button>
        {WEEKDAYS.map((day) => {
          const count = entriesByDay[day]?.length || 0;
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

      {/* Grid Content */}
      {isLoading ? (
        <div className="p-16 text-center bg-white rounded-2xl border border-slate-200">
          <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-600">Loading staff timetable...</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-2xl border border-slate-200">
          <User className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800 mb-1">No Teaching Periods Assigned</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            There are no teaching sessions scheduled for this staff selection on {referenceDate}.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {displayedDays.map((day) => {
            const dayEntries = entriesByDay[day] || [];
            return (
              <div
                key={day}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs flex flex-col"
              >
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <h4 className="font-bold text-sm text-slate-800 tracking-tight">{day}</h4>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600">
                    {dayEntries.length} {dayEntries.length === 1 ? 'period' : 'periods'}
                  </span>
                </div>

                <div className="p-3 space-y-2.5 flex-1 overflow-y-auto max-h-[500px]">
                  {dayEntries.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400">
                      No teaching periods
                    </div>
                  ) : (
                    dayEntries.map((session) => {
                      return (
                        <div
                          key={session.id}
                          className="p-3 bg-white border border-slate-200 rounded-xl hover:border-emerald-300 hover:shadow-xs transition-all space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-sm text-slate-900 leading-tight">
                              {session.subject?.name || 'Subject'}
                            </span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                              {formatMinutesToDisplayTime(session.startMinutes)}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 text-xs text-slate-600">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>
                              {formatMinutesToDisplayTime(session.startMinutes)} –{' '}
                              {formatMinutesToDisplayTime(session.endMinutes)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700 truncate">
                              <School className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate">{session.class?.name || 'Class'}</span>
                            </div>

                            {!selectedStaffId && session.staff && (
                              <span className="text-[10px] text-slate-500 font-medium truncate max-w-[100px]">
                                {session.staff.fullName}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
