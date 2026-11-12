import React, { useState } from 'react';
import { Building2, Copy, Check, AlertTriangle, HelpCircle, ShieldCheck } from 'lucide-react';
import type { PlanCardData } from './PlanCard';

export interface PlatformBankDetails {
  isConfigured: boolean;
  bankName: string | null;
  accountName: string | null;
  accountNumber: string | null;
  branch: string | null;
  instructions: string | null;
}

export interface BankDetailsCardProps {
  bankDetails: PlatformBankDetails | null;
  selectedPlan: PlanCardData;
}

export const BankDetailsCard: React.FC<BankDetailsCardProps> = ({
  bankDetails,
  selectedPlan,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string | null | undefined, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey(null);
    }, 2000);
  };

  const numericPrice = typeof selectedPlan.price === 'string' ? parseFloat(selectedPlan.price) : selectedPlan.price;
  const formattedPrice = isNaN(numericPrice)
    ? String(selectedPlan.price)
    : numericPrice.toLocaleString('en-LK', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

  const durationText = selectedPlan.durationMonths === 1 ? '1 Month' : `${selectedPlan.durationMonths} Months`;

  return (
    <div className="bg-white rounded-2xl border border-[#E7E9EE] shadow-xs p-6 sm:p-8 space-y-6">
      {/* Header and Step Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E7E9EE]">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#37C6A3] uppercase tracking-wider">
            <span>Step 2 of 2</span>
          </div>
          <h2 className="text-xl font-bold text-[#0F172A] mt-0.5 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#37C6A3]" />
            <span>Official Bank Transfer Details</span>
          </h2>
          <p className="text-xs text-[#7C8A9A] mt-1">
            Initiate a bank transfer or direct deposit using the verified platform bank coordinates below.
          </p>
        </div>

        {/* Selected Plan Payable Context Box */}
        <div className="p-3.5 rounded-xl bg-[#F7F6F1] border border-[#E7E9EE] flex flex-wrap sm:flex-nowrap items-center gap-3 sm:gap-4 min-w-0">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#7C8A9A]">
              Payable Amount
            </div>
            <div className="font-mono text-base font-bold text-[#0F172A]">
              LKR {formattedPrice}
            </div>
          </div>
          <div className="h-8 w-px bg-[#E7E9EE]" />
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#7C8A9A]">
              Selected Tier
            </div>
            <div className="text-xs font-semibold text-[#0F172A]">
              {selectedPlan.name} ({durationText})
            </div>
          </div>
        </div>
      </div>

      {/* Official Bank Coordinates or Unconfigured Warning */}
      {!bankDetails || !bankDetails.isConfigured ? (
        <div className="p-5 bg-amber-50 border border-amber-300 rounded-2xl flex items-start gap-3.5 text-amber-950">
          <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs leading-relaxed">
            <p className="font-bold text-sm text-amber-900">
              Official Bank Details Not Configured
            </p>
            <p className="text-amber-800">
              Platform administration has not yet configured the official institutional bank account details. Payment receipt submissions are temporarily paused until valid banking coordinates are published.
            </p>
            <p className="text-amber-700 font-medium">
              Please contact platform administration to request bank details setup.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-5 bg-[#F7F6F1] rounded-2xl border border-[#E7E9EE]">
            {/* Bank Name */}
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-[#7C8A9A] uppercase tracking-wider">
                Bank Name
              </span>
              <div className="text-sm font-bold text-[#0F172A]">
                {bankDetails.bankName || 'N/A'}
              </div>
            </div>

            {/* Account Name */}
            <div className="space-y-1 min-w-0">
              <span className="text-[11px] font-semibold text-[#7C8A9A] uppercase tracking-wider">
                Account Name
              </span>
              <div className="text-sm font-bold text-[#0F172A] flex items-center justify-between pr-2">
                <span className="truncate mr-2">{bankDetails.accountName || 'N/A'}</span>
                {bankDetails.accountName && (
                  <button
                    type="button"
                    onClick={() => handleCopy(bankDetails.accountName, 'accName')}
                    aria-label="Copy Account Name"
                    className="p-1.5 hover:bg-white rounded-lg text-[#7C8A9A] hover:text-[#0F172A] border border-transparent hover:border-[#E7E9EE] transition cursor-pointer relative"
                  >
                    {copiedKey === 'accName' ? (
                      <span className="flex items-center gap-1 text-[11px] text-emerald-700 font-bold">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        <span>Copied</span>
                      </span>
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Account Number */}
            <div className="space-y-1 min-w-0">
              <span className="text-[11px] font-semibold text-[#7C8A9A] uppercase tracking-wider">
                Account Number
              </span>
              <div className="text-sm font-bold font-mono text-[#0F172A] flex items-center justify-between pr-2">
                <span className="truncate mr-2">{bankDetails.accountNumber || 'N/A'}</span>
                {bankDetails.accountNumber && (
                  <button
                    type="button"
                    onClick={() => handleCopy(bankDetails.accountNumber, 'accNum')}
                    aria-label="Copy Account Number"
                    className="p-1.5 hover:bg-white rounded-lg text-[#7C8A9A] hover:text-[#0F172A] border border-transparent hover:border-[#E7E9EE] transition cursor-pointer relative"
                  >
                    {copiedKey === 'accNum' ? (
                      <span className="flex items-center gap-1 text-[11px] text-emerald-700 font-bold">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        <span>Copied</span>
                      </span>
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Branch */}
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-[#7C8A9A] uppercase tracking-wider">
                Branch
              </span>
              <div className="text-sm font-bold text-[#0F172A]">
                {bankDetails.branch || 'N/A'}
              </div>
            </div>
          </div>

          {/* Official Instructions */}
          {bankDetails.instructions && (
            <div className="p-4 bg-white rounded-xl border border-[#E7E9EE] text-xs text-[#0F172A] leading-relaxed flex items-start gap-2.5">
              <HelpCircle className="w-4 h-4 text-[#89865D] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Official Transfer Instructions: </span>
                <span className="text-[#7C8A9A]">{bankDetails.instructions}</span>
              </div>
            </div>
          )}

          {/* Institutional Compliance Notice */}
          <div className="flex items-center gap-2 text-[11px] text-[#7C8A9A] pt-1">
            <ShieldCheck className="w-3.5 h-3.5 text-[#37C6A3] shrink-0" />
            <span>
              All transactions are reconciled directly against platform institutional accounts.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
