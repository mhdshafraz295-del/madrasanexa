import { Navigate, Outlet } from 'react-router-dom';
import { useSubscription } from '../../context/SubscriptionContext';
import { Loader2 } from 'lucide-react';

interface SubscriptionRouteProps {
  children?: React.ReactNode;
}

/**
 * Route guard for tenant business workspace modules.
 *
 * Rules:
 * 1. Shows a clean loading spinner while subscription status is evaluated.
 * 2. If accessAllowed is false, seamlessly redirects to /madrasa-admin/subscription-required.
 * 3. NEVER wraps /madrasa-admin/subscription-required to prevent redirect loops.
 */
export default function SubscriptionRoute({ children }: SubscriptionRouteProps) {
  const { accessAllowed, isLoading } = useSubscription();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F7F6F1] flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#37C6A3]" />
          <p className="text-xs font-medium text-[#7C8A9A] tracking-wide">
            Verifying subscription access...
          </p>
        </div>
      </div>
    );
  }

  if (!accessAllowed) {
    return <Navigate to="/madrasa-admin/subscription-required" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}
