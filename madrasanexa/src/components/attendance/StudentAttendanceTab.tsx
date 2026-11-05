import React, { useState, useEffect, useCallback } from 'react';
import {
  User,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowLeft,
} from 'lucide-react';
import {
  getStudentAttendance,
  type StudentAttendanceData,
} from '../../services/attendance.service';

interface StudentAttendanceTabProps {
  studentId: string | null;
  classId?: string;
  academicYear: string;
  onBack: () => void;
  onSelectAnotherStudent?: (studentId: string) => void;
  availableStudents?: Array<{ studentId: string; admissionNo: string; fullName: string }>;
}

export const StudentAttendanceTab: React.FC<StudentAttendanceTabProps> = ({
  studentId,
  classId,
  academicYear,
  onBack,
  onSelectAnotherStudent,
  availableStudents = [],
}) => {
  const [data, setData] = useState<StudentAttendanceData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string>(studentId || '');

  useEffect(() => {
    if (studentId) {
      setSelectedStudentId(studentId);
    }
  }, [studentId]);

  const loadStudentProfile = useCallback(async () => {
    if (!selectedStudentId) return;
    try {
      setIsLoading(true);
      const res = await getStudentAttendance(selectedStudentId, {
        classId: classId || undefined,
        academicYear: academicYear || undefined,
      });
      setData(res);
    } catch (err) {
      console.error('Failed to load student attendance summary', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedStudentId, classId, academicYear]);

  useEffect(() => {
    loadStudentProfile();
  }, [loadStudentProfile]);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h3 className="text-sm font-bold text-stone-900">Student Attendance Profile</h3>
            <p className="text-xs text-stone-500">Historical presence records and overall consistency</p>
          </div>
        </div>

        {/* Student Dropdown Switcher */}
        {availableStudents.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-stone-500">Switch Student:</span>
            <select
              value={selectedStudentId}
              onChange={(e) => {
                setSelectedStudentId(e.target.value);
                if (onSelectAnotherStudent) onSelectAnotherStudent(e.target.value);
              }}
              className="h-10 px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 font-medium"
            >
              <option value="">-- Select Student --</option>
              {availableStudents.map((s) => (
                <option key={s.studentId} value={s.studentId}>
                  {s.fullName} ({s.admissionNo})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="bg-white rounded-2xl border border-stone-200/80 p-12 text-center text-stone-400">
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
            <span className="text-sm">Loading student profile...</span>
          </div>
        </div>
      ) : !data ? (
        <div className="bg-white rounded-2xl border border-stone-200/80 p-12 text-center text-stone-400">
          <User className="w-8 h-8 text-stone-300 mx-auto mb-2" />
          <p className="text-sm">Select a student to view their attendance profile.</p>
        </div>
      ) : (
        <>
          {/* Student Info & Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Student Info Card */}
            <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-stone-900 text-emerald-400 font-bold text-base flex items-center justify-center shrink-0">
                {data.student.fullName.charAt(0)}
              </div>
              <div className="overflow-hidden">
                <h4 className="font-bold text-sm text-stone-900 truncate">{data.student.fullName}</h4>
                <p className="text-xs text-stone-500 font-mono">Adm: {data.student.admissionNo}</p>
                <p className="text-[11px] text-stone-400">{data.student.className}</p>
              </div>
            </div>

            {/* Present Days */}
            <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-xs">
              <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Present Days</div>
              <div className="mt-2 text-2xl font-bold text-emerald-600">{data.summary.presentDays}</div>
              <div className="mt-1 text-[11px] text-stone-400">Attended sessions</div>
            </div>

            {/* Absent Days */}
            <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-xs">
              <div className="text-xs font-semibold text-rose-600 uppercase tracking-wider">Absent Days</div>
              <div className="mt-2 text-2xl font-bold text-rose-600">{data.summary.absentDays}</div>
              <div className="mt-1 text-[11px] text-stone-400">Missed sessions</div>
            </div>

            {/* Attendance Percentage */}
            <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-xs">
              <div className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Overall Rate</div>
              <div className="mt-2 text-2xl font-bold text-stone-900">
                {data.summary.attendancePercentage.toFixed(1)}%
              </div>
              <div className="mt-1 text-[11px] text-stone-400">
                Out of {data.summary.recordedDays} total sessions
              </div>
            </div>
          </div>

          {/* Session History Table */}
          <div className="bg-white rounded-2xl border border-stone-200/80 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-stone-200/80 bg-stone-50/50 flex items-center justify-between">
              <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                Session Log ({data.history.length})
              </h4>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-stone-50/80 border-b border-stone-200/80 text-stone-500 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4 w-12 text-center">#</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Academic Year</th>
                    <th className="py-3 px-4">Class</th>
                    <th className="py-3 px-4 text-center w-36">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {data.history.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-stone-400">
                        No recorded sessions found for this student.
                      </td>
                    </tr>
                  ) : (
                    data.history.map((h, idx) => {
                      const isPresent = h.status === 'PRESENT';
                      return (
                        <tr key={h.id} className="hover:bg-stone-50/60 transition-colors">
                          <td className="py-3 px-4 text-center text-stone-400 font-mono">{idx + 1}</td>
                          <td className="py-3 px-4 font-semibold text-stone-900">{h.date}</td>
                          <td className="py-3 px-4 font-mono text-stone-600">{h.academicYear}</td>
                          <td className="py-3 px-4 text-stone-700">{h.className}</td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                                isPresent
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}
                            >
                              {isPresent ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <XCircle className="w-3.5 h-3.5 text-rose-600" />
                              )}
                              <span>{isPresent ? 'Present' : 'Absent'}</span>
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
        </>
      )}
    </div>
  );
};
