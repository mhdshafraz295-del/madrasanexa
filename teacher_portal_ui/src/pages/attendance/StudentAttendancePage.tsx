import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ScanLine,
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Search,
  Check,
  X,
  Sparkles,
  ShieldCheck,
  Camera,
  Volume2,
  VolumeX,
  History,
  Mail,
  Send,
  LogIn,
  LogOut,
  Building,
  Home,
  RefreshCw,
  Filter,
} from 'lucide-react';
import type { AssignedClass } from '../../mock/teacherMockData';
import {
  studentAttendanceApi,
  classesApi,
  DailyStudentItem,
} from '../../services/api';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import Pagination from '../../components/common/Pagination';
import { UsbScannerInput } from '../../components/attendance/UsbScannerInput';
import { CameraScannerView } from '../../components/attendance/CameraScannerView';
import {
  classifyScanInput,
  ScanDebouncer,
  playScannerFeedback,
} from '../../components/attendance/scanner-utils';

type MovementDirection = 'ENTRY' | 'EXIT';
type CategoryFilter = 'ALL' | 'DAY_SCHOLAR' | 'BOARDING';
type StatusFilter = 'ALL' | 'PRESENT' | 'UNMARKED';
type ScannerInputMode = 'usb' | 'camera';

export interface RecentScanItem {
  id: string;
  timestamp: string;
  studentName: string;
  rollNo: string;
  className: string;
  direction: MovementDirection;
  method: string;
  status: 'PRESENT' | 'ALREADY_MARKED';
  category: 'DAY_SCHOLAR' | 'BOARDING';
  parentEmailSent: boolean;
  parentEmail?: string | null;
  securityTier: string;
}

