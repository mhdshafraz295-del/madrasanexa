import React, { useState, useEffect } from 'react';
import {
  CalendarDays,
  Clock,
  MapPin,
  Users,
  Printer,
  ChevronRight,
  X,
  Sparkles,
} from 'lucide-react';
import type { TimetableSlot } from '../mock/teacherMockData';
import { timetableApi, profileApi, authApi, resolveAssetUrl, TeacherProfile } from '../services/api';
import LoadingState from '../components/common/LoadingState';
import ErrorState from '../components/common/ErrorState';
import EmptyState from '../components/common/EmptyState';

type DayFilter = 'All' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';
type ViewMode = 'cards' | 'grid';

const DAYS: DayFilter[] = ['All', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEK_DAYS: DayFilter[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function TimetablePage() {
  const [selectedDay, setSelectedDay] = useState<DayFilter>('All');
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [selectedSession, setSelectedSession] = useState<TimetableSlot | null>(null);
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [allSlots, setAllSlots] = useState<TimetableSlot[]>([]);
  const [profile, setProfile] = useState<TeacherProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logoError, setLogoError] = useState(false);

  const loadTimetable = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [dataRes, profileRes] = await Promise.allSettled([
        timetableApi.getTimetable(),
        profileApi.getProfile(),
      ]);

      if (dataRes.status === 'fulfilled' && dataRes.value) {
        setAllSlots(dataRes.value);
        setSlots(dataRes.value);
      }
      if (profileRes.status === 'fulfilled' && profileRes.value) {
        setProfile(profileRes.value);
      } else {
        const stored = authApi.getStoredUser();
        if (stored) {
          setProfile({
            id: stored.id,
            fullName: stored.name,
            email: stored.email,
            employeeCode: stored.teacherProfile?.ustadhCode || 'UST',
            status: 'Active',
            madrasa: stored.madrasa,
          } as any);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load timetable.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTimetable();
  }, []);

  const filteredSlots = selectedDay === 'All'
    ? allSlots
    : allSlots.filter((s) => s.day.toLowerCase() === selectedDay.toLowerCase());

  const handlePrint = () => {
    window.print();
  };

  const storedUser = authApi.getStoredUser();
  const teacherName = profile?.fullName || storedUser?.name || 'Ustadh';
  const employeeCode = profile?.employeeCode || storedUser?.teacherProfile?.ustadhCode || '';
  const madrasaName = (profile as any)?.institution?.name || (profile as any)?.madrasa?.name || storedUser?.madrasa?.name || 'MadrasaNexa Institutional Faculty';
  const madrasaCode = (profile as any)?.institution?.code || (profile as any)?.madrasa?.code || storedUser?.madrasa?.code || 'MNX';
  const rawLogoUrl = (profile as any)?.institution?.logoUrl || (profile as any)?.madrasa?.logoUrl || storedUser?.madrasa?.logoUrl;
  const resolvedLogoUrl = resolveAssetUrl(rawLogoUrl);
  const madrasaInitials = (madrasaCode || madrasaName.slice(0, 3)).toUpperCase();

  if (isLoading) {
    return <LoadingState message="Loading weekly timetable schedule..." className="my-8" />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadTimetable} className="my-8" />;
  }

  return (
    <div className="space-y-6 overflow-x-hidden print:space-y-0 print:overflow-visible print:m-0 print:p-0">
      {/* =========================================================================
          0. DEDICATED PRINT-ONLY SINGLE-PAGE A4 LANDSCAPE TIMETABLE ROSTER
          Hidden on screen (print:block), high-contrast, compact 1-page fit
         ========================================================================= */}
      <div
        id="printable-timetable-sheet"
        className="hidden print:block w-full bg-white text-slate-900 font-sans"
        style={{
          pageBreakInside: 'avoid',
          breakInside: 'avoid',
          pageBreakAfter: 'avoid',
          breakAfter: 'avoid',
        }}
      >
        <style>{`
          @media print {
            @page {
              size: A4 landscape;
              margin: 10mm;
            }
          }
        `}</style>

        {/* 1. Institutional Header Banner */}
        <div className="border-b-2 border-slate-900 pb-2.5 mb-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              {resolvedLogoUrl && !logoError ? (
                <div className="h-11 w-11 rounded-lg overflow-hidden bg-white border border-slate-300 shrink-0 p-0.5 flex items-center justify-center">
                  <img
                    src={resolvedLogoUrl}
                    alt={madrasaName}
                    onError={() => setLogoError(true)}
                    className="w-full h-full object-cover rounded-md"
                  />
                </div>
              ) : (
                <div className="h-11 w-11 rounded-lg bg-slate-900 text-[#37C6A3] font-black text-xs flex items-center justify-center shrink-0">
                  {madrasaInitials}
                </div>
              )}
              <div>
                <div className="text-[9px] font-extrabold uppercase tracking-widest text-[#0D9488]">
                  {madrasaCode ? `${madrasaCode} • ` : ''}Faculty Academic Roster
                </div>
                <h1 className="text-lg font-black text-slate-900 uppercase tracking-tight leading-none mt-0.5">
                  {madrasaName}
                </h1>
                <div className="text-[11px] font-bold text-slate-700 mt-0.5 flex items-center gap-1.5">
                  <span>Weekly Teaching Timetable</span>
                  <span className="text-slate-300">•</span>
                  <span className="text-slate-500 font-medium">Academic Year 2026</span>
                </div>
              </div>
            </div>

            <div className="text-right space-y-0.5">
              <div className="text-xs font-black text-slate-900">
                Ustadh {teacherName}
              </div>
              {employeeCode && (
                <div className="text-[10px] font-mono font-semibold text-slate-600">
                  Staff ID: {employeeCode}
                </div>
              )}
              <div className="text-[9px] font-semibold text-slate-500 flex items-center justify-end gap-1.5 pt-0.5">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold">
                  {allSlots.length} Total Weekly Periods
                </span>
                <span className="text-slate-300">•</span>
                <span>
                  Printed: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Compact Structured Weekly Table (Monday through Saturday) */}
        <table className="w-full border-collapse border border-slate-300 text-left text-[10px]">
          <thead>
            <tr className="bg-slate-900 text-white font-bold uppercase tracking-wider text-[8.5px]">
              <th className="py-1 px-2 border border-slate-700 text-center w-24">Day</th>
              <th className="py-1 px-1.5 border border-slate-700 text-center w-12">Period</th>
              <th className="py-1 px-2 border border-slate-700 w-36">Time Slot</th>
              <th className="py-1 px-2.5 border border-slate-700">Subject / Course Module</th>
              <th className="py-1 px-2.5 border border-slate-700 w-52">Class & Division</th>
              <th className="py-1 px-2 border border-slate-700 text-center w-24">Room</th>
              <th className="py-1 px-1.5 border border-slate-700 text-center w-20">Enrolled</th>
            </tr>
          </thead>
          <tbody>
            {allSlots.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-6 text-center text-slate-400 italic">
                  No weekly classroom teaching periods currently scheduled.
                </td>
              </tr>
            ) : (
              WEEK_DAYS.map((dayName) => {
                const daySlots = allSlots
                  .filter((s) => s.day.toLowerCase() === dayName.toLowerCase())
                  .sort((a, b) => a.period - b.period);

                if (daySlots.length === 0) return null;

                return daySlots.map((slot, idx) => (
                  <tr
                    key={slot.id}
                    className={`border-b border-slate-200 ${
                      idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                    }`}
                    style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}
                  >
                    {idx === 0 && (
                      <td
                        rowSpan={daySlots.length}
                        className="py-1 px-1.5 text-center font-bold text-slate-900 bg-slate-100/90 border border-slate-300 align-middle uppercase tracking-wider text-[9.5px]"
                      >
                        <div className="font-extrabold text-slate-900">{dayName}</div>
                        <div className="text-[8.5px] text-[#0D9488] font-mono font-bold mt-0.5">
                          {daySlots.length} Period{daySlots.length === 1 ? '' : 's'}
                        </div>
                      </td>
                    )}
                    <td className="py-1 px-1 text-center font-mono font-bold text-slate-800 border border-slate-200 text-[9.5px]">
                      P{slot.period}
                    </td>
                    <td className="py-1 px-1.5 font-mono text-slate-700 whitespace-nowrap border border-slate-200 text-[9.5px]">
                      {slot.timeSlot}
                    </td>
                    <td className="py-1 px-2 font-bold text-slate-900 border border-slate-200 font-sans text-[10px]">
                      <span className="leading-tight">{slot.subject}</span>
                      {slot.notes && (
                        <span className="block text-[8px] font-normal text-slate-500 italic truncate max-w-xs">
                          {slot.notes}
                        </span>
                      )}
                    </td>
                    <td className="py-1 px-2 font-semibold text-slate-800 border border-slate-200 text-[9.5px]">
                      <span>{slot.className}</span>
                      {slot.academicSection && (
                        <span className="text-slate-500 font-normal text-[8.5px] block">
                          {slot.academicSection}
                        </span>
                      )}
                    </td>
                    <td className="py-1 px-1.5 text-center font-medium text-slate-700 border border-slate-200 whitespace-nowrap text-[9.5px]">
                      {slot.room}
                    </td>
                    <td className="py-1 px-1.5 text-center font-mono font-bold text-slate-900 border border-slate-200 whitespace-nowrap text-[9.5px]">
                      {slot.studentsCount ?? slot.enrolledCount ?? 0}
                    </td>
                  </tr>
                ));
              })
            )}
          </tbody>
          {allSlots.length > 0 && (
            <tfoot>
              <tr className="bg-slate-100 font-bold text-slate-800 text-[8.5px] border-t-2 border-slate-400">
                <td colSpan={3} className="py-1 px-2 border border-slate-300 uppercase">
                  Summary: {allSlots.length} Total Periods Allocated
                </td>
                <td colSpan={2} className="py-1 px-2 border border-slate-300 text-slate-600 font-medium">
                  Active Days: {Array.from(new Set(allSlots.map((s) => s.day))).length} Days (Mon – Sat)
                </td>
                <td className="py-1 px-1.5 border border-slate-300 text-center uppercase text-slate-600">
                  Total Enrolled
                </td>
                <td className="py-1 px-1.5 border border-slate-300 text-center font-mono font-black text-slate-900">
                  {allSlots.reduce((acc, curr) => acc + (curr.studentsCount ?? curr.enrolledCount ?? 0), 0)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>

        {/* 3. Formal Sign-Off Footer */}
        <div className="mt-2.5 pt-2 border-t border-slate-300 flex items-end justify-between text-[8.5px] text-slate-600">
          <div className="space-y-0.5">
            <div className="font-semibold text-slate-700">
              Faculty Timetable Administration &bull; MadrasaNexa Institutional Platform
            </div>
            <div className="text-slate-400 font-mono text-[8px]">
              Document Ref: MNX-TT-{new Date().getFullYear()}-{employeeCode || 'UST'} &bull; Official Single-Page A4 Academic Roster
            </div>
          </div>

          <div className="flex items-center gap-10">
            <div className="text-center">
              <div className="w-32 border-b border-slate-400 mb-0.5"></div>
              <span className="font-medium">Ustadh / Teacher Signature</span>
            </div>
            <div className="text-center">
              <div className="w-32 border-b border-slate-400 mb-0.5"></div>
              <span className="font-medium">Academic Mudir / Stamp</span>
            </div>
          </div>
        </div>
      </div>

      {/* Screen Interactive Workspace (Hidden during Print) */}
      <div className="space-y-6 print:hidden">
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
            {slots.length} Total Weekly Classroom Period{slots.length === 1 ? '' : 's'} Allocated
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            <button
              type="button"
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
              type="button"
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
            type="button"
            onClick={handlePrint}
            className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span className="hidden sm:inline">Print Schedule</span>
          </button>
        </div>
      </div>

      {/* 2. Responsive Day Filter Bar (Smooth scrollable without visible ugly scrollbars) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-2 shadow-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth">
          {DAYS.map((day) => {
            const isSelected = selectedDay === day;
            const count = day === 'All'
              ? slots.length
              : slots.filter((s) => s.day.toLowerCase() === day.toLowerCase()).length;

            return (
              <button
                key={day}
                type="button"
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
        <div className="space-y-3.5">
          {filteredSlots.length === 0 ? (
            <EmptyState
              title="No classroom sessions scheduled"
              description="No periods found for the selected day filter."
            />
          ) : (
            filteredSlots.map((slot) => {
              const studentCount = slot.studentsCount ?? slot.enrolledCount ?? 0;

              return (
                <div
                  key={slot.id}
                  className="bg-white rounded-2xl border border-slate-200/90 hover:border-emerald-500/40 p-4 sm:p-5 shadow-xs hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 sm:gap-4 overflow-hidden"
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    {/* WhatsApp-Style Circular Period Badge */}
                    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-[#06241B] to-[#0B1D26] text-[#37C6A3] border-2 border-emerald-500/30 flex items-center justify-center font-black text-sm shrink-0 shadow-xs">
                      P{slot.period}
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      {/* Day, Time Pill & Status Badges */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-800 uppercase tracking-wider font-mono">
                          {slot.day}
                        </span>

                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-slate-100 text-slate-700">
                          <Clock className="w-3 h-3 text-[#0D9488]" />
                          <span>{slot.timeSlot}</span>
                        </div>

                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            slot.status === 'In Progress'
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300 animate-pulse'
                              : slot.status === 'Completed'
                              ? 'bg-slate-100 text-slate-600'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {slot.status}
                        </span>
                      </div>

                      {/* Subject & Class Name in Bold */}
                      <div className="pt-0.5">
                        <h3 className="text-base font-bold text-slate-900 tracking-tight leading-snug">
                          {slot.subject}
                        </h3>
                        <div className="text-xs font-bold text-[#0D9488] flex items-center gap-1.5">
                          <span>{slot.className}</span>
                          {slot.academicSection && (
                            <span className="text-[11px] text-slate-400 font-normal">
                              • {slot.academicSection}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Clean Single-Line Metadata for Classroom & Real Student Count */}
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-slate-600 pt-1">
                        <span className="inline-flex items-center gap-1 font-medium">
                          <MapPin className="w-3.5 h-3.5 text-[#0D9488] shrink-0" />
                          <strong className="text-slate-800">{slot.room}</strong>
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="inline-flex items-center gap-1 font-medium">
                          <Users className="w-3.5 h-3.5 text-[#0D9488] shrink-0" />
                          <span>
                            <strong>{studentCount}</strong> Student{studentCount === 1 ? '' : 's'} Enrolled
                          </span>
                        </span>
                      </div>

                      {/* Note only if present in DB */}
                      {slot.notes && (
                        <p className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-xl border border-slate-200/70 mt-2">
                          <strong>Note:</strong> {slot.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Sleek Session Details Button */}
                  <div className="flex items-center justify-end sm:justify-center self-end sm:self-center shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => setSelectedSession(slot)}
                      className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <span>Session Details</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
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
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs overflow-hidden">
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4 w-32">Period / Time</th>
                  {DAYS.filter((d) => d !== 'All').map((day) => (
                    <th key={day} className="py-3 px-4">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {Array.from(new Set(slots.map((s) => s.period)))
                  .sort((a, b) => a - b)
                  .map((pNum) => {
                    const sampleSlot = slots.find((s) => s.period === pNum);
                    return (
                      <tr key={pNum} className="hover:bg-slate-50/50">
                        <td className="py-3.5 px-4 font-bold text-slate-900 bg-slate-50/40 border-r border-slate-100 align-top">
                          <div className="flex items-center gap-1.5">
                            <span className="w-6 h-6 rounded-full bg-[#0F172A] text-[#37C6A3] font-black text-[11px] flex items-center justify-center">
                              P{pNum}
                            </span>
                            <span>Period {pNum}</span>
                          </div>
                          {sampleSlot && (
                            <div className="text-[10px] text-slate-400 font-mono mt-1">
                              {sampleSlot.timeSlot}
                            </div>
                          )}
                        </td>
                        {DAYS.filter((d) => d !== 'All').map((day) => {
                          const slot = slots.find(
                            (s) =>
                              s.day.toLowerCase() === day.toLowerCase() &&
                              s.period === pNum
                          );
                          return (
                            <td
                              key={day}
                              className="py-3 px-2.5 align-top border-r border-slate-100 last:border-r-0"
                            >
                              {slot ? (
                                <div
                                  onClick={() => setSelectedSession(slot)}
                                  className="p-3 rounded-xl bg-teal-50/70 border border-teal-200/80 hover:bg-teal-100/70 transition-all cursor-pointer space-y-1"
                                >
                                  <div className="font-bold text-slate-900 text-xs line-clamp-1">
                                    {slot.subject}
                                  </div>
                                  <div className="text-[11px] text-[#0D9488] font-bold line-clamp-1">
                                    {slot.className}
                                  </div>
                                  <div className="text-[10px] text-slate-500 pt-1 flex items-center justify-between border-t border-teal-100/80">
                                    <span className="truncate max-w-[80px]">{slot.room}</span>
                                    <span className="font-mono font-bold text-slate-700">
                                      {slot.studentsCount ?? slot.enrolledCount ?? 0}s
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <div className="h-16 rounded-xl border border-dashed border-slate-200 flex items-center justify-center text-[11px] text-slate-400 bg-slate-50/30">
                                  Free
                                </div>
                              )}
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
      )}
      </div>

      {/* 5. Session Details Modal */}
      {selectedSession && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 print:hidden no-print">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
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
                type="button"
                onClick={() => setSelectedSession(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 py-4 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Class Cohort</span>
                <span className="font-bold text-slate-900">{selectedSession.className}</span>
              </div>
              {selectedSession.academicSection && (
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Academic Section</span>
                  <span className="font-semibold text-slate-700">{selectedSession.academicSection}</span>
                </div>
              )}
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Scheduled Time</span>
                <span className="font-mono font-bold text-slate-900">{selectedSession.timeSlot}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Classroom Venue</span>
                <span className="font-semibold text-[#0D9488]">{selectedSession.room}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Enrolled Students</span>
                <span className="font-bold text-slate-900">
                  {selectedSession.studentsCount ?? selectedSession.enrolledCount ?? 0} Students
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Session Status</span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    selectedSession.status === 'In Progress'
                      ? 'bg-emerald-100 text-emerald-900'
                      : selectedSession.status === 'Completed'
                      ? 'bg-slate-100 text-slate-700'
                      : 'bg-amber-50 text-amber-800'
                  }`}
                >
                  {selectedSession.status}
                </span>
              </div>
              {selectedSession.notes && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 mt-2">
                  <span className="font-bold text-slate-700 block mb-0.5">Instructional Notes</span>
                  <p className="text-slate-600 leading-relaxed">{selectedSession.notes}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedSession(null)}
                className="px-4 py-2 text-xs font-bold text-white bg-[#0F172A] hover:bg-slate-800 rounded-xl transition cursor-pointer"
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
