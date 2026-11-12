import { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Users,
  GraduationCap,
  Layers,
  Loader2,
  AlertCircle,
  Coffee,
  FileCheck,
} from 'lucide-react';
import { apiListClasses } from '../../services/api';
import { listUstadhs } from '../../services/ustadh.service';
import {
  getClassTimetable,
  getStaffTimetable,
  getFullTimetable,
  createBreak,
  updateBreak,
  deleteBreak,
  downloadClassTimetablePdf,
  downloadStaffTimetablePdf,
  downloadFullTimetablePdf,
  type TimetableEntry,
  type TimetableBreakItem,
} from '../../services/timetable.service';
import { ClassTimetableView } from '../../components/timetable/ClassTimetableView';
import { StaffTimetableView } from '../../components/timetable/StaffTimetableView';
import { FullTimetableView } from '../../components/timetable/FullTimetableView';
import { TimetableBreakModal } from '../../components/timetable/TimetableBreakModal';
import TimetableFinalizeModal from '../../components/timetable/TimetableFinalizeModal';

type TimetableTab = 'class' | 'staff' | 'full';

export default function TimetablePage() {
  const [activeTab, setActiveTab] = useState<TimetableTab>('class');
  const [referenceDate, setReferenceDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  // Reference lists
  const [classesList, setClassesList] = useState<Array<{ id: string; name: string; code?: string | null }>>([]);
  const [staffList, setStaffList] = useState<Array<{ id: string; fullName: string; ustadhCode: string; staffType?: any }>>([]);
  const [initialLoading, setInitialLoading] = useState(true);

  // Tab selections
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [staffTypeFilter, setStaffTypeFilter] = useState<string>('ALL');

  // Timetable Entries state
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [isLoadingEntries, setIsLoadingEntries] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Break Modal state
  const [isBreakModalOpen, setIsBreakModalOpen] = useState(false);
  const [selectedBreakForEdit, setSelectedBreakForEdit] = useState<TimetableBreakItem | null>(null);
  const [isSavingBreak, setIsSavingBreak] = useState(false);

  // Finalize Modal state
  const [isFinalizeModalOpen, setIsFinalizeModalOpen] = useState(false);
  const [finalizeSuccessMessage, setFinalizeSuccessMessage] = useState<string | null>(null);

  // 1. Initial Load: fetch classes and staff
  useEffect(() => {
    let mounted = true;
    async function loadReferences() {
      try {
        const [clsRes, staffRes] = await Promise.allSettled([
          apiListClasses({ pageSize: 100, isActive: true }),
          listUstadhs({ pageSize: 100, isActive: true }),
        ]);

        if (mounted) {
          if (clsRes.status === 'fulfilled') {
            const list = clsRes.value.classes || clsRes.value.items || [];
            const mapped = list.map((c: any) => ({ id: c.id, name: c.name, code: c.code }));
            setClassesList(mapped);
            if (mapped.length > 0 && !selectedClassId) {
              setSelectedClassId(mapped[0].id);
            }
          }

          if (staffRes.status === 'fulfilled') {
            const list = staffRes.value.items || [];
            setStaffList(
              list.map((u) => ({
                id: u.id,
                fullName: u.fullName,
                ustadhCode: u.ustadhCode,
                staffType: u.staffType,
              }))
            );
          }
        }
      } catch (err) {
        console.error('Failed to load timetable references', err);
      } finally {
        if (mounted) setInitialLoading(false);
      }
    }

    loadReferences();
    return () => {
      mounted = false;
    };
  }, []);

  // 2. Fetch Entries based on activeTab
  const fetchTimetableEntries = useCallback(async () => {
    setError(null);
    setIsLoadingEntries(true);
    try {
      if (activeTab === 'class') {
        if (!selectedClassId) {
          setEntries([]);
          return;
        }
        const res = await getClassTimetable({
          classId: selectedClassId,
          referenceDate,
        });
        setEntries(res.items || []);
      } else if (activeTab === 'staff') {
        const res = await getStaffTimetable({
          ustadhId: selectedStaffId || undefined,
          staffType: staffTypeFilter !== 'ALL' ? (staffTypeFilter as any) : undefined,
          referenceDate,
        });
        setEntries(res.items || []);
      } else if (activeTab === 'full') {
        const res = await getFullTimetable({
          referenceDate,
        });
        setEntries(res.items || []);
      }
    } catch (err: any) {
      console.error('Failed to fetch timetable data', err);
      setError(err.response?.data?.message || err.message || 'Failed to load timetable data.');
      setEntries([]);
    } finally {
      setIsLoadingEntries(false);
    }
  }, [activeTab, selectedClassId, selectedStaffId, staffTypeFilter, referenceDate]);

  useEffect(() => {
    if (!initialLoading) {
      fetchTimetableEntries();
    }
  }, [fetchTimetableEntries, initialLoading]);

  // PDF Export Handlers
  const handleDownloadClassPdf = async () => {
    if (!selectedClassId) return;
    setIsDownloadingPdf(true);
    try {
      const cls = classesList.find((c) => c.id === selectedClassId);
      const safeName = cls?.name?.replace(/[^a-zA-Z0-9_-]/g, '_') || selectedClassId;
      await downloadClassTimetablePdf(selectedClassId, referenceDate, `Timetable_${safeName}.pdf`);
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Failed to download Class Timetable PDF.');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleDownloadStaffPdf = async () => {
    setIsDownloadingPdf(true);
    try {
      await downloadStaffTimetablePdf(
        {
          ustadhId: selectedStaffId || undefined,
          staffType: staffTypeFilter !== 'ALL' ? (staffTypeFilter as any) : undefined,
          referenceDate,
        },
        'Staff_Weekly_Timetable.pdf'
      );
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Failed to download Staff Timetable PDF.');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleDownloadFullPdf = async () => {
    setIsDownloadingPdf(true);
    try {
      await downloadFullTimetablePdf(referenceDate, `Master_Timetable_${referenceDate}.pdf`);
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Failed to download Master Timetable PDF.');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // Break CRUD Handlers
  const handleOpenAddBreak = () => {
    setSelectedBreakForEdit(null);
    setIsBreakModalOpen(true);
  };

  const handleOpenEditBreak = (breakItem: TimetableBreakItem) => {
    setSelectedBreakForEdit(breakItem);
    setIsBreakModalOpen(true);
  };

  const handleSaveBreak = async (data: any) => {
    setIsSavingBreak(true);
    try {
      if (selectedBreakForEdit) {
        await updateBreak(selectedBreakForEdit.id, data);
      } else {
        await createBreak(data);
      }
      setIsBreakModalOpen(false);
      await fetchTimetableEntries();
    } finally {
      setIsSavingBreak(false);
    }
  };

  const handleDeleteBreak = async (breakId: string) => {
    if (!window.confirm('Are you sure you want to deactivate/close this interval/break?')) {
      return;
    }
    try {
      await deleteBreak(breakId);
      await fetchTimetableEntries();
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Failed to deactivate break.');
    }
  };

  if (initialLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mb-3" />
        <p className="text-sm font-medium text-slate-600">Loading Timetable workspace...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Weekly Timetable</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Unified schedule management: Class timetables, Teaching staff schedules, and Master view with Interval & Prayer breaks.
            </p>
          </div>
        </div>

        {/* Global Quick Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleOpenAddBreak}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm cursor-pointer"
          >
            <Coffee className="w-4 h-4" />
            <span>Add Interval / Break</span>
          </button>
          <button
            type="button"
            onClick={() => setIsFinalizeModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#0F172A] hover:bg-[#1E293B] text-white rounded-xl text-sm font-semibold transition-colors shadow-sm cursor-pointer"
          >
            <FileCheck className="w-4 h-4 text-[#37C6A3]" />
            <span>Finalize Timetable</span>
          </button>
        </div>
      </div>

      {finalizeSuccessMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 text-sm">
          <FileCheck className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{finalizeSuccessMessage}</span>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-700 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Timetable Notice: </span>
            {error}
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-px">
        <button
          type="button"
          onClick={() => setActiveTab('class')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'class'
              ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50 rounded-t-lg'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          <span>Class Timetable</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('staff')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'staff'
              ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50 rounded-t-lg'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Staff Timetable</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('full')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'full'
              ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50 rounded-t-lg'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Full Master Timetable</span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'class' && (
        <ClassTimetableView
          classes={classesList}
          selectedClassId={selectedClassId}
          onSelectClassId={setSelectedClassId}
          referenceDate={referenceDate}
          onChangeReferenceDate={setReferenceDate}
          entries={entries}
          isLoading={isLoadingEntries}
          onDownloadPdf={handleDownloadClassPdf}
          isDownloadingPdf={isDownloadingPdf}
          onOpenAddBreak={handleOpenAddBreak}
          onEditBreak={handleOpenEditBreak}
          onDeleteBreak={handleDeleteBreak}
        />
      )}

      {activeTab === 'staff' && (
        <StaffTimetableView
          staffList={staffList}
          selectedStaffId={selectedStaffId}
          onSelectStaffId={setSelectedStaffId}
          staffTypeFilter={staffTypeFilter}
          onChangeStaffTypeFilter={setStaffTypeFilter}
          referenceDate={referenceDate}
          onChangeReferenceDate={setReferenceDate}
          entries={entries}
          isLoading={isLoadingEntries}
          onDownloadPdf={handleDownloadStaffPdf}
          isDownloadingPdf={isDownloadingPdf}
        />
      )}

      {activeTab === 'full' && (
        <FullTimetableView
          referenceDate={referenceDate}
          onChangeReferenceDate={setReferenceDate}
          entries={entries}
          isLoading={isLoadingEntries}
          onDownloadPdf={handleDownloadFullPdf}
          isDownloadingPdf={isDownloadingPdf}
        />
      )}

      {/* Break Creation & Edit Modal */}
      <TimetableBreakModal
        isOpen={isBreakModalOpen}
        onClose={() => setIsBreakModalOpen(false)}
        onSave={handleSaveBreak}
        initialData={selectedBreakForEdit}
        classes={classesList}
        isSaving={isSavingBreak}
        defaultClassId={selectedClassId}
      />

      {/* Timetable Finalization Modal */}
      <TimetableFinalizeModal
        isOpen={isFinalizeModalOpen}
        onClose={() => setIsFinalizeModalOpen(false)}
        onSuccess={(publication) => {
          setFinalizeSuccessMessage(
            `Timetable finalized successfully! ${
              publication.sendEmail
                ? `Queued ${publication.queuedCount} emails (${publication.skippedCount} skipped without email).`
                : 'Schedule snapshot frozen.'
            }`
          );
        }}
      />
    </div>
  );
}
