import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  BookOpen,
  Users,
  Printer,
  Download,
  Filter,
  CheckCircle2,
  CalendarDays,
  Info,
  ChevronRight,
} from 'lucide-react';
import type { TimetableSlot } from '../mock/teacherMockData';
import { timetableApi } from '../services/api';
import LoadingState from '../components/common/LoadingState';
import ErrorState from '../components/common/ErrorState';
import EmptyState from '../components/common/EmptyState';

type DayFilter = 'All' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday';
type ViewMode = 'cards' | 'grid';

const DAYS: DayFilter[] = ['All', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export default function TimetablePage() {
  const [selectedDay, setSelectedDay] = useState<DayFilter>('All');
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [selectedSession, setSelectedSession] = useState<TimetableSlot | null>(null);
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTimetable = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await timetableApi.getTimetable(selectedDay === 'All' ? undefined : selectedDay);
      if (data) setSlots(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load timetable.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTimetable();
  }, [selectedDay]);

  const filteredSlots = selectedDay === 'All'
    ? slots
    : slots.filter((s) => s.day.toLowerCase() === selectedDay.toLowerCase());

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return <LoadingState message="Loading weekly timetable schedule..." className="my-8" />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadTimetable} className="my-8" />;
  }

  return (
    <div className="space-y-6">
      {/* 1. Header & Controls Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#0D9488] uppercase tracking-wider mb-1">
            <CalendarDays className="w-4 h-4" />
            <span>Faculty Academic Roster</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Weekly Teaching Timetable
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Semester 2 • {slots.length} Total Weekly Classroom Periods
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            <button
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Timeline View
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Weekly Grid
            </button>
          </div>

          <button
            onClick={handlePrint}
            className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span className="hidden sm:inline">Print Schedule</span>
          </button>
        </div>
      </div>

      {/* 2. Responsive Day Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-2 shadow-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
          {DAYS.map((day) => {
            const isSelected = selectedDay === day;
            const count = day === 'All'
              ? slots.length
              : slots.filter((s) => s.day.toLowerCase() === day.toLowerCase()).length;

            return (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer shrink-0 ${
                  isSelected
                    ? 'bg-[#0F172A] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>{day}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    isSelected ? 'bg-[#37C6A3] text-[#0F172A]' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. View Mode: Timeline / Responsive Cards */}
      {viewMode === 'cards' && (
        <div className="space-y-4">
          {filteredSlots.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-500">
              No classroom sessions scheduled for this day filter.
            </div>
          ) : (
            filteredSlots.map((slot) => {
              const isTodayMon = slot.day === 'Monday';
              return (
                <div
                  key={slot.id}
                  className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs hover:border-slate-300 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-4 min-w-0">
                    {/* Period Badge */}
                    <div className="w-12 h-12 rounded-2xl bg-slate-900 text-[#37C6A3] flex flex-col items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                      <span className="text-[9px] uppercase tracking-wider text-slate-400">Period</span>
                      <span className="text-base font-black">P{slot.period}</span>
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-800">
                          {slot.day}
                        </span>
                        <span className="text-xs font-mono font-semibold text-slate-500">
                          {slot.timeSlot}
                        </span>
                        {isTodayMon && (
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              slot.status === 'In Progress'
                                ? 'bg-teal-100 text-teal-900 border border-teal-300'
                                : slot.status === 'Completed'
                                ? 'bg-slate-100 text-slate-700'
                                : 'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {slot.status}
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm font-bold text-slate-900">
                        {slot.subject}
                      </h3>
                      <div className="text-xs font-semibold text-[#0D9488] mt-0.5">
                        {slot.className}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-2">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <strong className="text-slate-700">{slot.room}</strong>
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          <span>{slot.studentsCount} Students Enrolled</span>
                        </span>
                      </div>

                      {slot.notes && (
                        <p className="text-[11px] text-slate-500 italic mt-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                          Session Note: {slot.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-center shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 w-full md:w-auto justify-end">
                    <button
                      onClick={() => setSelectedSession(slot)}
                      className="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition cursor-pointer"
                    >
                      Session Details
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 4. View Mode: Weekly Matrix Grid */}
      {viewMode === 'grid' && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4 w-28">Period / Time</th>
                  {DAYS.filter(d => d !== 'All').map(day => (
                    <th key={day} className="py-3 px-4">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {[1, 2, 3, 4].map(pNum => (
                  <tr key={pNum} className="hover:bg-slate-50/50">
                    <td className="py-3.5 px-4 font-bold text-slate-900 bg-slate-50/40 border-r border-slate-100">
                      <div>Period {pNum}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {pNum === 1 && '08:00 – 08:45'}
                        {pNum === 2 && '09:00 – 09:45'}
                        {pNum === 3 && '10:15 – 11:00'}
                        {pNum === 4 && '11:30 – 12:15'}
                      </div>
                    </td>
                    {DAYS.filter(d => d !== 'All').map(day => {
                      const slot = slots.find(
                        s => s.day.toLowerCase() === day.toLowerCase() && (s.period === pNum || String(s.period) === String(pNum))
                      );
                      return (
                        <td key={day} className="py-3.5 px-3 align-top border-r border-slate-100 last:border-r-0">
                          {slot ? (
                            <div
                              onClick={() => setSelectedSession(slot)}
                              className="p-2.5 rounded-xl bg-teal-50/60 border border-teal-200/80 hover:bg-teal-100/60 transition cursor-pointer"
                            >
                              <div className="font-bold text-slate-900 text-[11px] line-clamp-1">
                                {slot.subject}
                              </div>
                              <div className="text-[10px] text-[#0D9488] font-semibold mt-0.5 line-clamp-1">
                                {slot.className}
                              </div>
                              <div className="text-[10px] text-slate-500 mt-1 flex items-center justify-between">
                                <span>{slot.room}</span>
                                <span className="font-mono">{slot.studentsCount}s</span>
                              </div>
                            </div>
                          ) : (
                            <div className="h-16 rounded-xl border border-dashed border-slate-200 flex items-center justify-center text-[11px] text-slate-400">
                              Free Period
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Session Details Modal */}
      {selectedSession && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#0D9488]">
                  {selectedSession.day} • Period {selectedSession.period}
                </span>
                <h3 className="text-base font-bold text-slate-900">
                  {selectedSession.subject}
                </h3>
              </div>
              <button
                onClick={() => setSelectedSession(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 py-4 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Class & Stream</span>
                <span className="font-semibold text-slate-900">{selectedSession.className}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Scheduled Time</span>
                <span className="font-mono font-semibold text-slate-900">{selectedSession.timeSlot}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Classroom Venue</span>
                <span className="font-semibold text-[#0D9488]">{selectedSession.room}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Enrolled Students</span>
                <span className="font-semibold text-slate-900">{selectedSession.studentsCount} Students</span>
              </div>
              {selectedSession.notes && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-700 block mb-0.5">Instructional Notes</span>
                  <p className="text-slate-600 leading-relaxed">{selectedSession.notes}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setSelectedSession(null)}
                className="px-4 py-2 text-xs font-bold text-white bg-[#0F172A] hover:bg-slate-800 rounded-xl"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
