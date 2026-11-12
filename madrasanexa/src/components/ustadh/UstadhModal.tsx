import React, { useState, useEffect } from 'react';
import { X, Loader2, User, Phone, Mail, Calendar, DollarSign, MapPin, FileText, AlertCircle } from 'lucide-react';
import type { UstadhItem, TeachingStaffType } from '../../services/ustadh.service';

interface UstadhModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  initialData?: UstadhItem | null;
  isSaving: boolean;
}

export const UstadhModal: React.FC<UstadhModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  isSaving,
}) => {
  const [fullName, setFullName] = useState('');
  const [ustadhCode, setUstadhCode] = useState('');
  const [staffType, setStaffType] = useState<TeachingStaffType>('USTADH');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [joinDate, setJoinDate] = useState('');
  const [leaveDate, setLeaveDate] = useState('');
  const [baseMonthlySalary, setBaseMonthlySalary] = useState('');
  const [notes, setNotes] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setFullName(initialData.fullName || '');
      setUstadhCode(initialData.ustadhCode || '');
      setStaffType(initialData.staffType || 'USTADH');
      setPhoneNumber(initialData.phoneNumber || '');
      setWhatsappNumber(initialData.whatsappNumber || '');
      setEmail(initialData.email || '');
      setAddress(initialData.address || '');
      setJoinDate(initialData.joinDate || '');
      setLeaveDate(initialData.leaveDate || '');
      setBaseMonthlySalary(String(initialData.baseMonthlySalary || ''));
      setNotes(initialData.notes || '');
      setIsActive(initialData.isActive);
    } else {
      setFullName('');
      setUstadhCode('');
      setStaffType('USTADH');
      setPhoneNumber('');
      setWhatsappNumber('');
      setEmail('');
      setAddress('');
      setJoinDate(new Date().toISOString().slice(0, 10));
      setLeaveDate('');
      setBaseMonthlySalary('25000');
      setNotes('');
      setIsActive(true);
    }
    setError(null);
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      setError('Full name is required.');
      return;
    }

    if (!joinDate) {
      setError('Join date is required.');
      return;
    }

    if (leaveDate && leaveDate < joinDate) {
      setError('Leave date must be on or after join date.');
      return;
    }

    const salaryNum = parseFloat(baseMonthlySalary);
    if (isNaN(salaryNum) || salaryNum < 0) {
      setError('Base monthly salary must be a valid non-negative number.');
      return;
    }

    // E.164 check if whatsapp is provided
    if (whatsappNumber.trim()) {
      const e164Regex = /^\+[1-9]\d{7,14}$/;
      if (!e164Regex.test(whatsappNumber.trim())) {
        setError('WhatsApp number must be in international format with country code (e.g. +94783254552).');
        return;
      }
    }

    try {
      await onSave({
        staffType,
        fullName: fullName.trim(),
        ustadhCode: ustadhCode.trim() || undefined,
        phoneNumber: phoneNumber.trim() || null,
        whatsappNumber: whatsappNumber.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
        joinDate,
        leaveDate: leaveDate || null,
        baseMonthlySalary: salaryNum,
        notes: notes.trim() || null,
        isActive,
      });
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to save staff profile.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto border border-stone-200 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900">
                {initialData ? 'Edit Staff Profile' : 'Add Teaching Staff'}
              </h3>
              <p className="text-xs text-stone-500">Staff demographics, role, salary, and contact details</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 p-1.5 rounded-lg hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Staff Type */}
            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                Staff Type <span className="text-rose-500">*</span>
              </label>
              <select
                value={staffType}
                onChange={(e) => setStaffType(e.target.value as TeachingStaffType)}
                className="w-full h-10 px-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 font-bold"
                required
              >
                <option value="USTADH">Ustadh</option>
                <option value="SCHOOL_TEACHER">School Teacher</option>
              </select>
            </div>

            {/* Ustadh Code */}
            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                Staff Code (Optional)
              </label>
              <input
                type="text"
                value={ustadhCode}
                onChange={(e) => setUstadhCode(e.target.value)}
                placeholder="Auto-generated (e.g. UST001)"
                className="w-full h-10 px-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 font-mono"
              />
            </div>

            {/* Full Name */}
            <div className="sm:col-span-2">
              <label className="block font-semibold text-stone-700 mb-1">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Mr. Naleem or Ustadh Ahmed Al-Farsi"
                className="w-full h-10 px-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 font-medium"
                required
              />
            </div>


            {/* Base Monthly Salary */}
            <div>
              <label className="block font-semibold text-stone-700 mb-1 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-stone-400" />
                Base Monthly Salary (LKR) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={baseMonthlySalary}
                onChange={(e) => setBaseMonthlySalary(e.target.value)}
                placeholder="25000"
                className="w-full h-10 px-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 font-semibold"
                required
              />
            </div>

            {/* Phone Number */}
            <div>
              <label className="block font-semibold text-stone-700 mb-1 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-stone-400" />
                Phone Number
              </label>
              <input
                type="text"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="e.g. +94771234567"
                className="w-full h-10 px-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 font-mono"
              />
            </div>

            {/* WhatsApp Number */}
            <div>
              <label className="block font-semibold text-stone-700 mb-1 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-emerald-600" />
                WhatsApp Number <span className="text-stone-400 font-normal">(International E.164)</span>
              </label>
              <input
                type="text"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                placeholder="e.g. +94783254552"
                className="w-full h-10 px-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 font-mono"
              />
            </div>

            {/* Email */}
            <div className="sm:col-span-2">
              <label className="block font-semibold text-stone-700 mb-1 flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-stone-400" />
                Email Address <span className="text-stone-400 font-normal">(For salary receipts)</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ahmed@example.com"
                className="w-full h-10 px-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            {/* Join Date */}
            <div>
              <label className="block font-semibold text-stone-700 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-stone-400" />
                Join Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={joinDate}
                onChange={(e) => setJoinDate(e.target.value)}
                className="w-full h-10 px-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 font-medium"
                required
              />
            </div>

            {/* Leave Date */}
            <div>
              <label className="block font-semibold text-stone-700 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-stone-400" />
                Leave Date <span className="text-stone-400 font-normal">(If departed)</span>
              </label>
              <input
                type="date"
                value={leaveDate}
                onChange={(e) => setLeaveDate(e.target.value)}
                className="w-full h-10 px-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 font-medium"
              />
            </div>

            {/* Address */}
            <div className="sm:col-span-2">
              <label className="block font-semibold text-stone-700 mb-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-stone-400" />
                Address
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Residential address"
                className="w-full h-10 px-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            {/* Notes */}
            <div className="sm:col-span-2">
              <label className="block font-semibold text-stone-700 mb-1 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-stone-400" />
                Administrative Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Qualifications, specialization, or notes"
                className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            {/* Active Status */}
            <div className="sm:col-span-2 flex items-center gap-2">
              <input
                type="checkbox"
                id="isActiveCheckbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-stone-300"
              />
              <label htmlFor="isActiveCheckbox" className="font-semibold text-stone-800 cursor-pointer">
                Active Ustadh (Currently employed and teaching)
              </label>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-stone-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-all shadow-xs disabled:opacity-50"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{initialData ? 'Update Ustadh' : 'Create Ustadh'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
