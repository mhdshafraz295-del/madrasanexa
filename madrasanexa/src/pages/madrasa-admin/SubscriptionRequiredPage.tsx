import { useAuth } from '../../context/AuthContext';
import { useSubscription } from '../../context/SubscriptionContext';
import logoUrl from '../../assets/logo/madrasanexa-logo.png';
import { AlertTriangle, ShieldAlert, LogOut, RotateCw, CheckCircle, Database, CreditCard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function SubscriptionRequiredPage() {
  const { user, logout } = useAuth();
  const { subscription, refreshSubscription, accessAllowed, isLoading } = useSubscription();
  const navigate = useNavigate();

  // If subscription was restored, allow user to return to workspace
  const handleCheckStatus = async () => {
    await refreshSubscription();
    if (accessAllowed) {
      navigate('/madrasa-admin');
    }
  };

  const getStatusBadge = () => {
    const code = subscription?.code;
    switch (code) {
      case 'EXPIRED':
        return {
          label: 'Subscription Expired',
          color: 'bg-amber-100 text-amber-900 border-amber-300',
          icon: AlertTriangle,
        };
      case 'SUSPENDED':
        return {
          label: 'Subscription Suspended',
          color: 'bg-red-100 text-red-900 border-red-300',
          icon: ShieldAlert,
        };
      case 'CANCELLED':
        return {
          label: 'Subscription Cancelled',
          color: 'bg-gray-100 text-gray-900 border-gray-300',
          icon: ShieldAlert,
        };
      case 'SUBSCRIPTION_CONFLICT':
        return {
          label: 'Subscription Conflict',
          color: 'bg-red-100 text-red-900 border-red-300',
          icon: AlertTriangle,
        };
      default:
        return {
          label: 'Subscription Required',
          color: 'bg-blue-100 text-blue-900 border-blue-300',
          icon: AlertTriangle,
        };
    }
  };

  const badge = getStatusBadge();
  const IconComponent = badge.icon;

  return (
    <div className="min-h-screen bg-[#F7F6F1] text-[#0F172A] p-4 sm:p-6 md:p-8 flex flex-col justify-between">
      <div className="max-w-2xl mx-auto w-full space-y-6 pt-6 sm:pt-10">
        {/* Top Header Card */}
        <header className="bg-white rounded-2xl p-6 border border-[#E7E9EE] shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img
              src={logoUrl}
              alt="MadrasaNexa"
              className="h-12 w-auto object-contain rounded-lg"
            />
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A] tracking-tight">
                MadrasaNexa
              </h1>
              <p className="text-xs text-[#7C8A9A]">
                {user?.madrasa?.name || 'Institution Workspace'} &bull; Code: {user?.madrasa?.code || 'N/A'}
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[#F7F6F1] text-[#0F172A] hover:bg-red-50 hover:text-red-700 border border-[#E7E9EE] hover:border-red-200 transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </header>

        {/* Status Lock Card */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#E7E9EE] shadow-sm space-y-6">
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600">
              <IconComponent className="w-8 h-8" />
            </div>
            <div>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${badge.color} mb-2`}>
                {badge.label}
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-[#0F172A]">
                Workspace Access Restricted
              </h2>
            </div>
            <p className="text-sm text-[#7C8A9A] max-w-lg leading-relaxed">
              {subscription?.reason ||
                'Your institutional subscription requires renewal to access active workspace management features.'}
            </p>
          </div>

          {/* Guaranteed Data Preservation Notice */}
          <div className="p-4 rounded-xl bg-[#F7F6F1] border border-[#E7E9EE] flex items-start gap-3.5">
            <div className="p-2 rounded-lg bg-[#37C6A3]/10 text-[#37C6A3] shrink-0 mt-0.5">
              <Database className="w-4 h-4" />
            </div>
            <div className="text-xs space-y-1">
              <div className="font-semibold text-[#0F172A]">
                Your Business Data is Safe &amp; Preserved
              </div>
              <p className="text-[#7C8A9A] leading-relaxed">
                All student records, classes, invoices, payments, receipts, and configurations remain 100% intact and untouched. Subscription status is an access restriction only.
              </p>
            </div>
          </div>

          {/* Subscription Term Snapshot */}
          {subscription?.subscription && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="p-3.5 rounded-xl bg-[#F7F6F1] border border-[#E7E9EE]">
                <div className="text-[11px] font-medium text-[#7C8A9A] uppercase tracking-wider">Plan Name</div>
                <div className="text-sm font-semibold text-[#0F172A] mt-0.5">
                  {subscription.subscription.plan?.name || 'Standard Plan'}
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-[#F7F6F1] border border-[#E7E9EE]">
                <div className="text-[11px] font-medium text-[#7C8A9A] uppercase tracking-wider">Coverage Ended</div>
                <div className="text-sm font-semibold text-[#0F172A] mt-0.5 font-mono">
                  {new Date(subscription.subscription.endsAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4 border-t border-[#E7E9EE]">
            <button
              onClick={handleCheckStatus}
              disabled={isLoading}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium bg-[#0F172A] text-white hover:bg-[#1E293B] transition shadow-sm cursor-pointer disabled:opacity-60"
            >
              <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Check Access Status</span>
            </button>
            <button
              onClick={() => navigate('/madrasa-admin/subscription')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-[#F7F6F1] text-[#0F172A] hover:bg-[#E7E9EE] border border-[#E7E9EE] transition shadow-xs cursor-pointer"
            >
              <CreditCard className="w-4 h-4 text-[#37C6A3]" />
              <span>Select Plan &amp; Upload Receipt</span>
            </button>
            {accessAllowed && (
              <button
                onClick={() => navigate('/madrasa-admin')}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-[#37C6A3] text-[#0F172A] hover:bg-[#32B494] transition shadow-sm cursor-pointer"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Return to Workspace</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <footer className="mt-8 text-center text-xs text-[#7C8A9A]">
        MadrasaNexa SaaS Platform &copy; 2026 &bull; Subscription Management
      </footer>
    </div>
  );
}
