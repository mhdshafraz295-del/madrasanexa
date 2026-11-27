import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { playScannerFeedback, ScanDebouncer } from './scanner-utils';

export interface ScanResultToast {
  status: 'success' | 'duplicate' | 'error' | 'warning' | 'info';
  direction?: 'ENTRY' | 'EXIT' | string;
  studentName?: string;
  admissionNo?: string;
  rollNo?: string;
  message?: string;
  timestamp?: number;
}

export interface CameraScannerViewProps {
  onScan: (payload: string, source: 'camera') => void;
  lastScanResult?: ScanResultToast | null;
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
  lastScanResult,
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

  // Live Toast Pill Inside Viewfinder
  const [activeToast, setActiveToast] = useState<ScanResultToast | null>(null);
  const toastTimerRef = useRef<any>(null);

  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const videoRef = useRef<HTMLVideoElement | null>(null);
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

  // Sync external lastScanResult prop into activeToast with 2500ms auto-dismiss
  useEffect(() => {
    if (lastScanResult) {
      setActiveToast(lastScanResult);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => {
        setActiveToast(null);
      }, 2500);
    }
  }, [lastScanResult]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // Lock body scrolling when fullscreen is active
  useEffect(() => {
    if (isFullscreen) {
      const originalBodyOverflow = document.body.style.overflow;
      const originalDocOverflow = document.documentElement.style.overflow;
      const originalTouchAction = document.body.style.touchAction;

      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';

      return () => {
        document.body.style.overflow = originalBodyOverflow;
        document.documentElement.style.overflow = originalDocOverflow;
        document.body.style.touchAction = originalTouchAction;
      };
    }
  }, [isFullscreen]);

  // Exit fullscreen helper: releases browser fullscreen and resets overlay state
  const exitFullscreenMode = useCallback(async () => {
    setIsFullscreen(false);
    try {
      if (typeof document !== 'undefined' && document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen().catch(() => {});
      }
    } catch (_) {}
  }, []);

  // Enter fullscreen helper: triggers browser requestFullscreen and sets fullscreen overlay
  const enterFullscreenMode = useCallback(async () => {
    setIsFullscreen(true);
    try {
      if (typeof document !== 'undefined' && document.documentElement.requestFullscreen && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch (_) {}
  }, []);

  // Stop camera tracks cleanly and release fullscreen
  const stopCamera = useCallback((shouldExitFullscreen = true) => {
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

    if (shouldExitFullscreen) {
      exitFullscreenMode();
    }
  }, [exitFullscreenMode]);

  // Handle ESC key to exit fullscreen or close modal & cleanly stop camera
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        if (showManualInput) {
          setShowManualInput(false);
        } else {
          stopCamera(true);
          if (onClose) {
            onClose();
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, showManualInput, onClose, stopCamera]);

  // Sync with document fullscreenchange events
  useEffect(() => {
    const handleFsChange = () => {
      if (!document.fullscreenElement && isFullscreen) {
        setIsFullscreen(false);
        stopCamera(false);
        if (isModal && onClose) {
          onClose();
        }
      }
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, [isFullscreen, isModal, onClose, stopCamera]);

  // Callback ref for video element: guarantees stream re-attachment across portal transitions
  const setVideoElement = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (node && streamRef.current) {
      node.srcObject = streamRef.current;
      node.play().catch(() => {});
    }
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
        const backCamera = videoInputs.find(
          (d) => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('environment')
        );
        setSelectedDeviceId(backCamera ? backCamera.deviceId : videoInputs[0].deviceId);
      }
    } catch (err) {
      console.warn('Failed to enumerate cameras:', err);
    }
  };

  // Inspect torch support
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

      // Optimistic fast pill until parent response updates it
      setActiveToast({
        status: 'info',
        studentName: trimmed,
        message: 'Processing scan...',
        timestamp: Date.now(),
      });
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => {
        setActiveToast(null);
      }, 2500);

