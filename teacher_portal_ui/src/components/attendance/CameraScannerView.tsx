import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  CameraOff,
  AlertCircle,
  ShieldCheck,
  Video,
} from 'lucide-react';

interface CameraScannerViewProps {
  onScan: (payload: string, source: 'camera') => void;
  disabled?: boolean;
}

// Global declaration for native BarcodeDetector API supported in Chromium browsers
declare global {
  interface Window {
    BarcodeDetector?: {
      new (options?: { formats: string[] }): {
        detect(image: ImageBitmapSource): Promise<Array<{ rawValue: string; format: string }>>;
      };
      getSupportedFormats(): Promise<string[]>;
    };
  }
}

export const CameraScannerView: React.FC<CameraScannerViewProps> = ({
  onScan,
  disabled = false,
}) => {
  const [isActive, setIsActive] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState<boolean>(true);

  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const isDetectingRef = useRef(false);
  const isLockedRef = useRef(false);
  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check BarcodeDetector support on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hasBarcodeDetector = 'BarcodeDetector' in window;
      setIsSupported(hasBarcodeDetector);
    }
  }, []);

  // Stop camera tracks cleanly
  const stopCamera = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    if (cooldownTimerRef.current) {
      clearTimeout(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }
    isLockedRef.current = false;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (_) {}
      });
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    isDetectingRef.current = false;
    setIsActive(false);
    setIsStarting(false);
  }, []);

  // Stop stream when component unmounts
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Enumerate video devices
  const updateDeviceList = async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = allDevices.filter((d) => d.kind === 'videoinput');
      setDevices(videoInputs);
      if (videoInputs.length > 0 && !selectedDeviceId) {
        // Prefer back / environment camera if available
        const backCamera = videoInputs.find(
          (d) => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('environment')
        );
        setSelectedDeviceId(backCamera ? backCamera.deviceId : videoInputs[0].deviceId);
      }
    } catch (err) {
      console.warn('Failed to enumerate cameras:', err);
    }
  };

  // Start camera stream
  const startCamera = async () => {
    if (disabled) return;
    setErrorMessage(null);
    setIsStarting(true);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera access is not supported by your browser.');
      }

      const constraints: MediaStreamConstraints = {
        video: selectedDeviceId
          ? { deviceId: { exact: selectedDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsActive(true);
      await updateDeviceList();
      startDetectionLoop();
    } catch (err: any) {
      console.error('Camera access error:', err);
      stopCamera();

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage(
          'Camera permission denied. Please allow camera permissions in your browser address bar to use camera scanning.'
        );
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setErrorMessage('No camera device detected on this system.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setErrorMessage('Camera is currently in use by another application.');
      } else {
        setErrorMessage(err.message || 'Failed to start camera.');
      }
    } finally {
      setIsStarting(false);
    }
  };

  // Barcode / QR detection frame loop
  const startDetectionLoop = () => {
    if (typeof window === 'undefined' || !window.BarcodeDetector) {
      return;
    }

    let detector: any;
    try {
      detector = new window.BarcodeDetector({
        formats: ['qr_code', 'code_128', 'code_39', 'ean_13'],
      });
    } catch (err) {
      console.warn('Failed to initialize BarcodeDetector:', err);
      return;
    }

    let lastFrameTime = 0;
    const FRAME_INTERVAL_MS = 150; // Scan 6-7 times per second to optimize performance

    const scanFrame = async (timestamp: number) => {
      if (!streamRef.current || !videoRef.current || videoRef.current.readyState < 2) {
        animFrameRef.current = requestAnimationFrame(scanFrame);
        return;
      }

      if (disabledRef.current || isLockedRef.current) {
        animFrameRef.current = requestAnimationFrame(scanFrame);
        return;
      }

      if (timestamp - lastFrameTime >= FRAME_INTERVAL_MS && !isDetectingRef.current) {
        lastFrameTime = timestamp;
        isDetectingRef.current = true;

        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes && barcodes.length > 0) {
            const code = barcodes[0].rawValue;
            if (code && code.trim()) {
              isLockedRef.current = true;

              try {
                await Promise.resolve(onScanRef.current(code.trim(), 'camera'));
              } catch (scanErr) {
                console.warn('[CameraScannerView] Error executing onScan:', scanErr);
              } finally {
                if (cooldownTimerRef.current) {
                  clearTimeout(cooldownTimerRef.current);
                }
                cooldownTimerRef.current = setTimeout(() => {
                  isLockedRef.current = false;
                  cooldownTimerRef.current = null;
                }, 2200);
              }
            }
          }
        } catch (_detErr) {
          // Frame detection errors can occur during rapid focus shifts; ignore silently
        } finally {
          isDetectingRef.current = false;
        }
      }

      animFrameRef.current = requestAnimationFrame(scanFrame);
    };

    animFrameRef.current = requestAnimationFrame(scanFrame);
  };

  const handleDeviceChange = (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    if (isActive) {
      stopCamera();
      setTimeout(() => {
        startCamera();
      }, 100);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-3.5 sm:p-5 transition-all">
      {/* CSS Animation for Green Sweeping Laser */}
      <style>{`
        @keyframes scanSweep {
          0% { top: 12%; opacity: 0.85; }
          50% { top: 88%; opacity: 1; }
          100% { top: 12%; opacity: 0.85; }
        }
        .scanner-active-laser {
          position: absolute;
          left: 8px;
          right: 8px;
          height: 2px;
          background: linear-gradient(90deg, transparent, #10B981, #34D399, #10B981, transparent);
          box-shadow: 0 0 14px #10B981, 0 0 6px #10B981;
          animation: scanSweep 2.4s ease-in-out infinite;
          pointer-events: none;
          z-index: 25;
          border-radius: 9999px;
        }
        @media (prefers-reduced-motion: reduce) {
          .scanner-active-laser {
            animation: none !important;
            top: 50% !important;
            opacity: 0.75 !important;
          }
        }
      `}</style>

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-3 h-3 rounded-full shrink-0 transition-all ${
              isActive
                ? 'bg-emerald-500 ring-4 ring-emerald-100 animate-pulse'
                : isStarting
                ? 'bg-amber-400 animate-spin'
                : 'bg-slate-300'
            }`}
          />
          <div className="flex items-center gap-2 truncate">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 truncate">
              <Camera className="w-4 h-4 text-[#0D9488] shrink-0" />
              <span className="truncate">Device Camera QR / Barcode Scanner</span>
            </h3>
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${
                isActive
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                  : isStarting
                  ? 'bg-amber-50 text-amber-700 border border-amber-200/60'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              {isActive ? 'Camera Active' : isStarting ? 'Initializing...' : 'Camera Off'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto w-full sm:w-auto justify-between sm:justify-end">
          {devices.length > 1 && (
            <select
              value={selectedDeviceId}
              onChange={(e) => handleDeviceChange(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-2.5 py-1.5 outline-none font-medium cursor-pointer max-w-[160px] truncate"
            >
              {devices.map((device, idx) => (
                <option key={device.deviceId || idx} value={device.deviceId}>
                  {device.label || `Camera ${idx + 1}`}
                </option>
              ))}
            </select>
          )}

          {isActive ? (
            <button
              type="button"
              onClick={stopCamera}
              className="px-3.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            >
              <CameraOff className="w-3.5 h-3.5" />
              <span>Stop Camera</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={disabled || isStarting}
              onClick={startCamera}
              className="px-4 py-1.5 rounded-lg bg-[#0F172A] hover:bg-slate-800 disabled:bg-slate-200 text-white disabled:text-slate-400 text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer shrink-0 active:scale-95"
            >
              <Camera className="w-3.5 h-3.5 text-[#37C6A3]" />
              <span>{isStarting ? 'Starting...' : 'Start Camera'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Unsupported Notice Banner */}
      {!isSupported && (
        <div className="mb-3.5 p-3 bg-amber-50 border border-amber-200/80 rounded-xl text-xs text-amber-800 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-semibold">Native Camera Barcode Detection Notice:</span>
            <p className="text-[11px] text-amber-700 leading-relaxed">
              Real-time camera scanning utilizes the browser <code className="font-mono bg-amber-100 px-1 py-0.5 rounded">BarcodeDetector</code> API (supported in Google Chrome, Microsoft Edge, and Android Chromium browsers). For other environments, please use the USB Scanner Input or manual entry.
            </p>
          </div>
        </div>
      )}

      {/* Error Message Banner */}
      {errorMessage && (
        <div className="mb-3.5 p-3 bg-rose-50 border border-rose-200/80 rounded-xl text-xs text-rose-800 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span className="leading-relaxed">{errorMessage}</span>
        </div>
      )}

      {/* Viewfinder Container */}
      <div className="relative w-full aspect-4/3 sm:aspect-16/9 min-h-[220px] max-h-[320px] sm:max-h-[360px] bg-slate-950 rounded-2xl overflow-hidden flex items-center justify-center border border-slate-800 shadow-inner">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            isActive ? 'opacity-100' : 'opacity-0 absolute pointer-events-none'
          }`}
        />

        {isActive ? (
          /* Viewfinder Reticle / Target Overlay */
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-4">
            <div className="w-48 h-48 sm:w-56 sm:h-56 max-w-[70vw] max-h-[70vw] border-2 border-dashed border-[#37C6A3]/80 rounded-2xl relative flex items-center justify-center shadow-[0_0_20px_rgba(55,198,163,0.15)]">
              {/* Corner brackets */}
              <div className="absolute top-0 left-0 w-6 h-6 border-t-[3.5px] border-l-[3.5px] border-[#37C6A3] rounded-tl-xl shadow-[0_0_8px_rgba(55,198,163,0.6)]" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-[3.5px] border-r-[3.5px] border-[#37C6A3] rounded-tr-xl shadow-[0_0_8px_rgba(55,198,163,0.6)]" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-[3.5px] border-l-[3.5px] border-[#37C6A3] rounded-bl-xl shadow-[0_0_8px_rgba(55,198,163,0.6)]" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-[3.5px] border-r-[3.5px] border-[#37C6A3] rounded-br-xl shadow-[0_0_8px_rgba(55,198,163,0.6)]" />

              {/* Vertical Sweeping Green Laser Line */}
              <div className="scanner-active-laser" />
            </div>

            <p className="mt-3.5 text-xs text-emerald-300 bg-slate-950/90 border border-emerald-500/40 px-3.5 py-1.5 rounded-full backdrop-blur-xs font-semibold shadow-lg z-20 pointer-events-none">
              Align Student QR Code or Barcode within frame
            </p>
          </div>
        ) : (
          /* Idle Viewfinder Placeholder */
          <div className="text-center p-6 space-y-2 text-slate-500">
            <Video className="w-10 h-10 mx-auto text-slate-600 stroke-[1.5]" />
            <p className="text-xs font-semibold text-slate-400">
              Camera feed is currently inactive.
            </p>
            <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
              Click &quot;Start Camera&quot; to scan student ID cards using your device camera.
            </p>
          </div>
        )}
      </div>

      {/* Security Notice */}
      <div className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-400">
        <ShieldCheck className="w-3.5 h-3.5 text-[#0D9488] shrink-0" />
        <span>Camera frames are processed entirely on-device in memory. Zero video or image data is ever uploaded or retained.</span>
      </div>
    </div>
  );
};
