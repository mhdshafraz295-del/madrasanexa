import { useAuth } from '../../context/AuthContext';
import { useSubscription } from '../../context/SubscriptionContext';
import logoUrl from '../../assets/logo/madrasanexa-logo.png';
import { Building2, LogOut, User, CheckCircle2, Clock } from 'lucide-react';

export default function MadrasaAdminWorkspace() {
  const { user, logout } = useAuth();
  const { subscription, isExpiringSoon, daysRemaining } = useSubscription();

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
                Madrasa Admin Workspace
              </h1>
              <p className="text-xs text-[#7C8A9A]">
                {user?.madrasa?.name || 'Institution Workspace'} &bull; Code: {user?.madrasa?.code || 'N/A'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-[#37C6A3]/15 text-[#0F172A] border border-[#37C6A3]/30">
              MADRASA_ADMIN
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

        {/* Expiring Soon Alert Banner */}
        {isExpiringSoon && (
          <div className="bg-[#FFD978]/20 border border-[#FFD978]/60 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5 shadow-sm">
            <div className="p-2 rounded-xl bg-[#FFD978]/40 text-amber-900 shrink-0 mt-0.5">
              <Clock className="w-5 h-5" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-[#0F172A]">
                  Subscription Expiring Soon
                </h4>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#FFD978] text-amber-950 uppercase tracking-wide">
                  {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} left
                </span>
              </div>
              <p className="text-xs text-[#0F172A]/80 leading-relaxed">
                Your institution's subscription expires on{' '}
                <span className="font-semibold">
                  {subscription?.subscription?.endsAt
                    ? new Date(subscription.subscription.endsAt).toLocaleDateString()
                    : 'shortly'}
                </span>
                . Your records will always be preserved, but renew promptly to avoid any interruption in workspace operations.
              </p>
            </div>
          </div>
        )}

        {/* User Session & Tenant Details */}
        <div className="bg-white rounded-2xl p-6 border border-[#E7E9EE] shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-[#0F172A]/5 text-[#0F172A]">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-base text-[#0F172A]">Institutional Administrator</h2>
              <p className="text-xs text-[#7C8A9A]">Tenant-isolated session authenticated via MySQL</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="p-4 rounded-xl bg-[#F7F6F1] border border-[#E7E9EE]">
              <div className="text-[11px] font-medium text-[#7C8A9A] uppercase tracking-wider">Full Name</div>
              <div className="text-sm font-semibold text-[#0F172A] mt-1">{user?.name}</div>
            </div>
            <div className="p-4 rounded-xl bg-[#F7F6F1] border border-[#E7E9EE]">
              <div className="text-[11px] font-medium text-[#7C8A9A] uppercase tracking-wider">Email Address</div>
              <div className="text-sm font-semibold text-[#0F172A] mt-1 font-mono">{user?.email}</div>
            </div>
            <div className="p-4 rounded-xl bg-[#F7F6F1] border border-[#E7E9EE]">
              <div className="text-[11px] font-medium text-[#7C8A9A] uppercase tracking-wider">Assigned Madrasa</div>
              <div className="text-sm font-semibold text-[#0F172A] mt-1">
                {user?.madrasa?.name || user?.madrasaId || 'Associated'}
              </div>
            </div>
          </div>
        </div>

        {/* Phase 3 Status Card */}
        <div className="bg-white rounded-2xl p-6 border border-[#E7E9EE] shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-[#37C6A3]/10 text-[#37C6A3]">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-[#0F172A]">Tenant Workspace Operational</h3>
              <p className="text-xs text-[#7C8A9A]">Protected role routing verified</p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#F7F6F1] border border-[#E7E9EE] text-xs text-[#0F172A] space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#37C6A3] shrink-0" />
              <span>Tenant session verified and validated against active Madrasa status</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#37C6A3] shrink-0" />
              <span>Tenant business modules (Students, Fees, Invoices, POS) will be built in subsequent phases</span>
            </div>
          </div>
        </div>
      </div>

      <footer className="mt-8 text-center text-xs text-[#7C8A9A]">
        MadrasaNexa SaaS Platform &copy; 2026 &bull; Madrasa Admin Workspace
      </footer>
    </div>
  );
}