      // Emit scan event
      try {
        onScanRef.current(trimmed, 'camera');
      } catch (err) {
        console.warn('onScan handler error:', err);
      }
    },
    []
  );

  // Start BarcodeDetector frame loop
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
    const FRAME_INTERVAL_MS = 35; // ~28-30 FPS for instant detection

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
          // Ignore transient frame detect errors during rapid motion
        } finally {
          isDetectingRef.current = false;
        }
      }

      animFrameRef.current = requestAnimationFrame(scanFrame);
    };

    animFrameRef.current = requestAnimationFrame(scanFrame);
  };

  // Fallback: Start Html5Qrcode scanner (Safari / Firefox / iOS)
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
      stopCamera(true);
    } finally {
      setIsStarting(false);
    }
  };

  // Start Camera with Automatic Fullscreen
  const startCamera = async () => {
    if (disabled) return;
    setErrorMessage(null);
    setIsStarting(true);
    await enterFullscreenMode();

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
        stopCamera(true);

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
      startHtml5QrcodeFallback();
    }
  };

  // Switch camera device
  const handleDeviceChange = (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    if (isActive) {
      stopCamera(false);
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

  // Toggle true locked fullscreen mode
  const toggleFullscreen = async () => {
    if (!isFullscreen) {
      await enterFullscreenMode();
    } else {
      stopCamera(true);
      if (isModal && onClose) {
        onClose();
      }
    }
  };

  // Viewfinder stage JSX
  const viewfinderStage = (
    <div
      className={
        isFullscreen
          ? 'fixed inset-0 z-[9999] h-[100dvh] w-screen bg-black overflow-hidden touch-none select-none flex flex-col'
          : 'relative bg-white rounded-2xl sm:rounded-3xl border border-stone-200/90 shadow-sm p-3.5 sm:p-5 transition-all overflow-hidden'
      }
    >
      {/* Laser Animation Style */}
      <style>{`
        @keyframes scanVerticalLaser {
          0% {
            top: 8%;
            opacity: 0.45;
          }
          50% {
            opacity: 1;
          }
          100% {
            top: 92%;
            opacity: 0.45;
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

      {/* Embedded Controls Header (when NOT in full-screen mode) */}
      {!isFullscreen && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3.5 min-w-0">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <div
              className={`w-2.5 h-2.5 rounded-full shrink-0 transition-all ${
                isActive
                  ? 'bg-emerald-500 ring-4 ring-emerald-100 animate-pulse'
                  : isStarting
                  ? 'bg-amber-400 animate-spin'
                  : 'bg-stone-300'
              }`}
            />
            <h2 className="text-sm font-bold text-stone-800 flex items-center gap-1.5 shrink-0">
              <Camera className="w-4 h-4 text-[#0F5A47] shrink-0" />
              <span>Native QR & Barcode Scanner</span>
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

          <div className="grid grid-cols-1 sm:grid-cols-[auto_auto] sm:flex sm:items-center gap-2 w-full sm:w-auto justify-stretch sm:justify-end">
            {devices.length > 1 && (
              <select
                value={selectedDeviceId}
                onChange={(e) => handleDeviceChange(e.target.value)}
                className="w-full sm:w-auto text-xs bg-stone-50 border border-stone-200 text-stone-700 rounded-lg px-2.5 py-1.5 outline-none font-medium cursor-pointer truncate"
              >
                {devices.map((device, idx) => (
                  <option key={device.deviceId || idx} value={device.deviceId}>
                    {device.label || `Camera ${idx + 1}`}
                  </option>
                ))}
              </select>
            )}

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              {isActive ? (
                <button
                  type="button"
                  onClick={() => stopCamera(true)}
                  className="flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
                >
                  <CameraOff className="w-3.5 h-3.5" />
                  <span>Stop Camera</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={disabled || isStarting}
                  onClick={() => {
                    enterFullscreenMode();
                    startCamera();
                  }}
                  className="flex-1 sm:flex-none px-4 py-1.5 rounded-lg bg-[#0F5A47] hover:bg-[#0c4738] disabled:bg-stone-200 text-white disabled:text-stone-400 text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer shrink-0 active:scale-95"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>{isStarting ? 'Starting...' : 'Start Camera'}</span>
                </button>
              )}

              {fullScreenEnabled && (
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="p-1.5 rounded-lg border border-stone-200 hover:bg-stone-100 text-stone-600 transition cursor-pointer shrink-0"
                  title="Fullscreen Viewfinder"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              )}
            </div>
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

      {/* ============================================================== */}
      {/* Viewfinder Main Stage: 3 Non-Overlapping Vertical Zones       */}
      {/* ============================================================== */}
      <div
        className={`relative w-full bg-stone-950 overflow-hidden flex items-center justify-center ${
          isFullscreen
            ? 'flex-1 h-full'
            : 'min-h-[380px] sm:min-h-[420px] rounded-2xl border border-stone-800 shadow-inner'
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
            ref={setVideoElement}
            playsInline
            muted
            autoPlay
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              isActive ? 'opacity-100' : 'opacity-0 absolute pointer-events-none'
            }`}
          />
        )}

        {/* 3-ZONE OVERLAY CONTAINER: Top Zone, Center Reticle Zone, Bottom Zone */}
        <div className="absolute inset-0 flex flex-col justify-between p-3 sm:p-4 z-20 pointer-events-none overflow-hidden">
          {/* ========================================================== */}
          {/* ZONE 1: TOP ZONE (Single Horizontal Clean Bar)             */}
          {/* ========================================================== */}
          <div className="flex items-center justify-between gap-1.5 text-[11px] sm:text-xs w-full shrink-0 z-20">
            {/* Left Status Pill */}
            <span className="bg-stone-950/85 backdrop-blur-md text-white border border-white/15 px-2.5 sm:px-3 py-1 rounded-full font-semibold shadow-lg flex items-center gap-1.5 shrink-0 pointer-events-auto">
              <span
                className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${
                  isActive ? 'bg-emerald-400 animate-pulse' : 'bg-stone-400'
                }`}
              />
              <span className="inline sm:hidden">Scan QR</span>
              <span className="hidden sm:inline">Scan QR / Barcode</span>
            </span>

            {/* Right Section: Combined Badge + Fullscreen Toggle / Close */}
            <div className="flex items-center gap-1.5 min-w-0 pointer-events-auto">
              {(contextBadge || statsBadge) && (
                <span
                  className="bg-emerald-950/85 backdrop-blur-md text-emerald-200 border border-emerald-500/30 px-2 sm:px-2.5 py-1 rounded-full font-bold shadow-lg truncate max-w-[170px] sm:max-w-[240px]"
                  title={
                    contextBadge && statsBadge
                      ? `${contextBadge} • ${statsBadge}`
                      : contextBadge || statsBadge || ''
                  }
                >
                  {contextBadge && statsBadge
                    ? `${contextBadge} • ${statsBadge}`
                    : contextBadge || statsBadge}
                </span>
              )}

              {isFullscreen && (
                <button
                  type="button"
                  onClick={() => {
                    stopCamera(true);
                    if (onClose) onClose();
                  }}
                  className="p-1.5 rounded-full bg-stone-900/80 hover:bg-stone-800 text-white border border-white/20 transition cursor-pointer shadow-lg active:scale-95 shrink-0"
                  title={onClose ? 'Close Scanner' : 'Exit Fullscreen & Stop Camera'}
                >
                  {onClose ? <X className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
          </div>

          {/* ========================================================== */}
          {/* LIVE FLOATING SCAN RESULT PILL (Side/Top-Right Toast)      */}
          {/* ========================================================== */}
          {activeToast && (
            <div className="absolute top-12 sm:top-14 right-3 sm:right-4 z-30 max-w-[88vw] sm:max-w-md pointer-events-auto transition-all animate-in fade-in slide-in-from-top-2 duration-200">
              <div
                className={`px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-2xl shadow-xl backdrop-blur-md flex items-center gap-2 sm:gap-2.5 border text-xs font-semibold ${
                  activeToast.status === 'success'
                    ? activeToast.direction === 'EXIT'
                      ? 'bg-blue-600/95 text-white border-blue-400/40 shadow-blue-900/30'
                      : 'bg-emerald-500/95 text-white border-emerald-300/40 shadow-emerald-900/30'
                    : activeToast.status === 'duplicate'
                    ? 'bg-amber-500/95 text-white border-amber-300/40 shadow-amber-900/30'
                    : activeToast.status === 'info'
                    ? 'bg-stone-800/95 text-white border-white/20 shadow-black/40'
                    : 'bg-rose-600/95 text-white border-rose-400/40 shadow-rose-900/30'
                }`}
              >
                <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                  {activeToast.status === 'success' ? (
                    <Check className="w-3.5 h-3.5 text-white stroke-[2.5]" />
                  ) : activeToast.status === 'duplicate' ? (
                    <AlertCircle className="w-3.5 h-3.5 text-white stroke-[2.5]" />
                  ) : activeToast.status === 'info' ? (
                    <Loader2 className="w-3.5 h-3.5 text-emerald-300 animate-spin" />
                  ) : (
                    <X className="w-3.5 h-3.5 text-white stroke-[2.5]" />
                  )}
                </div>

                <div className="flex items-center gap-1.5 truncate">
                  <span className="uppercase tracking-wider font-bold text-[11px] opacity-90 shrink-0">
                    {activeToast.status === 'duplicate'
                      ? 'ALREADY RECORDED'
                      : activeToast.status === 'error'
                      ? 'REJECTED'
                      : activeToast.status === 'info'
                      ? 'SCANNED'
                      : activeToast.direction || 'VERIFIED'}
                  </span>
                  <span className="opacity-60">•</span>
                  <span className="truncate font-bold">
                    {activeToast.studentName}
                  </span>
                  {(activeToast.admissionNo || activeToast.rollNo) && (
                    <span className="font-mono text-[10px] opacity-80 shrink-0">
                      ({activeToast.admissionNo || activeToast.rollNo})
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================== */}
          {/* ZONE 2: CENTER ZONE (Square Reticle Clear of All Bars)     */}
          {/* ========================================================== */}
          {isActive ? (
            <div className="flex items-center justify-center my-auto shrink-0 w-full py-1 sm:py-2">
              <div
                className={`w-44 h-44 sm:w-60 sm:h-60 max-w-[65vw] max-h-[65vw] relative rounded-3xl shadow-[0_0_0_9999px_rgba(0,0,0,0.58)] transition-all duration-200 flex items-center justify-center pointer-events-none ${
                  scanPulse
                    ? 'scale-105 shadow-[0_0_0_9999px_rgba(0,0,0,0.4),0_0_35px_rgba(16,185,129,0.9)]'
                    : ''
                }`}
              >
                {/* 4 Crisp White Rounded L-Corner Brackets */}
                <div
                  className={`absolute -top-1 -left-1 w-7 h-7 sm:w-8 sm:h-8 border-t-[4px] border-l-[4px] rounded-tl-2xl transition-all ${
                    scanPulse
                      ? 'border-emerald-400 shadow-[0_0_12px_rgba(52,211,153,1)]'
                      : 'border-white shadow-[0_0_8px_rgba(255,255,255,0.7)]'
                  }`}
                />
                <div
                  className={`absolute -top-1 -right-1 w-7 h-7 sm:w-8 sm:h-8 border-t-[4px] border-r-[4px] rounded-tr-2xl transition-all ${
                    scanPulse
                      ? 'border-emerald-400 shadow-[0_0_12px_rgba(52,211,153,1)]'
                      : 'border-white shadow-[0_0_8px_rgba(255,255,255,0.7)]'
                  }`}
                />
                <div
                  className={`absolute -bottom-1 -left-1 w-7 h-7 sm:w-8 sm:h-8 border-b-[4px] border-l-[4px] rounded-bl-2xl transition-all ${
                    scanPulse
                      ? 'border-emerald-400 shadow-[0_0_12px_rgba(52,211,153,1)]'
                      : 'border-white shadow-[0_0_8px_rgba(255,255,255,0.7)]'
                  }`}
                />
                <div
                  className={`absolute -bottom-1 -right-1 w-7 h-7 sm:w-8 sm:h-8 border-b-[4px] border-r-[4px] rounded-br-2xl transition-all ${
                    scanPulse
                      ? 'border-emerald-400 shadow-[0_0_12px_rgba(52,211,153,1)]'
                      : 'border-white shadow-[0_0_8px_rgba(255,255,255,0.7)]'
                  }`}
                />

                {/* Sweeping Laser Line */}
                <div className="native-scanner-laser" />
              </div>
            </div>
          ) : (
            /* Idle Viewfinder Placeholder */
            <div className="text-center p-4 my-auto shrink-0 space-y-2 text-stone-500 pointer-events-auto">
              <Video className="w-9 h-9 sm:w-10 sm:h-10 mx-auto text-stone-600 stroke-[1.5]" />
              <p className="text-xs font-semibold text-stone-400">
                Camera feed is currently inactive.
              </p>
              <p className="text-[11px] text-stone-500 max-w-sm mx-auto">
                Tap &quot;Activate Camera&quot; to begin instant QR and Barcode scanning.
              </p>
              <button
                type="button"
                disabled={disabled || isStarting}
                onClick={() => {
                  enterFullscreenMode();
                  startCamera();
                }}
                className="mt-1 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0F5A47] hover:bg-[#0c4738] text-white text-xs font-semibold shadow-sm transition active:scale-95 cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>{isStarting ? 'Starting...' : 'Activate Camera'}</span>
              </button>
            </div>
          )}

          {/* ========================================================== */}
          {/* ZONE 3: BOTTOM ZONE (Helper Caption + Dark Glass Toolbar)  */}
          {/* ========================================================== */}
          <div className={`flex flex-col items-center gap-1.5 sm:gap-2 shrink-0 w-full ${isFullscreen ? 'pb-[max(1rem,env(safe-area-inset-bottom))]' : 'pb-2 sm:pb-3'}`}>
            {isActive && (
              <p className="text-[10px] sm:text-xs text-white/90 bg-stone-950/80 border border-white/10 px-3 py-0.5 sm:py-1 rounded-full backdrop-blur-md font-medium shadow-lg text-center pointer-events-none truncate max-w-[92%]">
                Align QR or 1D Barcode within frame
              </p>
            )}

            {/* Floating Dark Glass Pill Toolbar */}
            {isActive && (
              <div className="bg-stone-950/85 backdrop-blur-md border border-white/15 rounded-full px-2.5 sm:px-4 py-1.5 sm:py-2 shadow-2xl flex items-center gap-2 sm:gap-4 pointer-events-auto">
                {/* Stop Camera & Exit Fullscreen */}
                <button
                  type="button"
                  onClick={() => {
                    stopCamera(true);
                    if (onClose) onClose();
                  }}
                  className="p-2 rounded-full bg-rose-600/80 hover:bg-rose-600 text-white transition cursor-pointer"
                  title="Stop Camera & Exit"
                >
                  <CameraOff className="w-4 h-4" />
                </button>

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

                {/* Fullscreen Viewfinder Toggle */}
                {fullScreenEnabled && (
                  <button
                    type="button"
                    onClick={() => {
                      if (isFullscreen) {
                        stopCamera(true);
                        if (onClose) onClose();
                      } else {
                        enterFullscreenMode();
                      }
                    }}
                    className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition cursor-pointer"
                    title={isFullscreen ? 'Exit Fullscreen & Stop Camera' : 'Fullscreen Viewfinder'}
                  >
                    {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </button>
                )}

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
              </div>
            )}
          </div>
        </div>

        {/* Decoding Image Loader Overlay */}
        {isDecodingImage && (
          <div className="absolute inset-0 bg-black/75 backdrop-blur-xs flex flex-col items-center justify-center gap-2 z-30">
            <Loader2 className="w-7 h-7 text-emerald-400 animate-spin" />
            <span className="text-xs font-semibold text-white">Decoding Image from Gallery...</span>
          </div>
        )}

        {/* Quick Manual Entry Sheet Overlay */}
        {showManualInput && (
          <div className="absolute inset-0 bg-stone-950/90 backdrop-blur-md flex flex-col items-center justify-center p-4 z-40 pointer-events-auto">
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

  // When True Locked Fullscreen is active, render via Portal into document.body
  if (isFullscreen && typeof document !== 'undefined') {
    return createPortal(viewfinderStage, document.body);
  }

  return viewfinderStage;
};
