import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  apiGetPublicAdmissionsData,
  apiUploadPublicAdmissionDocument,
  apiSubmitPublicApplication,
} from '../../services/api';
import type {
  PublicAdmissionsResponse,
  AdmissionPeriodData,
  ApplicationDocument,
  ApplicationSubmissionResult,
} from '../../services/api';
import { resolvePublicTheme } from '../../components/madrasa-public/publicThemeHelper';
import { MadrasaPublicFooter } from '../../components/madrasa-public/MadrasaPublicFooter';
import {
  GraduationCap,
  FileText,
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Phone,
  Mail,
  ShieldCheck,
  Send,
  X,
  Upload,
  Trash2,
  Copy,
  Printer,
  ChevronRight,
  User,
  BookOpen,
  Loader2,
  Sparkles,
} from 'lucide-react';

export const MadrasaAdmissionsPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<PublicAdmissionsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Application Modal & Form State
  const [selectedPeriod, setSelectedPeriod] = useState<AdmissionPeriodData | null>(null);
  const [applicantName, setApplicantName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState<'MALE' | 'FEMALE'>('MALE');
  const [guardianName, setGuardianName] = useState('');
  const [guardianRelationship, setGuardianRelationship] = useState('Father');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [guardianEmail, setGuardianEmail] = useState('');
  const [address, setAddress] = useState('');
  const [appliedClassId, setAppliedClassId] = useState('');
  const [previousSchool, setPreviousSchool] = useState('');
  const [uploadedDocs, setUploadedDocs] = useState<ApplicationDocument[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [consentAgreed, setConsentAgreed] = useState(false);

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submissionResult, setSubmissionResult] = useState<ApplicationSubmissionResult | null>(null);
  const [copiedRef, setCopiedRef] = useState(false);

  useEffect(() => {
    if (submissionResult) {
      document.body.classList.add('has-admission-receipt');
    } else {
      document.body.classList.remove('has-admission-receipt');
    }
    return () => {
      document.body.classList.remove('has-admission-receipt');
    };
  }, [submissionResult]);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    apiGetPublicAdmissionsData(slug)
      .then((res) => {
        setData(res);
        // Automatically open application form if ?apply=true or #apply in URL and periods exist
        const searchParams = new URLSearchParams(window.location.search);
        const shouldAutoApply = searchParams.get('apply') === 'true' || window.location.hash === '#apply';
        if (shouldAutoApply && res.activeAdmissionPeriods?.length > 0) {
          setSelectedPeriod(res.activeAdmissionPeriods[0]);
        }
      })
      .catch((err) => {
        const msg =
          err.response?.data?.message ||
          'Admissions information is currently unavailable for this madrasa.';
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  const handleOpenApplication = (period: AdmissionPeriodData) => {
    setSelectedPeriod(period);
    setApplicantName('');
    setDateOfBirth('');
    setGender('MALE');
    setGuardianName('');
    setGuardianRelationship('Father');
    setGuardianPhone('');
    setGuardianEmail('');
    setAddress('');
    setAppliedClassId('');
    setPreviousSchool('');
    setUploadedDocs([]);
    setConsentAgreed(false);
    setFormError(null);
    setSubmissionResult(null);
  };

  const handleDocumentUpload = async (file: File) => {
    if (!slug) return;
    if (file.size > 5 * 1024 * 1024) {
      setFormError('Supporting document must be smaller than 5 MB.');
      return;
    }
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setFormError('Allowed document formats: PDF, JPG, PNG, WebP.');
      return;
    }

    setUploadingDoc(true);
    setFormError(null);
    try {
      const doc = await apiUploadPublicAdmissionDocument(slug, file);
      setUploadedDocs((prev) => [...prev, doc]);
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to upload document.');
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleRemoveDoc = (index: number) => {
    setUploadedDocs((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug || !selectedPeriod) return;

    // Client-side validation
    if (!applicantName.trim()) {
      setFormError('Please enter the applicant full name.');
      return;
    }
    if (!dateOfBirth) {
      setFormError('Please select applicant date of birth.');
      return;
    }
    if (!guardianName.trim()) {
      setFormError('Please enter parent / legal guardian name.');
      return;
    }
    if (!guardianPhone.trim()) {
      setFormError('Please enter a valid guardian contact phone number.');
      return;
    }
    if (!guardianEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guardianEmail.trim())) {
      setFormError('Please enter a valid parent/guardian email address. Application updates are sent strictly by email.');
      return;
    }
    if (!address.trim()) {
      setFormError('Please enter your home address.');
      return;
    }
    if (!consentAgreed) {
      setFormError('Please review and check the declaration and consent before submitting.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const result = await apiSubmitPublicApplication(slug, {
        admissionPeriodId: selectedPeriod.id,
        applicantName: applicantName.trim(),
        dateOfBirth,
        gender,
        guardianName: guardianName.trim(),
        guardianRelationship: guardianRelationship.trim(),
        guardianPhone: guardianPhone.trim(),
        guardianEmail: guardianEmail.trim() || null,
        address: address.trim(),
        appliedClassId: appliedClassId || null,
        previousSchool: previousSchool.trim() || null,
        documents: uploadedDocs,
      });

      setSubmissionResult(result);
    } catch (err: any) {
      setFormError(
        err.response?.data?.message ||
          'Failed to submit admission application. Please check your inputs and try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyReference = () => {
    if (submissionResult?.applicationNo) {
      navigator.clipboard.writeText(submissionResult.applicationNo);
      setCopiedRef(true);
      setTimeout(() => setCopiedRef(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin mb-4" style={{ borderColor: '#504F34', borderTopColor: 'transparent' }} />
        <p className="text-slate-600 font-medium">Loading admissions portal...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
          <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-600">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Admissions Unavailable</h2>
          <p className="text-slate-600 text-sm mb-6 leading-relaxed">
            {error || 'This admissions portal is not currently accessible.'}
          </p>
          <Link
            to={slug ? `/madrasa/${slug}` : '/'}
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-slate-900 text-white font-medium text-sm hover:bg-slate-800 transition-colors shadow-sm"
          >
            Return to Madrasa Portal
          </Link>
        </div>
      </div>
    );
  }

  const { madrasa, activeAdmissionPeriods = [], availableClasses = [] } = data;
  const theme = resolvePublicTheme(data.theme);
  const primaryColor = theme.primaryBtnBg || '#504F34';

  return (
    <div
      className="min-h-screen flex flex-col font-sans selection:bg-[#F5F5F1] selection:text-[#252525]"
      style={{
        backgroundColor: theme.pageBg || '#FFFFFF',
        color: theme.bodyTextColor || '#252525',
      }}
    >
      {/* Navigation Header */}
      <header
        className={`sticky top-0 z-30 transition-all border-b border-[#E5E5DF] bg-white/95 backdrop-blur-md print:hidden ${
          submissionResult ? 'hidden print:hidden' : ''
        }`}
        style={{
          backgroundColor: theme.navbarBg ? `${theme.navbarBg}F2` : '#ffffffF2',
        }}
      >
        {/* Micro theme accent bar */}
        <div className="h-0.5" style={{ backgroundColor: primaryColor }} />

        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-2">
          <Link
            to={`/madrasa/${slug}`}
            className="inline-flex items-center space-x-2 text-xs sm:text-sm font-bold text-[#252525] hover:opacity-80 transition-colors p-1.5 sm:p-2 rounded-xl hover:bg-[#F5F5F1] min-w-0 flex-1 sm:flex-initial"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" style={{ color: primaryColor }} />
            <span className="truncate">Return to {madrasa.name}</span>
          </Link>

          <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
            {madrasa.logoUrl ? (
              <img
                src={madrasa.logoUrl}
                alt={madrasa.name}
                className="w-9 h-9 sm:w-10 sm:h-10 object-contain rounded-xl border border-[#E5E5DF] bg-white p-0.5 hidden sm:block shrink-0"
              />
            ) : (
              <div
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center font-serif font-bold text-xs shadow-xs hidden sm:flex text-white border border-[#E5E5DF] shrink-0"
                style={{
                  backgroundColor: primaryColor,
                }}
              >
                {madrasa.initials || madrasa.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div
              className="flex items-center space-x-1.5 text-xs font-bold px-2.5 sm:px-3.5 py-1.5 rounded-full bg-[#F5F5F1] border border-[#E5E5DF]"
              style={{ color: primaryColor }}
            >
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" style={{ color: primaryColor }} />
              <span className="hidden xs:inline sm:inline">Official Admissions Desk</span>
              <span className="xs:hidden sm:hidden">Admissions</span>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Banner with Islamic Pattern & Themed Scrim */}
      <section
        className={`relative overflow-hidden text-white py-16 sm:py-22 admissions-hero-banner print:hidden ${
          submissionResult ? 'print:hidden' : ''
        }`}
        style={{
          backgroundColor: theme.heroOverlay || '#504F34',
          backgroundImage: data.heroImageUrl
            ? `radial-gradient(circle at 50% 30%, rgba(133, 132, 92, 0.45) 0%, rgba(80, 79, 52, 0.95) 75%), url(${data.heroImageUrl})`
            : `radial-gradient(circle at 50% 30%, rgba(133, 132, 92, 0.45) 0%, rgba(80, 79, 52, 0.95) 75%)`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Subtle Islamic Lattice Motif */}
        <div
          className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0l15 15-15 15-15-15L30 0zm0 30l15 15-15 15-15-15 15-15zM0 30l15-15 15 15-15 15L0 30zm30 0l15-15 15 15-15 15-15-15z' fill='%23FFFFFF' fill-rule='evenodd'/%3E%3C/svg%3E")`,
            backgroundSize: '48px 48px',
          }}
        />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/20 text-white text-xs font-bold uppercase tracking-wider mb-5 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-white" />
            <span>Official Student Enrollment</span>
          </div>

          <h1
            className="text-2xl sm:text-4xl lg:text-5xl font-serif font-bold tracking-tight mb-4 drop-shadow-xs break-words"
            style={{ color: theme.heroTextColor || '#FFFFFF' }}
          >
            Admissions at {madrasa.name}
          </h1>

          <p className="text-[#F5F5F1] text-sm sm:text-base max-w-2xl mx-auto leading-relaxed mb-8 break-words">
            {data.heroSubtitle ||
              'Welcome to our online enrollment portal. Review currently open intake cycles, eligibility standards, and submit your admission application below.'}
          </p>

          {activeAdmissionPeriods.length > 0 && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => handleOpenApplication(activeAdmissionPeriods[0])}
                className="inline-flex items-center space-x-2.5 px-6 py-3 sm:px-7 sm:py-3.5 rounded-xl font-bold text-xs sm:text-base text-white transition-all shadow-lg hover:shadow-xl hover:scale-102 active:scale-98 border border-white/20 cursor-pointer"
                style={{
                  backgroundColor: primaryColor,
                }}
              >
                <GraduationCap className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                <span>Apply for Open Intake</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Main Content */}
      <main className={`flex-1 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10 ${submissionResult ? 'print:hidden' : ''}`}>
        {/* Active Intake Cycles */}
        <section className="w-full max-w-xl mx-auto">
          <div className="text-center mb-8">
            <span
              className="text-xs font-bold uppercase tracking-wider bg-[#F5F5F1] px-3.5 py-1 rounded-full border border-[#E5E5DF]"
              style={{ color: primaryColor }}
            >
              Open Admissions
            </span>
            <h2
              className="text-2xl sm:text-3xl font-serif font-bold tracking-tight mt-2.5 mb-2 text-[#252525]"
              style={{ color: theme.headingColor || '#252525' }}
            >
              Active Intake Cycles
            </h2>
            <p className="text-xs sm:text-sm text-[#666666] leading-relaxed">
              Currently open admission periods accepting online candidate applications.
            </p>
            <div
              className="w-12 h-1 mx-auto rounded-full mt-3"
              style={{ backgroundColor: primaryColor }}
            />
          </div>

          {activeAdmissionPeriods.length > 0 ? (
            <div className="flex flex-col items-center justify-center gap-6">
              {activeAdmissionPeriods.map((period) => (
                <div
                  key={period.id}
                  className="w-full max-w-[440px] bg-white rounded-2xl border border-[#E5E5DF] p-7 shadow-xs hover:border-[#85845C]/50 hover:shadow-md transition-all flex flex-col justify-between"
                  style={{
                    backgroundColor: theme.cardBg || '#ffffff',
                    borderColor: theme.cardBorderColor || '#E5E5DF',
                    color: theme.bodyTextColor || '#252525',
                  }}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3.5">
                      <span className="text-xs font-mono font-bold px-2.5 py-1 bg-[#F5F5F1] text-[#252525] rounded-md border border-[#E5E5DF]">
                        {period.code}
                      </span>
                      <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#F5F5F1] text-[#85845C] border border-[#85845C]/30">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Accepting Applications</span>
                      </span>
                    </div>

                    <h3
                      className="text-lg sm:text-xl font-serif font-bold mb-1.5 text-[#252525]"
                      style={{ color: theme.headingColor || '#252525' }}
                    >
                      {period.name}
                    </h3>
                    <p className="text-xs font-semibold text-[#85845C] mb-4">
                      Academic Year: {period.academicYear}
                    </p>

                    <div className="space-y-2 text-xs text-[#252525] mb-5 bg-[#F5F5F1] p-4 rounded-xl border border-[#E5E5DF]">
                      <div className="flex items-center justify-between">
                        <span className="text-[#666666]">Application Window:</span>
                        <span className="font-bold text-[#252525]">
                          {new Date(period.startDate).toLocaleDateString()} – {new Date(period.endDate).toLocaleDateString()}
                        </span>
                      </div>
                      {period.capacity && (
                        <div className="flex items-center justify-between pt-1.5 border-t border-[#E5E5DF]">
                          <span className="text-[#666666]">Intake Capacity:</span>
                          <span className="font-bold text-[#85845C]">{period.capacity} Students</span>
                        </div>
                      )}
                    </div>

                    {period.instructions && (
                      <p className="text-xs text-[#666666] leading-relaxed mb-5">
                        {period.instructions}
                      </p>
                    )}
                  </div>

                  <div className="pt-4 border-t border-[#E5E5DF]">
                    <button
                      type="button"
                      onClick={() => handleOpenApplication(period)}
                      className="w-full inline-flex items-center justify-center space-x-2 px-5 py-3.5 rounded-xl text-sm font-bold transition-all shadow-xs hover:shadow-md active:scale-98 cursor-pointer"
                      style={{
                        backgroundColor: theme.primaryBtnBg || '#85845C',
                        color: theme.primaryBtnText || '#ffffff',
                      }}
                    >
                      <FileText className="w-4 h-4 text-white" />
                      <span>Apply Now</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="w-full max-w-md mx-auto bg-white rounded-2xl border border-[#E5E5DF] p-8 text-center shadow-xs">
              <div className="w-12 h-12 rounded-full bg-[#F5F5F1] flex items-center justify-center mx-auto mb-3 text-[#85845C]">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="text-base font-serif font-bold text-[#252525] mb-1">No Open Admissions Currently</h3>
              <p className="text-xs sm:text-sm text-[#666666] max-w-md mx-auto mb-4">
                The madrasa is not accepting online intake applications at this moment. Please check back later or contact the administration directly.
              </p>
            </div>
          )}
        </section>

        {/* General Application Requirements */}
        <section className="bg-white rounded-2xl border border-[#E5E5DF] p-7 sm:p-9 shadow-xs">
          <div className="flex items-center space-x-2.5 text-xs font-bold uppercase tracking-wider text-[#85845C] mb-3">
            <BookOpen className="w-4 h-4 text-[#85845C]" />
            <span>Admissions Guidance</span>
          </div>
          <h2
            className="text-xl sm:text-2xl font-serif font-bold mb-5 tracking-tight text-[#252525]"
            style={{ color: theme.headingColor || '#252525' }}
          >
            General Enrollment Guidelines
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs sm:text-sm text-[#252525] leading-relaxed">
            <div className="flex items-start space-x-3 p-3.5 rounded-xl bg-[#F5F5F1] border border-[#E5E5DF]">
              <div className="w-6 h-6 rounded-lg bg-white border border-[#E5E5DF] flex items-center justify-center text-[#85845C] shrink-0 mt-0.5 shadow-2xs">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <span>Parent / legal guardian must accompany the applicant during in-person verification.</span>
            </div>
            <div className="flex items-start space-x-3 p-3.5 rounded-xl bg-[#F5F5F1] border border-[#E5E5DF]">
              <div className="w-6 h-6 rounded-lg bg-white border border-[#E5E5DF] flex items-center justify-center text-[#85845C] shrink-0 mt-0.5 shadow-2xs">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <span>Valid identification documentation (birth certificate, previous school records if applicable).</span>
            </div>
            <div className="flex items-start space-x-3 p-3.5 rounded-xl bg-[#F5F5F1] border border-[#E5E5DF]">
              <div className="w-6 h-6 rounded-lg bg-white border border-[#E5E5DF] flex items-center justify-center text-[#85845C] shrink-0 mt-0.5 shadow-2xs">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <span>Basic interview and oral assessment for class assignment and baseline readiness.</span>
            </div>
            <div className="flex items-start space-x-3 p-3.5 rounded-xl bg-[#F5F5F1] border border-[#E5E5DF]">
              <div className="w-6 h-6 rounded-lg bg-white border border-[#E5E5DF] flex items-center justify-center text-[#85845C] shrink-0 mt-0.5 shadow-2xs">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <span>Commitment to institutional code of conduct and attendance discipline.</span>
            </div>
          </div>
        </section>

        {/* Admissions Desk Contact */}
        <section className="bg-white rounded-2xl p-6 sm:p-7 border border-[#E5E5DF] flex flex-col sm:flex-row items-center justify-between gap-5 shadow-xs">
          <div>
            <h3 className="text-base font-serif font-bold text-[#252525]">Have Questions About Enrollment?</h3>
            <p className="text-xs text-[#666666] mt-0.5">Reach out to our admissions inquiry team directly.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {madrasa.contactPhone && (
              <a
                href={`tel:${madrasa.contactPhone}`}
                className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-[#F5F5F1] border border-[#E5E5DF] text-[#85845C] hover:bg-white shadow-xs transition-colors"
              >
                <Phone className="w-3.5 h-3.5 text-[#85845C]" />
                <span>{madrasa.contactPhone}</span>
              </a>
            )}
            {madrasa.contactEmail && (
              <a
                href={`mailto:${madrasa.contactEmail}`}
                className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-[#F5F5F1] border border-[#E5E5DF] text-[#85845C] hover:bg-white shadow-xs transition-colors"
              >
                <Mail className="w-3.5 h-3.5 text-[#85845C]" />
                <span>{madrasa.contactEmail}</span>
              </a>
            )}
          </div>
        </section>
      </main>

      {/* Online Application Modal Form & Confirmation Receipt */}
      {selectedPeriod && (
        <div
          className={`fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto ${
            submissionResult ? 'print-receipt-overlay' : ''
          }`}
        >
          <div
            className={`bg-white rounded-2xl ${
              submissionResult ? 'max-w-2xl print-receipt-modal' : 'max-w-2xl'
            } w-full my-8 p-6 sm:p-8 shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]`}
          >
            {/* Modal Header */}
            {!submissionResult ? (
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
                <div>
                  <span
                    className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border"
                    style={{ color: primaryColor, backgroundColor: '#F5F5F1', borderColor: '#E5E5DF' }}
                  >
                    {selectedPeriod.code} • {selectedPeriod.academicYear}
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 mt-1">
                    Online Admission Application
                  </h3>
                  <p className="text-xs text-slate-500">{selectedPeriod.name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPeriod(null)}
                  className="w-8 h-8 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0 screen-only-controls print:hidden">
                <div className="flex items-center space-x-2">
                  <span
                    className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border"
                    style={{ color: primaryColor, backgroundColor: '#F5F5F1', borderColor: '#E5E5DF' }}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" style={{ color: primaryColor }} />
                    <span>Application Registered</span>
                  </span>
                  <span className="text-xs text-slate-500 font-medium hidden sm:inline">Official Confirmation Receipt Ready</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPeriod(null)}
                  className="w-8 h-8 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
                  title="Close receipt"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* Modal Content / Submission Success */}
            <div className={`flex-1 overflow-y-auto ${submissionResult ? 'py-2 print:p-0 print:overflow-visible' : 'py-4 space-y-6'}`}>
              {submissionResult ? (
                /* Professional Admission Confirmation Receipt */
                <div className="space-y-4">
                  <div className="print-receipt-document bg-white border border-slate-200 rounded-2xl p-5 sm:p-7 space-y-4 text-left text-slate-800 shadow-xs">
                    {/* Header: Institutional Logo, Name, and Title */}
                    <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200">
                      <div className="flex items-center gap-3.5">
                        <img
                          src={madrasa.logoUrl || '/assets/logo/website.logo.png'}
                          alt={madrasa.name}
                          className="h-14 w-auto max-w-[85px] object-contain rounded-lg border border-slate-200/80 bg-white p-0.5 shrink-0"
                          onError={(e) => {
                            const target = e.currentTarget as HTMLImageElement;
                            if (!target.src.includes('website.logo.png')) {
                              target.src = '/assets/logo/website.logo.png';
                            }
                          }}
                        />
                        <div>
                          <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-snug">
                            {submissionResult.madrasaName || madrasa.name}
                          </h2>
                          <div
                            className="text-xs font-bold tracking-wider uppercase mt-0.5"
                            style={{ color: primaryColor }}
                          >
                            ONLINE ADMISSION CONFIRMATION
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Academic Year: <span className="font-semibold text-slate-700">{submissionResult.academicYear}</span> • Intake: <span className="font-semibold text-slate-700">{submissionResult.intakeName}</span>
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span
                          className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wide"
                          style={{ color: primaryColor, backgroundColor: '#F5F5F1', borderColor: '#E5E5DF' }}
                        >
                          <CheckCircle2 className="w-3 h-3" style={{ color: primaryColor }} />
                          <span>Registered</span>
                        </span>
                        <div className="text-[10px] font-mono text-slate-400 mt-1">Official Receipt</div>
                      </div>
                    </div>

                    {/* Accent Divider */}
                    <div className="h-1 rounded-full" style={{ backgroundColor: primaryColor }} />

                    {/* Application Reference Number Card */}
                    <div className="bg-[#F5F5F1] border border-[#E5E5DF] rounded-xl p-3.5 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                      <div className="space-y-0.5 text-center sm:text-left">
                        <span className="text-[10px] font-bold uppercase tracking-wider block text-[#666666]">
                          Application Reference Number
                        </span>
                        <div className="flex items-center justify-center sm:justify-start space-x-3">
                          <span className="text-2xl sm:text-3xl font-mono font-black text-[#252525] tracking-wider">
                            {submissionResult.applicationNo}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600">
                          Please retain this reference number for all status inquiries and institutional correspondence.
                        </p>
                      </div>

                      {/* Screen-Only Copy Button */}
                      <div className="screen-only-controls print:hidden shrink-0">
                        <button
                          type="button"
                          onClick={handleCopyReference}
                          className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white transition-colors shadow-xs cursor-pointer hover:opacity-90"
                          style={{ backgroundColor: primaryColor }}
                          title="Copy reference number"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>{copiedRef ? 'Copied!' : 'Copy Reference'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Application Dossier (2-Column Grid) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {/* Box 1: Applicant Details */}
                      <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3.5 space-y-2">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200/60 pb-1 flex items-center justify-between">
                          <span>Applicant Details</span>
                          <User className="w-3 h-3 text-slate-400" />
                        </div>
                        <div className="space-y-1.5 text-xs">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Applicant Name:</span>
                            <span className="font-bold text-slate-900 text-right">{submissionResult.applicantName}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Requested Class:</span>
                            <span className="font-semibold text-slate-800 text-right">{submissionResult.appliedClassName || 'General Admission / Baseline'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Intake Cycle:</span>
                            <span className="font-medium text-slate-800 text-right">{submissionResult.intakeName}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Academic Year:</span>
                            <span className="font-medium text-slate-800 text-right">{submissionResult.academicYear}</span>
                          </div>
                        </div>
                      </div>

                      {/* Box 2: Guardian & Submission Details */}
                      <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3.5 space-y-2">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200/60 pb-1 flex items-center justify-between">
                          <span>Guardian & Submission</span>
                          <ShieldCheck className="w-3 h-3 text-slate-400" />
                        </div>
                        <div className="space-y-1.5 text-xs">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Parent / Guardian:</span>
                            <span className="font-medium text-slate-800 text-right">{guardianName || '—'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Contact Phone:</span>
                            <span className="font-medium text-slate-800 text-right">{guardianPhone || '—'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Registered Email:</span>
                            <span className="font-medium text-slate-800 text-right truncate max-w-[160px]">{guardianEmail || '—'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Submitted On:</span>
                            <span className="font-medium text-slate-800 text-right">
                              {new Date(submissionResult.submittedAt).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Strict Email Notice Box */}
                    <div className="bg-[#F5F5F1] border border-[#E5E5DF] rounded-xl p-3 flex items-start space-x-2.5 text-xs text-slate-700">
                      <Mail className="w-4 h-4 shrink-0 mt-0.5" style={{ color: primaryColor }} />
                      <div className="space-y-0.5 leading-relaxed">
                        <p className="font-semibold text-slate-900">
                          Admission decisions and status updates are communicated strictly via email.
                        </p>
                        <p className="text-[11px] text-slate-600">
                          An official acknowledgment has been dispatched to <strong>{guardianEmail}</strong>. Please check your inbox and spam folder for interview schedules and admission decisions. Present this confirmation receipt during document verification.
                        </p>
                      </div>
                    </div>

                    {/* Official Institutional Footer */}
                    <div className="pt-2.5 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-1.5 text-[11px] text-slate-500">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 justify-center sm:justify-start">
                        {madrasa.contactPhone && (
                          <span className="inline-flex items-center space-x-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{madrasa.contactPhone}</span>
                          </span>
                        )}
                        {madrasa.contactEmail && (
                          <span className="inline-flex items-center space-x-1">
                            <Mail className="w-3 h-3 text-slate-400" />
                            <span>{madrasa.contactEmail}</span>
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 text-center sm:text-right">
                        Official Electronic Confirmation • Page 1 of 1
                      </div>
                    </div>
                  </div>

                  {/* Actions (Screen Only) */}
                  <div className="flex items-center justify-center space-x-3 pt-2 screen-only-controls print:hidden shrink-0">
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white transition-colors shadow-sm cursor-pointer hover:opacity-90"
                      style={{ backgroundColor: primaryColor }}
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print Confirmation</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedPeriod(null)}
                      className="inline-flex items-center space-x-1.5 px-5 py-2.5 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-sm cursor-pointer"
                    >
                      <span>Close</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Application Form */
                <form id="public-admissions-form" onSubmit={handleSubmitApplication} className="space-y-6">
                  {formError && (
                    <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                      <span>{formError}</span>
                    </div>
                  )}

                  {/* Section 1: Applicant Information */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase text-slate-800 flex items-center space-x-1.5">
                      <User className="w-3.5 h-3.5" style={{ color: primaryColor }} />
                      <span>Applicant Information</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                          Full Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={applicantName}
                          onChange={(e) => setApplicantName(e.target.value)}
                          placeholder="e.g. Mohammed Ahmed Farhan"
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#504F34]"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                          Date of Birth *
                        </label>
                        <input
                          type="date"
                          required
                          value={dateOfBirth}
                          onChange={(e) => setDateOfBirth(e.target.value)}
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#504F34]"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                          Gender *
                        </label>
                        <select
                          value={gender}
                          onChange={(e) => setGender(e.target.value as 'MALE' | 'FEMALE')}
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#504F34] bg-white"
                        >
                          <option value="MALE">Male</option>
                          <option value="FEMALE">Female</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Parent / Legal Guardian Details */}
                  <div className="space-y-3 pt-4 border-t border-slate-100">
                    <h4 className="text-xs font-bold uppercase text-slate-800 flex items-center space-x-1.5">
                      <ShieldCheck className="w-3.5 h-3.5" style={{ color: primaryColor }} />
                      <span>Parent / Legal Guardian Details</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                          Guardian Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={guardianName}
                          onChange={(e) => setGuardianName(e.target.value)}
                          placeholder="e.g. Ahmed Farhan"
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#504F34]"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                          Relationship *
                        </label>
                        <select
                          value={guardianRelationship}
                          onChange={(e) => setGuardianRelationship(e.target.value)}
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#504F34] bg-white"
                        >
                          <option value="Father">Father</option>
                          <option value="Mother">Mother</option>
                          <option value="Legal Guardian">Legal Guardian</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                          Contact Phone Number *
                        </label>
                        <input
                          type="tel"
                          required
                          value={guardianPhone}
                          onChange={(e) => setGuardianPhone(e.target.value)}
                          placeholder="e.g. +94 77 123 4567"
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#504F34]"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                          Parent/Guardian Email Address *
                        </label>
                        <input
                          type="email"
                          required
                          value={guardianEmail}
                          onChange={(e) => setGuardianEmail(e.target.value)}
                          placeholder="e.g. parent@example.com"
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#504F34]"
                        />
                        <p className="text-[10px] text-slate-400 mt-1">
                          Important: Application confirmations & status updates are sent strictly by email.
                        </p>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                          Home Address *
                        </label>
                        <textarea
                          rows={2}
                          required
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          placeholder="Street address, city, postal code"
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#504F34]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section 3: Academic Preference */}
                  <div className="space-y-3 pt-4 border-t border-slate-100">
                    <h4 className="text-xs font-bold uppercase text-slate-800 flex items-center space-x-1.5">
                      <BookOpen className="w-3.5 h-3.5" style={{ color: primaryColor }} />
                      <span>Academic Preference</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                          Requested Class Level
                        </label>
                        <select
                          value={appliedClassId}
                          onChange={(e) => setAppliedClassId(e.target.value)}
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#504F34] bg-white"
                        >
                          <option value="">-- Let Institution Determine --</option>
                          {availableClasses.map((cls) => (
                            <option key={cls.id} value={cls.id}>
                              {cls.name} {cls.academicSection ? `(${cls.academicSection.name})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                          Previous School / Madrasa (If Any)
                        </label>
                        <input
                          type="text"
                          value={previousSchool}
                          onChange={(e) => setPreviousSchool(e.target.value)}
                          placeholder="e.g. Al-Hikmah Primary School"
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#504F34]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section 4: Supporting Documents Upload */}
                  <div className="space-y-3 pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase text-slate-800 flex items-center space-x-1.5">
                        <Upload className="w-3.5 h-3.5" style={{ color: primaryColor }} />
                        <span>Supporting Documents</span>
                      </h4>
                      <span className="text-[11px] text-slate-400">PDF, JPG, PNG (Max 5MB)</span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                      <div className="flex items-center space-x-3">
                        <label className="cursor-pointer inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700 shadow-xs">
                          {uploadingDoc ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: primaryColor }} />
                          ) : (
                            <Upload className="w-3.5 h-3.5" style={{ color: primaryColor }} />
                          )}
                          <span>{uploadingDoc ? 'Uploading...' : 'Attach Document'}</span>
                          <input
                            type="file"
                            accept="application/pdf,image/jpeg,image/png,image/webp"
                            className="hidden"
                            disabled={uploadingDoc}
                            onChange={(e) => {
                              if (e.target.files?.[0]) handleDocumentUpload(e.target.files[0]);
                            }}
                          />
                        </label>
                        <span className="text-[11px] text-slate-500">
                          e.g. Birth Certificate, previous school certificate or report.
                        </span>
                      </div>

                      {uploadedDocs.length > 0 && (
                        <div className="space-y-1.5 pt-2 border-t border-slate-200">
                          {uploadedDocs.map((doc, idx) => (
                            <div
                              key={doc.fileId || idx}
                              className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-700"
                            >
                              <div className="flex items-center space-x-2 truncate max-w-xs sm:max-w-md">
                                <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="truncate font-medium">{doc.name}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveDoc(idx)}
                                className="text-slate-400 hover:text-rose-600 p-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Section 5: Declaration & Privacy Consent */}
                  <div className="space-y-3 pt-4 border-t border-slate-100">
                    <h4 className="text-xs font-bold uppercase text-slate-800 flex items-center space-x-1.5">
                      <ShieldCheck className="w-3.5 h-3.5" style={{ color: primaryColor }} />
                      <span>Declaration & Privacy Consent</span>
                    </h4>
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                      <label className="flex items-start space-x-3 cursor-pointer">
                        <input
                          type="checkbox"
                          required
                          checked={consentAgreed}
                          onChange={(e) => setConsentAgreed(e.target.checked)}
                          className="mt-0.5 rounded border-slate-300 w-4 h-4 shrink-0"
                          style={{ accentColor: primaryColor }}
                        />
                        <span className="text-xs text-slate-700 leading-relaxed">
                          I hereby declare that all information and supporting documents provided in this application are authentic, true, and complete. I authorize <strong>{madrasa.name}</strong> to process these details for admission consideration and agree to receive application notifications and decisions via email.
                        </span>
                      </label>
                    </div>
                  </div>
                </form>
              )}
            </div>

            {/* Modal Footer */}
            {!submissionResult && (
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100 shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedPeriod(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="public-admissions-form"
                  disabled={submitting || uploadingDoc}
                  className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-semibold transition-colors shadow-sm disabled:opacity-50"
                  style={{
                    backgroundColor: primaryColor,
                    color: theme.primaryBtnText || '#ffffff',
                  }}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Submitting Application...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Submit Application</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Institutional Footer (Strictly Hidden During Receipt Print) */}
      <div className={`print:hidden ${submissionResult ? 'hidden print:hidden' : ''}`}>
        <MadrasaPublicFooter
          slug={slug!}
          madrasaName={madrasa.name}
          logoUrl={madrasa.logoUrl}
          initials={madrasa.initials}
          theme={theme}
        />
      </div>
    </div>
  );
};

export default MadrasaAdmissionsPage;
