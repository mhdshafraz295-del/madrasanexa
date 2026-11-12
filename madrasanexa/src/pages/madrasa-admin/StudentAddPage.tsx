import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  apiListClasses,
  apiListAcademicSections,
  apiCreateStudent,
  type ClassItem,
  type AcademicSectionItem,
} from '../../services/api';
import {
  ArrowLeft,
  BookOpen,
  User,
  Phone,
  MessageSquare,
  FileText,
  AlertCircle,
  Loader2,
} from 'lucide-react';

export default function StudentAddPage() {
  const navigate = useNavigate();

  const [activeClasses, setActiveClasses] = useState<ClassItem[]>([]);
  const [academicSections, setAcademicSections] = useState<AcademicSectionItem[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [loadingClasses, setLoadingClasses] = useState(true);

  // Form State
  const todayStr = new Date().toISOString().split('T')[0];

  const [fullName, setFullName] = useState('');
  const [admissionNo, setAdmissionNo] = useState('');
  const [joinedAt, setJoinedAt] = useState(todayStr);

  const [classId, setClassId] = useState<string>('');
  const [feeOption, setFeeOption] = useState<'CLASS_DEFAULT' | 'CUSTOM'>('CLASS_DEFAULT');
  const [customMonthlyFee, setCustomMonthlyFee] = useState('');

  const [guardianName, setGuardianName] = useState('');
  const [guardianRelationship, setGuardianRelationship] = useState('FATHER');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [guardianEmail, setGuardianEmail] = useState('');
  const [sameAsPhone, setSameAsPhone] = useState(true);
  const [guardianWhatsapp, setGuardianWhatsapp] = useState('');
  const [whatsappNotification, setWhatsappNotification] = useState(true);
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load Active Classes & Academic Sections
  useEffect(() => {
    async function loadData() {
      try {
        setLoadingClasses(true);
        const [clsRes, secRes] = await Promise.all([
          apiListClasses({ pageSize: 100, status: 'ACTIVE', isActive: true }),
          apiListAcademicSections({ pageSize: 100, status: 'ACTIVE', isActive: true }),
        ]);
        setActiveClasses(clsRes.items || clsRes.classes || []);
        setAcademicSections(secRes.items || secRes.sections || []);
      } catch (err) {
        console.error('Failed to load classes and sections:', err);
      } finally {
        setLoadingClasses(false);
      }
    }
    loadData();
  }, []);

  const handleSectionChange = (newSectionId: string) => {
    setSelectedSectionId(newSectionId);
    if (classId) {
      const cls = activeClasses.find((c) => c.id === classId);
      if (cls && newSectionId && cls.academicSectionId !== newSectionId) {
        setClassId('');
      }
    }
  };

  const handleClassChange = (newClassId: string) => {
    setClassId(newClassId);
    if (newClassId) {
      const cls = activeClasses.find((c) => c.id === newClassId);
      if (cls && cls.academicSectionId) {
        setSelectedSectionId(cls.academicSectionId);
      }
    }
  };

  const filteredClasses = selectedSectionId
    ? activeClasses.filter((c) => c.academicSectionId === selectedSectionId)
    : activeClasses;

  // Selected Class details
  const selectedClass = activeClasses.find((c) => c.id === classId);

  // Handle WhatsApp sync
  const effectiveWhatsapp = sameAsPhone ? guardianPhone : guardianWhatsapp;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim()) {
      setError('Student full name is required.');
      return;
    }
    if (!admissionNo.trim()) {
      setError('Admission number is required.');
      return;
    }
    if (!guardianName.trim()) {
      setError('Guardian full name is required.');
      return;
    }
    if (!guardianPhone.trim()) {
      setError('Guardian contact phone number is required.');
      return;
    }

    if (whatsappNotification && !effectiveWhatsapp.trim()) {
      setError('A WhatsApp number is required when WhatsApp notifications are enabled.');
      return;
    }

    let monthlyFeeVal: number | null = null;
    if (feeOption === 'CUSTOM') {
      const parsed = parseFloat(customMonthlyFee);
      if (isNaN(parsed) || parsed < 0) {
        setError('Please provide a valid non-negative custom monthly fee amount.');
        return;
      }
      monthlyFeeVal = parsed;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const created = await apiCreateStudent({
        admissionNo: admissionNo.trim(),
        fullName: fullName.trim(),
        admissionDate: joinedAt,
        joinedAt,
        classId: classId || null,
        academicSectionId: selectedSectionId || undefined,
        monthlyFeeOverride: feeOption === 'CUSTOM' ? monthlyFeeVal : null,
        monthlyFee: feeOption === 'CUSTOM' ? monthlyFeeVal : null,
        guardianName: guardianName.trim(),
        guardianRelationship: guardianRelationship.trim(),
        guardianPhone: guardianPhone.trim(),
        guardianEmail: guardianEmail.trim() || null,
        whatsappNumber: effectiveWhatsapp.trim() || null,
        guardianWhatsapp: effectiveWhatsapp.trim() || null,
        whatsappOptIn: whatsappNotification,
        whatsappNotification,
        address: address.trim() || null,
        notes: notes.trim() || null,
      });

      navigate(`/madrasa-admin/students/${created.id}`);
    } catch (err: any) {
      console.error('Failed to register student:', err);
      setError(err.response?.data?.message || 'Failed to register student. Please check input details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Top Breadcrumb & Header */}
      <div className="flex items-center gap-3">
        <Link
          to="/madrasa-admin/students"
          className="p-2 text-[#7C8A9A] hover:text-[#0F172A] hover:bg-white rounded-xl border border-[#E7E9EE] transition shadow-xs"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A] tracking-tight">Register New Student</h1>
          <p className="text-xs sm:text-sm text-[#7C8A9A] mt-0.5">
            Add student identity, guardian contact, class assignment, and tuition fee arrangement.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-start gap-3 shadow-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
          <div className="flex-1 font-medium">{error}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Student Identity */}
        <div className="bg-white p-6 rounded-2xl border border-[#E7E9EE] shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-[#E7E9EE]">
            <User className="w-4 h-4 text-[#37C6A3]" />
            <h2 className="text-sm font-bold text-[#0F172A]">1. Student Profile</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g., Mohamed Farhan"
                className="w-full px-3.5 py-2 text-xs bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#37C6A3] focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                Admission / Student ID # <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={admissionNo}
                onChange={(e) => setAdmissionNo(e.target.value)}
                placeholder="e.g., 001, ADM-2026-04"
                className="w-full px-3.5 py-2 text-xs bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-[#37C6A3] focus:bg-white"
              />
              <p className="text-[10px] text-[#7C8A9A] mt-1">Leading zeros (e.g., '001') are strictly preserved.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                Admission / Joining Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={joinedAt}
                onChange={(e) => setJoinedAt(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#37C6A3] focus:bg-white"
              />
            </div>
          </div>
        </div>

        {/* Section 2 & 3: Class Assignment & Fee Structure */}
        <div className="bg-white p-6 rounded-2xl border border-[#E7E9EE] shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-[#E7E9EE]">
            <BookOpen className="w-4 h-4 text-[#37C6A3]" />
            <h2 className="text-sm font-bold text-[#0F172A]">2. Class & Monthly Tuition Fee</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                Academic Section <span className="text-[#7C8A9A] font-normal">(Filter)</span>
              </label>
              <div className="relative">
                <select
                  value={selectedSectionId}
                  onChange={(e) => handleSectionChange(e.target.value)}
                  disabled={loadingClasses}
                  className="w-full px-3.5 py-2 text-xs bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#37C6A3] focus:bg-white"
                >
                  <option value="">-- All Academic Sections --</option>
                  {academicSections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.code ? `(${s.code})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-[10px] text-[#7C8A9A] mt-1">
                Narrow down classes by educational division (e.g. Hifz, Kitab).
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                Assign to Class <span className="text-[#7C8A9A] font-normal">(Active classes only)</span>
              </label>
              <select
                value={classId}
                onChange={(e) => handleClassChange(e.target.value)}
                disabled={loadingClasses}
                className="w-full px-3.5 py-2 text-xs bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#37C6A3] focus:bg-white"
              >
                <option value="">-- Unassigned --</option>
                {filteredClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.code ? `(${c.code})` : ''} — LKR {c.defaultMonthlyFee}
                  </option>
                ))}
              </select>
              {filteredClasses.length === 0 && selectedSectionId && (
                <p className="text-[10px] text-amber-700 mt-1">
                  No active classes found under this section.
                </p>
              )}
            </div>

            {selectedClass && (
              <div className="sm:col-span-2 p-3 bg-[#F7F6F1] rounded-xl border border-[#E7E9EE] flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] text-[#7C8A9A] block font-medium">Selected Class Default Fee</span>
                  <span className="font-bold text-xs text-[#0F172A] font-mono">
                    LKR {selectedClass.defaultMonthlyFee} / month
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {selectedClass.academicSection && (
                    <span className="text-[10px] font-bold bg-[#08483A]/10 text-[#08483A] px-2 py-0.5 rounded border border-[#08483A]/20">
                      {selectedClass.academicSection.name}
                    </span>
                  )}
                  {selectedClass.code && (
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                      {selectedClass.code}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Fee Choice */}
          <div className="pt-2 space-y-3">
            <span className="block text-xs font-semibold text-[#0F172A]">Fee Arrangement:</span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition ${
                  feeOption === 'CLASS_DEFAULT'
                    ? 'border-[#37C6A3] bg-[#37C6A3]/5 shadow-xs'
                    : 'border-[#E7E9EE] hover:bg-[#F7F6F1]'
                }`}
              >
                <input
                  type="radio"
                  name="feeOption"
                  checked={feeOption === 'CLASS_DEFAULT'}
                  onChange={() => setFeeOption('CLASS_DEFAULT')}
                  className="mt-0.5 text-[#37C6A3] focus:ring-[#37C6A3]"
                />
                <div>
                  <div className="text-xs font-bold text-[#0F172A]">Use Class Standard Fee</div>
                  <div className="text-[11px] text-[#7C8A9A] mt-0.5">
                    {selectedClass
                      ? `Student inherits LKR ${selectedClass.defaultMonthlyFee} directly from ${selectedClass.name}.`
                      : 'Inherits fee from assigned class (or LKR 0.00 if unassigned).'}
                  </div>
                </div>
              </label>

              <label
                className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition ${
                  feeOption === 'CUSTOM'
                    ? 'border-[#37C6A3] bg-[#37C6A3]/5 shadow-xs'
                    : 'border-[#E7E9EE] hover:bg-[#F7F6F1]'
                }`}
              >
                <input
                  type="radio"
                  name="feeOption"
                  checked={feeOption === 'CUSTOM'}
                  onChange={() => setFeeOption('CUSTOM')}
                  className="mt-0.5 text-[#37C6A3] focus:ring-[#37C6A3]"
                />
                <div>
                  <div className="text-xs font-bold text-[#0F172A]">Custom Monthly Fee Override</div>
                  <div className="text-[11px] text-[#7C8A9A] mt-0.5">
                    Establish an individual rate or scholarship concession starting from joining date.
                  </div>
                </div>
              </label>
            </div>

            {feeOption === 'CUSTOM' && (
              <div className="p-4 bg-[#F7F6F1] rounded-xl border border-[#E7E9EE] space-y-2 animate-in fade-in duration-150">
                <label className="block text-xs font-semibold text-[#0F172A]">
                  Custom Monthly Fee (LKR) <span className="text-rose-500">*</span>
                </label>
                <div className="relative max-w-xs">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#7C8A9A]">
                    LKR
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required={feeOption === 'CUSTOM'}
                    value={customMonthlyFee}
                    onChange={(e) => setCustomMonthlyFee(e.target.value)}
                    placeholder="2500.00"
                    className="w-full pl-12 pr-4 py-2 text-xs bg-white border border-[#E7E9EE] rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-[#37C6A3]"
                  />
                </div>
                <p className="text-[10px] text-[#7C8A9A]">
                  This sets a customized fee override interval starting from student joining date ({joinedAt}).
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Section 4: Guardian & Contact Details */}
        <div className="bg-white p-6 rounded-2xl border border-[#E7E9EE] shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-[#E7E9EE]">
            <Phone className="w-4 h-4 text-[#37C6A3]" />
            <h2 className="text-sm font-bold text-[#0F172A]">3. Guardian & Contact Details</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                Guardian Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={guardianName}
                onChange={(e) => setGuardianName(e.target.value)}
                placeholder="e.g., Abdul Rasheed"
                className="w-full px-3.5 py-2 text-xs bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#37C6A3] focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                Relationship <span className="text-rose-500">*</span>
              </label>
              <select
                value={guardianRelationship}
                onChange={(e) => setGuardianRelationship(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#37C6A3] focus:bg-white"
              >
                <option value="FATHER">Father</option>
                <option value="MOTHER">Mother</option>
                <option value="GRANDFATHER">Grandfather</option>
                <option value="GUARDIAN">Legal Guardian</option>
                <option value="UNCLE">Uncle</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                Primary Phone Number <span className="text-rose-500">*</span>
              </label>
              <input
                type="tel"
                required
                value={guardianPhone}
                onChange={(e) => setGuardianPhone(e.target.value)}
                placeholder="e.g., +94771234567"
                className="w-full px-3.5 py-2 text-xs bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-[#37C6A3] focus:bg-white"
              />
              <p className="text-[10px] text-[#7C8A9A] mt-1">E.164 international format (e.g. +94...) recommended.</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-[#0F172A]">
                  WhatsApp Number
                </label>
                <label className="inline-flex items-center gap-1.5 text-[11px] text-[#7C8A9A] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sameAsPhone}
                    onChange={(e) => setSameAsPhone(e.target.checked)}
                    className="rounded text-[#37C6A3] focus:ring-[#37C6A3]"
                  />
                  <span>Same as Phone</span>
                </label>
              </div>
              <input
                type="tel"
                disabled={sameAsPhone}
                value={sameAsPhone ? guardianPhone : guardianWhatsapp}
                onChange={(e) => setGuardianWhatsapp(e.target.value)}
                placeholder="e.g., +94771234567"
                className="w-full px-3.5 py-2 text-xs bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-[#37C6A3] focus:bg-white disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                Guardian Email Address <span className="text-[#7C8A9A] font-normal">(Optional for Automated Receipts)</span>
              </label>
              <input
                type="email"
                value={guardianEmail}
                onChange={(e) => setGuardianEmail(e.target.value)}
                placeholder="e.g., guardian@example.com"
                className="w-full px-3.5 py-2 text-xs bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#37C6A3] focus:bg-white"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="p-3 bg-[#F7F6F1] rounded-xl border border-[#E7E9EE] flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={whatsappNotification}
                  onChange={(e) => setWhatsappNotification(e.target.checked)}
                  className="rounded text-[#37C6A3] focus:ring-[#37C6A3] w-4 h-4"
                />
                <div>
                  <div className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Consent to Receive WhatsApp Billing & Institutional Alerts</span>
                  </div>
                  <div className="text-[11px] text-[#7C8A9A]">
                    Automated invoice notices, fee receipts, and term reminders will be addressed to the WhatsApp number.
                  </div>
                </div>
              </label>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                Residential Address <span className="text-[#7C8A9A] font-normal">(Optional)</span>
              </label>
              <textarea
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street address, city, district..."
                className="w-full px-3.5 py-2 text-xs bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#37C6A3] focus:bg-white"
              />
            </div>
          </div>
        </div>

        {/* Section 5: Internal Notes */}
        <div className="bg-white p-6 rounded-2xl border border-[#E7E9EE] shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-[#E7E9EE]">
            <FileText className="w-4 h-4 text-[#37C6A3]" />
            <h2 className="text-sm font-bold text-[#0F172A]">4. Institutional Records & Notes</h2>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#0F172A] mb-1">
              Internal Administrative Remarks <span className="text-[#7C8A9A] font-normal">(Optional)</span>
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Record any special health accommodations, prior madrasa background, or internal remarks..."
              className="w-full px-3.5 py-2 text-xs bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#37C6A3] focus:bg-white"
            />
          </div>
        </div>

        {/* Actions Bar */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-2">
          <Link
            to="/madrasa-admin/students"
            className="px-5 py-2.5 text-xs font-semibold text-[#7C8A9A] hover:text-[#0F172A] rounded-xl hover:bg-white transition text-center"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-[#37C6A3] hover:bg-[#30b594] text-white text-xs font-semibold rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>Complete Student Registration</span>
          </button>
        </div>
      </form>
    </div>
  );
}
