import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { apiVerifySetupToken, apiSetupPassword, type SetupTokenVerificationData } from '../../services/api';
import logoUrl from '../../assets/logo/madrasanexa-logo.png';
import authBgUrl from '../../assets/images/auth-bg.png';
import { Lock, Eye, EyeOff, KeyRound, AlertCircle, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';

export default function SetupPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();

  const [isVerifying, setIsVerifying] = useState(true);
  const [tokenData, setTokenData] = useState<SetupTokenVerificationData | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  useEffect(() => {
    const verify = async () => {
      if (!token) {
        setTokenError('Setup token is missing. Please use the link provided in your onboarding email.');
        setIsVerifying(false);
        return;
      }

      try {
        const data = await apiVerifySetupToken(token);
        setTokenData(data);
      } catch (err: any) {
        setTokenError(
          err.response?.data?.message ||
          err.message ||
          'This setup link is invalid, expired, or has already been used.'
        );
      } finally {
        setIsVerifying(false);
      }
    };

    verify();
  }, [token]);

  // Password rules validation
  const hasMinLength = newPassword.length >= 10;
  const hasMixedCase = /[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[^a-zA-Z0-9]/.test(newPassword);
  const passwordsMatch = newPassword === confirmPassword && newPassword.length > 0;
  const isFormValid = hasMinLength && passwordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);

    if (!hasMinLength) {
      setSubmitError('Password must be at least 10 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setSubmitError('New password and confirmation do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiSetupPassword({ token, newPassword });
      setSubmitSuccess(res.message || 'Password set up successfully! Redirecting to sign in...');

      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 1500);
    } catch (err: any) {
      setSubmitError(
        err.response?.data?.message || err.message || 'Failed to set up password. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 sm:p-6 md:p-8 overflow-hidden">
      {/* Background */}
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat filter blur-sm scale-105 opacity-50"
        style={{ backgroundImage: `url(${authBgUrl})` }}
        aria-hidden="true"
      />
      <div className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-[6px]" aria-hidden="true" />

      {/* Card */}
      <div className="relative z-10 w-full max-w-md bg-white rounded-3xl shadow-2xl border border-[#E7E9EE] p-6 sm:p-8 md:p-10 transition-all">
        {/* Header */}
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="mb-4">
            <img
              src={logoUrl}
              alt="MadrasaNexa"
              className="h-14 w-auto object-contain"
            />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 mb-2">
            <KeyRound className="w-3.5 h-3.5 text-emerald-600" />
            <span>Administrator Setup</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A]">
            Set Your Password
          </h1>
          <p className="text-xs sm:text-sm text-[#7C8A9A] mt-1 max-w-xs">
            Configure your permanent administrator password to activate your MadrasaNexa workspace.
          </p>
        </div>

        {/* Loading state */}
        {isVerifying && (
          <div className="py-12 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-[#37C6A3]" />
            <p className="text-xs text-[#7C8A9A]">Verifying your setup link...</p>
          </div>
        )}

        {/* Invalid or expired token error */}
        {!isVerifying && tokenError && (
          <div className="space-y-5">
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-800 text-xs">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-rose-900 mb-1">Link Invalid or Expired</p>
                <p>{tokenError}</p>
              </div>
            </div>
            <div className="pt-2">
              <Link
                to="/login"
                className="w-full py-3 px-4 bg-[#0F172A] hover:bg-[#1E293B] text-white rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2"
              >
                <span>Go to Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}

        {/* Setup Form */}
        {!isVerifying && !tokenError && (
          <>
            {tokenData && (
              <div className="mb-5 p-3.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs">
                <div className="flex justify-between gap-2 py-0.5">
                  <span className="text-[#64748B] shrink-0">Administrator:</span>
                  <span className="font-semibold text-[#0F172A] min-w-0 text-right break-all">{tokenData.email}</span>
                </div>
                {tokenData.madrasaName && (
                  <div className="flex justify-between gap-2 py-0.5 border-t border-dashed border-[#E2E8F0] mt-1 pt-1">
                    <span className="text-[#64748B] shrink-0">Institution:</span>
                    <span className="font-semibold text-[#0F172A] min-w-0 text-right break-words">{tokenData.madrasaName}</span>
                  </div>
                )}
              </div>
            )}

            {submitError && (
              <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-rose-800 text-xs">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            {submitSuccess && (
              <div className="mb-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-emerald-800 text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{submitSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#7C8A9A]">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    disabled={isSubmitting || Boolean(submitSuccess)}
                    placeholder="Min. 10 chars with mix of cases"
                    className="w-full pl-10 pr-10 py-2.5 bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl text-xs sm:text-sm text-[#0F172A] placeholder-[#7C8A9A] focus:outline-none focus:ring-2 focus:ring-[#37C6A3] focus:bg-white transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#7C8A9A] hover:text-[#0F172A]"
                  >
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#7C8A9A]">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={isSubmitting || Boolean(submitSuccess)}
                    placeholder="Re-enter your new password"
                    className="w-full pl-10 pr-10 py-2.5 bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl text-xs sm:text-sm text-[#0F172A] placeholder-[#7C8A9A] focus:outline-none focus:ring-2 focus:ring-[#37C6A3] focus:bg-white transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#7C8A9A] hover:text-[#0F172A]"
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Password Requirements Checklist */}
              <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl space-y-1.5 text-[11px]">
                <p className="font-semibold text-[#0F172A] mb-1">Password Requirements:</p>
                <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-emerald-700' : 'text-[#64748B]'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${hasMinLength ? 'bg-emerald-600' : 'bg-slate-300'}`} />
                  <span>At least 10 characters long</span>
                </div>
                <div className={`flex items-center gap-1.5 ${hasMixedCase ? 'text-emerald-700' : 'text-[#64748B]'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${hasMixedCase ? 'bg-emerald-600' : 'bg-slate-300'}`} />
                  <span>Uppercase & lowercase letters</span>
                </div>
                <div className={`flex items-center gap-1.5 ${hasNumber ? 'text-emerald-700' : 'text-[#64748B]'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${hasNumber ? 'bg-emerald-600' : 'bg-slate-300'}`} />
                  <span>At least one number</span>
                </div>
                <div className={`flex items-center gap-1.5 ${hasSpecial ? 'text-emerald-700' : 'text-[#64748B]'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${hasSpecial ? 'bg-emerald-600' : 'bg-slate-300'}`} />
                  <span>Special character (!@#$...)</span>
                </div>
                <div className={`flex items-center gap-1.5 ${passwordsMatch ? 'text-emerald-700' : 'text-[#64748B]'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${passwordsMatch ? 'bg-emerald-600' : 'bg-slate-300'}`} />
                  <span>Passwords match</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={!isFormValid || isSubmitting || Boolean(submitSuccess)}
                className="w-full mt-2 py-3 px-4 bg-[#0F172A] hover:bg-[#1E293B] text-white rounded-xl text-xs sm:text-sm font-semibold transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#37C6A3]" />
                    <span>Configuring Password...</span>
                  </>
                ) : (
                  <span>Set Password & Continue</span>
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
