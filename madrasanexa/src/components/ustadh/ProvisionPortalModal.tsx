import React, { useState, useEffect } from 'react';
import {
  X,
  Key,
  ShieldCheck,
  Copy,
  Check,
  AlertCircle,
  Loader2,
  MessageCircle,
  Mail,
  ExternalLink,
  Globe,
  RotateCcw,
  Eye,
  EyeOff,
  Building2,
  UserCheck,
} from 'lucide-react';
import {
  type UstadhItem,
  createTeacherPortalAccount,
  sendUstadhEmail,
  type CreatePortalAccountResponse,
} from '../../services/ustadh.service';
import { useAuth } from '../../context/AuthContext';

interface ProvisionPortalModalProps {
  isOpen: boolean;
  onClose: () => void;
  ustadh: UstadhItem | null;
  onSuccess: () => void;
}

const STORAGE_KEY_PORTAL_URL = 'madrasanexa_teacher_portal_base_url';
const DEFAULT_PORTAL_URL = import.meta.env.VITE_TEACHER_PORTAL_URL || 'http://localhost:5174';

function normalizeBaseUrl(url?: string | null): string {
  if (!url || typeof url !== 'string') return DEFAULT_PORTAL_URL;
  const cleaned = url.trim().replace(/\/+$/, '').replace(/\/login\/?$/i, '').replace(/\/+$/, '');
  return cleaned || DEFAULT_PORTAL_URL;
}

