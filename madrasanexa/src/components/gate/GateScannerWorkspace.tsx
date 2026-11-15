import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  LogIn,
  LogOut,
  Camera,
  Keyboard,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Volume2,
  VolumeX,
  RotateCcw,
  CheckCheck,
  Info,
  GraduationCap,
  Home,
  Loader2,
  ScanLine,
} from 'lucide-react';
import {
  apiScanGateCard,
  generateUUID,
  type GateEventType,
  type GateScanResult,
  type GateEmailStatus,
} from '../../services/gate.service';
import { CameraScannerView } from '../attendance/CameraScannerView';
import { UsbScannerInput } from '../attendance/UsbScannerInput';
import { playScannerFeedback } from '../attendance/scanner-utils';

interface GateScannerWorkspaceProps {
  onScanSuccess?: (result: GateScanResult) => void;
}

export const GateScannerWorkspace: React.FC<GateScannerWorkspaceProps> = ({
  onScanSuccess,
}) => {
  // Movement Direction: ENTRY vs EXIT
  const [eventType, setEventType] = useState<GateEventType>('ENTRY');

  // Input Device: USB scanner vs Camera scanner
  const [inputMode, setInputMode] = useState<'usb' | 'camera'>('usb');

  // Audio feedback setting
  const [isMuted, setIsMuted] = useState(false);

  // Live Digital Clock
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
      setCurrentDate(
        now.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Scan Processing State
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<GateScanResult | null>(null);
  const [lastError, setLastError] = useState<{
    code?: number;
    title: string;
    message: string;
    isCategoryUnset?: boolean;
    isDebounce?: boolean;
    retryPayload?: { token: string; idempotencyKey: string };
  } | null>(null);

  // Operator session recent scans strip (last 10 items)
  const [sessionScans, setSessionScans] = useState<
    Array<{
      id: string;
      fullName: string;
      admissionNo: string;
      eventType: GateEventType;
      time: string;
      emailStatus: GateEmailStatus;
    }>
  >([]);

  // Stored idempotency key for in-flight/retry consistency
  const activeIdempotencyKeyRef = useRef<string>(generateUUID());

  /**
   * Core Scan Submission Handler
   */
  const handleProcessScan = useCallback(
    async (rawToken: string, preservedIdempotencyKey?: string) => {
      const token = (rawToken || '').trim();
      if (!token || isProcessing) return;

      const idempotencyKey = preservedIdempotencyKey || activeIdempotencyKeyRef.current;

      setIsProcessing(true);
      setLastError(null);

      try {
        const response = await apiScanGateCard({
          token,
          eventType,
          idempotencyKey,
        });

        if (response.success && response.data) {
          const result = response.data;
          setLastResult(result);

          // Audio feedback
          playScannerFeedback('success', isMuted);

          // Record in operator session history
          const nowStr = new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });

          setSessionScans((prev) => [
            {
              id: result.event.id || `${Date.now()}`,
              fullName: result.student.fullName,
              admissionNo: result.student.admissionNo,
              eventType: result.event.eventType,
              time: nowStr,
              emailStatus: result.event.emailStatus,
            },
            ...prev.slice(0, 9),
          ]);

          // Refresh idempotency key for NEXT scan
          activeIdempotencyKeyRef.current = generateUUID();

          if (onScanSuccess) {
            onScanSuccess(result);
          }
        }
      } catch (err: any) {
        const status = err.response?.status;
        const serverMessage =
          err.response?.data?.message || err.message || 'An unknown network error occurred.';

        let title = 'Scan Rejected';
        let isCategoryUnset = false;
        let isDebounce = false;

        if (status === 422) {
          title = 'Student Category Not Configured';
          isCategoryUnset = true;
          playScannerFeedback('warning', isMuted);
        } else if (status === 429) {
          title = 'Scan Debounced';
          isDebounce = true;
          playScannerFeedback('warning', isMuted);
        } else if (status === 404) {
          title = 'Unrecognized Scan Token';
          playScannerFeedback('error', isMuted);
        } else if (status === 403) {
          title = 'Access Forbidden';
          playScannerFeedback('error', isMuted);
        } else if (status === 409) {
          title = 'Idempotency Conflict';
          playScannerFeedback('error', isMuted);
        } else if (status === 400) {
          title = 'Invalid Token Format';
          playScannerFeedback('error', isMuted);
        } else {
          title = 'Connection / Server Error';
          playScannerFeedback('error', isMuted);
        }

        setLastError({
          code: status,
          title,
          message: serverMessage,
          isCategoryUnset,
          isDebounce,
          retryPayload: { token, idempotencyKey },
        });

        // Do not update lastResult with success on error
        setLastResult(null);
      } finally {
        setIsProcessing(false);
      }
    },
    [eventType, isMuted, isProcessing, onScanSuccess]
  );

  return (
    <div className="space-y-6">
      {/* ============================================================== */}
      {/* 1. SCANNER HEADER & LIVE METRICS BAR */}
      {/* ============================================================== */}
      <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mr-1.5"></span>
                LIVE GATE WORKSPACE
              </span>
              <span className="text-xs text-stone-500 font-medium">{currentDate}</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
              Smart Gate Scanner
            </h2>
            <p className="text-sm text-stone-500 mt-0.5">
              Automated student movement logging, instant attendance reconciliation & parent email alerts.
            </p>
          </div>

          {/* Right Status Panel */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Live Clock Display */}
            <div className="bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2 text-right">
              <div className="text-xs text-stone-400 font-medium">STATION TIME</div>
              <div className="text-lg font-mono font-bold text-slate-800 tracking-wider">
                {currentTime || '--:--:--'}
              </div>
            </div>

            {/* Audio Feedback Toggle */}
            <button
              onClick={() => setIsMuted(!isMuted)}
              title={isMuted ? 'Unmute Audio Beeps' : 'Mute Audio Beeps'}
              className={`p-2.5 rounded-xl border transition-colors ${
                isMuted
                  ? 'bg-stone-100 border-stone-200 text-stone-400 hover:text-stone-600'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. DIRECTION CONTROLS & SCANNER WORKSPACE */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Controls & Input Engine (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* DIRECTION SELECTOR (ENTRY vs EXIT) */}
          <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-sm">
            <label className="text-xs font-bold uppercase tracking-wider text-stone-500 block mb-3">
              1. Select Movement Direction
            </label>
            <div className="grid grid-cols-2 gap-3">
              {/* ENTRY BUTTON */}
              <button
                type="button"
                onClick={() => setEventType('ENTRY')}
                className={`relative flex items-center justify-center gap-3 p-4 rounded-xl border-2 font-semibold transition-all ${
                  eventType === 'ENTRY'
                    ? 'border-emerald-600 bg-emerald-50/70 text-emerald-900 shadow-sm'
                    : 'border-stone-200 bg-stone-50/50 text-stone-600 hover:bg-stone-100/70'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                    eventType === 'ENTRY' ? 'bg-emerald-600 text-white' : 'bg-stone-200 text-stone-600'
                  }`}
                >
                  <LogIn className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <div className="text-base font-bold">ENTRY (Check In)</div>
                  <div className="text-xs opacity-75">Auto-Attendance Eligible</div>
                </div>
                {eventType === 'ENTRY' && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-600 animate-ping"></span>
                )}
              </button>

              {/* EXIT BUTTON */}
              <button
                type="button"
                onClick={() => setEventType('EXIT')}
                className={`relative flex items-center justify-center gap-3 p-4 rounded-xl border-2 font-semibold transition-all ${
                  eventType === 'EXIT'
                    ? 'border-blue-600 bg-blue-50/70 text-blue-900 shadow-sm'
                    : 'border-stone-200 bg-stone-50/50 text-stone-600 hover:bg-stone-100/70'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                    eventType === 'EXIT' ? 'bg-blue-600 text-white' : 'bg-stone-200 text-stone-600'
                  }`}
                >
                  <LogOut className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <div className="text-base font-bold">EXIT (Check Out)</div>
                  <div className="text-xs opacity-75">Movement Fact Only</div>
                </div>
                {eventType === 'EXIT' && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-600 animate-ping"></span>
                )}
              </button>
            </div>
          </div>

          {/* INPUT ENGINE (USB vs CAMERA) */}
          <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <label className="text-xs font-bold uppercase tracking-wider text-stone-500">
                2. Card Scanner Input Method
              </label>
              {/* Input Mode Selector */}
              <div className="inline-flex rounded-lg border border-stone-200 bg-stone-100/80 p-0.5">
                <button
                  type="button"
                  onClick={() => setInputMode('usb')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    inputMode === 'usb'
                      ? 'bg-white text-slate-800 shadow-xs'
                      : 'text-stone-600 hover:text-slate-900'
                  }`}
                >
                  <Keyboard className="w-3.5 h-3.5" />
                  USB Scanner
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode('camera')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    inputMode === 'camera'
                      ? 'bg-white text-slate-800 shadow-xs'
                      : 'text-stone-600 hover:text-slate-900'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  Device Camera
                </button>
              </div>
            </div>

            {/* USB Scanner Input Engine */}
            {inputMode === 'usb' ? (
              <div className="space-y-3">
                <UsbScannerInput
                  onScan={(payload) => handleProcessScan(payload)}
                  disabled={isProcessing}
                  autoFocus={true}
                />
                <div className="flex items-start gap-2 bg-stone-50 rounded-xl p-3 border border-stone-200/80 text-xs text-stone-500">
                  <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.2" />
                  <span>
                    <strong>Handheld Barcode/QR Scanner:</strong> Ensure the input field above has focus.
                    Barcode readers send automated keystrokes terminated with Enter.
                  </span>
                </div>
              </div>
            ) : (
              /* Camera QR Scanner Engine */
              <div className="space-y-3">
                <CameraScannerView
                  onScan={(payload) => handleProcessScan(payload)}
                  disabled={isProcessing}
                />
              </div>
            )}

            {/* In-Flight Processing Spinner */}
            {isProcessing && (
              <div className="mt-4 p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center gap-3 text-emerald-800 text-sm font-semibold animate-pulse">
                <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
                Verifying token and recording {eventType.toLowerCase()} event...
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Scan Result & Status Display (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* SUCCESS RESULT CARD */}
          {lastResult && (
            <div className="bg-white rounded-2xl border-2 border-emerald-500/80 p-5 shadow-md overflow-hidden relative">
              <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span className="text-sm font-bold text-emerald-800 uppercase tracking-wide">
                    {lastResult.idempotentReplay ? 'Idempotent Replay' : 'Gate Scan Verified'}
                  </span>
                </div>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    lastResult.event.eventType === 'ENTRY'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {lastResult.event.eventType === 'ENTRY' ? 'GATE ENTRY' : 'GATE EXIT'}
                </span>
              </div>

              {/* Student Identity Information */}
              <div className="pt-4 flex items-start gap-4">
                <div className="w-14 h-14 rounded-xl bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-600 font-bold text-lg shrink-0">
                  {lastResult.student.fullName
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-bold text-slate-900 truncate">
                    {lastResult.student.fullName}
                  </h3>
                  <div className="text-xs text-stone-500 font-mono mt-0.5">
                    ADMISSION: {lastResult.student.admissionNo}
                  </div>
                  {lastResult.student.class && (
                    <div className="text-xs font-medium text-stone-600 mt-1">
                      Class: {lastResult.student.class.name}
                    </div>
                  )}

                  {/* Student Category Badge */}
                  <div className="mt-2">
                    {lastResult.student.category === 'DAY_SCHOLAR' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                        <GraduationCap className="w-3.5 h-3.5" />
                        Day Scholar
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-cyan-50 text-cyan-800 border border-cyan-200">
                        <Home className="w-3.5 h-3.5" />
                        Boarding Student
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Attendance & Email Status Panels */}
              <div className="mt-5 space-y-2.5 pt-4 border-t border-stone-100">
                {/* Attendance Result */}
                <div className="flex items-center justify-between text-xs bg-stone-50 p-2.5 rounded-xl border border-stone-200/80">
                  <span className="text-stone-500 font-medium">Daily Attendance:</span>
                  {lastResult.attendance?.reconciled ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Marked PRESENT ({lastResult.attendance.date})
                    </span>
                  ) : (
                    <span className="text-stone-500 italic">
                      {lastResult.event.eventType === 'EXIT'
                        ? 'Exempt (Exit movement)'
                        : 'Reconciliation disabled'}
                    </span>
                  )}
                </div>

                {/* Email Outbox Status */}
                <div className="flex items-center justify-between text-xs bg-stone-50 p-2.5 rounded-xl border border-stone-200/80">
                  <span className="text-stone-500 font-medium">Parent Email Outbox:</span>
                  <div className="text-right">
                    {lastResult.event.emailStatus === 'QUEUED' && (
                      <span className="inline-flex items-center gap-1 text-amber-700 font-semibold">
                        <Clock className="w-3.5 h-3.5" /> Queued for dispatch
                      </span>
                    )}
                    {lastResult.event.emailStatus === 'SENT' && (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                        <CheckCheck className="w-3.5 h-3.5" /> Email Dispatched
                      </span>
                    )}
                    {lastResult.event.emailStatus === 'NOT_APPLICABLE' && (
                      <span className="inline-flex items-center gap-1 text-stone-500">
                        <Info className="w-3.5 h-3.5" />
                        {lastResult.event.emailSkipReason === 'BOARDING_STUDENT_EXEMPT'
                          ? 'Boarding Exempt'
                          : 'Tenant Disabled'}
                      </span>
                    )}
                    {lastResult.event.emailStatus === 'SKIPPED_NO_RECIPIENT' && (
                      <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                        <AlertTriangle className="w-3.5 h-3.5" /> No Guardian Email
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ERROR / REJECTION STATE CARD */}
          {lastError && (
            <div
              className={`rounded-2xl border-2 p-5 shadow-sm ${
                lastError.isCategoryUnset
                  ? 'bg-amber-50/60 border-amber-500 text-amber-950'
                  : lastError.isDebounce
                  ? 'bg-amber-50/40 border-amber-400 text-amber-900'
                  : 'bg-rose-50/60 border-rose-500 text-rose-950'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {lastError.isCategoryUnset ? (
                    <AlertTriangle className="w-6 h-6 text-amber-600" />
                  ) : lastError.isDebounce ? (
                    <Clock className="w-6 h-6 text-amber-600" />
                  ) : (
                    <XCircle className="w-6 h-6 text-rose-600" />
                  )}
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-base">{lastError.title}</h4>
                  <p className="text-xs leading-relaxed mt-1 opacity-90">{lastError.message}</p>

                  {/* Fail-closed guidance for UNSET category */}
                  {lastError.isCategoryUnset && (
                    <div className="mt-3 p-3 bg-white/80 rounded-xl border border-amber-300 text-xs font-medium text-amber-900">
                      <strong>Access Denied (Gate Locked):</strong> Please assign DAY_SCHOLAR or BOARDING
                      category in the Students Directory before Smart Gate Scanner can admit this student.
                    </div>
                  )}

                  {/* Debounce guidance */}
                  {lastError.isDebounce && (
                    <div className="mt-2 text-xs font-medium text-amber-800">
                      Debounce Invariant: Please wait 60 seconds before scanning the same student in the same
                      direction.
                    </div>
                  )}

                  {/* Retry Action */}
                  {lastError.retryPayload && !lastError.isCategoryUnset && !lastError.isDebounce && (
                    <button
                      type="button"
                      onClick={() =>
                        handleProcessScan(
                          lastError.retryPayload!.token,
                          lastError.retryPayload!.idempotencyKey
                        )
                      }
                      className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Retry Scan Operation
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STANDBY EMPTY STATE (when neither success nor error is active) */}
          {!lastResult && !lastError && (
            <div className="bg-stone-50 rounded-2xl border border-dashed border-stone-200 p-8 text-center text-stone-400">
              <ScanLine className="w-10 h-10 mx-auto mb-2 text-stone-300" />
              <h4 className="text-sm font-semibold text-stone-600">Scanner Standby</h4>
              <p className="text-xs text-stone-400 mt-1 max-w-xs mx-auto">
                Present student ID card to the camera or handheld USB barcode scanner to record{' '}
                <span className="font-bold uppercase text-stone-600">{eventType}</span> movement.
              </p>
            </div>
          )}

          {/* RECENT SCANS STRIP (CURRENT OPERATOR SESSION) */}
          <div className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                Recent Scans (This Session)
              </h4>
              <span className="text-xs text-stone-400">{sessionScans.length} logged</span>
            </div>

            {sessionScans.length === 0 ? (
              <div className="text-center py-4 text-xs text-stone-400 italic">
                No scans recorded in current browser session.
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {sessionScans.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-2 rounded-xl bg-stone-50 border border-stone-100 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          s.eventType === 'ENTRY' ? 'bg-emerald-500' : 'bg-blue-500'
                        }`}
                      />
                      <span className="font-medium text-slate-800 truncate">{s.fullName}</span>
                      <span className="text-stone-400 font-mono">({s.admissionNo})</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-stone-400">{s.time}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          s.eventType === 'ENTRY'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {s.eventType}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
