import React from 'react';
import { Users, UserCheck, UserX, AlertCircle, CheckCircle2, Clock } from 'lucide-react';

interface AttendanceSummaryCardsProps {
  totalStudents: number;
  presentCount: number;
  absentCount: number;
  notMarkedCount: number;
  attendanceRate: number;
  isSaved: boolean;
  isDirty: boolean;
  updatedAt?: string | null;
}

export const AttendanceSummaryCards: React.FC<AttendanceSummaryCardsProps> = ({
  totalStudents,
  presentCount,
  absentCount,
  notMarkedCount,
  attendanceRate,
  isSaved,
  isDirty,
  updatedAt,
}) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
      {/* Total Students */}
      <div className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Total</span>
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Users className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-1">
          <span className="text-2xl font-bold text-stone-900">{totalStudents}</span>
          <span className="text-xs text-stone-500 font-medium">students</span>
        </div>
        <div className="mt-1 text-[11px] text-stone-400">Enrolled & eligible</div>
      </div>

      {/* Present Count */}
      <div className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Present</span>
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <UserCheck className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-1">
          <span className="text-2xl font-bold text-emerald-600">{presentCount}</span>
          <span className="text-xs text-stone-500 font-medium">marked</span>
        </div>
        <div className="mt-1 text-[11px] text-stone-400">
          {totalStudents > 0 ? `${((presentCount / totalStudents) * 100).toFixed(1)}% of class` : '0%'}
        </div>
      </div>

      {/* Absent Count */}
      <div className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-rose-600 uppercase tracking-wider">Absent</span>
          <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <UserX className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-1">
          <span className="text-2xl font-bold text-rose-600">{absentCount}</span>
          <span className="text-xs text-stone-500 font-medium">marked</span>
        </div>
        <div className="mt-1 text-[11px] text-stone-400">
          {totalStudents > 0 ? `${((absentCount / totalStudents) * 100).toFixed(1)}% of class` : '0%'}
        </div>
      </div>

      {/* Not Marked / Unmarked Count */}
      <div className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Unmarked</span>
          <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <AlertCircle className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-1">
          <span className={`text-2xl font-bold ${notMarkedCount > 0 ? 'text-amber-600' : 'text-stone-900'}`}>
            {notMarkedCount}
          </span>
          <span className="text-xs text-stone-500 font-medium">pending</span>
        </div>
        <div className="mt-1 text-[11px] text-stone-400">
          {notMarkedCount === 0 ? 'All students marked' : 'Requires marking'}
        </div>
      </div>

      {/* Attendance Rate & Status */}
      <div className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-xs col-span-2 sm:col-span-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Daily Rate</span>
          {isDirty ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
              <Clock className="w-3 h-3" /> Unsaved
            </span>
          ) : isSaved ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
              <CheckCircle2 className="w-3 h-3" /> Saved
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 text-stone-600">
              New
            </span>
          )}
        </div>
        <div className="mt-2 flex items-baseline gap-1">
          <span className="text-2xl font-bold text-stone-900">{attendanceRate.toFixed(1)}%</span>
        </div>
        <div className="mt-1 text-[11px] text-stone-400 truncate">
          {updatedAt ? `Saved ${new Date(updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Not persisted yet'}
        </div>
      </div>
    </div>
  );
};
