import React, { useState, useEffect } from 'react';
import {
  ScanLine,
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Search,
  Check,
  X,
  Play,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  UserCheck,
  BookOpen,
  Calendar,
  Lock,
  ArrowRight,
  Filter,
} from 'lucide-react';
import type {
  AssignedClass,
  AssignedStudent,
} from '../../mock/teacherMockData';
import { studentAttendanceApi, classesApi } from '../../services/api';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';

type SessionStep = 'setup' | 'active_scanning' | 'review_confirm';
type StatusFilter = 'All' | 'Present' | 'Late' | 'Excused' | 'Absent';

export default function StudentAttendancePage() {
  const [assignedClasses, setAssignedClasses] = useState<AssignedClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedPeriod, setSelectedPeriod] = useState<number>(1);
  const [sessionStep, setSessionStep] = useState<SessionStep>('setup');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionCode, setSessionCode] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [roster, setRoster] = useState<AssignedStudent[]>([]);

  // Active Session State
  const currentClass = assignedClasses.find((c) => c.id === selectedClassId) || assignedClasses[0] || {
    id: '',
    name: 'No Class Selected',
    code: '—',
    stream: 'Islamic Studies',
    gradeLevel: '—',
    totalStudents: 0,
    subjectTaught: '—',
    students: [],
  };

  // Scanner Simulator States
  const [barcodeInput, setBarcodeInput] = useState('');
  const [lastScannedToast, setLastScannedToast] = useState<{
    studentName: string;
    rollNo: string;
    status: 'success' | 'duplicate';
    message: string;
  } | null>(null);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');

  // Manual Edit Modal State
  const [editingStudent, setEditingStudent] = useState<AssignedStudent | null>(null);
  const [manualStatusChoice, setManualStatusChoice] = useState<'Present' | 'Late' | 'Excused' | 'Absent'>('Present');
  const [manualReasonText, setManualReasonText] = useState('');

  // Confirmation Sealed State
  const [isSessionSealed, setIsSessionSealed] = useState(false);

  useEffect(() => {
    classesApi
      .getAssignedClasses()
      .then(async (classes) => {
        if (classes && classes.length > 0) {
          setAssignedClasses(classes);
          const firstClassId = classes[0].id;
          setSelectedClassId(firstClassId);
          try {
            const detail = await classesApi.getClassDetail(firstClassId);
            if (detail?.students) {
              setRoster(
                detail.students.map((s) => ({
                  ...s,
                  status: 'Absent' as const,
                  scannedAt: undefined,
                  manualNote: undefined,
                }))
              );
            }
          } catch {
            setRoster([]);
          }
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  // When class changes in setup, reload roster from live backend
  const handleClassChange = async (classId: string) => {
    setSelectedClassId(classId);
    try {
      const detail = await classesApi.getClassDetail(classId);
      if (detail?.students) {
        setRoster(
          detail.students.map((s) => ({
            ...s,
            status: 'Absent' as const,
            scannedAt: undefined,
            manualNote: undefined,
          }))
        );
      } else {
        setRoster([]);
      }
    } catch {
      setRoster([]);
    }
  };

  // Step 4: Start session
  const handleStartSession = () => {
    setSessionStep('active_scanning');
    setIsSessionSealed(false);
  };

  // Step 5 - 7: Process Student Scan (with Duplicate Prevention)
  const processScan = (barcodeOrRoll: string) => {
    if (!barcodeOrRoll.trim()) return;

    const query = barcodeOrRoll.trim().toLowerCase();
    const student = roster.find(
      (s) => s.barcodeId.toLowerCase() === query || s.rollNo.toLowerCase() === query
    );

    if (!student) {
      alert(`Invalid Barcode / ID: "${barcodeOrRoll}". No matching student enrolled in this class cohort.`);
      setBarcodeInput('');
      return;
    }

    // Step 7: Prevent Duplicate Scans
    if (student.status === 'Present' || student.status === 'Late') {
      setLastScannedToast({
        studentName: student.name,
        rollNo: student.rollNo,
        status: 'duplicate',
        message: `DUPLICATE SCAN BLOCKED: Already marked ${student.status} at ${student.scannedAt || 'earlier'}. Count unchanged.`,
      });
      setBarcodeInput('');
      setTimeout(() => setLastScannedToast(null), 3000);
      return;
    }

    // Record Valid Scan
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setRoster((prev) =>
      prev.map((s) =>
        s.id === student.id
          ? {
              ...s,
              status: 'Present',
              scannedAt: nowTime,
            }
          : s
      )
    );

    setLastScannedToast({
      studentName: student.name,
      rollNo: student.rollNo,
      status: 'success',
      message: `SCANNED SUCCESSFULLY: Marked Present at ${nowTime}.`,
    });
    setBarcodeInput('');
    setTimeout(() => setLastScannedToast(null), 3000);
  };

  // Step 9: Authorized Manual Override Handler
  const handleSaveManualEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;

    setRoster((prev) =>
      prev.map((s) =>
        s.id === editingStudent.id
          ? {
              ...s,
              status: manualStatusChoice,
              manualNote: manualReasonText || 'Manual teacher authorization',
              scannedAt: manualStatusChoice === 'Present' || manualStatusChoice === 'Late'
                ? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : undefined,
            }
          : s
      )
    );

    setEditingStudent(null);
    setManualReasonText('');
  };

  // Step 10: Final Confirmation & Sealing
  const handleConfirmSealSession = async () => {
    setIsSubmitting(true);
    const todayStr = new Date().toISOString().split('T')[0];
    try {
      // First persist any marked student records
      await studentAttendanceApi.markPeriodAttendance({
        scheduleId: selectedClassId,
        date: todayStr,
        records: roster.map((s) => ({
          studentId: s.id,
          status: s.status,
          remarks: s.manualNote || '',
          method: s.scannedAt ? 'Barcode Scan' : 'Teacher Manual',
        })),
      });

      // Then seal the session
      const sealRes = await studentAttendanceApi.sealPeriodSession({
        scheduleId: selectedClassId,
        date: todayStr,
      });

      setIsSessionSealed(true);
      setSessionStep('setup');
      setSessionCode(sealRes.sessionCode);
      alert(`Classroom attendance session (${sealRes.sessionCode}) officially sealed.\nOption A Isolation Active: Daily institutional attendance is unaffected.`);
    } catch (err: any) {
      alert(err.message || 'Failed to seal attendance session.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 8: Live Attendance Counts
  const totalStudents = roster.length;
  const presentCount = roster.filter((s) => s.status === 'Present').length;
  const lateCount = roster.filter((s) => s.status === 'Late').length;
  const excusedCount = roster.filter((s) => s.status === 'Excused').length;
  const absentCount = roster.filter((s) => s.status === 'Absent').length;
  const scannedCount = roster.filter((s) => !!s.scannedAt).length;
  const attendanceRate = totalStudents > 0 ? (((presentCount + lateCount) / totalStudents) * 100).toFixed(1) : '0';

  const filteredRoster = roster.filter((s) => {
    const matchesFilter = statusFilter === 'All' || s.status === statusFilter;
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.rollNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.barcodeId.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#0D9488] uppercase tracking-wider mb-1">
            <ScanLine className="w-4 h-4" />
            <span>Classroom Student Attendance</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Live Student ID Scanner & Roster
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Scan physical student ID cards via 1D Barcode or QR code during your scheduled lecture
          </p>
        </div>

        {/* Smart Gate Separation Badge */}
        <div className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs flex items-center gap-2 shrink-0">
          <ShieldCheck className="w-4 h-4 text-[#0D9488]" />
          <div>
            <div className="font-bold text-slate-900 text-[11px]">Classroom Verification Only</div>
            <div className="text-[10px] text-slate-500">Decoupled from campus Smart Gate entries</div>
          </div>
        </div>
      </div>

      {/* 2. Step 1 - 4: Session Setup Bar (Visible when in setup) */}
      {sessionStep === 'setup' && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs">
          <div className="pb-4 border-b border-slate-100 mb-4">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Step 1 – 3: Configure Attendance Lecture Session
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select class, subject, and time period before starting the live scanning session
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Step 1: Select Class */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                1. Select Assigned Class
              </label>
              <select
                value={selectedClassId}
                onChange={(e) => handleClassChange(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-[#0D9488] bg-white"
              >
                {assignedClasses.length === 0 ? (
                  <option value="">No Assigned Classes</option>
                ) : (
                  assignedClasses.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} ({cls.totalStudents} Students)
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Step 2: Subject */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                2. Allocated Subject
              </label>
              <div className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 font-semibold truncate">
                {currentClass.subjectTaught}
              </div>
            </div>

            {/* Step 3: Period */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                3. Scheduled Lecture Period
              </label>
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-[#0D9488] bg-white"
              >
                <option value={1}>Period 1 (08:00 AM – 08:45 AM)</option>
                <option value={2}>Period 2 (09:00 AM – 09:45 AM)</option>
                <option value={3}>Period 3 (10:15 AM – 11:00 AM)</option>
                <option value={4}>Period 4 (11:30 AM – 12:15 PM)</option>
              </select>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-slate-500">
              Classroom Venue: <strong className="text-slate-800">{currentClass.room}</strong> • Enrolled: <strong className="text-slate-800">{currentClass.totalStudents} Students</strong>
            </span>
            <button
              type="button"
              onClick={handleStartSession}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#0F172A] hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
            >
              <Play className="w-4 h-4 text-[#37C6A3]" />
              <span>Start Live Attendance Session</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. Steps 5 – 8: Active Live Attendance Scanner & Metrics */}
      {sessionStep === 'active_scanning' && (
        <div className="space-y-6">
          {/* Active Session Bar */}
          <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping shrink-0" />
              <div>
                <div className="text-xs font-bold text-[#37C6A3] uppercase tracking-wider">
                  Active Session: Period {selectedPeriod}
                </div>
                <h2 className="text-base font-bold text-white">
                  {currentClass.name} — {currentClass.subjectTaught}
                </h2>
                <div className="text-xs text-slate-400">
                  Classroom: {currentClass.room}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setSessionStep('setup')}
                className="px-3.5 py-1.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-xs font-semibold text-slate-300 transition cursor-pointer"
              >
                Change Session
              </button>
              <button
                type="button"
                onClick={() => setSessionStep('review_confirm')}
                className="px-4 py-1.5 rounded-xl bg-[#37C6A3] hover:bg-[#2db291] text-[#0F172A] text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              >
                <Check className="w-4 h-4" />
                <span>Review & Confirm</span>
              </button>
            </div>
          </div>

          {/* Live Attendance Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white rounded-xl border border-slate-200 p-3 text-center shadow-2xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Enrolled</span>
              <div className="text-xl font-black text-slate-900">{totalStudents}</div>
            </div>
            <div className="bg-white rounded-xl border border-emerald-200 bg-emerald-50/30 p-3 text-center shadow-2xs">
              <span className="text-[10px] font-bold text-emerald-800 uppercase">Present</span>
              <div className="text-xl font-black text-emerald-700">{presentCount}</div>
            </div>
            <div className="bg-white rounded-xl border border-amber-200 bg-amber-50/30 p-3 text-center shadow-2xs">
              <span className="text-[10px] font-bold text-amber-800 uppercase">Late</span>
              <div className="text-xl font-black text-amber-700">{lateCount}</div>
            </div>
            <div className="bg-white rounded-xl border border-blue-200 bg-blue-50/30 p-3 text-center shadow-2xs">
              <span className="text-[10px] font-bold text-blue-800 uppercase">Excused</span>
              <div className="text-xl font-black text-blue-700">{excusedCount}</div>
            </div>
            <div className="bg-white rounded-xl border border-rose-200 bg-rose-50/30 p-3 text-center shadow-2xs">
              <span className="text-[10px] font-bold text-rose-800 uppercase">Absent</span>
              <div className="text-xl font-black text-rose-700">{absentCount}</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-3 text-center shadow-2xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Attendance %</span>
              <div className="text-xl font-black text-[#0D9488]">{attendanceRate}%</div>
            </div>
          </div>

          {/* Scanner Viewport & Input Simulator */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ScanLine className="w-4 h-4 text-[#0D9488]" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Student ID Barcode / QR Scanner Input
                </h3>
              </div>
              <span className="text-xs text-slate-500 font-mono">
                Scanned This Session: <strong>{scannedCount}</strong> / {totalStudents}
              </span>
            </div>

            {/* Direct Input & Quick Scan Simulator */}
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <div className="relative flex-1 w-full">
                <ScanLine className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Enter or scan student barcode (e.g. BC-STU-10A-01)..."
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      processScan(barcodeInput);
                    }
                  }}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                />
              </div>
              <button
                type="button"
                onClick={() => processScan(barcodeInput)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#0F172A] hover:bg-slate-800 text-white font-bold text-xs transition cursor-pointer"
              >
                Scan Input
              </button>
            </div>

            {/* Quick-Tap Student Scan Buttons (Simulates Scanner Hardware Input) */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#0D9488]" />
                  <span>Interactive Quick-Scan Simulation (Tap to scan student ID)</span>
                </span>
                <span className="text-[10px] text-slate-400">Hardware Simulator</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {roster.map((s) => {
                  const isScanned = s.status === 'Present' || s.status === 'Late';
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => processScan(s.barcodeId)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition border flex items-center gap-1.5 cursor-pointer ${
                        isScanned
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-200'
                      }`}
                    >
                      {isScanned ? (
                        <Check className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <ScanLine className="w-3 h-3 text-slate-400" />
                      )}
                      <span>{s.name.split(' ')[0]}</span>
                      <span className="text-[10px] font-mono text-slate-400">({s.rollNo})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Scan Feedback Banner / Duplicate Toast */}
            {lastScannedToast && (
              <div
                className={`p-3.5 rounded-xl text-xs font-bold flex items-center gap-2.5 animate-in fade-in ${
                  lastScannedToast.status === 'success'
                    ? 'bg-emerald-50 border border-emerald-300 text-emerald-950'
                    : 'bg-amber-50 border border-amber-300 text-amber-950'
                }`}
              >
                {lastScannedToast.status === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                )}
                <div>
                  <div className="font-extrabold">{lastScannedToast.studentName} ({lastScannedToast.rollNo})</div>
                  <div className="text-[11px] font-medium">{lastScannedToast.message}</div>
                </div>
              </div>
            )}
          </div>

          {/* Student Roster Table with Search & Status Filtering */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  Enrolled Cohort Roster ({roster.length} Students)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Click on any student row for authorized manual fallback adjustment
                </p>
              </div>

              {/* Roster Controls: Search & Filter */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-full sm:w-48">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search roster..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                  />
                </div>

                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-[11px]">
                  {(['All', 'Present', 'Late', 'Excused', 'Absent'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatusFilter(st)}
                      className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                        statusFilter === st
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto mt-4 -mx-5 sm:mx-0">
              <table className="w-full text-left border-collapse min-w-[620px] text-xs">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-2.5 px-4">Roll No</th>
                    <th className="py-2.5 px-4">Student Name</th>
                    <th className="py-2.5 px-4">Barcode ID</th>
                    <th className="py-2.5 px-4">Scanned At</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4 text-right">Manual Fallback</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRoster.map((student) => (
                    <tr key={student.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4 font-mono font-semibold text-slate-600">
                        {student.rollNo}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {student.name}
                        {student.manualNote && (
                          <div className="text-[10px] text-amber-700 italic font-normal">
                            Note: {student.manualNote}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                        {student.barcodeId}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700">
                        {student.scannedAt || '—'}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            student.status === 'Present'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : student.status === 'Late'
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : student.status === 'Excused'
                              ? 'bg-blue-50 text-blue-800 border border-blue-200'
                              : 'bg-rose-50 text-rose-800 border border-rose-200'
                          }`}
                        >
                          {student.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingStudent(student);
                            setManualStatusChoice(student.status);
                            setManualReasonText(student.manualNote || '');
                          }}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold text-[11px] transition cursor-pointer"
                        >
                          Edit Status
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4. Step 10: Review and Confirm Attendance Screen */}
      {sessionStep === 'review_confirm' && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-7 shadow-xs space-y-6">
          <div className="pb-4 border-b border-slate-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#0D9488]">
              Step 10: Final Verification
            </span>
            <h2 className="text-lg font-bold text-slate-900 mt-0.5">
              Review & Seal Attendance Session
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Verify the classroom attendance totals before finalizing this session record
            </p>
          </div>

          {/* Session Overview Card */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <span className="text-slate-500 block">Class Cohort</span>
              <span className="font-bold text-slate-900">{currentClass.name}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Subject</span>
              <span className="font-bold text-[#0D9488]">{currentClass.subjectTaught}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Lecture Period</span>
              <span className="font-bold text-slate-900">Period {selectedPeriod}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Classroom Venue</span>
              <span className="font-bold text-slate-900">{currentClass.room}</span>
            </div>
          </div>

          {/* Tally Summary Box */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
            <div className="p-3 rounded-xl border border-slate-200 bg-white">
              <span className="text-[10px] text-slate-500 uppercase font-bold">Total Enrolled</span>
              <div className="text-xl font-black text-slate-900 mt-0.5">{totalStudents}</div>
            </div>
            <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/40">
              <span className="text-[10px] text-emerald-800 uppercase font-bold">Present</span>
              <div className="text-xl font-black text-emerald-700 mt-0.5">{presentCount}</div>
            </div>
            <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/40">
              <span className="text-[10px] text-amber-800 uppercase font-bold">Late</span>
              <div className="text-xl font-black text-amber-700 mt-0.5">{lateCount}</div>
            </div>
            <div className="p-3 rounded-xl border border-blue-200 bg-blue-50/40">
              <span className="text-[10px] text-blue-800 uppercase font-bold">Excused</span>
              <div className="text-xl font-black text-blue-700 mt-0.5">{excusedCount}</div>
            </div>
            <div className="p-3 rounded-xl border border-rose-200 bg-rose-50/40">
              <span className="text-[10px] text-rose-800 uppercase font-bold">Absent</span>
              <div className="text-xl font-black text-rose-700 mt-0.5">{absentCount}</div>
            </div>
          </div>

          <div className="p-3.5 bg-teal-50 border border-teal-200 rounded-xl text-teal-900 text-xs">
            Final Attendance Percentage: <strong>{attendanceRate}%</strong>. Sealing this record registers the session snapshot permanently into institutional archives.
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setSessionStep('active_scanning')}
              className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              ← Back to Scanner
            </button>
            <button
              type="button"
              onClick={handleConfirmSealSession}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#0F172A] hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs cursor-pointer"
            >
              <Lock className="w-4 h-4 text-[#37C6A3]" />
              <span>Confirm & Seal Attendance Record</span>
            </button>
          </div>
        </div>
      )}

      {/* Manual Status Edit Modal */}
      {editingStudent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#0D9488]">
                  Manual Override
                </span>
                <h3 className="text-base font-bold text-slate-900">
                  {editingStudent.name}
                </h3>
              </div>
              <button
                onClick={() => setEditingStudent(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveManualEdit} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Attendance Status
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['Present', 'Late', 'Excused', 'Absent'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setManualStatusChoice(st)}
                      className={`py-2 px-3 rounded-lg font-bold text-xs transition border cursor-pointer ${
                        manualStatusChoice === st
                          ? 'bg-[#0F172A] text-white border-[#0F172A]'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Reason / Teacher Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. Card forgotten at home / excused by Ustadh"
                  value={manualReasonText}
                  onChange={(e) => setManualReasonText(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-[#0D9488] hover:bg-[#0F766E] rounded-xl"
                >
                  Save Status Override
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
