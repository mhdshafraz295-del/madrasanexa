import { useState, useEffect } from 'react';
import { Clock, Globe, Calendar } from 'lucide-react';
import {
  DEFAULT_TIMEZONE,
  DEFAULT_DATE_FORMAT,
  DEFAULT_TIME_FORMAT,
  getInstitutionalLiveClock,
  type LiveClockSettings,
} from '../../utils/dateTime';
import { apiGetMadrasaSettings } from '../../services/api';

export default function InstitutionalLiveClock() {
  const [settings, setSettings] = useState<LiveClockSettings>({
    timezone: DEFAULT_TIMEZONE,
    dateFormat: DEFAULT_DATE_FORMAT,
    timeFormat: DEFAULT_TIME_FORMAT,
  });

  // Fetch tenant settings once on mount
  useEffect(() => {
    let isMounted = true;
    apiGetMadrasaSettings()
      .then((res) => {
        if (!isMounted || !res?.settings) return;
        setSettings({
          timezone: res.settings.timezone || DEFAULT_TIMEZONE,
          dateFormat: res.settings.dateFormat || DEFAULT_DATE_FORMAT,
          timeFormat: res.settings.timeFormat || DEFAULT_TIME_FORMAT,
        });
      })
      .catch((_err) => {
        // Graceful fallback to default Asia/Colombo and default formats
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Update clock every second
  const [clock, setClock] = useState(() => getInstitutionalLiveClock(settings));

  useEffect(() => {
    // Immediate initial sync when settings arrive
    setClock(getInstitutionalLiveClock(settings));

    const interval = setInterval(() => {
      setClock(getInstitutionalLiveClock(settings));
    }, 1000);

    return () => clearInterval(interval);
  }, [settings]);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-950 via-emerald-900 to-teal-950 text-white p-4 sm:p-5 shadow-md border border-emerald-800/40">
      {/* Background ambient Islamic geometry / glow */}
      <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-emerald-500/15 blur-2xl" />
      <div className="pointer-events-none absolute -left-12 -bottom-12 h-40 w-40 rounded-full bg-amber-500/10 blur-2xl" />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Left: Institutional Clock Status & Date */}
        <div className="space-y-1.5 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
            </span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">
              Institutional Live Time
            </span>
            <span className="text-emerald-500/60">•</span>
            <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-200/90 font-mono">
              <Globe className="w-3 h-3 text-amber-400" />
              <span>{clock.fullTimezoneDisplay}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-baseline gap-2">
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
              {clock.dateString}
            </h2>
            <span className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-0.5 text-[11px] font-mono text-emerald-100 ring-1 ring-inset ring-white/15">
              <Calendar className="w-2.5 h-2.5 text-amber-300" />
              {clock.formattedDate}
            </span>
          </div>
        </div>

        {/* Right: Premium Emerald + Amber Digital Time Display */}
        <div className="flex items-center justify-between md:justify-end gap-3 self-stretch md:self-auto pt-2 md:pt-0 border-t border-emerald-800/60 md:border-t-0">
          <div className="flex items-center gap-2.5 rounded-xl bg-black/25 backdrop-blur-sm px-4 py-2 border border-emerald-500/20 shadow-inner">
            <Clock className="w-5 h-5 text-amber-400 shrink-0" />
            <div className="flex flex-col">
              <span className="font-mono text-2xl sm:text-3xl font-extrabold tracking-wider text-amber-300 drop-shadow-sm tabular-nums">
                {clock.timeString}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
