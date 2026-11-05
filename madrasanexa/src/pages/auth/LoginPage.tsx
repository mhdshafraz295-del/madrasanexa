import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useLocation, Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import logoUrl from '../../assets/logo/madrasanexa-logo.png';
import { Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If already authenticated, redirect to the user's role workspace
  if (isAuthenticated && user) {
    const from = (location.state as { from?: { pathname: string } })?.from?.pathname;
    const defaultRoute = user.role === 'SUPER_ADMIN' ? '/super-admin' : '/madrasa-admin';
    return <Navigate to={from || defaultRoute} replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Client validation
    if (!email.trim()) {
      setErrorMessage('Please enter your email address.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const loggedInUser = await login(email, password);
      const target = loggedInUser.role === 'SUPER_ADMIN' ? '/super-admin' : '/madrasa-admin';
      navigate(target, { replace: true });
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { message?: string } } };
        setErrorMessage(axiosErr.response?.data?.message || 'Invalid email or password.');
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Unable to connect to the authentication server.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 sm:p-6 md:p-8 overflow-hidden">
      {/* Full-Screen Video Background */}
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        className="absolute inset-0 h-full w-full object-cover opacity-75"
        style={{ opacity: 0.75 }}
        aria-hidden="true"
      >
        <source src="/assest/videos/video.bg.mp4" type="video/mp4" />
      </video>
      {/* Soft Dark / Neutral Overlay */}
      <div className="absolute inset-0 bg-[#0F172A]/40 backdrop-blur-[6px]" aria-hidden="true" />

      {/* Floating Crisp Login Card */}
      <div className="relative z-10 w-full max-w-md bg-white rounded-3xl shadow-2xl border border-[#E7E9EE] p-6 sm:p-8 md:p-10 transition-all">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="mb-4">
            <img
              src={logoUrl}
              alt="MadrasaNexa"
              className="h-14 w-auto object-contain"
            />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0F172A] tracking-tight">
            Welcome Back
          </h1>
          <p className="text-sm text-[#7C8A9A] mt-1">
            Sign in to manage your Madrasa administrative workspace.
          </p>
        </div>

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
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {/* Email Field */}
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
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
              placeholder="admin@madrasanexa.com"
              className="w-full px-4 py-3 text-sm text-[#0F172A] bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#37C6A3] focus:border-transparent focus:bg-white transition placeholder-[#7C8A9A]/60"
            />
          </div>

          {/* Password Field */}
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
                disabled={isSubmitting}
                placeholder="••••••••••••"
                className="w-full px-4 py-3 pr-11 text-sm text-[#0F172A] bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#37C6A3] focus:border-transparent focus:bg-white transition placeholder-[#7C8A9A]/60"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#7C8A9A] hover:text-[#0F172A] transition focus:outline-none"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Sign In CTA Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-12 mt-2 flex items-center justify-center gap-2 rounded-xl text-sm font-semibold bg-[#FFD978] text-[#0F172A] hover:bg-[#ffe18f] active:scale-[0.99] transition shadow-sm hover:shadow cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-[#0F172A]" />
                <span>Signing in...</span>
              </>
            ) : (
              <span>Sign In</span>
            )}
          </button>
        </form>

        {/* Footer Notice & Link to Informational Register */}
        <div className="mt-8 pt-6 border-t border-[#E7E9EE] text-center">
          <p className="text-xs text-[#7C8A9A]">
            Need access for your institution?{' '}
            <Link
              to="/register"
              className="font-medium text-[#0F172A] hover:text-[#37C6A3] transition underline underline-offset-2"
            >
              Learn about registration
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
