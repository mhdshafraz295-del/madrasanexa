import React, { useState, useRef, useCallback } from 'react';
import {
  ScanLine,
  Camera,
  AlertTriangle,
  AlertCircle,
  Volume2,
  VolumeX,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Calendar,
  Layers,
  History,
  Check,
  X,
} from 'lucide-react';
import {
  apiVerifyScanToken,
  apiIngestScannedAttendance,
  apiVerifyAdmissionBarcode,
  type ScanVerificationResult,
  type ScanIngestionResult,
  type BarcodeAdmissionVerificationResult,
} from '../../services/attendance.service';
import { UsbScannerInput } from './UsbScannerInput';
import { CameraScannerView } from './CameraScannerView';
import {
  classifyScanInput,
  ScanDebouncer,
  playScannerFeedback,
  type ClassifiedScan,
} from './scanner-utils';

export interface AttendanceScannerTabProps {
  classes: Array<{ id: string; name: string; code?: string | null }>;
  selectedClassId: string;
  onSelectClassId: (id: string) => void;
  selectedAcademicYear: string;
  selectedDate: string;
  dailyStudents?: unknown[];
  onUpdateDailyStudentStatus: (studentId: string, status: 'PRESENT' | 'ABSENT') => void;
  onRefreshDailyRoster?: () => void;
}

export interface ScanEventLogItem {
  id: string;
  timestamp: string;
  studentId: string;
  admissionNo: string;
  fullName: string;
  method: 'QR_TOKEN' | 'ADMISSION_BARCODE';
  securityTier: 'TIER_1_SECURE_QR' | 'TIER_2_FALLBACK_1D';
  status: 'PRESENT' | 'ABSENT' | 'DUPLICATE' | 'ERROR';
  message: string;
  tokenHint?: string;
}

