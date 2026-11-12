import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, BookOpen, AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type {
  AssessmentSubjectItem,
  SubjectItem,
} from '../../services/marking-hub.service';
import {
  fetchSubjects,
  addAssessmentSubject,
  removeAssessmentSubject,
} from '../../services/marking-hub.service';

interface SubjectManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  assessmentId: string;
  isFinalized: boolean;
  existingSubjects: AssessmentSubjectItem[];
  onSubjectsUpdated: () => void;
}

export const SubjectManagerModal: React.FC<SubjectManagerModalProps> = ({
  isOpen,
  onClose,
  assessmentId,
  isFinalized,
  existingSubjects,
  onSubjectsUpdated,
}) => {
  const [allTenantSubjects, setAllTenantSubjects] = useState<SubjectItem[]>([]);
  const [isLoadingTenantSubjects, setIsLoadingTenantSubjects] = useState(false);

  // Add subject mode: 'existing' | 'new'
  const [mode, setMode] = useState<'existing' | 'new'>('existing');

  // Fields for existing
  const [selectedSubjectId, setSelectedSubjectId] = useState('');

  // Fields for new
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectCode, setNewSubjectCode] = useState('');

  // Marks configuration
  const [maxMark, setMaxMark] = useState<number | string>(100);
  const [passMark, setPassMark] = useState<number | string>(40);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Deletion confirmation state
  const [deletingSubject, setDeletingSubject] = useState<AssessmentSubjectItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadTenantSubjects();
      setErrorMessage(null);
      setSuccessMessage(null);
      setSelectedSubjectId('');
      setNewSubjectName('');
      setNewSubjectCode('');
      setMaxMark(100);
      setPassMark(40);
    }
  }, [isOpen]);

  const loadTenantSubjects = async () => {
    try {
      setIsLoadingTenantSubjects(true);
      const data = await fetchSubjects();
      setAllTenantSubjects(data);
    } catch (err: any) {
      console.error('Failed to load subjects', err);
    } finally {
      setIsLoadingTenantSubjects(false);
    }
  };

  if (!isOpen) return null;

  // Filter out subjects already in this assessment
  const existingSubjectIds = new Set(existingSubjects.map((s) => s.subjectId));
  const availableTenantSubjects = allTenantSubjects.filter((s) => !existingSubjectIds.has(s.id));

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const numMax = Number(maxMark);
    const numPass = Number(passMark);

    if (isNaN(numMax) || numMax <= 0) {
      setErrorMessage('Max mark must be a positive number');
      return;
    }
    if (isNaN(numPass) || numPass < 0 || numPass > numMax) {
      setErrorMessage('Pass mark must be between 0 and max mark');
      return;
    }

    try {
      setIsSubmitting(true);
      if (mode === 'existing') {
        if (!selectedSubjectId) {
          setErrorMessage('Please select a subject from the list');
          return;
        }
        await addAssessmentSubject(assessmentId, {
          subjectId: selectedSubjectId,
          maxMark: numMax,
          passMark: numPass,
          sortOrder: existingSubjects.length + 1,
        });
      } else {
        if (!newSubjectName.trim()) {
          setErrorMessage('Please enter a subject name');
          return;
        }
        await addAssessmentSubject(assessmentId, {
          newSubject: {
            name: newSubjectName.trim(),
            code: newSubjectCode.trim() || undefined,
          },
          maxMark: numMax,
          passMark: numPass,
          sortOrder: existingSubjects.length + 1,
        });
      }

      setSuccessMessage('Subject successfully added to assessment');
      setSelectedSubjectId('');
      setNewSubjectName('');
      setNewSubjectCode('');
      await loadTenantSubjects();
      onSubjectsUpdated();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to add subject';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async (force = false) => {
    if (!deletingSubject) return;

    try {
      setIsDeleting(true);
      setErrorMessage(null);
      await removeAssessmentSubject(assessmentId, deletingSubject.subjectId, force);
      setDeletingSubject(null);
      setSuccessMessage('Subject removed from assessment');
      await loadTenantSubjects();
      onSubjectsUpdated();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to remove subject';
      setErrorMessage(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-stone-900">Manage Assessment Subjects</h3>
              <p className="text-xs text-stone-500">Add or configure subjects and their pass criteria</p>
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

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Existing Assessment Subjects List */}
          <div>
            <h4 className="text-xs font-semibold text-stone-600 uppercase tracking-wider mb-2">
              Attached Subjects ({existingSubjects.length})
            </h4>
            {existingSubjects.length === 0 ? (
              <p className="text-xs text-stone-400 italic p-4 bg-stone-50 rounded-xl text-center">
                No subjects have been added to this assessment yet. Add one below.
              </p>
            ) : (
              <div className="divide-y divide-stone-100 border border-stone-200 rounded-xl overflow-hidden">
                {existingSubjects.map((as) => (
                  <div
                    key={as.id}
                    className="p-3 bg-white hover:bg-stone-50/60 flex items-center justify-between gap-2 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-stone-900 flex flex-wrap items-center gap-2">
                        <span className="truncate max-w-full" title={as.subject?.name}>{as.subject?.name}</span>
                        {as.subject?.code && (
                          <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-stone-100 text-stone-600 font-mono">
                            {as.subject.code}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-stone-500 mt-0.5">
                        Max: <strong className="text-stone-700">{as.maxMark}</strong> | Pass:{' '}
                        <strong className="text-stone-700">{as.passMark}</strong>
                      </div>
                    </div>

                    {!isFinalized && (
                      <button
                        type="button"
                        onClick={() => setDeletingSubject(as)}
                        className="text-stone-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors"
                        title="Remove Subject"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add Subject Section */}
          {!isFinalized ? (
            <div className="border-t border-stone-200/80 pt-5">
              <h4 className="text-xs font-semibold text-stone-600 uppercase tracking-wider mb-3">
                Add Subject to Assessment
              </h4>

              {/* Mode Toggle */}
              <div className="flex rounded-xl bg-stone-100 p-1 mb-4 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setMode('existing')}
                  className={`flex-1 py-1.5 rounded-lg transition-all ${
                    mode === 'existing'
                      ? 'bg-white text-stone-900 shadow-xs font-semibold'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  Select Existing Subject
                </button>
                <button
                  type="button"
                  onClick={() => setMode('new')}
                  className={`flex-1 py-1.5 rounded-lg transition-all ${
                    mode === 'new'
                      ? 'bg-white text-stone-900 shadow-xs font-semibold'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  Create New Subject
                </button>
              </div>

              <form onSubmit={handleAddSubject} className="space-y-4">
                {mode === 'existing' ? (
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Choose Subject <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={selectedSubjectId}
                      onChange={(e) => setSelectedSubjectId(e.target.value)}
                      disabled={isLoadingTenantSubjects}
                      className="w-full h-10 px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
                    >
                      <option value="">-- Choose an existing subject --</option>
                      {availableTenantSubjects.map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.name} {sub.code ? `(${sub.code})` : ''}
                        </option>
                      ))}
                    </select>
                    {availableTenantSubjects.length === 0 && !isLoadingTenantSubjects && (
                      <p className="text-[11px] text-stone-400 mt-1">
                        No unused existing subjects found. Switch to "Create New Subject" to add one.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        Subject Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={newSubjectName}
                        onChange={(e) => setNewSubjectName(e.target.value)}
                        placeholder="e.g. Quran Memorization"
                        className="w-full h-10 px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        Code (Optional)
                      </label>
                      <input
                        type="text"
                        value={newSubjectCode}
                        onChange={(e) => setNewSubjectCode(e.target.value)}
                        placeholder="e.g. QRN101"
                        className="w-full h-10 px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
                      />
                    </div>
                  </div>
                )}

                {/* Marks config */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Max Mark <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={maxMark}
                      onChange={(e) => setMaxMark(e.target.value)}
                      placeholder="100"
                      className="w-full h-10 px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Pass Mark <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={passMark}
                      onChange={(e) => setPassMark(e.target.value)}
                      placeholder="40"
                      className="w-full h-10 px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {isSubmitting ? 'Adding...' : 'Add Subject to Assessment'}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs">
              This assessment is finalized and read-only. To modify subjects, reopen the assessment first.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-stone-100 flex items-center justify-end bg-stone-50/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-200/60 rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deletingSubject && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-sm p-5 space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h4 className="font-semibold text-stone-900">Remove Subject?</h4>
            </div>
            <p className="text-xs text-stone-600">
              Are you sure you want to remove <strong>{deletingSubject.subject?.name}</strong> from this
              assessment?
            </p>
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800">
              If student marks exist for this subject, removing it will permanently delete those marks.
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingSubject(null)}
                disabled={isDeleting}
                className="px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleConfirmDelete(true)}
                disabled={isDeleting}
                className="px-3.5 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors shadow-xs"
              >
                {isDeleting ? 'Removing...' : 'Confirm Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
