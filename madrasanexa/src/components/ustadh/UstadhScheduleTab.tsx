import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Plus,
  Edit2,
  Trash2,
  Filter,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import {
  listSchedules,
  deleteSchedule,
  formatMinutesToTime,
  type UstadhScheduleItem,
  type Weekday,
} from '../../services/ustadh.service';
import { formatDateOnly } from '../../utils/dateTime';

interface UstadhScheduleTabProps {
  onAddSchedule: () => void;
  onEditSchedule: (schedule: UstadhScheduleItem) => void;
  initialUstadhId?: string;
  ustadhsList: Array<{ id: string; fullName: string; ustadhCode: string; staffType?: any }>;
  classesList: Array<{ id: string; name: string; code?: string | null }>;
  subjectsList: Array<{ id: string; name: string; code?: string | null }>;
  refreshKey: number;
}

const WEEKDAYS: Array<{ value: Weekday; label: string }> = [
  { value: 'MONDAY', label: 'Monday' },
  { value: 'TUESDAY', label: 'Tuesday' },
  { value: 'WEDNESDAY', label: 'Wednesday' },
  { value: 'THURSDAY', label: 'Thursday' },
  { value: 'FRIDAY', label: 'Friday' },
  { value: 'SATURDAY', label: 'Saturday' },
  { value: 'SUNDAY', label: 'Sunday' },
];

