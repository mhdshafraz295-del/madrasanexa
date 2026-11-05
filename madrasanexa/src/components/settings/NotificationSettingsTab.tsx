import { useState, useEffect } from 'react';
import {
  notificationService,
  type NotificationSettings,
  type UpdateNotificationSettingsPayload,
} from '../../services/notification.service';
import {
  Bell,
  Mail,
  MessageSquare,
  Clock,
  Globe,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

export default function NotificationSettingsTab() {
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form State
  const [form, setForm] = useState<UpdateNotificationSettingsPayload>({
    autoFeePaymentSmsEnabled: false,
    autoPartialFeeSmsEnabled: false,
    autoFeeReminderSmsEnabled: false,
    autoFeePaymentEmailEnabled: false,
    autoPartialFeeEmailEnabled: false,
    autoFeeReminderEmailEnabled: false,
    autoSalaryPaidEmailEnabled: true,
    feeReminderSendTime: '09:00',
  });

  useEffect(() => {
    async function loadSettings() {
      try {
        setIsLoading(true);
        setErrorMessage(null);
        const data = await notificationService.getSettings();
        setSettings(data);
        setForm({
          autoFeePaymentSmsEnabled: data.autoFeePaymentSmsEnabled,
          autoPartialFeeSmsEnabled: data.autoPartialFeeSmsEnabled,
          autoFeeReminderSmsEnabled: data.autoFeeReminderSmsEnabled,
          autoFeePaymentEmailEnabled: data.autoFeePaymentEmailEnabled,
          autoPartialFeeEmailEnabled: data.autoPartialFeeEmailEnabled,
          autoFeeReminderEmailEnabled: data.autoFeeReminderEmailEnabled,
          autoSalaryPaidEmailEnabled: data.autoSalaryPaidEmailEnabled,
          feeReminderSendTime: data.feeReminderSendTime || '09:00',
        });
      } catch (err: any) {
        setErrorMessage(err.response?.data?.message || err.message || 'Failed to load notification settings.');
      } finally {
        setIsLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      setSuccessMessage(null);
      setErrorMessage(null);

      const updated = await notificationService.updateSettings(form);
      setSettings(updated);
      setSuccessMessage('Notification engine settings saved successfully.');
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || err.message || 'Failed to update notification settings.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-[#E7E9EE] p-12 flex flex-col items-center justify-center text-[#7C8A9A]">
        <Loader2 className="w-8 h-8 animate-spin text-[#37C6A3] mb-3" />
        <p className="text-xs font-medium">Loading notification configuration...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="bg-white rounded-2xl border border-[#E7E9EE] p-6 sm:p-8 shadow-xs space-y-8">
      <div>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#37C6A3] flex items-center justify-center">
            <Bell className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#0F172A]">Automatic Notification Engine</h2>
            <p className="text-xs text-[#7C8A9A] mt-0.5">
              Configure automatic SMS and Email dispatch rules for student fees, salary disbursements, and timetable publications.
            </p>
          </div>
        </div>
      </div>

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* SECTION 1: Student Fee Payment Notifications */}
      <div className="space-y-4">
        <div className="border-b border-[#E7E9EE] pb-2">
          <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
            Student Fee Collection Notifications
          </h3>
          <p className="text-[11px] text-[#7C8A9A]">
            Sent immediately upon successful payment confirmation. Both channels are transactional and completely independent.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Full Payment SMS */}
          <div className="p-4 rounded-xl border border-[#E7E9EE] bg-[#F7F6F1]/50 hover:bg-[#F7F6F1] transition flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-[#0F172A]">
                <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                <span>Full Payment SMS</span>
              </div>
              <p className="text-[11px] text-[#7C8A9A]">
                Auto-sends SMS receipt confirmation to guardian when fees are fully settled.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
              <input
                type="checkbox"
                checked={Boolean(form.autoFeePaymentSmsEnabled)}
                onChange={(e) => setForm({ ...form, autoFeePaymentSmsEnabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-10 h-5.5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-[#37C6A3]"></div>
            </label>
          </div>

          {/* Full Payment Email */}
          <div className="p-4 rounded-xl border border-[#E7E9EE] bg-[#F7F6F1]/50 hover:bg-[#F7F6F1] transition flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-[#0F172A]">
                <Mail className="w-3.5 h-3.5 text-indigo-600" />
                <span>Full Payment Email</span>
              </div>
              <p className="text-[11px] text-[#7C8A9A]">
                Auto-sends HTML receipt breakdown to guardian email when fees are fully settled.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
              <input
                type="checkbox"
                checked={Boolean(form.autoFeePaymentEmailEnabled)}
                onChange={(e) => setForm({ ...form, autoFeePaymentEmailEnabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-10 h-5.5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-[#37C6A3]"></div>
            </label>
          </div>

          {/* Partial Payment SMS */}
          <div className="p-4 rounded-xl border border-[#E7E9EE] bg-[#F7F6F1]/50 hover:bg-[#F7F6F1] transition flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-[#0F172A]">
                <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                <span>Partial Payment SMS</span>
              </div>
              <p className="text-[11px] text-[#7C8A9A]">
                Auto-sends SMS with remaining outstanding balance when partial fee installment is received.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
              <input
                type="checkbox"
                checked={Boolean(form.autoPartialFeeSmsEnabled)}
                onChange={(e) => setForm({ ...form, autoPartialFeeSmsEnabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-10 h-5.5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-[#37C6A3]"></div>
            </label>
          </div>

          {/* Partial Payment Email */}
          <div className="p-4 rounded-xl border border-[#E7E9EE] bg-[#F7F6F1]/50 hover:bg-[#F7F6F1] transition flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-[#0F172A]">
                <Mail className="w-3.5 h-3.5 text-indigo-600" />
                <span>Partial Payment Email</span>
              </div>
              <p className="text-[11px] text-[#7C8A9A]">
                Auto-sends HTML receipt with itemized invoice allocations and remaining balance.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
              <input
                type="checkbox"
                checked={Boolean(form.autoPartialFeeEmailEnabled)}
                onChange={(e) => setForm({ ...form, autoPartialFeeEmailEnabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-10 h-5.5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-[#37C6A3]"></div>
            </label>
          </div>
        </div>
      </div>

      {/* SECTION 2: Month-End Fee Reminders */}
      <div className="space-y-4">
        <div className="border-b border-[#E7E9EE] pb-2">
          <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
            Month-End Fee Reminders
          </h3>
          <p className="text-[11px] text-[#7C8A9A]">
            Evaluated daily during the final 3 calendar days of each month. Automatically revalidates balance before sending to prevent false reminders.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Reminder SMS */}
          <div className="p-4 rounded-xl border border-[#E7E9EE] bg-[#F7F6F1]/50 hover:bg-[#F7F6F1] transition flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-[#0F172A]">
                <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                <span>Month-End Reminder SMS</span>
              </div>
              <p className="text-[11px] text-[#7C8A9A]">
                Sends reminder SMS to guardians of students with unpaid or partial balances.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
              <input
                type="checkbox"
                checked={Boolean(form.autoFeeReminderSmsEnabled)}
                onChange={(e) => setForm({ ...form, autoFeeReminderSmsEnabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-10 h-5.5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-[#37C6A3]"></div>
            </label>
          </div>

          {/* Reminder Email */}
          <div className="p-4 rounded-xl border border-[#E7E9EE] bg-[#F7F6F1]/50 hover:bg-[#F7F6F1] transition flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-[#0F172A]">
                <Mail className="w-3.5 h-3.5 text-indigo-600" />
                <span>Month-End Reminder Email</span>
              </div>
              <p className="text-[11px] text-[#7C8A9A]">
                Sends reminder email statement to guardians for outstanding month balances.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
              <input
                type="checkbox"
                checked={Boolean(form.autoFeeReminderEmailEnabled)}
                onChange={(e) => setForm({ ...form, autoFeeReminderEmailEnabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-10 h-5.5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-[#37C6A3]"></div>
            </label>
          </div>
        </div>

        {/* Send Time & Timezone info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-[#F7F6F1] border border-[#E7E9EE]">
          <div>
            <label className="block text-xs font-semibold text-[#0F172A] mb-1 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#7C8A9A]" />
              <span>Daily Send Time (24h HH:mm)</span>
            </label>
            <input
              type="text"
              pattern="^(?:[01]\d|2[0-3]):[0-5]\d$"
              value={form.feeReminderSendTime || '09:00'}
              onChange={(e) => setForm({ ...form, feeReminderSendTime: e.target.value })}
              placeholder="09:00"
              className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-[#E7E9EE] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#37C6A3]"
            />
            <span className="text-[10px] text-[#7C8A9A] mt-1 block">
              Default is 09:00. Safe for late boot recovery.
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#0F172A] mb-1 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-[#7C8A9A]" />
              <span>Tenant Timezone</span>
            </label>
            <div className="px-3 py-1.5 text-xs font-mono bg-white border border-[#E7E9EE] rounded-lg text-[#0F172A]">
              {settings?.timezone || 'Asia/Colombo'}
            </div>
            <span className="text-[10px] text-[#7C8A9A] mt-1 block">
              Reminder calendar days are calculated strictly in this timezone.
            </span>
          </div>
        </div>
      </div>

      {/* SECTION 3: Staff Salary Notifications */}
      <div className="space-y-4">
        <div className="border-b border-[#E7E9EE] pb-2">
          <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
            Staff Compensation Notifications
          </h3>
          <p className="text-[11px] text-[#7C8A9A]">
            Auto-delivers official salary disbursement advice with attached institutional PDF payslip to teaching staff.
          </p>
        </div>

        <div className="p-4 rounded-xl border border-[#E7E9EE] bg-[#F7F6F1]/50 hover:bg-[#F7F6F1] transition flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-[#0F172A]">
              <Mail className="w-3.5 h-3.5 text-indigo-600" />
              <span>Salary Paid Auto-Email with PDF Payslip</span>
            </div>
            <p className="text-[11px] text-[#7C8A9A]">
              Automatically queues salary payment confirmation email with PDF slip when salary is marked as PAID. (Enabled by default).
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
            <input
              type="checkbox"
              checked={Boolean(form.autoSalaryPaidEmailEnabled)}
              onChange={(e) => setForm({ ...form, autoSalaryPaidEmailEnabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-10 h-5.5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-[#37C6A3]"></div>
          </label>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center justify-end pt-4 border-t border-[#E7E9EE]">
        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-[#0F172A] rounded-xl hover:bg-[#1E293B] transition shadow-xs disabled:opacity-50 cursor-pointer"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Saving Preferences...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Save Notification Settings</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