export const AttendanceScannerTab: React.FC<AttendanceScannerTabProps> = ({
  classes,
  selectedClassId,
  onSelectClassId,
  selectedAcademicYear,
  selectedDate,
  dailyStudents: _dailyStudents,
  onUpdateDailyStudentStatus,
  onRefreshDailyRoster: _onRefreshDailyRoster,
}) => {
  // Input mode: 'usb' or 'camera'
  const [inputMode, setInputMode] = useState<'usb' | 'camera'>('usb');

  // Scanner settings
  const [autoIngest, setAutoIngest] = useState(true);
  const [audioFeedback, setAudioFeedback] = useState(true);

  // Verification & Ingestion state
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentVerification, setCurrentVerification] = useState<{
    classification: ClassifiedScan;
    verificationResult?: ScanVerificationResult;
    barcodeResult?: BarcodeAdmissionVerificationResult;
    ingestionResult?: ScanIngestionResult;
    error?: string;
  } | null>(null);

  // Scan Event Log (ephemeral in-memory history for active session)
  const [scanLogs, setScanLogs] = useState<ScanEventLogItem[]>([]);

  // Overwrite modal / form state for duplicates
  const [showOverwriteDialog, setShowOverwriteDialog] = useState(false);
  const [overwriteReason, setOverwriteReason] = useState('');
  const [overwriteTarget, setOverwriteTarget] = useState<{
    token?: string;
    admissionNo?: string;
    studentName: string;
    studentId: string;
    isQr: boolean;
  } | null>(null);

  // In-memory debouncer ref (3000ms window)
  const debouncerRef = useRef(new ScanDebouncer(3000));

  // Current selected class name
  const currentClassName = classes.find((c) => c.id === selectedClassId)?.name || 'Selected Class';

  // Master Scan Handler (Unified entry point for USB scanner, Camera, and manual entry)
  const handleScanPayload = useCallback(
    async (rawPayload: string, _sourceMetadata?: { isScanner?: boolean; averageIntervalMs?: number } | 'camera') => {
      const trimmed = (rawPayload || '').trim();
      if (!trimmed || isProcessing) return;

      // 1. Check duplicate suppression window
      if (debouncerRef.current.isDuplicate(trimmed)) {
        playScannerFeedback('duplicate', !audioFeedback);
        return;
      }

      const classification = classifyScanInput(trimmed);

      if (classification.type === 'UNKNOWN') {
        playScannerFeedback('error', !audioFeedback);
        setCurrentVerification({
          classification,
          error: `Unrecognized scan format. Value "${trimmed.substring(0, 20)}..." does not match canonical QR token (MNX1_) or valid admission number.`,
        });
        return;
      }

      setIsProcessing(true);
      setCurrentVerification(null);

      try {
        if (classification.type === 'QR_TOKEN') {
          // ==========================================
          // 2D Cryptographic QR Code Verification
          // ==========================================
          const verifyRes = await apiVerifyScanToken({
            token: classification.cleaned,
            classId: selectedClassId || undefined,
            date: selectedDate || undefined,
            academicYear: selectedAcademicYear || undefined,
          });

          // Check if student is already marked on this date
          if (verifyRes.alreadyMarked) {
            playScannerFeedback('warning', !audioFeedback);

            setCurrentVerification({
              classification,
              verificationResult: verifyRes,
            });

            // Log duplicate scan
            const logItem: ScanEventLogItem = {
              id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              timestamp: new Date().toLocaleTimeString(),
              studentId: verifyRes.student.id,
              admissionNo: verifyRes.student.admissionNo,
              fullName: verifyRes.student.fullName,
              method: 'QR_TOKEN',
              securityTier: 'TIER_1_SECURE_QR',
              status: 'DUPLICATE',
              message: `Already marked ${verifyRes.existingStatus} for ${selectedDate}`,
              tokenHint: verifyRes.tokenHint,
            };
            setScanLogs((prev) => [logItem, ...prev.slice(0, 49)]);

            // Setup overwrite option
            setOverwriteTarget({
              token: classification.cleaned,
              studentName: verifyRes.student.fullName,
              studentId: verifyRes.student.id,
              isQr: true,
            });
            return;
          }

          // If autoIngest is enabled and student is not yet marked, record attendance directly
          if (autoIngest) {
            const ingestRes = await apiIngestScannedAttendance({
              token: classification.cleaned,
              classId: selectedClassId,
              date: selectedDate,
              academicYear: selectedAcademicYear,
              status: 'PRESENT',
            });

            playScannerFeedback('success', !audioFeedback);

            setCurrentVerification({
              classification,
              verificationResult: verifyRes,
              ingestionResult: ingestRes,
            });

            // Update local daily roster
            onUpdateDailyStudentStatus(verifyRes.student.id, 'PRESENT');

            // Log successful attendance ingestion
            const logItem: ScanEventLogItem = {
              id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              timestamp: new Date().toLocaleTimeString(),
              studentId: verifyRes.student.id,
              admissionNo: verifyRes.student.admissionNo,
              fullName: verifyRes.student.fullName,
              method: 'QR_TOKEN',
              securityTier: 'TIER_1_SECURE_QR',
              status: 'PRESENT',
              message: `Marked PRESENT via Cryptographic QR`,
              tokenHint: verifyRes.tokenHint,
            };
            setScanLogs((prev) => [logItem, ...prev.slice(0, 49)]);
          } else {
            // Manual confirmation mode
            playScannerFeedback('success', !audioFeedback);
            setCurrentVerification({
              classification,
              verificationResult: verifyRes,
            });
          }
        } else if (classification.type === 'ADMISSION_BARCODE') {
          // ==========================================
          // 1D Admission Barcode Fallback (Tier 2)
          // ==========================================
          const barcodeRes = await apiVerifyAdmissionBarcode({
            admissionNo: classification.cleaned,
            classId: selectedClassId || undefined,
            date: selectedDate || undefined,
            academicYear: selectedAcademicYear || undefined,
          });

          playScannerFeedback('warning', !audioFeedback);

          setCurrentVerification({
            classification,
            barcodeResult: barcodeRes,
          });

          // Update local daily roster if not duplicate
          if (!barcodeRes.alreadyMarked) {
            onUpdateDailyStudentStatus(barcodeRes.student.id, 'PRESENT');
          }

          const logItem: ScanEventLogItem = {
            id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            timestamp: new Date().toLocaleTimeString(),
            studentId: barcodeRes.student.id,
            admissionNo: barcodeRes.student.admissionNo,
            fullName: barcodeRes.student.fullName,
            method: 'ADMISSION_BARCODE',
            securityTier: 'TIER_2_FALLBACK_1D',
            status: barcodeRes.alreadyMarked ? 'DUPLICATE' : 'PRESENT',
            message: barcodeRes.alreadyMarked
              ? `1D Barcode verified (Already marked ${barcodeRes.existingStatus})`
              : `1D Barcode verified (Tier 2 Fallback - Not persisted to DB)`,
          };
          setScanLogs((prev) => [logItem, ...prev.slice(0, 49)]);
        }
      } catch (err: any) {
        console.error('Scan verification error:', err);
        playScannerFeedback('error', !audioFeedback);

        const errorMsg =
          err.response?.data?.message || err.message || 'Verification failed. Student token or barcode is invalid.';

        setCurrentVerification({
          classification,
          error: errorMsg,
        });

        const logItem: ScanEventLogItem = {
          id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          timestamp: new Date().toLocaleTimeString(),
          studentId: '',
          admissionNo: classification.cleaned,
          fullName: 'Verification Failed',
          method: classification.type === 'QR_TOKEN' ? 'QR_TOKEN' : 'ADMISSION_BARCODE',
          securityTier: classification.securityTier as any,
          status: 'ERROR',
          message: errorMsg,
        };
        setScanLogs((prev) => [logItem, ...prev.slice(0, 49)]);
      } finally {
        setIsProcessing(false);
      }
    },
    [
      isProcessing,
      audioFeedback,
      selectedClassId,
      selectedDate,
      selectedAcademicYear,
      autoIngest,
      onUpdateDailyStudentStatus,
    ]
  );

  // Manual Attendance Ingest Action (Used when autoIngest is turned off)
  const handleConfirmIngest = async (status: 'PRESENT' | 'ABSENT') => {
    if (!currentVerification?.verificationResult) return;
    const token = currentVerification.classification.cleaned;

    try {
      setIsProcessing(true);
      const ingestRes = await apiIngestScannedAttendance({
        token,
        classId: selectedClassId,
        date: selectedDate,
        academicYear: selectedAcademicYear,
        status,
      });

      playScannerFeedback('success', !audioFeedback);

      setCurrentVerification((prev) => (prev ? { ...prev, ingestionResult: ingestRes } : null));
      onUpdateDailyStudentStatus(currentVerification.verificationResult.student.id, status);

      const logItem: ScanEventLogItem = {
        id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        timestamp: new Date().toLocaleTimeString(),
        studentId: currentVerification.verificationResult.student.id,
        admissionNo: currentVerification.verificationResult.student.admissionNo,
        fullName: currentVerification.verificationResult.student.fullName,
        method: 'QR_TOKEN',
        securityTier: 'TIER_1_SECURE_QR',
        status,
        message: `Manually confirmed as ${status}`,
        tokenHint: currentVerification.verificationResult.tokenHint,
      };
      setScanLogs((prev) => [logItem, ...prev.slice(0, 49)]);
    } catch (err: any) {
      playScannerFeedback('error', !audioFeedback);
      alert(err.response?.data?.message || 'Failed to record attendance.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Overwrite Attendance Submission
  const handleOverwriteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overwriteTarget || !overwriteReason.trim() || overwriteReason.trim().length < 3) {
      alert('A reason of at least 3 characters is mandatory for overwriting attendance.');
      return;
    }

    try {
      setIsProcessing(true);
      if (overwriteTarget.isQr && overwriteTarget.token) {
        await apiIngestScannedAttendance({
          token: overwriteTarget.token,
          classId: selectedClassId,
          date: selectedDate,
          academicYear: selectedAcademicYear,
          status: 'PRESENT',
          overwrite: true,
          reason: overwriteReason.trim(),
        });

        playScannerFeedback('success', !audioFeedback);
        onUpdateDailyStudentStatus(overwriteTarget.studentId, 'PRESENT');

        const logItem: ScanEventLogItem = {
          id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          timestamp: new Date().toLocaleTimeString(),
          studentId: overwriteTarget.studentId,
          admissionNo: overwriteTarget.admissionNo || '',
          fullName: overwriteTarget.studentName,
          method: 'QR_TOKEN',
          securityTier: 'TIER_1_SECURE_QR',
          status: 'PRESENT',
          message: `Overwritten to PRESENT (Reason: ${overwriteReason.trim()})`,
        };
        setScanLogs((prev) => [logItem, ...prev.slice(0, 49)]);
      }

      setShowOverwriteDialog(false);
      setOverwriteReason('');
      setOverwriteTarget(null);
    } catch (err: any) {
      playScannerFeedback('error', !audioFeedback);
      alert(err.response?.data?.message || 'Failed to overwrite attendance.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Control Banner: Class Context, Input Mode & Toggles */}
      <div className="bg-stone-50 border border-stone-200/80 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Class and Date Context */}
        <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm">
          <div className="flex items-center gap-2">
            <span className="text-stone-500 font-medium">Class:</span>
            <select
              value={selectedClassId}
              onChange={(e) => onSelectClassId(e.target.value)}
              className="bg-white border border-stone-300 rounded-lg px-2.5 py-1.5 text-stone-800 font-semibold shadow-2xs outline-none cursor-pointer"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-stone-600 bg-white border border-stone-200 px-2.5 py-1.5 rounded-lg shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-emerald-600" />
            <span className="font-semibold">{selectedDate}</span>
          </div>

          <div className="flex items-center gap-1.5 text-stone-600 bg-white border border-stone-200 px-2.5 py-1.5 rounded-lg shadow-2xs">
            <Layers className="w-3.5 h-3.5 text-stone-500" />
            <span>{selectedAcademicYear}</span>
          </div>
        </div>

        {/* Input Mode Selector & Audio Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Input Mode Tabs */}
          <div className="flex bg-stone-200/80 p-0.5 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setInputMode('usb')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                inputMode === 'usb'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <ScanLine className="w-3.5 h-3.5" />
              USB Scanner
            </button>

            <button
              type="button"
              onClick={() => setInputMode('camera')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                inputMode === 'camera'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              Live Camera
            </button>
          </div>

          {/* Auto-Ingest Toggle */}
          <button
            type="button"
            onClick={() => setAutoIngest(!autoIngest)}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
              autoIngest
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
            }`}
            title="Automatically mark student present upon valid cryptographic QR scan"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Auto-Mark: {autoIngest ? 'ON' : 'OFF'}</span>
          </button>

          {/* Audio Feedback Toggle */}
          <button
            type="button"
            onClick={() => setAudioFeedback(!audioFeedback)}
            className={`p-1.5 rounded-xl border transition-colors cursor-pointer ${
              audioFeedback
                ? 'bg-stone-100 border-stone-300 text-stone-700'
                : 'bg-stone-50 border-stone-200 text-stone-400'
            }`}
            title={audioFeedback ? 'Sound Enabled' : 'Sound Muted'}
          >
            {audioFeedback ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Primary Scanner Input Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Scanner Hardware/Camera Viewport (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {inputMode === 'usb' ? (
            <UsbScannerInput onScan={handleScanPayload} disabled={isProcessing} autoFocus />
          ) : (
            <CameraScannerView onScan={(payload) => handleScanPayload(payload, 'camera')} disabled={isProcessing} />
          )}

          {/* Active Verification Status Card */}
          {currentVerification && (
            <div
              className={`rounded-2xl border p-5 shadow-sm transition-all animate-in fade-in duration-200 ${
                currentVerification.error
                  ? 'bg-rose-50/70 border-rose-200 text-rose-900'
                  : currentVerification.verificationResult?.alreadyMarked || currentVerification.barcodeResult?.alreadyMarked
                  ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                  : currentVerification.classification.isCryptographic
                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                  : 'bg-amber-50/70 border-amber-200 text-amber-950'
              }`}
            >
              {/* Error State */}
              {currentVerification.error ? (
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-rose-900">Scan Rejected</h3>
                    <p className="text-xs text-rose-700 leading-relaxed">{currentVerification.error}</p>
                  </div>
                </div>
              ) : currentVerification.verificationResult ? (
                /* QR Code Verification Card */
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-emerald-200/60 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Tier 1: Secure QR
                      </span>
                      <span className="font-mono text-xs text-stone-500">
                        {currentVerification.verificationResult.tokenHint}
                      </span>
                    </div>

                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                        currentVerification.ingestionResult?.status === 'PRESENT'
                          ? 'bg-emerald-600 text-white'
                          : currentVerification.verificationResult.alreadyMarked
                          ? 'bg-amber-200 text-amber-900'
                          : 'bg-stone-200 text-stone-800'
                      }`}
                    >
                      {currentVerification.ingestionResult?.status === 'PRESENT'
                        ? 'RECORDED PRESENT'
                        : currentVerification.verificationResult.alreadyMarked
                        ? `ALREADY ${currentVerification.verificationResult.existingStatus}`
                        : 'VERIFIED'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-stone-500 block text-[11px]">Student Name</span>
                      <span className="font-bold text-sm text-stone-900">
                        {currentVerification.verificationResult.student.fullName}
                      </span>
                    </div>

                    <div>
                      <span className="text-stone-500 block text-[11px]">Admission No</span>
                      <span className="font-mono font-semibold text-stone-800">
                        {currentVerification.verificationResult.student.admissionNo}
                      </span>
                    </div>

                    <div>
                      <span className="text-stone-500 block text-[11px]">Class</span>
                      <span className="font-medium text-stone-800">
                        {currentVerification.verificationResult.student.className || currentClassName}
                      </span>
                    </div>

                    <div>
                      <span className="text-stone-500 block text-[11px]">Scanned At</span>
                      <span className="font-mono text-stone-600">
                        {new Date(currentVerification.verificationResult.scannedAt).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>

                  {/* Duplicate Overwrite Button */}
                  {currentVerification.verificationResult.alreadyMarked && (
                    <div className="pt-2 flex items-center justify-between border-t border-amber-200/60">
                      <span className="text-xs text-amber-800">
                        Student is already recorded as {currentVerification.verificationResult.existingStatus}.
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowOverwriteDialog(true)}
                        className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                      >
                        Overwrite Attendance
                      </button>
                    </div>
                  )}

                  {/* Manual Confirmation Buttons (When Auto-Ingest is OFF) */}
                  {!autoIngest && !currentVerification.ingestionResult && !currentVerification.verificationResult.alreadyMarked && (
                    <div className="pt-2 flex items-center gap-2 border-t border-emerald-200/60">
                      <button
                        type="button"
                        onClick={() => handleConfirmIngest('PRESENT')}
                        disabled={isProcessing}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Confirm Present
                      </button>

                      <button
                        type="button"
                        onClick={() => handleConfirmIngest('ABSENT')}
                        disabled={isProcessing}
                        className="px-3.5 py-1.5 rounded-lg bg-stone-200 hover:bg-stone-300 text-stone-700 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        Mark Absent
                      </button>
                    </div>
                  )}
                </div>
              ) : currentVerification.barcodeResult ? (
                /* 1D Barcode Fallback Card */
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-amber-200/60 pb-2">
                    <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 text-[11px] font-bold flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-700" />
                      Tier 2 Fallback: 1D Admission Barcode
                    </span>
                    <span className="text-xs font-semibold text-amber-800">
                      {currentVerification.barcodeResult.alreadyMarked ? 'ALREADY MARKED' : 'VERIFIED (1D)'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-stone-500 block text-[11px]">Student Name</span>
                      <span className="font-bold text-sm text-stone-900">
                        {currentVerification.barcodeResult.student.fullName}
                      </span>
                    </div>

                    <div>
                      <span className="text-stone-500 block text-[11px]">Admission No</span>
                      <span className="font-mono font-semibold text-stone-800">
                        {currentVerification.barcodeResult.student.admissionNo}
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] text-amber-800 bg-amber-100/60 p-2.5 rounded-lg leading-relaxed">
                    Notice: 1D admission barcodes are low-security identifiers and do not write attendance records directly to the database. The student has been marked PRESENT in your current daily session roster. Please save the daily attendance sheet to persist.
                  </p>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Right Column: Live Session Scan Event Feed (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-stone-200/90 shadow-sm p-4 sm:p-5 flex flex-col h-full max-h-[580px]">
          <div className="flex items-center justify-between mb-3 border-b border-stone-100 pb-2">
            <h3 className="text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-emerald-600" />
              Session Scan History ({scanLogs.length})
            </h3>

            {scanLogs.length > 0 && (
              <button
                type="button"
                onClick={() => setScanLogs([])}
                className="text-[11px] text-stone-400 hover:text-stone-600 cursor-pointer"
              >
                Clear Log
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {scanLogs.length === 0 ? (
              <div className="h-44 flex flex-col items-center justify-center text-center text-stone-400 space-y-1">
                <ScanLine className="w-8 h-8 text-stone-300 stroke-[1.5]" />
                <p className="text-xs font-medium">No scans in this session yet</p>
                <p className="text-[11px] text-stone-400">Scanned student attendance events will appear here in real time</p>
              </div>
            ) : (
              scanLogs.map((log) => (
                <div
                  key={log.id}
                  className={`p-2.5 rounded-xl border text-xs transition-all ${
                    log.status === 'PRESENT'
                      ? 'bg-emerald-50/50 border-emerald-100'
                      : log.status === 'DUPLICATE'
                      ? 'bg-amber-50/50 border-amber-100'
                      : 'bg-rose-50/50 border-rose-100'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-semibold text-stone-900 truncate">
                      {log.fullName}
                    </span>
                    <span className="font-mono text-[10px] text-stone-400 shrink-0">
                      {log.timestamp}
                    </span>
                  </div>

                  <div className="mt-1 flex items-center justify-between text-[11px] text-stone-500">
                    <span className="font-mono">{log.admissionNo}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded font-medium text-[10px] ${
                        log.method === 'QR_TOKEN'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {log.method === 'QR_TOKEN' ? '2D QR' : '1D Barcode'}
                    </span>
                  </div>

                  <p className="mt-0.5 text-[10px] text-stone-500 truncate">{log.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Mandatory Reason Overwrite Modal */}
      {showOverwriteDialog && overwriteTarget && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              Confirm Attendance Overwrite
            </h3>

            <p className="text-xs text-stone-600 mt-2 leading-relaxed">
              Student <span className="font-bold text-stone-800">{overwriteTarget.studentName}</span> is already marked for this date.
              In accordance with MadrasaNexa audit policy, a mandatory operator reason is required to overwrite an existing attendance record.
            </p>

            <form onSubmit={handleOverwriteSubmit} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Reason for Overwrite (min. 3 characters) *
                </label>
                <textarea
                  required
                  rows={3}
                  value={overwriteReason}
                  onChange={(e) => setOverwriteReason(e.target.value)}
                  placeholder="e.g. Student arrived late with excusal slip, corrected accidental absent mark..."
                  className="w-full p-2.5 text-xs rounded-xl border border-stone-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowOverwriteDialog(false);
                    setOverwriteReason('');
                  }}
                  className="px-3.5 py-1.5 rounded-lg border border-stone-300 text-stone-700 text-xs font-medium hover:bg-stone-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isProcessing || overwriteReason.trim().length < 3}
                  className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:bg-stone-200 text-white disabled:text-stone-400 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  Confirm Overwrite
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
