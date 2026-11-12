import { useState, useEffect } from 'react';
import {
  apiGetSuperAdminPlatformBankDetails,
  apiUpdateSuperAdminPlatformBankDetails,
  type SuperAdminPlatformBankDetails,
} from '../../services/api';
import {
  Building2,
  Landmark,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Loader2,
  Save,
  HelpCircle,
  Copy,
  Check,
  AlertTriangle,
} from 'lucide-react';

export default function BankDetailsPage() {
  const [bankData, setBankData] = useState<SuperAdminPlatformBankDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Form input state
  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [branch, setBranch] = useState('');
  const [instructions, setInstructions] = useState('');

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const fetchBankDetails = async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const data = await apiGetSuperAdminPlatformBankDetails();
      setBankData(data);
      if (data && data.isConfigured) {
        setBankName(data.bankName || '');
        setAccountName(data.accountName || '');
        setAccountNumber(data.accountNumber || '');
        setBranch(data.branch || '');
        setInstructions(data.instructions || '');
      } else {
        // Zero fake defaults: keep fields clean and unconfigured
        setBankName('');
        setAccountName('');
        setAccountNumber('');
        setBranch('');
        setInstructions('');
      }
    } catch (err: any) {
      setFetchError(
        err.response?.data?.message || err.message || 'Failed to load platform bank configuration.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBankDetails();
  }, []);

  const handleCopy = (text: string, fieldKey: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldKey);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMsg(null);

    const trimmedBankName = bankName.trim();
    const trimmedAccountName = accountName.trim();
    const trimmedAccountNumber = accountNumber.trim();
    const trimmedBranch = branch.trim();
    const trimmedInstructions = instructions.trim();

    // Frontend validation
    if (!trimmedBankName) {
      setFormError('Bank Name is required.');
      return;
    }
    if (trimmedBankName.length < 2) {
      setFormError('Bank Name must be at least 2 characters.');
      return;
    }

    if (!trimmedAccountName) {
      setFormError('Account Name is required.');
      return;
    }
    if (trimmedAccountName.length < 2) {
      setFormError('Account Name must be at least 2 characters.');
      return;
    }

    if (!trimmedAccountNumber) {
      setFormError('Account Number is required.');
      return;
    }
    if (trimmedAccountNumber.length < 2) {
      setFormError('Account Number must be at least 2 characters.');
      return;
    }

    if (!trimmedBranch) {
      setFormError('Branch is required.');
      return;
    }
    if (trimmedBranch.length < 2) {
      setFormError('Branch must be at least 2 characters.');
      return;
    }

    setIsSaving(true);
    try {
      const updated = await apiUpdateSuperAdminPlatformBankDetails({
        bankName: trimmedBankName,
        accountName: trimmedAccountName,
        accountNumber: trimmedAccountNumber,
        branch: trimmedBranch,
        instructions: trimmedInstructions || null,
      });

      setBankData(updated);
      setBankName(updated.bankName || '');
      setAccountName(updated.accountName || '');
      setAccountNumber(updated.accountNumber || '');
      setBranch(updated.branch || '');
      setInstructions(updated.instructions || '');

      setSuccessMsg('Bank details updated successfully.');
    } catch (err: any) {
      setFormError(
        err.response?.data?.message || err.message || 'Failed to update platform bank details. Please check inputs.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#37C6A3]" />
        <p className="text-xs text-[#7C8A9A]">Loading platform bank details...</p>
      </div>
    );
  }

  if (fetchError && !bankData) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
          <span className="font-semibold">{fetchError}</span>
        </div>
        <button
          onClick={fetchBankDetails}
          className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-semibold w-fit cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  const isConfigured = Boolean(bankData?.isConfigured);

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">Platform Bank Details</h1>
            {isConfigured ? (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>Active &amp; Configured</span>
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-amber-800" />
                <span>Not Configured</span>
              </span>
            )}
          </div>
          <p className="text-xs text-[#7C8A9A] mt-1">
            Configure the official bank account used for Madrasa subscription payments.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchBankDetails}
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-[#E7E9EE] hover:bg-[#F7F6F1] text-xs font-semibold text-[#0F172A] rounded-xl transition shadow-xs cursor-pointer w-fit"
        >
          <RefreshCw className="w-3.5 h-3.5 text-[#7C8A9A]" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Unconfigured Alert Banner */}
      {!isConfigured && (
        <div className="p-5 bg-amber-50 border border-amber-300 rounded-2xl flex items-start gap-3.5 text-amber-950 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs leading-relaxed">
            <p className="font-bold text-sm text-amber-900">
              Bank payment details have not been configured yet.
            </p>
            <p className="text-amber-800">
              Madrasa Administrators cannot submit subscription payment receipts until you configure valid platform bank coordinates below.
            </p>
            <p className="text-amber-700 font-medium">
              Please enter the official bank name, account name, account number, and branch to activate subscription payment collections.
            </p>
          </div>
        </div>
      )}

      {/* Success Notification */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-xs text-emerald-900 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">{successMsg}</span>
        </div>
      )}

      {/* Error Notification */}
      {formError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-xs text-red-900 shadow-xs">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span className="font-semibold">{formError}</span>
        </div>
      )}

      {/* Main Form & Preview Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Column */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-[#E7E9EE] shadow-xs p-6 sm:p-8 space-y-6">
          <div className="pb-4 border-b border-[#E7E9EE] flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#0F172A] flex items-center gap-2">
                <Landmark className="w-5 h-5 text-[#37C6A3]" />
                <span>Account Configuration</span>
              </h2>
              <p className="text-xs text-[#7C8A9A] mt-0.5">
                Official deposit and wire transfer details visible to approved Madrasa Administrators.
              </p>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Bank Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#0F172A] flex items-center gap-1">
                  <span>Bank Name</span>
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g. Bank of Ceylon / Commercial Bank"
                  required
                  className="w-full px-3.5 py-2.5 bg-[#F7F6F1] border border-[#E7E9EE] focus:border-[#37C6A3] focus:bg-white rounded-xl text-xs text-[#0F172A] outline-hidden transition"
                />
                <p className="text-[11px] text-[#7C8A9A]">Full legal name of the banking institution.</p>
              </div>

              {/* Account Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#0F172A] flex items-center gap-1">
                  <span>Account Name (Beneficiary)</span>
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="e.g. MadrasaNexa Platform Pvt Ltd"
                  required
                  className="w-full px-3.5 py-2.5 bg-[#F7F6F1] border border-[#E7E9EE] focus:border-[#37C6A3] focus:bg-white rounded-xl text-xs text-[#0F172A] outline-hidden transition"
                />
                <p className="text-[11px] text-[#7C8A9A]">Beneficiary or organization account title.</p>
              </div>

              {/* Account Number */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#0F172A] flex items-center gap-1">
                  <span>Account Number</span>
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="e.g. 1000293847"
                  required
                  className="w-full px-3.5 py-2.5 bg-[#F7F6F1] border border-[#E7E9EE] focus:border-[#37C6A3] focus:bg-white rounded-xl text-xs font-mono font-bold text-[#0F172A] outline-hidden transition"
                />
                <p className="text-[11px] text-[#7C8A9A]">Official bank account or IBAN number.</p>
              </div>

              {/* Branch */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#0F172A] flex items-center gap-1">
                  <span>Branch</span>
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="e.g. Colombo Fort / Corporate Branch"
                  required
                  className="w-full px-3.5 py-2.5 bg-[#F7F6F1] border border-[#E7E9EE] focus:border-[#37C6A3] focus:bg-white rounded-xl text-xs text-[#0F172A] outline-hidden transition"
                />
                <p className="text-[11px] text-[#7C8A9A]">Branch name or location code.</p>
              </div>
            </div>

            {/* Instructions */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#0F172A]">
                Transfer Instructions &amp; Notes (Optional)
              </label>
              <textarea
                rows={3}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="e.g. Please include your Madrasa Code as the bank reference/narration. Upload transfer slip after completing payment."
                className="w-full px-3.5 py-2.5 bg-[#F7F6F1] border border-[#E7E9EE] focus:border-[#37C6A3] focus:bg-white rounded-xl text-xs text-[#0F172A] outline-hidden transition"
              />
              <p className="text-[11px] text-[#7C8A9A]">
                Guidance shown to Madrasa Admins before they initiate a bank transfer.
              </p>
            </div>

            {/* Save Button */}
            <div className="pt-3 border-t border-[#E7E9EE] flex items-center justify-end gap-3">
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-[#0F172A] text-white hover:bg-[#1E293B] transition shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#37C6A3]" />
                    <span>Saving Platform Details...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 text-[#37C6A3]" />
                    <span>Save Platform Bank Details</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Live Portal Preview Column */}
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-[#E7E9EE] shadow-xs p-5 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-[#E7E9EE]">
              <Building2 className="w-4 h-4 text-[#37C6A3]" />
              <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                Madrasa Portal Live Preview
              </h3>
            </div>
            <p className="text-[11px] text-[#7C8A9A] leading-relaxed">
              This is how the bank details card appears to Madrasa Admins on their Subscription &amp; Billing page.
            </p>

            {bankName || accountName || accountNumber || branch ? (
              <div className="p-4 bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl space-y-3">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-semibold text-[#7C8A9A] uppercase tracking-wider">Bank</span>
                  <div className="text-xs font-bold text-[#0F172A]">{bankName || '—'}</div>
                </div>

                <div className="space-y-0.5">
                  <span className="text-[10px] font-semibold text-[#7C8A9A] uppercase tracking-wider">Account Title</span>
                  <div className="text-xs font-bold text-[#0F172A] flex items-center justify-between">
                    <span className="truncate">{accountName || '—'}</span>
                    {accountName && (
                      <button
                        type="button"
                        onClick={() => handleCopy(accountName, 'prevAccName')}
                        className="p-1 hover:bg-white rounded text-[#7C8A9A] transition cursor-pointer"
                        title="Copy"
                      >
                        {copiedField === 'prevAccName' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-0.5">
                  <span className="text-[10px] font-semibold text-[#7C8A9A] uppercase tracking-wider">Account Number</span>
                  <div className="text-xs font-bold font-mono text-[#0F172A] flex items-center justify-between">
                    <span className="truncate">{accountNumber || '—'}</span>
                    {accountNumber && (
                      <button
                        type="button"
                        onClick={() => handleCopy(accountNumber, 'prevAccNum')}
                        className="p-1 hover:bg-white rounded text-[#7C8A9A] transition cursor-pointer"
                        title="Copy"
                      >
                        {copiedField === 'prevAccNum' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-0.5">
                  <span className="text-[10px] font-semibold text-[#7C8A9A] uppercase tracking-wider">Branch</span>
                  <div className="text-xs font-bold text-[#0F172A]">{branch || '—'}</div>
                </div>

                {instructions && (
                  <div className="pt-2 border-t border-[#E7E9EE] text-[11px] text-[#0F172A] flex items-start gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-[#37C6A3] shrink-0 mt-0.5" />
                    <span className="text-[#7C8A9A] line-clamp-3">{instructions}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6 text-center bg-[#F7F6F1] border border-dashed border-[#E7E9EE] rounded-xl text-[11px] text-[#7C8A9A] space-y-1">
                <AlertCircle className="w-5 h-5 text-[#7C8A9A] mx-auto opacity-60" />
                <p>No bank details configured.</p>
                <p className="text-[10px]">Madrasas will see "Bank payment details are not configured yet."</p>
              </div>
            )}
          </div>

          {/* Security & Tenant Isolation Notice */}
          <div className="p-4 bg-white rounded-2xl border border-[#E7E9EE] shadow-xs space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-[#0F172A]">
              <ShieldCheck className="w-4 h-4 text-[#37C6A3]" />
              <span>Platform Singleton Security</span>
            </div>
            <p className="text-[11px] text-[#7C8A9A] leading-relaxed">
              These coordinates are stored in the singleton <code className="text-[#0F172A] font-mono font-bold">PlatformBankSetting</code>. Only authenticated Super Administrators have permission to modify these details.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
