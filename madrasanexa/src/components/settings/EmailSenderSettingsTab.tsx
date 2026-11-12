import { useState, useEffect } from 'react';
import {
  apiGetEmailSenderSettings,
  apiUpdateEmailSenderSettings,
  apiTestEmailSenderConnection,
  type EmailSenderSettingsData,
} from '../../services/api';
import {
  Mail,
  Server,
  ShieldCheck,
  ShieldAlert,
  Save,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Check,
  HelpCircle,
  Info,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from 'lucide-react';

type ProviderPreset = 'GMAIL' | 'OUTLOOK' | 'CUSTOM';

const detectProviderPreset = (
  host: string,
  port: number,
  security: string
): ProviderPreset => {
  if (host === 'smtp.gmail.com' && port === 587 && security === 'STARTTLS') {
    return 'GMAIL';
  }
  if (host === 'smtp.office365.com' && port === 587 && security === 'STARTTLS') {
    return 'OUTLOOK';
  }
  return 'CUSTOM';
};

export default function EmailSenderSettingsTab() {
  const [settings, setSettings] = useState<EmailSenderSettingsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Provider Preset & Help State
  const [providerPreset, setProviderPreset] = useState<ProviderPreset>('GMAIL');
  const [isAppPasswordHelpOpen, setIsAppPasswordHelpOpen] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [userEditedUsername, setUserEditedUsername] = useState(false);

  // Form State
  const [form, setForm] = useState({
    mode: 'PLATFORM' as 'PLATFORM' | 'CUSTOM_SMTP',
    fromName: '',
    fromEmail: '',
    replyToEmail: '',
    smtpHost: '',
    smtpPort: 587,
    smtpSecurity: 'STARTTLS' as 'SSL_TLS' | 'STARTTLS',
    smtpUsername: '',
    smtpPassword: '',
  });

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const data = await apiGetEmailSenderSettings();
      setSettings(data);

      const host = data.smtpHost || '';
      const port = data.smtpPort || 587;
      const security = data.smtpSecurity || 'STARTTLS';

      let initialPreset: ProviderPreset = 'GMAIL';
      if (data.mode === 'CUSTOM_SMTP' && host) {
        initialPreset = detectProviderPreset(host, port, security);
      }

      setProviderPreset(initialPreset);

      const resolvedHost =
        initialPreset === 'GMAIL'
          ? 'smtp.gmail.com'
          : initialPreset === 'OUTLOOK'
          ? 'smtp.office365.com'
          : host;

      const resolvedPort =
        initialPreset === 'GMAIL' || initialPreset === 'OUTLOOK' ? 587 : port;

      const resolvedSec =
        initialPreset === 'GMAIL' || initialPreset === 'OUTLOOK'
          ? 'STARTTLS'
          : security;

      setForm({
        mode: data.mode || 'PLATFORM',
        fromName: data.fromName || '',
        fromEmail: data.fromEmail || '',
        replyToEmail: data.replyToEmail || '',
        smtpHost: resolvedHost,
        smtpPort: resolvedPort,
        smtpSecurity: resolvedSec as 'SSL_TLS' | 'STARTTLS',
        smtpUsername: data.smtpUsername || (data.fromEmail || ''),
        smtpPassword: '', // Always empty! Never preloaded
      });

      setUserEditedUsername(Boolean(data.smtpUsername && data.smtpUsername !== data.fromEmail));
    } catch (err: any) {
      setErrorMessage(
        err.response?.data?.message || err.message || 'Failed to load email sender settings.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleProviderChange = (newPreset: ProviderPreset) => {
    setProviderPreset(newPreset);
    setTestResult(null);

    if (newPreset === 'GMAIL') {
      setForm((prev) => ({
        ...prev,
        smtpHost: 'smtp.gmail.com',
        smtpPort: 587,
        smtpSecurity: 'STARTTLS',
        smtpUsername: !userEditedUsername && prev.fromEmail ? prev.fromEmail : prev.smtpUsername,
      }));
    } else if (newPreset === 'OUTLOOK') {
      setForm((prev) => ({
        ...prev,
        smtpHost: 'smtp.office365.com',
        smtpPort: 587,
        smtpSecurity: 'STARTTLS',
        smtpUsername: !userEditedUsername && prev.fromEmail ? prev.fromEmail : prev.smtpUsername,
      }));
    } else {
      // Custom SMTP
      setForm((prev) => ({
        ...prev,
        smtpHost:
          prev.smtpHost === 'smtp.gmail.com' || prev.smtpHost === 'smtp.office365.com'
            ? ''
            : prev.smtpHost,
      }));
    }
  };

  const handleFromEmailChange = (emailVal: string) => {
    setForm((prev) => {
      const shouldUpdateUsername =
        (providerPreset === 'GMAIL' || providerPreset === 'OUTLOOK') &&
        (!userEditedUsername || prev.smtpUsername === prev.fromEmail);

      return {
        ...prev,
        fromEmail: emailVal,
        smtpUsername: shouldUpdateUsername ? emailVal : prev.smtpUsername,
      };
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      setSuccessMessage(null);
      setErrorMessage(null);
      setTestResult(null);

      const payload: any = {
        mode: form.mode,
        fromName: form.fromName.trim() || undefined,
        fromEmail: form.fromEmail.trim() || undefined,
        replyToEmail: form.replyToEmail.trim() || undefined,
        smtpHost: form.smtpHost.trim() || undefined,
        smtpPort: Number(form.smtpPort) || 587,
        smtpSecurity: form.smtpSecurity,
        smtpUsername: form.smtpUsername.trim() || undefined,
      };

      if (form.smtpPassword.trim().length > 0) {
        payload.smtpPassword = form.smtpPassword.trim();
      }

      const updated = await apiUpdateEmailSenderSettings(payload);
      setSettings(updated);

      const updatedPreset =
        updated.mode === 'CUSTOM_SMTP' && updated.smtpHost
          ? detectProviderPreset(updated.smtpHost, updated.smtpPort, updated.smtpSecurity)
          : providerPreset;

      setProviderPreset(updatedPreset);

      setForm((prev) => ({
        ...prev,
        fromName: updated.fromName || '',
        fromEmail: updated.fromEmail || '',
        replyToEmail: updated.replyToEmail || '',
        smtpHost: updated.smtpHost || '',
        smtpPort: updated.smtpPort || 587,
        smtpSecurity: updated.smtpSecurity || 'STARTTLS',
        smtpUsername: updated.smtpUsername || '',
        smtpPassword: '', // Always reset password input field to empty
      }));

      setSuccessMessage(
        updated.mode === 'CUSTOM_SMTP'
          ? updated.isVerified
            ? 'Sender email settings saved and verified.'
            : 'Custom SMTP settings saved. Please test the connection to verify your server settings.'
          : 'MadrasaNexa Managed Email active.'
      );
    } catch (err: any) {
      setErrorMessage(
        err.response?.data?.message || err.message || 'Failed to save email sender settings.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setIsTesting(true);
      setTestResult(null);
      setErrorMessage(null);

      const res = await apiTestEmailSenderConnection();
      setTestResult({
        success: res.success,
        message: res.message,
      });

      const updated = await apiGetEmailSenderSettings();
      setSettings(updated);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Test email connection failed.';
      setTestResult({
        success: false,
        message: msg,
      });
      apiGetEmailSenderSettings().then(setSettings).catch(() => {});
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-[#E7E9EE] p-12 flex flex-col items-center justify-center text-[#7C8A9A]">
        <Loader2 className="w-8 h-8 animate-spin text-[#37C6A3] mb-3" />
        <p className="text-xs font-medium">Loading sender email settings...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="bg-white rounded-2xl border border-[#E7E9EE] p-6 sm:p-8 shadow-xs space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E7E9EE] pb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
            <Mail className="w-5 h-5 text-[#37C6A3]" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#0F172A]">Sender Email Settings</h2>
            <p className="text-xs text-[#7C8A9A] mt-0.5">
              Choose between MadrasaNexa Managed Email or configure your own institution email account.
            </p>
          </div>
        </div>

        {/* Verification Status Badge */}
        {form.mode === 'CUSTOM_SMTP' && (
          <div className="shrink-0">
            {settings?.isVerified ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Verified</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                <span>Not Verified</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Feedback Alerts */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {testResult && (
        <div
          className={`p-4 rounded-xl border text-xs sm:text-sm flex items-start gap-2.5 ${
            testResult.success
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {testResult.success ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          )}
          <div>
            <div className="font-bold">{testResult.success ? 'Connection Test Passed' : 'Connection Test Failed'}</div>
            <div className="mt-0.5">{testResult.message}</div>
          </div>
        </div>
      )}

      {/* Sending Method Selector */}
      <div className="space-y-4">
        <label className="block text-xs font-bold text-[#0F172A] uppercase tracking-wider">
          Sending Method
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Mode A: Platform Managed */}
          <div
            onClick={() => setForm({ ...form, mode: 'PLATFORM' })}
            className={`p-5 rounded-2xl border cursor-pointer transition flex flex-col justify-between space-y-4 ${
              form.mode === 'PLATFORM'
                ? 'border-[#0F172A] bg-[#F7F6F1]/80 ring-2 ring-[#0F172A]/10'
                : 'border-[#E7E9EE] bg-white hover:border-gray-300'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#37C6A3] flex items-center justify-center">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-[#0F172A]">MadrasaNexa Managed Email</h3>
                  <p className="text-[11px] text-[#7C8A9A] mt-0.5">Platform managed email server</p>
                </div>
              </div>
              <input
                type="radio"
                name="sendingMode"
                checked={form.mode === 'PLATFORM'}
                onChange={() => setForm({ ...form, mode: 'PLATFORM' })}
                className="mt-1 accent-[#0F172A]"
              />
            </div>
            <p className="text-[11px] text-[#7C8A9A] leading-relaxed">
              No configuration required. Outgoing emails are delivered through MadrasaNexa managed senders with your madrasa name and reply-to address.
            </p>
          </div>

          {/* Mode B: Custom Email */}
          <div
            onClick={() => setForm({ ...form, mode: 'CUSTOM_SMTP' })}
            className={`p-5 rounded-2xl border cursor-pointer transition flex flex-col justify-between space-y-4 ${
              form.mode === 'CUSTOM_SMTP'
                ? 'border-[#0F172A] bg-[#F7F6F1]/80 ring-2 ring-[#0F172A]/10'
                : 'border-[#E7E9EE] bg-white hover:border-gray-300'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Server className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-[#0F172A]">Use My Madrasa Email</h3>
                  <p className="text-[11px] text-[#7C8A9A] mt-0.5">Custom institutional email account</p>
                </div>
              </div>
              <input
                type="radio"
                name="sendingMode"
                checked={form.mode === 'CUSTOM_SMTP'}
                onChange={() => setForm({ ...form, mode: 'CUSTOM_SMTP' })}
                className="mt-1 accent-[#0F172A]"
              />
            </div>
            <p className="text-[11px] text-[#7C8A9A] leading-relaxed">
              Configure Google Workspace, Microsoft 365, Zoho, or cPanel domain email to send directly from your domain identity.
            </p>
          </div>
        </div>
      </div>

      {/* MODE A PREVIEW */}
      {form.mode === 'PLATFORM' && (
        <div className="p-5 rounded-xl border border-[#E7E9EE] bg-[#F8FAFC] space-y-4">
          <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>Platform Sender Active</span>
          </h3>
          <p className="text-xs text-[#7C8A9A]">
            Fee payment receipts, reminders, and salary slips will be dispatched using MadrasaNexa default server infrastructure.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-1">
                Configured Reply-To Email
              </label>
              <input
                type="email"
                value={form.replyToEmail}
                onChange={(e) => setForm({ ...form, replyToEmail: e.target.value })}
                placeholder="office@yourmadrasa.lk"
                className="w-full px-3.5 py-2 text-xs bg-white border border-[#E7E9EE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#37C6A3]/30 font-medium text-[#0F172A]"
              />
              <span className="text-[10px] text-[#7C8A9A] mt-1 block">
                Replies from recipients will be routed to this email address.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* MODE B CUSTOM EMAIL FORM */}
      {form.mode === 'CUSTOM_SMTP' && (
        <div className="space-y-6 pt-2 border-t border-[#E7E9EE]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
              Custom Email Configuration
            </h3>
            {settings?.lastTestedAt && (
              <span className="text-[10px] text-[#7C8A9A]">
                Last tested: {new Date(settings.lastTestedAt).toLocaleString()}
              </span>
            )}
          </div>

          {/* Email Provider Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-[#0F172A] uppercase tracking-wider">
              Email Provider
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => handleProviderChange('GMAIL')}
                className={`px-4 py-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition ${
                  providerPreset === 'GMAIL'
                    ? 'border-blue-600 bg-blue-50/70 text-blue-700 ring-2 ring-blue-600/20'
                    : 'border-[#E7E9EE] bg-white text-[#64748B] hover:border-gray-300'
                }`}
              >
                <span>Gmail / Google Workspace</span>
              </button>

              <button
                type="button"
                onClick={() => handleProviderChange('OUTLOOK')}
                className={`px-4 py-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition ${
                  providerPreset === 'OUTLOOK'
                    ? 'border-sky-600 bg-sky-50/70 text-sky-700 ring-2 ring-sky-600/20'
                    : 'border-[#E7E9EE] bg-white text-[#64748B] hover:border-gray-300'
                }`}
              >
                <span>Microsoft 365 / Outlook</span>
              </button>

              <button
                type="button"
                onClick={() => handleProviderChange('CUSTOM')}
                className={`px-4 py-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition ${
                  providerPreset === 'CUSTOM'
                    ? 'border-slate-900 bg-slate-900 text-white ring-2 ring-slate-900/20'
                    : 'border-[#E7E9EE] bg-white text-[#64748B] hover:border-gray-300'
                }`}
              >
                <span>Custom SMTP</span>
              </button>
            </div>
          </div>

          {/* Provider Guidance Banner */}
          {providerPreset === 'GMAIL' && (
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-3">
                <div className="flex items-center gap-2 font-medium">
                  <Info className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Use a <strong>Google App Password</strong> instead of your normal Google account password.</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAppPasswordHelpOpen(!isAppPasswordHelpOpen)}
                  className="text-xs font-bold text-blue-700 hover:underline shrink-0 flex items-center gap-1 cursor-pointer"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>{isAppPasswordHelpOpen ? 'Hide Help' : 'How to create an App Password?'}</span>
                </button>
              </div>

              {isAppPasswordHelpOpen && (
                <div className="pt-3 border-t border-blue-200/80 text-[11px] leading-relaxed space-y-3 text-blue-950">
                  <p className="font-bold text-xs text-blue-900">Follow these steps to generate a Google App Password:</p>

                  <div className="space-y-2.5">
                    {/* Step 1 */}
                    <div className="p-3 bg-white/80 rounded-lg border border-blue-100 space-y-2">
                      <div className="font-bold text-blue-900">Step 1: Turn on Google 2-Step Verification</div>
                      <p className="text-[#64748B]">Google App Passwords require 2-Step Verification to be enabled on your account.</p>
                      <a
                        href="https://myaccount.google.com/signinoptions/two-step-verification"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] transition shadow-2xs w-full sm:w-auto justify-center"
                      >
                        <span>Open Google 2-Step Verification</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    {/* Step 2 */}
                    <div className="p-3 bg-white/80 rounded-lg border border-blue-100 space-y-2">
                      <div className="font-bold text-blue-900">Step 2: Create a Google App Password</div>
                      <p className="text-[#64748B]">After 2-Step Verification is enabled, generate a dedicated App Password.</p>
                      <a
                        href="https://myaccount.google.com/apppasswords"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] transition shadow-2xs w-full sm:w-auto justify-center"
                      >
                        <span>Open Google App Passwords</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    {/* Step 3 */}
                    <div className="p-3 bg-white/80 rounded-lg border border-blue-100 space-y-1">
                      <div className="font-bold text-blue-900">Step 3: Copy and Paste into MadrasaNexa</div>
                      <p className="text-[#64748B]">Create an App Password for MadrasaNexa, copy the generated password, then return here and paste it into the App Password field below.</p>
                    </div>

                    {/* Step 4 */}
                    <div className="p-3 bg-white/80 rounded-lg border border-blue-100 space-y-1">
                      <div className="font-bold text-blue-900">Step 4: Save & Verify</div>
                      <p className="text-[#64748B]">Click <strong>Save Sender Settings</strong>, then click <strong>Send Test Email / Verify</strong> to confirm connection.</p>
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="pt-2 border-t border-blue-200/60 text-[10.5px] text-blue-800 space-y-1">
                    <p>• Google App Passwords require 2-Step Verification to be enabled.</p>
                    <p>• If App Passwords are unavailable on a work/school Google Workspace account, contact your Google Workspace administrator.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {providerPreset === 'OUTLOOK' && (
            <div className="p-4 rounded-xl bg-sky-50 border border-sky-200 text-sky-900 text-xs flex items-center gap-2.5">
              <Info className="w-4 h-4 text-sky-600 shrink-0" />
              <span>Use the SMTP login details for your Microsoft 365 or Outlook account. Ensure <strong>Authenticated SMTP</strong> is enabled in your Microsoft 365 admin center if required.</span>
            </div>
          )}

          {providerPreset === 'CUSTOM' && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-xs flex items-center gap-2.5">
              <Info className="w-4 h-4 text-slate-500 shrink-0" />
              <span>Use the custom SMTP host, port, and authentication credentials provided by your web hosting or domain provider (e.g., Zoho Mail, cPanel, Webmail).</span>
            </div>
          )}

          {/* Form Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Sender Name */}
            <div>
              <label htmlFor="fromName" className="block text-xs font-semibold text-[#0F172A] uppercase tracking-wider mb-2">
                Sender Name *
              </label>
              <input
                id="fromName"
                type="text"
                required={form.mode === 'CUSTOM_SMTP'}
                value={form.fromName}
                onChange={(e) => setForm({ ...form, fromName: e.target.value })}
                placeholder="Al Mahmoodhiyya Madrasa"
                className="w-full px-4 py-2.5 rounded-xl border border-[#E7E9EE] text-xs font-medium text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#37C6A3]/30"
              />
            </div>

            {/* Sender Email */}
            <div>
              <label htmlFor="fromEmail" className="block text-xs font-semibold text-[#0F172A] uppercase tracking-wider mb-2">
                Sender Email Address *
              </label>
              <input
                id="fromEmail"
                type="email"
                required={form.mode === 'CUSTOM_SMTP'}
                value={form.fromEmail}
                onChange={(e) => handleFromEmailChange(e.target.value)}
                placeholder="admin@almahmoodhiyya.lk"
                className="w-full px-4 py-2.5 rounded-xl border border-[#E7E9EE] text-xs font-medium text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#37C6A3]/30"
              />
            </div>

            {/* Reply-To Email */}
            <div>
              <label htmlFor="replyToEmail" className="block text-xs font-semibold text-[#0F172A] uppercase tracking-wider mb-2">
                Reply-To Email Address (Optional)
              </label>
              <input
                id="replyToEmail"
                type="email"
                value={form.replyToEmail}
                onChange={(e) => setForm({ ...form, replyToEmail: e.target.value })}
                placeholder="info@almahmoodhiyya.lk (Defaults to Sender Email)"
                className="w-full px-4 py-2.5 rounded-xl border border-[#E7E9EE] text-xs font-medium text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#37C6A3]/30"
              />
            </div>

            {/* SMTP Username */}
            <div>
              <label htmlFor="smtpUsername" className="block text-xs font-semibold text-[#0F172A] uppercase tracking-wider mb-2">
                SMTP Username / Account Email *
              </label>
              <input
                id="smtpUsername"
                type="text"
                required={form.mode === 'CUSTOM_SMTP'}
                value={form.smtpUsername}
                onChange={(e) => {
                  setUserEditedUsername(true);
                  setForm({ ...form, smtpUsername: e.target.value });
                }}
                placeholder="admin@almahmoodhiyya.lk"
                className="w-full px-4 py-2.5 rounded-xl border border-[#E7E9EE] text-xs font-mono font-medium text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#37C6A3]/30"
              />
            </div>

            {/* SMTP Password / App Password */}
            <div className="sm:col-span-2">
              <label htmlFor="smtpPassword" className="block text-xs font-semibold text-[#0F172A] uppercase tracking-wider mb-2">
                {providerPreset === 'GMAIL' ? 'App Password' : 'SMTP Password / App Password'}
              </label>
              <div className="space-y-2">
                <input
                  id="smtpPassword"
                  type="password"
                  value={form.smtpPassword}
                  onChange={(e) => setForm({ ...form, smtpPassword: e.target.value })}
                  placeholder={
                    settings?.hasSmtpPassword
                      ? 'Leave blank to keep existing password'
                      : providerPreset === 'GMAIL'
                      ? 'Enter 16-character Google App Password'
                      : 'Enter SMTP Password'
                  }
                  className="w-full px-4 py-2.5 rounded-xl border border-[#E7E9EE] text-xs font-mono text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#37C6A3]/30"
                />
                {settings?.hasSmtpPassword && (
                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-medium">
                    <KeyRound className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Password already configured — leave this field blank to keep the existing password.</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Advanced Technical Settings Section */}
          <div className="pt-4 border-t border-[#E7E9EE] space-y-4">
            {providerPreset === 'CUSTOM' ? (
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                  Technical SMTP Settings
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* SMTP Host */}
                  <div>
                    <label htmlFor="smtpHost" className="block text-[11px] font-semibold text-[#0F172A] uppercase tracking-wider mb-1.5">
                      SMTP Server Host *
                    </label>
                    <input
                      id="smtpHost"
                      type="text"
                      required={form.mode === 'CUSTOM_SMTP' && providerPreset === 'CUSTOM'}
                      value={form.smtpHost}
                      onChange={(e) => setForm({ ...form, smtpHost: e.target.value })}
                      placeholder="smtp.zoho.com"
                      className="w-full px-3.5 py-2 rounded-xl border border-[#E7E9EE] text-xs font-mono font-medium text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#37C6A3]/30"
                    />
                  </div>

                  {/* SMTP Port */}
                  <div>
                    <label htmlFor="smtpPort" className="block text-[11px] font-semibold text-[#0F172A] uppercase tracking-wider mb-1.5">
                      SMTP Port *
                    </label>
                    <input
                      id="smtpPort"
                      type="number"
                      required={form.mode === 'CUSTOM_SMTP' && providerPreset === 'CUSTOM'}
                      min={1}
                      max={65535}
                      value={form.smtpPort}
                      onChange={(e) => {
                        const portNum = Number(e.target.value);
                        const sec = portNum === 465 ? 'SSL_TLS' : portNum === 587 ? 'STARTTLS' : form.smtpSecurity;
                        setForm({ ...form, smtpPort: portNum, smtpSecurity: sec });
                      }}
                      className="w-full px-3.5 py-2 rounded-xl border border-[#E7E9EE] text-xs font-mono font-medium text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#37C6A3]/30"
                    />
                  </div>

                  {/* Encryption Security Mode */}
                  <div>
                    <label htmlFor="smtpSecurity" className="block text-[11px] font-semibold text-[#0F172A] uppercase tracking-wider mb-1.5">
                      Security Mode *
                    </label>
                    <select
                      id="smtpSecurity"
                      value={form.smtpSecurity}
                      onChange={(e) => setForm({ ...form, smtpSecurity: e.target.value as 'SSL_TLS' | 'STARTTLS' })}
                      className="w-full px-3.5 py-2 rounded-xl border border-[#E7E9EE] text-xs font-medium text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-[#37C6A3]/30"
                    >
                      <option value="STARTTLS">STARTTLS (Port 587)</option>
                      <option value="SSL_TLS">SSL / TLS (Port 465)</option>
                    </select>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-[#E7E9EE] bg-[#F8FAFC] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                  className="w-full px-4 py-3 flex items-center justify-between text-xs font-bold text-[#64748B] hover:text-[#0F172A] transition cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-[#7C8A9A]" />
                    <span>Advanced SMTP Settings (Read-Only Summary)</span>
                  </span>
                  {isAdvancedOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {isAdvancedOpen && (
                  <div className="px-4 pb-4 pt-1 border-t border-[#E7E9EE] grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-[#0F172A]">
                    <div>
                      <span className="block text-[10px] font-bold text-[#7C8A9A] uppercase">SMTP Host</span>
                      <span className="font-mono font-medium">{form.smtpHost}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-[#7C8A9A] uppercase">Port</span>
                      <span className="font-mono font-medium">{form.smtpPort}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-[#7C8A9A] uppercase">Security Mode</span>
                      <span className="font-medium">{form.smtpSecurity}</span>
                    </div>
                    <div className="sm:col-span-3 text-[11px] text-[#7C8A9A]">
                      Technical server settings are locked for this preset. To configure a custom host or port, switch provider to <strong>Custom SMTP</strong>.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-[#E7E9EE]">
        {/* Test Connection Button */}
        {form.mode === 'CUSTOM_SMTP' ? (
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting || isSaving}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-bold border border-[#0F172A] text-[#0F172A] rounded-xl hover:bg-slate-900 hover:text-white transition disabled:opacity-50 cursor-pointer"
          >
            {isTesting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Testing Connection...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Send Test Email / Verify</span>
              </>
            )}
          </button>
        ) : (
          <div />
        )}

        {/* Save Button */}
        <button
          type="submit"
          disabled={isSaving || isTesting}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-slate-900 rounded-xl hover:bg-slate-800 transition disabled:opacity-50 shadow-xs cursor-pointer"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Saving Settings...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Save Sender Settings</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
