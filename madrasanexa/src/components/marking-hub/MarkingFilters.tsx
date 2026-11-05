import React from 'react';
import { Plus, Filter, BookOpen, Calendar, Award } from 'lucide-react';
import type { MarkingAssessmentItem } from '../../services/marking-hub.service';

interface MarkingFiltersProps {
  classes: Array<{ id: string; name: string; code?: string | null }>;
  assessments: MarkingAssessmentItem[];
  selectedClassId: string;
  selectedAcademicYear: string;
  selectedTerm: string;
  selectedAssessmentId: string;
  onSelectClassId: (id: string) => void;
  onSelectAcademicYear: (year: string) => void;
  onSelectTerm: (term: string) => void;
  onSelectAssessmentId: (id: string) => void;
  onOpenNewAssessmentModal: () => void;
  isLoadingClasses?: boolean;
  isLoadingAssessments?: boolean;
}

const COMMON_ACADEMIC_YEARS = [
  '2024/2025',
  '2025/2026',
  '2026/2027',
  '2027/2028',
];

const COMMON_TERMS = [
  'Term 1',
  'Term 2',
  'Term 3',
  'Mid-Term Exam',
  'Final Exam',
  'Monthly Assessment',
];

export const MarkingFilters: React.FC<MarkingFiltersProps> = ({
  classes,
  assessments,
  selectedClassId,
  selectedAcademicYear,
  selectedTerm,
  selectedAssessmentId,
  onSelectClassId,
  onSelectAcademicYear,
  onSelectTerm,
  onSelectAssessmentId,
  onOpenNewAssessmentModal,
  isLoadingClasses = false,
  isLoadingAssessments = false,
}) => {
  return (
    <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-xs mb-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Filter controls row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 flex-1">
          {/* Class Selector */}
          <div>
            <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-stone-400" />
              Class
            </label>
            <select
              value={selectedClassId}
              onChange={(e) => onSelectClassId(e.target.value)}
              disabled={isLoadingClasses}
              className="w-full h-10 px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium disabled:opacity-50"
            >
              <option value="">-- Select Class --</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.code ? `(${c.code})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Academic Year Selector */}
          <div>
            <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-stone-400" />
              Academic Year
            </label>
            <select
              value={selectedAcademicYear}
              onChange={(e) => onSelectAcademicYear(e.target.value)}
              className="w-full h-10 px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
            >
              {COMMON_ACADEMIC_YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
              {!COMMON_ACADEMIC_YEARS.includes(selectedAcademicYear) && selectedAcademicYear && (
                <option value={selectedAcademicYear}>{selectedAcademicYear}</option>
              )}
            </select>
          </div>

          {/* Term Selector */}
          <div>
            <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-stone-400" />
              Term / Period
            </label>
            <select
              value={selectedTerm}
              onChange={(e) => onSelectTerm(e.target.value)}
              className="w-full h-10 px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
            >
              {COMMON_TERMS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
              {!COMMON_TERMS.includes(selectedTerm) && selectedTerm && (
                <option value={selectedTerm}>{selectedTerm}</option>
              )}
            </select>
          </div>

          {/* Assessment Selector */}
          <div>
            <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-stone-400" />
              Assessment
            </label>
            <select
              value={selectedAssessmentId}
              onChange={(e) => onSelectAssessmentId(e.target.value)}
              disabled={isLoadingAssessments || !selectedClassId}
              className="w-full h-10 px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium disabled:opacity-50"
            >
              <option value="">
                {isLoadingAssessments
                  ? 'Loading assessments...'
                  : !selectedClassId
                  ? '-- Select Class First --'
                  : assessments.length === 0
                  ? '-- No assessments found --'
                  : '-- Select Assessment --'}
              </option>
              {assessments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.status})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action button */}
        <div className="lg:self-end pt-1">
          <button
            type="button"
            onClick={onOpenNewAssessmentModal}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-xs hover:shadow-md transition-all cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            New Assessment
          </button>
        </div>
      </div>
    </div>
  );
};
