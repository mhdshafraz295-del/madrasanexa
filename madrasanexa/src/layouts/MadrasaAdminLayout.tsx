import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../context/SubscriptionContext';
import { getMadrasaInitials } from '../utils/initials';
import {
  LayoutDashboard,
  Settings,
  CreditCard,
  History,
  GraduationCap,
  BookOpen,
  Receipt,
  Coins,
  Banknote,
  FileBarChart,
  LogOut,
  Menu,
  X,
  KeyRound,
  Clock,
  Building2,
  ChevronDown,
  Info,
  Megaphone,
  ClipboardCheck,
  CalendarCheck,
  UserCheck,
  Calendar,
  ReceiptText,
  Bell,
  Globe,
  UserPlus,
  ShieldCheck,
} from 'lucide-react';
import AnnouncementBell from '../components/announcement/AnnouncementBell';

const activeNavItems = [
  { to: '/madrasa-admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/madrasa-admin/admissions', label: 'Admissions & Intake', icon: UserPlus },
  { to: '/madrasa-admin/students', label: 'Students', icon: GraduationCap },
  { to: '/madrasa-admin/alumni-network', label: 'Alumni Network & Verification', icon: ShieldCheck },
  { to: '/madrasa-admin/classes', label: 'Classes', icon: BookOpen },
  { to: '/madrasa-admin/attendance', label: 'Attendance', icon: CalendarCheck },
  { to: '/madrasa-admin/timetable', label: 'Weekly Timetable', icon: Calendar },
  { to: '/madrasa-admin/marking-hub', label: 'Marking Hub', icon: ClipboardCheck },
  { to: '/madrasa-admin/ustadh-management', label: 'Ustadh & Teacher Management', icon: UserCheck },
  { to: '/madrasa-admin/fee-pos', label: 'Fee POS', icon: Coins },
  { to: '/madrasa-admin/invoices', label: 'Invoices', icon: Receipt },
  { to: '/madrasa-admin/payments', label: 'Payments', icon: Banknote },
  { to: '/madrasa-admin/reports', label: 'Reports', icon: FileBarChart },
  { to: '/madrasa-admin/communication-logs', label: 'Communication Logs', icon: Bell },
  { to: '/madrasa-admin/portal-cms', label: 'Public Portal CMS', icon: Globe },
  { to: '/madrasa-admin/settings', label: 'Madrasa Settings', icon: Settings },
  { to: '/madrasa-admin/subscription', label: 'Subscription', icon: CreditCard },
  { to: '/madrasa-admin/announcements', label: 'Announcements', icon: Megaphone },
  { to: '/madrasa-admin/about-us', label: 'About MadrasaNexa', icon: Info },
  { to: '/madrasa-admin/activity', label: 'Activity Logs', icon: History },
];

const financeNavItems = [
  { to: '/madrasa-admin/expense-analysis', label: 'Expense Analysis', icon: ReceiptText },
];

const upcomingModules: { label: string; icon: any }[] = [];

