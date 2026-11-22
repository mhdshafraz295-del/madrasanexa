import React, { useState } from 'react';
import {
  Sparkles,
  Lock,
  FileText,
  Clock,
  Image as ImageIcon,
  Languages,
  CheckCircle2,
  Upload,
  AlertCircle,
  Copy,
  Building2,
  ShieldCheck,
  Zap,
  ArrowRight,
  RefreshCw,
  FileCheck,
} from 'lucide-react';
import { aiService, type AiStatusResponse } from '../../services/ai.service';

interface AiShowcaseLockedProps {
  statusData: AiStatusResponse;
  onRefresh: () => void;
  isTeacher?: boolean;
}

export default function AiShowcaseLocked({
  statusData,
  onRefresh,
  isTeacher = false,
}: AiShowcaseLockedProps) {
  const { settings, latestRequest, isExpired } = statusData;

  const [selectedPlan, setSelectedPlan] = useState<'Monthly' | 'Yearly'>('Yearly');
  const [transactionRef, setTransactionRef] = useState('');
  const [customAmount, setCustomAmount] = useState<string>('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showResubmitForm, setShowResubmitForm] = useState(false);

  const monthlyPrice = settings?.monthlyPrice || 2500;
  const yearlyPrice = settings?.yearlyPrice || 25000;
  const currency = settings?.currency || 'LKR';

  const defaultPrice = selectedPlan === 'Yearly' ? yearlyPrice : monthlyPrice;

  const handleCopyAccount = () => {
    if (settings?.accountNumber) {
      navigator.clipboard.writeText(settings.accountNumber);
      setCopiedAccount(true);
      setTimeout(() => setCopiedAccount(false), 2500);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setErrorMsg('File exceeds 5MB size limit. Please upload a smaller image or PDF.');
        return;
      }
      setReceiptFile(file);
      setErrorMsg(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!transactionRef.trim()) {
      setErrorMsg('Please enter your Bank Transaction Reference Number.');
      return;
    }

    if (!receiptFile) {
      setErrorMsg('Please upload your bank deposit or transfer slip image/PDF.');
      return;
    }

    const amountToSend = customAmount ? Number(customAmount) : defaultPrice;
    if (isNaN(amountToSend) || amountToSend <= 0) {
      setErrorMsg('Please enter a valid payment amount.');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('planName', `${selectedPlan} Plan`);
      formData.append('amount', String(amountToSend));
      formData.append('transactionRef', transactionRef.trim());
      formData.append('receipt', receiptFile);

      await aiService.submitSubscriptionReceipt(formData);
      setSuccessMsg('Receipt submitted successfully! Super Admin will review and activate your subscription.');
      setReceiptFile(null);
      setTransactionRef('');
      setShowResubmitForm(false);
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to submit payment receipt.');
    } finally {
      setSubmitting(false);
    }
  };

  const isPending = latestRequest?.status === 'PENDING';
  const isRejected = latestRequest?.status === 'REJECTED';

  const handleOrbClick = () => {
    const el = document.getElementById('unlock-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12 relative">
      {/* Component-scoped GPU-accelerated Keyframe Styles */}
      <style>{`
        @keyframes hero-spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes hero-spin-reverse {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        @keyframes hero-pulse-glow {
          0%, 100% { transform: scale(1); opacity: 0.14; }
          50% { transform: scale(1.18); opacity: 0.28; }
        }
        @keyframes hero-float-sparkle {
          0%, 100% { transform: translateY(0px) scale(0.9); opacity: 0.25; }
          50% { transform: translateY(-7px) scale(1.2); opacity: 0.9; }
        }
        @keyframes badge-shimmer-sweep {
          0% { transform: translateX(-160%); }
          40%, 100% { transform: translateX(260%); }
        }
        @keyframes orb-halo-ripple {
          0% { transform: scale(0.92); opacity: 0.8; }
          50% { transform: scale(1.28); opacity: 0.25; }
          100% { transform: scale(1.48); opacity: 0; }
        }
        @keyframes orb-float-gentle {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-4px); }
        }
        .animate-hero-spin {
          animation: hero-spin-slow 40s linear infinite;
        }
        .animate-hero-reverse {
          animation: hero-spin-reverse 55s linear infinite;
        }
        .animate-hero-pulse {
          animation: hero-pulse-glow 9s ease-in-out infinite;
        }
        .animate-sparkle {
          animation: hero-float-sparkle 3.5s ease-in-out infinite;
        }
        .animate-badge-shimmer {
          animation: badge-shimmer-sweep 4.5s ease-in-out infinite;
        }
        .animate-orb-halo {
          animation: orb-halo-ripple 2.8s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
        .animate-orb-float {
          animation: orb-float-gentle 4s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-hero-spin,
          .animate-hero-reverse,
          .animate-hero-pulse,
          .animate-sparkle,
          .animate-badge-shimmer,
          .animate-orb-halo,
          .animate-orb-float {
            animation: none !important;
          }
        }
      `}</style>

      {/* Expiry Banner if applicable */}
      {isExpired && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5">
          <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-bold text-amber-900">AI Assistant Subscription Expired</h4>
            <p className="text-xs text-amber-700 mt-0.5">
              Your previous AI subscription ended on{' '}
              {statusData.aiExpiresAt ? new Date(statusData.aiExpiresAt).toLocaleDateString() : 'recently'}.
              Renew below to restore full access for your administrators and Ustadhs.
            </p>
          </div>
        </div>
      )}

      {/* Hero Showcase Header with Ambient Islamic Geometric Animation */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0A0F1D] text-white p-6 sm:p-10 border border-slate-800 shadow-xl">
        {/* Breathing Emerald Glow Orbs */}
        <div className="absolute -top-20 -right-20 w-80 h-80 sm:w-96 sm:h-96 rounded-full bg-[#37C6A3]/15 blur-3xl pointer-events-none animate-hero-pulse" />
        <div
          className="absolute top-1/2 right-24 w-60 h-60 rounded-full bg-teal-500/10 blur-2xl pointer-events-none animate-hero-pulse"
          style={{ animationDelay: '3s' }}
        />
        <div
          className="absolute -bottom-20 right-10 w-72 h-72 rounded-full bg-emerald-600/10 blur-3xl pointer-events-none animate-hero-pulse"
          style={{ animationDelay: '6s' }}
        />

        {/* Ambient Rotating Islamic 8-Point Geometric Star Emblem & Orbital Rings */}
        <div className="absolute -right-12 sm:right-4 lg:right-10 top-1/2 -translate-y-1/2 pointer-events-none select-none opacity-20 sm:opacity-40 transition-opacity">
          <div className="relative w-64 h-64 sm:w-80 sm:h-80 flex items-center justify-center">
            {/* Outer Reverse Rotating Dashed Halo Ring */}
            <div className="absolute inset-0 flex items-center justify-center animate-hero-reverse">
              <svg viewBox="0 0 240 240" className="w-full h-full text-[#37C6A3]/50 stroke-current fill-none">
                <circle cx="120" cy="120" r="112" strokeWidth="1" strokeDasharray="6 8" />
                <circle cx="120" cy="120" r="100" strokeWidth="0.8" strokeDasharray="3 5" opacity="0.6" />
              </svg>
            </div>

            {/* Primary Rotating Islamic 8-Point Geometric Star (Khatam) */}
            <div className="absolute inset-4 sm:inset-6 flex items-center justify-center animate-hero-spin">
              <svg viewBox="0 0 200 200" className="w-full h-full text-[#37C6A3] stroke-current fill-none">
                {/* Concentric Decorative Rings */}
                <circle cx="100" cy="100" r="90" strokeWidth="1.2" opacity="0.35" />
                {/* Interlacing 8-Point Khatam Geometry (Rotated Double Squares) */}
                <rect x="35" y="35" width="130" height="130" rx="3" strokeWidth="1.6" opacity="0.5" />
                <rect
                  x="35"
                  y="35"
                  width="130"
                  height="130"
                  rx="3"
                  strokeWidth="1.6"
                  opacity="0.5"
                  transform="rotate(45 100 100)"
                />
                {/* Inner Octagonal Diamond Struts */}
                <polygon
                  points="100,20 124,76 180,100 124,124 100,180 76,124 20,100 76,76"
                  strokeWidth="1"
                  opacity="0.3"
                />
                <polygon
                  points="100,20 124,76 180,100 124,124 100,180 76,124 20,100 76,76"
                  strokeWidth="1"
                  opacity="0.3"
                  transform="rotate(45 100 100)"
                />
                {/* Central Core Medallion */}
                <circle cx="100" cy="100" r="34" strokeWidth="1.2" strokeDasharray="4 4" opacity="0.5" />
                <circle cx="100" cy="100" r="18" strokeWidth="1.5" opacity="0.65" />
                <circle cx="100" cy="100" r="5" fill="#37C6A3" opacity="0.85" />
              </svg>
            </div>

            {/* Floating Twinkle Sparkle Particles */}
            <span
              className="absolute top-6 left-12 text-[#37C6A3] text-sm animate-sparkle"
              style={{ animationDelay: '0s' }}
            >
              ✦
            </span>
            <span
              className="absolute bottom-8 right-8 text-emerald-300 text-xs animate-sparkle"
              style={{ animationDelay: '1.6s' }}
            >
              ✧
            </span>
            <span
              className="absolute top-1/2 right-4 text-[#37C6A3] text-base animate-sparkle"
              style={{ animationDelay: '2.8s' }}
            >
              ✦
            </span>
            <span
              className="absolute bottom-14 left-8 text-teal-300 text-xs animate-sparkle"
              style={{ animationDelay: '2.1s' }}
            >
              ✧
            </span>
          </div>
        </div>

        {/* Hero Content Layer */}
        <div className="relative z-10 max-w-3xl">
          {/* Shimmer Sweep Badge */}
          <div className="relative overflow-hidden inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#37C6A3]/20 border border-[#37C6A3]/30 text-[#37C6A3] text-xs font-semibold mb-4 shadow-xs">
            <span className="absolute inset-0 -translate-x-full animate-badge-shimmer bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none" />
            <Sparkles className="w-3.5 h-3.5 shrink-0 relative z-10" />
            <span className="relative z-10">MadrasaNexa Smart AI Assistant</span>
            <span className="text-slate-400 relative z-10">|</span>
            <span className="flex items-center gap-1 text-slate-300 relative z-10">
              <Lock className="w-3 h-3 text-amber-400" />
              Locked Preview
            </span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
            Empower Your Madrasa With an <span className="text-[#37C6A3]">Intelligent Islamic Copilot</span>
          </h1>

          <p className="mt-3 sm:mt-4 text-sm sm:text-base text-slate-300 leading-relaxed">
            Generate exam papers & answer keys in seconds, craft 30-minute structured Islamic lesson plans,
            design event posters, and translate materials across Tamil, English, and Arabic.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-4 text-xs font-medium text-slate-300">
            <div className="flex items-center gap-1.5 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
              <ShieldCheck className="w-4 h-4 text-[#37C6A3]" />
              <span>Zero-Storage In-Memory RAM Processing</span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Powered by Cloudflare Workers AI</span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Unlimited Access for Admin & All Ustadhs</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Feature Capability Cards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-[#0F172A]">Core AI Assistant Capabilities</h2>
            <p className="text-xs text-[#7C8A9A]">Built exclusively for Madrasa workflows — no database queries, 100% private</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Feature 1 */}
          <div className="bg-white rounded-2xl p-5 border border-[#E7E9EE] shadow-xs hover:border-[#37C6A3]/40 transition group">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100 group-hover:scale-105 transition">
                <FileText className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-[#0F172A]">Zero-Storage PDF Exam Paper Generator</h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    RAM-Only
                  </span>
                </div>
                <p className="text-xs text-[#7C8A9A] mt-1.5 leading-relaxed">
                  Upload textbook or syllabus PDFs (parsed strictly in RAM and discarded immediately). Instantly generates MCQs,
                  short questions, essay questions, and comprehensive answer keys in Tamil, English, Arabic, or Bilingual ready for A4 printing.
                </p>
              </div>
            </div>
          </div>

          {/* Feature 2 */}
          <div className="bg-white rounded-2xl p-5 border border-[#E7E9EE] shadow-xs hover:border-[#37C6A3]/60 transition group">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0 border border-teal-100 group-hover:scale-105 transition">
                <Clock className="w-5 h-5 text-teal-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-[#0F172A]">Ustadh 30-Min Lesson Planner</h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800">
                    Ustadh Copilot
                  </span>
                </div>
                <p className="text-xs text-[#7C8A9A] mt-1.5 leading-relaxed">
                  Step-by-step timed classroom lesson plans with Hook (5m), Core Instruction (15m), Activity (7m), Plenary (3m),
                  Quranic/Hadith proofs, and interactive blackboard summary diagrams tailored for Islamic education.
                </p>
              </div>
            </div>
          </div>

          {/* Feature 3 */}
          <div className="bg-white rounded-2xl p-5 border border-[#E7E9EE] shadow-xs hover:border-[#37C6A3]/60 transition group">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-emerald-50 text-[#37C6A3] flex items-center justify-center shrink-0 border border-emerald-100 group-hover:scale-105 transition">
                <ImageIcon className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-[#0F172A]">Madrasa Event Poster & Flyer Maker</h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    Flux 1 Schnell
                  </span>
                </div>
                <p className="text-xs text-[#7C8A9A] mt-1.5 leading-relaxed">
                  Create high-resolution Islamic event announcement flyers, Hifz graduation posters, and admission banners with one click.
                  Direct client download without server storage.
                </p>
              </div>
            </div>
          </div>

          {/* Feature 4 */}
          <div className="bg-white rounded-2xl p-5 border border-[#E7E9EE] shadow-xs hover:border-[#37C6A3]/60 transition group">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0 border border-teal-100 group-hover:scale-105 transition">
                <Languages className="w-5 h-5 text-teal-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-[#0F172A]">Multilingual Islamic Translator</h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800">
                    Tamil • English • Arabic
                  </span>
                </div>
                <p className="text-xs text-[#7C8A9A] mt-1.5 leading-relaxed">
                  High-fidelity translation between Tamil, English, and Arabic preserving Islamic terminology (Du'a, Hadith, Salah, Adab)
                  for student notices, curriculum guides, and parent circulars.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Live Request Status Banner (If user has submitted a receipt) */}
      {latestRequest && !showResubmitForm && (
        <div
          id="unlock-section"
          className={`rounded-2xl p-5 sm:p-6 border transition scroll-mt-6 ${
            isPending
              ? 'bg-amber-50 border-amber-200 text-amber-950'
              : isRejected
              ? 'bg-red-50 border-red-200 text-red-950'
              : 'bg-emerald-50 border-emerald-200 text-emerald-950'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  isPending
                    ? 'bg-amber-200/80 text-amber-800'
                    : isRejected
                    ? 'bg-red-200/80 text-red-800'
                    : 'bg-emerald-200/80 text-emerald-800'
                }`}
              >
                {isPending ? <Clock className="w-5 h-5" /> : isRejected ? <AlertCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold">
                    {isPending
                      ? 'AI Subscription Request Pending Super Admin Approval ⏳'
                      : isRejected
                      ? 'AI Subscription Request Rejected'
                      : 'AI Subscription Active'}
                  </h3>
                  <span
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                      isPending
                        ? 'bg-amber-200 text-amber-900'
                        : isRejected
                        ? 'bg-red-200 text-red-900'
                        : 'bg-emerald-200 text-emerald-900'
                    }`}
                  >
                    {latestRequest.status}
                  </span>
                </div>

                <div className="text-xs mt-1.5 space-y-0.5 opacity-90">
                  <p>
                    <span className="font-semibold">Plan:</span> {latestRequest.planName} (
                    {currency} {latestRequest.amount.toLocaleString()}) •{' '}
                    <span className="font-semibold">Ref:</span> {latestRequest.transactionRef}
                  </p>
                  <p>
                    <span className="font-semibold">Submitted:</span>{' '}
                    {new Date(latestRequest.createdAt).toLocaleString()}
                  </p>
                  {isPending && (
                    <p className="text-amber-800 font-medium pt-1">
                      Our team verifies bank deposits and activates AI access within 2 to 4 hours. You can refresh this page to check for activation.
                    </p>
                  )}
                  {isRejected && latestRequest.adminNote && (
                    <div className="mt-2 p-2.5 bg-red-100 rounded-lg text-red-800 text-xs">
                      <span className="font-bold">Reason for Rejection:</span> {latestRequest.adminNote}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={onRefresh}
                className="px-3.5 py-2 text-xs font-semibold bg-white rounded-xl border border-current/20 hover:bg-white/80 transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Status</span>
              </button>

              {isRejected && !isTeacher && (
                <button
                  onClick={() => setShowResubmitForm(true)}
                  className="px-4 py-2 text-xs font-bold text-white bg-red-600 rounded-xl hover:bg-red-700 transition cursor-pointer shadow-xs"
                >
                  Re-submit Receipt
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* For Teacher Portal: Notice explaining activation is done by Madrasa Admin */}
      {isTeacher && (
        <div id="unlock-section" className="bg-white rounded-2xl p-6 border border-[#E7E9EE] text-center max-w-xl mx-auto shadow-xs scroll-mt-6">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-[#0F172A]">AI Assistant is Currently Locked</h3>
          <p className="text-xs text-[#7C8A9A] mt-2 leading-relaxed">
            AI Assistant access is enabled at the institutional level for your entire Madrasa.
            Please notify your Madrasa Administrator to activate the subscription using their Madrasa Admin dashboard.
            Once activated by Super Admin, all Ustadhs receive instant full access!
          </p>
        </div>
      )}

      {/* For Madrasa Admin: Subscription Pricing & Bank Payment Receipt Upload */}
      {!isTeacher && (!isPending || showResubmitForm) && (
        <div id="unlock-section" className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start scroll-mt-6">
          {/* Left Column: Pricing Plans & Official Bank Details */}
          <div className="lg:col-span-5 space-y-6">
            {/* Pricing Card */}
            <div className="bg-white rounded-3xl p-6 border border-[#E7E9EE] shadow-sm">
              <h3 className="text-base font-bold text-[#0F172A]">Select Subscription Plan</h3>
              <p className="text-xs text-[#7C8A9A] mt-1">Full access for Admin and all Ustadhs</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                {/* Monthly Option */}
                <button
                  type="button"
                  onClick={() => setSelectedPlan('Monthly')}
                  className={`p-4 rounded-2xl text-left border transition cursor-pointer relative ${
                    selectedPlan === 'Monthly'
                      ? 'border-[#37C6A3] bg-[#37C6A3]/5 ring-2 ring-[#37C6A3]/20'
                      : 'border-[#E7E9EE] hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="text-xs font-bold text-[#0F172A]">Monthly Plan</div>
                  <div className="mt-2 text-lg font-extrabold text-[#0F172A]">
                    {currency} {monthlyPrice.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-[#7C8A9A]">Billed monthly</div>
                </button>

                {/* Yearly Option */}
                <button
                  type="button"
                  onClick={() => setSelectedPlan('Yearly')}
                  className={`p-4 rounded-2xl text-left border transition cursor-pointer relative ${
                    selectedPlan === 'Yearly'
                      ? 'border-[#37C6A3] bg-[#37C6A3]/5 ring-2 ring-[#37C6A3]/20'
                      : 'border-[#E7E9EE] hover:border-slate-300 bg-white'
                  }`}
                >
                  <span className="absolute -top-2 right-2 text-[9px] font-bold bg-[#37C6A3] text-white px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Save 17%
                  </span>
                  <div className="text-xs font-bold text-[#0F172A]">Yearly Plan</div>
                  <div className="mt-2 text-lg font-extrabold text-[#0F172A]">
                    {currency} {yearlyPrice.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-emerald-600 font-medium">Best Value (2 mo. free)</div>
                </button>
              </div>

              {/* What's included checklist */}
              <div className="mt-5 pt-5 border-t border-[#E7E9EE] space-y-2.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#7C8A9A]">
                  Plan Benefits
                </div>
                {(settings?.featuresList && Array.isArray(settings.featuresList)
                  ? settings.featuresList
                  : [
                      'Zero-Storage PDF Exam Paper & Answer Key Generator',
                      'Ustadh 30-Min Lesson Planner & Board Summaries',
                      'Madrasa Event Poster Maker (Flux 1 Schnell)',
                      '3-Language Islamic Translator (Tamil, English, Arabic)',
                      'Unlimited usage for Admin and all Ustadhs',
                    ]
                ).map((feat, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs text-[#0F172A]">
                    <CheckCircle2 className="w-4 h-4 text-[#37C6A3] shrink-0 mt-0.5" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Official Bank Account Details */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-3xl p-6 shadow-md border border-slate-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#37C6A3]" />
                  <h4 className="text-xs font-bold tracking-wider uppercase text-slate-300">
                    Official Bank Transfer Details
                  </h4>
                </div>
                <span className="text-[10px] font-mono text-[#37C6A3] bg-[#37C6A3]/10 px-2 py-0.5 rounded border border-[#37C6A3]/30">
                  Direct Deposit
                </span>
              </div>

              <div className="mt-4 space-y-2.5 text-xs">
                <div>
                  <div className="text-[10px] text-slate-400">Bank Name</div>
                  <div className="font-bold text-white text-sm">{settings?.bankName || 'Bank of Ceylon (BOC)'}</div>
                </div>

                <div>
                  <div className="text-[10px] text-slate-400">Account Name</div>
                  <div className="font-semibold text-slate-200">{settings?.accountName || 'MadrasaNexa Platform (Pvt) Ltd'}</div>
                </div>

                <div className="bg-slate-800/90 p-3 rounded-xl border border-slate-700 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[10px] text-slate-400">Account Number</div>
                    <div className="font-mono font-extrabold text-base text-[#37C6A3] tracking-wider">
                      {settings?.accountNumber || '008920192841'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyAccount}
                    className="p-2.5 min-h-[44px] min-w-[44px] rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 transition cursor-pointer flex items-center justify-center shrink-0"
                    title="Copy Account Number"
                    aria-label="Copy Bank Account Number"
                  >
                    {copiedAccount ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>

                <div>
                  <div className="text-[10px] text-slate-400">Branch</div>
                  <div className="font-medium text-slate-300">{settings?.branch || 'Colombo Corporate Branch'}</div>
                </div>

                {settings?.instructions && (
                  <div className="mt-3 p-2.5 bg-slate-800/50 rounded-xl text-[11px] text-slate-400 leading-relaxed border border-slate-700/50">
                    {settings.instructions}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Bank Receipt Upload Form */}
          <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-8 border border-[#E7E9EE] shadow-sm">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-9 h-9 rounded-xl bg-[#37C6A3]/10 text-[#37C6A3] flex items-center justify-center font-bold">
                <FileCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#0F172A]">Upload Bank Payment Receipt</h3>
                <p className="text-xs text-[#7C8A9A]">Complete transfer and upload receipt slip for instant activation</p>
              </div>
            </div>

            {errorMsg && (
              <div className="mt-4 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                <span className="flex-1">{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="mt-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-700">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                <span className="flex-1">{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              {/* Plan & Amount Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                    Selected Plan
                  </label>
                  <select
                    value={selectedPlan}
                    onChange={(e) => {
                      const val = e.target.value as 'Monthly' | 'Yearly';
                      setSelectedPlan(val);
                      setCustomAmount('');
                    }}
                    className="w-full px-3.5 py-2.5 min-h-[44px] text-xs rounded-xl border border-[#E7E9EE] focus:outline-hidden focus:border-[#37C6A3] bg-white font-medium"
                  >
                    <option value="Yearly">Yearly Plan ({currency} {yearlyPrice.toLocaleString()})</option>
                    <option value="Monthly">Monthly Plan ({currency} {monthlyPrice.toLocaleString()})</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                    Amount Paid ({currency})
                  </label>
                  <input
                    type="number"
                    value={customAmount || defaultPrice}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    required
                    min={1}
                    className="w-full px-3.5 py-2.5 min-h-[44px] text-xs rounded-xl border border-[#E7E9EE] focus:outline-hidden focus:border-[#37C6A3] bg-white font-mono font-semibold"
                  />
                </div>
              </div>

              {/* Transaction Reference */}
              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                  Bank Transaction Reference No. / Slip No. <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. BOC-TXN-9821428 or Cash Deposit Ref"
                  value={transactionRef}
                  onChange={(e) => setTransactionRef(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 min-h-[44px] text-xs rounded-xl border border-[#E7E9EE] focus:outline-hidden focus:border-[#37C6A3] bg-white font-mono"
                />
                <span className="text-[10px] text-[#7C8A9A] mt-1 block">
                  Reference number found on your online banking transfer confirmation or printed deposit slip.
                </span>
              </div>

              {/* File Upload Box */}
              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                  Bank Payment Receipt Slip (Image / PDF) <span className="text-red-500">*</span>
                </label>

                <div className="border-2 border-dashed border-[#E7E9EE] hover:border-[#37C6A3]/60 rounded-2xl p-6 text-center transition bg-[#F7F6F1]/50">
                  <input
                    type="file"
                    id="receipt-upload"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <label
                    htmlFor="receipt-upload"
                    className="cursor-pointer flex flex-col items-center justify-center min-h-[60px]"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-white border border-[#E7E9EE] text-[#37C6A3] flex items-center justify-center mb-3 shadow-xs">
                      <Upload className="w-6 h-6" />
                    </div>

                    {receiptFile ? (
                      <div className="max-w-full overflow-hidden">
                        <div className="text-xs font-bold text-[#0F172A] truncate px-2">{receiptFile.name}</div>
                        <div className="text-[10px] text-[#7C8A9A] mt-0.5 font-mono">
                          {(receiptFile.size / (1024 * 1024)).toFixed(2)} MB • Click to replace
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="text-xs font-bold text-[#0F172A]">
                          Click to upload bank transfer slip or drag & drop
                        </div>
                        <div className="text-[10px] text-[#7C8A9A] mt-1">
                          Supports PNG, JPG, WebP, PDF (Max 5 MB)
                        </div>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              {/* Submit CTA Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full min-h-[48px] py-3 px-5 rounded-2xl bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs sm:text-sm font-bold tracking-wide transition flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-[#37C6A3]" />
                    <span>Uploading Receipt & Submitting...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 text-[#37C6A3]" />
                    <span>Submit Payment Receipt for Super Admin Approval</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <p className="text-center text-[10px] text-[#7C8A9A]">
                🔒 Receipts are securely uploaded to our encrypted Cloudflare R2 media vault for verification.
              </p>
            </form>
          </div>
        </div>
      )}

      {/* Floating Bottom-Right Round AI Orb / Quick-Action Button */}
      <div className="fixed bottom-5 right-5 z-40 print:hidden">
        <div className="relative group">
          {/* Tooltip on Hover */}
          <div className="absolute right-16 top-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-2 group-hover:translate-x-0 whitespace-nowrap z-50">
            <div className="bg-[#0F172A] text-white px-3.5 py-2 rounded-xl border border-emerald-500/30 shadow-2xl flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-[#37C6A3]" />
              <div className="text-left">
                <div className="text-xs font-bold leading-none text-white">Unlock Smart AI</div>
                <div className="text-[10px] text-slate-400 mt-0.5 leading-none">
                  {isTeacher ? 'Institutional Access' : 'Upload Bank Receipt'}
                </div>
              </div>
              <div className="w-2 h-2 bg-[#0F172A] border-r border-t border-emerald-500/30 rotate-45 absolute -right-1 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {/* Outer Pulsing Halo Ripple */}
          <span className="absolute inset-0 rounded-full bg-[#37C6A3]/30 animate-orb-halo pointer-events-none" />

          {/* Round Circular Action Button */}
          <button
            type="button"
            onClick={handleOrbClick}
            className="relative w-14 h-14 min-h-[56px] min-w-[56px] rounded-full bg-[#0F172A] hover:bg-[#1E293B] text-[#37C6A3] border-2 border-[#37C6A3] shadow-[0_4px_24px_rgba(55,198,163,0.35)] hover:shadow-[0_6px_30px_rgba(55,198,163,0.55)] transition-all duration-300 flex items-center justify-center cursor-pointer animate-orb-float group-hover:scale-105 active:scale-95"
            aria-label="Unlock Smart AI Assistant"
            title="Unlock Smart AI Assistant"
          >
            <Sparkles className="w-6 h-6 text-[#37C6A3] group-hover:rotate-12 transition-transform duration-300" />

            {/* Small Lock Dot Indicator */}
            <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 rounded-full bg-amber-500 text-slate-950 border-2 border-[#0F172A] flex items-center justify-center shadow-xs">
              <Lock className="w-2.5 h-2.5" />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
