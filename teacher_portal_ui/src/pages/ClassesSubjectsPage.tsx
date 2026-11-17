import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Users,
  Clock,
  MapPin,
  TrendingUp,
  Search,
  CheckCircle2,
  Calendar,
  X,
  UserCheck,
  ChevronRight,
  Sparkles,
  Phone,
  Award,
} from 'lucide-react';
import type { AssignedClass } from '../mock/teacherMockData';
import { classesApi } from '../services/api';
import LoadingState from '../components/common/LoadingState';
import ErrorState from '../components/common/ErrorState';
import EmptyState from '../components/common/EmptyState';

export default function ClassesSubjectsPage() {
  const [classes, setClasses] = useState<AssignedClass[]>([]);
  const [selectedClass, setSelectedClass] = useState<AssignedClass | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTabFilter, setActiveTabFilter] = useState<'All' | 'Tahfeez' | 'Alimiyyah' | 'Shariah'>('All');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  if (isLoading) {
    return <LoadingState message="Loading assigned classes & curricula..." className="my-8" />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadClasses} className="my-8" />;
  }

  const filteredClasses = classes.filter((c) => {
    const matchesFilter = activeTabFilter === 'All' || c.stream.includes(activeTabFilter);
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          c.subjectTaught.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          c.code.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

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
            {classes.length} Allocated Class Cohort{classes.length === 1 ? '' : 's'} • {classes.reduce((acc, c) => acc + (c.totalStudents || 0), 0)} Active Madrasa Students Under Supervision
          </p>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search class or subject..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D9488] bg-slate-50/50 focus:bg-white"
          />
        </div>
      </div>

      {/* 2. Stream Category Filter Pills */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-2 shadow-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {(['All', 'Tahfeez', 'Alimiyyah', 'Shariah'] as const).map((stream) => {
            const isSelected = activeTabFilter === stream;
            return (
              <button
                key={stream}
                onClick={() => setActiveTabFilter(stream)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                  isSelected
                    ? 'bg-[#0F172A] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {stream === 'All' ? 'All Assigned Classes' : `${stream} Stream`}
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredClasses.map((cls) => (
          <div
            key={cls.id}
            className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs hover:border-slate-300 transition flex flex-col justify-between"
          >
            <div>
              {/* Header Badges */}
              <div className="flex items-center justify-between mb-3">
                <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-800 font-mono">
                  {cls.code}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3" />
                  {cls.attendanceRate}% Attendance
                </span>
              </div>

              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                {cls.name}
              </h2>
              <div className="text-xs font-bold text-[#0D9488] mt-0.5">
                {cls.subjectTaught}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Stream: {cls.stream} • {cls.gradeLevel}
              </p>

              {/* Syllabus Progress Bar */}
              <div className="mt-4 p-3.5 bg-slate-50/70 rounded-xl border border-slate-100">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-slate-600 font-medium">Syllabus Coverage</span>
                  <span className="font-bold text-slate-900">{cls.syllabusProgress}%</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-[#0D9488] h-2 rounded-full transition-all duration-500"
                    style={{ width: `${cls.syllabusProgress}%` }}
                  />
                </div>
              </div>

              {/* Quick Info Grid */}
              <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
                <div className="flex items-center gap-2 text-slate-600">
                  <Users className="w-4 h-4 text-slate-400 shrink-0" />
                  <span><strong>{cls.totalStudents}</strong> Students</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>{cls.room}</span>
                </div>
                <div className="col-span-2 flex items-center gap-2 text-slate-600">
                  <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="truncate">{cls.meetingSchedule}</span>
                </div>
                <div className="col-span-2 text-[11px] text-slate-500">
                  Class Monitor: <strong className="text-slate-800">{cls.classMonitor}</strong>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
              <button
                onClick={() => handleSelectClass(cls)}
                className="w-full py-2.5 px-3 rounded-xl bg-[#0F172A] hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Users className="w-3.5 h-3.5 text-[#37C6A3]" />
                <span>View Student Roster</span>
              </button>
            </div>
          </div>
        ))}
      </div>
      )}

      {/* 4. Student Roster Modal / Drawer */}
      {selectedClass && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col">
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
                  Subject: {selectedClass.subjectTaught} • {selectedClass.totalStudents} Students
                </div>
              </div>
              <button
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
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
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
                    (selectedClass.students || []).map((student) => (
                      <tr key={student.id} className="hover:bg-slate-50">
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
                          {student.attendanceRate}%
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
                    ))
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
                onClick={() => setSelectedClass(null)}
                className="px-4 py-2 text-xs font-bold text-white bg-[#0F172A] hover:bg-slate-800 rounded-xl transition"
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
