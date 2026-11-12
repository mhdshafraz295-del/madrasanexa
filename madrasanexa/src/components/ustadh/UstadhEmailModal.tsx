import React, { useState } from 'react';
import { X, Loader2, Mail, Send, AlertCircle } from 'lucide-react';
import type { UstadhItem } from '../../services/ustadh.service';

interface UstadhEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (subject: string, message: string) => Promise<void>;
  ustadh: UstadhItem | null;
  isSending: boolean;
}

export const UstadhEmailModal: React.FC<UstadhEmailModalProps> = ({
  isOpen,
  onClose,
  onSend,
  ustadh,
  isSending,
}) => {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !ustadh) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!subject.trim()) {
      setError('Email subject is required.');
      return;
    }
    if (!message.trim()) {
      setError('Email message is required.');
      return;
    }

    try {
      await onSend(subject.trim(), message.trim());
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to send email.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-stone-200 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between gap-2 bg-stone-50/50">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-bold text-stone-900">Email Ustadh</h3>
              <p className="text-xs text-stone-500 break-all">
                To: {ustadh.fullName} ({ustadh.email || 'No email configured'})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 p-1.5 rounded-lg hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {!ustadh.email && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl">
              This Ustadh does not have an email address configured. Please edit their profile first.
            </div>
          )}

          <div>
            <label className="block font-semibold text-stone-700 mb-1">
              Subject <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Schedule Update or Class Notification"
              className="w-full h-10 px-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 font-medium"
              required
              disabled={!ustadh.email}
            />
          </div>

          <div>
            <label className="block font-semibold text-stone-700 mb-1">
              Message Content <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              placeholder="Write your message here..."
              className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 leading-relaxed"
              required
              disabled={!ustadh.email}
            />
          </div>

          <div className="pt-4 border-t border-stone-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSending || !ustadh.email}
              className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-all shadow-xs disabled:opacity-50"
            >
              {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span>Send Email</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
