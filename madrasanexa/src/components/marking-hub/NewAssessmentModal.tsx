import React, { useState } from 'react';
import { X, Award, AlertCircle } from 'lucide-react';
import type { MarkingAssessmentItem } from '../../services/marking-hub.service';
import { createAssessment } from '../../services/marking-hub.service';

interface NewAssessmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAssessmentCreated: (assessment: MarkingAssessmentItem) => void;
  classes: Array<{ id: string; name: string; code?: string | null }>;
  defaultClassId?: string;
  defaultAcademicYear?: string;
  defaultTerm?: string;
}

export const NewAssessmentModal: React.FC<NewAssessmentModalProps> = ({
  isOpen,
  onClose,
  onAssessmentCreated,
  classes,
  defaultClassId = '',
  defaultAcademicYear = '2025/2026',
  defaultTerm = 'Term 1',
}) => {
  const [classId, setClassId] = useState(defaultClassId);
  const [academicYear, setAcademicYear] = useState(defaultAcademicYear);
  const [term, setTerm] = useState(defaultTerm);
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync defaults when modal opens
  React.useEffect(() => {
    if (isOpen) {
      if (defaultClassId) setClassId(defaultClassId);
      if (defaultAcademicYear) setAcademicYear(defaultAcademicYear);
      if (defaultTerm) setTerm(defaultTerm);
      setName('');
      setErrorMessage(null);
    }
  }, [isOpen, defaultClassId, defaultAcademicYear, defaultTerm]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classId) {
      setErrorMessage('Please select a class');
      return;
    }
    if (!name.trim()) {
      setErrorMessage('Please enter an assessment name');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      const created = await createAssessment({
        classId,
        academicYear,
        term,
        name: name.trim(),
      });
      onAssessmentCreated(created);
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to create assessment';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl border border-stone-200 w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-stone-900">Create New Assessment</h3>
              <p className="text-xs text-stone-500">Add an exam or term assessment for marking</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 rounded-lg p-1.5 hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Class <span className="text-rose-500">*</span>
            </label>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              required
              className="w-full h-10 px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
            >
              <option value="">-- Select Class --</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.code ? `(${c.code})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Academic Year <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                placeholder="e.g. 2025/2026"
                required
                className="w-full h-10 px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Term / Period <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="e.g. Term 1"
                required
                className="w-full h-10 px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Assessment Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Term 1 Examination 2025/2026"
              required
              className="w-full h-10 px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
            />
          </div>

          <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-stone-600 hover:text-stone-800 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? 'Creating...' : 'Create Assessment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
