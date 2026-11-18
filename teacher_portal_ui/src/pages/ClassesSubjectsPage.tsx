import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Users,
  Clock,
  MapPin,
  Search,
  CheckCircle2,
  Calendar,
  X,
  Sparkles,
} from 'lucide-react';
import type { AssignedClass } from '../mock/teacherMockData';
import { classesApi } from '../services/api';
import LoadingState from '../components/common/LoadingState';
import ErrorState from '../components/common/ErrorState';
import EmptyState from '../components/common/EmptyState';
import Pagination from '../components/common/Pagination';

export default function ClassesSubjectsPage() {
  const [classes, setClasses] = useState<AssignedClass[]>([]);
  const [selectedClass, setSelectedClass] = useState<AssignedClass | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTabFilter, setActiveTabFilter] = useState<string>('All');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, activeTabFilter]);

  const loadClasses = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await classesApi.getAssignedClasses();
      if (data) setClasses(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load assigned classes.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadClasses();
  }, []);

  const handleSelectClass = async (cls: AssignedClass) => {
    setSelectedClass(cls);
    try {
      const detail = await classesApi.getClassDetail(cls.id);
      if (detail) setSelectedClass(detail);
    } catch {
      // Use existing cohort data if detail lookup fails
    }
  };

  // Derive dynamic sections/streams from database records
  const dynamicSections = Array.from(
    new Set(
      classes
        .map((c) => c.academicSection || c.stream)
        .filter((sec): sec is string => Boolean(sec && sec.trim()))
    )
  );

  if (isLoading) {
    return <LoadingState message="Loading assigned classes & curricula..." className="my-8" />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadClasses} className="my-8" />;
  }

  const filteredClasses = classes.filter((c) => {
    const sectionName = c.academicSection || c.stream || '';
    const matchesFilter =
      activeTabFilter === 'All' ||
      sectionName.toLowerCase() === activeTabFilter.toLowerCase();

    const matchesSearch =
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.subjectTaught.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sectionName.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  const totalActiveStudents = classes.reduce(
    (acc, c) => acc + (c.totalStudents ?? c.enrolledCount ?? 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* 1. Header & Quick Metrics */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#0D9488] uppercase tracking-wider mb-1">
            <BookOpen className="w-4 h-4" />
            <span>Academic Faculty Assignment</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            My Classes & Subjects
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {classes.length} Allocated Class Cohort{classes.length === 1 ? '' : 's'} • {totalActiveStudents} Active Madrasa Student{totalActiveStudents === 1 ? '' : 's'} Under Supervision
          </p>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search class, subject, or section..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D9488] bg-slate-50/50 focus:bg-white"
          />
        </div>
      </div>

      {/* 2. Dynamic Academic Section Filter Pills */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-2 shadow-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTabFilter('All')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              activeTabFilter === 'All'
                ? 'bg-[#0F172A] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <span>All Assigned Classes</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                activeTabFilter === 'All'
                  ? 'bg-[#37C6A3] text-[#0F172A]'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {classes.length}
            </span>
          </button>

          {dynamicSections.map((section) => {
            const isSelected = activeTabFilter.toLowerCase() === section.toLowerCase();
            const count = classes.filter(
              (c) => (c.academicSection || c.stream || '').toLowerCase() === section.toLowerCase()
            ).length;

            return (
              <button
                key={section}
                type="button"
                onClick={() => setActiveTabFilter(section)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-[#0F172A] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>{section}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    isSelected
                      ? 'bg-[#37C6A3] text-[#0F172A]'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Class Cards Grid */}
      {filteredClasses.length === 0 ? (
        <EmptyState
          title="No assigned classes found"
          description="Once the administration assigns weekly timetable slots to your profile, your cohorts will appear here."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
            {filteredClasses.slice((page - 1) * 6, page * 6).map((cls) => {
            const hasAttendance =
              cls.attendanceRate !== null &&
              cls.attendanceRate !== undefined &&
              typeof cls.attendanceRate === 'number';

            const sectionName = cls.academicSection || cls.stream;
            const studentCount = cls.totalStudents ?? cls.enrolledCount ?? 0;

            return (
              <div
                key={cls.id}
                className="bg-white rounded-2xl border border-slate-200/90 hover:border-emerald-500/50 p-5 sm:p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2 mb-3.5">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-800 font-mono tracking-wide border border-slate-200/60">
                      {cls.code}
                    </span>

                    {hasAttendance ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/80">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>{cls.attendanceRate}% Attendance</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>No attendance yet</span>
                      </span>
                    )}
                  </div>

                  {/* Class Name & Subject */}
                  <div className="space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="text-lg font-bold text-slate-900 tracking-tight group-hover:text-emerald-900 transition-colors">
                        {cls.name}
                      </h2>
                      {sectionName && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50/80 text-emerald-800 border border-emerald-200/60 shrink-0">
                          <Sparkles className="w-3 h-3 text-[#0D9488]" />
                          <span>{sectionName}</span>
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-bold text-[#0D9488]">
                      {cls.subjectTaught}
                    </div>
                  </div>

                  {/* Clean Metadata Rows */}
                  <div className="mt-4 pt-4 border-t border-slate-100 space-y-2.5 text-xs text-slate-700">
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-lg bg-emerald-50 flex items-center justify-center text-[#0D9488] shrink-0">
                        <Users className="w-3.5 h-3.5" />
                      </div>
                      <span className="leading-none">
                        <strong>{studentCount}</strong> Student{studentCount === 1 ? '' : 's'} Enrolled
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-lg bg-teal-50 flex items-center justify-center text-[#0D9488] shrink-0">
                        <MapPin className="w-3.5 h-3.5" />
                      </div>
                      <span className="leading-none truncate text-slate-700">
                        {cls.room || 'Classroom Venue'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                        <Calendar className="w-3.5 h-3.5" />
                      </div>
                      <span className="leading-none truncate text-slate-600">
                        {cls.meetingSchedule || 'Scheduled Timetable Slot'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Full-Width View Student Roster Button */}
                <div className="mt-5 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => handleSelectClass(cls)}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#0F172A] hover:bg-slate-800 active:scale-[0.99] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                  >
                    <Users className="w-3.5 h-3.5 text-[#37C6A3]" />
                    <span>View Student Roster</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <Pagination
          currentPage={page}
          totalItems={filteredClasses.length}
          pageSize={6}
          onPageChange={setPage}
          itemLabel="assigned classes"
          className="mt-4 rounded-2xl border border-slate-200/90 shadow-2xs"
        />
      </>
      )}

      {/* 4. Student Roster Modal / Drawer */}
      {selectedClass && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#0D9488]">
                  Enrolled Cohort Roster
                </span>
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  {selectedClass.name}
                </h3>
                <div className="text-xs text-slate-500 mt-0.5">
                  Subject: {selectedClass.subjectTaught} • {selectedClass.totalStudents ?? selectedClass.enrolledCount ?? (selectedClass.students || []).length} Students
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedClass(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Students Table */}
            <div className="flex-1 overflow-y-auto mt-4 pr-1">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider sticky top-0">
                    <th className="py-2.5 px-3">Roll No</th>
                    <th className="py-2.5 px-3">Student Name</th>
                    <th className="py-2.5 px-3">Guardian Contact</th>
                    <th className="py-2.5 px-3">Attendance</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(selectedClass.students || []).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">
                        No students enrolled in this cohort yet.
                      </td>
                    </tr>
                  ) : (
                    (selectedClass.students || []).map((student) => {
                      const studentRate =
                        student.attendanceRate !== null &&
                        student.attendanceRate !== undefined &&
                        typeof student.attendanceRate === 'number';

                      return (
                        <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-3 font-mono text-slate-500 font-semibold">
                            {student.rollNo}
                          </td>
                          <td className="py-3 px-3 font-bold text-slate-900">
                            {student.name}
                          </td>
                          <td className="py-3 px-3 text-slate-600 font-mono">
                            {student.guardianPhone || '—'}
                          </td>
                          <td className="py-3 px-3 font-semibold text-slate-800">
                            {studentRate ? `${student.attendanceRate}%` : '—'}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                student.status === 'Present'
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  : student.status === 'Late'
                                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                  : student.status === 'Excused'
                                  ? 'bg-blue-50 text-blue-800 border border-blue-200'
                                  : 'bg-rose-50 text-rose-800 border border-rose-200'
                              }`}
                            >
                              {student.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs mt-4">
              <span className="text-slate-500">
                Official cohort roster verified with madrasa administration
              </span>
              <button
                type="button"
                onClick={() => setSelectedClass(null)}
                className="px-4 py-2 text-xs font-bold text-white bg-[#0F172A] hover:bg-slate-800 rounded-xl transition cursor-pointer"
              >
                Close Roster
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
