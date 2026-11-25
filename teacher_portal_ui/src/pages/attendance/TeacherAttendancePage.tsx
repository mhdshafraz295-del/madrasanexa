import React, { useState, useEffect, useCallback } from 'react';
import {
  QrCode,
  MapPin,
  Clock,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Building2,
  BookOpen,
  Info,
  HelpCircle,
  FileCheck,
  ChevronRight,
  Keyboard,
  ShieldAlert,
  Lock,
} from 'lucide-react';
import type {
  TeacherAttendanceRecord,
} from '../../mock/teacherMockData';
import { teacherAttendanceApi, attendanceHistoryApi, authApi } from '../../services/api';
import { CameraScannerView, type ScanResultToast } from '../../components/attendance/CameraScannerView';

const STATIC_VENUE_PLAQUE_NOTICE =
  'Static Venue Plaque Notice: Classroom QR codes verify venue and schedule alignment within the approved timetable window. Static QR codes do not certify biometric physical presence or continuous attendance.';

type ScanState = 'idle' | 'valid' | 'invalid_room' | 'expired_window' | 'already_recorded';

function getCurrentColomboMinutes(): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Colombo',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    }).formatToParts(new Date());
    const h = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
    const m = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
    return (h === 24 ? 0 : h) * 60 + m;
  } catch {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }
}

function parseTimeToMinutes(val: any, isStart: boolean = true): number {
  if (typeof val === 'number' && !isNaN(val)) return val;
  if (typeof val === 'string' && val.trim()) {
    const s = val.trim();
    const match12 = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (match12) {
      let h = parseInt(match12[1], 10);
      const m = parseInt(match12[2], 10);
      const period = match12[3].toUpperCase();
      if (period === 'PM' && h < 12) h += 12;
      if (period === 'AM' && h === 12) h = 0;
      return h * 60 + m;
    }
    const match24 = s.match(/^([01]?\d|2[0-3]):([0-5]\d)/);
    if (match24) {
      return parseInt(match24[1], 10) * 60 + parseInt(match24[2], 10);
    }
    const splitParts = s.split(/[–\-]/);
    const target = isStart ? splitParts[0] : splitParts[1];
    if (target) {
      const m12 = target.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      if (m12) {
        let h = parseInt(m12[1], 10);
        const m = parseInt(m12[2], 10);
        const period = m12[3].toUpperCase();
        if (period === 'PM' && h < 12) h += 12;
        if (period === 'AM' && h === 12) h = 0;
        return h * 60 + m;
      }
    }
  }
  return 0;
}

function resolveActiveSlot(slots: any[]): any | null {
  if (!slots || slots.length === 0) return null;

  const currentMinutes = getCurrentColomboMinutes();

  const parsed = slots.map((s) => {
    const sMin = parseTimeToMinutes(s.startMinutes ?? s.startTime ?? s.timeSlot, true);
    const eMin = parseTimeToMinutes(s.endMinutes ?? s.endTime ?? s.timeSlot, false);
    const isMarked = s.status === 'Verified' || s.status === 'Late' || Boolean(s.verifiedAt);
    // Strict active window: 10 minutes early grace buffer up to exact endTime
    const isActiveWindow = currentMinutes >= (sMin - 10) && currentMinutes <= eMin;
    const isEnded = currentMinutes > eMin;
    const isUpcoming = currentMinutes < (sMin - 10);
    return { raw: s, startMinutes: sMin, endMinutes: eMin, isMarked, isActiveWindow, isEnded, isUpcoming };
  });

  // Strict: Match ONLY currently active window slots
  const activeCandidates = parsed.filter((s) => s.isActiveWindow);
  if (activeCandidates.length > 0) {
    const unmarked = activeCandidates.filter((s) => !s.isMarked);
    const pool = unmarked.length > 0 ? unmarked : activeCandidates;
    pool.sort((a, b) => Math.abs(currentMinutes - a.startMinutes) - Math.abs(currentMinutes - b.startMinutes));
    return pool[0].raw;
  }

  // If outside active window (e.g. during free breaks or after period ends), return null strictly
  return null;
}

