import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  FileSpreadsheet,
  Loader2,
  Users,
  CalendarDays,
} from 'lucide-react';
import {
  getMonthlySummary,
  downloadMonthlyPdf,
  downloadMonthlyCsv,
  type MonthlySummaryData,
} from '../../services/attendance.service';

interface MonthlySummaryTabProps {
  classId: string;
  academicYear: string;
  onViewStudentProfile?: (studentId: string) => void;
}

export const MonthlySummaryTab: React.FC<MonthlySummaryTabProps> = ({
  classId,
  academicYear,
  onViewStudentProfile,
}) => {
  // Default to current month YYYY-MM
  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [data, setData] = useState<MonthlySummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);

  const loadSummary = useCallback(async () => {
    if (!classId || !selectedMonth) return;
    try {
      setIsLoading(true);
      const res = await getMonthlySummary({
        classId,
        academicYear: academicYear || undefined,
        month: selectedMonth,
      });
      setData(res);
    } catch (err) {
      console.error('Failed to load monthly attendance summary', err);
    } finally {
      setIsLoading(false);
    }
  }, [classId, academicYear, selectedMonth]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const handleDownloadPdf = async () => {
    if (!classId || !selectedMonth) return;
    try {
      setIsExportingPdf(true);
      await downloadMonthlyPdf(
        { classId, academicYear, month: selectedMonth },
        `Monthly_Attendance_${data?.className || 'Class'}_${selectedMonth}.pdf`
      );
    } catch (err) {
      console.error('Failed to download monthly PDF', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleDownloadCsv = async () => {
    if (!classId || !selectedMonth) return;
    try {
      setIsExportingCsv(true);
      await downloadMonthlyCsv(
        { classId, academicYear, month: selectedMonth },
        `Monthly_Attendance_${data?.className || 'Class'}_${selectedMonth}.csv`
      );
    } catch (err) {
      console.error('Failed to download monthly CSV', err);
    } finally {
      setIsExportingCsv(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Monthly Controls Bar */}
      <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-stone-900">Monthly Attendance Analytics</h3>
            <p className="text-xs text-stone-500">Comprehensive monthly performance and individual student rates</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Month Selector */}
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="h-10 px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 font-medium"
          />

          {/* Monthly PDF Export */}
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isExportingPdf || !data || data.summary.totalAttendanceDays === 0}
            className="inline-flex items-center gap-1.5 h-10 px-3.5 bg-white text-stone-700 hover:bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold transition-all shadow-2xs disabled:opacity-40"
          >
            {isExportingPdf ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileText className="w-4 h-4 text-rose-500" />
            )}
            <span>Monthly PDF</span>
          </button>

          {/* Monthly CSV Export */}
          <button
            type="button"
            onClick={handleDownloadCsv}
            disabled={isExportingCsv || !data || data.summary.totalAttendanceDays === 0}
            className="inline-flex items-center gap-1.5 h-10 px-3.5 bg-white text-stone-700 hover:bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold transition-all shadow-2xs disabled:opacity-40"
          >
            {isExportingCsv ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            )}
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Total Days */}
          <div className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-xs">
            <div className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Days Recorded</div>
            <div className="mt-2 text-2xl font-bold text-stone-900">{data.summary.totalAttendanceDays}</div>
            <div className="mt-1 text-[11px] text-stone-400">Class sessions this month</div>
          </div>

          {/* Monthly Class Rate */}
          <div className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-xs">
            <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Class Overall Rate</div>
            <div className="mt-2 text-2xl font-bold text-emerald-600">
              {data.summary.monthlyClassRate.toFixed(1)}%
            </div>
            <div className="mt-1 text-[11px] text-stone-400">
              {data.summary.totalPresentRecords} / {data.summary.totalRecordedRecords} present records
            </div>
          </div>

          {/* Average Daily Rate */}
          <div className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-xs">
            <div className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Avg Daily Rate</div>
            <div className="mt-2 text-2xl font-bold text-blue-600">
              {data.summary.averageDailyRate.toFixed(1)}%
            </div>
            <div className="mt-1 text-[11px] text-stone-400">Mean of daily sessions</div>
          </div>

          {/* Unique Students */}
          <div className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-xs">
            <div className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Enrolled Students</div>
            <div className="mt-2 text-2xl font-bold text-stone-900">{data.summary.totalStudents}</div>
            <div className="mt-1 text-[11px] text-stone-400">Recorded in this month</div>
          </div>
        </div>
      )}

      {/* Student Monthly Table */}
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-stone-200/80 bg-stone-50/50 flex items-center justify-between">
          <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
            Student Attendance Roster ({data?.students.length || 0})
          </h4>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-stone-50/80 border-b border-stone-200/80 text-stone-500 font-semibold uppercase tracking-wider">
                <th className="py-3 px-4 w-12 text-center">#</th>
                <th className="py-3 px-4 w-32">Admission No</th>
                <th className="py-3 px-4">Student Name</th>
                <th className="py-3 px-4 text-center">Present Days</th>
                <th className="py-3 px-4 text-center">Absent Days</th>
                <th className="py-3 px-4 text-center">Recorded Days</th>
                <th className="py-3 px-4 text-center w-36">Monthly Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-stone-400">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                      <span>Calculating monthly analytics...</span>
                    </div>
                  </td>
                </tr>
              ) : !data || data.students.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-stone-400">
                    <div className="flex flex-col items-center justify-center">
                      <Users className="w-8 h-8 text-stone-300 mb-2" />
                      <span>No attendance records found for this month.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                data.students.map((st, idx) => {
                  const rate = st.attendancePercentage;
                  const isLow = rate < 75.0;

                  return (
                    <tr key={st.studentId} className="hover:bg-stone-50/60 transition-colors">
                      <td className="py-3 px-4 text-center text-stone-400 font-mono">{idx + 1}</td>
                      <td className="py-3 px-4 font-mono font-medium text-stone-600">{st.admissionNo}</td>
                      <td className="py-3 px-4">
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
                      </td>
                      <td className="py-3 px-4 text-center font-semibold text-emerald-700">{st.presentDays}</td>
                      <td className="py-3 px-4 text-center font-semibold text-rose-700">{st.absentDays}</td>
                      <td className="py-3 px-4 text-center font-medium text-stone-700">{st.recordedDays}</td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                            isLow
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          {rate.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