export default function StudentAttendancePage() {
  // Top Filter States
  const [movementDirection, setMovementDirection] = useState<MovementDirection>('ENTRY');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('ALL');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [categoryFilter, selectedClassId, statusFilter, searchQuery]);

  // Roster & Stats State
  const [roster, setRoster] = useState<DailyStudentItem[]>([]);
  const [assignedClasses, setAssignedClasses] = useState<AssignedClass[]>([]);
  const [stats, setStats] = useState({
    totalStudents: 0,
    presentCount: 0,
    dayScholarsPresent: 0,
    boardingPresent: 0,
    unmarkedCount: 0,
  });

  // Loading & Submission State
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Scanner Controls & Recent Scans
  const [scannerMode, setScannerMode] = useState<ScannerInputMode>('usb');
  const [audioFeedback, setAudioFeedback] = useState<boolean>(true);
  const [recentScans, setRecentScans] = useState<RecentScanItem[]>([]);
  const debouncerRef = useRef(new ScanDebouncer(2200));

  // Feedback Toast
  const [lastScannedToast, setLastScannedToast] = useState<{
    studentName: string;
    rollNo: string;
    direction: MovementDirection;
    status: 'success' | 'duplicate';
    parentEmailSent: boolean;
    parentEmail?: string | null;
    message: string;
  } | null>(null);

  // Manual Status Override Modal
  const [editingStudent, setEditingStudent] = useState<DailyStudentItem | null>(null);
  const [manualStatusChoice, setManualStatusChoice] = useState<'PRESENT' | 'UNMARKED'>('PRESENT');
  const [manualReasonText, setManualReasonText] = useState('');

  // Load Daily Roster & Assigned Classes
  const loadRoster = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [rosterRes, classesRes] = await Promise.all([
        studentAttendanceApi.getDailyRoster({
          classId: selectedClassId || undefined,
          category: categoryFilter !== 'ALL' ? categoryFilter : undefined,
        }),
        classesApi.getAssignedClasses(),
      ]);

      if (rosterRes?.students) {
        setRoster(rosterRes.students);
        setStats(rosterRes.stats);
      }
      if (classesRes) {
        setAssignedClasses(classesRes);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load daily attendance roster.');
    } finally {
      setIsLoading(false);
    }
  }, [categoryFilter, selectedClassId]);

  useEffect(() => {
    loadRoster();
  }, [loadRoster]);

  // Unified Scanner Payload Handler
  const handleScanPayload = useCallback(
    async (
      rawPayload: string,
      _metadata?: { isScanner?: boolean; averageIntervalMs?: number } | 'camera'
    ) => {
      const trimmed = (rawPayload || '').trim();
      if (!trimmed || isSubmitting) return;

      // Debounce rapid duplicate scans
      if (debouncerRef.current.isDuplicate(trimmed)) {
        playScannerFeedback('duplicate', !audioFeedback);
        return;
      }

      const classification = classifyScanInput(trimmed);
      const todayStr = new Date().toISOString().split('T')[0];

      try {
        setIsSubmitting(true);
        const res = await studentAttendanceApi.scanDailyStudentAttendance({
          scanInput: trimmed,
          direction: movementDirection,
          date: todayStr,
          classId: selectedClassId || undefined,
        });

        const nowTime =
          res.scannedTime ||
          new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const studentId = res.student.id;
        const studentName = res.student.fullName;
        const rollNo = res.student.admissionNo;
        const className = res.student.className || 'General Class';
        const category = res.student.category;

        if (res.alreadyMarked) {
          playScannerFeedback('warning', !audioFeedback);
          setLastScannedToast({
            studentName,
            rollNo,
            direction: res.direction,
            status: 'duplicate',
            parentEmailSent: res.parentEmailSent,
            parentEmail: res.parentEmail,
            message: `ALREADY RECORDED: ${studentName} (${rollNo}) was already marked Present earlier today.`,
          });
        } else {
          playScannerFeedback('success', !audioFeedback);
          setLastScannedToast({
            studentName,
            rollNo,
            direction: res.direction,
            status: 'success',
            parentEmailSent: res.parentEmailSent,
            parentEmail: res.parentEmail,
            message: `${
              res.direction === 'ENTRY' ? 'ENTRY CHECKED IN' : 'EXIT CHECKED OUT'
            }: ${studentName} (${rollNo}) • Class: ${className}.${
              res.parentEmailSent
                ? ` Parent alert dispatched to ${res.parentEmail}.`
                : res.parentEmail
                ? ` Email queued for ${res.parentEmail}.`
                : ' No parent email registered.'
            }`,
          });

          // Optimistically update live roster row
          setRoster((prev) =>
            prev.map((s) => {
              if (s.id === studentId || s.admissionNo.toLowerCase() === rollNo.toLowerCase()) {
                return {
                  ...s,
                  status: 'PRESENT',
                  checkInTime: res.direction === 'ENTRY' ? nowTime : s.checkInTime || nowTime,
                  checkOutTime: res.direction === 'EXIT' ? nowTime : s.checkOutTime,
                  method: res.method === 'QR_SCAN' ? '2D QR Code' : '1D Barcode',
                  parentEmailSent: res.parentEmailSent || s.parentEmailSent,
                };
              }
              return s;
            })
          );

          // Update summary counts
          setStats((prev) => {
            const wasPresent = roster.find((s) => s.id === studentId)?.status === 'PRESENT';
            if (wasPresent) return prev;
            return {
              ...prev,
              presentCount: prev.presentCount + 1,
              unmarkedCount: Math.max(0, prev.unmarkedCount - 1),
              dayScholarsPresent:
                category === 'BOARDING' ? prev.dayScholarsPresent : prev.dayScholarsPresent + 1,
              boardingPresent:
                category === 'BOARDING' ? prev.boardingPresent + 1 : prev.boardingPresent,
            };
          });
        }

        // Add to Recent Scans feed
        setRecentScans((prev) => [
          {
            id: `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            timestamp: nowTime,
            studentName,
            rollNo,
            className,
            direction: res.direction,
            method: res.method === 'QR_SCAN' ? '2D QR Code' : '1D Barcode',
            status: res.alreadyMarked ? 'ALREADY_MARKED' : 'PRESENT',
            category,
            parentEmailSent: res.parentEmailSent,
            parentEmail: res.parentEmail,
            securityTier: classification.securityTier,
          },
          ...prev.slice(0, 24),
        ]);
      } catch (err: any) {
        playScannerFeedback('error', !audioFeedback);
        setLastScannedToast({
          studentName: trimmed,
          rollNo: '—',
          direction: movementDirection,
          status: 'duplicate',
          parentEmailSent: false,
          message: err?.message || `Scan failed for "${trimmed}".`,
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [audioFeedback, isSubmitting, movementDirection, roster, selectedClassId]
  );

  // Manual Status Override Submission
  const handleSaveManualEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;

    const studentId = editingStudent.id;
    const newStatus = manualStatusChoice;
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setRoster((prev) =>
      prev.map((s) =>
        s.id === studentId
          ? {
              ...s,
              status: newStatus,
              checkInTime: newStatus === 'PRESENT' ? s.checkInTime || nowTime : null,
              method: newStatus === 'PRESENT' ? 'Manual Teacher Mark' : s.method,
            }
          : s
      )
    );

    setStats((prev) => {
      const wasPresent = editingStudent.status === 'PRESENT';
      if (wasPresent && newStatus === 'UNMARKED') {
        return {
          ...prev,
          presentCount: Math.max(0, prev.presentCount - 1),
          unmarkedCount: prev.unmarkedCount + 1,
          dayScholarsPresent:
            editingStudent.category === 'BOARDING'
              ? prev.dayScholarsPresent
              : Math.max(0, prev.dayScholarsPresent - 1),
          boardingPresent:
            editingStudent.category === 'BOARDING'
              ? Math.max(0, prev.boardingPresent - 1)
              : prev.boardingPresent,
        };
      } else if (!wasPresent && newStatus === 'PRESENT') {
        return {
          ...prev,
          presentCount: prev.presentCount + 1,
          unmarkedCount: Math.max(0, prev.unmarkedCount - 1),
          dayScholarsPresent:
            editingStudent.category === 'BOARDING'
              ? prev.dayScholarsPresent
              : prev.dayScholarsPresent + 1,
          boardingPresent:
            editingStudent.category === 'BOARDING'
              ? prev.boardingPresent + 1
              : prev.boardingPresent,
        };
      }
      return prev;
    });

    setEditingStudent(null);
  };

  // Filtered Roster for UI
  const filteredRoster = roster.filter((student) => {
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = student.fullName.toLowerCase().includes(q);
      const matchRoll = student.admissionNo.toLowerCase().includes(q);
      const matchClass = student.className.toLowerCase().includes(q);
      if (!matchName && !matchRoll && !matchClass) return false;
    }

    // Status filter
    if (statusFilter !== 'ALL' && student.status !== statusFilter) {
      return false;
    }

    return true;
  });

  if (isLoading && roster.length === 0) {
    return (
      <LoadingState
        message="Loading Madrasa daily attendance scanner & active roster..."
        className="my-8"
      />
    );
  }

  if (error && roster.length === 0) {
    return <ErrorState message={error} onRetry={loadRoster} className="my-8" />;
  }

  const attendancePercent =
    stats.totalStudents > 0
      ? Math.round((stats.presentCount / stats.totalStudents) * 100)
      : 0;

  return (
    <div className="space-y-6 overflow-x-hidden min-w-0 max-w-full">
      {/* 1. Header with Operational Context & Live Sync Notice */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 min-w-0">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
              ● Live Daily Attendance
            </span>
            <span className="text-xs text-slate-500 font-mono truncate">
              Auto-Synced to Admin Portal
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight break-words">
            Unified Morning Student Scanner & Roster
          </h1>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Continuous instant barcode & QR scanning across all students with automatic Parent Email Alerts on Entry and Exit
          </p>
        </div>

        {/* Live Admin Sync Badge & Refresh */}
        <div className="flex items-center gap-2.5 shrink-0 w-full md:w-auto justify-between md:justify-end">
          <div className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs flex items-center gap-2 min-w-0 flex-1 md:flex-initial">
            <ShieldCheck className="w-4 h-4 text-[#0D9488] shrink-0" />
            <div className="min-w-0">
              <div className="font-bold text-slate-900 text-[11px] truncate">Instant Admin Sync</div>
              <div className="text-[10px] text-slate-500 truncate">Parent email alerts auto-dispatched</div>
            </div>
          </div>

          <button
            type="button"
            onClick={loadRoster}
            disabled={isLoading}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition cursor-pointer shrink-0"
            title="Refresh Roster & Counters"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#0D9488]' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. Top Control Bar: Direction Toggle, Residency Filter & Class Filter */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-3.5 sm:p-5 shadow-xs space-y-4 min-w-0">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 min-w-0">
          {/* Movement Direction Toggle */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 w-full lg:w-auto min-w-0">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider shrink-0">
              Movement Direction:
            </span>
            <div className="grid grid-cols-2 sm:inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setMovementDirection('ENTRY')}
                className={`px-2.5 sm:px-4 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer min-w-0 truncate ${
                  movementDirection === 'ENTRY'
                    ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-700'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LogIn className="w-4 h-4 shrink-0" />
                <span className="truncate">ENTRY (Check-In)</span>
              </button>

              <button
                type="button"
                onClick={() => setMovementDirection('EXIT')}
                className={`px-2.5 sm:px-4 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer min-w-0 truncate ${
                  movementDirection === 'EXIT'
                    ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-700'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span className="truncate">EXIT (Check-Out)</span>
              </button>
            </div>
          </div>

          {/* Residency Filter Pills & Optional Class Dropdown */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full lg:w-auto min-w-0">
            {/* Residency Category Pills */}
            <div className="flex items-center gap-1.5 w-full sm:w-auto min-w-0">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider mr-1 hidden sm:inline shrink-0">
                Residency:
              </span>
              <div className="inline-flex rounded-xl bg-slate-100 p-1 overflow-x-auto max-w-full scrollbar-none">
                {(
                  [
                    { key: 'ALL', label: 'All Students', icon: Users },
                    { key: 'DAY_SCHOLAR', label: 'Day Scholar', icon: Home },
                    { key: 'BOARDING', label: 'Boarding', icon: Building },
                  ] as const
                ).map((tab) => {
                  const Icon = tab.icon;
                  const isActive = categoryFilter === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setCategoryFilter(tab.key)}
                      className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                        isActive
                          ? 'bg-white text-slate-900 shadow-2xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {Icon && <Icon className="w-3.5 h-3.5 text-[#0D9488]" />}
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Optional Class Filter Dropdown */}
            <div className="w-full sm:w-auto sm:min-w-[180px] min-w-0">
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-[#0D9488] bg-white cursor-pointer truncate"
              >
                <option value="">All Madrasa Classes</option>
                {assignedClasses.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name} ({cls.totalStudents} enrolled)
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Live Summary Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Total Students */}
        <div className="bg-white rounded-2xl border border-slate-200 p-3.5 text-center shadow-2xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Total Students
          </span>
          <div className="text-2xl font-black text-slate-900 mt-0.5">{stats.totalStudents}</div>
          <span className="text-[10px] text-slate-400">Registered cohort</span>
        </div>

        {/* Present (Checked In) */}
        <div className="bg-white rounded-2xl border border-emerald-200 bg-emerald-50/40 p-3.5 text-center shadow-2xs">
          <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
            Present (Checked In)
          </span>
          <div className="text-2xl font-black text-emerald-700 mt-0.5">{stats.presentCount}</div>
          <span className="text-[10px] font-bold text-emerald-600">{attendancePercent}% attendance rate</span>
        </div>

        {/* Day Scholars Present */}
        <div className="bg-white rounded-2xl border border-teal-200 bg-teal-50/40 p-3.5 text-center shadow-2xs">
          <span className="text-[11px] font-bold text-teal-800 uppercase tracking-wider flex items-center justify-center gap-1">
            <Home className="w-3 h-3" />
            <span>Day Scholars Present</span>
          </span>
          <div className="text-2xl font-black text-teal-700 mt-0.5">{stats.dayScholarsPresent}</div>
          <span className="text-[10px] text-teal-600">Morning commute verified</span>
        </div>

        {/* Boarding Present */}
        <div className="bg-white rounded-2xl border border-indigo-200 bg-indigo-50/40 p-3.5 text-center shadow-2xs">
          <span className="text-[11px] font-bold text-indigo-800 uppercase tracking-wider flex items-center justify-center gap-1">
            <Building className="w-3 h-3" />
            <span>Boarding Present</span>
          </span>
          <div className="text-2xl font-black text-indigo-700 mt-0.5">{stats.boardingPresent}</div>
          <span className="text-[10px] text-indigo-600">Residential attendance</span>
        </div>

        {/* Unmarked */}
        <div className="bg-white rounded-2xl border border-amber-200 bg-amber-50/40 p-3.5 text-center shadow-2xs col-span-2 sm:col-span-1">
          <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">
            Unmarked
          </span>
          <div className="text-2xl font-black text-amber-700 mt-0.5">{stats.unmarkedCount}</div>
          <span className="text-[10px] text-amber-600">Pending morning scan</span>
        </div>
      </div>

      {/* 4. Dual Scanner Workspace (USB Hardware + Device Camera) */}
      <div className="space-y-4">
        {/* Scanner Input Mode Toggle & Hardware Sound Bar */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Scanner Input:
            </span>
            <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
              <button
                type="button"
                onClick={() => setScannerMode('usb')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  scannerMode === 'usb'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ScanLine className="w-3.5 h-3.5 text-[#0D9488]" />
                <span>USB Hardware Scanner</span>
              </button>

              <button
                type="button"
                onClick={() => setScannerMode('camera')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  scannerMode === 'camera'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Camera className="w-3.5 h-3.5 text-[#0D9488]" />
                <span>Live Device Camera</span>
              </button>
            </div>
          </div>

          {/* Sound Toggle & Active Mode Indicator */}
          <div className="flex items-center gap-2.5 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => setAudioFeedback(!audioFeedback)}
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition cursor-pointer ${
                audioFeedback
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-800'
              }`}
              title={audioFeedback ? 'Sound Feedback: Active' : 'Sound Feedback: Muted'}
            >
              {audioFeedback ? (
                <>
                  <Volume2 className="w-4 h-4 text-emerald-600" />
                  <span>Sound: ON</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-4 h-4 text-slate-400" />
                  <span>Sound: OFF</span>
                </>
              )}
            </button>

            <span className="px-3 py-1 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-600">
              Active Mode:{' '}
              <strong className={movementDirection === 'ENTRY' ? 'text-emerald-700' : 'text-blue-700'}>
                {movementDirection}
              </strong>
            </span>
          </div>
        </div>

        {/* Active Scanner Component */}
        {scannerMode === 'usb' ? (
          <UsbScannerInput
            onScan={(payload, meta) => handleScanPayload(payload, meta)}
            disabled={isSubmitting}
            autoFocus={true}
          />
        ) : (
          <CameraScannerView
            onScan={(payload) => handleScanPayload(payload, 'camera')}
            disabled={isSubmitting}
            contextBadge={movementDirection === 'ENTRY' ? 'ENTRY (Check-In)' : 'EXIT (Check-Out)'}
            statsBadge={`Present: ${stats.presentCount}`}
          />
        )}

        {/* Interactive Quick-Tap Simulation Pill Bar */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#0D9488]" />
              <span>Quick-Tap Card Simulation (Tap to simulate physical QR/Barcode badge scan)</span>
            </span>
            <span className="text-[10px] text-slate-400">Simulator Fallback</span>
          </div>
          <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
            {roster.slice(0, 30).map((s) => {
              const isPresent = s.status === 'PRESENT';
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleScanPayload(s.admissionNo)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition border flex items-center gap-1.5 cursor-pointer ${
                    isPresent
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-200'
                  }`}
                >
                  {isPresent ? (
                    <Check className="w-3 h-3 text-emerald-600" />
                  ) : (
                    <ScanLine className="w-3 h-3 text-slate-400" />
                  )}
                  <span>{s.fullName.split(' ')[0]}</span>
                  <span className="text-[10px] font-mono text-slate-400">({s.admissionNo})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Instant Scan Feedback Toast */}
        {lastScannedToast && (
          <div
            className={`p-4 rounded-xl text-xs font-bold flex items-start gap-3 animate-in fade-in ${
              lastScannedToast.status === 'success'
                ? 'bg-emerald-50 border border-emerald-300 text-emerald-950'
                : 'bg-amber-50 border border-amber-300 text-amber-950'
            }`}
          >
            {lastScannedToast.status === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-extrabold text-sm">
                  {lastScannedToast.studentName} ({lastScannedToast.rollNo})
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    lastScannedToast.direction === 'ENTRY'
                      ? 'bg-emerald-200 text-emerald-900'
                      : 'bg-blue-200 text-blue-900'
                  }`}
                >
                  {lastScannedToast.direction}
                </span>
                {lastScannedToast.parentEmailSent && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-800 border border-teal-300">
                    <Mail className="w-3 h-3" />
                    <span>Parent Email Alert Dispatched</span>
                  </span>
                )}
              </div>
              <div className="text-xs font-medium text-slate-700 mt-1">
                {lastScannedToast.message}
              </div>
            </div>
          </div>
        )}

        {/* Recent Scans Feed */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-[#0D9488]" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Recent Attendance Scans (This Morning)
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              {recentScans.length} events logged
            </span>
          </div>

          {recentScans.length === 0 ? (
            <div className="py-6 text-center text-slate-400 text-xs">
              No student cards scanned yet this morning. Scan physical student ID cards using the USB
              scanner or device camera above.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
              {recentScans.map((item) => (
                <div
                  key={item.id}
                  className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2"
                >
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <span className="font-mono text-[11px] text-slate-400">{item.timestamp}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        item.direction === 'ENTRY'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {item.direction}
                    </span>
                    <span className="font-bold text-slate-900 truncate">{item.studentName}</span>
                    <span className="font-mono text-[11px] text-slate-500">({item.rollNo})</span>
                    <span className="text-[11px] text-slate-400">• {item.className}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {item.parentEmailSent ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                        <Send className="w-3 h-3 text-emerald-600" />
                        <span>Email Sent</span>
                      </span>
                    ) : (
                      item.parentEmail && (
                        <span className="text-[10px] text-slate-400">
                          {item.parentEmail}
                        </span>
                      )
                    )}

                    <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                      {item.method}
                    </span>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        item.status === 'PRESENT'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {item.status === 'PRESENT' ? 'Marked Present' : 'Already Recorded'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 5. Live Student Roster Table with Search & Status Filter */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              Live Madrasa Student Roster ({filteredRoster.length} Students)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Live attendance status synced directly with Admin Portal Daily Attendance
            </p>
          </div>

          {/* Search & Status Filter Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-48">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by name, ID, class..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
              />
            </div>

            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-[11px]">
              {(['ALL', 'PRESENT', 'UNMARKED'] as const).map((st) => (
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
                  {st === 'ALL' ? 'All' : st === 'PRESENT' ? 'Present' : 'Unmarked'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="w-full overflow-x-auto mt-4 -mx-5 sm:mx-0">
          <table className="w-full text-left border-collapse min-w-[760px] text-xs">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider whitespace-nowrap">
                <th className="py-3 px-4">Admission No</th>
                <th className="py-3 px-4">Student Name</th>
                <th className="py-3 px-4">Class</th>
                <th className="py-3 px-4">Residency</th>
                <th className="py-3 px-4">Parent Email</th>
                <th className="py-3 px-4">Daily Status</th>
                <th className="py-3 px-4">Entry Time</th>
                <th className="py-3 px-4">Exit Time</th>
                <th className="py-3 px-4">Parent Alert</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRoster.slice((page - 1) * 10, page * 10).map((student) => {
                const isPresent = student.status === 'PRESENT';
                return (
                  <tr key={student.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3.5 px-4 font-mono font-semibold text-slate-700 whitespace-nowrap">
                      {student.admissionNo}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900 whitespace-nowrap">
                      {student.fullName}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap">
                      <span className="font-semibold text-slate-900">{student.className}</span>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          student.category === 'BOARDING'
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            : 'bg-teal-50 text-teal-700 border border-teal-200'
                        }`}
                      >
                        {student.category === 'BOARDING' ? (
                          <>
                            <Building className="w-3 h-3" />
                            <span>Boarding</span>
                          </>
                        ) : (
                          <>
                            <Home className="w-3 h-3" />
                            <span>Day Scholar</span>
                          </>
                        )}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                      {student.guardianEmail || (
                        <span className="text-slate-400 italic">None registered</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isPresent
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {isPresent ? 'Present' : 'Unmarked'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-700 whitespace-nowrap">
                      {student.checkInTime || '—'}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-700 whitespace-nowrap">
                      {student.checkOutTime || '—'}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {student.parentEmailSent ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <Check className="w-3 h-3" />
                          <span>Sent</span>
                        </span>
                      ) : student.guardianEmail ? (
                        <span className="text-[10px] text-slate-400">Ready</span>
                      ) : (
                        <span className="text-[10px] text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingStudent(student);
                          setManualStatusChoice(student.status === 'PRESENT' ? 'PRESENT' : 'UNMARKED');
                          setManualReasonText('');
                        }}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold text-[11px] transition cursor-pointer"
                      >
                        Override
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Pagination
            currentPage={page}
            totalItems={filteredRoster.length}
            pageSize={10}
            onPageChange={setPage}
            itemLabel="students"
          />
        </div>
      </div>

      {/* 6. Manual Status Override Modal */}
      {editingStudent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#0D9488]">
                  Manual Status Override
                </span>
                <h3 className="text-base font-bold text-slate-900">{editingStudent.fullName}</h3>
                <div className="text-xs text-slate-500 font-mono">
                  {editingStudent.admissionNo} • {editingStudent.className}
                </div>
              </div>
              <button
                onClick={() => setEditingStudent(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveManualEdit} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Select Daily Attendance Status
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setManualStatusChoice('PRESENT')}
                    className={`py-2 px-3 rounded-xl font-bold text-xs transition border cursor-pointer ${
                      manualStatusChoice === 'PRESENT'
                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    Mark Present
                  </button>

                  <button
                    type="button"
                    onClick={() => setManualStatusChoice('UNMARKED')}
                    className={`py-2 px-3 rounded-xl font-bold text-xs transition border cursor-pointer ${
                      manualStatusChoice === 'UNMARKED'
                        ? 'bg-[#0F172A] text-white border-[#0F172A] shadow-xs'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    Set Unmarked
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Reason / Teacher Note (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Card forgotten at home / manual permission"
                  value={manualReasonText}
                  onChange={(e) => setManualReasonText(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-[#0D9488] hover:bg-[#0F766E] rounded-xl cursor-pointer"
                >
                  Save Override
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
