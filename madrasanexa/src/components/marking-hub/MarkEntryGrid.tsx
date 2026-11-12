import React, { useState, useEffect, useMemo } from 'react';
import {
  Save,
  Lock,
  Unlock,
  BookOpen,
  AlertCircle,
  CheckCircle2,
  Info,
} from 'lucide-react';
import type { AssessmentMarksResponse } from '../../services/marking-hub.service';
import {
  saveAssessmentMarks,
  finalizeAssessment,
  reopenAssessment,
} from '../../services/marking-hub.service';

interface MarkEntryGridProps {
  data: AssessmentMarksResponse;
  onRefresh: () => Promise<void>;
  onOpenSubjectManager: () => void;
}

export const MarkEntryGrid: React.FC<MarkEntryGridProps> = ({
  data,
  onRefresh,
  onOpenSubjectManager,
}) => {
  const { assessment, subjects, students, results } = data;
  const isFinalized = assessment.status === 'FINALIZED';

  // Local marks state: key is `${studentId}_${assessmentSubjectId}`, value is string (to allow intermediate typing or empty)
  const [localMarks, setLocalMarks] = useState<{ [key: string]: string }>({});
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Modal states
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [isActionPending, setIsActionPending] = useState(false);

  // Initialize local marks from server results
  useEffect(() => {
    const markMap: { [key: string]: string } = {};
    results.forEach((res) => {
      res.subjects.forEach((sub) => {
        const key = `${res.studentId}_${sub.assessmentSubjectId}`;
        markMap[key] = sub.mark !== null && sub.mark !== undefined ? String(sub.mark) : '';
      });
    });
    setLocalMarks(markMap);
    setIsDirty(false);
    setSaveSuccess(false);
    setSaveError(null);
  }, [data]);

  // Handle individual cell change
  const handleMarkChange = (studentId: string, assessmentSubjectId: string, val: string) => {
    if (isFinalized) return;
    const key = `${studentId}_${assessmentSubjectId}`;
    setLocalMarks((prev) => ({
      ...prev,
      [key]: val,
    }));
    setIsDirty(true);
    setSaveSuccess(false);
  };

  // Check cell validation: return error message if invalid
  const getCellError = (valStr: string, maxMark: number): string | null => {
    if (valStr.trim() === '') return null; // blank is valid incomplete
    const n = Number(valStr);
    if (isNaN(n)) return 'Must be a number';
    if (n < 0) return 'Cannot be negative';
    if (n > maxMark) return `Max is ${maxMark}`;
    return null;
  };

  // Has any validation errors
  const hasValidationErrors = useMemo(() => {
    for (const sub of subjects) {
      const max = Number(sub.maxMark);
      for (const st of students) {
        const key = `${st.id}_${sub.id}`;
        const val = localMarks[key] ?? '';
        if (getCellError(val, max) !== null) {
          return true;
        }
      }
    }
    return false;
  }, [localMarks, subjects, students]);

  // Handle Save
  const handleSave = async () => {
    if (isFinalized || hasValidationErrors) return;

    try {
      setIsSaving(true);
      setSaveError(null);
      setSaveSuccess(false);

      const payload: Array<{ studentId: string; assessmentSubjectId: string; mark: number | null }> = [];
      students.forEach((st) => {
        subjects.forEach((sub) => {
          const key = `${st.id}_${sub.id}`;
          const raw = localMarks[key];
          const mark = raw === undefined || raw.trim() === '' ? null : Number(raw);
          payload.push({
            studentId: st.id,
            assessmentSubjectId: sub.id,
            mark,
          });
        });
      });

      await saveAssessmentMarks(assessment.id, payload);
      setIsDirty(false);
      setSaveSuccess(true);
      await onRefresh();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to save marks';
      setSaveError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Finalize
  const handleFinalize = async () => {
    try {
      setIsActionPending(true);
      await finalizeAssessment(assessment.id);
      setShowFinalizeModal(false);
      await onRefresh();
    } catch (err: any) {
      setSaveError(err.response?.data?.message || err.message || 'Failed to finalize');
    } finally {
      setIsActionPending(false);
    }
  };

  // Handle Reopen
  const handleReopen = async () => {
    try {
      setIsActionPending(true);
      await reopenAssessment(assessment.id);
      setShowReopenModal(false);
      await onRefresh();
    } catch (err: any) {
      setSaveError(err.response?.data?.message || err.message || 'Failed to reopen');
    } finally {
      setIsActionPending(false);
    }
  };

  if (subjects.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-stone-200/80 p-12 text-center shadow-xs">
        <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
          <BookOpen className="w-6 h-6" />
        </div>
        <h3 className="text-base font-semibold text-stone-900 mb-1">No Subjects Added Yet</h3>
        <p className="text-xs text-stone-500 max-w-md mx-auto mb-6">
          To begin marking, add one or more subjects to this assessment with their respective maximum and
          passing marks.
        </p>
        <button
          type="button"
          onClick={onOpenSubjectManager}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-xs transition-all cursor-pointer"
        >
          <BookOpen className="w-4 h-4" />
          Manage & Add Subjects
        </button>
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-stone-200/80 p-12 text-center shadow-xs">
        <div className="w-12 h-12 rounded-2xl bg-stone-100 text-stone-400 flex items-center justify-center mx-auto mb-3">
          <Info className="w-6 h-6" />
        </div>
        <h3 className="text-base font-semibold text-stone-900 mb-1">No Students In This Class</h3>
        <p className="text-xs text-stone-500 max-w-md mx-auto">
          There are currently no active students enrolled in this class. Enroll students first in the
          Students module.
        </p>
      </div>
    );
  }

  // Create a quick lookup for student calculation results
  const resultMap = new Map<string, (typeof results)[0]>();
  results.forEach((r) => resultMap.set(r.studentId, r));

  return (
    <div className="space-y-4">
      {/* Top Banner / Toolbar */}
      <div className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Info & Status */}
        <div className="flex flex-wrap items-center gap-3">
          {isFinalized ? (
            <div className="px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              <span>FINALIZED (Read-Only)</span>
            </div>
          ) : (
            <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold flex items-center gap-1.5">
              <Unlock className="w-3.5 h-3.5" />
              <span>DRAFT (Editable)</span>
            </div>
          )}

          {isDirty && !isFinalized && (
            <span className="text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
              Unsaved changes
            </span>
          )}

          {saveSuccess && (
            <span className="text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Saved
            </span>
          )}

          {saveError && (
            <span className="text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> {saveError}
            </span>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenSubjectManager}
            className="px-3.5 py-2 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5"
          >
            <BookOpen className="w-3.5 h-3.5" />
            Manage Subjects ({subjects.length})
          </button>

          {!isFinalized ? (
            <>
              <button
                type="button"
                onClick={handleSave}
                disabled={!isDirty || hasValidationErrors || isSaving}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                {isSaving ? 'Saving...' : 'Save Marks'}
              </button>

              <button
                type="button"
                onClick={() => setShowFinalizeModal(true)}
                className="px-3.5 py-2 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5" />
                Finalize Assessment
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setShowReopenModal(true)}
              className="px-3.5 py-2 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Unlock className="w-3.5 h-3.5" />
              Reopen Assessment
            </button>
          )}
        </div>
      </div>

      {/* Spreadsheet Grid Container */}
      <div className="bg-white rounded-2xl border border-stone-200/80 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              {/* Header Row 1: Student info + Subjects + Summary */}
              <tr className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold uppercase tracking-wider">
                <th className="p-3 md:sticky md:left-0 md:z-20 bg-stone-50 min-w-[60px] border-r border-stone-200">
                  Pos
                </th>
                <th className="p-3 md:sticky md:left-[60px] md:z-20 bg-stone-50 min-w-[100px] border-r border-stone-200">
                  Admission
                </th>
                <th className="p-3 md:sticky md:left-[160px] md:z-20 bg-stone-50 min-w-[180px] border-r border-stone-200 shadow-xs">
                  Student Name
                </th>

                {/* Subject Columns */}
                {subjects.map((sub) => (
                  <th
                    key={sub.id}
                    className="p-3 text-center min-w-[120px] border-r border-stone-200 font-medium"
                  >
                    <div className="font-semibold text-stone-800 truncate" title={sub.subject?.name}>
                      {sub.subject?.name}
                    </div>
                    <div className="text-[10px] text-stone-400 font-normal mt-0.5">
                      Max: {sub.maxMark} | Pass: {sub.passMark}
                    </div>
                  </th>
                ))}

                {/* Calculated Summary Columns */}
                <th className="p-3 text-center min-w-[90px] border-r border-stone-200">Total</th>
                <th className="p-3 text-center min-w-[80px] border-r border-stone-200">Avg %</th>
                <th className="p-3 text-center min-w-[70px] border-r border-stone-200">GPA</th>
                <th className="p-3 text-center min-w-[100px]">Status</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-stone-100 font-normal">
              {students.map((st, sIdx) => {
                const calculated = resultMap.get(st.id);
                const isComplete = calculated?.isComplete ?? false;

                return (
                  <tr
                    key={st.id}
                    className={`hover:bg-stone-50/70 transition-colors ${
                      sIdx % 2 === 1 ? 'bg-stone-50/30' : 'bg-white'
                    }`}
                  >
                    {/* Position */}
                    <td className="p-3 md:sticky md:left-0 md:z-10 bg-inherit font-semibold text-stone-700 border-r border-stone-100 text-center">
                      {calculated?.position ? (
                        <span className="inline-block px-1.5 py-0.5 rounded-md bg-stone-100 text-stone-800 text-[11px] font-bold">
                          #{calculated.position}
                        </span>
                      ) : (
                        <span className="text-stone-300">-</span>
                      )}
                    </td>

                    {/* Admission No */}
                    <td className="p-3 md:sticky md:left-[60px] md:z-10 bg-inherit font-mono text-stone-600 border-r border-stone-100 text-xs">
                      {st.admissionNo}
                    </td>

                    {/* Student Name */}
                    <td className="p-3 md:sticky md:left-[160px] md:z-10 bg-inherit font-medium text-stone-900 border-r border-stone-100 shadow-xs truncate max-w-[200px]">
                      {st.fullName}
                    </td>

                    {/* Subject Mark Inputs */}
                    {subjects.map((sub) => {
                      const key = `${st.id}_${sub.id}`;
                      const rawVal = localMarks[key] ?? '';
                      const max = Number(sub.maxMark);
                      const pass = Number(sub.passMark);
                      const err = getCellError(rawVal, max);
                      const numVal = rawVal.trim() === '' ? null : Number(rawVal);
                      const isFailing = numVal !== null && numVal < pass;

                      return (
                        <td
                          key={sub.id}
                          className={`p-2 border-r border-stone-100 text-center ${
                            err ? 'bg-rose-50/60' : isFailing ? 'bg-amber-50/30' : ''
                          }`}
                        >
                          <input
                            type="text"
                            inputMode="decimal"
                            value={rawVal}
                            disabled={isFinalized}
                            onChange={(e) => handleMarkChange(st.id, sub.id, e.target.value)}
                            placeholder="-"
                            className={`w-16 h-8 text-center rounded-lg font-mono text-xs transition-all ${
                              err
                                ? 'border-2 border-rose-500 bg-white text-rose-700 font-bold focus:outline-hidden'
                                : isFinalized
                                ? 'bg-stone-50 border border-stone-200 text-stone-700 cursor-not-allowed'
                                : isFailing
                                ? 'border border-amber-300 bg-white text-amber-700 focus:outline-hidden focus:ring-1 focus:ring-amber-500'
                                : 'border border-stone-200 bg-white text-stone-800 hover:border-stone-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500'
                            }`}
                            title={err || (isFailing ? `Below pass mark (${pass})` : '')}
                          />
                        </td>
                      );
                    })}

                    {/* Summary: Total */}
                    <td className="p-3 text-center border-r border-stone-100 font-mono text-stone-700 font-medium">
                      {isComplete && calculated && calculated.totalObtained !== null ? (
                        <span>
                          {calculated.totalObtained} / {calculated.maxPossible}
                        </span>
                      ) : (
                        <span className="text-stone-400 italic text-[11px]">-</span>
                      )}
                    </td>

                    {/* Summary: Avg % */}
                    <td className="p-3 text-center border-r border-stone-100 font-semibold text-stone-800">
                      {isComplete && calculated && calculated.overallPercentage !== null ? (
                        `${calculated.overallPercentage.toFixed(2)}%`
                      ) : (
                        <span className="text-stone-300">-</span>
                      )}
                    </td>

                    {/* Summary: GPA */}
                    <td className="p-3 text-center border-r border-stone-100 font-bold text-stone-900">
                      {isComplete && calculated && calculated.gpa !== null ? (
                        calculated.gpa.toFixed(2)
                      ) : (
                        <span className="text-stone-300">-</span>
                      )}
                    </td>

                    {/* Summary: Overall Status */}
                    <td className="p-3 text-center">
                      {!isComplete ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-stone-100 text-stone-600">
                          Incomplete
                        </span>
                      ) : calculated?.overallStatus === 'PASS' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          PASS
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                          FAIL
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Helper Footer */}
        <div className="p-3 bg-stone-50 border-t border-stone-200 text-stone-500 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Pass Mark Achieved
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Below Pass Mark
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-stone-300"></span> Blank (Incomplete)
            </span>
          </div>
          <div className="text-[11px] text-stone-400">
            {students.length} students enrolled &bull; {subjects.length} subjects
          </div>
        </div>
      </div>

      {/* Finalize Confirmation Modal */}
      {showFinalizeModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3 text-blue-600">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold text-stone-900">Finalize Assessment?</h4>
                <p className="text-xs text-stone-500">Locks marks and captures GPA scale snapshot</p>
              </div>
            </div>

            <div className="space-y-2 text-xs text-stone-600 leading-relaxed">
              <p>
                When you finalize this assessment:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-stone-700">
                <li>All mark entry and subject modifications will be <strong>locked</strong>.</li>
                <li>
                  A permanent <strong>GPA scale snapshot</strong> will be frozen. Future GPA setting
                  changes will not affect these results.
                </li>
                <li>Official PDF reports and CSV exports will use the finalized snapshot.</li>
              </ul>
              <p className="text-stone-500 italic mt-2">
                You can reopen this assessment at any time if corrections are required.
              </p>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setShowFinalizeModal(false)}
                disabled={isActionPending}
                className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleFinalize}
                disabled={isActionPending}
                className="px-4.5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                {isActionPending ? 'Finalizing...' : 'Yes, Finalize Assessment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reopen Confirmation Modal */}
      {showReopenModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                <Unlock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold text-stone-900">Reopen Assessment?</h4>
                <p className="text-xs text-stone-500">Unlocks marks for editing</p>
              </div>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              Reopening will allow you to edit student marks and subject configurations again. When you
              are finished making corrections, finalize the assessment again to update the GPA snapshot.
            </p>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setShowReopenModal(false)}
                disabled={isActionPending}
                className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReopen}
                disabled={isActionPending}
                className="px-4.5 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                {isActionPending ? 'Reopening...' : 'Yes, Reopen Assessment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
