import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { X, Loader2, Calendar, Clock, BookOpen, AlertCircle, ArrowRight } from 'lucide-react';
import type { UstadhScheduleItem, Weekday, TeachingStaffType } from '../../services/ustadh.service';
import {
  formatMinutesToTime,
  timeStringToMinutes,
  minutesToTimeString,
} from '../../services/ustadh.service';
import { apiListClasses } from '../../services/api';

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  initialData?: UstadhScheduleItem | null;
  ustadhs: Array<{ id: string; fullName: string; ustadhCode: string; staffType?: TeachingStaffType }>;
  classes?: Array<{ id: string; name: string; code?: string | null }>;
  subjects: Array<{ id: string; name: string; code?: string | null }>;
  isSaving: boolean;
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

export const ScheduleModal: React.FC<ScheduleModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  ustadhs,
  classes: initialClasses = [],
  subjects,
  isSaving,
}) => {
  const [ustadhId, setUstadhId] = useState('');
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState<Weekday>('FRIDAY');
  const [startTime, setStartTime] = useState('16:00');
  const [endTime, setEndTime] = useState('18:00');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [effectiveTo, setEffectiveTo] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Autonomous Class Loading & State
  const [classList, setClassList] = useState<Array<{ id: string; name: string; code?: string | null }>>(
    initialClasses || []
  );
  const [classesLoading, setClassesLoading] = useState(false);
  const [classesError, setClassesError] = useState<string | null>(null);

  const fetchTenantClasses = useCallback(async () => {
    setClassesLoading(true);
    setClassesError(null);
    try {
      const res = await apiListClasses({ pageSize: 100, isActive: true });
      const items = res.classes || res.items || [];
      const mapped = items.map((c: any) => ({
        id: c.id,
        name: c.name,
        code: c.code || null,
      }));
      setClassList(mapped);
      // Preselect if needed and not set
      if (!initialData && mapped.length > 0 && !classId) {
        setClassId(mapped[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load classes in ScheduleModal', err);
      setClassesError('Unable to load classes. Please try again.');
    } finally {
      setClassesLoading(false);
    }
  }, [initialData, classId]);

  // Sync or fetch classes on modal open
  useEffect(() => {
    if (isOpen) {
      if (initialClasses && initialClasses.length > 0) {
        setClassList(initialClasses);
        setClassesLoading(false);
        setClassesError(null);
      } else {
        fetchTenantClasses();
      }
    }
  }, [isOpen, initialClasses, fetchTenantClasses]);

  // Sync form inputs with initialData or defaults
  useEffect(() => {
    if (initialData) {
      setUstadhId(initialData.ustadhId);
      setClassId(initialData.classId);
      setSubjectId(initialData.subjectId);
      setDayOfWeek(initialData.dayOfWeek);
      setStartTime(minutesToTimeString(initialData.startMinutes));
      setEndTime(minutesToTimeString(initialData.endMinutes));
      setEffectiveFrom(initialData.effectiveFrom || '');
      setEffectiveTo(initialData.effectiveTo || '');
    } else {
      setUstadhId(ustadhs[0]?.id || '');
      if (classList.length > 0 && !classId) {
        setClassId(classList[0]?.id || '');
      }
      setSubjectId(subjects[0]?.id || '');
      setDayOfWeek('FRIDAY');
      setStartTime('16:00');
      setEndTime('18:00');
      setEffectiveFrom(new Date().toISOString().slice(0, 10));
      setEffectiveTo('');
    }
    setError(null);
  }, [initialData, isOpen, ustadhs, classList, subjects]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!ustadhId) {
      setError('Please select a Teacher / Ustadh.');
      return;
    }
    if (!classId) {
      setError('Please select a Class.');
      return;
    }
    if (!subjectId) {
      setError('Please select a Subject.');
      return;
    }

    const startMinutes = timeStringToMinutes(startTime);
    const endMinutes = timeStringToMinutes(endTime);

    if (endMinutes <= startMinutes) {
      setError('End time must be strictly after start time.');
      return;
    }

    if (!effectiveFrom) {
      setError('Effective from date is required.');
      return;
    }

    if (effectiveTo && effectiveTo < effectiveFrom) {
      setError('Effective until date must be on or after effective from date.');
      return;
    }

    try {
      await onSave({
        ustadhId,
        classId,
        subjectId,
        dayOfWeek,
        startMinutes,
        endMinutes,
        effectiveFrom,
        effectiveTo: effectiveTo || null,
      });
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to save schedule session.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full border border-stone-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900">
                {initialData ? 'Edit Schedule Session' : 'Add Schedule Session'}
              </h3>
              <p className="text-xs text-stone-500">Configure recurring weekly teaching session</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 p-1.5 rounded-lg hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Teacher / Ustadh Selector */}
            <div className="sm:col-span-2">
              <label htmlFor="schedule-staff-select" className="block font-semibold text-stone-700 mb-1">
                Teacher / Ustadh <span className="text-rose-500">*</span>
              </label>
              <select
                id="schedule-staff-select"
                value={ustadhId}
                onChange={(e) => setUstadhId(e.target.value)}
                disabled={Boolean(initialData)}
                className="w-full h-10 px-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 font-medium disabled:opacity-50"
                required
              >
                <option value="">-- Select Teacher / Ustadh --</option>
                {ustadhs.map((u) => {
                  const typeLabel = u.staffType === 'SCHOOL_TEACHER' ? 'School Teacher' : 'Ustadh';
                  return (
                    <option key={u.id} value={u.id}>
                      {u.fullName} ({u.ustadhCode}) — {typeLabel}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Class */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="schedule-class-select" className="font-semibold text-stone-700 flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5 text-stone-400" />
                  Class <span className="text-rose-500">*</span>
                </label>
                {classesLoading && (
                  <span className="text-[11px] text-stone-400 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Loading...
                  </span>
                )}
              </div>

              {classesLoading ? (
                <select
                  disabled
                  className="w-full h-10 px-3 bg-stone-100 border border-stone-200 rounded-xl text-stone-400 font-medium"
                >
                  <option>Loading classes...</option>
                </select>
              ) : (
                <select
                  id="schedule-class-select"
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                  className="w-full h-10 px-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 font-medium"
                  required
                >
                  <option value="">-- Select Class --</option>
                  {classList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.code ? `(${c.code})` : ''}
                    </option>
                  ))}
                </select>
              )}

              {/* Class Error State */}
              {classesError && (
                <div className="mt-1 flex items-center justify-between text-[11px] text-rose-600 bg-rose-50 px-2 py-1 rounded-lg border border-rose-200">
                  <span>{classesError}</span>
                  <button
                    type="button"
                    onClick={fetchTenantClasses}
                    className="font-bold underline text-blue-600 hover:text-blue-800 ml-2"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Empty Class State */}
              {!classesLoading && !classesError && classList.length === 0 && (
                <div className="mt-1.5 p-2 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800 flex items-center justify-between">
                  <span>No classes available. Please create a class first.</span>
                  <Link
                    to="/madrasa-admin/classes"
                    className="font-bold text-emerald-700 hover:underline flex items-center gap-0.5 ml-2 shrink-0"
                  >
                    Go to Classes <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              )}
            </div>

            {/* Subject */}
            <div>
              <label htmlFor="schedule-subject-select" className="block font-semibold text-stone-700 mb-1 flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5 text-stone-400" />
                Subject <span className="text-rose-500">*</span>
              </label>
              <select
                id="schedule-subject-select"
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="w-full h-10 px-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 font-medium"
                required
              >
                <option value="">-- Select Subject --</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.code ? `(${s.code})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Day of Week */}
            <div className="sm:col-span-2">
              <label htmlFor="schedule-day-select" className="block font-semibold text-stone-700 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-stone-400" />
                Teaching Day <span className="text-rose-500">*</span>
              </label>
              <select
                id="schedule-day-select"
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(e.target.value as Weekday)}
                className="w-full h-10 px-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 font-bold text-emerald-800"
                required
              >
                {WEEKDAYS.map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
            </div>

            {/* Start Time */}
            <div>
              <label htmlFor="schedule-start-time" className="block font-semibold text-stone-700 mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-stone-400" />
                Start Time <span className="text-rose-500">*</span>
              </label>
              <input
                id="schedule-start-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full h-10 px-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 font-semibold"
                required
              />
              <span className="text-[10px] text-stone-400 mt-0.5 block">
                {formatMinutesToTime(timeStringToMinutes(startTime))}
              </span>
            </div>

            {/* End Time */}
            <div>
              <label htmlFor="schedule-end-time" className="block font-semibold text-stone-700 mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-stone-400" />
                End Time <span className="text-rose-500">*</span>
              </label>
              <input
                id="schedule-end-time"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full h-10 px-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 font-semibold"
                required
              />
              <span className="text-[10px] text-stone-400 mt-0.5 block">
                {formatMinutesToTime(timeStringToMinutes(endTime))}
              </span>
            </div>

            {/* Effective From */}
            <div>
              <label htmlFor="schedule-effective-from" className="block font-semibold text-stone-700 mb-1">
                Effective From <span className="text-rose-500">*</span>
              </label>
              <input
                id="schedule-effective-from"
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                className="w-full h-10 px-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
                required
              />
            </div>

            {/* Effective Until */}
            <div>
              <label htmlFor="schedule-effective-to" className="block font-semibold text-stone-700 mb-1">
                Effective Until <span className="text-stone-400 font-normal">(Optional / Ongoing)</span>
              </label>
              <input
                id="schedule-effective-to"
                type="date"
                value={effectiveTo}
                onChange={(e) => setEffectiveTo(e.target.value)}
                className="w-full h-10 px-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
              />
              <span className="text-[10px] text-stone-400 mt-0.5 block">
                {effectiveTo ? `Until ${effectiveTo}` : 'Ongoing (no end date)'}
              </span>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-stone-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-stone-600 hover:text-stone-800 font-medium rounded-xl hover:bg-stone-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || classesLoading}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{initialData ? 'Update Schedule' : 'Add Schedule Session'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
