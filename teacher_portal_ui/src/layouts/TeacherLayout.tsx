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
  Lock,
} from 'lucide-react';
import type {
  TeacherProfile,
} from '../mock/teacherMockData';
import { authApi, profileApi, notificationsApi, resolveAssetUrl } from '../services/api';
import { teacherAiService } from '../services/ai.service';
import { TEACHER_NAV_ITEMS, type TeacherNavItem as NavItem } from '../components/layout/TeacherNavigation';
import NotificationDrawer from '../components/notifications/NotificationDrawer';
import AiRobotMascot from '../components/ai/AiRobotMascot';
import GlobalAiCopilotDrawer from '../components/ai/GlobalAiCopilotDrawer';

export default function TeacherLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [profile, setProfile] = useState<TeacherProfile | null>(null);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [logoError, setLogoError] = useState(false);
  const [photoError, setPhotoError] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;
    teacherAiService.getAiStatus().then((s) => {
      if (isMounted) setAiEnabled(s.aiEnabled);
    }).catch(() => {});

    const handleUnauthorized = () => {
      navigate('/login');
    };
    const handleProfileUpdated = (e: any) => {
      if (e.detail) {
        setProfile((prev) => (prev ? { ...prev, ...e.detail } : e.detail));
      } else {
        profileApi.getProfile().then((p) => {
          if (isMounted && p) setProfile(p);
        }).catch(() => {});
      }
    };
    const handleTeacherUserUpdated = () => {
      const stored = authApi.getStoredUser();
      if (stored && isMounted) {
        setProfile((prev) => prev ? {
          ...prev,
          fullName: stored.name || prev.fullName,
          avatarUrl: (stored.photoUrl || stored.avatarUrl || stored.teacherProfile?.photoUrl || stored.teacherProfile?.avatarUrl || prev.avatarUrl) as string,
          photoUrl: (stored.photoUrl || stored.avatarUrl || stored.teacherProfile?.photoUrl || stored.teacherProfile?.avatarUrl || prev.photoUrl) as string,
        } : null);
        setPhotoError(false);
      }
      profileApi.getProfile().then((p) => {
        if (isMounted && p) {
          setProfile(p);
          setPhotoError(false);
        }
      }).catch(() => {});
    };

    const refreshNotifications = () => {
      notificationsApi
        .getNotifications()
        .then((res) => {
          if (isMounted && res) {
            if (res.unreadCount !== undefined) setUnreadCount(res.unreadCount);
          }
        })
        .catch(() => {});
    };

    window.addEventListener('teacher:unauthorized', handleUnauthorized);
    window.addEventListener('teacher:logout', handleUnauthorized);
    window.addEventListener('teacher:profile-updated', handleProfileUpdated);
    window.addEventListener('teacher_user_updated', handleTeacherUserUpdated);
    window.addEventListener('focus', refreshNotifications);
    window.addEventListener('teacher:notifications-updated', refreshNotifications);

    // Initial fetch
    refreshNotifications();

    // 30-second interval real-time polling
    const pollTimer = setInterval(refreshNotifications, 30000);

    const stored = authApi.getStoredUser();
    if (stored) {
      setProfile((prev) => prev || ({
        id: stored.id,
        fullName: stored.name,
        email: stored.email,
        employeeCode: stored.teacherProfile?.ustadhCode || 'UST',
        status: 'Active',
        avatarUrl: stored.photoUrl || stored.avatarUrl || stored.teacherProfile?.photoUrl || stored.teacherProfile?.avatarUrl || '',
        photoUrl: stored.photoUrl || stored.avatarUrl || stored.teacherProfile?.photoUrl || stored.teacherProfile?.avatarUrl || '',
        madrasa: stored.madrasa,
      } as any));
    }

    profileApi
      .getProfile()
      .then((p) => {
        if (isMounted && p) setProfile(p);
      })
      .catch(() => {});

    return () => {
      isMounted = false;
      clearInterval(pollTimer);
      window.removeEventListener('teacher:unauthorized', handleUnauthorized);
      window.removeEventListener('teacher:logout', handleUnauthorized);
      window.removeEventListener('teacher:profile-updated', handleProfileUpdated);
      window.removeEventListener('teacher_user_updated', handleTeacherUserUpdated);
      window.removeEventListener('focus', refreshNotifications);
      window.removeEventListener('teacher:notifications-updated', refreshNotifications);
    };
  }, [navigate]);

  const handleLogout = () => {
    authApi.logout();
    navigate('/login');
  };

  const activeNavItems: NavItem[] = TEACHER_NAV_ITEMS;

  const profileAny = profile as any;
  const madrasaName = profileAny?.institution?.name || profileAny?.madrasa?.name || 'MadrasaNexa';
  const madrasaCode = profileAny?.institution?.code || profileAny?.madrasa?.code || 'MNX';
  const rawLogoUrl = profileAny?.institution?.logoUrl || profileAny?.madrasa?.logoUrl;
  const resolvedLogoUrl = resolveAssetUrl(rawLogoUrl);
  const rawPhotoUrl = profile?.photoUrl || profile?.avatarUrl;
  const resolvedPhotoUrl = resolveAssetUrl(rawPhotoUrl);
  const madrasaInitials = madrasaName
    .split(' ')
    .filter(Boolean)
    .map((p: string) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'MS';
  const teacherInitials = profile?.fullName
    ? profile.fullName
        .split(' ')
        .filter(Boolean)
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'FA';

  return (
    <div className="min-h-screen bg-[#F7F6F1] flex flex-col md:flex-row text-[#0F172A] print:min-h-0 print:h-auto print:bg-white print:p-0 print:m-0">
      {/* 1. Mobile Header */}
      <header className="md:hidden bg-white border-b border-[#E7E9EE] px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-2 sticky top-0 z-30 shadow-xs print:hidden no-print">
        <div className="flex items-center gap-2 min-w-0">
          {resolvedLogoUrl && !logoError ? (
            <div className="h-8 w-8 rounded-lg overflow-hidden bg-white border border-[#E7E9EE] shrink-0 p-0.5 shadow-xs flex items-center justify-center">
              <img
                src={resolvedLogoUrl}
                alt={madrasaName}
                onError={() => setLogoError(true)}
                className="w-full h-full object-cover rounded-md"
              />
            </div>
          ) : (
            <div className="h-8 w-8 rounded-lg bg-[#0F172A] text-[#37C6A3] font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
              {madrasaInitials}
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
          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            className="p-1.5 text-slate-500 hover:text-[#0F172A] rounded-lg border border-[#E7E9EE] bg-white relative cursor-pointer"
            aria-label="Staff Notices and Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 px-1.5 py-0.2 text-[9px] font-bold text-white bg-rose-500 rounded-full min-w-4 text-center shadow-xs animate-pulse">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
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
        className={`fixed md:sticky top-0 left-0 h-screen w-64 bg-white border-r border-[#E7E9EE] flex flex-col justify-between z-40 transition-transform duration-200 ease-in-out md:translate-x-0 print:hidden no-print ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-5 flex flex-col h-full overflow-y-auto">
          {/* Institution & Brand Header */}
          <div className="pb-5 border-b border-[#E7E9EE]">
            <div className="flex items-center gap-3">
              {resolvedLogoUrl && !logoError ? (
                <div className="h-10 w-10 rounded-xl overflow-hidden bg-white border border-[#E7E9EE] shrink-0 p-0.5 shadow-xs flex items-center justify-center">
                  <img
                    src={resolvedLogoUrl}
                    alt={madrasaName}
                    onError={() => setLogoError(true)}
                    className="w-full h-full object-cover rounded-lg"
                  />
                </div>
              ) : (
                <div className="h-10 w-10 rounded-xl bg-[#0F172A] text-[#37C6A3] font-bold text-sm flex items-center justify-center shrink-0 shadow-xs">
                  {madrasaInitials}
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
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                      isActive
                        ? 'bg-[#0F172A] text-white shadow-xs'
                        : 'text-[#7C8A9A] hover:text-[#0F172A] hover:bg-[#F7F6F1]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {item.isAi ? (
                        <div className="w-5 h-5 flex items-center justify-center shrink-0">
                          <AiRobotMascot variant="avatar" size={20} />
                        </div>
                      ) : (
                        <Icon className="w-4 h-4 shrink-0" />
                      )}
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.isAi && !aiEnabled && (
                      <span
                        className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-200/80 px-1.5 py-0.5 rounded-md"
                        title="AI Subscription Required"
                      >
                        <Lock className="w-2.5 h-2.5 text-amber-600" />
                      </span>
                    )}
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
                  <div className="w-8 h-8 rounded-full bg-[#0F172A] text-white flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                    {resolvedPhotoUrl && !photoError ? (
                      <img
                        src={resolvedPhotoUrl}
                        alt={profile?.fullName || 'Avatar'}
                        onError={() => setPhotoError(true)}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      profile?.fullName?.[0]?.toUpperCase() || 'U'
                    )}
                  </div>
                  <div className="overflow-hidden">
                    <div className="text-xs font-semibold text-[#0F172A] truncate">
                      {profile?.fullName || 'Faculty Member'}
                    </div>
                    <div className="text-[10px] text-[#7C8A9A] truncate font-mono">
                      {profile?.email || 'faculty@madrasanexa.lk'}
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
          className="fixed inset-0 bg-black/30 z-30 md:hidden backdrop-blur-xs print:hidden no-print"
        />
      )}

      {/* 3. Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 print:w-full print:block">
        {/* Desktop Top Header Bar */}
        <header className="hidden md:flex items-center justify-between bg-white border-b border-[#E7E9EE] px-4 lg:px-8 py-3.5 sticky top-0 z-30 shadow-xs print:hidden no-print">
          <div className="min-w-0 pr-4">
            <h2 className="text-xs font-semibold text-[#7C8A9A] uppercase tracking-wider truncate">
              {madrasaName}
            </h2>
            <div className="text-sm font-bold text-[#0F172A] truncate">
              Teacher & Ustadh Workspace
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 flex-wrap justify-end">
            <button
              type="button"
              onClick={() => setIsDrawerOpen(true)}
              className="p-2 text-slate-500 hover:text-[#0F172A] hover:bg-[#F7F6F1] rounded-xl transition relative border border-[#E7E9EE] cursor-pointer"
              aria-label="Staff Notices and Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 px-1.5 py-0.5 text-[10px] font-bold text-white bg-rose-500 rounded-full min-w-4 text-center shadow-xs animate-pulse">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold bg-[#37C6A3]/15 text-[#0F172A] border border-[#37C6A3]/30 shrink-0">
              USTADH / TEACHER
            </span>
          </div>
        </header>

        {/* Page Content Outlet */}
        <main className="flex-1 p-3 sm:p-5 md:p-8 max-w-7xl mx-auto w-full min-w-0 print:p-0 print:m-0 print:max-w-none print:w-full print:block print:border-none print:shadow-none">
          <Outlet />
        </main>

        {/* Institutional Footer */}
        <footer className="p-4 sm:p-6 text-center text-xs text-[#7C8A9A] border-t border-[#E7E9EE] bg-white print:hidden no-print">
          MadrasaNexa &copy; 2026 &bull; Production SaaS Platform for Islamic Educational Institutions
        </footer>
      </div>

      {/* Staff Notices Real-Time Slide-over Drawer */}
      <div className="print:hidden no-print">
        <NotificationDrawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          onCountChange={setUnreadCount}
        />
      </div>

      {/* Global Persistent Slide-Over AI Copilot Side Drawer */}
      <GlobalAiCopilotDrawer />
    </div>
  );
}
