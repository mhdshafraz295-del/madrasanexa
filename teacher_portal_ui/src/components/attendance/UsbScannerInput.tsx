import React, { useState, useRef, useEffect } from 'react';
import {
  ScanLine,
  Keyboard,
  Clock,
  Settings2,
  X,
  Zap,
} from 'lucide-react';
import { isScannerKeystrokeBurst } from './scanner-utils';

export interface UsbScannerInputProps {
  onScan: (payload: string, metadata: { isScanner: boolean; averageIntervalMs: number }) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}

export const UsbScannerInput: React.FC<UsbScannerInputProps> = ({
  onScan,
  disabled = false,
  autoFocus = true,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [timingThresholdMs, setTimingThresholdMs] = useState(40);
  const [showSettings, setShowSettings] = useState(false);
  const [lastBurstInfo, setLastBurstInfo] = useState<{
    isScanner: boolean;
    averageIntervalMs: number;
    charCount: number;
  } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const keyTimestampsRef = useRef<number[]>([]);
  const lastKeyTimeRef = useRef<number>(0);

  // Focus input automatically on mount or when autoFocus is requested
  useEffect(() => {
    if (autoFocus && !disabled && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus, disabled]);

  // Handle keystroke timing measurement
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const now = performance.now();

    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = inputValue.trim();
      if (!trimmed) return;

      const intervals = keyTimestampsRef.current;
      const burstAnalysis = isScannerKeystrokeBurst(intervals, timingThresholdMs);

      // In manual mode, we treat all submissions as manual
      const isScanner = manualMode ? false : burstAnalysis.isScanner;

      setLastBurstInfo({
        isScanner,
        averageIntervalMs: burstAnalysis.averageIntervalMs,
        charCount: trimmed.length,
      });

      // Reset timestamps and input
      keyTimestampsRef.current = [];
      lastKeyTimeRef.current = 0;
      setInputValue('');

      onScan(trimmed, {
        isScanner,
        averageIntervalMs: burstAnalysis.averageIntervalMs,
      });
      return;
    }

    // Ignore modifier keys in interval calculation
    if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab'].includes(e.key)) {
      return;
    }

    if (lastKeyTimeRef.current > 0) {
      const delta = now - lastKeyTimeRef.current;
      if (delta > 500) {
        keyTimestampsRef.current = [];
      } else {
        keyTimestampsRef.current.push(delta);
      }
    }
    lastKeyTimeRef.current = now;
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed) return;

    setLastBurstInfo({
      isScanner: false,
      averageIntervalMs: 0,
      charCount: trimmed.length,
    });

    keyTimestampsRef.current = [];
    lastKeyTimeRef.current = 0;
    setInputValue('');

    onScan(trimmed, {
      isScanner: false,
      averageIntervalMs: 0,
    });
  };

  const handleClear = () => {
    setInputValue('');
    keyTimestampsRef.current = [];
    lastKeyTimeRef.current = 0;
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 sm:p-5 transition-all">
      {/* Header with Status Indicator & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 mb-3">
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
          <div
            className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full transition-all shrink-0 ${
              disabled
                ? 'bg-slate-300'
                : isFocused
                ? 'bg-emerald-500 ring-4 ring-emerald-100 animate-pulse'
                : 'bg-amber-400'
            }`}
          />
          <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5 shrink-0">
            <ScanLine className="w-4 h-4 text-[#0D9488]" />
            USB Barcode & QR Scanner
          </h3>
          <span
            className={`text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-medium ${
              disabled
                ? 'bg-slate-100 text-slate-400'
                : isFocused
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                : 'bg-amber-50 text-amber-700 border border-amber-200/60'
            }`}
          >
            {disabled
              ? 'Disabled'
              : isFocused
              ? 'Scanner Ready & Focused'
              : 'Click Input to Focus'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-xs self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setManualMode(!manualMode)}
            className={`px-2.5 py-1 rounded-lg border font-medium flex items-center gap-1 transition-colors cursor-pointer ${
              manualMode
                ? 'bg-teal-50 border-teal-200 text-teal-800'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Keyboard className="w-3.5 h-3.5" />
            {manualMode ? 'Manual Mode: ON' : 'Manual Entry'}
          </button>

          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
              showSettings
                ? 'bg-slate-200 border-slate-300 text-slate-800'
                : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-800'
            }`}
            title="Scanner Timing Configuration"
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Timing Configuration Panel */}
      {showSettings && (
        <div className="mb-4 p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs text-slate-600 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-medium text-slate-700">
              <Clock className="w-3.5 h-3.5 text-[#0D9488]" />
              Keystroke Timing Threshold: <span className="font-bold text-emerald-700">{timingThresholdMs}ms</span>
            </div>
            <span className="text-[11px] text-slate-400">(Default: 40ms | Range: 15–75ms)</span>
          </div>
          <input
            type="range"
            min="15"
            max="75"
            step="5"
            value={timingThresholdMs}
            onChange={(e) => setTimingThresholdMs(Number(e.target.value))}
            className="w-full accent-[#0D9488] cursor-pointer"
          />
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Hardware USB scanners send keystrokes rapidly (typically 5–35ms). Entries with average keystroke intervals at or below this threshold are automatically recognized as hardware scans.
          </p>
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={handleManualSubmit} className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          disabled={disabled}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={
            disabled
              ? 'Scanner input disabled'
              : manualMode
              ? 'Type student token or admission number, then press Enter...'
              : 'Scan Student QR Code or 1D Admission Barcode...'
          }
          className={`w-full py-2.5 sm:py-3 pl-3 sm:pl-4 pr-20 sm:pr-24 rounded-xl border font-mono text-xs sm:text-sm transition-all outline-none ${
            disabled
              ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
              : isFocused
              ? 'bg-emerald-50/20 border-emerald-500 ring-2 ring-emerald-500/20 text-slate-900'
              : 'bg-slate-50/60 border-slate-200 hover:border-slate-300 text-slate-700'
          }`}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />

        {/* Clear & Submit Actions */}
        <div className="absolute right-1.5 sm:right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {inputValue && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 sm:p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
              title="Clear input"
            >
              <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          )}

          <button
            type="submit"
            disabled={disabled || !inputValue.trim()}
            className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-[#0F172A] hover:bg-slate-800 disabled:bg-slate-200 text-white disabled:text-slate-400 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span>Verify</span>
          </button>
        </div>
      </form>

      {/* Footer Info: Format Support & Last Burst Diagnostics */}
      <div className="mt-2.5 flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-slate-500 gap-1 sm:gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-medium text-slate-600">Accepts:</span>
          <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-[10px] text-slate-700">
            2D QR (MNX1_...)
          </span>
          <span className="text-slate-300">•</span>
          <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-[10px] text-slate-700">
            1D Admission Barcode
          </span>
        </div>

        {lastBurstInfo && (
          <div className="flex items-center gap-1 font-mono text-[10px] text-slate-400 self-end sm:self-auto">
            <Zap className={`w-3 h-3 ${lastBurstInfo.isScanner ? 'text-emerald-600' : 'text-slate-400'}`} />
            <span>
              {lastBurstInfo.isScanner ? 'Hardware Scan' : 'Manual Entry'} ({lastBurstInfo.charCount} chars
              {lastBurstInfo.averageIntervalMs > 0 && ` @ ${lastBurstInfo.averageIntervalMs}ms avg`})
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
