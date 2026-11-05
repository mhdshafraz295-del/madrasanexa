import { useState, useEffect, useCallback } from 'react';
import {
  UserCheck,
  Users,
  Calendar,
  CalendarCheck,
  DollarSign,
  History,
  Loader2,
} from 'lucide-react';
import { apiListClasses } from '../../services/api';
import { fetchSubjects } from '../../services/marking-hub.service';
import {
  listUstadhs,
  createUstadh,
  updateUstadh,
  createSchedule,
  updateSchedule,
  updateSalaryPayable,
  paySalary,
  sendUstadhEmail,
  type UstadhItem,
  type UstadhScheduleItem,
  type UstadhSalaryItem,
} from '../../services/ustadh.service';
import { UstadhDirectoryTab } from '../../components/ustadh/UstadhDirectoryTab';
import { UstadhScheduleTab } from '../../components/ustadh/UstadhScheduleTab';
import { StaffAttendanceTab } from '../../components/ustadh/StaffAttendanceTab';
import { MonthlySalaryTab } from '../../components/ustadh/MonthlySalaryTab';
import { SalaryPaymentHistoryTab } from '../../components/ustadh/SalaryPaymentHistoryTab';
import { UstadhModal } from '../../components/ustadh/UstadhModal';
import { ScheduleModal } from '../../components/ustadh/ScheduleModal';
import { SalaryAdjustmentModal } from '../../components/ustadh/SalaryAdjustmentModal';
import { SalaryPaymentModal } from '../../components/ustadh/SalaryPaymentModal';
import { UstadhEmailModal } from '../../components/ustadh/UstadhEmailModal';

type ActiveTab = 'directory' | 'schedule' | 'attendance' | 'salary' | 'history';

