import { useState, useEffect, useRef } from 'react';
import {
  apiGetMadrasaSubscriptionOverview,
  apiGetMadrasaSubscriptionPlans,
  apiGetMadrasaPlatformBankDetails,
  apiGetMadrasaPaymentSubmissions,
  apiSubmitMadrasaPaymentReceipt,
  apiGetMadrasaPaymentSubmissionReceipt,
  type TenantSubscriptionOverview,
  type MadrasaSubscriptionPlan,
  type MadrasaPlatformBankDetails,
  type MadrasaPaymentSubmissionItem,
} from '../../services/api';
import {
  ShieldCheck,
  Clock,
  AlertCircle,
  Layers,
  Receipt,
  CheckCircle2,
  RefreshCw,
  Loader2,
  HelpCircle,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';
import { PlanCard, type PlanCardData } from '../../components/subscription/PlanCard';
import { PlanFeatureDrawer } from '../../components/subscription/PlanFeatureDrawer';
import { BankDetailsCard } from '../../components/subscription/BankDetailsCard';
import { ReceiptUploadForm } from '../../components/subscription/ReceiptUploadForm';

export default function SubscriptionPage() {
  // Subscription Overview Data
  const [overview, setOverview] = useState<TenantSubscriptionOverview | null>(null);
  const [plans, setPlans] = useState<MadrasaSubscriptionPlan[]>([]);
  const [bankDetails, setBankDetails] = useState<MadrasaPlatformBankDetails | null>(null);
  const [submissions, setSubmissions] = useState<MadrasaPaymentSubmissionItem[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selection & Drawer State
  const [selectedPlan, setSelectedPlan] = useState<MadrasaSubscriptionPlan | null>(null);
  const [selectedDrawerPlan, setSelectedDrawerPlan] = useState<PlanCardData | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Submission Status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccessMsg, setSubmitSuccessMsg] = useState<string | null>(null);
  const [submitErrorMsg, setSubmitErrorMsg] = useState<string | null>(null);

  const formSectionRef = useRef<HTMLDivElement>(null);

  const fetchAllData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [overviewData, plansData, bankData, submissionsData] = await Promise.all([
        apiGetMadrasaSubscriptionOverview(),
        apiGetMadrasaSubscriptionPlans().catch(() => []),
        apiGetMadrasaPlatformBankDetails().catch(() => null),
        apiGetMadrasaPaymentSubmissions().catch(() => []),
      ]);

      setOverview(overviewData);
      setPlans(plansData);
      setBankDetails(bankData);
      setSubmissions(submissionsData);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to load subscription data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // When a plan is selected, scroll down to the bank & payment section
  const handleSelectPlan = (plan: MadrasaSubscriptionPlan | PlanCardData) => {
    const fullPlan = plans.find((p) => p.id === plan.id) || (plan as MadrasaSubscriptionPlan);
    setSelectedPlan(fullPlan);
    setSubmitSuccessMsg(null);
    setSubmitErrorMsg(null);

    // Smooth scroll down to the bank & payment section
    setTimeout(() => {
      formSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleOpenFeatures = (plan: PlanCardData) => {
    setSelectedDrawerPlan(plan);
    setIsDrawerOpen(true);
  };

  const handleCloseFeatures = () => {
    setIsDrawerOpen(false);
    setSelectedDrawerPlan(null);
  };

  const [openingReceiptId, setOpeningReceiptId] = useState<string | null>(null);

  const handleOpenReceipt = async (submissionId: string) => {
    setOpeningReceiptId(submissionId);
    try {
      const res = await apiGetMadrasaPaymentSubmissionReceipt(submissionId);
      if (res && res.url) {
        window.open(res.url, '_blank', 'noopener,noreferrer');
      } else {
        alert('Receipt URL could not be resolved.');
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to access receipt file.');
    } finally {
      setOpeningReceiptId(null);
    }
  };

  // Submit Payment Handler
  const handleSubmitPayment = async (formData: FormData) => {
    setSubmitErrorMsg(null);
    setSubmitSuccessMsg(null);
    setIsSubmitting(true);
    try {
      const res = await apiSubmitMadrasaPaymentReceipt(formData);
      setSubmitSuccessMsg(
        res.message ||
          'Payment submission received. Your payment receipt is pending review by platform administration.'
      );

      // Refresh list of submissions and overview
      try {
        const [updatedSubmissions, updatedOverview] = await Promise.all([
          apiGetMadrasaPaymentSubmissions(),
          apiGetMadrasaSubscriptionOverview(),
        ]);
        setSubmissions(updatedSubmissions);
        if (updatedOverview) setOverview(updatedOverview);
      } catch (refreshErr) {
        console.warn('Payment receipt submitted successfully, but refreshing history data failed:', refreshErr);
      }
    } catch (err: any) {
      setSubmitErrorMsg(
        err.response?.data?.message || err.message || 'Failed to submit payment receipt. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            Active Term
          </span>
        );
      case 'EXPIRING_SOON':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
            Expiring Soon
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
            Term Expired
          </span>
        );
      case 'REQUIRED':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
            Subscription Required
          </span>
        );
      case 'SUSPENDED':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
            Suspended
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-800 border border-gray-300">
            Cancelled
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-800 border border-gray-200">
            {status}
          </span>
        );
    }
  };

  const getVerificationBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1 w-fit">
            <Clock className="w-3 h-3 text-amber-800" />
            <span>Pending Verification</span>
          </span>
        );
      case 'APPROVED':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1 w-fit">
            <CheckCircle2 className="w-3 h-3 text-emerald-700" />
            <span>Approved</span>
          </span>
        );
      case 'REJECTED':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200 flex items-center gap-1 w-fit">
            <AlertCircle className="w-3 h-3 text-red-700" />
            <span>Rejected</span>
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-800">
            {status}
          </span>
        );
    }
  };

  if (isLoading && !overview) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#37C6A3]" />
        <p className="text-xs text-[#7C8A9A]">Loading subscription plans, bank details, and payment history...</p>
      </div>
    );
  }

  if (error || !overview) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
          <span className="font-semibold">{error || 'An error occurred while loading subscription data.'}</span>
        </div>
        <button
          onClick={fetchAllData}
          className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-semibold w-fit cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  const { currentAccess, terms, payments } = overview;
  const currentSub = currentAccess.subscription;

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">Subscription &amp; Billing Portal</h1>
          <p className="text-xs text-[#7C8A9A] mt-1">
            Choose or renew a plan, inspect platform bank details, upload bank transfer receipts, and track payment verifications.
          </p>
        </div>
        <button
          onClick={fetchAllData}
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-[#E7E9EE] hover:bg-[#F7F6F1] text-xs font-semibold text-[#0F172A] rounded-xl transition shadow-xs cursor-pointer w-fit"
        >
          <RefreshCw className="w-3.5 h-3.5 text-[#7C8A9A]" />
          <span>Refresh Details</span>
        </button>
      </div>

      {/* Expiring Soon or Expired Alert */}
      {currentAccess.isExpiringSoon && (
        <div className="bg-[#FFD978]/25 border border-[#FFD978]/80 rounded-2xl p-5 flex items-start gap-4 shadow-xs">
          <div className="p-2.5 rounded-xl bg-[#FFD978]/60 text-amber-950 shrink-0 mt-0.5">
            <Clock className="w-5 h-5 text-amber-900" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-[#0F172A]">Subscription Renewal Recommended</h3>
            <p className="text-xs text-[#0F172A]/80 leading-relaxed">
              Your institution's current subscription will expire in{' '}
              <span className="font-bold">{currentAccess.daysRemaining} days</span>. Select a plan below to extend coverage consecutively without losing active days.
            </p>
          </div>
        </div>
      )}

      {!currentAccess.allowed && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-start gap-4 shadow-xs">
          <div className="p-2.5 rounded-xl bg-red-100 text-red-700 shrink-0 mt-0.5">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-red-900">Subscription Activation Required</h3>
            <p className="text-xs text-red-800 leading-relaxed">
              {currentAccess.status === 'REQUIRED'
                ? 'Your institution requires an active subscription to access full management features. Please select a plan below and submit your bank transfer receipt.'
                : 'Your previous subscription term has expired. Select a renewal plan below and upload your transfer receipt to unlock full platform access.'}
            </p>
          </div>
        </div>
      )}

      {/* Current Subscription Card */}
      <div className="bg-white rounded-2xl border border-[#E7E9EE] p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E7E9EE]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#0F172A] text-white flex items-center justify-center shrink-0 shadow-xs">
              <ShieldCheck className="w-6 h-6 text-[#37C6A3]" />
            </div>
            <div>
              <div className="text-xs font-semibold text-[#7C8A9A] uppercase tracking-wider">Current SaaS Term</div>
              <h2 className="text-xl font-bold text-[#0F172A]">{currentSub?.plan?.name || 'No Active Term'}</h2>
            </div>
          </div>
          <div>{getStatusBadge(currentAccess.status)}</div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-[#F7F6F1] border border-[#E7E9EE]">
            <div className="text-[11px] font-semibold text-[#7C8A9A] uppercase tracking-wider">Access Status</div>
            <div className="text-sm font-bold text-[#0F172A] mt-1 flex items-center gap-1.5">
              {currentAccess.allowed ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-[#37C6A3]" />
                  <span>Operational</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  <span>Access Restricted</span>
                </>
              )}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#F7F6F1] border border-[#E7E9EE]">
            <div className="text-[11px] font-semibold text-[#7C8A9A] uppercase tracking-wider">Days Remaining</div>
            <div className="text-sm font-bold text-[#0F172A] mt-1">
              {currentAccess.daysRemaining} {currentAccess.daysRemaining === 1 ? 'Day' : 'Days'}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#F7F6F1] border border-[#E7E9EE]">
            <div className="text-[11px] font-semibold text-[#7C8A9A] uppercase tracking-wider">Term Starts</div>
            <div className="text-sm font-bold text-[#0F172A] mt-1 font-mono">
              {currentSub?.startsAt ? new Date(currentSub.startsAt).toLocaleDateString() : 'N/A'}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#F7F6F1] border border-[#E7E9EE]">
            <div className="text-[11px] font-semibold text-[#7C8A9A] uppercase tracking-wider">Term Ends</div>
            <div className="text-sm font-bold text-[#0F172A] mt-1 font-mono">
              {currentSub?.endsAt ? new Date(currentSub.endsAt).toLocaleDateString() : 'N/A'}
            </div>
          </div>
        </div>

        {/* Zero Business Data Deletion Notice */}
        <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200/80 flex items-start gap-3">
          <HelpCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-xs text-blue-900 leading-relaxed">
            <span className="font-bold">Zero Data Loss Guarantee:</span> Even if your subscription term reaches expiration, your Madrasa's records—including students, classes, invoices, fee payments, and audit logs—remain 100% intact and preserved permanently in the database.
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: SELECT SUBSCRIPTION PLAN */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-[#E7E9EE] shadow-xs p-6 sm:p-8 space-y-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#37C6A3] uppercase tracking-wider">
            <span>Step 1 of 2</span>
          </div>
          <h2 className="text-xl font-bold text-[#0F172A] mt-0.5 flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#37C6A3]" />
            <span>Select a Subscription Plan</span>
          </h2>
          <p className="text-xs text-[#7C8A9A] mt-1">
            Choose an active institutional subscription tier. Click any plan card to view official bank transfer instructions and unlock the receipt upload form.
          </p>
        </div>

        {plans.length === 0 ? (
          <div className="p-8 text-center bg-[#F7F6F1] rounded-2xl border border-dashed border-[#E7E9EE] text-xs text-[#7C8A9A]">
            No subscription plans are currently available. Please contact platform administration.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
            {plans.map((plan) => {
              const code = (plan.code || '').toUpperCase();
              const name = (plan.name || '').toLowerCase();
              const isRecommended =
                (plan as any).isRecommended === true ||
                code === '079438_GOLD' ||
                (name.includes('dynamic') && name.includes('gold'));

              const cardData: PlanCardData = {
                id: plan.id,
                name: plan.name,
                code: plan.code,
                description: plan.description,
                price: plan.price,
                durationMonths: plan.durationMonths,
                isActive: plan.isActive,
                isRecommended,
                originalPrice: plan.originalPrice ?? null,
                isSpecialOffer: Boolean(plan.isSpecialOffer),
                specialOfferLabel: plan.specialOfferLabel ?? null,
              };

              return (
                <PlanCard
                  key={plan.id}
                  plan={cardData}
                  mode="admin"
                  isSelected={selectedPlan?.id === plan.id}
                  onSelect={handleSelectPlan}
                  onViewFeatures={handleOpenFeatures}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SECTION 2: BANK DETAILS & PAYMENT SUBMISSION FORM (VISIBLE ON PLAN SELECT) */}
      {/* ========================================================================= */}
      <div ref={formSectionRef}>
        {!selectedPlan ? (
          <div className="bg-[#F7F6F1] rounded-2xl border border-dashed border-[#E7E9EE] p-8 text-center text-[#7C8A9A] space-y-2">
            <h3 className="text-sm font-semibold text-[#0F172A]">Payment &amp; Upload Instructions</h3>
            <p className="text-xs max-w-md mx-auto">
              Please click and select one of the subscription plans above to view official bank transfer account details and open the receipt upload form.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <BankDetailsCard
              bankDetails={bankDetails}
              selectedPlan={{
                id: selectedPlan.id,
                name: selectedPlan.name,
                code: selectedPlan.code,
                description: selectedPlan.description,
                price: selectedPlan.price,
                durationMonths: selectedPlan.durationMonths,
                isActive: selectedPlan.isActive,
                isRecommended: (selectedPlan as any).isRecommended === true,
              }}
            />

            <ReceiptUploadForm
              selectedPlan={{
                id: selectedPlan.id,
                name: selectedPlan.name,
                code: selectedPlan.code,
                description: selectedPlan.description,
                price: selectedPlan.price,
                durationMonths: selectedPlan.durationMonths,
                isActive: selectedPlan.isActive,
              }}
              bankConfigured={Boolean(bankDetails?.isConfigured)}
              onSubmit={handleSubmitPayment}
              isSubmitting={isSubmitting}
              submitSuccessMsg={submitSuccessMsg}
              submitErrorMsg={submitErrorMsg}
            />
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SECTION 3: PAYMENT VERIFICATION HISTORY */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-[#E7E9EE] shadow-xs overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-[#E7E9EE] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
              <Receipt className="w-4 h-4 text-[#37C6A3]" />
              <span>Payment Submissions &amp; Verification History</span>
            </h2>
            <p className="text-xs text-[#7C8A9A] mt-0.5">
              Live audit record of your submitted bank transfer receipts and platform administrator review statuses.
            </p>
          </div>
          <span className="text-xs text-[#7C8A9A] font-medium">
            Total submissions: <strong className="text-[#0F172A]">{submissions.length}</strong>
          </span>
        </div>

        {submissions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F7F6F1] text-[#7C8A9A] font-semibold uppercase tracking-wider border-b border-[#E7E9EE] whitespace-nowrap">
                <tr>
                  <th className="px-6 py-3">Plan</th>
                  <th className="px-6 py-3">Amount</th>
                  <th className="px-6 py-3">Payment Date</th>
                  <th className="px-6 py-3">Reference</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Receipt Slip</th>
                  <th className="px-6 py-3">Submitted At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E9EE] text-[#0F172A]">
                {submissions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-[#F7F6F1]/50 transition">
                    <td className="px-6 py-3.5">
                      <div className="font-bold text-[#0F172A]">{sub.planName}</div>
                      <div className="text-[11px] text-[#7C8A9A]">
                        {sub.planDurationMonths} Months term
                      </div>
                    </td>
                    <td className="px-6 py-3.5 font-mono font-bold text-emerald-700">
                      LKR {sub.submittedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-3.5 font-mono text-[11px] text-[#7C8A9A]">
                      {new Date(sub.paymentDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-3.5 font-mono text-[11px]">
                      {sub.reference || <span className="text-[#7C8A9A]">—</span>}
                    </td>
                    <td className="px-6 py-3.5 space-y-1">
                      {getVerificationBadge(sub.status)}
                      {sub.status === 'REJECTED' && sub.rejectionReason && (
                        <div className="p-2 rounded-lg bg-red-50 border border-red-200 text-red-800 text-[11px] leading-relaxed max-w-xs mt-1">
                          <span className="font-bold">Reason:</span> {sub.rejectionReason}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-3.5">
                      {sub.receipt ? (
                        <button
                          onClick={() => handleOpenReceipt(sub.id)}
                          disabled={openingReceiptId === sub.id}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F7F6F1] hover:bg-[#E7E9EE] border border-[#E7E9EE] text-[11px] font-semibold text-[#0F172A] transition cursor-pointer disabled:opacity-50 whitespace-nowrap"
                        >
                          {openingReceiptId === sub.id ? (
                            <Loader2 className="w-3 h-3 animate-spin text-[#37C6A3]" />
                          ) : (
                            <ExternalLink className="w-3 h-3 text-[#37C6A3]" />
                          )}
                          <span>View Receipt</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-[#7C8A9A]">File Unavailable</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 font-mono text-[11px] text-[#7C8A9A]">
                      {new Date(sub.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-[#7C8A9A] space-y-1">
            <p>No payment submissions recorded yet.</p>
            <p className="text-[11px]">
              Select a plan above and upload your transfer receipt to initiate verification.
            </p>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SECTION 4: HISTORICAL SUBSCRIPTION TERMS */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-[#E7E9EE] shadow-xs overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-[#E7E9EE]">
          <h2 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#37C6A3]" />
            <span>Activated Subscription Term History</span>
          </h2>
          <p className="text-xs text-[#7C8A9A] mt-0.5">Consecutive institutional service terms activated for your Madrasa.</p>
        </div>

        {terms && terms.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F7F6F1] text-[#7C8A9A] font-semibold uppercase tracking-wider border-b border-[#E7E9EE] whitespace-nowrap">
                <tr>
                  <th className="px-6 py-3">Plan Name</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Term Period</th>
                  <th className="px-6 py-3">Duration</th>
                  <th className="px-6 py-3">Term Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E9EE] text-[#0F172A]">
                {terms.map((term) => (
                  <tr key={term.id} className="hover:bg-[#F7F6F1]/50 transition">
                    <td className="px-6 py-3.5 font-semibold">{term.plan.name}</td>
                    <td className="px-6 py-3.5">{getStatusBadge(term.status)}</td>
                    <td className="px-6 py-3.5 font-mono text-[11px] text-[#7C8A9A]">
                      {new Date(term.startsAt).toLocaleDateString()} &rarr; {new Date(term.endsAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-3.5">{term.durationMonthsAtPurchase} Months</td>
                    <td className="px-6 py-3.5 font-mono font-bold">LKR {term.priceAtPurchase.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-[#7C8A9A]">No previous terms recorded.</div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SECTION 5: PLATFORM PAYMENTS RECORDED */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-[#E7E9EE] shadow-xs overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-[#E7E9EE]">
          <h2 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
            <Receipt className="w-4 h-4 text-emerald-600" />
            <span>Platform Subscription Ledger Payments</span>
          </h2>
          <p className="text-xs text-[#7C8A9A] mt-0.5">SaaS subscription payment transactions recorded in ledger by platform administration.</p>
        </div>

        {payments && payments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F7F6F1] text-[#7C8A9A] font-semibold uppercase tracking-wider border-b border-[#E7E9EE] whitespace-nowrap">
                <tr>
                  <th className="px-6 py-3">Paid Date</th>
                  <th className="px-6 py-3">Amount</th>
                  <th className="px-6 py-3">Payment Method</th>
                  <th className="px-6 py-3">Transaction Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E9EE] text-[#0F172A]">
                {payments.map((pay) => (
                  <tr key={pay.id} className="hover:bg-[#F7F6F1]/50 transition">
                    <td className="px-6 py-3.5 font-mono text-[11px]">{new Date(pay.paidAt).toLocaleDateString()}</td>
                    <td className="px-6 py-3.5 font-bold font-mono text-emerald-700">LKR {pay.amount.toFixed(2)}</td>
                    <td className="px-6 py-3.5">
                      <span className="px-2 py-0.5 rounded font-mono text-[11px] bg-[#0F172A]/5 text-[#0F172A]">
                        {pay.paymentMethod}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 font-mono text-[11px] text-[#7C8A9A]">{pay.reference || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-[#7C8A9A]">No platform payments recorded for this tenant yet.</div>
        )}
      </div>

      {/* Feature Details Modal / Drawer */}
      <PlanFeatureDrawer
        isOpen={isDrawerOpen}
        onClose={handleCloseFeatures}
        plan={selectedDrawerPlan}
      />
    </div>
  );
}
