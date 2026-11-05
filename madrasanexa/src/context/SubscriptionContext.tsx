import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { apiGetMySubscription, type SubscriptionSummary } from '../services/api';

interface SubscriptionContextType {
  subscription: SubscriptionSummary | null;
  isLoading: boolean;
  accessAllowed: boolean;
  refreshSubscription: () => Promise<void>;
  isExpiringSoon: boolean;
  daysRemaining: number;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchSubscription = useCallback(async () => {
    // Wait until auth state has finished initializing
    if (authLoading) {
      return;
    }

    // Only MADRASA_ADMIN has tenant subscriptions to fetch
    if (!isAuthenticated || !user || user.role !== 'MADRASA_ADMIN') {
      setSubscription(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const data = await apiGetMySubscription();
      setSubscription(data);
    } catch (error) {
      console.error('Failed to load subscription status:', error);
      // In case of network error, preserve prior state or default to safe locked
      setSubscription((prev) => prev || {
        allowed: false,
        code: 'SUBSCRIPTION_REQUIRED',
        status: 'REQUIRED',
        daysRemaining: 0,
        reason: 'Unable to verify subscription status.',
        subscription: null,
      });
    } finally {
      setIsLoading(false);
    }
  }, [authLoading, isAuthenticated, user]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  // Prevent premature evaluation before auth or subscription data resolves
  const effectiveLoading = isLoading || authLoading || (user?.role === 'MADRASA_ADMIN' && subscription === null);

  // SUPER_ADMIN is exempt from tenant subscription restrictions
  const accessAllowed = user?.role === 'SUPER_ADMIN' ? true : Boolean(subscription?.allowed);
  const isExpiringSoon = subscription?.code === 'EXPIRING_SOON';
  const daysRemaining = subscription?.daysRemaining ?? 0;

  return (
    <SubscriptionContext.Provider
      value={{
        subscription,
        isLoading: effectiveLoading,
        accessAllowed,
        refreshSubscription: fetchSubscription,
        isExpiringSoon,
        daysRemaining,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription(): SubscriptionContextType {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}