export default function MadrasaAdminLayout() {
  const { user, logout } = useAuth();
  const { isExpiringSoon, daysRemaining } = useSubscription();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    setLogoError(false);
  }, [user?.madrasa?.logoUrl]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const madrasaName = user?.madrasa?.name || 'Madrasa Workspace';
  const madrasaInitials = getMadrasaInitials(madrasaName);
  const customLogoUrl = user?.madrasa?.logoUrl;

  return (
    <div className="min-h-screen bg-[#F7F6F1] flex flex-col md:flex-row text-[#0F172A]">
      {/* Mobile Header */}
      <header className="md:hidden bg-white border-b border-[#E7E9EE] px-4 py-3 flex items-center justify-between gap-2 sticky top-0 z-30 shadow-xs print:hidden">
        <div className="flex items-center gap-2.5 min-w-0">
          {customLogoUrl && !logoError ? (
            <img
              src={customLogoUrl}
              alt={madrasaName}
              onError={() => setLogoError(true)}
              className="h-8 w-8 rounded-lg object-contain bg-white border border-[#E7E9EE] shrink-0 p-0.5"
            />
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
              {user?.madrasa?.code || 'TENANT'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <AnnouncementBell />
          {isExpiringSoon && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
              <Clock className="w-2.5 h-2.5" />
              <span>{daysRemaining}d</span>
            </span>
          )}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-[#7C8A9A] hover:text-[#0F172A] rounded-lg border border-[#E7E9EE] bg-white cursor-pointer"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Sidebar Navigation */}
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
                  {madrasaInitials}
                </div>
              )}
              <div className="overflow-hidden">
                <div className="text-sm font-bold tracking-tight text-[#0F172A] truncate">
                  {madrasaName}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#7C8A9A]">
                  <Building2 className="w-3 h-3 text-[#37C6A3]" />
                  <span className="font-mono">{user?.madrasa?.code || 'WORKSPACE'}</span>
                </div>
              </div>
            </div>

            {/* Expiring Soon Banner in Sidebar */}
            {isExpiringSoon && (
              <div className="mt-3.5 p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-amber-900">
                <Clock className="w-4 h-4 shrink-0 text-amber-600" />
                <div className="text-[11px] leading-tight">
                  <span className="font-bold">Expiring in {daysRemaining} days.</span>
                  <div className="text-[10px] text-amber-700">Records remain safe.</div>
                </div>
              </div>
            )}
          </div>

          {/* Active Navigation Links */}
          <div className="mt-5">
            <div className="text-[10px] font-bold text-[#7C8A9A] uppercase tracking-wider px-3 mb-2">
              Workspace Modules
            </div>
            <nav className="space-y-1">
              {activeNavItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                        isActive
                          ? 'bg-[#0F172A] text-white shadow-xs'
                          : 'text-[#7C8A9A] hover:text-[#0F172A] hover:bg-[#F7F6F1]'
                      }`
                    }
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>

          {/* Finance */}
          <div className="mt-5">
            <div className="text-[10px] font-bold text-[#7C8A9A] uppercase tracking-wider px-3 mb-2">
              Finance
            </div>
            <nav className="space-y-1">
              {financeNavItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                        isActive
                          ? 'bg-[#0F172A] text-white shadow-xs'
                          : 'text-[#7C8A9A] hover:text-[#0F172A] hover:bg-[#F7F6F1]'
                      }`
                    }
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>

          {/* Upcoming Business Modules */}
          <div className="mt-6 pt-5 border-t border-[#E7E9EE]">
            <div className="text-[10px] font-bold text-[#7C8A9A] uppercase tracking-wider px-3 mb-2">
              Upcoming Modules
            </div>
            <div className="space-y-1">
              {upcomingModules.map((m) => {
                const Icon = m.icon;
                return (
                  <div
                    key={m.label}
                    className="flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-medium text-[#7C8A9A]/70 cursor-not-allowed select-none"
                    title="Available in upcoming release"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-4 h-4 text-[#7C8A9A]/50" />
                      <span>{m.label}</span>
                    </div>
                    <span className="text-[9px] font-bold bg-[#E7E9EE]/60 text-[#7C8A9A] px-1.5 py-0.5 rounded uppercase">
                      Soon
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* User Session Details & Controls */}
          <div className="mt-auto pt-5 border-t border-[#E7E9EE]">
            <div className="relative">
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-[#F7F6F1] transition border border-transparent hover:border-[#E7E9EE] cursor-pointer"
              >
                <div className="flex items-center gap-2.5 overflow-hidden text-left">
                  <div className="w-8 h-8 rounded-full bg-[#0F172A] text-white flex items-center justify-center font-bold text-xs shrink-0">
                    {user?.name?.[0]?.toUpperCase() || 'A'}
                  </div>
                  <div className="overflow-hidden">
                    <div className="text-xs font-semibold text-[#0F172A] truncate">{user?.name}</div>
                    <div className="text-[10px] text-[#7C8A9A] truncate font-mono">{user?.email}</div>
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-[#7C8A9A] shrink-0 ml-1" />
              </button>

              {userDropdownOpen && (
                <div className="absolute bottom-full left-0 w-full mb-2 bg-white rounded-xl border border-[#E7E9EE] shadow-lg p-1.5 space-y-1 z-50">
                  <Link
                    to="/change-password"
                    onClick={() => setUserDropdownOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-[#0F172A] hover:bg-[#F7F6F1] rounded-lg transition"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-[#7C8A9A]" />
                    <span>Change Password</span>
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

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Desktop Top Header Bar */}
        <header className="hidden md:flex items-center justify-between bg-white border-b border-[#E7E9EE] px-8 py-3.5 sticky top-0 z-30 shadow-xs print:hidden">
          <div>
            <h2 className="text-xs font-semibold text-[#7C8A9A] uppercase tracking-wider">
              {user?.madrasa?.name || 'Institution Workspace'}
            </h2>
            <div className="text-sm font-bold text-[#0F172A]">Madrasa Administrative Workspace</div>
          </div>
          <div className="flex items-center gap-3">
            <AnnouncementBell />
            {isExpiringSoon && (
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200">
                <Clock className="w-3.5 h-3.5 text-amber-700" />
                <span>Expires in {daysRemaining} days</span>
              </div>
            )}
            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold bg-[#37C6A3]/15 text-[#0F172A] border border-[#37C6A3]/30">
              MADRASA_ADMIN
            </span>
          </div>
        </header>

        {/* Page Content Outlet */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl mx-auto w-full print:p-0 print:max-w-none">
          <Outlet />
        </main>

        <footer className="p-4 sm:p-6 text-center text-xs text-[#7C8A9A] border-t border-[#E7E9EE] bg-white print:hidden">
          MadrasaNexa &copy; 2026 &bull; Production SaaS Platform for Islamic Educational Institutions
        </footer>
      </div>
    </div>
  );
}
