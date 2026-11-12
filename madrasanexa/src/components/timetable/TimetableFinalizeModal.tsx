import { useState, useEffect } from 'react';
import {
  notificationService,
  type TimetableRecipientScope,
  type TimetablePublication,
} from '../../services/notification.service';
import { listUstadhs, type UstadhItem } from '../../services/ustadh.service';
import {
  X,
  Calendar,
  Send,
  Loader2,
  AlertCircle,
  Users,
  FileCheck,
  Mail,
  Info,
} from 'lucide-react';

interface TimetableFinalizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (publication: TimetablePublication) => void;
}

export default function TimetableFinalizeModal({
  isOpen,
  onClose,
  onSuccess,
}: TimetableFinalizeModalProps) {
  const [effectiveDate, setEffectiveDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [sendEmail, setSendEmail] = useState(false);
  const [recipientScope, setRecipientScope] = useState<TimetableRecipientScope>('ALL_TEACHING_STAFF');
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  const [staffList, setStaffList] = useState<UstadhItem[]>([]);
  const [isLoadingStaff, setIsLoadingStaff] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Client-generated deterministic UUID per open session
  const [idempotencyKey, setIdempotencyKey] = useState(() => {
    return typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `finalize_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  });

  useEffect(() => {
    if (!isOpen) return;

    // Reset idempotency key when opening afresh
    setIdempotencyKey(
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `finalize_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    );
    setErrorMessage(null);

    async function fetchStaff() {
      try {
        setIsLoadingStaff(true);
        const data = await listUstadhs({ isActive: true, pageSize: 100 });
        setStaffList(data.items || []);
      } catch (err: any) {
        console.error('Failed to load teaching staff:', err);
      } finally {
        setIsLoadingStaff(false);
      }
    }

    fetchStaff();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggleStaff = (staffId: string) => {
    setSelectedStaffIds((prev) =>
      prev.includes(staffId) ? prev.filter((id) => id !== staffId) : [...prev, staffId]
    );
  };

  const handleSelectAllStaff = () => {
    if (selectedStaffIds.length === staffList.length) {
      setSelectedStaffIds([]);
    } else {
      setSelectedStaffIds(staffList.map((s) => s.id));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (recipientScope === 'SELECTED_STAFF' && selectedStaffIds.length === 0) {
      setErrorMessage('Please select at least one staff member.');
      return;
    }

    try {
      setIsSubmitting(true);
      const publication = await notificationService.finalizeTimetable({
        idempotencyKey,
        effectiveDate,
        sendEmail,
        recipientScope,
        selectedStaffIds: recipientScope === 'SELECTED_STAFF' ? selectedStaffIds : null,
        notes: notes.trim() || null,
      });

      onSuccess(publication);
      onClose();
    } catch (err: any) {
      setErrorMessage(
        err.response?.data?.message || err.message || 'Failed to finalize timetable. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl border border-[#E7E9EE] max-w-lg w-full p-4 sm:p-6 shadow-xl space-y-5 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#E7E9EE] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#37C6A3] flex items-center justify-center">
              <FileCheck className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#0F172A]">Finalize Academic Timetable</h3>
              <p className="text-[11px] text-[#7C8A9A]">
                Freeze immutable schedule snapshot and notify teaching staff
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-[#7C8A9A] hover:text-[#0F172A] hover:bg-[#F7F6F1] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto pr-1 flex-1">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Effective Date */}
          <div>
            <label className="block text-xs font-bold text-[#0F172A] mb-1 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#7C8A9A]" />
              <span>Effective Date *</span>
            </label>
            <input
              type="date"
              required
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#37C6A3] focus:bg-white"
            />
            <span className="text-[10px] text-[#7C8A9A] mt-1 block">
              The published schedule becomes effective on this date.
            </span>
          </div>

          {/* Send Email Checkbox */}
          <div className="p-3.5 rounded-xl border border-[#E7E9EE] bg-[#F7F6F1] flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              id="sendEmailCheckbox"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
              className="rounded text-[#37C6A3] focus:ring-[#37C6A3] w-4 h-4 mt-0.5"
            />
            <label htmlFor="sendEmailCheckbox" className="cursor-pointer">
              <div className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-indigo-600" />
                <span>Notify Staff via Email with Attached Schedule PDF</span>
              </div>
              <p className="text-[11px] text-[#7C8A9A] mt-0.5">
                If checked, each eligible teacher receives their individual personalized schedule PDF generated strictly from this immutable snapshot.
              </p>
            </label>
          </div>

          {/* Recipient Scope */}
          <div>
            <label className="block text-xs font-bold text-[#0F172A] mb-1 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[#7C8A9A]" />
              <span>Recipient Scope</span>
            </label>
            <select
              value={recipientScope}
              onChange={(e) => setRecipientScope(e.target.value as TimetableRecipientScope)}
              className="w-full px-3 py-2 text-xs bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#37C6A3] focus:bg-white cursor-pointer"
            >
              <option value="ALL_TEACHING_STAFF">All Teaching Staff (Ustadhs & School Teachers)</option>
              <option value="USTADH_ONLY">Ustadhs Only</option>
              <option value="SCHOOL_TEACHER_ONLY">School Teachers Only</option>
              <option value="AFFECTED_STAFF_ONLY">Affected Staff Only (Changed Schedule Since Last Publication)</option>
              <option value="SELECTED_STAFF">Select Specific Staff Members</option>
            </select>
          </div>

          {/* Selected Staff Multi-Select (if SELECTED_STAFF) */}
          {recipientScope === 'SELECTED_STAFF' && (
            <div className="p-3 bg-[#F7F6F1] rounded-xl border border-[#E7E9EE] space-y-2">
              <div className="flex items-center justify-between text-xs pb-1 border-b border-[#E7E9EE]">
                <span className="font-bold text-[#0F172A]">Select Teaching Staff:</span>
                <button
                  type="button"
                  onClick={handleSelectAllStaff}
                  className="text-[11px] text-[#37C6A3] font-bold hover:underline cursor-pointer"
                >
                  {selectedStaffIds.length === staffList.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              {isLoadingStaff ? (
                <div className="py-4 text-center text-xs text-[#7C8A9A]">
                  <Loader2 className="w-4 h-4 animate-spin inline mr-1" />
                  <span>Loading staff members...</span>
                </div>
              ) : (
                <div className="max-h-40 overflow-y-auto space-y-1.5 pt-1 pr-1">
                  {staffList.map((staff) => (
                    <label
                      key={staff.id}
                      className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white transition cursor-pointer text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={selectedStaffIds.includes(staff.id)}
                        onChange={() => handleToggleStaff(staff.id)}
                        className="rounded text-[#37C6A3] focus:ring-[#37C6A3] w-3.5 h-3.5"
                      />
                      <span className="font-medium text-[#0F172A]">{staff.fullName}</span>
                      <span className="text-[10px] text-[#7C8A9A] font-mono">
                        ({staff.staffType === 'SCHOOL_TEACHER' ? 'School Teacher' : 'Ustadh'})
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Publication Notes */}
          <div>
            <label className="block text-xs font-bold text-[#0F172A] mb-1">
              Publication Notes <span className="text-[#7C8A9A] font-normal">(Optional)</span>
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Revised schedule following Ramadan term adjustments..."
              className="w-full px-3 py-2 text-xs bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#37C6A3] focus:bg-white resize-none"
            />
          </div>

          <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/60 text-amber-900 text-[11px] flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p>
              Finalizing is idempotent and captures a historical snapshot. Live timetable edits made afterwards will not alter already sent PDFs.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E7E9EE]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-[#7C8A9A] hover:text-[#0F172A] hover:bg-[#F7F6F1] rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold text-white bg-[#0F172A] rounded-xl hover:bg-[#1E293B] transition shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Finalizing...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Finalize & Publish</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
