import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Calendar,
  Clock,
  BookOpen,
  Users,
  CheckCircle2,
  TrendingUp,
  Sparkles,
  Building2,
  Bell,
  ChevronRight,
  MapPin,
  X,
  ArrowRight,
} from 'lucide-react';
import type { TeacherProfile, AssignedClass } from '../mock/teacherMockData';
import { dashboardApi, profileApi, classesApi, DashboardData, resolveAssetUrl } from '../services/api';
import LoadingState from '../components/common/LoadingState';
import ErrorState from '../components/common/ErrorState';
import InstitutionalLiveClock from '../components/dashboard/InstitutionalLiveClock';

const initialProfile: TeacherProfile = {
  id: '',
  employeeCode: 'UST-000',
  fullName: 'Faculty Member',
  arabicName: 'أستاذ معتمد لدى المنظومة',
  avatarUrl: '',
  designation: 'Faculty Instructor',
  department: 'Academic Faculty',
  email: '',
  phone: '',
  whatsapp: '',
  status: 'Active',
  dateOfJoining: '',
  bloodGroup: '',
  nicPassport: '',
  dateOfBirth: '',
  gender: 'Male',
  maritalStatus: 'Single',
  residentialAddress: '',
  district: '',
  postalCode: '',
  country: 'Sri Lanka',
  emergencyContact: { name: '', relationship: '', phone: '' },
  academicQualifications: [],
  professionalQualifications: [],
  teachingExperience: [],
  documents: [],
  profileCompletionPercentage: 85,
};

