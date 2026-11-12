import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  Download,
  Coffee,
  User,
  Pencil,
  Trash2,
  Loader2,
  Table as TableIcon,
  LayoutGrid,
} from 'lucide-react';
import type { Weekday } from '../../services/ustadh.service';
import {
  formatMinutesToDisplayTime,
  WEEKDAYS,
  type TimetableEntry,
  type TimetableBreakItem,
} from '../../services/timetable.service';

interface ClassTimetableViewProps {
  classes: Array<{ id: string; name: string; code?: string | null }>;
  selectedClassId: string;
  onSelectClassId: (id: string) => void;
  referenceDate: string;
  onChangeReferenceDate: (date: string) => void;
  entries: TimetableEntry[];
  isLoading: boolean;
  onDownloadPdf: () => Promise<void>;
  isDownloadingPdf: boolean;
  onOpenAddBreak: () => void;
  onEditBreak: (breakItem: TimetableBreakItem) => void;
  onDeleteBreak: (id: string) => void;
}

export const ClassTimetableView: React.FC<ClassTimetableViewProps> = ({
  classes,
  selectedClassId,
  onSelectClassId,
  referenceDate,
  onChangeReferenceDate,
  entries,
  isLoading,
  onDownloadPdf,
  isDownloadingPdf,
  onOpenAddBreak,
  onEditBreak,
  onDeleteBreak,
}) => {
  const [activeDayFilter, setActiveDayFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'matrix' | 'cards'>('matrix');

  // Group entries by day of week
  const entriesByDay: Record<Weekday, TimetableEntry[]> = {
    MONDAY: [],
    TUESDAY: [],
    WEDNESDAY: [],
    THURSDAY: [],
    FRIDAY: [],
    SATURDAY: [],
    SUNDAY: [],
  };

  entries.forEach((e) => {
    if (entriesByDay[e.dayOfWeek]) {
      entriesByDay[e.dayOfWeek].push(e);
    }
  });

  const selectedClass = classes.find((c) => c.id === selectedClassId);

  const displayedDays =
    activeDayFilter === 'ALL'
      ? WEEKDAYS
      : WEEKDAYS.filter((d) => d === activeDayFilter);

  const totalTeaching = entries.filter((e) => e.type === 'TEACHING').length;
  const totalBreaks = entries.filter((e) => e.type === 'BREAK').length;

  // Extract unique time slots for weekly matrix grid
  const timeSlotMap = new Map<string, { startMinutes: number; endMinutes: number }>();
  entries.forEach((it) => {
    const key = `${it.startMinutes}-${it.endMinutes}`;
    if (!timeSlotMap.has(key)) {
      timeSlotMap.set(key, { startMinutes: it.startMinutes, endMinutes: it.endMinutes });
    }
  });
  const timeSlots = Array.from(timeSlotMap.values()).sort((a, b) => {
    if (a.startMinutes !== b.startMinutes) return a.startMinutes - b.startMinutes;
    return a.endMinutes - b.endMinutes;
  });

  const activeDaysWithSessions = WEEKDAYS.filter((d) => entries.some((e) => e.dayOfWeek === d));
  const matrixDays = activeDaysWithSessions.length > 0 ? activeDaysWithSessions : ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];

  return (
    <div className="space-y-6">
      {/* Control Bar: Class Selector, Reference Date, Actions */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Select Class
              </label>
              <select
                value={selectedClassId}
                onChange={(e) => onSelectClassId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                {classes.length === 0 && <option value="">No classes available</option>}
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.code ? `(${c.code})` : ''}
                  </option>
                ))}
              </select>
            </div>

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
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2 lg:pt-5">
            <button
              type="button"
              onClick={onOpenAddBreak}
              disabled={!selectedClassId}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
            >
              <Coffee className="w-4 h-4 text-amber-600" />
              <span>Add Break</span>
            </button>

            <button
              type="button"
              onClick={onDownloadPdf}
              disabled={isDownloadingPdf || !selectedClassId || entries.length === 0}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 shadow-sm"
            >
              {isDownloadingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>Export PDF</span>
            </button>
          </div>
        </div>

        {/* Quick Stats & View Switcher */}
        {selectedClass && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-900">{selectedClass.name}</span>
              <span>•</span>
              <span>Effective Date: <strong>{referenceDate}</strong></span>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                {totalTeaching} Teaching Period{totalTeaching === 1 ? '' : 's'}
              </span>
              <span className="inline-flex items-center gap-1.5 text-amber-700 font-medium">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                {totalBreaks} Interval / Break{totalBreaks === 1 ? '' : 's'}
              </span>

              {/* View Toggle */}
              <div className="flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => setViewMode('matrix')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                    viewMode === 'matrix'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Weekly Grid Matrix (matching PDF layout)"
                >
                  <TableIcon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Grid Matrix</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                    viewMode === 'cards'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Day Cards View"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Day Cards</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="p-16 text-center bg-white rounded-2xl border border-slate-200">
          <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-600">Loading class timetable...</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-2xl border border-slate-200">
          <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800 mb-1">No Timetable Sessions Scheduled</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mb-4">
            No teaching sessions or intervals are effective for this class on {referenceDate}.
          </p>
          <button
            type="button"
            onClick={onOpenAddBreak}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            <Coffee className="w-4 h-4" />
            <span>Add Interval / Break</span>
          </button>
        </div>
      ) : viewMode === 'matrix' ? (
        /* =======================================================
           VIEW 1: WEEKLY TIME GRID MATRIX (Matching PDF Layout)
           TIME ROWS × DAY COLUMNS with clean solid borders
           ======================================================= */
        <div className="bg-white rounded-2xl border border-slate-300 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 text-xs font-bold uppercase tracking-wider text-slate-800">
                  <th className="py-3 px-4 w-44 text-center border-r border-slate-300">TIME</th>
                  {matrixDays.map((day) => (
                    <th key={day} className="py-3 px-4 text-center border-r last:border-r-0 border-slate-300">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300 text-sm">
                {timeSlots.map((slot) => {
                  const timeLabel = `${formatMinutesToDisplayTime(slot.startMinutes)} – ${formatMinutesToDisplayTime(slot.endMinutes)}`;

                  return (
                    <tr key={`${slot.startMinutes}-${slot.endMinutes}`} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-xs text-slate-900 bg-slate-50/80 text-center border-r border-slate-300 whitespace-nowrap">
                        {timeLabel}
                      </td>

                      {matrixDays.map((day) => {
                        const session = entries.find(
                          (it) => it.dayOfWeek === day && it.startMinutes === slot.startMinutes && it.endMinutes === slot.endMinutes
                        );

                        if (!session) {
                          return (
                            <td key={day} className="py-3.5 px-4 border-r last:border-r-0 border-slate-300 bg-white">
                              {/* Empty slot */}
                            </td>
                          );
                        }

                        if (session.type === 'BREAK') {
                          return (
                            <td key={day} className="py-3.5 px-4 border-r last:border-r-0 border-slate-300 bg-amber-50/70 text-center">
                              <div className="flex items-center justify-center gap-1.5 text-amber-900 font-bold text-xs uppercase tracking-wide">
                                <Coffee className="w-3.5 h-3.5 text-amber-700" />
                                <span>{session.name || 'INTERVAL'}</span>
                                <div className="flex items-center gap-0.5 ml-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onEditBreak({
                                        id: session.id,
                                        madrasaId: '',
                                        classId: selectedClassId,
                                        name: session.name || '',
                                        dayOfWeek: session.dayOfWeek,
                                        startMinutes: session.startMinutes,
                                        endMinutes: session.endMinutes,
                                        effectiveFrom: session.effectiveFrom,
                                        effectiveTo: session.effectiveTo,
                                        isActive: true,
                                        createdAt: '',
                                        updatedAt: '',
                                      })
                                    }
                                    className="p-0.5 text-amber-700 hover:text-amber-950"
                                    title="Edit Break"
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onDeleteBreak(session.id)}
                                    className="p-0.5 text-rose-600 hover:text-rose-800"
                                    title="Delete Break"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            </td>
                          );
                        }

                        const isTeacher = session.staff?.staffType === 'SCHOOL_TEACHER';
                        return (
                          <td key={day} className="py-3 px-4 border-r last:border-r-0 border-slate-300 bg-white text-center">
                            <div className="font-bold text-sm text-slate-900 leading-snug">
                              {session.subject?.name}
                            </div>
                            <div className="flex items-center justify-center gap-1 text-xs text-slate-600 mt-1">
                              <User className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="font-medium text-slate-800">{session.staff?.fullName}</span>
                              <span
                                className={`text-[8.5px] font-bold px-1 py-0.2 rounded uppercase ${
                                  isTeacher ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-800'
                                }`}
                              >
                                {isTeacher ? 'Teacher' : 'Ustadh'}
                              </span>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* =======================================================
           VIEW 2: DAY CARDS VIEW
           Displays all 7+ periods and intervals with clean progression
           ======================================================= */
        <div className="space-y-4">
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {displayedDays.map((day) => {
              const dayEntries = entriesByDay[day] || [];
              let periodCounter = 0;

              return (
                <div
                  key={day}
                  className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs flex flex-col"
                >
                  {/* Day Header */}
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <h4 className="font-bold text-sm text-slate-800 tracking-tight">{day}</h4>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600">
                      {dayEntries.length} {dayEntries.length === 1 ? 'period' : 'periods'}
                    </span>
                  </div>

                  {/* Day Sessions List (No restrictive height cap) */}
                  <div className="p-3 space-y-2.5 flex-1 min-h-[160px]">
                    {dayEntries.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-400">
                        No periods scheduled
                      </div>
                    ) : (
                      dayEntries.map((session) => {
                        if (session.type === 'BREAK') {
                          return (
                            <div
                              key={session.id}
                              className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl relative group"
                            >
                              <div className="flex items-center justify-between gap-2 mb-1.5">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200/70 text-amber-900 uppercase">
                                  <Coffee className="w-3 h-3" />
                                  Break / Interval
                                </span>
                                <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onEditBreak({
                                        id: session.id,
                                        madrasaId: '',
                                        classId: selectedClassId,
                                        name: session.name || '',
                                        dayOfWeek: session.dayOfWeek,
                                        startMinutes: session.startMinutes,
                                        endMinutes: session.endMinutes,
                                        effectiveFrom: session.effectiveFrom,
                                        effectiveTo: session.effectiveTo,
                                        isActive: true,
                                        createdAt: '',
                                        updatedAt: '',
                                      })
                                    }
                                    className="p-1 text-amber-700 hover:text-amber-900 hover:bg-amber-100 rounded"
                                    title="Edit Break"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onDeleteBreak(session.id)}
                                    className="p-1 text-rose-600 hover:text-rose-800 hover:bg-rose-100 rounded"
                                    title="Delete Break"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                              <div className="font-bold text-sm text-amber-900 leading-tight">
                                {session.name}
                              </div>
                              <div className="flex items-center gap-1.5 text-xs text-amber-800 font-semibold mt-1">
                                <Clock className="w-3.5 h-3.5" />
                                <span>
                                  {formatMinutesToDisplayTime(session.startMinutes)} –{' '}
                                  {formatMinutesToDisplayTime(session.endMinutes)}
                                </span>
                              </div>
                            </div>
                          );
                        }

                        // Teaching Session
                        periodCounter++;
                        const isSchoolTeacher = session.staff?.staffType === 'SCHOOL_TEACHER';
                        return (
                          <div
                            key={session.id}
                            className="p-3 bg-white border border-slate-200 rounded-xl hover:border-emerald-300 hover:shadow-xs transition-all space-y-1.5"
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-sm text-slate-900 leading-tight">
                                {session.subject?.name || 'Subject'}
                              </span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                                Period {periodCounter}
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
                                <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="truncate">{session.staff?.fullName || 'Staff'}</span>
                              </div>
                              <span
                                className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 ${
                                  isSchoolTeacher
                                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                }`}
                              >
                                {isSchoolTeacher ? 'Teacher' : 'Ustadh'}
                              </span>
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
        </div>
      )}
    </div>
  );
};
