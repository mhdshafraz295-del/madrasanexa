import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  CameraOff,
  AlertCircle,
  ShieldCheck,
  Video,
  Zap,
  ZapOff,
  Image as ImageIcon,
  Keyboard,
  Maximize2,
  Minimize2,
  RefreshCw,
  X,
  Check,
  Loader2,
  ScanLine,
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { playScannerFeedback, ScanDebouncer } from './scanner-utils';

export interface CameraScannerViewProps {
  onScan: (payload: string, source: 'camera') => void;
  disabled?: boolean;
  contextBadge?: string;
  statsBadge?: string;
  isModal?: boolean;
  onClose?: () => void;
  fullScreenEnabled?: boolean;
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
  contextBadge,
  statsBadge,
  isModal = false,
  onClose,
  fullScreenEnabled = true,
}) => {
  const [isActive, setIsActive] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isTorchSupported, setIsTorchSupported] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(isModal);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [isDecodingImage, setIsDecodingImage] = useState(false);
  const [scanPulse, setScanPulse] = useState(false);

  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const isDetectingRef = useRef(false);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scannerContainerId = useRef(`html5qr-code-fallback-${Math.random().toString(36).substring(2, 9)}`);

  // 1.2s debouncer per student code
  const debouncerRef = useRef(new ScanDebouncer(1200));

  // Determine if BarcodeDetector is natively available
  const hasNativeDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window;

  // Stop camera tracks cleanly
  const stopCamera = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    if (html5QrCodeRef.current) {
      try {
        html5QrCodeRef.current.stop().catch(() => {});
      } catch (_) {}
      html5QrCodeRef.current = null;
    }

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
    setIsTorchOn(false);
    setIsActive(false);
    setIsStarting(false);
  }, []);

  // Cleanup on unmount
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
        // Prefer back / environment camera
        const backCamera = videoInputs.find(
          (d) => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('environment')
        );
        setSelectedDeviceId(backCamera ? backCamera.deviceId : videoInputs[0].deviceId);
      }
    } catch (err) {
      console.warn('Failed to enumerate cameras:', err);
    }
  };

  // Check and configure torch
  const inspectTorchSupport = (stream: MediaStream) => {
    try {
      const track = stream.getVideoTracks()[0];
      if (track && typeof track.getCapabilities === 'function') {
        const capabilities = track.getCapabilities() as any;
        if (capabilities && 'torch' in capabilities) {
          setIsTorchSupported(true);
          return;
        }
      }
    } catch (_) {}
    setIsTorchSupported(false);
  };

  // Toggle torch / flashlight
  const toggleTorch = async () => {
    if (!streamRef.current || !isTorchSupported) return;
    try {
      const track = streamRef.current.getVideoTracks()[0];
      if (track) {
        const nextState = !isTorchOn;
        await track.applyConstraints({
          advanced: [{ torch: nextState } as any],
        });
        setIsTorchOn(nextState);
      }
    } catch (err) {
      console.warn('Torch toggle failed:', err);
    }
  };

  // Handle successful code detection
  const handleDetectedCode = useCallback(
    (code: string) => {
      const trimmed = code.trim();
      if (!trimmed) return;

      // Check 1.2s per-code debouncer
      if (debouncerRef.current.isDuplicate(trimmed)) {
        return;
      }

      // Visual pulse
      setScanPulse(true);
      setTimeout(() => setScanPulse(false), 350);

      // Audio & Haptic
      playScannerFeedback('success', false);

      // Emit scan event
      try {
        onScanRef.current(trimmed, 'camera');
      } catch (err) {
        console.warn('onScan handler error:', err);
      }
    },
    []
  );

  // Start BarcodeDetector frame loop (Chromium / Android / Edge)
  const startNativeDetectionLoop = () => {
    if (!window.BarcodeDetector) return;

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
    // Scan every 35ms (~28-30 FPS) for zero-lag detection
    const FRAME_INTERVAL_MS = 35;

    const scanFrame = async (timestamp: number) => {
      if (!streamRef.current || !videoRef.current || videoRef.current.readyState < 2) {
        animFrameRef.current = requestAnimationFrame(scanFrame);
        return;
      }

      if (disabledRef.current) {
        animFrameRef.current = requestAnimationFrame(scanFrame);
        return;
      }

      if (timestamp - lastFrameTime >= FRAME_INTERVAL_MS && !isDetectingRef.current) {
        lastFrameTime = timestamp;
        isDetectingRef.current = true;

        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes && barcodes.length > 0) {
            const raw = barcodes[0].rawValue;
            if (raw) {
              handleDetectedCode(raw);
            }
          }
        } catch (_) {
          // Ignore transient frame detect errors during motion/focus
        } finally {
          isDetectingRef.current = false;
        }
      }

      animFrameRef.current = requestAnimationFrame(scanFrame);
    };

    animFrameRef.current = requestAnimationFrame(scanFrame);
  };

  // Fallback: Start Html5Qrcode scanner (Safari / iOS / Non-Chromium)
  const startHtml5QrcodeFallback = async () => {
    try {
      const scanner = new Html5Qrcode(scannerContainerId.current);
      html5QrCodeRef.current = scanner;

      await scanner.start(
        selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : { facingMode: 'environment' },
        {
          fps: 25,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const edge = Math.floor(minEdge * 0.72);
            return { width: edge, height: edge };
          },
          disableFlip: false,
        },
        (decodedText) => {
          handleDetectedCode(decodedText);
        },
        () => {} // Silent frame rejection
      );

      setIsActive(true);
      await updateDeviceList();
    } catch (err: any) {
      console.error('Html5Qrcode fallback error:', err);
      setErrorMessage(err.message || 'Camera failed to start.');
      stopCamera();
    } finally {
      setIsStarting(false);
    }
  };

  // Start Camera
  const startCamera = async () => {
    if (disabled) return;
    setErrorMessage(null);
    setIsStarting(true);

    // If BarcodeDetector is available, use custom lightweight video element + RAF loop
    if (hasNativeDetector) {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Camera access is not supported by your browser.');
        }

        const constraints: MediaStreamConstraints = {
          video: selectedDeviceId
            ? {
                deviceId: { exact: selectedDeviceId },
                width: { ideal: 1280 },
                height: { ideal: 720 },
              }
            : {
                facingMode: { ideal: 'environment' },
                width: { ideal: 1280 },
                height: { ideal: 720 },
              },
          audio: false,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;

        // Apply continuous autofocus if supported
        const track = stream.getVideoTracks()[0];
        if (track && typeof track.getCapabilities === 'function') {
          try {
            const caps = track.getCapabilities() as any;
            if (caps && 'focusMode' in caps && Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) {
              await track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as any] });
            }
          } catch (_) {}
        }

        inspectTorchSupport(stream);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        setIsActive(true);
        await updateDeviceList();
        startNativeDetectionLoop();
      } catch (err: any) {
        console.error('Camera access error:', err);
        stopCamera();

        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setErrorMessage('Camera permission denied. Please allow camera permissions in your browser address bar.');
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
    } else {
      // Non-Chromium fallback (Safari / Firefox)
      startHtml5QrcodeFallback();
    }
  };

  // Switch camera device
  const handleDeviceChange = (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    if (isActive) {
      stopCamera();
      setTimeout(() => {
        startCamera();
      }, 120);
    }
  };

  // Handle Gallery Image Upload & Decode
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsDecodingImage(true);
    setErrorMessage(null);

    try {
      // 1. Try native BarcodeDetector if available
      if (hasNativeDetector && window.BarcodeDetector) {
        try {
          const bitmap = await createImageBitmap(file);
          const detector = new window.BarcodeDetector({
            formats: ['qr_code', 'code_128', 'code_39', 'ean_13'],
          });
          const barcodes = await detector.detect(bitmap);
          if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
            handleDetectedCode(barcodes[0].rawValue);
            setIsDecodingImage(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
          }
        } catch (_) {}
      }

      // 2. Fallback to Html5Qrcode.scanFile
      const html5QrCode = new Html5Qrcode(scannerContainerId.current);
      const decoded = await html5QrCode.scanFile(file, true);
      if (decoded) {
        handleDetectedCode(decoded);
      } else {
        setErrorMessage('No valid QR code or barcode found in the uploaded image.');
      }
    } catch (err: any) {
      setErrorMessage('Could not decode QR / Barcode from image. Ensure the image is clear and well-lit.');
    } finally {
      setIsDecodingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Submit quick manual admission code
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleDetectedCode(manualCode.trim());
    setManualCode('');
    setShowManualInput(false);
  };

  // Toggle full-screen mode
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  return (
    <div
      className={`relative transition-all overflow-hidden ${
        isFullscreen
          ? 'fixed inset-0 z-50 bg-black flex flex-col w-screen h-screen'
          : 'bg-white rounded-2xl sm:rounded-3xl border border-stone-200/90 shadow-sm p-3.5 sm:p-5'
      }`}
    >
      {/* Laser Animation Style */}
      <style>{`
        @keyframes scanVerticalLaser {
          0% {
            top: 8%;
            opacity: 0.5;
          }
          50% {
            opacity: 1;
          }
          100% {
            top: 92%;
            opacity: 0.5;
          }
        }
        .native-scanner-laser {
          position: absolute;
          left: 6%;
          right: 6%;
          height: 2.5px;
          background: linear-gradient(90deg, rgba(52,211,153,0.1) 0%, rgba(52,211,153,1) 50%, rgba(52,211,153,0.1) 100%);
          box-shadow: 0 0 14px 3px rgba(16,185,129,0.85), 0 0 4px 1px rgba(52,211,153,1);
          animation: scanVerticalLaser 2s ease-in-out infinite alternate;
          border-radius: 9999px;
        }
      `}</style>

      {/* Hidden file input for gallery upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageUpload}
      />

      {/* Embedded Controls Header (when not in full-screen modal) */}
      {!isFullscreen && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-3 h-3 rounded-full shrink-0 transition-all ${
                isActive
                  ? 'bg-emerald-500 ring-4 ring-emerald-100 animate-pulse'
                  : isStarting
                  ? 'bg-amber-400 animate-spin'
                  : 'bg-stone-300'
              }`}
            />
            <div className="flex items-center gap-2 truncate">
              <h2 className="text-sm font-bold text-stone-800 flex items-center gap-1.5 truncate">
                <Camera className="w-4 h-4 text-[#0F5A47] shrink-0" />
                <span className="truncate">Native QR & Barcode Viewfinder</span>
              </h2>
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                    : isStarting
                    ? 'bg-amber-50 text-amber-700 border border-amber-200/60'
                    : 'bg-stone-100 text-stone-500'
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
                className="text-xs bg-stone-50 border border-stone-200 text-stone-700 rounded-lg px-2.5 py-1.5 outline-none font-medium cursor-pointer max-w-[150px] truncate"
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
                className="px-4 py-1.5 rounded-lg bg-[#0F5A47] hover:bg-[#0c4738] disabled:bg-stone-200 text-white disabled:text-stone-400 text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer shrink-0 active:scale-95"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>{isStarting ? 'Starting...' : 'Start Camera'}</span>
              </button>
            )}

            {fullScreenEnabled && (
              <button
                type="button"
                onClick={toggleFullscreen}
                className="p-1.5 rounded-lg border border-stone-200 hover:bg-stone-100 text-stone-600 transition cursor-pointer"
                title="Fullscreen Viewfinder"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Fullscreen Close / Exit Header */}
      {isFullscreen && (
        <div className="absolute top-0 inset-x-0 z-30 p-3 sm:p-4 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-white text-xs sm:text-sm font-bold tracking-tight">
              Live Native Viewfinder
            </span>
            {contextBadge && (
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                {contextBadge}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-full bg-stone-900/80 text-white hover:bg-stone-800 transition cursor-pointer border border-white/20"
                title="Close Scanner"
              >
                <X className="w-5 h-5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={toggleFullscreen}
                className="p-2 rounded-full bg-stone-900/80 text-white hover:bg-stone-800 transition cursor-pointer border border-white/20"
                title="Exit Fullscreen"
              >
                <Minimize2 className="w-5 h-5" />
              </button>
            )}
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

      {/* Viewfinder Main Stage: Edge-to-Edge with Dark Vignette */}
      <div
        className={`relative w-full bg-stone-950 overflow-hidden flex items-center justify-center ${
          isFullscreen
            ? 'flex-1 h-full'
            : 'aspect-4/3 sm:aspect-16/9 min-h-[290px] max-h-[380px] sm:max-h-[420px] rounded-2xl border border-stone-800 shadow-inner'
        }`}
      >
        {/* Container for fallback Html5Qrcode rendering */}
        <div
          id={scannerContainerId.current}
          className={`w-full h-full object-cover ${hasNativeDetector ? 'hidden' : 'block'}`}
        />

        {/* Primary Native Video Stream */}
        {hasNativeDetector && (
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              isActive ? 'opacity-100' : 'opacity-0 absolute pointer-events-none'
            }`}
          />
        )}

        {/* Top Centered Translucent Status Pill */}
        <div className="absolute top-3 sm:top-4 inset-x-0 flex flex-wrap items-center justify-center gap-2 z-20 px-3 pointer-events-none">
          <span className="bg-stone-950/80 backdrop-blur-md text-white border border-white/15 px-3 py-1 rounded-full text-xs font-semibold shadow-lg flex items-center gap-1.5">
            <ScanLine className="w-3.5 h-3.5 text-emerald-400" />
            Scan QR / Barcode
          </span>
          {contextBadge && (
            <span className="bg-emerald-950/85 backdrop-blur-md text-emerald-200 border border-emerald-500/30 px-2.5 py-1 rounded-full text-[11px] font-bold shadow-lg">
              {contextBadge}
            </span>
          )}
          {statsBadge && (
            <span className="bg-stone-900/80 backdrop-blur-md text-stone-300 border border-white/10 px-2.5 py-1 rounded-full text-[11px] font-medium shadow-lg">
              {statsBadge}
            </span>
          )}
        </div>

        {/* Active Reticle Frame & Dark Vignette */}
        {isActive ? (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-4">
            {/* Center Focus Reticle with 4 Crisp White Rounded L-Corner Brackets */}
            <div
              className={`w-56 h-56 sm:w-64 sm:h-64 max-w-[70vw] max-h-[70vw] relative rounded-3xl shadow-[0_0_0_9999px_rgba(0,0,0,0.58)] transition-all duration-200 flex items-center justify-center ${
                scanPulse
                  ? 'scale-105 shadow-[0_0_0_9999px_rgba(0,0,0,0.4),0_0_35px_rgba(16,185,129,0.9)]'
                  : ''
              }`}
            >
              {/* 4 White Corner Brackets */}
              <div
                className={`absolute -top-1 -left-1 w-8 h-8 border-t-[4px] border-l-[4px] rounded-tl-2xl transition-all ${
                  scanPulse
                    ? 'border-emerald-400 shadow-[0_0_12px_rgba(52,211,153,1)]'
                    : 'border-white shadow-[0_0_8px_rgba(255,255,255,0.7)]'
                }`}
              />
              <div
                className={`absolute -top-1 -right-1 w-8 h-8 border-t-[4px] border-r-[4px] rounded-tr-2xl transition-all ${
                  scanPulse
                    ? 'border-emerald-400 shadow-[0_0_12px_rgba(52,211,153,1)]'
                    : 'border-white shadow-[0_0_8px_rgba(255,255,255,0.7)]'
                }`}
              />
              <div
                className={`absolute -bottom-1 -left-1 w-8 h-8 border-b-[4px] border-l-[4px] rounded-bl-2xl transition-all ${
                  scanPulse
                    ? 'border-emerald-400 shadow-[0_0_12px_rgba(52,211,153,1)]'
                    : 'border-white shadow-[0_0_8px_rgba(255,255,255,0.7)]'
                }`}
              />
              <div
                className={`absolute -bottom-1 -right-1 w-8 h-8 border-b-[4px] border-r-[4px] rounded-br-2xl transition-all ${
                  scanPulse
                    ? 'border-emerald-400 shadow-[0_0_12px_rgba(52,211,153,1)]'
                    : 'border-white shadow-[0_0_8px_rgba(255,255,255,0.7)]'
                }`}
              />

              {/* Sweeping Laser Line */}
              <div className="native-scanner-laser" />
            </div>

            <p className="mt-4 text-[11px] sm:text-xs text-white/90 bg-stone-900/85 border border-white/10 px-3.5 py-1 rounded-full backdrop-blur-sm font-medium shadow-lg text-center max-w-[85%]">
              Align Student QR or 1D Admission Barcode within frame
            </p>
          </div>
        ) : (
          /* Idle Viewfinder Placeholder */
          <div className="text-center p-6 space-y-3 text-stone-500">
            <Video className="w-10 h-10 mx-auto text-stone-600 stroke-[1.5]" />
            <p className="text-xs font-semibold text-stone-400">
              Camera feed is currently inactive.
            </p>
            <p className="text-[11px] text-stone-500 max-w-sm mx-auto">
              Tap &quot;Start Camera&quot; to begin instant QR and Barcode scanning.
            </p>
            <button
              type="button"
              disabled={disabled || isStarting}
              onClick={startCamera}
              className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0F5A47] hover:bg-[#0c4738] text-white text-xs font-semibold shadow-sm transition active:scale-95 cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              <span>{isStarting ? 'Starting...' : 'Activate Camera'}</span>
            </button>
          </div>
        )}

        {/* Decoding Image Loader Overlay */}
        {isDecodingImage && (
          <div className="absolute inset-0 bg-black/75 backdrop-blur-xs flex flex-col items-center justify-center gap-2 z-30">
            <Loader2 className="w-7 h-7 text-emerald-400 animate-spin" />
            <span className="text-xs font-semibold text-white">Decoding Image from Gallery...</span>
          </div>
        )}

        {/* Quick Manual Entry Sheet Overlay */}
        {showManualInput && (
          <div className="absolute inset-0 bg-stone-950/90 backdrop-blur-md flex flex-col items-center justify-center p-4 z-40">
            <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 w-full max-w-sm space-y-3 text-white shadow-2xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
                  <Keyboard className="w-4 h-4 text-emerald-400" />
                  Manual Code Entry
                </span>
                <button
                  type="button"
                  onClick={() => setShowManualInput(false)}
                  className="p-1 text-stone-400 hover:text-white transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleManualSubmit} className="space-y-3">
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="Enter Admission No or Token..."
                  autoFocus
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-700 text-sm font-mono text-white placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowManualInput(false)}
                    className="flex-1 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-xs font-semibold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Submit</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Bottom Floating Dark Glass Pill Toolbar (Torch, Gallery, Manual, Flip) */}
        {isActive && (
          <div className="absolute bottom-3 sm:bottom-4 inset-x-0 flex justify-center z-20 pointer-events-none px-3">
            <div className="bg-stone-950/85 backdrop-blur-md border border-white/15 rounded-full px-3 sm:px-4 py-1.5 sm:py-2 shadow-2xl flex items-center gap-3 sm:gap-4 pointer-events-auto">
              {/* Torch Toggle */}
              {isTorchSupported && (
                <button
                  type="button"
                  onClick={toggleTorch}
                  className={`p-2 rounded-full transition cursor-pointer ${
                    isTorchOn
                      ? 'bg-amber-400 text-stone-950 shadow-md ring-2 ring-amber-300'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                  title={isTorchOn ? 'Turn Flashlight Off' : 'Turn Flashlight On'}
                >
                  {isTorchOn ? <Zap className="w-4 h-4 fill-current" /> : <ZapOff className="w-4 h-4" />}
                </button>
              )}

              {/* Gallery Image Upload */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition cursor-pointer"
                title="Scan QR / Barcode from Photo in Gallery"
              >
                <ImageIcon className="w-4 h-4" />
              </button>

              {/* Quick Manual Code Input */}
              <button
                type="button"
                onClick={() => setShowManualInput(true)}
                className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition cursor-pointer"
                title="Enter Admission No Manually"
              >
                <Keyboard className="w-4 h-4" />
              </button>

              {/* Camera Flip (if multiple devices) */}
              {devices.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    const nextDevice = devices.find((d) => d.deviceId !== selectedDeviceId) || devices[0];
                    if (nextDevice) handleDeviceChange(nextDevice.deviceId);
                  }}
                  className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition cursor-pointer"
                  title="Flip / Switch Camera"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              )}

              {/* Fullscreen Viewfinder Toggle */}
              {fullScreenEnabled && (
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition cursor-pointer"
                  title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Viewfinder'}
                >
                  {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Security & Privacy Notice */}
      {!isFullscreen && (
        <div className="mt-3 flex items-center gap-1.5 text-[11px] text-stone-400">
          <ShieldCheck className="w-3.5 h-3.5 text-[#0F5A47] shrink-0" />
          <span>Camera frames are processed entirely on-device in memory. Zero video or image data is ever uploaded or retained.</span>
        </div>
      )}
    </div>
  );
};
