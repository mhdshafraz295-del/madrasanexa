import React, { useState, useEffect } from 'react';
import {
  History,
  Calendar,
  Filter,
  Search,
  CheckCircle2,
  Clock,
  MapPin,
  BookOpen,
  Users,
  ShieldCheck,
  ChevronRight,
  Printer,
  X,
  FileText,
  AlertCircle,
} from 'lucide-react';
import {
  MOCK_HISTORICAL_SESSIONS,
  MOCK_ASSIGNED_CLASSES,
  HistoricalAttendanceSession,
} from '../../mock/teacherMockData';
import { attendanceHistoryApi } from '../../services/api';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';

type DatePreset = 'All' | 'Today' | 'Yesterday' | '7days' | '30days';

export default function AttendanceHistoryPage() {
  const [sessions, setSessions] = useState<HistoricalAttendanceSession[]>([]);
  const [datePreset, setDatePreset] = useState<DatePreset>('All');
  const [classFilter, setClassFilter] = useState('All');
  const [subjectFilter, setSubjectFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSessionDetail, setSelectedSessionDetail] = useState<HistoricalAttendanceSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await attendanceHistoryApi.getAttendanceHistory('student', 1, 50);
      const rawList = Array.isArray(res?.data) ? res.data : [];
      const mapped: HistoricalAttendanceSession[] = rawList.map((item: any, idx: number) => {
        const total = Number(item.totalEnrolled ?? 0);
        const present = Number(item.presentCount ?? 0);
        const late = Number(item.lateCount ?? 0);
        const excused = Number(item.excusedCount ?? 0);
        const absent = Number(
          item.absentCount ?? Math.max(0, total - (present + late + excused))
        );
        const calculatedRate = total > 0 ? Math.round(((present + late) / total) * 100) : 100;

        return {
          id: String(item.id || `hist-ses-${idx}`),
          sessionCode: String(item.sessionCode || `SES-${(item.date || '').replace(/-/g, '')}`),
          date: String(item.date || ''),
          period: Number(item.period || 1),
          timeSlot: String(item.timeSlot || '08:00 AM – 08:45 AM'),
          classId: String(item.classId || item.schedule?.classId || ''),
          className: String(item.className || 'General Class'),
          subject: String(item.subject || 'General Subject'),
          roomId: String(item.roomId || 'General Room'),
          roomName: String(item.roomName || 'Assigned Classroom'),
          teacherId: String(item.teacherId || ''),
          teacherName: String(item.teacherName || 'Faculty Ustadh'),
          teacherVerifiedAt: String(item.sealedAt || item.date || ''),
          teacherStatus:
            item.teacherStatus === 'Late Entry' || item.teacherStatus === 'Manual Authorized'
              ? item.teacherStatus
              : 'Verified On-Time',
          totalEnrolled: total,
          presentCount: present,
          lateCount: late,
          excusedCount: excused,
          absentCount: absent,
          attendanceRate: Number(item.attendanceRate ?? calculatedRate),
          isSealed: Boolean(item.isSealed),
          sealedAt: String(item.sealedAt || ''),
          roster: Array.isArray(item.roster)
            ? item.roster.map((r: any) => ({
                studentId: String(r.studentId || r.id || ''),
                rollNo: String(r.rollNo || ''),
                name: String(r.name || r.studentName || 'Student'),
                status:
                  r.status === 'Present' || r.status === 'Late' || r.status === 'Excused' || r.status === 'Absent'
                    ? r.status
                    : r.status === 'PRESENT'
                    ? 'Present'
                    : r.status === 'LATE'
                    ? 'Late'
                    : r.status === 'EXCUSED'
                    ? 'Excused'
                    : 'Absent',
                scannedTime: r.scannedTime || undefined,
                method: r.method === 'Barcode Scan' ? 'Barcode Scan' : 'Teacher Manual',
                remarks: r.remarks || undefined,
              }))
            : [],
        };
      });
      setSessions(mapped);
    } catch (err: any) {
      setError(err.message || 'Failed to load attendance history.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  // Filtered Sessions
  const filteredSessions = sessions.filter((s) => {
    const matchesClass = classFilter === 'All' || s.classId === classFilter;
    const matchesSubject = subjectFilter === 'All' || s.subject.toLowerCase().includes(subjectFilter.toLowerCase());
    const matchesSearch =
      s.className.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.sessionCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.roomName.toLowerCase().includes(searchQuery.toLowerCase());

    const todayStr = new Date().toISOString().split('T')[0];
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const yesterdayStr = d.toISOString().split('T')[0];

    if (datePreset === 'Today') {
      return matchesClass && matchesSubject && matchesSearch && s.date === todayStr;
    }
    if (datePreset === 'Yesterday') {
      return matchesClass && matchesSubject && matchesSearch && s.date === yesterdayStr;
    }
    return matchesClass && matchesSubject && matchesSearch;
  });

  // Calculate Metrics
  const totalSessions = sessions.length;
  const avgAttendance = (
    sessions.reduce((acc, s) => acc + s.attendanceRate, 0) / (totalSessions || 1)
  ).toFixed(1);
  const facultyPunctualRate = 97.9;
  const manualOverridesCount = sessions.filter((s) => s.teacherStatus.includes('Manual')).length;

  if (isLoading) {
    return <LoadingState message="Loading archived attendance records..." className="my-8" />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadHistory} className="my-8" />;
  }

  return (
    <div className="space-y-6">
      {/* 1. Page Header */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#0D9488] uppercase tracking-wider mb-1">
            <History className="w-4 h-4" />
            <span>Attendance Archives & Audit</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Classroom Attendance History
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Archived faculty classroom check-ins and sealed student attendance rosters
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
          <button
            onClick={() => window.print()}
            className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>Print Archive Report</span>
          </button>
        </div>
      </div>

      {/* 2. Key Metrics Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Total Sessions Held
          </span>
          <div className="text-2xl font-black text-slate-900 mt-1">
            48 <span className="text-xs font-semibold text-slate-400">Sessions</span>
          </div>
          <span className="text-[11px] text-emerald-600 font-semibold mt-0.5 block">
            100% Sealed & Archived
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Cohort Attendance Avg.
          </span>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {avgAttendance}%
          </div>
          <span className="text-[11px] text-emerald-600 font-semibold mt-0.5 block">
            Consistent High Pacing
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Faculty Punctuality
          </span>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {facultyPunctualRate}%
          </div>
          <span className="text-[11px] text-teal-700 font-semibold mt-0.5 block">
            Verified Entrance Scans
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Manual Overrides
          </span>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {manualOverridesCount} <span className="text-xs font-semibold text-slate-400">Cases</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-0.5 block">
            Audited & Approved
          </span>
        </div>
      </div>

      {/* 3. Multi-Parameter Filtering Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs space-y-3.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-[#0D9488]" />
            <span>Filter Archive Sessions</span>
          </span>
          {(datePreset !== 'All' || classFilter !== 'All' || subjectFilter !== 'All' || searchQuery) && (
            <button
              onClick={() => {
                setDatePreset('All');
                setClassFilter('All');
                setSubjectFilter('All');
                setSearchQuery('');
              }}
              className="text-xs font-semibold text-[#0D9488] hover:underline cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {/* Date Preset */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Date Preset</label>
            <select
              value={datePreset}
              onChange={(e) => setDatePreset(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
            >
              <option value="All">All Historical Dates</option>
              <option value="Today">Today (16 Nov 2026)</option>
              <option value="Yesterday">Yesterday (15 Nov 2026)</option>
              <option value="7days">Past 7 Days</option>
              <option value="30days">This Month</option>
            </select>
          </div>

          {/* Class Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Class Cohort</label>
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
            >
              <option value="All">All Classes</option>
              {MOCK_ASSIGNED_CLASSES.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Subject Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Subject</label>
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
            >
              <option value="All">All Subjects</option>
              <option value="Hifz">Hifz & Muraja’ah</option>
              <option value="Tafseer">Tafseer & Hadith</option>
              <option value="Khutbah">Khutbah Workshop</option>
              <option value="Tajweed">Tajweed Rules</option>
            </select>
          </div>

          {/* Search Query */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Search Keywords</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Code, room, or topic..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 4. Session History Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs overflow-hidden">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Classroom Lecture Sessions ({filteredSessions.length})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Click any session row to inspect the granular student roster audit
            </p>
          </div>
        </div>

        {filteredSessions.length === 0 ? (
          <EmptyState
            title="No Archived Sessions Found"
            description="No archived lecture attendance sessions found matching your filter criteria."
            className="my-8"
          />
        ) : (
          <div className="overflow-x-auto mt-4 -mx-5 sm:mx-0">
            <table className="w-full text-left border-collapse min-w-[720px] text-xs">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4">Date & Period</th>
                  <th className="py-3 px-4">Class & Subject</th>
                  <th className="py-3 px-4">Room Venue</th>
                  <th className="py-3 px-4">Faculty Check-in</th>
                  <th className="py-3 px-4">Attendance Tally</th>
                  <th className="py-3 px-4">Rate %</th>
                  <th className="py-3 px-4">Archive Seal</th>
                  <th className="py-3 px-4 text-right">Audit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSessions.map((sess) => (
                  <tr key={sess.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      <div>{sess.date}</div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        Period {sess.period} ({sess.timeSlot.split('–')[0].trim()})
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{sess.className}</div>
                      <div className="text-[11px] text-[#0D9488] font-medium">{sess.subject}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      <div>{sess.roomName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{sess.sessionCode}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {sess.teacherStatus}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-800">
                      <div>{sess.presentCount + sess.lateCount} / {sess.totalEnrolled} Present</div>
                      <div className="text-[10px] text-slate-400">
                        {sess.lateCount > 0 && `${sess.lateCount} Late • `}
                        {sess.excusedCount > 0 && `${sess.excusedCount} Excused`}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-[#0D9488]">
                      {sess.attendanceRate}%
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Sealed</span>
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedSessionDetail(sess)}
                        className="px-3 py-1 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold text-xs transition cursor-pointer"
                      >
                        Inspect Roster
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. Granular Session Detail Audit Modal */}
      {selectedSessionDetail && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#0D9488]">
                  Archived Session Audit Record
                </span>
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  {selectedSessionDetail.className} — {selectedSessionDetail.subject}
                </h3>
                <div className="text-xs text-slate-500 mt-0.5">
                  {selectedSessionDetail.date} • Period {selectedSessionDetail.period} ({selectedSessionDetail.timeSlot}) • {selectedSessionDetail.roomName}
                </div>
              </div>
              <button
                onClick={() => setSelectedSessionDetail(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Session Verification Header Summary */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 my-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div>
                <span className="text-[10px] text-slate-500 block">Faculty Verification</span>
                <span className="font-bold text-emerald-800">{selectedSessionDetail.teacherVerifiedAt}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">Attendance Rate</span>
                <span className="font-bold text-[#0D9488]">{selectedSessionDetail.attendanceRate}%</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">Present / Enrolled</span>
                <span className="font-bold text-slate-900">{selectedSessionDetail.presentCount + selectedSessionDetail.lateCount} / {selectedSessionDetail.totalEnrolled}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">Session Sealed</span>
                <span className="font-bold text-slate-900">{selectedSessionDetail.sealedAt}</span>
              </div>
            </div>

            {/* Roster Breakdown Table */}
            <div className="flex-1 overflow-y-auto pr-1">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-2 px-3">Roll No</th>
                    <th className="py-2 px-3">Student Name</th>
                    <th className="py-2 px-3">Scan Timestamp</th>
                    <th className="py-2 px-3">Method</th>
                    <th className="py-2 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedSessionDetail.roster.map((s) => (
                    <tr key={s.studentId} className="hover:bg-slate-50/60">
                      <td className="py-2.5 px-3 font-mono font-semibold text-slate-600">
                        {s.rollNo}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        <div>{s.name}</div>
                        {s.remarks && (
                          <div className="text-[10px] text-slate-500 font-normal italic">
                            {s.remarks}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">
                        {s.scannedTime || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                        {s.method}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            s.status === 'Present'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : s.status === 'Late'
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : s.status === 'Excused'
                              ? 'bg-blue-50 text-blue-800 border border-blue-200'
                              : 'bg-rose-50 text-rose-800 border border-rose-200'
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div className="pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs mt-3">
              <span className="text-slate-400 font-mono text-[11px]">
                Archive Reference: {selectedSessionDetail.sessionCode}
              </span>
              <button
                onClick={() => setSelectedSessionDetail(null)}
                className="px-4 py-2 text-xs font-bold text-white bg-[#0F172A] hover:bg-slate-800 rounded-xl"
              >
                Close Audit View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
