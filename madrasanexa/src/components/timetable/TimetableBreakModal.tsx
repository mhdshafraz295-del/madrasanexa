import React, { useState, useEffect } from 'react';
import { X, Loader2, Coffee, AlertCircle } from 'lucide-react';
import type { Weekday } from '../../services/ustadh.service';
import {
  formatMinutesToInputTime,
  parseTimeStringToMinutes,
  type TimetableBreakItem,
} from '../../services/timetable.service';

interface TimetableBreakModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    classId: string;
    name: string;
    dayOfWeek: Weekday;
    startMinutes: number;
    endMinutes: number;
    effectiveFrom: string;
    effectiveTo?: string | null;
    isActive?: boolean;
  }) => Promise<void>;
  initialData?: TimetableBreakItem | null;
  classes: Array<{ id: string; name: string; code?: string | null }>;
  isSaving: boolean;
  defaultClassId?: string;
}

const WEEKDAYS: Weekday[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];

export const TimetableBreakModal: React.FC<TimetableBreakModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  classes,
  isSaving,
  defaultClassId,
}) => {
  const [classId, setClassId] = useState('');
  const [name, setName] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState<Weekday>('MONDAY');
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('10:30');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [effectiveTo, setEffectiveTo] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (initialData) {
      setClassId(initialData.classId || '');
      setName(initialData.name || '');
      setDayOfWeek(initialData.dayOfWeek || 'MONDAY');
      setStartTime(formatMinutesToInputTime(initialData.startMinutes));
      setEndTime(formatMinutesToInputTime(initialData.endMinutes));
      setEffectiveFrom(initialData.effectiveFrom || '');
      setEffectiveTo(initialData.effectiveTo || '');
      setIsActive(initialData.isActive ?? true);
    } else {
      setClassId(defaultClassId || (classes.length > 0 ? classes[0].id : ''));
      setName('');
      setDayOfWeek('MONDAY');
      setStartTime('10:00');
      setEndTime('10:30');
      const today = new Date().toISOString().split('T')[0];
      setEffectiveFrom(today);
      setEffectiveTo('');
      setIsActive(true);
    }
    setError(null);
  }, [isOpen, initialData, defaultClassId, classes]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!classId) {
      setError('Please select a class.');
      return;
    }

    if (!name.trim()) {
      setError('Please provide a name for this break / interval.');
      return;
    }

    const startMinutes = parseTimeStringToMinutes(startTime);
    const endMinutes = parseTimeStringToMinutes(endTime);

    if (endMinutes <= startMinutes) {
      setError('End time must be strictly after start time.');
      return;
    }

    if (!effectiveFrom) {
      setError('Effective From date is required.');
      return;
    }

    if (effectiveTo && new Date(effectiveTo) < new Date(effectiveFrom)) {
      setError('Effective Until cannot be before Effective From.');
      return;
    }

    try {
      await onSave({
        classId,
        name: name.trim(),
        dayOfWeek,
        startMinutes,
        endMinutes,
        effectiveFrom,
        effectiveTo: effectiveTo || null,
        isActive,
      });
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to save interval/break.';
      setError(msg);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100 transform transition-all">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
              <Coffee className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                {initialData ? 'Edit Timetable Break' : 'Add Interval / Prayer Break'}
              </h2>
              <p className="text-xs text-slate-500">
                Manage recurring intervals, tea breaks, and prayer sessions
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="mx-6 mt-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-700 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="leading-relaxed">{error}</div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Class <span className="text-rose-500">*</span>
            </label>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              required
            >
              <option value="">-- Select Class --</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.code ? `(${c.code})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Interval / Break Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Morning Interval, Zuhr Prayer Break, Lunch"
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Day <span className="text-rose-500">*</span>
              </label>
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(e.target.value as Weekday)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              >
                {WEEKDAYS.map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Start Time <span className="text-rose-500">*</span>
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                End Time <span className="text-rose-500">*</span>
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Effective From <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Effective Until
              </label>
              <input
                type="date"
                value={effectiveTo}
                onChange={(e) => setEffectiveTo(e.target.value)}
                placeholder="Indefinite if empty"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>
          </div>

          {initialData && (
            <div className="pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 h-4 w-4"
                />
                <span className="text-sm font-medium text-slate-700">Active Break Status</span>
              </label>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 shadow-sm"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{initialData ? 'Update Break' : 'Save Break'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
