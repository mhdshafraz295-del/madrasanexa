/**
 * MadrasaNexa Phase 02 - Step 1.5: Scanner Utilities
 * 
 * Provides:
 * - Token format classification (QR Token vs 1D Admission Barcode vs Unknown)
 * - USB keyboard-wedge keystroke burst timing evaluation
 * - Duplicate scan suppression debouncer
 * - Synthesized Web Audio feedback (zero external audio assets)
 */

export const TOKEN_FORMAT_REGEX = /^MNX1_[a-f0-9]{32}$/;

export type ScanInputType = 'QR_TOKEN' | 'ADMISSION_BARCODE' | 'UNKNOWN';

export interface ClassifiedScan {
  type: ScanInputType;
  raw: string;
  cleaned: string;
  isCryptographic: boolean;
  securityTier: 'TIER_1_SECURE_QR' | 'TIER_2_FALLBACK_1D' | 'UNKNOWN';
}

/**
 * Classifies raw scanner input into 2D cryptographic token or 1D admission number fallback.
 */
export function classifyScanInput(input: string): ClassifiedScan {
  const trimmed = (input || '').trim();

  // 1. Check for canonical MNX1_ prefix + 32 hex chars (case-insensitive tolerance for keyboard CapsLock)
  if (/^MNX1_[a-f0-9]{32}$/i.test(trimmed)) {
    return {
      type: 'QR_TOKEN',
      raw: trimmed,
      cleaned: 'MNX1_' + trimmed.substring(5).toLowerCase(),
      isCryptographic: true,
      securityTier: 'TIER_1_SECURE_QR',
    };
  }

  // 2. Check for 1D Admission Number Barcode (alphanumeric, dashes, underscores, slashes, min 2 chars)
  if (/^[A-Za-z0-9/_-]{2,50}$/.test(trimmed)) {
    return {
      type: 'ADMISSION_BARCODE',
      raw: trimmed,
      cleaned: trimmed,
      isCryptographic: false,
      securityTier: 'TIER_2_FALLBACK_1D',
    };
  }

  return {
    type: 'UNKNOWN',
    raw: trimmed,
    cleaned: trimmed,
    isCryptographic: false,
    securityTier: 'UNKNOWN',
  };
}

/**
 * Determines whether a sequence of keystroke intervals qualifies as a hardware scanner burst.
 * Hardware USB keyboard-wedge scanners typically deliver characters every 5ms - 40ms,
 * whereas human typists typically type with intervals > 80ms - 150ms.
 */
export function isScannerKeystrokeBurst(
  intervals: number[],
  thresholdMs = 40
): { isScanner: boolean; averageIntervalMs: number } {
  if (!intervals || intervals.length < 2) {
    return { isScanner: false, averageIntervalMs: 0 };
  }

  // Exclude initial keypress (first interval may include focus or wake delay)
  const validIntervals = intervals.slice(1);
  const sum = validIntervals.reduce((acc, val) => acc + val, 0);
  const avg = sum / validIntervals.length;

  return {
    isScanner: avg <= thresholdMs,
    averageIntervalMs: Math.round(avg * 10) / 10,
  };
}

/**
 * In-memory scan event debouncer to prevent rapid duplicate processing.
 * Default window is 1.2s (1200ms) per student code to allow rapid consecutive scanning of distinct students.
 */
export class ScanDebouncer {
  private lastScans = new Map<string, number>();
  private readonly windowMs: number;

  constructor(windowMs = 1200) {
    this.windowMs = windowMs;
  }

  /**
   * Checks if the payload is a duplicate within the debounce window.
   * If not, records the scan timestamp.
   */
  isDuplicate(payload: string): boolean {
    const key = payload.trim().toLowerCase();
    const now = Date.now();
    const lastTime = this.lastScans.get(key);

    if (lastTime && now - lastTime < this.windowMs) {
      return true;
    }

    this.lastScans.set(key, now);

    // Garbage collect entries older than 2x window
    if (this.lastScans.size > 50) {
      for (const [k, time] of this.lastScans.entries()) {
        if (now - time > this.windowMs * 2) {
          this.lastScans.delete(k);
        }
      }
    }

    return false;
  }

  clear(): void {
    this.lastScans.clear();
  }
}

/**
 * Synthesizes subtle audio feedback using the Web Audio API and triggers haptic vibration.
 * Never requests external audio files or network requests.
 */
export function playScannerFeedback(
  type: 'success' | 'warning' | 'error' | 'duplicate',
  muted = false
): void {
  // Trigger instant haptic vibration on mobile devices
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      if (type === 'success') {
        navigator.vibrate(80);
      } else if (type === 'warning' || type === 'duplicate') {
        navigator.vibrate([50, 40, 50]);
      } else {
        navigator.vibrate([100, 50, 100]);
      }
    } catch (_) {}
  }

  if (muted || typeof window === 'undefined') return;

  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    if (type === 'success') {
      // Pleasant high double beep
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now); // A5
      osc.frequency.setValueAtTime(1174.66, now + 0.08); // D6
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.start(now);
      osc.stop(now + 0.22);
    } else if (type === 'warning') {
      // Amber warning tone (medium pitch)
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(587.33, now); // D5
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === 'duplicate') {
      // Duplicate alert tone
      osc.type = 'square';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(330, now + 0.1);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    } else {
      // Error low buzz
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now); // A3
      osc.frequency.setValueAtTime(164.81, now + 0.1); // E3
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    }

    setTimeout(() => {
      try {
        ctx.close();
      } catch (_) {}
    }, 500);
  } catch (err) {
    // Graceful degradation if audio context is blocked by autoplay policy
    console.debug('Audio feedback skipped:', err);
  }
}