export const UstadhScheduleTab: React.FC<UstadhScheduleTabProps> = ({
  onAddSchedule,
  onEditSchedule,
  initialUstadhId,
  ustadhsList,
  classesList,
  refreshKey,
}) => {
  const [schedules, setSchedules] = useState<UstadhScheduleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Filters
  const [selectedUstadhId, setSelectedUstadhId] = useState<string>(initialUstadhId || '');
  const [selectedDay, setSelectedDay] = useState<Weekday | ''>('');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [activeOnly, setActiveOnly] = useState<boolean>(true);

  // Sync initialUstadhId when changed from parent
  useEffect(() => {
    if (initialUstadhId) {
      setSelectedUstadhId(initialUstadhId);
    }
  }, [initialUstadhId]);

  const fetchSchedules = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listSchedules({
        ustadhId: selectedUstadhId || undefined,
        dayOfWeek: selectedDay || undefined,
        classId: selectedClassId || undefined,
        isActive: activeOnly ? true : undefined,
      });
      setSchedules(res.items);
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Failed to load schedules');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, [selectedUstadhId, selectedDay, selectedClassId, activeOnly, refreshKey]);

  const handleDelete = async (schedule: UstadhScheduleItem) => {
    const confirmText = `Are you sure you want to remove this schedule slot for ${schedule.ustadh?.fullName || 'this Ustadh'} (${schedule.dayOfWeek} ${formatMinutesToTime(schedule.startMinutes)} - ${formatMinutesToTime(schedule.endMinutes)})?\n\nIf attendance was already recorded for this slot, it will be safely deactivated to preserve historical records.`;
    if (!window.confirm(confirmText)) return;

    try {
      const res = await deleteSchedule(schedule.id);
      setActionSuccess(res.message || 'Schedule removed successfully');
      setTimeout(() => setActionSuccess(null), 4000);
      fetchSchedules();
    } catch (err: any) {
      alert(err?.response?.data?.message || err.message || 'Failed to remove schedule');
    }
  };

  // Group schedules by day of week for clean weekly calendar overview
  const groupedByDay = WEEKDAYS.map((day) => ({
    ...day,
    slots: schedules.filter((s) => s.dayOfWeek === day.value),
  }));

  return (
    <div className="space-y-6">
      {/* Top Filter and Actions Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <h3 className="font-semibold text-slate-800 text-sm">Schedule Filters</h3>
          </div>
          <button
            type="button"
            onClick={onAddSchedule}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Add Teaching Slot</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-sm">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Teacher / Ustadh</label>
            <select
              value={selectedUstadhId}
              onChange={(e) => setSelectedUstadhId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">All Teachers & Ustadhs</option>
              {ustadhsList.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName} ({u.ustadhCode}){u.staffType === 'SCHOOL_TEACHER' ? ' — Teacher' : ' — Ustadh'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Weekday</label>
            <select
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value as Weekday | '')}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">All Days</option>
              {WEEKDAYS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Class</label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">All Classes</option>
              {classesList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.code ? `(${c.code})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer pb-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={activeOnly}
                onChange={(e) => setActiveOnly(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
              />
              <span>Active slots only</span>
            </label>
          </div>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-3 text-emerald-800 text-sm">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {/* Weekday Breakdown View */}
      {loading ? (
        <div className="bg-white p-12 border border-slate-200 rounded-xl text-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-600 mb-2" />
          <span>Loading schedules...</span>
        </div>
      ) : schedules.length === 0 ? (
        <div className="bg-white p-12 border border-slate-200 rounded-xl text-center text-slate-500">
          <Calendar className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <h4 className="font-semibold text-slate-700 mb-1">No Schedules Found</h4>
          <p className="text-sm text-slate-500 max-w-md mx-auto mb-4">
            No teaching sessions match the current filter. Add a teaching slot to assign Ustadhs to classes.
          </p>
          <button
            type="button"
            onClick={onAddSchedule}
            className="px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
          >
            Add First Teaching Slot
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {groupedByDay
            .filter((day) => !selectedDay || day.value === selectedDay)
            .map((dayGroup) => (
              <div
                key={dayGroup.value}
                className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col"
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        dayGroup.value === 'FRIDAY' || dayGroup.value === 'SATURDAY'
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                    />
                    <h4 className="font-bold text-slate-900 text-sm">{dayGroup.label}</h4>
                  </div>
                  <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full font-medium">
                    {dayGroup.slots.length} {dayGroup.slots.length === 1 ? 'slot' : 'slots'}
                  </span>
                </div>

                <div className="space-y-3 flex-1 overflow-y-auto max-h-[500px]">
                  {dayGroup.slots.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400 italic">
                      No sessions scheduled
                    </div>
                  ) : (
                    dayGroup.slots.map((s) => (
                      <div
                        key={s.id}
                        className={`p-3 rounded-lg border text-xs transition-all ${
                          s.isActive
                            ? 'bg-slate-50/80 border-slate-200 hover:border-emerald-300'
                            : 'bg-slate-100/60 border-slate-200 opacity-60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-slate-900 text-sm">
                              {s.ustadh?.fullName || 'Staff'}
                            </span>
                            {s.ustadh?.staffType && (
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase ${
                                  s.ustadh.staffType === 'SCHOOL_TEACHER'
                                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                }`}
                              >
                                {s.ustadh.staffType === 'SCHOOL_TEACHER' ? 'Teacher' : 'Ustadh'}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onEditSchedule(s)}
                              className="p-1 text-slate-400 hover:text-emerald-700 rounded transition-colors"
                              title="Edit Schedule"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(s)}
                              className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                              title="Remove / Deactivate"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 text-emerald-800 font-medium mb-1">
                          <Clock className="w-3.5 h-3.5 text-emerald-600" />
                          <span>
                            {formatMinutesToTime(s.startMinutes)} – {formatMinutesToTime(s.endMinutes)}
                          </span>
                        </div>

                        <div className="space-y-0.5 text-slate-600">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-slate-500">Class:</span>
                            <span className="text-slate-800">{s.class?.name || 'Unknown'}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-slate-500">Subject:</span>
                            <span className="text-slate-800">{s.subject?.name || 'Unknown'}</span>
                          </div>
                        </div>

                        <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-400">
                          <span>From: {formatDateOnly(s.effectiveFrom)}</span>
                          {s.effectiveTo ? (
                            <span>To: {formatDateOnly(s.effectiveTo)}</span>
                          ) : (
                            <span className="text-emerald-600 font-medium">Ongoing</span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
};
