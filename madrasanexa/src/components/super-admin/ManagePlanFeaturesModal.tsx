import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  ArrowRight,
  Plus,
  Minus,
  RefreshCw,
} from 'lucide-react';
import {
  apiUpdatePlanFeatures,
  type PlanItem,
  type PlanDetailItem,
  type FeatureCategoryGroup,
  type UpdatePlanFeaturesResult,
} from '../../services/api';
import { PlanFeatureSelector } from './PlanFeatureSelector';

interface ManagePlanFeaturesModalProps {
  isOpen: boolean;
  plan: PlanItem | PlanDetailItem | null;
  categories: FeatureCategoryGroup[];
  onClose: () => void;
  onSuccess: (result: UpdatePlanFeaturesResult) => void;
}

export const ManagePlanFeaturesModal: React.FC<ManagePlanFeaturesModalProps> = ({
  isOpen,
  plan,
  categories,
  onClose,
  onSuccess,
}) => {
  // Authoritative initial keys from the target plan
  const initialAssignedKeys = useMemo(() => {
    if (!plan) return [];
    if (plan.assignedFeatureKeys && Array.isArray(plan.assignedFeatureKeys)) {
      return plan.assignedFeatureKeys;
    }
    if (plan.planFeatures && Array.isArray(plan.planFeatures)) {
      return plan.planFeatures.filter((pf) => pf.isEnabled).map((pf) => pf.featureKey);
    }
    return [];
  }, [plan]);

  // Set of all authoritative assignable keys in the catalogue
  const assignableKeyMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const group of categories) {
      for (const feat of group.features) {
        if (feat.status === 'IMPLEMENTED' && feat.isAssignable) {
          map.set(feat.key, feat.name);
        }
      }
    }
    return map;
  }, [categories]);

  // Selected keys state in the modal
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize selectedKeys whenever the modal opens or plan changes
  useEffect(() => {
    if (isOpen && plan) {
      // Filter initial keys to only include assignable implemented keys
      const sanitizedInitial = initialAssignedKeys.filter((k) => assignableKeyMap.has(k));
      setSelectedKeys(sanitizedInitial);
      setErrorMessage(null);
    }
  }, [isOpen, plan, initialAssignedKeys, assignableKeyMap]);

  if (!isOpen || !plan) return null;

  // Real-time diff calculation
  const initialSet = new Set(initialAssignedKeys);
  const selectedSet = new Set(selectedKeys);

  const addedKeys = selectedKeys.filter((k) => !initialSet.has(k));
  const removedKeys = initialAssignedKeys.filter((k) => !selectedSet.has(k));
  const isNoOp = addedKeys.length === 0 && removedKeys.length === 0;

  // Authoritative tenant impact counts (never fabricated)
  const activeSubs = plan.activeSubscriptionsCount ?? 0;
  const instCount = plan.institutionsCount ?? 0;

  // Handle Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isNoOp || isSubmitting) return;

    setErrorMessage(null);

    // Safeguard: Only submit keys that are IMPLEMENTED and isAssignable
    const strictlyValidKeys = selectedKeys.filter((k) => assignableKeyMap.has(k));

    try {
      setIsSubmitting(true);
      const result = await apiUpdatePlanFeatures(plan.id, {
        featureKeys: strictlyValidKeys,
      });

      // On successful save: notify parent to refresh and close
      onSuccess(result);
      onClose();
    } catch (err: any) {
      // Safeguard: On API failure, PRESERVE user's unsaved selections in local state
      const msg =
        err.response?.data?.message ||
        err.message ||
        'Failed to update plan feature assignments. Your selections have been preserved.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset to initial plan features
  const handleResetToCurrent = () => {
    const sanitizedInitial = initialAssignedKeys.filter((k) => assignableKeyMap.has(k));
    setSelectedKeys(sanitizedInitial);
    setErrorMessage(null);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-4xl w-full p-5 sm:p-6 shadow-2xl border border-[#E7E9EE] space-y-4 max-h-[92vh] flex flex-col">
        {/* 1. Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#E7E9EE] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-[#37C6A3]">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-[#0F172A]">Manage Plan Features</h3>
                <span className="font-mono text-xs font-bold text-[#7C8A9A] bg-[#F7F6F1] px-2 py-0.5 rounded-md border border-[#E7E9EE]">
                  {plan.code}
                </span>
              </div>
              <p className="text-xs text-[#7C8A9A]">
                Configure enabled entitlements for <strong className="text-[#0F172A]">{plan.name}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 text-[#7C8A9A] hover:text-[#0F172A] rounded-xl hover:bg-[#F7F6F1] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2. Authoritative Tenant Impact Notice */}
        <div
          className={`p-3.5 rounded-2xl border flex items-start gap-3 shrink-0 ${
            activeSubs > 0
              ? 'bg-amber-50/80 border-amber-200 text-amber-900'
              : 'bg-slate-50 border-slate-200 text-slate-700'
          }`}
        >
          <AlertTriangle
            className={`w-4 h-4 shrink-0 mt-0.5 ${
              activeSubs > 0 ? 'text-amber-600' : 'text-slate-500'
            }`}
          />
          <div className="text-xs space-y-0.5 flex-1">
            <span className="font-bold">Tenant Impact Assessment:</span>
            <p className="text-[11px] leading-relaxed">
              {activeSubs > 0 ? (
                <>
                  This change may affect <strong>{activeSubs}</strong> active subscription(s)
                  {instCount > 0 && <> across <strong>{instCount}</strong> institution(s)</>}. Added features will be assigned, and removed features will no longer be included in this plan for subscribed tenants.
                </>
              ) : (
                <>
                  <strong>0</strong> active subscriptions currently affected. Modifications will apply to future tenants enrolling under this plan.
                </>
              )}
            </p>
          </div>
        </div>

        {/* 3. Error Banner (Preserves state on error) */}
        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={handleResetToCurrent}
              className="text-[11px] underline font-semibold text-red-800 hover:text-red-900 cursor-pointer shrink-0"
            >
              Reset to original
            </button>
          </div>
        )}

        {/* 4. Live Diff Badge Ribbon */}
        <div className="flex flex-wrap items-center justify-between gap-2 bg-[#F7F6F1] p-2.5 rounded-xl border border-[#E7E9EE] shrink-0 text-xs">
          <div className="flex items-center gap-3">
            <span className="text-[#7C8A9A]">
              Currently assigned: <strong className="text-[#0F172A]">{initialAssignedKeys.length}</strong>
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-[#7C8A9A]" />
            <span className="text-[#7C8A9A]">
              New total: <strong className="text-[#0F172A]">{selectedKeys.length}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {addedKeys.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800">
                <Plus className="w-3 h-3" />
                {addedKeys.length} to add
              </span>
            )}
            {removedKeys.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-red-100 text-red-800">
                <Minus className="w-3 h-3" />
                {removedKeys.length} to revoke
              </span>
            )}
            {isNoOp && (
              <span className="text-[11px] text-[#7C8A9A] italic">No changes pending</span>
            )}
          </div>
        </div>

        {/* 5. Scrollable Feature Selector */}
        <div className="flex-1 overflow-y-auto min-h-0 pr-1">
          <PlanFeatureSelector
            categories={categories}
            selectedKeys={selectedKeys}
            onChange={(nextKeys) => {
              setSelectedKeys(nextKeys);
              if (errorMessage) setErrorMessage(null);
            }}
            disabled={isSubmitting}
          />
        </div>

        {/* 6. Modal Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-[#E7E9EE] shrink-0 text-xs">
          <button
            type="button"
            onClick={handleResetToCurrent}
            disabled={isNoOp || isSubmitting}
            className="px-3 py-2 text-[#7C8A9A] hover:text-[#0F172A] hover:bg-[#F7F6F1] rounded-xl font-semibold transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5 min-h-[40px]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset Changes</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 border border-[#E7E9EE] text-[#7C8A9A] hover:bg-[#F7F6F1] rounded-xl font-semibold transition cursor-pointer min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isNoOp || isSubmitting}
              className="px-5 py-2 bg-[#FFD978] hover:bg-[#ffe18f] text-[#0F172A] rounded-xl font-semibold transition flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#0F172A]" />
                  <span>Applying Changes...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-[#0F172A]" />
                  <span>{isNoOp ? 'No Changes' : 'Save Feature Entitlements'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
