import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  User,
  Calendar,
  BookOpen,
  Bell,
  Settings,
  LogOut,
  Menu,
  X,
  GraduationCap,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Building2,
  HelpCircle,
  ExternalLink,
  QrCode,
  ScanLine,
  History,
  Banknote,
  CreditCard,
  FileText,
} from 'lucide-react';
import {
  MOCK_TEACHER_PROFILE,
  MOCK_INSTITUTION_INFO,
  MOCK_NOTIFICATIONS,
  TeacherProfile,
} from '../mock/teacherMockData';
import { authApi, profileApi, notificationsApi } from '../services/api';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number | string;
}

export default function TeacherLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const [profile, setProfile] = useState<TeacherProfile>(MOCK_TEACHER_PROFILE);
  const [unreadCount, setUnreadCount] = useState<number>(MOCK_NOTIFICATIONS.filter((n) => !n.isRead).length);
  const [recentNotifications, setRecentNotifications] = useState(MOCK_NOTIFICATIONS);

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // 1. Listen for unauthorized/logout events
    const handleUnauthorized = () => {
      navigate('/login');
    };
    window.addEventListener('teacher:unauthorized', handleUnauthorized);
    window.addEventListener('teacher:logout', handleUnauthorized);

    // 2. Fetch live profile and unread notification count
    let isMounted = true;
    profileApi
      .getProfile()
      .then((p) => {
        if (isMounted && p) setProfile(p);
      })
      .catch(() => {});

    notificationsApi
      .getNotifications()
      .then((res) => {
        if (isMounted && res) {
          if (res.unreadCount !== undefined) setUnreadCount(res.unreadCount);
          if (res.data) setRecentNotifications(res.data);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
      window.removeEventListener('teacher:unauthorized', handleUnauthorized);
      window.removeEventListener('teacher:logout', handleUnauthorized);
    };
  }, [navigate]);

  const handleLogout = () => {
    authApi.logout();
    navigate('/login');
  };

  const CORE_NAV_ITEMS: NavItem[] = [
    { to: '/dashboard', label: 'Teacher Dashboard', icon: LayoutDashboard },
    { to: '/profile', label: 'My Profile', icon: User, badge: `${profile.profileCompletionPercentage}%` },
    { to: '/timetable', label: 'My Timetable', icon: Calendar },
    { to: '/classes', label: 'My Classes & Subjects', icon: BookOpen, badge: '4' },
  ];

  const ATTENDANCE_NAV_ITEMS: NavItem[] = [
    { to: '/attendance/my', label: 'My Attendance', icon: QrCode, badge: 'Live' },
    { to: '/attendance/students', label: 'Student Attendance', icon: ScanLine },
    { to: '/attendance/history', label: 'Attendance History', icon: History },
  ];

  const SALARY_NAV_ITEMS: NavItem[] = [
    { to: '/salary', label: 'My Salary', icon: Banknote },
    { to: '/salary/history', label: 'Payment History', icon: CreditCard },
    { to: '/salary/payslips', label: 'Payslips', icon: FileText, badge: 'Oct' },
  ];

  const PREFERENCE_NAV_ITEMS: NavItem[] = [
    { to: '/notifications', label: 'Notifications', icon: Bell, badge: unreadCount > 0 ? unreadCount : undefined },
    { to: '/settings', label: 'Account Settings', icon: Settings },
  ];

  const getBreadcrumbTitle = () => {
    const path = location.pathname;
    if (path === '/' || path === '/dashboard') return 'Dashboard';
    if (path === '/profile') return 'My Profile';
    if (path === '/timetable') return 'My Timetable';
    if (path === '/classes') return 'My Classes & Subjects';
    if (path === '/attendance/my') return 'My Attendance (Classroom QR)';
    if (path === '/attendance/students') return 'Student Attendance Scanner';
    if (path === '/attendance/history') return 'Attendance History & Archive';
    if (path === '/salary') return 'My Salary & Compensation';
    if (path === '/salary/history') return 'Payment History & Ledger';
    if (path === '/salary/payslips') return 'Monthly Payslips & Statements';
    if (path === '/notifications') return 'Notifications';
    if (path === '/settings') return 'Account Settings';
    return path.replace('/', '').replace('-', ' ');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col md:flex-row text-[#0F172A]">
      {/* Mobile Backdrop Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 md:hidden transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sticky Header */}
      <header className="md:hidden bg-[#0F172A] text-white px-4 py-3 flex items-center justify-between sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="h-8 w-8 rounded-lg bg-[#37C6A3] text-[#0F172A] font-extrabold text-xs flex items-center justify-center shrink-0 shadow-xs">
            MNX
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold text-white truncate leading-tight">
              {MOCK_INSTITUTION_INFO.name}
            </span>
            <span className="text-[10px] text-[#37C6A3] font-medium tracking-wide">
              Teacher & Ustadh Portal
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <NavLink
            to="/notifications"
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg relative"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#37C6A3]" />
            )}
          </NavLink>
          <NavLink
            to="/profile"
            className="w-8 h-8 rounded-lg bg-slate-800 text-[#37C6A3] font-bold text-xs flex items-center justify-center border border-slate-700"
          >
            {getInitials(profile.fullName)}
          </NavLink>
        </div>
      </header>

      {/* Sidebar Navigation */}
      <aside
        className={`fixed md:sticky top-0 left-0 z-50 h-screen w-72 bg-[#0F172A] text-slate-300 flex flex-col justify-between border-r border-slate-800 transition-transform duration-200 ease-in-out shrink-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex flex-col h-full min-h-0">
          {/* Brand & Institution Info */}
          <div className="p-5 border-b border-slate-800/80">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#37C6A3] to-[#0D9488] text-[#0F172A] font-black text-sm flex items-center justify-center shadow-md">
                  MNX
                </div>
                <div>
                  <span className="text-sm font-black tracking-tight text-white block">
                    MadrasaNexa
                  </span>
                  <span className="text-[10px] text-[#37C6A3] font-bold uppercase tracking-wider block">
                    Teacher Portal
                  </span>
                </div>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="md:hidden p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Institutional Pill */}
            <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="w-3.5 h-3.5 text-[#37C6A3] shrink-0" />
                <span className="text-xs font-bold text-white truncate">
                  {MOCK_INSTITUTION_INFO.name}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-arabic">
                <span>{MOCK_INSTITUTION_INFO.code}</span>
                <span className="text-emerald-400 font-semibold">{MOCK_INSTITUTION_INFO.hijriDate}</span>
              </div>
            </div>
          </div>

          {/* Nav Item Groups */}
          <div className="flex-1 overflow-y-auto px-3.5 py-4 space-y-6">
            {/* Core Workspace Group */}
            <div>
              <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Core Academic Workspace
              </div>
              <div className="space-y-1">
                {CORE_NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    item.to === '/dashboard'
                      ? location.pathname === '/' || location.pathname === '/dashboard'
                      : location.pathname.startsWith(item.to);

                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                        isActive
                          ? 'bg-[#37C6A3] text-[#0F172A] font-bold shadow-xs'
                          : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={`w-4 h-4 ${isActive ? 'text-[#0F172A]' : 'text-slate-400'}`} />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span
                          className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                            isActive
                              ? 'bg-[#0F172A] text-[#37C6A3]'
                              : 'bg-slate-800 text-slate-300 border border-slate-700'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>

            {/* Attendance & QR Operations */}
            <div>
              <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>Attendance Operations</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-teal-900/60 text-[#37C6A3] border border-teal-700/60 font-mono">
                  Live
                </span>
              </div>
              <div className="space-y-1">
                {ATTENDANCE_NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname.startsWith(item.to);

                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                        isActive
                          ? 'bg-[#37C6A3] text-[#0F172A] font-bold shadow-xs'
                          : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={`w-4 h-4 ${isActive ? 'text-[#0F172A]' : 'text-slate-400'}`} />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span
                          className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                            isActive
                              ? 'bg-[#0F172A] text-[#37C6A3]'
                              : 'bg-teal-950 text-[#37C6A3] border border-teal-800'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>

            {/* Salary & Finance Operations */}
            <div>
              <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>Salary & Payments</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 font-mono">
                  Phase 3
                </span>
              </div>
              <div className="space-y-1">
                {SALARY_NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.to;

                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                        isActive
                          ? 'bg-[#37C6A3] text-[#0F172A] font-bold shadow-xs'
                          : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={`w-4 h-4 ${isActive ? 'text-[#0F172A]' : 'text-slate-400'}`} />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span
                          className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                            isActive
                              ? 'bg-[#0F172A] text-[#37C6A3]'
                              : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>

            {/* Account & Preferences Group */}
            <div>
              <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Preferences
              </div>
              <div className="space-y-1">
                {PREFERENCE_NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname.startsWith(item.to);

                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                        isActive
                          ? 'bg-[#37C6A3] text-[#0F172A] font-bold shadow-xs'
                          : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={`w-4 h-4 ${isActive ? 'text-[#0F172A]' : 'text-slate-400'}`} />
                        <span>{item.label}</span>
                      </div>
                      {item.badge !== undefined && (
                        <span
                          className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                            isActive
                              ? 'bg-[#0F172A] text-[#37C6A3]'
                              : 'bg-amber-900/60 text-amber-300 border border-amber-700/60'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Faculty User Card in Sidebar Footer */}
          <div className="p-3.5 border-t border-slate-800 bg-slate-900/60">
            <div className="flex items-center justify-between gap-3 p-2 rounded-xl bg-slate-800/50 border border-slate-700/40">
              <NavLink to="/profile" className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-[#0F172A] text-[#37C6A3] font-bold text-xs flex items-center justify-center shrink-0 border border-slate-700">
                  {getInitials(profile.fullName)}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate leading-tight">
                    {profile.fullName}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    ID: {profile.employeeCode}
                  </div>
                </div>
              </NavLink>

              <button
                onClick={handleLogout}
                title="Log Out of Teacher Portal"
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition shrink-0 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Desktop Sticky Header */}
        <header className="hidden md:flex bg-white border-b border-slate-200/90 px-6 py-3 items-center justify-between sticky top-0 z-20 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400">Portal</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
            <span className="text-xs font-bold text-slate-800 capitalize">
              {getBreadcrumbTitle()}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Notifications Menu Trigger */}
            <div className="relative">
              <button
                onClick={() => setNotifDropdownOpen(!notifDropdownOpen)}
                className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl relative transition cursor-pointer"
                aria-label="View recent announcements"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#0D9488]" />
                )}
              </button>

              {notifDropdownOpen && (
                <div
                  className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 p-4 z-50"
                  onClick={() => setNotifDropdownOpen(false)}
                >
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <span className="text-xs font-bold text-slate-900">Recent Notifications</span>
                    <NavLink to="/notifications" className="text-xs text-[#0D9488] font-semibold hover:underline">
                      View all ({recentNotifications.length})
                    </NavLink>
                  </div>
                  <div className="divide-y divide-slate-100 mt-2 max-h-72 overflow-y-auto">
                    {recentNotifications.slice(0, 3).map((n) => (
                      <NavLink
                        key={n.id}
                        to="/notifications"
                        className="block py-2.5 px-2 hover:bg-slate-50 rounded-lg transition"
                      >
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className={`font-semibold ${n.priority === 'High' ? 'text-amber-700 font-bold' : 'text-slate-600'}`}>
                            {n.category}
                          </span>
                          <span className="text-slate-400">{n.timestamp}</span>
                        </div>
                        <p className="text-xs font-medium text-slate-800 line-clamp-1">{n.title}</p>
                      </NavLink>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* User Quick Pill */}
            <NavLink
              to="/profile"
              className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 transition bg-white"
            >
              <div className="w-7 h-7 rounded-lg bg-[#0F172A] text-[#37C6A3] font-bold text-xs flex items-center justify-center">
                {getInitials(profile.fullName)}
              </div>
              <div className="text-left hidden xl:block">
                <div className="text-xs font-bold text-slate-900 leading-tight">
                  {profile.fullName}
                </div>
                <div className="text-[10px] text-slate-500 font-medium">Faculty Member</div>
              </div>
            </NavLink>
          </div>
        </header>

        {/* Prototype Verification Notice Banner */}
        <div className="bg-gradient-to-r from-teal-900 to-slate-900 text-teal-100 px-4 py-2 text-xs font-medium flex items-center justify-between gap-3 border-b border-teal-800/40 print:hidden no-print">
          <div className="flex items-center gap-2 truncate">
            <span className="px-1.5 py-0.5 rounded-sm bg-[#37C6A3] text-[#0F172A] text-[10px] font-extrabold uppercase tracking-wider shrink-0">
              Teacher Portal Live
            </span>
            <span className="truncate">
              Integrated with Phase 4E-2 Persistent Backend Services — Option A attendance isolation active.
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-1 text-[11px] text-teal-300 font-mono shrink-0">
            <span>Phase 4E-3</span>
          </div>
        </div>

        {/* Dynamic Page Outlet */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>

        {/* Dedicated Teacher Portal Footer */}
        <footer className="mt-auto border-t border-slate-200 bg-white py-4 px-6 text-center text-xs text-slate-500">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>© 2026 MadrasaNexa Multi-Tenant Education Suite. All rights reserved.</span>
            <span className="text-[11px] text-slate-400">Classroom Lecture Attendance Protocol • Sri Lanka</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
