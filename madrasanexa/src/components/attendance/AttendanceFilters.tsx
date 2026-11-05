import React from 'react';
import { BookOpen, Calendar, CalendarDays } from 'lucide-react';

interface AttendanceFiltersProps {
  classes: Array<{ id: string; name: string; code?: string | null }>;
  selectedClassId: string;
  selectedAcademicYear: string;
  selectedDate: string;
  onSelectClassId: (id: string) => void;
  onSelectAcademicYear: (year: string) => void;
  onSelectDate: (date: string) => void;
  isLoadingClasses?: boolean;
}

const COMMON_ACADEMIC_YEARS = [
  '2024/2025',
  '2025/2026',
  '2026/2027',
  '2027/2028',
];

export const AttendanceFilters: React.FC<AttendanceFiltersProps> = ({
  classes,
  selectedClassId,
  selectedAcademicYear,
  selectedDate,
  onSelectClassId,
  onSelectAcademicYear,
  onSelectDate,
  isLoadingClasses = false,
}) => {
  return (
    <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-xs mb-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Class Selector */}
        <div>
          <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-stone-400" />
            Class
          </label>
          <select
            value={selectedClassId}
            onChange={(e) => onSelectClassId(e.target.value)}
            disabled={isLoadingClasses}
            className="w-full h-10 px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium disabled:opacity-50"
          >
            <option value="">-- Select Class --</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.code ? `(${c.code})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Academic Year Selector */}
        <div>
          <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-stone-400" />
            Academic Year
          </label>
          <select
            value={selectedAcademicYear}
            onChange={(e) => onSelectAcademicYear(e.target.value)}
            className="w-full h-10 px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
          >
            {COMMON_ACADEMIC_YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        {/* Attendance Date Selector */}
        <div>
          <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5 text-stone-400" />
            Attendance Date
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => onSelectDate(e.target.value)}
            className="w-full h-10 px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
          />
        </div>
      </div>
    </div>
  );
};
