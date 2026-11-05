import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  X,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Loader2,
  ArrowRight,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import type { PlanCardData } from './PlanCard';

export interface ReceiptUploadFormProps {
  selectedPlan: PlanCardData;
  bankConfigured: boolean;
  onSubmit: (formData: FormData) => Promise<void>;
  isSubmitting: boolean;
  submitSuccessMsg: string | null;
  submitErrorMsg: string | null;
}

export const ReceiptUploadForm: React.FC<ReceiptUploadFormProps> = ({
  selectedPlan,
  bankConfigured,
  onSubmit,
  isSubmitting,
  submitSuccessMsg,
  submitErrorMsg,
}) => {
  const [submittedAmount, setSubmittedAmount] = useState<string>(() => String(selectedPlan.price));
  const [paymentDate, setPaymentDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [prevPlanId, setPrevPlanId] = useState(selectedPlan.id);
  if (prevPlanId !== selectedPlan.id) {
    setPrevPlanId(selectedPlan.id);
    setSubmittedAmount(String(selectedPlan.price));
  }

  // Client-side file validation
  const validateFile = (file: File): boolean => {
    setFileError(null);
    const fileName = file.name.toLowerCase();

    // Strictly reject SVGs, HTML, and executable extensions
    const prohibitedExtensions = ['.svg', '.html', '.htm', '.exe', '.bat', '.sh', '.js', '.vbs'];
    if (prohibitedExtensions.some((ext) => fileName.endsWith(ext))) {
      setFileError('Security restriction: SVG, HTML, scripts, and executable files are strictly prohibited.');
      return false;
    }

    const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'pdf'];
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

    const ext = fileName.split('.').pop() || '';
    if (!allowedExtensions.includes(ext) && !allowedMimeTypes.includes(file.type)) {
      setFileError('Invalid file format. Please upload a JPG, PNG, WEBP, or PDF bank transfer receipt.');
      return false;
    }

    const maxSize = 5 * 1024 * 1024; // 5 MB
    if (file.size > maxSize) {
      setFileError(`File size exceeds 5 MB limit. Selected file is ${(file.size / (1024 * 1024)).toFixed(2)} MB.`);
      return false;
    }

    return true;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (validateFile(file)) {
        setReceiptFile(file);
      } else {
        setReceiptFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (validateFile(file)) {
        setReceiptFile(file);
      } else {
        setReceiptFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveFile = () => {
    setReceiptFile(null);
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!bankConfigured) {
      setFileError('Bank details are not configured yet. Submissions are temporarily paused.');
      return;
    }

    const parsedAmount = parseFloat(submittedAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setFileError('Please enter a valid submitted amount greater than 0.');
      return;
    }

    if (!paymentDate) {
      setFileError('Please select the payment date.');
      return;
    }

    if (!receiptFile) {
      setFileError('Please attach your bank transfer receipt or deposit slip.');
      return;
    }

    const formData = new FormData();
    formData.append('planId', selectedPlan.id);
    formData.append('submittedAmount', String(parsedAmount));
    formData.append('paymentDate', paymentDate);
    if (reference.trim()) formData.append('reference', reference.trim());
    if (notes.trim()) formData.append('notes', notes.trim());
    // Backend multer expects 'receipt'
    formData.append('receipt', receiptFile);

    await onSubmit(formData);

    // If submission succeeded (handled by parent calling refetch), reset file
    if (!submitErrorMsg) {
      setReceiptFile(null);
      setReference('');
      setNotes('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const canSubmit = Boolean(
    bankConfigured &&
      submittedAmount &&
      parseFloat(submittedAmount) > 0 &&
      paymentDate &&
      receiptFile &&
      !isSubmitting
  );

  return (
    <div className="bg-white rounded-2xl border border-[#E7E9EE] shadow-xs p-6 sm:p-8 space-y-6">
      {/* Title */}
      <div className="pb-4 border-b border-[#E7E9EE]">
        <h2 className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
          <UploadCloud className="w-5 h-5 text-[#37C6A3]" />
          <span>Payment Submission &amp; Receipt Upload</span>
        </h2>
        <p className="text-xs text-[#7C8A9A] mt-1">
          Upload your bank deposit slip or electronic transfer confirmation. Platform administration will verify your submission.
        </p>
      </div>

      {/* Success Notification Banner */}
      {submitSuccessMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-start gap-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Receipt Submitted — Pending Super Admin Review</p>
            <p>{submitSuccessMsg}</p>
            <p className="text-emerald-700 flex items-center gap-1 pt-1 font-medium">
              <Clock className="w-3.5 h-3.5" />
              <span>Status: PENDING. Your subscription term will activate once approved.</span>
            </p>
          </div>
        </div>
      )}

      {/* Error Notification Banner */}
      {submitErrorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Submission Failed</p>
            <p>{submitErrorMsg}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Submitted Amount */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#0F172A] flex items-center gap-1">
              <span>Submitted Amount (LKR)</span>
              <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="1"
              value={submittedAmount}
              onChange={(e) => setSubmittedAmount(e.target.value)}
              placeholder={`e.g. ${selectedPlan.price}`}
              required
              className="w-full px-3.5 py-2.5 bg-[#F7F6F1] border border-[#E7E9EE] focus:border-[#37C6A3] focus:bg-white rounded-xl text-xs font-mono font-bold text-[#0F172A] outline-none transition"
            />
            <p className="text-[11px] text-[#7C8A9A]">
              Authoritative plan price: LKR {Number(selectedPlan.price).toLocaleString()}
            </p>
          </div>

          {/* Payment Date */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#0F172A] flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-[#7C8A9A]" />
              <span>Payment / Transfer Date</span>
              <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              required
              className="w-full px-3.5 py-2.5 bg-[#F7F6F1] border border-[#E7E9EE] focus:border-[#37C6A3] focus:bg-white rounded-xl text-xs font-mono text-[#0F172A] outline-none transition"
            />
            <p className="text-[11px] text-[#7C8A9A]">Date the transfer was executed.</p>
          </div>

          {/* Reference / Slip Number */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#0F172A]">
              Reference / Transaction ID
            </label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. TXN-10928374 / Ref"
              className="w-full px-3.5 py-2.5 bg-[#F7F6F1] border border-[#E7E9EE] focus:border-[#37C6A3] focus:bg-white rounded-xl text-xs text-[#0F172A] outline-none transition"
            />
            <p className="text-[11px] text-[#7C8A9A]">Optional bank reference number.</p>
          </div>
        </div>

        {/* Transfer Notes */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-[#0F172A]">
            Transfer Notes / Remarks (Optional)
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any remarks or details regarding your transfer..."
            className="w-full px-3.5 py-2 bg-[#F7F6F1] border border-[#E7E9EE] focus:border-[#37C6A3] focus:bg-white rounded-xl text-xs text-[#0F172A] outline-none transition"
          />
        </div>

        {/* Receipt Upload Dropzone */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-[#0F172A] flex items-center justify-between">
            <span className="flex items-center gap-1">
              <span>Bank Transfer Receipt Slip</span>
              <span className="text-red-500">*</span>
            </span>
            <span className="text-[11px] font-normal text-[#7C8A9A]">
              JPG, PNG, WEBP, PDF (Max 5 MB)
            </span>
          </label>

          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
            onChange={handleFileChange}
            className="hidden"
          />

          {!receiptFile ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-7 text-center transition cursor-pointer flex flex-col items-center justify-center gap-3 ${
                isDragging
                  ? 'border-[#37C6A3] bg-[#37C6A3]/10'
                  : 'border-[#E7E9EE] bg-[#F7F6F1]/60 hover:bg-[#F7F6F1] hover:border-[#37C6A3]/50'
              }`}
            >
              <div className="w-12 h-12 rounded-2xl bg-white border border-[#E7E9EE] text-[#37C6A3] flex items-center justify-center shadow-xs">
                <UploadCloud className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-[#0F172A]">
                  Drag &amp; drop receipt here, or <span className="text-[#37C6A3] underline">Browse</span>
                </p>
                <p className="text-[11px] text-[#7C8A9A]">
                  Valid bank slip or transaction confirmation screenshot (JPG, PNG, WEBP, PDF up to 5 MB)
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-[#F7F6F1] border border-[#E7E9EE] rounded-2xl flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-10 h-10 rounded-xl bg-white border border-[#E7E9EE] flex items-center justify-center text-[#37C6A3] shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs font-bold text-[#0F172A] truncate">
                    {receiptFile.name}
                  </p>
                  <p className="text-[11px] text-[#7C8A9A] font-mono">
                    {formatFileSize(receiptFile.size)} &bull; {receiptFile.type || 'Document'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-lg bg-white border border-[#E7E9EE] hover:bg-[#F7F6F1] text-xs font-semibold text-[#0F172A] transition cursor-pointer"
                >
                  Change
                </button>
                <button
                  type="button"
                  onClick={handleRemoveFile}
                  aria-label="Remove receipt file"
                  className="p-1.5 rounded-lg bg-white border border-[#E7E9EE] hover:bg-red-50 hover:text-red-700 text-[#7C8A9A] transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {fileError && (
            <p className="text-xs text-red-600 font-medium flex items-center gap-1 mt-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{fileError}</span>
            </p>
          )}
        </div>

        {/* Submit Button & Verification Note */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-[11px] text-[#7C8A9A] flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#37C6A3] shrink-0" />
            <span>
              Receipt submissions require administrative verification before workspace activation.
            </span>
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-xs font-bold bg-[#0F172A] text-white hover:bg-[#1E293B] transition shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-[#37C6A3]" />
                <span>Uploading Receipt &amp; Submitting...</span>
              </>
            ) : (
              <>
                <UploadCloud className="w-4 h-4 text-[#37C6A3]" />
                <span>Submit Payment for Verification</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
