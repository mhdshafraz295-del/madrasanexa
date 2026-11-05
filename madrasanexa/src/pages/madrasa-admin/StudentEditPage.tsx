import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  apiGetStudent,
  apiListClasses,
  apiListAcademicSections,
  apiUpdateStudent,
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
  Info,
} from 'lucide-react';

export default function StudentEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeClasses, setActiveClasses] = useState<ClassItem[]>([]);
  const [academicSections, setAcademicSections] = useState<AcademicSectionItem[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');

  // Form Fields
  const [fullName, setFullName] = useState('');
  const [admissionNo, setAdmissionNo] = useState('');
  const [joinedAt, setJoinedAt] = useState('');

  const [classId, setClassId] = useState<string>('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianRelationship, setGuardianRelationship] = useState('FATHER');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [guardianEmail, setGuardianEmail] = useState('');
  const [guardianWhatsapp, setGuardianWhatsapp] = useState('');
  const [sameAsPhone, setSameAsPhone] = useState(false);
  const [whatsappNotification, setWhatsappNotification] = useState(true);
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    async function loadData() {
      if (!id) return;
      try {
        setIsLoading(true);
        setError(null);
        const [studentData, classesData, sectionsData] = await Promise.all([
          apiGetStudent(id),
          apiListClasses({ pageSize: 100, status: 'ACTIVE', isActive: true }),
          apiListAcademicSections({ pageSize: 100, status: 'ACTIVE', isActive: true }),
        ]);

        let classList: ClassItem[] = classesData.classes || classesData.items || [];
        setAcademicSections(sectionsData.items || sectionsData.sections || []);

        // If student currently has a class assigned that is inactive (or not in active classes list)
        if (studentData.classId && studentData.class) {
          const alreadyInList = classList.some((c) => c.id === studentData.classId);
          if (!alreadyInList) {
            classList = [
              ...classList,
              {
                id: studentData.class.id,
                academicSectionId: studentData.class.academicSectionId ?? null,
                academicSection: studentData.class.academicSection ?? null,
                name: studentData.class.name,
                code: studentData.class.code ?? null,
                defaultMonthlyFee: studentData.class.defaultMonthlyFee ?? '0',
                status: (studentData.class.isActive === false || studentData.class.status === 'INACTIVE') ? 'INACTIVE' : 'ACTIVE',
                isActive: studentData.class.isActive ?? false,
                createdAt: '',
                updatedAt: '',
              },
            ];
          }
        }
        setActiveClasses(classList);

        // Pre-select student's section
        const currentClassObj = classList.find((c) => c.id === studentData.classId);
        if (currentClassObj && currentClassObj.academicSectionId) {
          setSelectedSectionId(currentClassObj.academicSectionId);
        } else if (studentData.class?.academicSectionId) {
          setSelectedSectionId(studentData.class.academicSectionId);
        }

        // Populate fields
        setFullName(studentData.fullName || '');
        setAdmissionNo(studentData.admissionNo || '');
        setJoinedAt(
          studentData.admissionDate
            ? studentData.admissionDate.split('T')[0]
            : studentData.joinedAt
            ? studentData.joinedAt.split('T')[0]
            : ''
        );
        setClassId(studentData.classId || '');

        setGuardianName(studentData.guardianName || '');
        setGuardianRelationship(studentData.guardianRelationship || 'FATHER');
        setGuardianPhone(studentData.guardianPhone || '');
        setGuardianEmail(studentData.guardianEmail || '');
        const whatsapp = studentData.whatsappNumber || studentData.guardianWhatsapp || '';
        setGuardianWhatsapp(whatsapp);
        setSameAsPhone(
          Boolean(whatsapp && whatsapp === studentData.guardianPhone)
        );
        setWhatsappNotification(studentData.whatsappOptIn ?? studentData.whatsappNotification ?? true);
        setAddress(studentData.address || '');
        setNotes(studentData.notes || '');
      } catch (err: any) {
        console.error('Failed to load student for editing:', err);
        setError(err.response?.data?.message || 'Failed to load student details.');
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [id]);

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

  const effectiveWhatsapp = sameAsPhone ? guardianPhone : guardianWhatsapp;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

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
      setError('Guardian phone is required.');
      return;
    }

    if (whatsappNotification && !effectiveWhatsapp.trim()) {
      setError('A WhatsApp number is required when WhatsApp notifications are enabled.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      await apiUpdateStudent(id, {
        fullName: fullName.trim(),
        admissionNo: admissionNo.trim(),
        admissionDate: joinedAt,
        joinedAt,
        classId: classId || null,
        academicSectionId: selectedSectionId || undefined,
        guardianName: guardianName.trim(),
        guardianPhone: guardianPhone.trim(),
        guardianEmail: guardianEmail.trim() || null,
        whatsappNumber: effectiveWhatsapp.trim() || null,
        guardianWhatsapp: effectiveWhatsapp.trim() || null,
        whatsappOptIn: whatsappNotification,
        whatsappNotification,
        address: address.trim() || null,
        notes: notes.trim() || null,
      });

      navigate(`/madrasa-admin/students/${id}`);
    } catch (err: any) {
      console.error('Failed to update student:', err);
      setError(err.response?.data?.message || 'Failed to update student profile.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-[#E7E9EE] p-16 flex flex-col items-center justify-center text-[#7C8A9A]">
        <Loader2 className="w-8 h-8 animate-spin text-[#37C6A3] mb-3" />
        <p className="text-xs font-medium">Loading student form...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to={`/madrasa-admin/students/${id}`}
          className="p-2 text-[#7C8A9A] hover:text-[#0F172A] hover:bg-white rounded-xl border border-[#E7E9EE] transition shadow-xs"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A] tracking-tight">Edit Student Profile</h1>
          <p className="text-xs sm:text-sm text-[#7C8A9A] mt-0.5">
            Modify biographical details, guardian communication channel, or reassign class group.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-start gap-3 shadow-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
          <div className="flex-1 font-medium">{error}</div>
        </div>
      )}

      {/* Tuition Fee Note */}
      <div className="p-4 bg-[#F7F6F1] border border-[#E7E9EE] rounded-2xl flex items-start gap-3 text-xs">
        <Info className="w-4 h-4 text-[#37C6A3] shrink-0 mt-0.5" />
        <div className="text-[#0F172A]/80 leading-relaxed">
          <span className="font-bold text-[#0F172A]">Looking to update monthly tuition fees?</span> To maintain
          financial audit trails, individual student fee overrides and class defaults are managed via the{' '}
          <Link to={`/madrasa-admin/students/${id}`} className="font-semibold text-[#37C6A3] underline">
            Fee History section on the Student Dossier page
          </Link>
          .
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Student Identity */}
        <div className="bg-white p-6 rounded-2xl border border-[#E7E9EE] shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-[#E7E9EE]">
            <User className="w-4 h-4 text-[#37C6A3]" />
            <h2 className="text-sm font-bold text-[#0F172A]">1. Student Profile</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
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
                className="w-full px-3.5 py-2 text-xs bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-[#37C6A3] focus:bg-white"
              />
              <p className="text-[10px] text-[#7C8A9A] mt-1">Leading zeros (e.g., '001') are preserved.</p>
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

        {/* Section 2: Class Assignment */}
        <div className="bg-white p-6 rounded-2xl border border-[#E7E9EE] shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-[#E7E9EE]">
            <BookOpen className="w-4 h-4 text-[#37C6A3]" />
            <h2 className="text-sm font-bold text-[#0F172A]">2. Class Assignment</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                Academic Section <span className="text-[#7C8A9A] font-normal">(Filter)</span>
              </label>
              <select
                value={selectedSectionId}
                onChange={(e) => handleSectionChange(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#37C6A3] focus:bg-white"
              >
                <option value="">-- All Academic Sections --</option>
                {academicSections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.code ? `(${s.code})` : ''}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-[#7C8A9A] mt-1">
                Narrow down classes by academic section.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                Class Group
              </label>
              <select
                value={classId}
                onChange={(e) => handleClassChange(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#37C6A3] focus:bg-white"
              >
                <option value="">-- Unassigned --</option>
                {filteredClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.code ? `(${c.code})` : ''} — LKR {c.defaultMonthlyFee}/mo{' '}
                    {(c.isActive === false || c.status === 'INACTIVE') ? '(Inactive)' : ''}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-[#7C8A9A] mt-1">
                Reassigning class updates default fee calculation when no custom override is in place.
              </p>
            </div>
          </div>
        </div>

        {/* Section 3: Guardian & Communication */}
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
                className="w-full px-3.5 py-2 text-xs bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-[#37C6A3] focus:bg-white"
              />
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
                className="w-full px-3.5 py-2 text-xs bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#37C6A3] focus:bg-white"
              />
            </div>
          </div>
        </div>

        {/* Section 4: Internal Notes */}
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
              className="w-full px-3.5 py-2 text-xs bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#37C6A3] focus:bg-white"
            />
          </div>
        </div>

        {/* Actions Bar */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            to={`/madrasa-admin/students/${id}`}
            className="px-5 py-2.5 text-xs font-semibold text-[#7C8A9A] hover:text-[#0F172A] rounded-xl hover:bg-white transition"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#37C6A3] hover:bg-[#30b594] text-white text-xs font-semibold rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>Save Student Changes</span>
          </button>
        </div>
      </form>
    </div>
  );
}
