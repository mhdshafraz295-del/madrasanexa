import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';
import { authApi } from '../services/api';

export default function LoginPage() {
  const [identifier, setIdentifier] = useState(import.meta.env.DEV ? 'abdullah.farooq@madrasanexa.lk' : '');
  const [password, setPassword] = useState(import.meta.env.DEV ? 'demo12345' : '');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    // Client validation
    if (!identifier.trim()) {
      setErrorMessage('Please enter your email address.');
      setIsLoading(false);
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your password.');
      setIsLoading(false);
      return;
    }

    try {
      await authApi.login(identifier.trim(), password);
      setIsLoading(false);
      navigate('/dashboard');
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage(err.message || 'Invalid faculty credentials. Please check your email and password.');
    }
  };

  const handleQuickDemoLogin = async () => {
    if (!import.meta.env.DEV) return;
    setIsLoading(true);
    setErrorMessage(null);
    setIdentifier('abdullah.farooq@madrasanexa.lk');
    setPassword('demo12345');

    try {
      await authApi.login('abdullah.farooq@madrasanexa.lk', 'demo12345');
      setIsLoading(false);
      navigate('/dashboard');
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage(err.message || 'Failed to authenticate demo user.');
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 sm:p-6 md:p-8 overflow-hidden bg-[#0F172A]">
      {/* 1. Full-Screen Video Background with Fallback Image */}
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        poster="/auth-bg.png"
        className="fixed inset-0 w-full h-full object-cover -z-10 opacity-75"
        style={{ opacity: 0.75 }}
        aria-hidden="true"
      >
        <source src="/auth-bg.mp4" type="video/mp4" />
      </video>

      {/* Fallback Static Background Image behind video */}
      <div
        className="fixed inset-0 w-full h-full bg-cover bg-center -z-20"
        style={{ backgroundImage: "url('/auth-bg.png')" }}
        aria-hidden="true"
      />

      {/* Soft Dark & Blur Glass Overlay */}
      <div className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-[6px] -z-10" aria-hidden="true" />

      {/* 2. Floating Crisp Admin-Matched Login Card */}
      <div className="relative z-10 w-full max-w-md bg-white rounded-3xl shadow-2xl border border-[#E7E9EE] p-6 sm:p-8 md:p-10 transition-all mx-4">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="mb-4">
            <img
              src="/madrasanexa-logo.png"
              alt="MadrasaNexa"
              className="h-14 w-auto object-contain"
              onError={(e) => {
                // If logo fails, fallback to styled SVG
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0F172A] tracking-tight">
            Welcome Back
          </h1>
          <p className="text-sm text-[#7C8A9A] mt-1">
            Sign in to access your Ustadh & Teacher workspace.
          </p>
        </div>

        {/* Demo Credentials Pill in DEV */}
        {import.meta.env.DEV && (
          <div className="mb-6 p-3 bg-emerald-50/80 border border-emerald-200/80 rounded-xl text-xs text-emerald-900">
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold flex items-center gap-1.5 text-emerald-800">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>DEV Demo Faculty Account</span>
              </span>
              <button
                type="button"
                onClick={handleQuickDemoLogin}
                className="px-2 py-0.5 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition cursor-pointer text-[10px]"
              >
                Auto-Fill & Sign In
              </button>
            </div>
            <div className="font-mono text-[11px] text-emerald-800/90">
              <div>Email: abdullah.farooq@madrasanexa.lk</div>
              <div>Password: demo12345</div>
            </div>
          </div>
        )}

        {/* Error Alert Box */}
        {errorMessage && (
          <div
            className="mb-6 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm flex items-start gap-2.5 animate-in fade-in"
            role="alert"
          >
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-5" noValidate>
          {/* Email Address */}
          <div>
            <label
              htmlFor="email"
              className="block text-xs font-semibold text-[#0F172A] uppercase tracking-wider mb-2"
            >
              Email Address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              disabled={isLoading}
              placeholder="teacher@madrasanexa.lk"
              className="w-full px-4 py-3 text-sm text-[#0F172A] bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#37C6A3] focus:border-transparent focus:bg-white transition placeholder-[#7C8A9A]/60"
            />
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="password"
              className="block text-xs font-semibold text-[#0F172A] uppercase tracking-wider mb-2"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                placeholder="••••••••••••"
                className="w-full px-4 py-3 pr-11 text-sm text-[#0F172A] bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#37C6A3] focus:border-transparent focus:bg-white transition placeholder-[#7C8A9A]/60"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#7C8A9A] hover:text-[#0F172A] transition focus:outline-none cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Sign In CTA Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 mt-2 flex items-center justify-center gap-2 rounded-xl text-sm font-semibold bg-[#FFD978] text-[#0F172A] hover:bg-[#ffe18f] active:scale-[0.99] transition shadow-xs hover:shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-[#0F172A]" />
                <span>Signing in...</span>
              </>
            ) : (
              <span>Sign In</span>
            )}
          </button>
        </form>

        {/* Footer Notice */}
        <div className="mt-8 pt-6 border-t border-[#E7E9EE] text-center">
          <p className="text-xs text-[#7C8A9A]">
            Lost access to your faculty account? Contact your Madrasa Administrator for credentials.
          </p>
        </div>
      </div>
    </div>
  );
}
