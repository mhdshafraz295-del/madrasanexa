import React, { useState } from 'react';
import { X, Key, ShieldCheck, Copy, Check, AlertCircle, Loader2 } from 'lucide-react';
import {
  type UstadhItem,
  createTeacherPortalAccount,
  type CreatePortalAccountResponse,
} from '../../services/ustadh.service';

interface ProvisionPortalModalProps {
  isOpen: boolean;
  onClose: () => void;
  ustadh: UstadhItem | null;
  onSuccess: () => void;
}

export const ProvisionPortalModal: React.FC<ProvisionPortalModalProps> = ({
  isOpen,
  onClose,
  ustadh,
  onSuccess,
}) => {
  const [email, setEmail] = useState('');
  const [customPassword, setCustomPassword] = useState('');
  const [autoGenerate, setAutoGenerate] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdData, setCreatedData] = useState<CreatePortalAccountResponse['data'] | null>(null);
  const [copied, setCopied] = useState(false);

  React.useEffect(() => {
    if (ustadh) {
      setEmail(ustadh.email || '');
      setCustomPassword('');
      setAutoGenerate(true);
      setError(null);
      setCreatedData(null);
      setCopied(false);
    }
  }, [ustadh, isOpen]);

  if (!isOpen || !ustadh) return null;

  const handleProvision = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const targetEmail = email.trim();
    if (!targetEmail) {
      setError('A valid email address is required to create a Teacher Portal login.');
      return;
    }

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
        email: targetEmail,
        password: autoGenerate ? undefined : customPassword,
        mustChangePassword: true,
      });

      setCreatedData(res.data);
      onSuccess();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to create Teacher Portal login.');
    } finally {
      setLoading(false);
    }
  };

  const copyCredentials = () => {
    if (!createdData) return;
    const pwd = createdData.user.temporaryPassword || customPassword || '(configured password)';
    const text = `Teacher Portal Login Credentials\nName: ${ustadh.fullName}\nEmail: ${createdData.user.email}\nTemporary Password: ${pwd}\nNote: You will be asked to create a new password on your first login.`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto border border-stone-200 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between gap-2 bg-stone-50/50">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
              <Key className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-bold text-stone-900">Provision Teacher Portal Login</h3>
              <p className="text-xs text-stone-500 truncate">
                Staff: {ustadh.fullName} ({ustadh.ustadhCode})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 p-1.5 rounded-lg hover:bg-stone-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {createdData ? (
            /* Success View with Generated Credentials */
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl space-y-2">
                <div className="flex items-center gap-2 font-bold text-emerald-800">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  <span>Portal Account Created Successfully!</span>
                </div>
                <p className="text-emerald-700">
                  Login account is now active with role <span className="font-mono font-bold">TEACHER</span>. Mandatory password change is enabled for first-time login.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5 font-mono">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-sans">Login Email / Username</span>
                  <span className="text-slate-900 font-bold select-all">{createdData.user.email}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-sans">Temporary Password</span>
                  <span className="text-teal-700 font-bold text-sm bg-white px-2 py-0.5 rounded border border-teal-200 inline-block select-all">
                    {createdData.user.temporaryPassword || customPassword || '********'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={copyCredentials}
                  className="flex-1 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Credentials Copied!' : 'Copy Login Details'}</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="py-2 px-4 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-xs transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            /* Provisioning Form */
            <form onSubmit={handleProvision} className="space-y-4">
              {ustadh.hasPortalAccess && (
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-[11px]">
                  <strong>Notice:</strong> This staff member already has an active portal login linked. Creating credentials again will update their email and issue a new password.
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Portal Login Email <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="teacher@madrasanexa.lk"
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                />
                <p className="text-[11px] text-slate-400 mt-0.5">
                  The teacher will use this email address to log in to the Teacher Portal.
                </p>
              </div>

              <div className="space-y-2 pt-1 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="text-slate-700 font-semibold">Password Assignment</label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-600">
                    <input
                      type="checkbox"
                      checked={autoGenerate}
                      onChange={(e) => setAutoGenerate(e.target.checked)}
                      className="rounded text-[#0D9488] focus:ring-[#0D9488]"
                    />
                    <span>Auto-generate secure password</span>
                  </label>
                </div>

                {!autoGenerate && (
                  <div>
                    <input
                      type="text"
                      value={customPassword}
                      onChange={(e) => setCustomPassword(e.target.value)}
                      placeholder="Enter minimum 8 character temporary password"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                    />
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Must contain at least 8 characters with letters and numbers.
                    </p>
                  </div>
                )}

                {autoGenerate && (
                  <p className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    A secure 8-character temporary password will be cryptographically generated. It will be shown on the next screen for you to copy.
                  </p>
                )}
              </div>

              <div className="p-3 bg-teal-50/60 border border-teal-100 rounded-xl text-[11px] text-teal-900">
                <span className="font-bold block mb-0.5">Mandatory First-Time Password Reset:</span>
                The teacher will be required to choose a new, private password the moment they log in.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-xl bg-[#0D9488] hover:bg-[#0b7a6f] disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Creating Account...</span>
                    </>
                  ) : (
                    <>
                      <Key className="w-3.5 h-3.5" />
                      <span>Generate Portal Login</span>
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
