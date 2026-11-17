import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Calendar,
  BookOpen,
  Bell,
  Settings,
  LogOut,
  Menu,
  X,
  QrCode,
  ScanLine,
  History,
  Banknote,
  Building2,
  KeyRound,
  ChevronDown,
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
  end?: boolean;
}

export default function TeacherLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [profile, setProfile] = useState<TeacherProfile>(MOCK_TEACHER_PROFILE);
  const [unreadCount, setUnreadCount] = useState<number>(MOCK_NOTIFICATIONS.filter((n) => !n.isRead).length);
  const [logoError, setLogoError] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleUnauthorized = () => {
      navigate('/login');
    };
    const handleProfileUpdated = (e: any) => {
      if (e.detail) {
        setProfile((prev) => ({ ...prev, ...e.detail }));
      } else {
        profileApi.getProfile().then((p) => {
          if (isMounted && p) setProfile(p);
        }).catch(() => {});
      }
    };
    window.addEventListener('teacher:unauthorized', handleUnauthorized);
    window.addEventListener('teacher:logout', handleUnauthorized);
    window.addEventListener('teacher:profile-updated', handleProfileUpdated);

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
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
      window.removeEventListener('teacher:unauthorized', handleUnauthorized);
      window.removeEventListener('teacher:logout', handleUnauthorized);
      window.removeEventListener('teacher:profile-updated', handleProfileUpdated);
    };
  }, [navigate]);

  const handleLogout = () => {
    authApi.logout();
    navigate('/login');
  };

  const activeNavItems: NavItem[] = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/attendance/my', label: 'Attendance Check-In', icon: QrCode },
    { to: '/timetable', label: 'Timetable', icon: Calendar },
    { to: '/classes', label: 'Classes & Subjects', icon: BookOpen },
    { to: '/attendance/students', label: 'Student Attendance', icon: ScanLine },
    { to: '/attendance/history', label: 'Attendance History', icon: History },
    { to: '/salary', label: 'My Salary & Payslips', icon: Banknote },
    { to: '/notifications', label: 'Notifications', icon: Bell },
  ];

  const profileAny = profile as any;
  const madrasaName = profileAny?.institution?.name || profileAny?.madrasa?.name || MOCK_INSTITUTION_INFO.name;
  const madrasaCode = profileAny?.institution?.code || profileAny?.madrasa?.code || MOCK_INSTITUTION_INFO.code;
  const customLogoUrl = profileAny?.institution?.logoUrl || profileAny?.madrasa?.logoUrl;
  const teacherInitials = profile?.fullName
    ? profile.fullName
        .split(' ')
        .filter(Boolean)
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'UT';

  return (
    <div className="min-h-screen bg-[#F7F6F1] flex flex-col md:flex-row text-[#0F172A]">
      {/* 1. Mobile Header */}
      <header className="md:hidden bg-white border-b border-[#E7E9EE] px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-2 sticky top-0 z-30 shadow-xs print:hidden">
        <div className="flex items-center gap-2 min-w-0">
          {customLogoUrl && !logoError ? (
            <img
              src={customLogoUrl}
              alt={madrasaName}
              onError={() => setLogoError(true)}
              className="h-8 w-8 rounded-lg object-contain bg-white border border-[#E7E9EE] shrink-0 p-0.5"
            />
          ) : (
            <div className="h-8 w-8 rounded-lg bg-[#0F172A] text-[#37C6A3] font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
              {teacherInitials}
            </div>
          )}
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold text-[#0F172A] leading-tight truncate">
              {madrasaName}
            </span>
            <span className="text-[10px] text-[#7C8A9A] font-mono truncate">
              {madrasaCode}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <NavLink
            to="/notifications"
            className="p-1.5 text-slate-500 hover:text-[#0F172A] rounded-lg border border-[#E7E9EE] bg-white relative"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#10B981]" />
            )}
          </NavLink>
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-[#37C6A3]/15 text-[#0F172A] border border-[#37C6A3]/30">
            TEACHER
          </span>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 sm:p-2 text-[#7C8A9A] hover:text-[#0F172A] rounded-lg border border-[#E7E9EE] bg-white cursor-pointer"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* 2. Left Sidebar Navigation (Matching Admin Layout) */}
      <aside
        className={`fixed md:sticky top-0 left-0 h-screen w-64 bg-white border-r border-[#E7E9EE] flex flex-col justify-between z-40 transition-transform duration-200 ease-in-out md:translate-x-0 print:hidden ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-5 flex flex-col h-full overflow-y-auto">
          {/* Institution & Brand Header */}
          <div className="pb-5 border-b border-[#E7E9EE]">
            <div className="flex items-center gap-3">
              {customLogoUrl && !logoError ? (
                <img
                  src={customLogoUrl}
                  alt={madrasaName}
                  onError={() => setLogoError(true)}
                  className="h-10 w-10 rounded-xl object-contain bg-white border border-[#E7E9EE] shrink-0 p-1 shadow-xs"
                />
              ) : (
                <div className="h-10 w-10 rounded-xl bg-[#0F172A] text-[#37C6A3] font-bold text-sm flex items-center justify-center shrink-0 shadow-xs">
                  {teacherInitials}
                </div>
              )}
              <div className="overflow-hidden">
                <div className="text-sm font-bold tracking-tight text-[#0F172A] truncate">
                  {madrasaName}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#7C8A9A]">
                  <Building2 className="w-3 h-3 text-[#37C6A3]" />
                  <span className="font-mono">{madrasaCode}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Teacher Modules Navigation Links */}
          <div className="mt-5">
            <div className="text-[10px] font-bold text-[#7C8A9A] uppercase tracking-wider px-3 mb-2">
              Teacher Modules
            </div>
            <nav className="space-y-1">
              {activeNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = item.end
                  ? location.pathname === '/' || location.pathname === item.to
                  : location.pathname.startsWith(item.to);

                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                      isActive
                        ? 'bg-[#0F172A] text-white shadow-xs'
                        : 'text-[#7C8A9A] hover:text-[#0F172A] hover:bg-[#F7F6F1]'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>

          {/* User Session Details & Controls at bottom of sidebar */}
          <div className="mt-auto pt-5 border-t border-[#E7E9EE]">
            <div className="relative">
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-[#F7F6F1] transition border border-transparent hover:border-[#E7E9EE] cursor-pointer"
              >
                <div className="flex items-center gap-2.5 overflow-hidden text-left">
                  <div className="w-8 h-8 rounded-full bg-[#0F172A] text-white flex items-center justify-center font-bold text-xs shrink-0">
                    {profile.fullName?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <div className="overflow-hidden">
                    <div className="text-xs font-semibold text-[#0F172A] truncate">
                      {profile.fullName}
                    </div>
                    <div className="text-[10px] text-[#7C8A9A] truncate font-mono">
                      {profile.email}
                    </div>
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-[#7C8A9A] shrink-0 ml-1" />
              </button>

              {userDropdownOpen && (
                <div className="absolute bottom-full left-0 w-full mb-2 bg-white rounded-xl border border-[#E7E9EE] shadow-lg p-1.5 space-y-1 z-50">
                  <Link
                    to="/profile"
                    onClick={() => setUserDropdownOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-[#0F172A] hover:bg-[#F7F6F1] rounded-lg transition"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-[#7C8A9A]" />
                    <span>Faculty Profile</span>
                  </Link>
                  <Link
                    to="/settings"
                    onClick={() => setUserDropdownOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-[#0F172A] hover:bg-[#F7F6F1] rounded-lg transition"
                  >
                    <Settings className="w-3.5 h-3.5 text-[#7C8A9A]" />
                    <span>Account Settings</span>
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition text-left cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5 text-red-500" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/30 z-30 md:hidden backdrop-blur-xs print:hidden"
        />
      )}

      {/* 3. Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Desktop Top Header Bar */}
        <header className="hidden md:flex items-center justify-between bg-white border-b border-[#E7E9EE] px-4 lg:px-8 py-3.5 sticky top-0 z-30 shadow-xs print:hidden">
          <div className="min-w-0 pr-4">
            <h2 className="text-xs font-semibold text-[#7C8A9A] uppercase tracking-wider truncate">
              {madrasaName}
            </h2>
            <div className="text-sm font-bold text-[#0F172A] truncate">
              Teacher & Ustadh Workspace
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 flex-wrap justify-end">
            <NavLink
              to="/notifications"
              className="p-2 text-slate-500 hover:text-[#0F172A] hover:bg-[#F7F6F1] rounded-xl transition relative border border-[#E7E9EE]"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#10B981]" />
              )}
            </NavLink>
            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold bg-[#37C6A3]/15 text-[#0F172A] border border-[#37C6A3]/30 shrink-0">
              USTADH / TEACHER
            </span>
          </div>
        </header>

        {/* Page Content Outlet */}
        <main className="flex-1 p-3 sm:p-5 md:p-8 max-w-7xl mx-auto w-full min-w-0 print:p-0 print:max-w-none">
          <Outlet />
        </main>

        {/* Institutional Footer */}
        <footer className="p-4 sm:p-6 text-center text-xs text-[#7C8A9A] border-t border-[#E7E9EE] bg-white print:hidden">
          MadrasaNexa &copy; 2026 &bull; Production SaaS Platform for Islamic Educational Institutions
        </footer>
      </div>
    </div>
  );
}
