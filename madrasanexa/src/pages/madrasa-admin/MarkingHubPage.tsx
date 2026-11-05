import { useState, useEffect, useCallback } from 'react';
import {
  FileSpreadsheet,
  Award,
  TrendingUp,
  Sliders,
  AlertCircle,
  Loader2,
  BookOpen,
} from 'lucide-react';
import type {
  MarkingAssessmentItem,
  AssessmentMarksResponse,
} from '../../services/marking-hub.service';
import {
  fetchAssessments,
  fetchAssessmentMarks,
} from '../../services/marking-hub.service';
import { apiListClasses } from '../../services/api';
import { MarkingFilters } from '../../components/marking-hub/MarkingFilters';
import { NewAssessmentModal } from '../../components/marking-hub/NewAssessmentModal';
import { SubjectManagerModal } from '../../components/marking-hub/SubjectManagerModal';
import { MarkEntryGrid } from '../../components/marking-hub/MarkEntryGrid';
import { ResultsTable } from '../../components/marking-hub/ResultsTable';
import { ClassAnalyticsView } from '../../components/marking-hub/ClassAnalyticsView';
import { GpaSettingsPanel } from '../../components/marking-hub/GpaSettingsPanel';

type ActiveTab = 'entry' | 'results' | 'analytics' | 'gpa';

