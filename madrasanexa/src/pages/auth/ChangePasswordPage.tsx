import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiChangePassword } from '../../services/api';
import logoUrl from '../../assets/logo/madrasanexa-logo.png';
import authBgUrl from '../../assets/images/auth-bg.png';
import { Lock, Eye, EyeOff, KeyRound, AlertCircle, CheckCircle2, Loader2, LogOut } from 'lucide-react';

export default function ChangePasswordPage() {
  const { user, refreshUser, logout } = useAuth();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Password rules validation
  const hasMinLength = newPassword.length >= 10;
  const hasMixedCase = /[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[^a-zA-Z0-9]/.test(newPassword);
  const passwordsMatch = newPassword === confirmPassword && newPassword.length > 0;

  const isFormValid = hasMinLength && passwordsMatch && currentPassword.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!hasMinLength) {
      setErrorMessage('New password must be at least 10 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('New password and confirmation do not match.');
      return;
    }

    if (currentPassword === newPassword) {
      setErrorMessage('New password must be different from current password.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await apiChangePassword({ currentPassword, newPassword });
      setSuccessMessage(res.message || 'Password changed successfully! Redirecting to workspace...');

      // Refresh AuthContext to clear mustChangePassword
      await refreshUser();

      // Navigate to destination
      setTimeout(() => {
        if (user?.role === 'SUPER_ADMIN') {
          navigate('/super-admin', { replace: true });
        } else {
          navigate('/madrasa-admin', { replace: true });
        }
      }, 1200);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to change password.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 sm:p-6 md:p-8 overflow-hidden">
      {/* Authentic Background */}
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
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 mb-2">
            <KeyRound className="w-3.5 h-3.5 text-amber-600" />
            Security Notice
          </div>
          <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">
            Change Your Password
          </h1>
          <p className="text-xs text-[#7C8A9A] mt-1">
            Please set a secure permanent password to access your workspace.
          </p>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-[#37C6A3] shrink-0 mt-0.5" />
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Current Password */}
          <div>
            <label className="block text-xs font-semibold text-[#0F172A] mb-1">
              Current / Temporary Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#7C8A9A]">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                placeholder="Enter current password"
                className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-[#E7E9EE] text-sm text-[#0F172A] placeholder-[#7C8A9A]/60 focus:outline-none focus:ring-2 focus:ring-[#37C6A3]/30 focus:border-[#37C6A3] transition"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#7C8A9A] hover:text-[#0F172A] cursor-pointer"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label className="block text-xs font-semibold text-[#0F172A] mb-1">
              New Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#7C8A9A]">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                placeholder="Minimum 10 characters"
                className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-[#E7E9EE] text-sm text-[#0F172A] placeholder-[#7C8A9A]/60 focus:outline-none focus:ring-2 focus:ring-[#37C6A3]/30 focus:border-[#37C6A3] transition"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#7C8A9A] hover:text-[#0F172A] cursor-pointer"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm New Password */}
          <div>
            <label className="block text-xs font-semibold text-[#0F172A] mb-1">
              Confirm New Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#7C8A9A]">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="Re-enter new password"
                className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-[#E7E9EE] text-sm text-[#0F172A] placeholder-[#7C8A9A]/60 focus:outline-none focus:ring-2 focus:ring-[#37C6A3]/30 focus:border-[#37C6A3] transition"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#7C8A9A] hover:text-[#0F172A] cursor-pointer"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Password Policy Guidelines */}
          <div className="p-3 bg-[#F7F6F1] rounded-xl border border-[#E7E9EE] text-[11px] space-y-1">
            <p className="font-semibold text-[#0F172A]">Password Requirements:</p>
            <div className="grid grid-cols-2 gap-1 text-[#7C8A9A]">
              <span className={hasMinLength ? 'text-emerald-700 font-medium' : ''}>
                &bull; Min 10 characters
              </span>
              <span className={hasMixedCase ? 'text-emerald-700 font-medium' : ''}>
                &bull; Upper & lowercase
              </span>
              <span className={hasNumber ? 'text-emerald-700 font-medium' : ''}>
                &bull; Number included
              </span>
              <span className={hasSpecial ? 'text-emerald-700 font-medium' : ''}>
                &bull; Special symbol
              </span>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading || !isFormValid}
              className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold bg-[#FFD978] text-[#0F172A] hover:bg-[#ffe18f] active:scale-[0.99] transition shadow-sm hover:shadow disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Updating Password...</span>
                </>
              ) : (
                <span>Update Password & Continue</span>
              )}
            </button>
          </div>
        </form>

        {/* Sign Out option */}
        <div className="mt-6 pt-4 border-t border-[#E7E9EE] text-center">
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-1.5 text-xs text-[#7C8A9A] hover:text-red-700 transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign out instead</span>
          </button>
        </div>
      </div>
    </div>
  );
}