export default function UstadhManagementPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('directory');
  const [refreshKey, setRefreshKey] = useState(0);

  // Common reference lists
  const [ustadhsList, setUstadhsList] = useState<Array<{ id: string; fullName: string; ustadhCode: string; staffType?: any }>>([]);
  const [classesList, setClassesList] = useState<Array<{ id: string; name: string; code?: string | null }>>([]);
  const [subjectsList, setSubjectsList] = useState<Array<{ id: string; name: string; code?: string | null }>>([]);
  const [initialLoading, setInitialLoading] = useState(true);

  // Modals state & Saving flags
  const [isUstadhModalOpen, setIsUstadhModalOpen] = useState(false);
  const [selectedUstadhForEdit, setSelectedUstadhForEdit] = useState<UstadhItem | null>(null);
  const [isSavingUstadh, setIsSavingUstadh] = useState(false);

  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [selectedScheduleForEdit, setSelectedScheduleForEdit] = useState<UstadhScheduleItem | null>(null);
  const [initialUstadhIdForSchedule, setInitialUstadhIdForSchedule] = useState<string>('');
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);

  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [selectedSalaryForAdjustment, setSelectedSalaryForAdjustment] = useState<UstadhSalaryItem | null>(null);
  const [isSavingAdjustment, setIsSavingAdjustment] = useState(false);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedSalaryForPayment, setSelectedSalaryForPayment] = useState<UstadhSalaryItem | null>(null);
  const [isSavingPayment, setIsSavingPayment] = useState(false);

  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [selectedUstadhForEmail, setSelectedUstadhForEmail] = useState<UstadhItem | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  // Fetch reference lists (Ustadhs, Classes, Subjects)
  const fetchReferenceData = useCallback(async () => {
    try {
      const [ustadhsRes, classesRes, subjectsRes] = await Promise.allSettled([
        listUstadhs({ pageSize: 100, isActive: true }),
        apiListClasses({ pageSize: 100, isActive: true }),
        fetchSubjects({ isActive: true }),
      ]);

      if (ustadhsRes.status === 'fulfilled') {
        setUstadhsList(
          ustadhsRes.value.items.map((u) => ({
            id: u.id,
            fullName: u.fullName,
            ustadhCode: u.ustadhCode,
            staffType: u.staffType,
          }))
        );
      }

      if (classesRes.status === 'fulfilled') {
        const cls = classesRes.value.classes || classesRes.value.items || [];
        setClassesList(cls.map((c: any) => ({ id: c.id, name: c.name, code: c.code })));
      }

      if (subjectsRes.status === 'fulfilled') {
        setSubjectsList(
          (subjectsRes.value || []).map((s: any) => ({ id: s.id, name: s.name, code: s.code }))
        );
      }
    } catch (err) {
      console.error('Failed to load reference data for Ustadh Management', err);
    } finally {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReferenceData();
  }, [fetchReferenceData, refreshKey]);

  // Handlers for modal triggers
  const handleOpenAddUstadh = () => {
    setSelectedUstadhForEdit(null);
    setIsUstadhModalOpen(true);
  };

  const handleOpenEditUstadh = (ustadh: UstadhItem) => {
    setSelectedUstadhForEdit(ustadh);
    setIsUstadhModalOpen(true);
  };

  const handleOpenAddSchedule = (ustadhId?: string) => {
    setSelectedScheduleForEdit(null);
    setInitialUstadhIdForSchedule(ustadhId || '');
    setIsScheduleModalOpen(true);
  };

  const handleOpenEditSchedule = (schedule: UstadhScheduleItem) => {
    setSelectedScheduleForEdit(schedule);
    setInitialUstadhIdForSchedule(schedule.ustadhId);
    setIsScheduleModalOpen(true);
  };

  const handleViewUstadhSchedule = (ustadh: UstadhItem) => {
    setInitialUstadhIdForSchedule(ustadh.id);
    setActiveTab('schedule');
  };

  const handleOpenAdjustSalary = (salary: UstadhSalaryItem) => {
    setSelectedSalaryForAdjustment(salary);
    setIsAdjustmentModalOpen(true);
  };

  const handleOpenPaySalary = (salary: UstadhSalaryItem) => {
    setSelectedSalaryForPayment(salary);
    setIsPaymentModalOpen(true);
  };

  const handleOpenEmailModal = (ustadh: UstadhItem) => {
    setSelectedUstadhForEmail(ustadh);
    setIsEmailModalOpen(true);
  };

  const triggerRefresh = () => {
    setRefreshKey((k) => k + 1);
  };

  // Modal Submit Handlers
  const handleSaveUstadh = async (formData: any) => {
    setIsSavingUstadh(true);
    try {
      if (selectedUstadhForEdit) {
        await updateUstadh(selectedUstadhForEdit.id, formData);
      } else {
        await createUstadh(formData);
      }
      setIsUstadhModalOpen(false);
      setSelectedUstadhForEdit(null);
      triggerRefresh();
    } catch (err: any) {
      throw err;
    } finally {
      setIsSavingUstadh(false);
    }
  };

  const handleSaveSchedule = async (formData: any) => {
    setIsSavingSchedule(true);
    try {
      if (selectedScheduleForEdit) {
        await updateSchedule(selectedScheduleForEdit.id, formData);
      } else {
        await createSchedule(formData);
      }
      setIsScheduleModalOpen(false);
      setSelectedScheduleForEdit(null);
      triggerRefresh();
    } catch (err: any) {
      throw err;
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const handleSaveAdjustment = async (payableAmount: number, adjustmentReason: string | null) => {
    if (!selectedSalaryForAdjustment) return;
    setIsSavingAdjustment(true);
    try {
      await updateSalaryPayable(selectedSalaryForAdjustment.id, {
        payableAmount,
        adjustmentReason,
      });
      setIsAdjustmentModalOpen(false);
      setSelectedSalaryForAdjustment(null);
      triggerRefresh();
    } catch (err: any) {
      throw err;
    } finally {
      setIsSavingAdjustment(false);
    }
  };

  const handleConfirmPayment = async (data: any) => {
    if (!selectedSalaryForPayment) return;
    setIsSavingPayment(true);
    try {
      await paySalary(selectedSalaryForPayment.id, data);
      setIsPaymentModalOpen(false);
      setSelectedSalaryForPayment(null);
      triggerRefresh();
    } catch (err: any) {
      throw err;
    } finally {
      setIsSavingPayment(false);
    }
  };

  const handleSendEmail = async (subject: string, message: string) => {
    if (!selectedUstadhForEmail) return;
    setIsSendingEmail(true);
    try {
      await sendUstadhEmail(selectedUstadhForEmail.id, { subject, message });
      setIsEmailModalOpen(false);
      setSelectedUstadhForEmail(null);
    } catch (err: any) {
      throw err;
    } finally {
      setIsSendingEmail(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl">
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Ustadh & Teacher Management</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Manage teaching staff profiles (Ustadh & School Teacher), weekly schedules, attendance, fixed monthly payroll, and communication.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-px">
        <button
          type="button"
          onClick={() => setActiveTab('directory')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'directory'
              ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50 rounded-t-lg'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Staff Profiles</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('schedule')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'schedule'
              ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50 rounded-t-lg'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Weekly Schedule</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('attendance')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'attendance'
              ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50 rounded-t-lg'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
          }`}
        >
          <CalendarCheck className="w-4 h-4" />
          <span>Staff Attendance</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('salary')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'salary'
              ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50 rounded-t-lg'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>Monthly Salaries</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'history'
              ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50 rounded-t-lg'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Payment History</span>
        </button>
      </div>

      {/* Main Content Area */}
      {initialLoading ? (
        <div className="py-16 text-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-600 mb-2" />
          <span>Loading module data...</span>
        </div>
      ) : (
        <>
          {activeTab === 'directory' && (
            <UstadhDirectoryTab
              onAddUstadh={handleOpenAddUstadh}
              onEditUstadh={handleOpenEditUstadh}
              onViewSchedule={handleViewUstadhSchedule}
              onOpenEmailModal={handleOpenEmailModal}
              refreshKey={refreshKey}
            />
          )}

          {activeTab === 'schedule' && (
            <UstadhScheduleTab
              onAddSchedule={() => handleOpenAddSchedule()}
              onEditSchedule={handleOpenEditSchedule}
              initialUstadhId={initialUstadhIdForSchedule}
              ustadhsList={ustadhsList}
              classesList={classesList}
              subjectsList={subjectsList}
              refreshKey={refreshKey}
            />
          )}

          {activeTab === 'attendance' && (
            <StaffAttendanceTab
              ustadhsList={ustadhsList}
              classesList={classesList}
              refreshKey={refreshKey}
            />
          )}

          {activeTab === 'salary' && (
            <MonthlySalaryTab
              onAdjustSalary={handleOpenAdjustSalary}
              onPaySalary={handleOpenPaySalary}
              refreshKey={refreshKey}
            />
          )}

          {activeTab === 'history' && (
            <SalaryPaymentHistoryTab
              ustadhsList={ustadhsList}
              refreshKey={refreshKey}
            />
          )}
        </>
      )}

      {/* Modals */}
      <UstadhModal
        isOpen={isUstadhModalOpen}
        onClose={() => {
          setIsUstadhModalOpen(false);
          setSelectedUstadhForEdit(null);
        }}
        onSave={handleSaveUstadh}
        initialData={selectedUstadhForEdit}
        isSaving={isSavingUstadh}
      />

      <ScheduleModal
        isOpen={isScheduleModalOpen}
        onClose={() => {
          setIsScheduleModalOpen(false);
          setSelectedScheduleForEdit(null);
        }}
        onSave={handleSaveSchedule}
        initialData={selectedScheduleForEdit}
        ustadhs={ustadhsList}
        classes={classesList}
        subjects={subjectsList}
        isSaving={isSavingSchedule}
      />

      <SalaryAdjustmentModal
        isOpen={isAdjustmentModalOpen}
        onClose={() => {
          setIsAdjustmentModalOpen(false);
          setSelectedSalaryForAdjustment(null);
        }}
        onSave={handleSaveAdjustment}
        salary={selectedSalaryForAdjustment}
        isSaving={isSavingAdjustment}
      />

      <SalaryPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => {
          setIsPaymentModalOpen(false);
          setSelectedSalaryForPayment(null);
        }}
        onConfirm={handleConfirmPayment}
        salary={selectedSalaryForPayment}
        isSaving={isSavingPayment}
      />

      <UstadhEmailModal
        isOpen={isEmailModalOpen}
        onClose={() => {
          setIsEmailModalOpen(false);
          setSelectedUstadhForEmail(null);
        }}
        onSend={handleSendEmail}
        ustadh={selectedUstadhForEmail}
        isSending={isSendingEmail}
      />
    </div>
  );
}
