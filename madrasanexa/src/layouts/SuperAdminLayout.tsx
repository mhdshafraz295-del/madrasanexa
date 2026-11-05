import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logoUrl from '../assets/logo/madrasanexa-logo.png';
import {
  LayoutDashboard,
  ClipboardList,
  Building2,
  Layers,
  CreditCard,
  History,
  LogOut,
  Menu,
  X,
  Shield,
  FileText,
  Megaphone,
  Landmark,
  Receipt,
  Globe,
} from 'lucide-react';

const navItems = [
  { to: '/super-admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/super-admin/onboarding', label: 'Approval Center', icon: ClipboardList },
  { to: '/super-admin/madrasas', label: 'Madrasas', icon: Building2 },
  { to: '/super-admin/plans', label: 'Subscription Plans', icon: Layers },
  { to: '/super-admin/subscriptions', label: 'Subscriptions', icon: CreditCard },
  { to: '/super-admin/subscription-payments', label: 'Subscription Payments', icon: Receipt },
  { to: '/super-admin/bank-details', label: 'Bank Details', icon: Landmark },
  { to: '/super-admin/announcements', label: 'Announcement Center', icon: Megaphone },
  { to: '/super-admin/about-us', label: 'About Us CMS', icon: FileText },
  { to: '/super-admin/website-content', label: 'Website Content', icon: Globe },
  { to: '/super-admin/activity-logs', label: 'Platform Activity', icon: History },
];

export default function SuperAdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#F7F6F1] flex flex-col md:flex-row text-[#0F172A]">
      {/* Mobile Top Header */}
      <header className="md:hidden bg-white border-b border-[#E7E9EE] px-4 py-3 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-2.5">
          <img src={logoUrl} alt="MadrasaNexa" className="h-8 w-auto object-contain" />
          <span className="text-xs font-bold uppercase tracking-wider bg-[#0F172A] text-white px-2 py-0.5 rounded">
            Super Admin
          </span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-[#7C8A9A] hover:text-[#0F172A] rounded-lg border border-[#E7E9EE] bg-white cursor-pointer"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Sidebar for Desktop & Mobile Drawer */}
      <aside
        className={`fixed md:sticky top-0 left-0 h-screen w-64 bg-white border-r border-[#E7E9EE] flex flex-col justify-between z-40 transition-transform duration-200 ease-in-out md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-5">
          {/* Logo Brand */}
          <div className="flex items-center gap-3 pb-6 border-b border-[#E7E9EE]">
            <img src={logoUrl} alt="MadrasaNexa" className="h-10 w-auto object-contain" />
            <div>
              <div className="text-sm font-bold tracking-tight text-[#0F172A]">MadrasaNexa</div>
              <div className="flex items-center gap-1 text-[11px] font-semibold text-[#37C6A3]">
                <Shield className="w-3 h-3" />
                <span>Super Admin</span>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="mt-6 space-y-1">
            {navItems.map((item) => {
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
                        ? 'bg-[#0F172A] text-white shadow-sm'
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

        {/* User Session & Logout Footer */}
        <div className="p-4 border-t border-[#E7E9EE] bg-[#FAFAF8] space-y-3">
          <div className="p-2.5 rounded-xl bg-white border border-[#E7E9EE] flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#0F172A]/10 text-[#0F172A] flex items-center justify-center font-bold text-xs">
              {user?.name?.charAt(0) || 'A'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-[#0F172A] truncate">{user?.name}</p>
              <p className="text-[10px] text-[#7C8A9A] truncate">{user?.email}</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Backdrop for mobile drawer */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/30 z-30 md:hidden backdrop-blur-xs"
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 flex flex-col min-h-screen">
        <div className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </div>
        <footer className="py-4 px-6 border-t border-[#E7E9EE] bg-white text-center text-xs text-[#7C8A9A]">
          MadrasaNexa &copy; {new Date().getFullYear()} &bull; Multi-Tenant Platform Administration
        </footer>
      </main>
    </div>
  );
}