export default function DashboardPage() {
  const [profileDismissed, setProfileDismissed] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [profile, setProfile] = useState<TeacherProfile>(initialProfile);
  const [assignedClasses, setAssignedClasses] = useState<AssignedClass[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState(false);

  const navigate = useNavigate();

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [dash, prof, classes] = await Promise.all([
        dashboardApi.getDashboard(),
        profileApi.getProfile(),
        classesApi.getAssignedClasses(),
      ]);
      setDashboardData(dash);
      if (prof) setProfile(prof);
      if (classes) setAssignedClasses(classes);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (isLoading) {
    return <LoadingState message="Loading teacher dashboard & schedules..." className="my-8" />;
  }

  if (error || !dashboardData) {
    return <ErrorState message={error || 'Failed to retrieve teacher dashboard.'} onRetry={loadData} className="my-8" />;
  }

  const todayClasses = dashboardData.todaySchedule || [];
  const nextSession =
    todayClasses.find((t) => t.status === 'In Progress') ||
    todayClasses.find((t) => t.status === 'Upcoming');

  const stats = dashboardData.stats;
  const resolvedPhotoUrl = resolveAssetUrl(
    profile.photoUrl ||
    profile.avatarUrl ||
    dashboardData?.teacher?.photoUrl ||
    dashboardData?.teacher?.avatarUrl
  );

  return (
    <div className="space-y-6">
      {/* 0. Institutional Live Clock Banner */}
      <InstitutionalLiveClock />

      {/* 1. Welcome & Faculty Identity Header */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 sm:p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0 flex-1">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#111827] text-[#10B981] font-bold text-xl flex items-center justify-center border-2 border-[#E2E8F0] shadow-xs shrink-0 overflow-hidden">
            {resolvedPhotoUrl && !photoError ? (
              <img
                src={resolvedPhotoUrl}
                alt={profile.fullName}
                onError={() => setPhotoError(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              profile.fullName.slice(0, 2).toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#E6F7F2] text-[#10B981] border border-[#10B981]/30">
                ● Faculty Status: {profile.status}
              </span>
              <span className="text-xs text-[#718096] font-mono">
                ID: {profile.employeeCode}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-[#111827] tracking-tight min-w-0 break-words">
              Assalamu Alaikum, {profile.fullName}
            </h1>
            <p className="text-sm font-arabic text-[#10B981] font-semibold mt-0.5">
              {profile.arabicName || 'أستاذ معتمد لدى المنظومة'}
            </p>
            <div className="flex flex-wrap items-center gap-3 text-xs text-[#718096] mt-2">
              <span className="flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5 text-[#718096]" />
                {profile.designation}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-[#718096]" />
                {profile.department}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Date Card for Mobile/Tablet */}
        <div className="lg:hidden p-3 bg-[#F8F7F3] rounded-xl border border-[#E2E8F0] text-xs min-w-0">
          <div className="font-bold text-[#10B981] font-arabic truncate">
            {(profile as any).madrasa?.name || 'MadrasaNexa'}
          </div>
          <div className="text-[#718096] text-[11px] mt-0.5 min-w-0 break-words">
            {dashboardData.timeContext.date} ({dashboardData.timeContext.weekday})
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:flex-col lg:items-end shrink-0">
          <NavLink
            to="/timetable"
            className="px-4 py-2 rounded-xl bg-[#111827] hover:bg-black text-white font-bold text-xs flex items-center gap-1.5 transition shadow-xs min-h-[40px]"
          >
            <Calendar className="w-3.5 h-3.5 text-[#10B981]" />
            <span>View Full Timetable</span>
          </NavLink>
          <NavLink
            to="/classes"
            className="px-4 py-2 rounded-xl bg-white hover:bg-[#F8F7F3] border border-[#E2E8F0] text-[#111827] font-semibold text-xs flex items-center gap-1.5 transition shadow-xs min-h-[40px]"
          >
            <Users className="w-3.5 h-3.5 text-[#718096]" />
            <span>Manage Classes</span>
          </NavLink>
        </div>
      </div>

      {/* 2. Optional Profile Completion Indicator Banner */}
      {!profileDismissed && (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-5 relative shadow-xs">
          <button
            onClick={() => setProfileDismissed(true)}
            className="absolute top-3.5 right-3.5 p-1 text-[#718096] hover:text-[#111827] rounded-lg hover:bg-[#F8F7F3] transition cursor-pointer"
            aria-label="Dismiss banner"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pr-6">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#10B981] text-white flex items-center justify-center shrink-0 shadow-xs">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#111827] uppercase tracking-wide">
                    Profile Completion: {profile.profileCompletionPercentage}%
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                    Optional
                  </span>
                </div>
                <p className="text-xs text-[#718096] mt-1 max-w-2xl leading-relaxed">
                  Your teaching profile is active and in good standing. You may optionally update contact details, residential address, and emergency numbers.
                </p>
                {/* Progress Bar */}
                <div className="w-full sm:w-72 bg-[#E2E8F0] rounded-full h-2 mt-2.5 overflow-hidden">
                  <div
                    className="bg-[#10B981] h-2 rounded-full transition-all duration-500"
                    style={{ width: `${profile.profileCompletionPercentage}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-center">
              <button
                onClick={() => setProfileDismissed(true)}
                className="px-3 py-1.5 text-xs font-semibold text-[#718096] hover:text-[#111827] transition cursor-pointer"
              >
                Skip for now
              </button>
              <NavLink
                to="/profile"
                className="px-3.5 py-1.5 rounded-xl bg-[#10B981] hover:bg-[#059669] text-white text-xs font-bold transition shadow-xs min-h-[36px] flex items-center"
              >
                Complete Profile
              </NavLink>
            </div>
          </div>
        </div>
      )}

      {/* 3. Assigned Classes & Key Metrics Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-[#718096] uppercase tracking-wider">
              Assigned Classes
            </span>
            <div className="text-2xl font-black text-[#111827] mt-1">
              {stats.totalClasses}
            </div>
            <span className="text-[11px] text-[#718096] mt-0.5 block">
              Active Cohorts
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-[#E6F7F2] text-[#10B981] flex items-center justify-center shrink-0">
            <BookOpen className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-[#718096] uppercase tracking-wider">
              Enrolled Students
            </span>
            <div className="text-2xl font-black text-[#111827] mt-1">
              {stats.totalStudents}
            </div>
            <span className="text-[11px] text-[#10B981] font-semibold mt-0.5 block">
              Across Assigned Classes
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-[#718096] uppercase tracking-wider">
              Avg. Attendance Rate
            </span>
            <div className="text-2xl font-black text-[#111827] mt-1">
              {stats.averageAttendanceRate}%
            </div>
            <span className="text-[11px] text-[#10B981] font-semibold mt-0.5 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              Institutional Standard
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-[#E6F7F2] text-[#10B981] flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-[#718096] uppercase tracking-wider">
              Weekly Teaching Load
            </span>
            <div className="text-2xl font-black text-[#111827] mt-1">
              {stats.weeklyTeachingHours} <span className="text-sm font-medium text-[#718096]">hrs</span>
            </div>
            <span className="text-[11px] text-[#718096] mt-0.5 block">
              Active Schedules
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 4. Two-Column Core Section: Today's Schedule & Quick Upcoming Widget */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Today's Classroom Timetable */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-[#E2E8F0] p-5 sm:p-6 shadow-xs">
          <div className="flex items-center justify-between pb-4 border-b border-[#E2E8F0]">
            <div>
              <h2 className="text-base font-bold text-[#111827] tracking-tight flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#10B981]" />
                <span>Today's Teaching Schedule</span>
              </h2>
              <p className="text-xs text-[#718096] mt-0.5">
                {dashboardData.timeContext.weekday} • {todayClasses.length} Scheduled Classroom Sessions
              </p>
            </div>
            <NavLink
              to="/timetable"
              className="text-xs font-semibold text-[#10B981] hover:text-[#059669] flex items-center gap-1"
            >
              <span>Full Week</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </NavLink>
          </div>

          <div className="mt-4 space-y-3">
            {todayClasses.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#718096]">
                No teaching sessions scheduled for today ({dashboardData.timeContext.weekday}).
              </div>
            ) : (
              todayClasses.map((item) => {
                const isOngoing = item.status === 'In Progress';
                const isCompleted = item.status === 'Completed';

                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isOngoing
                        ? 'bg-[#E6F7F2]/60 border-[#10B981] ring-1 ring-[#10B981]/30'
                        : isCompleted
                        ? 'bg-[#F8F7F3] border-[#E2E8F0] opacity-80'
                        : 'bg-white border-[#E2E8F0] hover:border-[#10B981]/50'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                          isOngoing
                            ? 'bg-[#10B981] text-white animate-pulse'
                            : isCompleted
                            ? 'bg-[#E2E8F0] text-[#718096]'
                            : 'bg-[#F8F7F3] text-[#111827] border border-[#E2E8F0]'
                        }`}
                      >
                        P{item.period}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#111827] truncate">
                            {item.className}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isOngoing
                                ? 'bg-[#E6F7F2] text-[#10B981] border border-[#10B981]/30'
                                : isCompleted
                                ? 'bg-[#E2E8F0] text-[#718096]'
                                : 'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {item.status}
                          </span>
                        </div>
                        <div className="text-xs font-semibold text-[#10B981] mt-0.5">
                          {item.subject}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#718096] mt-1">
                          <span className="flex items-center gap-1 font-mono">
                            <Clock className="w-3 h-3 text-[#718096]" />
                            {item.timeSlot}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-[#718096]" />
                            {item.room}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      <button
                        onClick={() => navigate('/attendance/students')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer min-h-[36px] ${
                          isOngoing
                            ? 'bg-[#10B981] hover:bg-[#059669] text-white shadow-xs'
                            : isCompleted
                            ? 'bg-[#F8F7F3] hover:bg-[#E2E8F0] text-[#111827] border border-[#E2E8F0]'
                            : 'bg-[#F8F7F3] hover:bg-[#E2E8F0] text-[#111827] border border-[#E2E8F0]'
                        }`}
                      >
                        {isCompleted ? 'Review Attendance' : 'Take Attendance'}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right 1 Col: Immediate Upcoming Class Card & Quick Notifications */}
        <div className="space-y-6">
          {/* Immediate Session Card */}
          {nextSession && (
            <div className="bg-[#111827] text-white rounded-2xl p-5 shadow-sm border border-[#111827]">
              <div className="flex items-center justify-between text-xs text-slate-300 mb-2">
                <span className="font-bold uppercase tracking-wider text-[#10B981]">
                  {nextSession.status === 'In Progress' ? 'Current Session' : 'Next Up'}
                </span>
                <span className="font-mono">{nextSession.timeSlot.split('–')[0]}</span>
              </div>
              <h3 className="text-base font-bold text-white leading-tight">
                {nextSession.subject}
              </h3>
              <p className="text-xs text-slate-300 mt-1">
                {nextSession.className}
              </p>
              <div className="mt-4 pt-3 border-t border-slate-700/80 flex items-center justify-between text-xs text-slate-300">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-[#10B981]" />
                  {nextSession.room}
                </span>
                <span className="text-[#10B981] font-semibold">Active Period</span>
              </div>
              <button
                onClick={() => navigate('/attendance/students')}
                className="w-full mt-4 py-2.5 px-3 rounded-xl bg-[#10B981] hover:bg-[#059669] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs min-h-[44px]"
              >
                <span>Launch Attendance Portal</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Recent Faculty Notifications */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <h3 className="text-xs font-bold text-[#111827] uppercase tracking-wider flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-[#10B981]" />
                <span>Recent Notices</span>
              </h3>
              <NavLink to="/notifications" className="text-xs text-[#10B981] font-semibold hover:underline">
                View all
              </NavLink>
            </div>
            <div className="divide-y divide-[#E2E8F0] mt-1">
              {dashboardData.recentNotifications.length === 0 ? (
                <p className="py-4 text-center text-xs text-[#718096]">No new notices.</p>
              ) : (
                dashboardData.recentNotifications.map((n) => (
                  <div key={n.id} className="py-3">
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className={`font-bold ${n.priority === 'HIGH' || n.priority === 'URGENT' ? 'text-amber-800' : 'text-[#718096]'}`}>
                        {n.category}
                      </span>
                      <span className="text-[#718096] font-mono text-[10px]">
                        {new Date(n.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                    <h4 className="text-xs font-semibold text-[#111827] leading-snug">
                      {n.title}
                    </h4>
                    <p className="text-[11px] text-[#718096] mt-1 line-clamp-2">
                      {n.message}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 5. Assigned Classes Summary Table */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 sm:p-6 shadow-xs overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#E2E8F0] gap-2">
          <div>
            <h2 className="text-base font-bold text-[#111827] tracking-tight">
              Assigned Classes &amp; Subject Progress
            </h2>
            <p className="text-xs text-[#718096] mt-0.5">
              Current academic semester syllabus pacing and classroom attendance overview
            </p>
          </div>
          <NavLink
            to="/classes"
            className="text-xs font-semibold text-[#10B981] hover:text-[#059669] flex items-center gap-1 self-start sm:self-auto"
          >
            <span>Class Rosters &amp; Syllabi</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </NavLink>
        </div>

        <div className="overflow-x-auto mt-4 -mx-5 sm:mx-0">
          <table className="w-full text-left border-collapse min-w-[620px]">
            <thead>
              <tr className="bg-[#F8F7F3] border-b border-[#E2E8F0] text-[11px] font-bold text-[#718096] uppercase tracking-wider">
                <th className="py-3 px-4">Class &amp; Code</th>
                <th className="py-3 px-4">Subject Taught</th>
                <th className="py-3 px-4">Room &amp; Monitor</th>
                <th className="py-3 px-4">Students</th>
                <th className="py-3 px-4">Attendance</th>
                <th className="py-3 px-4">Syllabus Covered</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] text-xs">
              {assignedClasses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    <p className="font-semibold text-sm text-slate-700">No classes assigned yet.</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Once Admin assigns schedules to you, your active classes and subject progress will appear here.
                    </p>
                  </td>
                </tr>
              ) : (
                assignedClasses.map((cls) => (
                  <tr key={cls.id} className="hover:bg-[#F8F7F3]/70 transition">
                    <td className="py-3.5 px-4 font-bold text-[#111827]">
                      <div>{cls.name}</div>
                      <div className="text-[10px] text-[#718096] font-mono">{cls.code || '—'}</div>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-[#111827]">
                      {cls.subjectTaught || '—'}
                    </td>
                    <td className="py-3.5 px-4 text-[#718096]">
                      <div>{cls.room || '—'}</div>
                      <div className="text-[11px] text-[#718096]">{cls.classMonitor || '—'}</div>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-[#111827]">
                      {cls.totalStudents ?? 0} Students
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full font-bold text-[11px] bg-[#E6F7F2] text-[#10B981] border border-[#10B981]/30">
                        {cls.attendanceRate ?? 95}%
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="w-28 bg-[#E2E8F0] rounded-full h-2 overflow-hidden mb-1">
                        <div
                          className="bg-[#10B981] h-2 rounded-full"
                          style={{ width: `${cls.syllabusProgress ?? 0}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-[#718096]">{cls.syllabusProgress ?? 0}% Paced</span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <NavLink
                        to={`/classes`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white hover:bg-[#F8F7F3] border border-[#E2E8F0] text-[#111827] font-semibold text-xs transition shadow-xs"
                      >
                        <span>Roster</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </NavLink>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
