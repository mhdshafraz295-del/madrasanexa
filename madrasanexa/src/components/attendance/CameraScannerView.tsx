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

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const isDetectingRef = useRef(false);

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
        formats: ['qr_code', 'code_128'],
      });
    } catch (err) {
      console.warn('Failed to initialize BarcodeDetector:', err);
      return;
    }

    let lastFrameTime = 0;
    const FRAME_INTERVAL_MS = 150; // Scan 6-7 times per second to save CPU/battery

    const scanFrame = async (timestamp: number) => {
      if (!streamRef.current || !videoRef.current || videoRef.current.readyState < 2) {
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
              onScan(code.trim(), 'camera');
            }
          }
        } catch (detErr) {
          // Frame detection errors can occur during rapid focus shifts; ignore silently
        } finally {
          isDetectingRef.current = false;
        }
      }

      animFrameRef.current = requestAnimationFrame(scanFrame);
    };

    animFrameRef.current = requestAnimationFrame(scanFrame);
  };

  // Switch camera device
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
    <div className="bg-white rounded-2xl border border-stone-200/90 shadow-sm p-4 sm:p-5 transition-all">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-3 h-3 rounded-full transition-all ${
              isActive
                ? 'bg-emerald-500 ring-4 ring-emerald-100 animate-pulse'
                : isStarting
                ? 'bg-amber-400 animate-spin'
                : 'bg-stone-300'
            }`}
          />
          <h2 className="text-sm font-bold text-stone-800 flex items-center gap-1.5">
            <Camera className="w-4 h-4 text-emerald-600" />
            Live Camera QR Scanner
          </h2>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              isActive
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                : 'bg-stone-100 text-stone-500'
            }`}
          >
            {isActive ? 'Camera Feed Active' : 'Camera Off'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {devices.length > 1 && (
            <select
              value={selectedDeviceId}
              onChange={(e) => handleDeviceChange(e.target.value)}
              className="text-xs bg-stone-50 border border-stone-200 text-stone-700 rounded-lg px-2.5 py-1.5 outline-none font-medium cursor-pointer"
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
              className="px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <CameraOff className="w-3.5 h-3.5" />
              Stop Camera
            </button>
          ) : (
            <button
              type="button"
              disabled={disabled || isStarting}
              onClick={startCamera}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-stone-200 text-white disabled:text-stone-400 text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5" />
              {isStarting ? 'Starting...' : 'Start Camera'}
            </button>
          )}
        </div>
      </div>

      {/* Unsupported Notice Banner */}
      {!isSupported && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200/80 rounded-xl text-xs text-amber-800 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-semibold">Native Camera Barcode Detection Notice:</span>
            <p className="text-[11px] text-amber-700 leading-relaxed">
              Native real-time camera QR scanning utilizes the browser <code className="font-mono bg-amber-100 px-1 py-0.5 rounded">BarcodeDetector</code> API (supported in Google Chrome, Microsoft Edge, and Android Chromium browsers). For other browsers, please use the USB Scanner Input or manual entry.
            </p>
          </div>
        </div>
      )}

      {/* Error Message Banner */}
      {errorMessage && (
        <div className="mb-4 p-3 bg-rose-50 border border-rose-200/80 rounded-xl text-xs text-rose-800 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span className="leading-relaxed">{errorMessage}</span>
        </div>
      )}

      {/* Viewfinder Container */}
      <div className="relative w-full aspect-video sm:aspect-21/9 max-h-72 bg-stone-900 rounded-xl overflow-hidden flex items-center justify-center border border-stone-800">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            isActive ? 'opacity-100' : 'opacity-0 absolute'
          }`}
        />

        {isActive ? (
          /* Viewfinder Reticle / Target Overlay */
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
            <div className="w-44 h-44 sm:w-52 sm:h-52 border-2 border-dashed border-emerald-400/80 rounded-2xl relative shadow-lg flex items-center justify-center">
              {/* Corner brackets */}
              <div className="absolute top-0 left-0 w-5 h-5 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-5 h-5 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-5 h-5 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-5 h-5 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />

              {/* Scanning laser line animation */}
              <div className="w-full h-0.5 bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)] animate-pulse" />
            </div>
            <p className="mt-3 text-xs text-emerald-300 bg-stone-900/80 px-2.5 py-1 rounded-full backdrop-blur-xs font-medium">
              Align Student QR Code within frame
            </p>
          </div>
        ) : (
          /* Idle Viewfinder Placeholder */
          <div className="text-center p-6 space-y-2 text-stone-500">
            <Video className="w-10 h-10 mx-auto text-stone-600" />
            <p className="text-xs font-medium text-stone-400">
              Camera feed is currently inactive.
            </p>
            <p className="text-[11px] text-stone-500">
              Click &quot;Start Camera&quot; above to scan student ID cards using your device webcam.
            </p>
          </div>
        )}
      </div>

      {/* Security Notice */}
      <div className="mt-3 flex items-center gap-1.5 text-[11px] text-stone-400">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        <span>Camera frames are processed entirely on-device in memory. Zero video or image data is ever uploaded or retained.</span>
      </div>
    </div>
  );
};