export const ProvisionPortalModal: React.FC<ProvisionPortalModalProps> = ({
  isOpen,
  onClose,
  ustadh,
  onSuccess,
}) => {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [customPassword, setCustomPassword] = useState('');
  const [autoGenerate, setAutoGenerate] = useState(true);
  const [portalBaseUrl, setPortalBaseUrl] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY_PORTAL_URL);
    const normalized = normalizeBaseUrl(saved || DEFAULT_PORTAL_URL);
    if (saved && saved !== normalized) {
      localStorage.setItem(STORAGE_KEY_PORTAL_URL, normalized);
    }
    return normalized;
  });
  const [showPassword, setShowPassword] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdData, setCreatedData] = useState<CreatePortalAccountResponse['data'] | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedOtp, setCopiedOtp] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [emailSuccessMsg, setEmailSuccessMsg] = useState<string | null>(null);

  // Sync state on opening or ustadh switch
  useEffect(() => {
    if (ustadh) {
      setEmail(ustadh.email || '');
      setCustomPassword('');
      setAutoGenerate(true);
      setError(null);
      setCreatedData(null);
      setCopied(false);
      setCopiedLink(false);
      setCopiedOtp(false);
      setEmailSending(false);
      setEmailSuccessMsg(null);
    }
  }, [ustadh, isOpen]);

  if (!isOpen || !ustadh) return null;

  // Institution and fallback metadata
  const currentMadrasaName =
    createdData?.credentials?.madrasaName ||
    user?.madrasa?.name ||
    'Madrasa Management System';
  const currentMadrasaCode =
    createdData?.credentials?.madrasaCode ||
    user?.madrasa?.code ||
    'MDX';

  const cleanBaseUrl = normalizeBaseUrl(portalBaseUrl);

  const handleBaseUrlChange = (newUrl: string) => {
    setPortalBaseUrl(newUrl);
    const cleaned = normalizeBaseUrl(newUrl);
    localStorage.setItem(STORAGE_KEY_PORTAL_URL, cleaned);
  };

  const resetBaseUrlToDefault = () => {
    const cleaned = normalizeBaseUrl(DEFAULT_PORTAL_URL);
    setPortalBaseUrl(cleaned);
    localStorage.setItem(STORAGE_KEY_PORTAL_URL, cleaned);
  };

  const handleProvision = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const targetEmail = email.trim();

    if (!autoGenerate) {
      if (customPassword.length < 8) {
        setError('Temporary password must be at least 8 characters long.');
        return;
      }
      if (!/[A-Za-z]/.test(customPassword) || !/[0-9]/.test(customPassword)) {
        setError('Password must contain at least one letter and one number.');
        return;
      }
    }

    try {
      setLoading(true);
      const res = await createTeacherPortalAccount(ustadh.id, {
        email: targetEmail || undefined,
        password: autoGenerate ? undefined : customPassword,
        teacherPortalUrl: cleanBaseUrl,
        mustChangePassword: true,
        isReset: Boolean(ustadh.hasPortalAccess || ustadh.userId),
      });

      setCreatedData(res.data);
      onSuccess();
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to configure Teacher Portal login.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Resolved dynamic values for display & dispatch
  const activeLoginId =
    createdData?.credentials?.loginIdentifier ||
    createdData?.user?.email ||
    email.trim() ||
    `${ustadh.ustadhCode.toLowerCase()}@${currentMadrasaCode.toLowerCase()}.madrasanexa.local`;

  const activeOtp =
    createdData?.credentials?.temporaryPassword ||
    createdData?.user?.temporaryPassword ||
    customPassword ||
    '********';

  // Live deep link computed dynamically with normalized cleanBaseUrl
  const liveLoginUrl = `${cleanBaseUrl}/login?code=${encodeURIComponent(
    currentMadrasaCode
  )}&email=${encodeURIComponent(activeLoginId)}`;

  // Unicode Left-to-Right Mark to prevent Arabic greeting from flipping subsequent English lines to RTL
  const LTR = '\u200E';

  // Formatted WhatsApp Welcome Message with clean bullets and unbolded email
  const formattedWhatsAppMessage = [
    `السلام عليكم ورحمة الله وبركاته`,
    `${LTR}Welcome Ustadh *${ustadh.fullName}* to *${currentMadrasaName}* Teacher Portal.`,
    `${LTR}`,
    `${LTR}Here are your login credentials:`,
    `${LTR}• *Madrasa Code:* ${currentMadrasaCode}`,
    `${LTR}• *Staff ID:* ${ustadh.ustadhCode}`,
    `${LTR}• *Login Email / ID:* ${activeLoginId}`,
    `${LTR}• *Temporary Password:* *${activeOtp}*`,
    `${LTR}• *Direct Login Link:* ${liveLoginUrl}`,
    `${LTR}`,
    `${LTR}_Please log in and update your password upon your first sign-in._`,
  ].join('\n');

  // WhatsApp phone digits
  const rawPhone =
    ustadh.whatsappNumber ||
    ustadh.phoneNumber ||
    createdData?.credentials?.whatsappNumber ||
    '';
  const cleanPhone = rawPhone.replace(/\D/g, '');
  const waUrl = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(formattedWhatsAppMessage)}`
    : `https://wa.me/?text=${encodeURIComponent(formattedWhatsAppMessage)}`;

  // Copy full message
  const copyFullMessage = () => {
    navigator.clipboard.writeText(formattedWhatsAppMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Copy direct login link
  const copyDirectLink = () => {
    navigator.clipboard.writeText(liveLoginUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Copy OTP only
  const copyOtp = () => {
    navigator.clipboard.writeText(activeOtp);
    setCopiedOtp(true);
    setTimeout(() => setCopiedOtp(false), 2500);
  };

  // Send via email handler (backend trigger with mailto fallback)
  const handleSendEmail = async () => {
    setEmailSending(true);
    setEmailSuccessMsg(null);
    setError(null);

    const emailSubject = `Teacher Portal Login Credentials - ${currentMadrasaName}`;
    const emailBody = [
      `Assalamu Alaikum ${ustadh.fullName},`,
      ``,
      `Your Teacher Portal login credentials for ${currentMadrasaName} have been generated:`,
      ``,
      `• Madrasa Code: ${currentMadrasaCode}`,
      `• Staff ID: ${ustadh.ustadhCode}`,
      `• Login Email / ID: ${activeLoginId}`,
      `• Temporary Password: ${activeOtp}`,
      `• Direct Login Link: ${liveLoginUrl}`,
      ``,
      `Please log in and update your password on your first sign-in.`,
    ].join('\n');

    const recipient = ustadh.email || (activeLoginId.includes('@') && !activeLoginId.endsWith('.local') ? activeLoginId : '');

    try {
      if (ustadh.id && recipient) {
        await sendUstadhEmail(ustadh.id, {
          subject: emailSubject,
          message: emailBody,
        });
        setEmailSuccessMsg(`Email dispatched successfully to ${recipient}`);
      } else {
        // Fallback to mailto
        const mailtoUrl = `mailto:${recipient}?subject=${encodeURIComponent(
          emailSubject
        )}&body=${encodeURIComponent(emailBody)}`;
        window.open(mailtoUrl, '_blank');
        setEmailSuccessMsg('Opened default email client with pre-filled credentials.');
      }
    } catch (err: any) {
      // Graceful fallback to mailto if backend email provider fails
      const mailtoUrl = `mailto:${recipient}?subject=${encodeURIComponent(
        emailSubject
      )}&body=${encodeURIComponent(emailBody)}`;
      window.open(mailtoUrl, '_blank');
      setEmailSuccessMsg('Credentials opened in your email client for sending.');
    } finally {
      setEmailSending(false);
    }
  };

  const isExistingAccount = Boolean(ustadh.hasPortalAccess || ustadh.userId);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl max-w-xl w-full max-h-[92vh] overflow-y-auto border border-stone-200 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between gap-3 bg-stone-50/70">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
                isExistingAccount
                  ? 'bg-amber-100/70 text-amber-800'
                  : 'bg-teal-100/70 text-teal-800'
              }`}
            >
              <Key className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-bold text-stone-900 leading-tight">
                {isExistingAccount
                  ? 'Reset Teacher Portal Credentials'
                  : 'Provision Teacher Portal Login'}
              </h3>
              <p className="text-xs text-stone-500 truncate mt-0.5">
                Staff: <span className="font-semibold text-stone-700">{ustadh.fullName}</span>{' '}
                <span className="font-mono text-[11px] text-stone-500">({ustadh.ustadhCode})</span>
                {ustadh.staffType && (
                  <span className="ml-1.5 px-1.5 py-0.2 rounded bg-stone-100 text-stone-600 font-medium text-[10px]">
                    {ustadh.staffType}
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 p-1.5 rounded-xl hover:bg-stone-200/60 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {emailSuccessMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-start gap-2">
              <Check className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
              <span>{emailSuccessMsg}</span>
            </div>
          )}

          {createdData ? (
            /* ========================================================================= */
            /* SUCCESS VIEW: CREDENTIAL DISPATCH CARD                                   */
            /* ========================================================================= */
            <div className="space-y-4">
              {/* Success Badge Banner */}
              <div className="p-4 bg-emerald-50/80 border border-emerald-200 text-emerald-950 rounded-2xl flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-emerald-900">
                    {createdData.isReset
                      ? 'Credentials Reset Successfully!'
                      : 'Teacher Portal Account Ready!'}
                  </h4>
                  <p className="text-emerald-700 text-[11px] mt-0.5 leading-relaxed">
                    Account is active with role <span className="font-mono font-bold">TEACHER</span>.
                    The One-Time Password is set and the teacher will be required to change it on first login.
                  </p>
                </div>
              </div>

              {/* Monospace Credentials Strip */}
              <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 space-y-3 font-mono">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-3 border-b border-stone-200/80">
                  <div>
                    <span className="text-stone-400 block text-[10px] uppercase font-sans font-semibold">
                      Institution & Code
                    </span>
                    <span className="text-stone-900 font-bold text-xs select-all">
                      {currentMadrasaName}{' '}
                      <span className="bg-stone-200 px-1 py-0.2 rounded text-[10px]">
                        {currentMadrasaCode}
                      </span>
                    </span>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px] uppercase font-sans font-semibold">
                      Staff Member
                    </span>
                    <span className="text-stone-900 font-bold text-xs select-all">
                      {ustadh.fullName} ({ustadh.ustadhCode})
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="text-stone-400 block text-[10px] uppercase font-sans font-semibold">
                      Login Identifier (Email / ID)
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-stone-900 font-bold text-xs break-all select-all">
                        {activeLoginId}
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="text-stone-400 block text-[10px] uppercase font-sans font-semibold">
                      One-Time Temporary Password
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-teal-800 font-bold text-sm bg-white px-2.5 py-0.5 rounded-lg border border-teal-300 inline-block select-all tracking-wider">
                        {showPassword ? activeOtp : '••••••••'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="p-1 text-stone-400 hover:text-stone-700 transition"
                        title={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={copyOtp}
                        className="p-1 text-teal-600 hover:text-teal-800 transition"
                        title="Copy OTP"
                      >
                        {copiedOtp ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Live Teacher Portal URL & Deep Link */}
                <div className="pt-2 border-t border-stone-200/80 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-stone-400 text-[10px] uppercase font-sans font-semibold flex items-center gap-1">
                      <Globe className="w-3 h-3 text-stone-500" />
                      <span>Teacher Portal URL & Direct Login Link</span>
                    </span>
                    <button
                      type="button"
                      onClick={copyDirectLink}
                      className="text-[10px] font-sans text-teal-700 hover:text-teal-800 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      {copiedLink ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedLink ? 'Link Copied!' : 'Copy Link'}</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={portalBaseUrl}
                      onChange={(e) => handleBaseUrlChange(e.target.value)}
                      placeholder="http://localhost:5174 or https://teacher.madrasanexa.com"
                      className="flex-1 px-2.5 py-1.5 rounded-lg bg-white border border-stone-200 text-[11px] font-mono text-stone-800 focus:outline-none focus:ring-1 focus:ring-teal-600"
                    />
                    <button
                      type="button"
                      onClick={resetBaseUrlToDefault}
                      title="Reset URL to default"
                      className="p-1.5 text-stone-400 hover:text-stone-600 bg-white border border-stone-200 rounded-lg transition"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="bg-white/80 p-2 rounded-lg border border-stone-200/80 flex items-center justify-between gap-2 overflow-hidden">
                    <a
                      href={liveLoginUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-teal-700 hover:text-teal-900 underline truncate flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3 shrink-0" />
                      <span className="truncate">{liveLoginUrl}</span>
                    </a>
                  </div>
                </div>
              </div>

              {/* WhatsApp Welcome Message Live Preview Card */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-stone-600 font-semibold text-xs flex items-center gap-1.5">
                    <MessageCircle className="w-4 h-4 text-emerald-600" />
                    <span>WhatsApp Credential Dispatch Preview</span>
                  </span>
                  <span className="text-[10px] text-stone-400">
                    {cleanPhone ? `Target: +${cleanPhone}` : 'No phone saved on profile'}
                  </span>
                </div>

                <div className="bg-emerald-950/90 text-emerald-50 rounded-2xl p-4 font-sans text-xs shadow-inner space-y-2 border border-emerald-900">
                  <div className="text-emerald-300 font-serif text-sm font-semibold text-center border-b border-emerald-800/60 pb-1.5">
                    السلام عليكم ورحمة الله وبركاته
                  </div>
                  <div className="text-emerald-100 text-[11px] leading-relaxed whitespace-pre-wrap font-mono">
                    {formattedWhatsAppMessage}
                  </div>
                </div>
              </div>

              {/* 3 ONE-TAP ACTION BUTTONS */}
              <div className="pt-2 border-t border-stone-100 space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {/* Button 1: Send via WhatsApp */}
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span className="truncate">
                      {cleanPhone ? 'Send WhatsApp' : 'Open WhatsApp'}
                    </span>
                  </a>

                  {/* Button 2: Copy Credentials */}
                  <button
                    type="button"
                    onClick={copyFullMessage}
                    className="py-2.5 px-3 rounded-xl bg-stone-900 hover:bg-stone-800 active:scale-[0.99] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copy Details</span>
                      </>
                    )}
                  </button>

                  {/* Button 3: Send via Email */}
                  <button
                    type="button"
                    onClick={handleSendEmail}
                    disabled={emailSending}
                    className="py-2.5 px-3 rounded-xl bg-sky-700 hover:bg-sky-800 active:scale-[0.99] disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
                  >
                    {emailSending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Sending...</span>
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4" />
                        <span>Send Email</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => setCreatedData(null)}
                    className="text-stone-500 hover:text-stone-800 text-[11px] underline cursor-pointer"
                  >
                    Configure / Re-generate Password
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="py-1.5 px-4 rounded-xl border border-stone-200 hover:bg-stone-100 text-stone-700 font-semibold text-xs transition cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* ========================================================================= */
            /* PROVISIONING / RESET FORM                                                 */
            /* ========================================================================= */
            <form onSubmit={handleProvision} className="space-y-4">
              {isExistingAccount ? (
                <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl text-[11px] flex items-start gap-2.5">
                  <UserCheck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-amber-950 font-bold mb-0.5">
                      Active Portal Account Detected:
                    </strong>
                    This staff member already has an active Teacher Portal user. Proceeding will
                    generate a fresh One-Time Password, update their email if modified, and revoke
                    previous login sessions.
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-teal-50 border border-teal-200 text-teal-900 rounded-2xl text-[11px] flex items-start gap-2">
                  <Building2 className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                  <div>
                    Creating a new account grants this Ustadh access to the dedicated Teacher Portal
                    workspace with role <span className="font-mono font-bold">TEACHER</span>.
                  </div>
                </div>
              )}

              {/* Teacher Portal Base URL Configuration */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-stone-700 font-semibold flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-stone-500" />
                    <span>Teacher Portal Base URL</span>
                  </label>
                  <button
                    type="button"
                    onClick={resetBaseUrlToDefault}
                    className="text-[10px] text-teal-700 hover:text-teal-800 font-semibold"
                  >
                    Reset Default
                  </button>
                </div>
                <input
                  type="text"
                  value={portalBaseUrl}
                  onChange={(e) => handleBaseUrlChange(e.target.value)}
                  placeholder="http://localhost:5174 or https://teacher.madrasanexa.com"
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs font-mono text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                />
                <p className="text-[11px] text-stone-400 mt-0.5">
                  Used to generate direct deep-links for instant one-click login. Saved automatically.
                </p>
              </div>

              {/* Login Email */}
              <div>
                <label className="block text-stone-700 font-semibold mb-1">
                  Portal Login Email <span className="text-stone-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. teacher@madrasanexa.lk (or leave blank to auto-generate)"
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                />
                <p className="text-[11px] text-stone-400 mt-0.5">
                  If left blank, system generates an institutional identifier (
                  <span className="font-mono text-stone-600">
                    {ustadh.ustadhCode.toLowerCase()}@{currentMadrasaCode.toLowerCase()}
                    .madrasanexa.local
                  </span>
                  ). The teacher can also log in directly using their Staff ID (
                  <span className="font-mono text-stone-600">{ustadh.ustadhCode}</span>).
                </p>
              </div>

              {/* Password Assignment */}
              <div className="space-y-2 pt-2 border-t border-stone-100">
                <div className="flex items-center justify-between">
                  <label className="text-stone-700 font-semibold">Password Assignment</label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-stone-600 font-medium">
                    <input
                      type="checkbox"
                      checked={autoGenerate}
                      onChange={(e) => setAutoGenerate(e.target.checked)}
                      className="rounded text-[#0D9488] focus:ring-[#0D9488]"
                    />
                    <span>Auto-generate secure OTP</span>
                  </label>
                </div>

                {!autoGenerate ? (
                  <div>
                    <input
                      type="text"
                      value={customPassword}
                      onChange={(e) => setCustomPassword(e.target.value)}
                      placeholder="Enter minimum 8 character temporary password"
                      className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs font-mono text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                    />
                    <p className="text-[11px] text-stone-400 mt-0.5">
                      Must contain at least 8 characters with letters and numbers.
                    </p>
                  </div>
                ) : (
                  <div className="p-3 bg-stone-50 rounded-xl border border-stone-200/80 text-[11px] text-stone-600 space-y-1">
                    <div className="font-semibold text-stone-800 flex items-center gap-1">
                      <span>Secure 8-Character One-Time Password</span>
                    </div>
                    <p className="text-stone-500">
                      An unambiguous OTP (e.g.{' '}
                      <span className="font-mono font-bold text-teal-800">
                        {currentMadrasaCode.slice(0, 3)}@7492
                      </span>
                      ) will be created. Easily readable with zero confusing characters (no 0/O or 1/l).
                    </p>
                  </div>
                )}
              </div>

              {/* First-Time Password Reset Notice */}
              <div className="p-3 bg-teal-50/60 border border-teal-100 rounded-xl text-[11px] text-teal-900">
                <span className="font-bold block mb-0.5">Mandatory First-Time Password Reset:</span>
                The teacher will be required to choose a new, private password the moment they log in.
              </div>

              {/* Form Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="px-4 py-2 rounded-xl border border-stone-200 hover:bg-stone-100 text-stone-700 font-semibold text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className={`px-4 py-2 rounded-xl text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs disabled:opacity-50 ${
                    isExistingAccount
                      ? 'bg-amber-700 hover:bg-amber-800'
                      : 'bg-[#0D9488] hover:bg-[#0b7a6f]'
                  }`}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{isExistingAccount ? 'Resetting Password...' : 'Creating Account...'}</span>
                    </>
                  ) : (
                    <>
                      <Key className="w-3.5 h-3.5" />
                      <span>
                        {isExistingAccount ? 'Reset Credentials & Generate OTP' : 'Generate Portal Login'}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
