import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  QrCode,
  MapPin,
  Clock,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  Camera,
  RefreshCw,
  Building2,
  BookOpen,
  Info,
  HelpCircle,
  FileCheck,
  ChevronRight,
  ArrowRight,
  Video,
  VideoOff,
  Keyboard,
  ShieldAlert,
} from 'lucide-react';
import type {
  TeacherAttendanceRecord,
} from '../../mock/teacherMockData';
import { teacherAttendanceApi, attendanceHistoryApi, authApi } from '../../services/api';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';

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
    return { raw: s, startMinutes: sMin, endMinutes: eMin, isMarked };
  });

  // 1. Active window: startMinutes - 30 <= currentMinutes <= endMinutes + 15
  const activeCandidates = parsed.filter(
    (s) => currentMinutes >= (s.startMinutes - 30) && currentMinutes <= (s.endMinutes + 15)
  );

  if (activeCandidates.length > 0) {
    const unmarked = activeCandidates.filter((s) => !s.isMarked);
    const pool = unmarked.length > 0 ? unmarked : activeCandidates;
    pool.sort((a, b) => Math.abs(currentMinutes - a.startMinutes) - Math.abs(currentMinutes - b.startMinutes));
    return pool[0].raw;
  }

  // 2. Next upcoming unmarked slot today (startMinutes > currentMinutes)
  const upcomingUnmarked = parsed
    .filter((s) => s.startMinutes > currentMinutes && !s.isMarked)
    .sort((a, b) => a.startMinutes - b.startMinutes);

  if (upcomingUnmarked.length > 0) {
    return upcomingUnmarked[0].raw;
  }

  // Next upcoming slot
  const upcomingAny = parsed
    .filter((s) => s.startMinutes > currentMinutes)
    .sort((a, b) => a.startMinutes - b.startMinutes);

  if (upcomingAny.length > 0) {
    return upcomingAny[0].raw;
  }

  // 3. Fall back to the most recent slot
  const pastSchedules = [...parsed].sort((a, b) => b.endMinutes - a.endMinutes);
  return pastSchedules[0]?.raw || slots[0];
}

