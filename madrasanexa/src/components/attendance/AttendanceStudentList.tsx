import React, { useState, useMemo } from 'react';
import {
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  FileSpreadsheet,
  Save,
  Loader2,
  ChevronLeft,
  ChevronRight,
  User,
} from 'lucide-react';
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

const PAGE_SIZE = 50;

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
  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / PAGE_SIZE));
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredStudents.slice(start, start + PAGE_SIZE);
  }, [filteredStudents, currentPage]);

  const unmarkedCount = students.filter((s) => s.status === null).length;
  const canSave = students.length > 0 && unmarkedCount === 0 && !isSaving;

  return (
    <div className="bg-white rounded-2xl border border-stone-200/80 shadow-xs overflow-hidden">
      {/* Action Header & Bulk Controls */}
      <div className="p-4 sm:p-5 border-b border-stone-200/80 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-stone-50/50">
        <div className="flex flex-wrap items-center gap-2">
          {/* Mark All Present */}
          <button
            type="button"
            onClick={() => onMarkAll('PRESENT')}
            disabled={isSaving || students.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 border border-emerald-200/80 rounded-xl text-xs font-semibold transition-all shadow-2xs disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            Mark All Present
          </button>

          {/* Mark All Absent */}
          <button
            type="button"
            onClick={() => onMarkAll('ABSENT')}
            disabled={isSaving || students.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:text-rose-800 border border-rose-200/80 rounded-xl text-xs font-semibold transition-all shadow-2xs disabled:opacity-50"
          >
            <XCircle className="w-4 h-4 text-rose-600" />
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
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white text-stone-700 hover:bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold transition-all shadow-2xs disabled:opacity-40"
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
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white text-stone-700 hover:bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold transition-all shadow-2xs disabled:opacity-40"
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
        <div className="bg-amber-50/80 border-b border-amber-200/80 px-4 py-2.5 flex items-center justify-between text-xs text-amber-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>{unmarkedCount}</strong> student{unmarkedCount > 1 ? 's are' : ' is'} currently unmarked. Every eligible student must be marked <strong>Present</strong> or <strong>Absent</strong> before saving.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setStatusFilter('UNMARKED')}
            className="text-amber-900 font-semibold underline hover:text-amber-700 ml-2 shrink-0"
          >
            View Unmarked
          </button>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="p-4 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search student or admission no..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-800 placeholder-stone-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
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
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  statusFilter === filter
                    ? 'bg-stone-900 text-white'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
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
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-stone-50/80 border-b border-stone-200/80 text-stone-500 font-semibold uppercase tracking-wider">
              <th className="py-3 px-4 w-12 text-center">#</th>
              <th className="py-3 px-4 w-32">Admission No</th>
              <th className="py-3 px-4">Student Name</th>
              <th className="py-3 px-4 w-52 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {paginatedStudents.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-12 text-center text-stone-400">
                  <div className="flex flex-col items-center justify-center">
                    <User className="w-8 h-8 text-stone-300 mb-2" />
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
                    className={`hover:bg-stone-50/60 transition-colors ${
                      isUnmarked ? 'bg-amber-50/20' : ''
                    }`}
                  >
                    {/* Index */}
                    <td className="py-3 px-4 text-center text-stone-400 font-mono">
                      {globalIndex}
                    </td>

                    {/* Admission No */}
                    <td className="py-3 px-4 font-mono font-medium text-stone-600">
                      {st.admissionNo}
                    </td>

                    {/* Student Name & Profile Link */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {onViewStudentProfile ? (
                          <button
                            type="button"
                            onClick={() => onViewStudentProfile(st.studentId)}
                            className="font-semibold text-stone-900 hover:text-emerald-700 hover:underline text-left transition-colors"
                          >
                            {st.fullName}
                          </button>
                        ) : (
                          <span className="font-semibold text-stone-900">{st.fullName}</span>
                        )}
                        {isUnmarked && (
                          <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">
                            Unmarked
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Segmented Present / Absent Controls */}
                    <td className="py-2.5 px-4 text-center">
                      <div className="inline-flex p-0.5 rounded-xl bg-stone-100 border border-stone-200 shadow-2xs">
                        {/* PRESENT Toggle */}
                        <button
                          type="button"
                          onClick={() => onStatusChange(st.studentId, 'PRESENT')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                            isPresent
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
                          }`}
                        >
                          <CheckCircle2 className={`w-3.5 h-3.5 ${isPresent ? 'text-white' : 'text-stone-400'}`} />
                          <span>Present</span>
                        </button>

                        {/* ABSENT Toggle */}
                        <button
                          type="button"
                          onClick={() => onStatusChange(st.studentId, 'ABSENT')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                            isAbsent
                              ? 'bg-rose-600 text-white shadow-xs'
                              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
                          }`}
                        >
                          <XCircle className={`w-3.5 h-3.5 ${isAbsent ? 'text-white' : 'text-stone-400'}`} />
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
      <div className="p-4 border-t border-stone-200/80 bg-stone-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-500">
        <div>
          Showing {paginatedStudents.length > 0 ? (currentPage - 1) * PAGE_SIZE + 1 : 0} to{' '}
          {Math.min(currentPage * PAGE_SIZE, filteredStudents.length)} of {filteredStudents.length} students
          {filteredStudents.length !== students.length ? ` (filtered from ${students.length})` : ''}
        </div>

        {/* Page navigation */}
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-stone-200 text-stone-600 hover:bg-white disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 font-semibold text-stone-700">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg border border-stone-200 text-stone-600 hover:bg-white disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
