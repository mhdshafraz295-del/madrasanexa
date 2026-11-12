import React, { useState, useEffect } from 'react';
import { Mail, Loader2, X, AlertCircle, Sparkles } from 'lucide-react';
import {
  sendSalaryEmail,
  maskEmail,
  type UstadhSalaryItem,
} from '../../services/ustadh.service';
import { formatDateOnly } from '../../utils/dateTime';

type QuickTemplateKey = 'SALARY_PAID' | 'THANK_YOU' | 'PAYMENT_DETAILS' | 'CUSTOM';

interface SalaryEmailModalProps {
  salary: UstadhSalaryItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  madrasaName?: string;
}

function formatDisplayMonth(monthVal?: string): string {
  if (!monthVal) return '';
  if (monthVal.includes('-')) {
    const [y, m] = monthVal.split('-');
    const date = new Date(Date.UTC(Number(y), Number(m) - 1, 1));
    return date.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  }
  return monthVal;
}

function formatDisplayDate(dateVal?: string | null): string {
  if (!dateVal) return 'N/A';
  return formatDateOnly(dateVal, 'DD/MM/YYYY');
}

export const SalaryEmailModal: React.FC<SalaryEmailModalProps> = ({
  salary,
  isOpen,
  onClose,
  onSuccess,
  madrasaName,
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<QuickTemplateKey>('SALARY_PAID');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState<QuickTemplateKey | null>(null);
  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const staffName = salary?.ustadh?.fullName || 'Staff Member';
  const displayMonth = formatDisplayMonth(salary?.salaryMonth);
  const paidAmount = salary ? `LKR ${salary.payableAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : 'LKR 0.00';
  const paymentDate = formatDisplayDate(salary?.paymentDate);
  const paymentMethod = salary?.paymentMethodLabel || salary?.paymentMethod || 'Bank Transfer';
  const institutionName = madrasaName || 'Madrasa Administration';

  const getTemplateContent = (template: QuickTemplateKey): { subject: string; message: string } => {
    switch (template) {
      case 'SALARY_PAID':
        return {
          subject: `Salary Payment Confirmation — ${displayMonth}`,
          message: [
            `Assalamu Alaikum ${staffName},`,
            '',
            `Your salary payment for ${displayMonth} has been processed successfully.`,
            '',
            `Paid Amount: ${paidAmount}`,
            `Payment Date: ${paymentDate}`,
            `Payment Method: ${paymentMethod}`,
            `Status: Paid`,
            '',
            'Thank you.',
            '',
            institutionName,
          ].join('\n'),
        };
      case 'THANK_YOU':
        return {
          subject: `Thank You for Your Service — ${displayMonth}`,
          message: [
            `Assalamu Alaikum ${staffName},`,
            '',
            'Thank you for your dedicated service and valuable contribution.',
            '',
            `Your salary payment for ${displayMonth} has been completed successfully.`,
            '',
            `Paid Amount: ${paidAmount}`,
            '',
            'Jazakallahu Khairan.',
            '',
            institutionName,
          ].join('\n'),
        };
      case 'PAYMENT_DETAILS':
        return {
          subject: `Salary Payment Details — ${displayMonth}`,
          message: [
            `Assalamu Alaikum ${staffName},`,
            '',
            'Please find your salary payment details below.',
            '',
            `Salary Month: ${displayMonth}`,
            `Paid Amount: ${paidAmount}`,
            `Payment Date: ${paymentDate}`,
            `Payment Method: ${paymentMethod}`,
            `Status: Paid`,
            '',
            institutionName,
          ].join('\n'),
        };
      case 'CUSTOM':
        return {
          subject: `Salary Notice — ${displayMonth}`,
          message: '',
        };
    }
  };

  // Populate default on modal open
  useEffect(() => {
    if (isOpen && salary) {
      setSelectedTemplate('SALARY_PAID');
      const defaultContent = getTemplateContent('SALARY_PAID');
      setSubject(defaultContent.subject);
      setMessage(defaultContent.message);
      setIsDirty(false);
      setPendingTemplate(null);
      setShowOverwriteConfirm(false);
      setError(null);
      setSending(false);
    }
  }, [isOpen, salary?.id]);

  if (!isOpen || !salary) return null;

  const handleSelectTemplate = (target: QuickTemplateKey) => {
    if (target === selectedTemplate) return;

    if (isDirty) {
      setPendingTemplate(target);
      setShowOverwriteConfirm(true);
    } else {
      applyTemplate(target);
    }
  };

  const applyTemplate = (target: QuickTemplateKey) => {
    setSelectedTemplate(target);
    const content = getTemplateContent(target);
    setSubject(content.subject);
    setMessage(content.message);
    setIsDirty(false);
    setPendingTemplate(null);
    setShowOverwriteConfirm(false);
  };

  const handleConfirmOverwrite = () => {
    if (pendingTemplate) {
      applyTemplate(pendingTemplate);
    }
  };

  const handleCancelOverwrite = () => {
    setPendingTemplate(null);
    setShowOverwriteConfirm(false);
  };

  const handleSubjectChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSubject(e.target.value);
    setIsDirty(true);
  };

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    setIsDirty(true);
  };

  const handleSend = async () => {
    const trimmedSubject = subject.trim();
    const trimmedMessage = message.trim();

    if (!trimmedSubject) {
      setError('Subject cannot be empty.');
      return;
    }
    if (trimmedSubject.length > 200) {
      setError('Subject cannot exceed 200 characters.');
      return;
    }
    if (!trimmedMessage) {
      setError('Message cannot be empty.');
      return;
    }
    if (trimmedMessage.length > 5000) {
      setError('Message cannot exceed 5000 characters.');
      return;
    }

    setSending(true);
    setError(null);

    try {
      const res = await sendSalaryEmail(salary.id, {
        subject: trimmedSubject,
        message: trimmedMessage,
      });

      if (res.success) {
        onSuccess('Salary email sent successfully.');
        onClose();
      } else {
        setError(res.message || 'Email could not be sent. Please try again.');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Email could not be sent. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const staffEmail = salary.ustadh?.email;
  const maskedRecipient = staffEmail ? maskEmail(staffEmail) : 'No email available';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="salary-email-modal-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 space-y-5 my-4 sm:my-8 border border-slate-100 transition-all">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h3 id="salary-email-modal-title" className="text-base font-bold text-slate-900">
                Send Salary Email
              </h3>
              <p className="text-xs text-slate-500">Official salary disbursement advice</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Staff & Recipient Information */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-800 text-sm">{staffName}</span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase ${
                  salary.ustadh?.staffType === 'SCHOOL_TEACHER'
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}
              >
                {salary.ustadh?.staffType === 'SCHOOL_TEACHER' ? 'School Teacher' : 'Ustadh'}
              </span>
            </div>
            <span className="text-slate-500 font-mono text-[11px]">{salary.ustadh?.ustadhCode}</span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/60 text-slate-600">
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-slate-500">To:</span>
              <span className="font-mono text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                {maskedRecipient}
              </span>
              <span className="text-[10px] text-slate-400 italic">(Locked)</span>
            </div>
            <div>
              <span className="font-medium text-slate-500">Month: </span>
              <span className="font-semibold text-slate-700">{displayMonth}</span>
            </div>
          </div>
        </div>

        {/* Overwrite Confirmation Callout */}
        {showOverwriteConfirm && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3.5 rounded-xl text-xs space-y-2.5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-2 font-semibold">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>Replace your current message with this quick message?</span>
            </div>
            <p className="text-amber-800 text-[11px] leading-relaxed">
              You have manually edited the subject or message. Choosing a new template will replace your current edits.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={handleCancelOverwrite}
                className="px-3 py-1 bg-white border border-amber-200 rounded-lg font-medium text-amber-800 hover:bg-amber-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmOverwrite}
                className="px-3 py-1 bg-amber-700 text-white rounded-lg font-semibold hover:bg-amber-800 transition-colors shadow-sm"
              >
                Replace
              </button>
            </div>
          </div>
        )}

        {/* Quick Message Options */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Quick Message Template</span>
            </label>
            {isDirty && (
              <span className="text-[10px] text-slate-400 italic">Custom edited</span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(
              [
                { key: 'SALARY_PAID', label: 'Salary Paid' },
                { key: 'THANK_YOU', label: 'Thank You' },
                { key: 'PAYMENT_DETAILS', label: 'Payment Details' },
                { key: 'CUSTOM', label: 'Custom' },
              ] as const
            ).map((opt) => {
              const active = selectedTemplate === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => handleSelectTemplate(opt.key)}
                  disabled={sending}
                  className={`px-3 py-2 text-xs rounded-xl font-medium border transition-all text-center ${
                    active
                      ? 'bg-slate-900 text-white border-slate-900 shadow-sm font-semibold'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Subject Input */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-xs">
            <label htmlFor="salary-email-subject" className="font-semibold text-slate-700">
              Subject
            </label>
            <span className={`text-[10px] ${subject.length > 180 ? 'text-amber-600 font-bold' : 'text-slate-400'}`}>
              {subject.length}/200
            </span>
          </div>
          <input
            id="salary-email-subject"
            type="text"
            value={subject}
            onChange={handleSubjectChange}
            maxLength={200}
            disabled={sending}
            placeholder="Enter email subject"
            className="w-full px-3 py-2 text-xs sm:text-sm font-medium border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:bg-slate-50"
          />
        </div>

        {/* Message Textarea */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-xs">
            <label htmlFor="salary-email-message" className="font-semibold text-slate-700">
              Message
            </label>
            <span className={`text-[10px] ${message.length > 4800 ? 'text-amber-600 font-bold' : 'text-slate-400'}`}>
              {message.length}/5000
            </span>
          </div>
          <textarea
            id="salary-email-message"
            rows={7}
            value={message}
            onChange={handleMessageChange}
            maxLength={5000}
            disabled={sending}
            placeholder="Type your salary message here..."
            className="w-full px-3 py-2.5 text-xs sm:text-sm font-normal text-slate-800 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-sans leading-relaxed resize-y disabled:bg-slate-50"
          />
          <p className="text-[11px] text-slate-400">
            A copy of the official salary slip PDF is automatically attached to this email.
          </p>
        </div>

        {/* Error Feedback */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || !staffEmail || !subject.trim() || !message.trim()}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-sm inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Sending...</span>
              </>
            ) : (
              <>
                <Mail className="w-3.5 h-3.5" />
                <span>Send Email</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