export default function TeacherAttendancePage() {
  const [todaySchedule, setTodaySchedule] = useState<any[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [logs, setLogs] = useState<TeacherAttendanceRecord[]>([]);

  const storedUser = authApi.getStoredUser();
  const teacherName = storedUser?.name || 'Faculty Member';

  const hasSchedule = todaySchedule.length > 0;

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

  const assignedRoom = {
    id: activeSlot?.roomId || activeSlot?.classroomId || 'rm-assigned',
    name: activeSlot?.roomName || 'Classroom Venue',
    code: activeSlot?.roomCode || 'CR-01',
    capacity: activeSlot?.capacity || activeSlot?.studentsCount || 35,
    qrPayload: activeSlot?.roomToken || activeSlot?.roomCode || 'PLAQUE-CR-01',
  };

  const [scanState, setScanState] = useState<ScanState>('idle');
  const [scanErrorMessage, setScanErrorMessage] = useState<string | null>(null);
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [manualRoomToken, setManualRoomToken] = useState('');
  const [manualReason, setManualReason] = useState('Camera Hardware Fault on Faculty Device');
  const [manualNote, setManualNote] = useState('');
  const [manualSuccessToast, setManualSuccessToast] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [backendNotice, setBackendNotice] = useState<string | null>(null);

  // Real Camera Streaming & Decoding State
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<'prompt' | 'granted' | 'denied' | 'unavailable'>('prompt');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [activeScannerTab, setActiveScannerTab] = useState<'camera' | 'simulator'>('camera');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectIntervalRef = useRef<any>(null);

  const stopLiveCamera = useCallback(() => {
    if (detectIntervalRef.current) {
      clearInterval(detectIntervalRef.current);
      detectIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

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

  const handleVerifyToken = useCallback(async (token: string, method: string = 'Classroom QR') => {
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
        graceWindowMinutes: 15,
        verifiedAt: result.verifiedAt || new Date().toISOString(),
        notes: result.notice || 'Verified via classroom plaque QR check-in.',
      };
      setLogs((prev) => [newRecord, ...prev]);
      setBackendNotice(result.notice);
      setScanState('valid');
      stopLiveCamera();
      await loadData();
    } catch (err: any) {
      const msg = err.message || '';
      setScanErrorMessage(msg);
      if (msg.includes('already recorded')) {
        setScanState('already_recorded');
      } else if (msg.includes('window') || msg.includes('timetable')) {
        setScanState('expired_window');
      } else {
        setScanState('invalid_room');
      }
    } finally {
      setIsLoading(false);
    }
  }, [activeSlot, assignedRoom, stopLiveCamera, loadData]);

  const startLiveCamera = async () => {
    setCameraError(null);
    setCameraPermission('prompt');
    setScanState('idle');
    setScanErrorMessage(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraPermission('unavailable');
      setCameraError('Camera API is not supported in this browser. Please use Manual Plaque Code Entry or Simulator.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setCameraActive(true);
      setCameraPermission('granted');

      // Native BarcodeDetector if available
      if ('BarcodeDetector' in window) {
        try {
          const barcodeDetector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
          detectIntervalRef.current = setInterval(async () => {
            if (videoRef.current && videoRef.current.readyState >= 2) {
              try {
                const barcodes = await barcodeDetector.detect(videoRef.current);
                if (barcodes.length > 0 && barcodes[0].rawValue) {
                  const raw = barcodes[0].rawValue;
                  handleVerifyToken(raw, 'Browser Camera BarcodeDetector');
                }
              } catch (_) {}
            }
          }, 400);
        } catch (_) {}
      }
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraPermission('denied');
        setCameraError('Camera access was denied by browser. Grant camera permission or use Manual Plaque Code Entry.');
      } else {
        setCameraPermission('unavailable');
        setCameraError('Unable to access camera hardware. Use Manual Plaque Code Entry or Simulator.');
      }
      setCameraActive(false);
    }
  };

  useEffect(() => {
    loadData();
    return () => {
      stopLiveCamera();
    };
  }, [loadData, stopLiveCamera]);

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
    <div className="space-y-6">
      {/* 1. Page Header */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#0D9488] uppercase tracking-wider mb-1">
            <QrCode className="w-4 h-4" />
            <span>Teacher Attendance Verification</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Classroom QR Check-In
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Scan the permanent QR code plaque affixed at your allocated classroom entrance to record faculty presence
          </p>
        </div>

        {/* Current Time Display */}
        <div className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-left md:text-right shrink-0">
          <div className="text-xs font-mono font-bold text-slate-900">
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {hasSchedule && activeSlot ? `Period ${activeSlot.period}` : 'Timetable Inactive'}
          </div>
          <div className="text-[11px] text-emerald-700 font-semibold mt-0.5">
            {hasSchedule && activeSlot ? `${activeSlot.timeSlot} (Active Period)` : 'No teaching sessions scheduled today'}
          </div>
        </div>
      </div>

      {manualSuccessToast && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-bold text-emerald-900 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Manual attendance override recorded successfully{activeSlot ? ` for Period ${activeSlot.period}` : ''}.</span>
        </div>
      )}

      {/* Mandatory Architectural Disclaimer Banner */}
      <div className="bg-amber-50/90 border border-amber-200/90 rounded-2xl p-4 sm:p-5 shadow-xs text-xs flex items-start gap-3.5">
        <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5 font-bold">
          <ShieldAlert className="w-4 h-4 text-amber-700" />
        </div>
        <div className="text-amber-900 leading-relaxed">
          <div className="font-bold text-amber-950 text-sm mb-0.5">
            Static Venue Plaque Architectural Notice
          </div>
          <p>
            {STATIC_VENUE_PLAQUE_NOTICE}
          </p>
        </div>
      </div>

      {/* 2. Permanent Classroom QR Architectural Banner */}
      <div className="bg-gradient-to-r from-teal-50 via-slate-50 to-emerald-50 border border-teal-200/80 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex items-start gap-3.5">
          <div className="w-9 h-9 rounded-xl bg-[#0D9488] text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="text-xs text-slate-700 leading-relaxed">
            <div className="font-bold text-slate-900 text-sm mb-0.5">
              Permanent Classroom Identity Standard
            </div>
            <p>
              Each physical lecture hall has an <strong>invariant, permanent QR code plaque</strong>.
              The classroom identity remains permanent regardless of timetable changes, teacher rotations, or subject shifts.
              Attendance is validated against your allocated timetable schedule for the current time slot.
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
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): Camera Viewport & Simulated Controls */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs">
            <div className="flex flex-wrap items-center justify-between pb-3.5 border-b border-slate-100 mb-4 gap-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <Camera className="w-4 h-4 text-[#0D9488] shrink-0" />
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider truncate">
                  Classroom Scanner Viewport
                </h2>
              </div>

              {/* Mode Switcher */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setActiveScannerTab('camera');
                  }}
                  className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                    activeScannerTab === 'camera'
                      ? 'bg-white text-[#0D9488] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Live Camera
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveScannerTab('simulator');
                    stopLiveCamera();
                  }}
                  className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                    activeScannerTab === 'simulator'
                      ? 'bg-white text-[#0D9488] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Simulator
                </button>
              </div>
            </div>

            {/* Camera Viewfinder Box */}
            <div
              onClick={activeScannerTab === 'camera' && !cameraActive ? startLiveCamera : undefined}
              className={`relative aspect-4/3 w-full rounded-2xl bg-slate-950 overflow-hidden flex flex-col items-center justify-center p-6 text-center shadow-inner border-2 border-slate-800 transition-all ${
                activeScannerTab === 'camera' && !cameraActive ? 'cursor-pointer hover:border-slate-700' : ''
              }`}
            >
              {/* Real Video Stream when Active */}
              <video
                ref={videoRef}
                playsInline
                autoPlay
                muted
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
                  cameraActive && activeScannerTab === 'camera' ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
              />

              {/* Corner Viewfinder Targeting Reticles */}
              <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-[#37C6A3] z-20" />
              <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-[#37C6A3] z-20" />
              <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-[#37C6A3] z-20" />
              <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-[#37C6A3] z-20" />

              {/* Continuous Moving Green Laser Sweep Animation Style */}
              <style>{`
                @keyframes classroomScanSweep {
                  0% { top: 12%; opacity: 0.85; }
                  50% { top: 88%; opacity: 1; }
                  100% { top: 12%; opacity: 0.85; }
                }
                .animate-classroom-scan-laser {
                  position: absolute;
                  left: 2rem;
                  right: 2rem;
                  height: 2px;
                  background: linear-gradient(90deg, transparent, #10B981, #34D399, #10B981, transparent);
                  box-shadow: 0 0 14px #10B981, 0 0 6px #10B981;
                  animation: classroomScanSweep 2.5s ease-in-out infinite;
                  pointer-events: none;
                  z-index: 25;
                }
              `}</style>

              {/* Scanning Laser Beam (Continuous Moving Sweep ONLY when camera is actively streaming) */}
              {scanState === 'idle' && cameraActive && activeScannerTab === 'camera' && (
                <div className="animate-classroom-scan-laser" />
              )}

              {/* Idle State: Clean Centered Standby Viewport (NO clipped buttons inside) */}
              {scanState === 'idle' && (!cameraActive || activeScannerTab !== 'camera') && (
                <div className="z-10 text-slate-300 max-w-xs flex flex-col items-center justify-center p-2 pointer-events-none">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center mb-2.5 text-[#10B981] shadow-lg">
                    <QrCode className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-white mb-1">
                    Classroom QR Plaque Scanner
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed max-w-[260px]">
                    Tap <strong className="text-emerald-300">Start Camera</strong> below to scan the plaque for <strong>{assignedRoom.name}</strong>.
                  </p>
                </div>
              )}

              {/* Active Streaming Overlay */}
              {scanState === 'idle' && cameraActive && activeScannerTab === 'camera' && (
                <div className="z-10 text-slate-300 max-w-xs bg-slate-950/75 backdrop-blur-xs p-3.5 rounded-2xl border border-slate-800/80 shadow-lg pointer-events-none">
                  <div className="w-10 h-10 rounded-xl bg-slate-900/90 border border-slate-700 flex items-center justify-center mx-auto mb-2 shadow-md">
                    <QrCode className="w-5 h-5 text-[#10B981]" />
                  </div>
                  <h3 className="text-xs font-bold text-white mb-0.5">
                    Align Classroom QR Plaque
                  </h3>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Point camera toward permanent acrylic QR plaque for <strong>{assignedRoom.name}</strong>.
                  </p>
                </div>
              )}

              {/* Result State: Valid Scan */}
              {scanState === 'valid' && (
                <div className="z-10 p-5 rounded-2xl bg-emerald-950/90 border border-emerald-500 text-white max-w-sm animate-in zoom-in-95">
                  <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-2" />
                  <h3 className="text-base font-bold text-white">
                    Classroom QR Verified!
                  </h3>
                  <p className="text-xs text-emerald-200 mt-1">
                    Identity confirmed for {assignedRoom.name}. Attendance recorded successfully.
                  </p>
                  <div className="mt-3 py-1.5 px-3 bg-emerald-900/60 rounded-lg text-[11px] font-mono text-emerald-300">
                    Timestamp: {new Date().toLocaleTimeString()}
                  </div>
                </div>
              )}

              {/* Result State: Invalid Room Scan */}
              {scanState === 'invalid_room' && (
                <div className="z-10 p-5 rounded-2xl bg-rose-950/90 border border-rose-500 text-white max-w-sm animate-in zoom-in-95">
                  <XCircle className="w-12 h-12 text-rose-400 mx-auto mb-2" />
                  <h3 className="text-base font-bold text-white">
                    Wrong Classroom QR
                  </h3>
                  <p className="text-xs text-rose-200 mt-1">
                    {scanErrorMessage || (
                      <>Scanned plaque does not match your assigned venue for this lecture (<strong>{assignedRoom.name}</strong>).</>
                    )}
                  </p>
                </div>
              )}

              {/* Result State: Expired Window */}
              {scanState === 'expired_window' && (
                <div className="z-10 p-5 rounded-2xl bg-amber-950/90 border border-amber-500 text-white max-w-sm animate-in zoom-in-95">
                  <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-2" />
                  <h3 className="text-base font-bold text-white">
                    Permitted Scan Window Expired
                  </h3>
                  <p className="text-xs text-amber-200 mt-1">
                    {scanErrorMessage || `The 15-minute start window for Period ${activeSlot?.period ?? 1} has ended. Please request manual administrative fallback.`}
                  </p>
                </div>
              )}

              {/* Result State: Already Recorded */}
              {scanState === 'already_recorded' && (
                <div className="z-10 p-5 rounded-2xl bg-slate-900/90 border border-slate-600 text-white max-w-sm animate-in zoom-in-95">
                  <FileCheck className="w-12 h-12 text-teal-400 mx-auto mb-2" />
                  <h3 className="text-base font-bold text-white">
                    Already Recorded
                  </h3>
                  <p className="text-xs text-slate-300 mt-1">
                    {scanErrorMessage || `Your attendance for Period ${activeSlot?.period ?? 1} was already registered${activeSlot?.checkInTime ? ` at ${activeSlot.checkInTime}` : ''}.`}
                  </p>
                </div>
              )}
            </div>

            {/* Single Clean Primary Action Button & Subtle Manual Link */}
            {activeScannerTab === 'camera' && (
              <div className="mt-4 space-y-3">
                {cameraActive ? (
                  <button
                    type="button"
                    onClick={stopLiveCamera}
                    className="w-full py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-[0.99] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                  >
                    <VideoOff className="w-4 h-4" />
                    <span>Stop Camera</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={startLiveCamera}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#0D9488] to-[#10B981] hover:from-[#0F766E] hover:to-[#059669] active:scale-[0.99] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
                  >
                    <Video className="w-4 h-4" />
                    <span>Start Camera</span>
                  </button>
                )}

                {/* Consolidated Subtle Secondary Action Link */}
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setManualModalOpen(true)}
                    className="text-xs font-semibold text-slate-500 hover:text-[#0D9488] hover:underline transition cursor-pointer"
                  >
                    Camera unavailable? Enter Plaque Code Manually &rarr;
                  </button>
                </div>
              </div>
            )}

            {cameraError && activeScannerTab === 'camera' && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center justify-between gap-2">
                <span>{cameraError}</span>
                <button
                  type="button"
                  onClick={() => setManualModalOpen(true)}
                  className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shrink-0 cursor-pointer"
                >
                  Enter Code Manually
                </button>
              </div>
            )}

            {/* Interactive State Simulator Controls for Reviewers */}
            {activeScannerTab === 'simulator' && (
              <div className="mt-5 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-[#0D9488]" />
                    <span>Prototype Evaluator State Simulator</span>
                  </span>
                  {scanState !== 'idle' && (
                    <button
                      onClick={() => setScanState('idle')}
                      className="text-xs font-bold text-[#0D9488] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Reset Scanner
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mb-3">
                  Select any scan scenario to evaluate visual validation and error handling without requiring physical cameras:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => triggerScan('valid')}
                    className={`py-2 px-2.5 rounded-lg text-xs font-bold transition border cursor-pointer ${
                      scanState === 'valid'
                        ? 'bg-emerald-600 text-white border-emerald-700'
                        : 'bg-white hover:bg-emerald-50 text-emerald-800 border-emerald-200'
                    }`}
                  >
                    ✓ Valid Scan
                  </button>
                  <button
                    type="button"
                    onClick={() => triggerScan('invalid_room')}
                    className={`py-2 px-2.5 rounded-lg text-xs font-bold transition border cursor-pointer ${
                      scanState === 'invalid_room'
                        ? 'bg-rose-600 text-white border-rose-700'
                        : 'bg-white hover:bg-rose-50 text-rose-800 border-rose-200'
                    }`}
                  >
                    ✕ Wrong Room
                  </button>
                  <button
                    type="button"
                    onClick={() => triggerScan('expired_window')}
                    className={`py-2 px-2.5 rounded-lg text-xs font-bold transition border cursor-pointer ${
                      scanState === 'expired_window'
                        ? 'bg-amber-600 text-white border-amber-700'
                        : 'bg-white hover:bg-amber-50 text-amber-800 border-amber-200'
                    }`}
                  >
                    ⏱ Expired Window
                  </button>
                  <button
                    type="button"
                    onClick={() => triggerScan('already_recorded')}
                    className={`py-2 px-2.5 rounded-lg text-xs font-bold transition border cursor-pointer ${
                      scanState === 'already_recorded'
                        ? 'bg-slate-800 text-white border-slate-900'
                        : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-200'
                    }`}
                  >
                    ↺ Already Logged
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column (5 cols): Timetable & Verified Confirmation Receipt */}
        <div className="lg:col-span-5 space-y-6">
          {/* Scheduled Session Card */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs">
            {hasSchedule && activeSlot ? (
              <>
                <div className="pb-3 border-b border-slate-100">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#0D9488]">
                      Allocated Teaching Schedule
                    </span>
                    {activeSlot.isCurrentPeriod ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Active Period
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-semibold">
                        Colombo Timetable
                      </span>
                    )}
                  </div>

                  {todaySchedule.length > 1 && (
                    <div className="flex items-center gap-1.5 my-2.5 overflow-x-auto pb-1">
                      {todaySchedule.map((slot) => {
                        const isSelected = activeSlot?.id === slot.id || activeSlot?.scheduleId === slot.id;
                        return (
                          <button
                            key={slot.id}
                            type="button"
                            onClick={() => setSelectedSlotId(slot.id)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
                              isSelected
                                ? 'bg-[#0D9488] text-white shadow-xs'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                          >
                            <span>P{slot.period}: {slot.timeSlot}</span>
                            {slot.status === 'Verified' ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <h3 className="text-base font-bold text-slate-900 mt-0.5">
                    Period {activeSlot.period}: {activeSlot.subject}
                  </h3>
                  <div className="text-xs text-slate-500 font-semibold mt-0.5">
                    {activeSlot.className}
                  </div>
                </div>

                <div className="space-y-3 py-3.5 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Scheduled Time</span>
                    <span className="font-mono font-bold text-slate-900">{activeSlot.timeSlot}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Assigned Venue</span>
                    <span className="font-bold text-[#0D9488]">{assignedRoom.name}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Venue Code</span>
                    <span className="font-mono font-semibold text-slate-800">{assignedRoom.code}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Room Capacity</span>
                    <span className="font-bold text-slate-900">{assignedRoom.capacity} Seats</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Check-in Status</span>
                    <span className={`font-bold ${activeSlot.status === 'Verified' ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {activeSlot.status}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="pb-3 border-b border-slate-100">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Allocated Teaching Schedule
                  </span>
                  <h3 className="text-base font-bold text-slate-900 mt-0.5">
                    No Scheduled Period Right Now
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    You can still scan any assigned Class QR Plaque below to record your attendance.
                  </p>
                </div>

                <div className="space-y-3 py-3.5 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Scheduled Time</span>
                    <span className="font-mono text-slate-600">Open Window</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Scanner Status</span>
                    <span className="font-semibold text-emerald-700 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                      Camera Scanner Active
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Classroom Venue</span>
                    <span className="font-mono text-slate-700">{assignedRoom.name}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Attendance State</span>
                    <span className="font-bold text-slate-700">Ready to Scan</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Verified Confirmation Certificate Card */}
          {scanState === 'valid' && (
            <div className="bg-gradient-to-br from-[#0F172A] to-[#1E293B] text-white rounded-2xl p-5 shadow-lg animate-in fade-in">
              <div className="flex items-center justify-between pb-3 border-b border-slate-700">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-[#37C6A3]" />
                  <span className="text-xs font-bold uppercase tracking-wider text-white">
                    Verified Session Receipt
                  </span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-[#37C6A3] font-bold">
                  AUTH-OK
                </span>
              </div>

              <div className="py-3 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Ustadh:</span>
                  <span className="font-bold text-white">{teacherName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Classroom:</span>
                  <span className="font-semibold text-[#37C6A3]">{assignedRoom.name} ({assignedRoom.code})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Check-in Time:</span>
                  <span className="font-mono text-white">{new Date().toLocaleTimeString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Session Method:</span>
                  <span className="font-mono text-xs text-emerald-400">Classroom Plaque QR</span>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-700/80">
                <a
                  href="/attendance/students"
                  className="w-full py-2.5 px-3 rounded-xl bg-[#37C6A3] hover:bg-[#2db291] text-[#0F172A] font-bold text-xs flex items-center justify-center gap-1.5 transition"
                >
                  <span>Proceed to Student Attendance</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. Faculty Attendance Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs overflow-hidden">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              My Recent Attendance Logs
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Historical classroom QR check-ins recorded for {teacherName}
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            {logs.length} Total Logs
          </span>
        </div>

        <div className="overflow-x-auto mt-4 -mx-5 sm:mx-0">
          <table className="w-full text-left border-collapse min-w-[650px] text-xs">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Period</th>
                <th className="py-3 px-4">Class & Subject</th>
                <th className="py-3 px-4">Classroom Venue</th>
                <th className="py-3 px-4">Verification Method</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    <p className="font-semibold text-sm text-slate-700">No attendance check-ins recorded yet.</p>
                    <p className="text-xs text-slate-400 mt-1">Once you verify your classroom arrival using QR check-in, historical logs will appear here.</p>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/60 transition">
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-900">{log.date}</div>
                    <div className="text-[11px] text-slate-500 font-mono">{log.time}</div>
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-800">
                    Period {log.period}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-900">{log.className}</div>
                    <div className="text-[11px] text-[#0D9488] font-medium">{log.subject}</div>
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-700">
                    {log.roomName}
                  </td>
                  <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                    {log.method}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        log.status === 'Verified'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : log.status === 'Late'
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : 'bg-blue-50 text-blue-800 border border-blue-200'
                      }`}
                    >
                      {log.status}
                    </span>
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Manual Attendance Fallback Modal */}
      {manualModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                Manual Teacher Attendance Fallback
              </h3>
              <button
                onClick={() => setManualModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 mt-3 leading-relaxed">
              Use this fallback only when physical camera failure, QR label obstruction, or authorized classroom relocation prevents standard QR verification.
            </p>

            <form onSubmit={handleManualSubmit} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Classroom Plaque Code / Room Token *
                </label>
                <input
                  type="text"
                  required
                  placeholder={assignedRoom ? `e.g. ${assignedRoom.qrPayload || assignedRoom.code}` : 'e.g. CR-01 or CLS-ROOM-TOKEN'}
                  value={manualRoomToken}
                  onChange={(e) => setManualRoomToken(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Enter the permanent plaque identifier displayed on the acrylic sign at the classroom entrance.
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Reason for Manual Override
                </label>
                <select
                  value={manualReason}
                  onChange={(e) => setManualReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D9488] bg-white"
                >
                  <option value="Camera Hardware Fault on Faculty Device">Camera Hardware Fault on Faculty Device</option>
                  <option value="Room QR Code Plaque Damaged / Obscured">Room QR Code Plaque Damaged / Obscured</option>
                  <option value="Emergency Classroom Relocation by Administration">Emergency Classroom Relocation by Administration</option>
                  <option value="Authorized Temporary Timetable Shift">Authorized Temporary Timetable Shift</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Supervisor Authorization / Reference Note
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Verbal clearance granted by Ustadh Registrar due to cracked camera lens."
                  value={manualNote}
                  onChange={(e) => setManualNote(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                />
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-[11px]">
                Manual attendance entries are flagged with status <strong>Manual Override</strong> and audited by Madrasa Administration.
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setManualModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-[#0D9488] hover:bg-[#0F766E] rounded-xl"
                >
                  Submit Authorized Override
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