export default function MarkingHubPage() {
  // Classes
  const [classes, setClasses] = useState<Array<{ id: string; name: string; code?: string | null }>>([]);
  const [isLoadingClasses, setIsLoadingClasses] = useState(false);

  // Filters
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedAcademicYear, setSelectedAcademicYear] = useState('2025/2026');
  const [selectedTerm, setSelectedTerm] = useState('Term 1');
  const [selectedAssessmentId, setSelectedAssessmentId] = useState('');

  // Assessments for current filters
  const [assessments, setAssessments] = useState<MarkingAssessmentItem[]>([]);
  const [isLoadingAssessments, setIsLoadingAssessments] = useState(false);

  // Active Assessment Marks Data
  const [assessmentData, setAssessmentData] = useState<AssessmentMarksResponse | null>(null);
  const [isLoadingMarks, setIsLoadingMarks] = useState(false);
  const [marksError, setMarksError] = useState<string | null>(null);

  // Modals & Tabs
  const [activeTab, setActiveTab] = useState<ActiveTab>('entry');
  const [isNewAssessmentModalOpen, setIsNewAssessmentModalOpen] = useState(false);
  const [isSubjectManagerOpen, setIsSubjectManagerOpen] = useState(false);

  // 1. Initial load of classes
  useEffect(() => {
    loadClasses();
  }, []);

  const loadClasses = async () => {
    try {
      setIsLoadingClasses(true);
      const res = await apiListClasses({ pageSize: 100 });
      const items = res.items || res.classes || [];
      setClasses(items);
      if (items.length > 0 && !selectedClassId) {
        setSelectedClassId(items[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load classes', err);
    } finally {
      setIsLoadingClasses(false);
    }
  };

  // 2. Load assessments whenever class, academicYear, or term change
  const loadAssessments = useCallback(async () => {
    if (!selectedClassId) {
      setAssessments([]);
      setSelectedAssessmentId('');
      setAssessmentData(null);
      return;
    }

    try {
      setIsLoadingAssessments(true);
      const list = await fetchAssessments({
        classId: selectedClassId,
        academicYear: selectedAcademicYear,
        term: selectedTerm,
      });
      setAssessments(list);

      // Auto select first or preserve selection
      if (list.length > 0) {
        const stillExists = list.find((a) => a.id === selectedAssessmentId);
        if (stillExists) {
          // keep selected
        } else {
          setSelectedAssessmentId(list[0].id);
        }
      } else {
        setSelectedAssessmentId('');
        setAssessmentData(null);
      }
    } catch (err: any) {
      console.error('Failed to load assessments', err);
    } finally {
      setIsLoadingAssessments(false);
    }
  }, [selectedClassId, selectedAcademicYear, selectedTerm, selectedAssessmentId]);

  useEffect(() => {
    loadAssessments();
  }, [selectedClassId, selectedAcademicYear, selectedTerm]);

  // 3. Load assessment marks whenever selectedAssessmentId changes
  const loadAssessmentMarks = useCallback(async () => {
    if (!selectedAssessmentId) {
      setAssessmentData(null);
      return;
    }

    try {
      setIsLoadingMarks(true);
      setMarksError(null);
      const data = await fetchAssessmentMarks(selectedAssessmentId);
      setAssessmentData(data);
    } catch (err: any) {
      console.error('Failed to load assessment marks', err);
      setMarksError(err.response?.data?.message || 'Failed to load assessment marks');
    } finally {
      setIsLoadingMarks(false);
    }
  }, [selectedAssessmentId]);

  useEffect(() => {
    loadAssessmentMarks();
  }, [selectedAssessmentId]);

  // Handle Assessment Created from modal
  const handleAssessmentCreated = async (newAssessment: MarkingAssessmentItem) => {
    setSelectedClassId(newAssessment.classId);
    setSelectedAcademicYear(newAssessment.academicYear);
    setSelectedTerm(newAssessment.term);
    setSelectedAssessmentId(newAssessment.id);
    await loadAssessments();
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight flex items-center gap-2.5">
            <Award className="w-7 h-7 text-emerald-600" />
            Marking Hub
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 mt-1">
            Class-based numeric marks management, auto GPA calculation, analytics, and official report cards
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <MarkingFilters
        classes={classes}
        assessments={assessments}
        selectedClassId={selectedClassId}
        selectedAcademicYear={selectedAcademicYear}
        selectedTerm={selectedTerm}
        selectedAssessmentId={selectedAssessmentId}
        onSelectClassId={setSelectedClassId}
        onSelectAcademicYear={setSelectedAcademicYear}
        onSelectTerm={setSelectedTerm}
        onSelectAssessmentId={setSelectedAssessmentId}
        onOpenNewAssessmentModal={() => setIsNewAssessmentModalOpen(true)}
        isLoadingClasses={isLoadingClasses}
        isLoadingAssessments={isLoadingAssessments}
      />

      {/* Navigation Tabs */}
      <div className="flex border-b border-stone-200 gap-2 sm:gap-4 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('entry')}
          className={`flex items-center gap-2 py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'entry'
              ? 'border-emerald-600 text-emerald-700 bg-emerald-50/40 rounded-t-xl'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          Mark Entry
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('results')}
          disabled={!assessmentData}
          className={`flex items-center gap-2 py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed ${
            activeTab === 'results'
              ? 'border-emerald-600 text-emerald-700 bg-emerald-50/40 rounded-t-xl'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <Award className="w-4 h-4" />
          Results & Exports
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('analytics')}
          disabled={!assessmentData}
          className={`flex items-center gap-2 py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed ${
            activeTab === 'analytics'
              ? 'border-emerald-600 text-emerald-700 bg-emerald-50/40 rounded-t-xl'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Class Analytics
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('gpa')}
          className={`flex items-center gap-2 py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'gpa'
              ? 'border-emerald-600 text-emerald-700 bg-emerald-50/40 rounded-t-xl'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <Sliders className="w-4 h-4" />
          GPA Settings
        </button>
      </div>

      {/* Main Tab Content */}
      {activeTab === 'gpa' ? (
        <GpaSettingsPanel />
      ) : isLoadingMarks ? (
        <div className="bg-white rounded-2xl border border-stone-200/80 p-16 text-center shadow-xs">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-3" />
          <p className="text-xs text-stone-500 font-medium">Loading assessment and student marks...</p>
        </div>
      ) : marksError ? (
        <div className="bg-white rounded-2xl border border-rose-200 p-8 text-center shadow-xs">
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
          <h3 className="font-semibold text-rose-800 text-sm">Error Loading Assessment</h3>
          <p className="text-xs text-rose-600 mt-1 mb-4">{marksError}</p>
          <button
            type="button"
            onClick={loadAssessmentMarks}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-xs"
          >
            Retry
          </button>
        </div>
      ) : !selectedAssessmentId || !assessmentData ? (
        <div className="bg-white rounded-2xl border border-stone-200/80 p-16 text-center shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-stone-100 text-stone-400 flex items-center justify-center mx-auto mb-3">
            <BookOpen className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-stone-900 mb-1">No Assessment Selected</h3>
          <p className="text-xs text-stone-500 max-w-sm mx-auto mb-5">
            Select a class, academic year, and assessment from the filter bar above, or create a new
            assessment.
          </p>
          <button
            type="button"
            onClick={() => setIsNewAssessmentModalOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer"
          >
            Create New Assessment
          </button>
        </div>
      ) : (
        <>
          {activeTab === 'entry' && (
            <MarkEntryGrid
              data={assessmentData}
              onRefresh={loadAssessmentMarks}
              onOpenSubjectManager={() => setIsSubjectManagerOpen(true)}
            />
          )}

          {activeTab === 'results' && <ResultsTable data={assessmentData} />}

          {activeTab === 'analytics' && (
            <ClassAnalyticsView analytics={assessmentData.analytics} />
          )}
        </>
      )}

      {/* New Assessment Modal */}
      <NewAssessmentModal
        isOpen={isNewAssessmentModalOpen}
        onClose={() => setIsNewAssessmentModalOpen(false)}
        onAssessmentCreated={handleAssessmentCreated}
        classes={classes}
        defaultClassId={selectedClassId}
        defaultAcademicYear={selectedAcademicYear}
        defaultTerm={selectedTerm}
      />

      {/* Subject Manager Modal */}
      {assessmentData && (
        <SubjectManagerModal
          isOpen={isSubjectManagerOpen}
          onClose={() => setIsSubjectManagerOpen(false)}
          assessmentId={assessmentData.assessment.id}
          isFinalized={assessmentData.assessment.status === 'FINALIZED'}
          existingSubjects={assessmentData.subjects}
          onSubjectsUpdated={loadAssessmentMarks}
        />
      )}
    </div>
  );
}
