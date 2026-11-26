import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  FileSpreadsheet,
  Save,
  Loader2,
  User,
} from 'lucide-react';
import { Pagination } from '../common/Pagination';
import type { DailyStudentItem } from '../../services/attendance.service';

interface AttendanceStudentListProps {
  students: DailyStudentItem[];
  isSaved: boolean;
  isSaving: boolean;
  onStatusChange: (studentId: string, newStatus: 'PRESENT' | 'ABSENT') => void;
  onMarkAll: (status: 'PRESENT' | 'ABSENT') => void;
  onSave: () => void;
  onExportPdf: () => void;
  onExportCsv: () => void;
  onViewStudentProfile?: (studentId: string) => void;
  isExportingPdf?: boolean;
  isExportingCsv?: boolean;
}

const PAGE_SIZE = 15;

export const AttendanceStudentList: React.FC<AttendanceStudentListProps> = ({
  students,
  isSaved,
  isSaving,
  onStatusChange,
  onMarkAll,
  onSave,
  onExportPdf,
  onExportCsv,
  onViewStudentProfile,
  isExportingPdf = false,
  isExportingCsv = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PRESENT' | 'ABSENT' | 'UNMARKED'>('ALL');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  // Filtered students
  const filteredStudents = useMemo(() => {
    return students.filter((st) => {
      const matchesSearch =
        st.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        st.admissionNo.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      if (statusFilter === 'ALL') return true;
      if (statusFilter === 'PRESENT') return st.status === 'PRESENT';
      if (statusFilter === 'ABSENT') return st.status === 'ABSENT';
      if (statusFilter === 'UNMARKED') return st.status === null;
      return true;
    });
  }, [students, searchTerm, statusFilter]);

  // Pagination
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredStudents.slice(start, start + PAGE_SIZE);
  }, [filteredStudents, currentPage]);

  const unmarkedCount = students.filter((s) => s.status === null).length;
  const canSave = students.length > 0 && unmarkedCount === 0 && !isSaving;

  return (
    <div className="bg-white dark:bg-[#141820] rounded-2xl border border-stone-200/80 dark:border-[#242936] shadow-xs overflow-hidden">
      {/* Action Header & Bulk Controls */}
      <div className="p-3 sm:p-5 border-b border-stone-200/80 dark:border-[#242936] flex flex-col md:flex-row md:items-center md:justify-between gap-3 sm:gap-4 bg-stone-50/50 dark:bg-[#171B24]">
        <div className="flex flex-wrap items-center gap-2">
          {/* Mark All Present */}
          <button
            type="button"
            onClick={() => onMarkAll('PRESENT')}
            disabled={isSaving || students.length === 0}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-500/25 hover:text-emerald-800 dark:hover:text-emerald-200 border border-emerald-200/80 dark:border-emerald-500/30 rounded-xl text-xs font-semibold transition-all shadow-2xs disabled:opacity-50 whitespace-nowrap cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            Mark All Present
          </button>

          {/* Mark All Absent */}
          <button
            type="button"
            onClick={() => onMarkAll('ABSENT')}
            disabled={isSaving || students.length === 0}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-500/25 hover:text-rose-800 dark:hover:text-rose-200 border border-rose-200/80 dark:border-rose-500/30 rounded-xl text-xs font-semibold transition-all shadow-2xs disabled:opacity-50 whitespace-nowrap cursor-pointer"
          >
            <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            Mark All Absent
          </button>
        </div>

        {/* Save & Export Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Daily PDF */}
          <button
            type="button"
            onClick={onExportPdf}
            disabled={isExportingPdf || !isSaved}
            title={!isSaved ? 'Save attendance first to export reports' : 'Download daily PDF report'}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-[#141820] text-stone-700 dark:text-[#D1D5DB] hover:bg-stone-50 dark:hover:bg-[#1C222D] hover:text-stone-900 dark:hover:text-[#F9FAFB] border border-stone-200 dark:border-[#242936] rounded-xl text-xs font-semibold transition-all shadow-2xs disabled:opacity-40 cursor-pointer"
          >
            {isExportingPdf ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FileText className="w-3.5 h-3.5 text-rose-500" />
            )}
            <span>PDF Report</span>
          </button>

          {/* Daily CSV */}
          <button
            type="button"
            onClick={onExportCsv}
            disabled={isExportingCsv || !isSaved}
            title={!isSaved ? 'Save attendance first to export reports' : 'Export daily CSV'}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-[#141820] text-stone-700 dark:text-[#D1D5DB] hover:bg-stone-50 dark:hover:bg-[#1C222D] hover:text-stone-900 dark:hover:text-[#F9FAFB] border border-stone-200 dark:border-[#242936] rounded-xl text-xs font-semibold transition-all shadow-2xs disabled:opacity-40 cursor-pointer"
          >
            {isExportingCsv ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            )}
            <span>Export CSV</span>
          </button>

          {/* Save Attendance */}
          <button
            type="button"
            onClick={onSave}
            disabled={!canSave}
            title={unmarkedCount > 0 ? `${unmarkedCount} students unmarked` : 'Save daily attendance'}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${
              canSave
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20'
                : 'bg-stone-200 text-stone-400 cursor-not-allowed'
            }`}
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>Save Attendance</span>
          </button>
        </div>
      </div>

      {/* Warning banner if unmarked students exist */}
      {unmarkedCount > 0 && (
        <div className="bg-amber-50/80 dark:bg-amber-500/15 border-b border-amber-200/80 dark:border-amber-500/30 px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-800 dark:text-amber-300">
          <div className="flex items-start sm:items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
            <span>
              <strong>{unmarkedCount}</strong> student{unmarkedCount > 1 ? 's are' : ' is'} currently unmarked. Every eligible student must be marked <strong>Present</strong> or <strong>Absent</strong> before saving.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setStatusFilter('UNMARKED')}
            className="text-amber-900 dark:text-amber-200 font-semibold underline hover:text-amber-700 dark:hover:text-amber-100 sm:ml-2 shrink-0 self-start sm:self-auto cursor-pointer"
          >
            View Unmarked
          </button>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="p-4 border-b border-stone-100 dark:border-[#242936] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-stone-400 dark:text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search student or admission no..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-3 py-1.5 bg-stone-50 dark:bg-[#141820] border border-stone-200 dark:border-[#242936] rounded-lg text-xs text-stone-800 dark:text-[#F9FAFB] placeholder-stone-400 dark:placeholder-[#6B7280] focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>

        {/* Status Filter Chips */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          {(['ALL', 'PRESENT', 'ABSENT', 'UNMARKED'] as const).map((filter) => {
            const count =
              filter === 'ALL'
                ? students.length
                : filter === 'PRESENT'
                ? students.filter((s) => s.status === 'PRESENT').length
                : filter === 'ABSENT'
                ? students.filter((s) => s.status === 'ABSENT').length
                : students.filter((s) => s.status === null).length;

            return (
              <button
                key={filter}
                type="button"
                onClick={() => {
                  setStatusFilter(filter);
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  statusFilter === filter
                    ? 'bg-stone-900 dark:bg-[#84CC16] text-white dark:text-[#0B0D11] shadow-xs font-bold'
                    : 'bg-stone-100 dark:bg-[#1C222D] text-stone-600 dark:text-[#9CA3AF] hover:bg-stone-200 dark:hover:bg-[#242936] dark:hover:text-[#F9FAFB] border border-transparent dark:border-[#242936]'
                }`}
              >
                {filter === 'ALL' ? 'All' : filter.charAt(0) + filter.slice(1).toLowerCase()} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Student Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[540px] text-left text-xs border-collapse">
          <thead>
            <tr className="bg-stone-50/80 dark:bg-[#171B24] border-b border-stone-200/80 dark:border-[#242936] text-stone-500 dark:text-[#9CA3AF] font-semibold uppercase tracking-wider">
              <th className="py-3 px-4 w-12 text-center">#</th>
              <th className="py-3 px-4 w-32">Admission No</th>
              <th className="py-3 px-4">Student Name</th>
              <th className="py-3 px-4 w-52 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 dark:divide-[#242936]">
            {paginatedStudents.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-12 text-center text-stone-400 dark:text-[#6B7280]">
                  <div className="flex flex-col items-center justify-center">
                    <User className="w-8 h-8 text-stone-300 dark:text-[#4B5563] mb-2" />
                    <span>No students match the current filter.</span>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedStudents.map((st, idx) => {
                const globalIndex = (currentPage - 1) * PAGE_SIZE + idx + 1;
                const isPresent = st.status === 'PRESENT';
                const isAbsent = st.status === 'ABSENT';
                const isUnmarked = st.status === null;

                return (
                  <tr
                    key={st.studentId}
                    className={`hover:bg-stone-50/60 dark:hover:bg-[#1C222D] transition-colors ${
                      isUnmarked ? 'bg-amber-50/20 dark:bg-amber-500/5' : ''
                    }`}
                  >
                    {/* Index */}
                    <td className="py-3 px-4 text-center text-stone-400 dark:text-[#6B7280] font-mono">
                      {globalIndex}
                    </td>

                    {/* Admission No */}
                    <td className="py-3 px-4 font-mono font-medium text-stone-600 dark:text-[#D1D5DB]">
                      {st.admissionNo}
                    </td>

                    {/* Student Name & Profile Link */}
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap items-center gap-2 min-w-0">
                        {onViewStudentProfile ? (
                          <button
                            type="button"
                            onClick={() => onViewStudentProfile(st.studentId)}
                            className="font-semibold text-stone-900 dark:text-[#F9FAFB] hover:text-emerald-700 dark:hover:text-emerald-400 hover:underline text-left transition-colors break-words cursor-pointer"
                          >
                            {st.fullName}
                          </button>
                        ) : (
                          <span className="font-semibold text-stone-900 dark:text-[#F9FAFB] break-words">{st.fullName}</span>
                        )}
                        {isUnmarked && (
                          <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-transparent dark:border-amber-500/30">
                            Unmarked
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Segmented Present / Absent Controls */}
                    <td className="py-2.5 px-4 text-center">
                      <div className="inline-flex p-0.5 rounded-xl bg-stone-100 dark:bg-[#141820] border border-stone-200 dark:border-[#242936] shadow-2xs">
                        {/* PRESENT Toggle */}
                        <button
                          type="button"
                          onClick={() => onStatusChange(st.studentId, 'PRESENT')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                            isPresent
                              ? 'bg-emerald-600 dark:bg-emerald-500 text-white shadow-xs'
                              : 'text-stone-600 dark:text-[#9CA3AF] hover:text-stone-900 dark:hover:text-[#F9FAFB] hover:bg-stone-200/50 dark:hover:bg-[#1C222D]'
                          }`}
                        >
                          <CheckCircle2 className={`w-3.5 h-3.5 ${isPresent ? 'text-white' : 'text-stone-400 dark:text-[#6B7280]'}`} />
                          <span>Present</span>
                        </button>

                        {/* ABSENT Toggle */}
                        <button
                          type="button"
                          onClick={() => onStatusChange(st.studentId, 'ABSENT')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                            isAbsent
                              ? 'bg-rose-600 dark:bg-rose-500 text-white shadow-xs'
                              : 'text-stone-600 dark:text-[#9CA3AF] hover:text-stone-900 dark:hover:text-[#F9FAFB] hover:bg-stone-200/50 dark:hover:bg-[#1C222D]'
                          }`}
                        >
                          <XCircle className={`w-3.5 h-3.5 ${isAbsent ? 'text-white' : 'text-stone-400 dark:text-[#6B7280]'}`} />
                          <span>Absent</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination & Bottom Summary */}
      <Pagination
        currentPage={currentPage}
        totalItems={filteredStudents.length}
        pageSize={PAGE_SIZE}
        onPageChange={setCurrentPage}
        itemLabel="students"
        className="border-t border-stone-200/80 bg-stone-50/50"
      />
    </div>
  );
};
