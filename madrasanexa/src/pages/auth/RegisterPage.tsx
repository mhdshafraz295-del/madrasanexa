import { useState } from 'react';
import { Link } from 'react-router-dom';
import logoUrl from '../../assets/logo/madrasanexa-logo.png';
import { apiSubmitOnboardingRequest, type PublicOnboardingPayload } from '../../services/api';
import { ArrowLeft, CheckCircle2, AlertCircle, Loader2, Building2, User, Mail, Phone, MapPin, Send } from 'lucide-react';

export default function RegisterPage() {
  const [formData, setFormData] = useState<PublicOnboardingPayload>({
    madrasaName: '',
    contactName: '',
    email: '',
    phone: '',
    whatsappNumber: '',
    district: '',
    address: '',
    expectedStudentCount: undefined,
    message: '',
    website: '', // honeypot
  });

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'expectedStudentCount' ? (value === '' ? undefined : Number(value)) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Basic validation
    if (!formData.madrasaName.trim() || !formData.contactName.trim() || !formData.email.trim() || !formData.phone.trim()) {
      setErrorMessage('Please fill in all required fields (Madrasa Name, Contact Person, Email, and Phone).');
      return;
    }

    setIsLoading(true);
    try {
      await apiSubmitOnboardingRequest(formData);
      setIsSubmitted(true);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to submit onboarding request. Please try again.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 sm:p-6 md:p-8 overflow-y-auto overflow-x-hidden">
      {/* Full-Screen Video Background */}
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        className="fixed inset-0 h-full w-full object-cover opacity-75"
        style={{ opacity: 0.75 }}
        aria-hidden="true"
      >
        <source src="/assest/videos/video.bg.mp4" type="video/mp4" />
      </video>
      <div className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-[6px]" aria-hidden="true" />

      {/* Main Card Container */}
      <div className="relative z-10 w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-[#E7E9EE] p-6 sm:p-8 md:p-10 my-8 transition-all">
        {/* Header with Logo */}
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="mb-4">
            <img
              src={logoUrl}
              alt="MadrasaNexa"
              className="h-14 w-auto object-contain"
            />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0F172A] tracking-tight">
            Register Your Madrasa
          </h1>
          <p className="text-xs sm:text-sm text-[#7C8A9A] mt-1">
            Apply to onboard your institution onto the MadrasaNexa SaaS Platform.
          </p>
        </div>

        {isSubmitted ? (
          /* Submission Confirmation Card */
          <div className="space-y-6 text-center py-4">
            <div className="w-16 h-16 bg-[#37C6A3]/10 text-[#37C6A3] rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-[#0F172A]">Application Received!</h2>
              <p className="text-sm text-[#7C8A9A] leading-relaxed max-w-md mx-auto">
                Thank you for applying to onboard <strong className="text-[#0F172A]">{formData.madrasaName}</strong>.
                Our administrative team will review your application, verify your institution, and issue your administrator workspace credentials.
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-[#F7F6F1] border border-[#E7E9EE] text-xs text-[#0F172A] text-left space-y-1">
              <p className="font-semibold text-emerald-800">What happens next?</p>
              <p className="text-[#7C8A9A]">1. Platform Super Admin reviews and validates institutional details.</p>
              <p className="text-[#7C8A9A]">2. Your Madrasa tenant workspace and initial subscription will be provisioned.</p>
              <p className="text-[#7C8A9A]">3. Administrator access credentials will be delivered to <strong className="text-[#0F172A]">{formData.email}</strong>.</p>
            </div>
            <Link
              to="/login"
              className="w-full h-12 inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold bg-[#FFD978] text-[#0F172A] hover:bg-[#ffe18f] active:scale-[0.99] transition shadow-sm hover:shadow cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Sign In</span>
            </Link>
          </div>
        ) : (
          /* Registration Form */
          <form onSubmit={handleSubmit} className="space-y-5">
            {errorMessage && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Honeypot field - invisible to human users */}
            <div style={{ display: 'none' }} aria-hidden="true">
              <label htmlFor="website">Website</label>
              <input
                type="text"
                id="website"
                name="website"
                value={formData.website || ''}
                onChange={handleChange}
                tabIndex={-1}
                autoComplete="off"
              />
            </div>

            {/* Institution Details Section */}
            <div className="space-y-4">
              <div className="border-b border-[#E7E9EE] pb-1">
                <span className="text-xs font-bold text-[#0F172A] tracking-wider uppercase flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-[#37C6A3]" /> Institution Details
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Madrasa / Institution Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="madrasaName"
                  value={formData.madrasaName}
                  onChange={handleChange}
                  placeholder="e.g. Madrasa Al-Noor"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E7E9EE] text-sm text-[#0F172A] placeholder-[#7C8A9A]/60 focus:outline-none focus:ring-2 focus:ring-[#37C6A3]/30 focus:border-[#37C6A3] transition"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                    District / Region
                  </label>
                  <input
                    type="text"
                    name="district"
                    value={formData.district || ''}
                    onChange={handleChange}
                    placeholder="e.g. Colombo, Dhaka, Kerala"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E7E9EE] text-sm text-[#0F172A] placeholder-[#7C8A9A]/60 focus:outline-none focus:ring-2 focus:ring-[#37C6A3]/30 focus:border-[#37C6A3] transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                    Estimated Student Count
                  </label>
                  <input
                    type="number"
                    name="expectedStudentCount"
                    value={formData.expectedStudentCount ?? ''}
                    onChange={handleChange}
                    placeholder="e.g. 250"
                    min="1"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E7E9EE] text-sm text-[#0F172A] placeholder-[#7C8A9A]/60 focus:outline-none focus:ring-2 focus:ring-[#37C6A3]/30 focus:border-[#37C6A3] transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-[#7C8A9A]" /> Campus Address
                </label>
                <textarea
                  name="address"
                  value={formData.address || ''}
                  onChange={handleChange}
                  rows={2}
                  placeholder="Street address or location details"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E7E9EE] text-sm text-[#0F172A] placeholder-[#7C8A9A]/60 focus:outline-none focus:ring-2 focus:ring-[#37C6A3]/30 focus:border-[#37C6A3] transition"
                />
              </div>
            </div>

            {/* Primary Contact Section */}
            <div className="space-y-4 pt-2">
              <div className="border-b border-[#E7E9EE] pb-1">
                <span className="text-xs font-bold text-[#0F172A] tracking-wider uppercase flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-[#37C6A3]" /> Primary Administrator
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                    Contact Person Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="contactName"
                    value={formData.contactName}
                    onChange={handleChange}
                    placeholder="e.g. Usthad Ahmed"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E7E9EE] text-sm text-[#0F172A] placeholder-[#7C8A9A]/60 focus:outline-none focus:ring-2 focus:ring-[#37C6A3]/30 focus:border-[#37C6A3] transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1 flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-[#7C8A9A]" /> Official Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="admin@madrasa.org"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E7E9EE] text-sm text-[#0F172A] placeholder-[#7C8A9A]/60 focus:outline-none focus:ring-2 focus:ring-[#37C6A3]/30 focus:border-[#37C6A3] transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-[#7C8A9A]" /> Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="+94 77 123 4567"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E7E9EE] text-sm text-[#0F172A] placeholder-[#7C8A9A]/60 focus:outline-none focus:ring-2 focus:ring-[#37C6A3]/30 focus:border-[#37C6A3] transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                    WhatsApp Number
                  </label>
                  <input
                    type="tel"
                    name="whatsappNumber"
                    value={formData.whatsappNumber || ''}
                    onChange={handleChange}
                    placeholder="+94 77 123 4567"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E7E9EE] text-sm text-[#0F172A] placeholder-[#7C8A9A]/60 focus:outline-none focus:ring-2 focus:ring-[#37C6A3]/30 focus:border-[#37C6A3] transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Additional Notes / Inquiries
                </label>
                <textarea
                  name="message"
                  value={formData.message || ''}
                  onChange={handleChange}
                  rows={2}
                  placeholder="Any questions or specific requirements for your Madrasa"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E7E9EE] text-sm text-[#0F172A] placeholder-[#7C8A9A]/60 focus:outline-none focus:ring-2 focus:ring-[#37C6A3]/30 focus:border-[#37C6A3] transition"
                />
              </div>
            </div>

            {/* Submission Action */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold bg-[#FFD978] text-[#0F172A] hover:bg-[#ffe18f] active:scale-[0.99] transition shadow-sm hover:shadow disabled:opacity-60 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Submitting Application...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Submit Onboarding Application</span>
                  </>
                )}
              </button>
            </div>

            {/* Link to Login */}
            <div className="text-center pt-2">
              <p className="text-xs text-[#7C8A9A]">
                Already have an active Madrasa account?{' '}
                <Link to="/login" className="text-[#0F172A] font-semibold hover:underline">
                  Sign In
                </Link>
              </p>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
