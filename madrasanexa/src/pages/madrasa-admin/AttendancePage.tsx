import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  CalendarCheck,
  History,
  TrendingUp,
  User,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { apiListClasses } from '../../services/api';
import {
  getDailyAttendance,
  saveDailyAttendance,
  downloadDailyPdf,
  downloadDailyCsv,
  type DailyStudentItem,
} from '../../services/attendance.service';
import { AttendanceFilters } from '../../components/attendance/AttendanceFilters';
import { AttendanceSummaryCards } from '../../components/attendance/AttendanceSummaryCards';
import { AttendanceStudentList } from '../../components/attendance/AttendanceStudentList';
import { AttendanceHistoryTab } from '../../components/attendance/AttendanceHistoryTab';
import { MonthlySummaryTab } from '../../components/attendance/MonthlySummaryTab';
import { StudentAttendanceTab } from '../../components/attendance/StudentAttendanceTab';

type ActiveTab = 'daily' | 'history' | 'monthly' | 'student';

export default function AttendancePage() {
  // Classes
  const [classes, setClasses] = useState<Array<{ id: string; name: string; code?: string | null }>>([]);
  const [isLoadingClasses, setIsLoadingClasses] = useState(false);

  // Filters
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedAcademicYear, setSelectedAcademicYear] = useState('2025/2026');
  const todayStr = useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);
  const [selectedDate, setSelectedDate] = useState(todayStr);

  // Daily Data & Local State
  const [students, setStudents] = useState<DailyStudentItem[]>([]);
  const [isSaved, setIsSaved] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [isLoadingDaily, setIsLoadingDaily] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Active Tab & Navigation
  const [activeTab, setActiveTab] = useState<ActiveTab>('daily');
  const [selectedStudentForProfile, setSelectedStudentForProfile] = useState<string | null>(null);

  // Export Loading States
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);

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
    } catch (err) {
      console.error('Failed to load classes', err);
    } finally {
      setIsLoadingClasses(false);
    }
  };

  // 2. Load daily attendance when class, academicYear, or date changes
  const loadDaily = useCallback(async () => {
    if (!selectedClassId || !selectedDate) {
      setStudents([]);
      setIsSaved(false);
      setIsDirty(false);
      setUpdatedAt(null);
      return;
    }

    try {
      setIsLoadingDaily(true);
      setErrorMessage(null);
      setSuccessMessage(null);
      const res = await getDailyAttendance({
        classId: selectedClassId,
        academicYear: selectedAcademicYear,
        date: selectedDate,
      });

      setStudents(res.students);
      setIsSaved(res.isSaved);
      setIsDirty(false);
      setUpdatedAt(res.updatedAt);
    } catch (err: any) {
      console.error('Failed to load daily attendance', err);
      setErrorMessage(err.response?.data?.message || 'Failed to load attendance.');
    } finally {
      setIsLoadingDaily(false);
    }
  }, [selectedClassId, selectedAcademicYear, selectedDate]);

  useEffect(() => {
    loadDaily();
  }, [loadDaily]);

  // Dynamic calculated summary from current local unsaved students state
  const liveSummary = useMemo(() => {
    const total = students.length;
    let present = 0;
    let absent = 0;
    let unmarked = 0;

    for (const s of students) {
      if (s.status === 'PRESENT') present++;
      else if (s.status === 'ABSENT') absent++;
      else unmarked++;
    }

    const rate = total > 0 ? (present / total) * 100 : 0.0;

    return {
      totalStudents: total,
      presentCount: present,
      absentCount: absent,
      notMarkedCount: unmarked,
      attendanceRate: rate,
    };
  }, [students]);

  // Status Change Handlers (Unsaved local state changes)
  const handleSingleStatusChange = (studentId: string, newStatus: 'PRESENT' | 'ABSENT') => {
    setStudents((prev) =>
      prev.map((s) => (s.studentId === studentId ? { ...s, status: newStatus } : s))
    );
    setIsDirty(true);
    setSuccessMessage(null);
  };

  const handleMarkAll = (status: 'PRESENT' | 'ABSENT') => {
    setStudents((prev) => prev.map((s) => ({ ...s, status })));
    setIsDirty(true);
    setSuccessMessage(null);
  };

  // Save Attendance to Database
  const handleSaveAttendance = async () => {
    if (!selectedClassId || !selectedDate || students.length === 0) return;

    // Invariant check: all students must be marked
    const hasUnmarked = students.some((s) => s.status === null);
    if (hasUnmarked) {
      setErrorMessage('Every student must be marked Present or Absent before saving attendance.');
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage(null);

      const records = students.map((s) => ({
        studentId: s.studentId,
        status: s.status as 'PRESENT' | 'ABSENT',
      }));

      const res = await saveDailyAttendance({
        classId: selectedClassId,
        academicYear: selectedAcademicYear,
        date: selectedDate,
        records,
      });

      setStudents(res.students);
      setIsSaved(res.isSaved);
      setIsDirty(false);
      setUpdatedAt(res.updatedAt);
      setSuccessMessage('Attendance recorded and saved successfully!');
    } catch (err: any) {
      console.error('Failed to save attendance', err);
      setErrorMessage(err.response?.data?.message || 'Failed to save attendance.');
    } finally {
      setIsSaving(false);
    }
  };

  // Export Handlers
  const handleExportDailyPdf = async () => {
    if (!selectedClassId || !selectedDate) return;
    try {
      setIsExportingPdf(true);
      const currentClass = classes.find((c) => c.id === selectedClassId);
      const className = currentClass ? currentClass.name.replace(/[^a-zA-Z0-9_-]/g, '_') : 'Class';
      await downloadDailyPdf(
        { classId: selectedClassId, academicYear: selectedAcademicYear, date: selectedDate },
        `Attendance_${className}_${selectedDate}.pdf`
      );
    } catch (err: any) {
      console.error('Failed to export daily PDF', err);
      setErrorMessage(err.response?.data?.message || 'Failed to download PDF.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportDailyCsv = async () => {
    if (!selectedClassId || !selectedDate) return;
    try {
      setIsExportingCsv(true);
      const currentClass = classes.find((c) => c.id === selectedClassId);
      const className = currentClass ? currentClass.name.replace(/[^a-zA-Z0-9_-]/g, '_') : 'Class';
      await downloadDailyCsv(
        { classId: selectedClassId, academicYear: selectedAcademicYear, date: selectedDate },
        `Attendance_${className}_${selectedDate}.csv`
      );
    } catch (err: any) {
      console.error('Failed to export daily CSV', err);
      setErrorMessage(err.response?.data?.message || 'Failed to export CSV.');
    } finally {
      setIsExportingCsv(false);
    }
  };

  // Navigate to student profile
  const handleViewStudentProfile = (studentId: string) => {
    setSelectedStudentForProfile(studentId);
    setActiveTab('student');
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight flex items-center gap-2.5">
            <CalendarCheck className="w-7 h-7 text-emerald-600" />
            Class Attendance
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 mt-1">
            Fast, date-aware bulk attendance tracking, monthly analytics, and official exports
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <AttendanceFilters
        classes={classes}
        selectedClassId={selectedClassId}
        selectedAcademicYear={selectedAcademicYear}
        selectedDate={selectedDate}
        onSelectClassId={(id) => {
          if (isDirty && !window.confirm('You have unsaved attendance changes. Discard and switch class?')) {
            return;
          }
          setSelectedClassId(id);
        }}
        onSelectAcademicYear={setSelectedAcademicYear}
        onSelectDate={(date) => {
          if (isDirty && !window.confirm('You have unsaved attendance changes. Discard and switch date?')) {
            return;
          }
          setSelectedDate(date);
        }}
        isLoadingClasses={isLoadingClasses}
      />

      {/* Navigation Tabs */}
      <div className="flex border-b border-stone-200 gap-2 sm:gap-4 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('daily')}
          className={`flex items-center gap-2 py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'daily'
              ? 'border-emerald-600 text-emerald-700 bg-emerald-50/40 rounded-t-xl'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <CalendarCheck className="w-4 h-4" />
          Daily Attendance
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'history'
              ? 'border-emerald-600 text-emerald-700 bg-emerald-50/40 rounded-t-xl'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <History className="w-4 h-4" />
          History
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('monthly')}
          className={`flex items-center gap-2 py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'monthly'
              ? 'border-emerald-600 text-emerald-700 bg-emerald-50/40 rounded-t-xl'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Monthly Summary
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('student')}
          className={`flex items-center gap-2 py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'student'
              ? 'border-emerald-600 text-emerald-700 bg-emerald-50/40 rounded-t-xl'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <User className="w-4 h-4" />
          Student Profile
        </button>
      </div>

      {/* Notifications */}
      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Tab Content */}
      {activeTab === 'daily' && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <AttendanceSummaryCards
            totalStudents={liveSummary.totalStudents}
            presentCount={liveSummary.presentCount}
            absentCount={liveSummary.absentCount}
            notMarkedCount={liveSummary.notMarkedCount}
            attendanceRate={liveSummary.attendanceRate}
            isSaved={isSaved}
            isDirty={isDirty}
            updatedAt={updatedAt}
          />

          {isLoadingDaily ? (
            <div className="bg-white rounded-2xl border border-stone-200/80 p-12 text-center text-stone-400">
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
                <span className="text-sm">Loading eligible students for {selectedDate}...</span>
              </div>
            </div>
          ) : (
            <AttendanceStudentList
              students={students}
              isSaved={isSaved}
              isSaving={isSaving}
              onStatusChange={handleSingleStatusChange}
              onMarkAll={handleMarkAll}
              onSave={handleSaveAttendance}
              onExportPdf={handleExportDailyPdf}
              onExportCsv={handleExportDailyCsv}
              onViewStudentProfile={handleViewStudentProfile}
              isExportingPdf={isExportingPdf}
              isExportingCsv={isExportingCsv}
            />
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <AttendanceHistoryTab
          classId={selectedClassId}
          academicYear={selectedAcademicYear}
          onSelectDate={(date) => {
            setSelectedDate(date);
            setActiveTab('daily');
          }}
        />
      )}

      {activeTab === 'monthly' && (
        <MonthlySummaryTab
          classId={selectedClassId}
          academicYear={selectedAcademicYear}
          onViewStudentProfile={handleViewStudentProfile}
        />
      )}

      {activeTab === 'student' && (
        <StudentAttendanceTab
          studentId={selectedStudentForProfile}
          classId={selectedClassId}
          academicYear={selectedAcademicYear}
          onBack={() => setActiveTab('daily')}
          onSelectAnotherStudent={(stId) => setSelectedStudentForProfile(stId)}
          availableStudents={students.map((s) => ({
            studentId: s.studentId,
            admissionNo: s.admissionNo,
            fullName: s.fullName,
          }))}
        />
      )}
    </div>
  );
}
