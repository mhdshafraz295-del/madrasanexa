import { useAuth } from '../../context/AuthContext';
import logoUrl from '../../assets/logo/madrasanexa-logo.png';
import { ShieldCheck, LogOut, User, CheckCircle2 } from 'lucide-react';

export default function SuperAdminWorkspace() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-[#F7F6F1] text-[#0F172A] p-4 sm:p-6 md:p-8 flex flex-col justify-between">
      <div className="max-w-4xl mx-auto w-full space-y-6">
        {/* Navigation Bar */}
        <header className="bg-white rounded-2xl p-6 border border-[#E7E9EE] shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img
              src={logoUrl}
              alt="MadrasaNexa"
              className="h-12 w-auto object-contain rounded-lg"
            />
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A] tracking-tight">
                Super Admin Workspace
              </h1>
              <p className="text-xs text-[#7C8A9A]">Platform Governance & Multi-Tenant Administration</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-[#0F172A] text-white">
              SUPER_ADMIN
            </span>
            <button
              onClick={logout}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[#F7F6F1] text-[#0F172A] hover:bg-red-50 hover:text-red-700 border border-[#E7E9EE] hover:border-red-200 transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </header>

        {/* User Session Details */}
        <div className="bg-white rounded-2xl p-6 border border-[#E7E9EE] shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-[#0F172A]/5 text-[#0F172A]">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-base text-[#0F172A]">Authenticated Administrator</h2>
              <p className="text-xs text-[#7C8A9A]">Active session details verified against MySQL</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="p-4 rounded-xl bg-[#F7F6F1] border border-[#E7E9EE]">
              <div className="text-[11px] font-medium text-[#7C8A9A] uppercase tracking-wider">Full Name</div>
              <div className="text-sm font-semibold text-[#0F172A] mt-1">{user?.name}</div>
            </div>
            <div className="p-4 rounded-xl bg-[#F7F6F1] border border-[#E7E9EE]">
              <div className="text-[11px] font-medium text-[#7C8A9A] uppercase tracking-wider">Email Address</div>
              <div className="text-sm font-semibold text-[#0F172A] mt-1 font-mono break-all">{user?.email}</div>
            </div>
            <div className="p-4 rounded-xl bg-[#F7F6F1] border border-[#E7E9EE]">
              <div className="text-[11px] font-medium text-[#7C8A9A] uppercase tracking-wider">Tenant Scope</div>
              <div className="text-sm font-semibold text-[#0F172A] mt-1">Platform Level (Global)</div>
            </div>
          </div>
        </div>

        {/* Phase 3 Status Card */}
        <div className="bg-white rounded-2xl p-6 border border-[#E7E9EE] shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-[#37C6A3]/10 text-[#37C6A3]">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-[#0F172A]">Phase 3 Authentication Verification</h3>
              <p className="text-xs text-[#7C8A9A]">Protected route and role-based redirect verified</p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#F7F6F1] border border-[#E7E9EE] text-xs text-[#0F172A] space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#37C6A3] shrink-0" />
              <span>Session restored successfully via <code>GET /api/auth/me</code></span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#37C6A3] shrink-0" />
              <span>Full business modules (tenant provisioning, plans, analytics) will be built in Phase 4</span>
            </div>
          </div>
        </div>
      </div>

      <footer className="mt-8 text-center text-xs text-[#7C8A9A]">
        MadrasaNexa SaaS Platform &copy; 2026 &bull; Super Admin Workspace
      </footer>
    </div>
  );
}
