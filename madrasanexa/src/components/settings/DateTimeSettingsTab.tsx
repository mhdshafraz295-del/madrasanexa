import { useState, useEffect } from 'react';
import {
  Clock,
  Globe,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  CalendarDays,
  Timer,
} from 'lucide-react';
import {
  DEFAULT_TIMEZONE,
  DEFAULT_DATE_FORMAT,
  DEFAULT_TIME_FORMAT,
  SUPPORTED_DATE_FORMATS,
  SUPPORTED_TIME_FORMATS,
  WEEKDAYS,
  COMMON_TIMEZONES,
  getInstitutionalLiveClock,
  formatDateOnly,
  formatTime,
} from '../../utils/dateTime';
import { apiUpdateMadrasaSettings, type TenantSettingsData } from '../../services/api';

interface DateTimeSettingsTabProps {
  settingsData: TenantSettingsData | null;
  onSettingsUpdated: (updated: TenantSettingsData) => void;
}

export default function DateTimeSettingsTab({
  settingsData,
  onSettingsUpdated,
}: DateTimeSettingsTabProps) {
  const currentSettings = settingsData?.settings;

  // Form state
  const [timezone, setTimezone] = useState<string>(currentSettings?.timezone || DEFAULT_TIMEZONE);
  const [dateFormat, setDateFormat] = useState<string>(currentSettings?.dateFormat || DEFAULT_DATE_FORMAT);
  const [timeFormat, setTimeFormat] = useState<string>(currentSettings?.timeFormat || DEFAULT_TIME_FORMAT);
  const [workingHoursStart, setWorkingHoursStart] = useState<string>(currentSettings?.workingHoursStart || '07:30');
  const [workingHoursEnd, setWorkingHoursEnd] = useState<string>(currentSettings?.workingHoursEnd || '16:30');
  const [workingDays, setWorkingDays] = useState<string[]>(
    currentSettings?.workingDays || ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']
  );
  const [weeklyHolidays, setWeeklyHolidays] = useState<string[]>(
    currentSettings?.weeklyHolidays || ['SUNDAY']
  );
  const [attendanceStartTime, setAttendanceStartTime] = useState<string>(currentSettings?.attendanceStartTime || '07:30');
  const [attendanceClosingTime, setAttendanceClosingTime] = useState<string>(currentSettings?.attendanceClosingTime || '08:30');
  const [lateMarkingTime, setLateMarkingTime] = useState<string>(currentSettings?.lateMarkingTime || '08:00');
  const [attendanceGracePeriodMinutes, setAttendanceGracePeriodMinutes] = useState<number>(
    currentSettings?.attendanceGracePeriodMinutes ?? 15
  );
  const [autoAttendanceClosing, setAutoAttendanceClosing] = useState<boolean>(
    Boolean(currentSettings?.autoAttendanceClosing)
  );
  const [timetableSlotDurationMinutes, setTimetableSlotDurationMinutes] = useState<number>(
    currentSettings?.timetableSlotDurationMinutes ?? 45
  );

  // Sync state if props change
  useEffect(() => {
    if (currentSettings) {
      setTimezone(currentSettings.timezone || DEFAULT_TIMEZONE);
      setDateFormat(currentSettings.dateFormat || DEFAULT_DATE_FORMAT);
      setTimeFormat(currentSettings.timeFormat || DEFAULT_TIME_FORMAT);
      setWorkingHoursStart(currentSettings.workingHoursStart || '07:30');
      setWorkingHoursEnd(currentSettings.workingHoursEnd || '16:30');
      setWorkingDays(
        currentSettings.workingDays || ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']
      );
      setWeeklyHolidays(currentSettings.weeklyHolidays || ['SUNDAY']);
      setAttendanceStartTime(currentSettings.attendanceStartTime || '07:30');
      setAttendanceClosingTime(currentSettings.attendanceClosingTime || '08:30');
      setLateMarkingTime(currentSettings.lateMarkingTime || '08:00');
      setAttendanceGracePeriodMinutes(currentSettings.attendanceGracePeriodMinutes ?? 15);
      setAutoAttendanceClosing(Boolean(currentSettings.autoAttendanceClosing));
      setTimetableSlotDurationMinutes(currentSettings.timetableSlotDurationMinutes ?? 45);
    }
  }, [currentSettings]);

  // Live ticking clock state
  const [liveClock, setLiveClock] = useState(() => getInstitutionalLiveClock(timezone));

  useEffect(() => {
    const timer = setInterval(() => {
      setLiveClock(getInstitutionalLiveClock(timezone));
    }, 1000);
    return () => clearInterval(timer);
  }, [timezone]);

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Working day toggles
  const toggleWorkingDay = (dayKey: string) => {
    if (workingDays.includes(dayKey)) {
      if (workingDays.length === 1) return; // Must have at least 1 working day
      setWorkingDays(workingDays.filter((d) => d !== dayKey));
    } else {
      setWorkingDays([...workingDays, dayKey]);
      // Remove from holidays if present
      setWeeklyHolidays(weeklyHolidays.filter((d) => d !== dayKey));
    }
  };

  const toggleWeeklyHoliday = (dayKey: string) => {
    if (weeklyHolidays.includes(dayKey)) {
      setWeeklyHolidays(weeklyHolidays.filter((d) => d !== dayKey));
    } else {
      setWeeklyHolidays([...weeklyHolidays, dayKey]);
      // Remove from working days if present
      setWorkingDays(workingDays.filter((d) => d !== dayKey));
    }
  };

  // Reset form to active server settings
  const handleReset = () => {
    if (currentSettings) {
      setTimezone(currentSettings.timezone || DEFAULT_TIMEZONE);
      setDateFormat(currentSettings.dateFormat || DEFAULT_DATE_FORMAT);
      setTimeFormat(currentSettings.timeFormat || DEFAULT_TIME_FORMAT);
      setWorkingHoursStart(currentSettings.workingHoursStart || '07:30');
      setWorkingHoursEnd(currentSettings.workingHoursEnd || '16:30');
      setWorkingDays(
        currentSettings.workingDays || ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']
      );
      setWeeklyHolidays(currentSettings.weeklyHolidays || ['SUNDAY']);
      setAttendanceStartTime(currentSettings.attendanceStartTime || '07:30');
      setAttendanceClosingTime(currentSettings.attendanceClosingTime || '08:30');
      setLateMarkingTime(currentSettings.lateMarkingTime || '08:00');
      setAttendanceGracePeriodMinutes(currentSettings.attendanceGracePeriodMinutes ?? 15);
      setAutoAttendanceClosing(Boolean(currentSettings.autoAttendanceClosing));
      setTimetableSlotDurationMinutes(currentSettings.timetableSlotDurationMinutes ?? 45);
    }
    setSaveSuccess(null);
    setSaveError(null);
  };

  // Save handler
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setSaveSuccess(null);

    // Client-side validations
    if (workingHoursStart >= workingHoursEnd) {
      setSaveError('Working hours end time must be after opening time.');
      return;
    }

    if (attendanceStartTime > lateMarkingTime) {
      setSaveError('Late marking cutoff must be after or equal to attendance start time.');
      return;
    }

    if (lateMarkingTime > attendanceClosingTime) {
      setSaveError('Attendance closing time must be after or equal to late marking cutoff.');
      return;
    }

    setIsSaving(true);
    try {
      const updated = await apiUpdateMadrasaSettings({
        timezone,
        dateFormat,
        timeFormat,
        workingHoursStart,
        workingHoursEnd,
        workingDays,
        weeklyHolidays,
        attendanceStartTime,
        attendanceClosingTime,
        lateMarkingTime,
        attendanceGracePeriodMinutes,
        autoAttendanceClosing,
        timetableSlotDurationMinutes,
      });

      onSettingsUpdated(updated);
      setSaveSuccess('Date & Time settings updated successfully.');
      setTimeout(() => setSaveSuccess(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save date & time settings.';
      setSaveError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  // Sample formatted preview date
  const sampleDate = '2026-10-30';
  const sampleTime = '08:30';

  return (
    <div className="space-y-6">
      {/* Top Banner / Live Clock */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-950 p-6 text-white shadow-xl">
        <div className="absolute right-0 top-0 -mt-10 -mr-10 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-inset ring-emerald-400/30">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
              </span>
              Synchronized Institutional Clock
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Clock className="w-6 h-6 text-amber-400" />
              Institutional Date & Time
            </h2>
            <p className="text-emerald-100/80 text-sm max-w-xl">
              Configure your institution&apos;s timezone, operating hours, attendance cutoffs, and uniform date/time formats across all modules.
            </p>
          </div>

          {/* Clock Display Card */}
          <div className="flex flex-col items-center justify-center rounded-xl bg-white/10 backdrop-blur-md p-4 ring-1 ring-white/20 w-full md:w-auto md:min-w-[240px] text-center shadow-inner">
            <span className="text-3xl font-mono font-extrabold tracking-wider text-amber-300">
              {liveClock.timeString}
            </span>
            <span className="text-sm font-medium text-emerald-100 mt-1">
              {liveClock.dateString}
            </span>
            <span className="text-xs text-emerald-300/80 mt-1 font-mono">
              {liveClock.timezone}
            </span>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {saveSuccess && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 flex items-center gap-3 text-emerald-800 shadow-sm animate-in fade-in duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <p className="text-sm font-medium">{saveSuccess}</p>
        </div>
      )}

      {saveError && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 flex items-center gap-3 text-rose-800 shadow-sm animate-in fade-in duration-200">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <p className="text-sm font-medium">{saveError}</p>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: Timezone & Formats */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 pb-4 mb-4 border-b border-slate-100">
            <Globe className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base font-semibold text-slate-900">Timezone & Display Preferences</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Timezone Selector */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Institutional Timezone
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition"
              >
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">
                Default: Asia/Colombo (Sri Lanka Standard Time, GMT+5:30)
              </p>
            </div>

            {/* Date Format Selector */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Date Display Format
              </label>
              <select
                value={dateFormat}
                onChange={(e) => setDateFormat(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition"
              >
                {SUPPORTED_DATE_FORMATS.map((fmt) => (
                  <option key={fmt.value} value={fmt.value}>
                    {fmt.label} (e.g. {fmt.example})
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">
                Applied to attendance, fees, exams, and reports.
              </p>
            </div>

            {/* Time Format Selector */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Time Display Format
              </label>
              <select
                value={timeFormat}
                onChange={(e) => setTimeFormat(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition"
              >
                {SUPPORTED_TIME_FORMATS.map((tf) => (
                  <option key={tf.value} value={tf.value}>
                    {tf.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">
                12-hour AM/PM or 24-hour standard.
              </p>
            </div>
          </div>

          {/* Interactive Live Preview Pill */}
          <div className="mt-5 rounded-xl bg-slate-50 border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                Live Preview With Selected Formats:
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 font-mono text-sm">
              <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800 font-medium">
                Date: {formatDateOnly(sampleDate, dateFormat)}
              </span>
              <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-amber-100 text-amber-800 font-medium">
                Time: {formatTime(sampleTime, timeFormat, timezone)}
              </span>
            </div>
          </div>
        </div>

        {/* Section 2: Madrasa Working Hours & Working Days */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 pb-4 mb-4 border-b border-slate-100">
            <CalendarDays className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base font-semibold text-slate-900">Institutional Operating Hours & Schedule</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Institution Opening Time
              </label>
              <input
                type="time"
                value={workingHoursStart}
                onChange={(e) => setWorkingHoursStart(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition"
                required
              />
              <p className="text-xs text-slate-500 mt-1">
                Madrasa daily operational opening time.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Institution Closing Time
              </label>
              <input
                type="time"
                value={workingHoursEnd}
                onChange={(e) => setWorkingHoursEnd(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition"
                required
              />
              <p className="text-xs text-slate-500 mt-1">
                Madrasa daily operational closing time.
              </p>
            </div>
          </div>

          {/* Working Days Selector */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Institutional Working Days
            </label>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((day) => {
                const isActive = workingDays.includes(day.key);
                return (
                  <button
                    key={day.key}
                    type="button"
                    onClick={() => toggleWorkingDay(day.key)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                      isActive
                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-slate-500 mt-1.5">
              Select days when academic and administrative sessions operate.
            </p>
          </div>

          {/* Weekly Holidays Selector */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Weekly Holidays
            </label>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((day) => {
                const isHoliday = weeklyHolidays.includes(day.key);
                return (
                  <button
                    key={day.key}
                    type="button"
                    onClick={() => toggleWeeklyHoliday(day.key)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                      isHoliday
                        ? 'bg-amber-600 border-amber-600 text-white shadow-sm'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-slate-500 mt-1.5">
              Designated institutional rest days. Days cannot be both working days and holidays.
            </p>
          </div>
        </div>

        {/* Section 3: Attendance Operational Timings */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 pb-4 mb-4 border-b border-slate-100">
            <Timer className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base font-semibold text-slate-900">Attendance Timings & Automation Configuration</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Attendance Window Start
              </label>
              <input
                type="time"
                value={attendanceStartTime}
                onChange={(e) => setAttendanceStartTime(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition"
                required
              />
              <p className="text-xs text-slate-500 mt-1">
                Time attendance recording starts.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Late Marking Cutoff
              </label>
              <input
                type="time"
                value={lateMarkingTime}
                onChange={(e) => setLateMarkingTime(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition"
                required
              />
              <p className="text-xs text-slate-500 mt-1">
                Arrivals after this time qualify as Late.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Attendance Window Closing
              </label>
              <input
                type="time"
                value={attendanceClosingTime}
                onChange={(e) => setAttendanceClosingTime(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition"
                required
              />
              <p className="text-xs text-slate-500 mt-1">
                Final cutoff time for daily attendance.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Grace Period (Minutes)
              </label>
              <input
                type="number"
                min="0"
                max="120"
                value={attendanceGracePeriodMinutes}
                onChange={(e) => setAttendanceGracePeriodMinutes(parseInt(e.target.value, 10) || 0)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition"
              />
              <p className="text-xs text-slate-500 mt-1">
                Permitted arrival buffer before marking late (0 - 120 minutes).
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Timetable Default Period Slot (Minutes)
              </label>
              <input
                type="number"
                min="15"
                max="120"
                value={timetableSlotDurationMinutes}
                onChange={(e) => setTimetableSlotDurationMinutes(parseInt(e.target.value, 10) || 45)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition"
              />
              <p className="text-xs text-slate-500 mt-1">
                Standard duration for timetable class sessions (e.g. 45 mins).
              </p>
            </div>
          </div>

          {/* Auto attendance closing toggle */}
          <div className="mt-6 pt-6 border-t border-slate-100 flex items-start gap-3">
            <input
              type="checkbox"
              id="autoAttendanceClosing"
              checked={autoAttendanceClosing}
              onChange={(e) => setAutoAttendanceClosing(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <div>
              <label htmlFor="autoAttendanceClosing" className="text-sm font-medium text-slate-800">
                Automatic Attendance Session Closing Preference
              </label>
              <p className="text-xs text-slate-500 mt-0.5">
                Configures institution preference for auto-locking attendance after window close.
                Note: In compliance with institutional safety guidelines, manual attendance workflows remain fully operational.
              </p>
            </div>
          </div>
        </div>

        {/* Section 4: Data Safety Notice & Controls */}
        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 flex items-start gap-3 text-amber-900">
          <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <span className="font-semibold block text-amber-950">Calendar Date Safety & Tenant Isolation</span>
            <p className="text-amber-800/90 leading-relaxed">
              Date-only records (attendance sessions, birthdays, admission dates) are rendered with strict calendar accuracy and zero timezone shifting. Database timestamps remain stored in UTC and are converted on-the-fly to your institution&apos;s timezone.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleReset}
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50 transition"
          >
            <RotateCcw className="w-4 h-4" />
            Reset to Saved
          </button>

          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:opacity-50 transition"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving Changes...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Settings
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