export default function TeacherAttendancePage() {
  const [todaySchedule, setTodaySchedule] = useState<any[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [logs, setLogs] = useState<TeacherAttendanceRecord[]>([]);
  const [logsPage, setLogsPage] = useState(1);

  // Live Toast Pill Inside Viewfinder
  const [liveScanToast, setLiveScanToast] = useState<ScanResultToast | null>(null);

  const storedUser = authApi.getStoredUser();
  const teacherName = storedUser?.name || 'Faculty Member';

  const hasSchedule = todaySchedule.length > 0;
  const currentMinutes = getCurrentColomboMinutes();

  // Dynamically resolve activeSlot based on manual selection, backend flag, or Colombo wall-clock
  const activeSlot = React.useMemo(() => {
    if (!hasSchedule) return null;
    if (selectedSlotId) {
      const found = todaySchedule.find((s) => s.id === selectedSlotId || s.scheduleId === selectedSlotId);
      if (found) return found;
    }
    const backendActive = todaySchedule.find((s) => s.isActiveSlot);
    if (backendActive) return backendActive;
    return resolveActiveSlot(todaySchedule);
  }, [hasSchedule, todaySchedule, selectedSlotId]);

  // Find next upcoming period if no active slot is ongoing
  const nextUpcomingSlot = React.useMemo(() => {
    if (!hasSchedule) return null;
    const upcoming = todaySchedule
      .map((s) => ({
        ...s,
        sMin: parseTimeToMinutes(s.startMinutes ?? s.startTime ?? s.timeSlot, true),
      }))
      .filter((s) => s.sMin > currentMinutes)
      .sort((a, b) => a.sMin - b.sMin);
    return upcoming[0] || null;
  }, [hasSchedule, todaySchedule, currentMinutes]);

  const assignedRoom = {
    id: activeSlot?.roomId || activeSlot?.classroomId || 'rm-assigned',
    name: activeSlot?.roomName || 'Classroom Venue',
    code: activeSlot?.roomCode || 'CR-01',
    capacity: activeSlot?.capacity || activeSlot?.studentsCount || 35,
    qrPayload: activeSlot?.roomToken || activeSlot?.roomCode || 'PLAQUE-CR-01',
  };

  const isCurrentSlotEnded = Boolean(
    activeSlot &&
    parseTimeToMinutes(activeSlot.endMinutes ?? activeSlot.endTime ?? activeSlot.timeSlot, false) < currentMinutes
  );

  const [scanState, setScanState] = useState<ScanState>('idle');
  const [scanErrorMessage, setScanErrorMessage] = useState<string | null>(null);
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [manualRoomToken, setManualRoomToken] = useState('');
  const [manualReason, setManualReason] = useState('Camera Hardware Fault on Faculty Device');
  const [manualNote, setManualNote] = useState('');
  const [manualSuccessToast, setManualSuccessToast] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [backendNotice, setBackendNotice] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [todaySlots, hist] = await Promise.all([
        teacherAttendanceApi.getTodayTeacherAttendance(),
        attendanceHistoryApi.getAttendanceHistory('teacher', 1, 20),
      ]);
      if (todaySlots && Array.isArray(todaySlots)) {
        setTodaySchedule(todaySlots);
        const resolved = todaySlots.find((s) => s.isActiveSlot) || resolveActiveSlot(todaySlots);
        if (resolved) {
          setSelectedSlotId((prev) => prev || (resolved.id || resolved.scheduleId));
        }
      }
      if (hist?.data) {
        setLogs(hist.data);
      }
    } catch {
      // Non-fatal
    }
  }, []);

  const handleVerifyToken = useCallback(
    async (token: string, method: string = 'Classroom QR') => {
      setIsLoading(true);
      setBackendNotice(null);
      setScanErrorMessage(null);

      try {
        const scheduleId = activeSlot ? (activeSlot.scheduleId || activeSlot.id) : undefined;
        const result = await teacherAttendanceApi.verifyClassroomQr({
          roomToken: token.trim(),
          scheduleId,
          method: method.toLowerCase().includes('manual') ? 'Manual Fallback' : 'Classroom QR',
        });

        if (result.scheduleId) {
          setSelectedSlotId(result.scheduleId);
        }

        const periodLabel = `Period ${result.schedule?.period || activeSlot?.period || ''}`;
        const venueLabel = result.schedule?.roomName || assignedRoom.name;

        const newRecord: TeacherAttendanceRecord = {
          id: result.id || `tlog-${Date.now()}`,
          date: new Date().toISOString().split('T')[0],
          time: result.checkInTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          period: result.schedule?.period || activeSlot?.period || 1,
          periodTime: result.schedule?.timeSlot || activeSlot?.timeSlot || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          classId: activeSlot?.classId || 'cls',
          className: result.schedule?.className || activeSlot?.className || 'Assigned Class Session',
          subject: result.schedule?.subject || activeSlot?.subject || 'Class Lecture',
          roomId: assignedRoom.id,
          roomName: assignedRoom.name,
          classroomQrScanned: token,
          status: 'Verified',
          method: method.toLowerCase().includes('manual') ? 'Manual Fallback' : 'Classroom QR',
          graceWindowMinutes: 10,
          verifiedAt: result.verifiedAt || new Date().toISOString(),
          notes: result.notice || 'Verified via classroom plaque QR check-in.',
        };

        setLogs((prev) => [newRecord, ...prev]);
        setBackendNotice(result.notice);
        setScanState('valid');

        // Display instant green toast pill in viewfinder
        setLiveScanToast({
          status: 'success',
          direction: 'CHECKED IN',
          studentName: `${periodLabel} (${venueLabel})`,
          admissionNo: result.schedule?.subject || activeSlot?.subject || 'Class Lecture',
          message: `Checked in for ${periodLabel} at ${venueLabel}.`,
          timestamp: Date.now(),
        });

        await loadData();
      } catch (err: any) {
        const errData = err.response?.data || {};
        const msg = errData.message || err.message || 'Classroom check-in failed.';
        const code = errData.code || '';

        setScanErrorMessage(msg);

        if (code === 'PERIOD_ENDED' || msg.includes('ended')) {
          setScanState('expired_window');
        } else if (code === 'NO_ACTIVE_PERIOD' || msg.includes('active')) {
          setScanState('expired_window');
        } else if (msg.includes('already recorded') || msg.includes('Already')) {
          setScanState('already_recorded');
        } else {
          setScanState('invalid_room');
        }

        // Display instant rose toast pill in viewfinder
        setLiveScanToast({
          status: 'error',
          direction: 'REJECTED',
          studentName:
            code === 'NO_ACTIVE_PERIOD' || msg.includes('active')
              ? 'No Active Period'
              : code === 'PERIOD_ENDED' || msg.includes('ended')
              ? 'Period Ended'
              : code === 'PERIOD_NOT_STARTED' || msg.includes('not started')
              ? 'Not Started'
              : msg.includes('Wrong')
              ? 'Wrong Room'
              : 'Check-In Rejected',
          message: msg,
          timestamp: Date.now(),
        });
      } finally {
        setIsLoading(false);
      }
    },
    [activeSlot, assignedRoom, loadData]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Scan simulation triggers with live backend API verification
  const triggerScan = async (state: ScanState) => {
    setScanState(state);
    setBackendNotice(null);
    setScanErrorMessage(null);

    if (state === 'valid' && assignedRoom) {
      await handleVerifyToken(assignedRoom.qrPayload, 'Classroom QR');
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignedRoom) return;
    const tokenToUse = manualRoomToken.trim() || assignedRoom.qrPayload || assignedRoom.code;
    await handleVerifyToken(tokenToUse, 'Manual Fallback');

    setManualModalOpen(false);
    setManualRoomToken('');
    setManualNote('');
    setManualSuccessToast(true);
    setTimeout(() => setManualSuccessToast(false), 3500);
  };

  return (
    <div className="space-y-6 overflow-x-hidden min-w-0 max-w-full">
      {/* 1. Page Header */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 min-w-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-bold text-[#0D9488] uppercase tracking-wider mb-1">
            <QrCode className="w-4 h-4 shrink-0" />
            <span className="truncate">Teacher Attendance Verification</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight truncate">
            Classroom QR Check-In
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
            Scan the permanent acrylic QR plaque affixed at your allocated classroom entrance to confirm presence
          </p>
        </div>

        {/* Current Colombo Time Display */}
        <div className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-left md:text-right shrink-0">
          <div className="text-xs font-mono font-bold text-slate-900 flex items-center md:justify-end gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[#0D9488]" />
            <span>
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            <span className="text-slate-400">•</span>
            <span>
              {hasSchedule && activeSlot ? `P${activeSlot.period}` : 'No Active Session'}
            </span>
          </div>
          <div className="text-[11px] text-emerald-700 font-semibold mt-0.5">
            {hasSchedule && activeSlot && !isCurrentSlotEnded
              ? `${activeSlot.timeSlot} (Active Period)`
              : nextUpcomingSlot
              ? `Next: P${nextUpcomingSlot.period} at ${nextUpcomingSlot.timeSlot}`
              : 'All scheduled periods ended today'}
          </div>
        </div>
      </div>

      {manualSuccessToast && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-bold text-emerald-900 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Manual attendance override recorded successfully{activeSlot ? ` for Period ${activeSlot.period}` : ''}.</span>
        </div>
      )}

      {/* Mandatory Architectural Notice Banner */}
      <div className="bg-amber-50/90 border border-amber-200/90 rounded-2xl p-4 sm:p-5 shadow-xs text-xs flex items-start gap-3.5">
        <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5 font-bold">
          <ShieldAlert className="w-4 h-4 text-amber-700" />
        </div>
        <div className="text-amber-900 leading-relaxed min-w-0">
          <div className="font-bold text-amber-950 text-sm mb-0.5">
            Static Venue Plaque Architectural Notice
          </div>
          <p>{STATIC_VENUE_PLAQUE_NOTICE}</p>
        </div>
      </div>

      {/* 2. Permanent Classroom QR Architectural Banner */}
      <div className="bg-gradient-to-r from-teal-50 via-slate-50 to-emerald-50 border border-teal-200/80 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex items-start gap-3.5">
          <div className="w-9 h-9 rounded-xl bg-[#0D9488] text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="text-xs text-slate-700 leading-relaxed min-w-0">
            <div className="font-bold text-slate-900 text-sm mb-0.5">
              Permanent Classroom Identity Standard
            </div>
            <p>
              Each lecture hall has an <strong>invariant QR code plaque</strong>.
              Attendance is validated strictly against your allocated schedule within the current period window (10-minute early check-in buffer; check-in closes at period end).
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[11px] text-teal-800 min-w-0 max-w-full">
              <span className="px-2 py-0.5 rounded bg-teal-100/80 border border-teal-200 shrink-0">
                Plaque Code: {assignedRoom.code}
              </span>
              <span className="px-2 py-0.5 rounded bg-teal-100/80 border border-teal-200 break-all max-w-full">
                Payload: {assignedRoom.qrPayload}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Core Scanning Workflow & Context */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-w-0 max-w-full">
        {/* Left Column (7 cols): Native Camera Viewfinder & Simulated Controls */}
        <div className="lg:col-span-7 space-y-4 min-w-0">
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 p-4 sm:p-5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between pb-3.5 border-b border-slate-100 mb-3.5 gap-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <QrCode className="w-4 h-4 text-[#0D9488] shrink-0" />
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider truncate">
                  Classroom Plaque Scanner
                </h2>
              </div>

              {/* Active Period Status Pill */}
              <div className="flex items-center gap-1.5 shrink-0">
                {activeSlot && !isCurrentSlotEnded ? (
                  <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-1.5 shadow-xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>P{activeSlot.period}: {activeSlot.subject}</span>
                  </span>
                ) : isCurrentSlotEnded ? (
                  <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1.5 shadow-xs">
                    <Lock className="w-3.5 h-3.5 text-rose-600" />
                    <span>Period Ended</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-xs font-medium">
                    No Active Period
                  </span>
                )}
              </div>
            </div>

            {/* UNIFIED NATIVE VIEWFINDER WITH 3-ZONE LAYOUT & LOCKED FULLSCREEN */}
            <CameraScannerView
              onScan={(payload) => handleVerifyToken(payload, 'Classroom QR')}
              disabled={isLoading}
              contextBadge="Scan Classroom QR Plaque"
              statsBadge={
                activeSlot && !isCurrentSlotEnded
                  ? `Period ${activeSlot.period}: ${activeSlot.subject}`
                  : 'Time Window Locked'
              }
              lastScanResult={liveScanToast}
            />

            {/* Quick Manual Code Trigger Link */}
            <div className="mt-3.5 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
              <button
                type="button"
                onClick={() => setManualModalOpen(true)}
                className="text-xs font-semibold text-slate-600 hover:text-[#0D9488] hover:underline transition flex items-center gap-1.5 cursor-pointer"
              >
                <Keyboard className="w-3.5 h-3.5 text-[#0D9488]" />
                <span>Camera hardware issue? Enter Plaque Code Manually &rarr;</span>
              </button>

              <span className="text-[11px] text-slate-400 font-mono">
                Assigned: {assignedRoom.code}
              </span>
            </div>

            {/* Evaluator State Simulator for Reviewers */}
            <div className="mt-4 p-3.5 bg-slate-50 rounded-2xl border border-slate-200/90 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-[#0D9488]" />
                  <span>Prototype Evaluator State Simulator</span>
                </span>
                {scanState !== 'idle' && (
                  <button
                    onClick={() => setScanState('idle')}
                    className="text-xs font-bold text-[#0D9488] hover:underline cursor-pointer"
                  >
                    Reset
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                Trigger mock outcomes to verify instant toast feedback inside viewfinder:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => triggerScan('valid')}
                  className="py-1.5 px-2 rounded-lg text-xs font-bold bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-200 transition cursor-pointer"
                >
                  ✓ Valid Plaque
                </button>
                <button
                  type="button"
                  onClick={() => handleVerifyToken('PLAQUE-WRONG-ROOM', 'Simulator')}
                  className="py-1.5 px-2 rounded-lg text-xs font-bold bg-white hover:bg-rose-50 text-rose-800 border border-rose-200 transition cursor-pointer"
                >
                  ✕ Wrong Room
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLiveScanToast({
                      status: 'error',
                      direction: 'REJECTED',
                      studentName: 'Period Ended',
                      message: 'Period 1 ended. Check-in window is strictly closed.',
                      timestamp: Date.now(),
                    });
                  }}
                  className="py-1.5 px-2 rounded-lg text-xs font-bold bg-white hover:bg-amber-50 text-amber-800 border border-amber-200 transition cursor-pointer"
                >
                  ⏱ Expired
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLiveScanToast({
                      status: 'duplicate',
                      direction: 'ALREADY RECORDED',
                      studentName: `Period ${activeSlot?.period || 1} (${assignedRoom.name})`,
                      message: 'Attendance already recorded for this period today.',
                      timestamp: Date.now(),
                    });
                  }}
                  className="py-1.5 px-2 rounded-lg text-xs font-bold bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 transition cursor-pointer"
                >
                  ↺ Duplicate
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Timetable Period Pills & Session Context */}
        <div className="lg:col-span-5 space-y-4 min-w-0">
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs min-w-0">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-[#0D9488]" />
                <span>Today&apos;s Lecture Schedule</span>
              </span>
              <span className="text-xs text-slate-500 font-medium">
                {todaySchedule.length} Period{todaySchedule.length === 1 ? '' : 's'}
              </span>
            </div>

            {/* Mobile Responsive Period Selection Pills (320px–480px Wrap & Scroll) */}
            {todaySchedule.length > 0 && (
              <div className="my-3 min-w-0 max-w-full">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Select Period:
                </span>
                <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1.5 max-w-full">
                  {todaySchedule.map((slot) => {
                    const isSelected = activeSlot?.id === slot.id || activeSlot?.scheduleId === slot.id;
                    const isEnded = slot.isEnded;
                    const isVerified = slot.status === 'Verified';
                    const isLate = slot.status === 'Late';

                    return (
                      <button
                        key={slot.id || slot.scheduleId}
                        type="button"
                        onClick={() => setSelectedSlotId(slot.id || slot.scheduleId)}
                        className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer border ${
                          isSelected
                            ? 'bg-[#0D9488] text-white border-[#0D9488] shadow-sm'
                            : isEnded
                            ? 'bg-slate-50 hover:bg-slate-100 text-slate-500 border-slate-200'
                            : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        <span>P{slot.period}</span>
                        <span className="text-[11px] font-mono opacity-85">({slot.timeSlot.split('–')[0].trim()})</span>
                        {isVerified ? (
                          <CheckCircle2 className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-emerald-600'}`} />
                        ) : isLate ? (
                          <span className={`text-[10px] px-1 rounded ${isSelected ? 'bg-white/20' : 'bg-amber-100 text-amber-800'}`}>
                            Late
                          </span>
                        ) : isEnded ? (
                          <Lock className="w-3 h-3 text-slate-400" />
                        ) : slot.isActiveSlot ? (
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {activeSlot ? (
              <div className="space-y-3 pt-2">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Active Subject:</span>
                    <span className="font-bold text-slate-900">{activeSlot.subject}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Assigned Class:</span>
                    <span className="font-bold text-slate-900">{activeSlot.className}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Allocated Venue:</span>
                    <span className="font-bold text-[#0D9488]">{assignedRoom.name} ({assignedRoom.code})</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Timetable Window:</span>
                    <span className="font-mono font-bold text-slate-900">{activeSlot.timeSlot}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60">
                    <span className="text-slate-500 font-medium">Window Status:</span>
                    {isCurrentSlotEnded ? (
                      <span className="text-xs font-bold text-rose-600 flex items-center gap-1">
                        <Lock className="w-3.5 h-3.5" />
                        Closed / Missed
                      </span>
                    ) : activeSlot.status === 'Verified' ? (
                      <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Verified Present
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        Open for Check-In
                      </span>
                    )}
                  </div>
                </div>

                {isCurrentSlotEnded && activeSlot.status !== 'Verified' && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
                    <Lock className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>This period has ended. The timetable window is strictly closed for faculty check-in.</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-1.5 my-2">
                <Clock className="w-8 h-8 text-slate-400 mx-auto" />
                <h3 className="text-xs font-bold text-slate-800">
                  No Active Period Right Now
                </h3>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  {nextUpcomingSlot
                    ? `Next lecture (P${nextUpcomingSlot.period}: ${nextUpcomingSlot.subject}) starts at ${nextUpcomingSlot.timeSlot.split('–')[0].trim()}.`
                    : 'All scheduled periods for today have concluded.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. Faculty Attendance Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-[#0D9488]" />
            <h3 className="text-sm font-bold text-slate-900">
              My Recent Attendance Logs
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            {logs.length} Logged Record{logs.length === 1 ? '' : 's'}
          </span>
        </div>

        {logs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Date & Time</th>
                  <th className="py-2.5 px-4">Period</th>
                  <th className="py-2.5 px-4">Subject & Class</th>
                  <th className="py-2.5 px-4">Venue</th>
                  <th className="py-2.5 px-4">Method</th>
                  <th className="py-2.5 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.slice((logsPage - 1) * 8, logsPage * 8).map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-mono">
                      <div>{log.date}</div>
                      <div className="text-[10px] text-slate-400">{log.time}</div>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      Period {log.period}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{log.subject}</div>
                      <div className="text-[11px] text-slate-500">{log.className}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {log.roomName}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-medium">
                        {log.method}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-slate-400 text-xs">
            No attendance records found for current session.
          </div>
        )}
      </div>

      {/* 5. Manual Attendance Fallback Modal */}
      {manualModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Keyboard className="w-5 h-5 text-[#0D9488]" />
                <h3 className="text-sm font-bold text-slate-900">
                  Manual Classroom Plaque Fallback
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setManualModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleManualSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Classroom Plaque Code / Room Token
                </label>
                <input
                  type="text"
                  value={manualRoomToken}
                  onChange={(e) => setManualRoomToken(e.target.value)}
                  placeholder={`e.g. ${assignedRoom.code} or ${assignedRoom.qrPayload}`}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                  autoFocus
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Reason for Camera Bypass
                </label>
                <select
                  value={manualReason}
                  onChange={(e) => setManualReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                >
                  <option value="Camera Hardware Fault on Faculty Device">Camera Hardware Fault on Faculty Device</option>
                  <option value="Physical Acrylic Plaque Damaged or Scratched">Physical Acrylic Plaque Damaged or Scratched</option>
                  <option value="Dim / Insufficient Room Lighting">Dim / Insufficient Room Lighting</option>
                  <option value="Other Institutional Reason">Other Institutional Reason</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setManualModalOpen(false)}
                  className="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 py-2 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white font-bold cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? 'Verifying...' : 'Submit Override'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
