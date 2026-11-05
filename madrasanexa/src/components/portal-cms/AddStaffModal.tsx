import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  Trash2,
  Loader2,
  AlertCircle,
  UserPlus,
  ShieldCheck,
  Check,
  Image as ImageIcon,
} from 'lucide-react';
import { createUstadh } from '../../services/ustadh.service';
import type { UstadhItem, TeachingStaffType } from '../../services/ustadh.service';
import { apiUploadMadrasaPoster } from '../../services/api';
import type { StaffPresentationItem } from '../../services/api';

interface AddStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newUstadh: UstadhItem, presentation: StaffPresentationItem) => void;
  existingOrder: number;
}

export const AddStaffModal: React.FC<AddStaffModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  existingOrder,
}) => {
  // Form fields
  const [fullName, setFullName] = useState('');
  const [staffType, setStaffType] = useState<TeachingStaffType>('USTADH');
  const [designation, setDesignation] = useState('Ustadh / Scholar');
  const [department, setDepartment] = useState('Islamic Studies');
  const [qualification, setQualification] = useState('');
  const [experienceYears, setExperienceYears] = useState('');
  const [bio, setBio] = useState('');
  const [isPublic, setIsPublic] = useState(true);

  // Photo state
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Status & validation
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setValidationError('Please select a valid image format (JPEG, PNG, or WebP).');
      return;
    }

    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setValidationError('Profile photo must be less than 5MB.');
      return;
    }

    setValidationError(null);
    setPhotoFile(file);

    // Create preview
    const previewUrl = URL.createObjectURL(file);
    setPhotoPreview(previewUrl);
  };

  const handleRemovePhoto = () => {
    setPhotoFile(null);
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
      setPhotoPreview(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Required fields validation
    if (!fullName.trim()) {
      setValidationError('Full Name is required.');
      return;
    }

    if (!designation.trim()) {
      setValidationError('Public Designation is required.');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Upload photo if present
      let photoFileId: string | null = null;
      let photoUrl: string | null = null;

      if (photoFile) {
        const uploadRes = await apiUploadMadrasaPoster(photoFile);
        photoFileId = uploadRes.fileId;
        photoUrl = uploadRes.posterUrl;
      }

      // 2. Create Ustadh profile in the database
      const todayDate = new Date().toISOString().slice(0, 10);
      const newUstadh = await createUstadh({
        fullName: fullName.trim(),
        staffType,
        joinDate: todayDate,
        baseMonthlySalary: 0,
        isActive: true,
      });

      // 3. Build public presentation item
      const presentation: StaffPresentationItem = {
        ustadhId: newUstadh.id,
        isPublic,
        sortOrder: existingOrder,
        designation: designation.trim(),
        department: department.trim() || null,
        qualification: qualification.trim() || null,
        experienceYears: experienceYears.trim() || null,
        bio: bio.trim().slice(0, 300) || null,
        photoFileId,
        photoUrl,
      };

      // 4. Notify parent
      onSuccess(newUstadh, presentation);

      // Clean up & close
      handleRemovePhoto();
      onClose();
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        'Failed to add staff member. Please check your connection and try again.';
      setValidationError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-staff-modal-title"
    >
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-[#E3E8E3] overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-[#E3E8E3] bg-[#F7F6F0]">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#E8F3ED] text-[#075E46] flex items-center justify-center shrink-0 border border-[#075E46]/10">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 id="add-staff-modal-title" className="text-base font-bold text-[#0B3028]">
                Add New Staff Member
              </h3>
              <p className="text-xs text-[#64716B]">
                Register a faculty profile and configure their public presentation.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-[#64716B] hover:text-[#0B3028] hover:bg-gray-200/60 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[calc(85vh-130px)] overflow-y-auto">
          {/* Validation Error Banner */}
          {validationError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Basic Identity */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-[#202923] mb-1">
                Full Name <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Sheikh Dr. Abdullah Farooq"
                disabled={isSubmitting}
                className="w-full px-3.5 py-2 rounded-xl border border-[#E3E8E3] text-sm text-[#202923] focus:ring-2 focus:ring-[#075E46] focus:border-transparent outline-hidden bg-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#202923] mb-1">
                Role Classification
              </label>
              <select
                value={staffType}
                onChange={(e) => {
                  const type = e.target.value as TeachingStaffType;
                  setStaffType(type);
                  if (type === 'USTADH') {
                    setDesignation('Ustadh / Scholar');
                    setDepartment('Islamic Studies');
                  } else {
                    setDesignation('Faculty Instructor');
                    setDepartment('General Curriculum');
                  }
                }}
                disabled={isSubmitting}
                className="w-full px-3 py-2 rounded-xl border border-[#E3E8E3] text-sm text-[#202923] focus:ring-2 focus:ring-[#075E46] outline-hidden bg-white cursor-pointer"
              >
                <option value="USTADH">Ustadh / Scholar</option>
                <option value="SCHOOL_TEACHER">Teacher / Faculty</option>
              </select>
            </div>
          </div>

          {/* Profile Photo Upload & Preview */}
          <div className="p-4 rounded-xl bg-[#F7F6F0] border border-[#E3E8E3] space-y-3">
            <label className="block text-xs font-bold text-[#202923]">
              Profile Photo <span className="text-[11px] font-normal text-[#64716B]">(JPG, PNG, WebP up to 5MB)</span>
            </label>

            <div className="flex items-center space-x-4">
              {/* Photo Preview Container */}
              <div className="w-16 h-16 rounded-xl overflow-hidden bg-white border border-[#E3E8E3] flex items-center justify-center shrink-0 shadow-2xs">
                {photoPreview ? (
                  <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center justify-center text-[#64716B]/60">
                    <ImageIcon className="w-6 h-6" />
                    <span className="text-[9px] uppercase font-bold mt-0.5">Photo</span>
                  </div>
                )}
              </div>

              {/* Photo Actions */}
              <div className="flex items-center space-x-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  disabled={isSubmitting}
                  className="hidden"
                  id="modal-staff-photo-input"
                />
                <label
                  htmlFor="modal-staff-photo-input"
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-[#E3E8E3] hover:border-[#075E46] bg-white text-[#075E46] text-xs font-bold cursor-pointer transition-colors shadow-2xs"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{photoPreview ? 'Change Photo' : 'Upload Photo'}</span>
                </label>

                {photoPreview && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    disabled={isSubmitting}
                    className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors"
                    title="Remove photo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Public Presentation Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#202923] mb-1">
                Public Designation <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                placeholder="e.g. Senior Ustadh / Sheikh"
                disabled={isSubmitting}
                className="w-full px-3 py-2 rounded-xl border border-[#E3E8E3] text-sm text-[#202923] focus:ring-2 focus:ring-[#075E46] outline-hidden bg-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#202923] mb-1">
                Department / Subject
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. Hifz & Tajweed"
                disabled={isSubmitting}
                className="w-full px-3 py-2 rounded-xl border border-[#E3E8E3] text-sm text-[#202923] focus:ring-2 focus:ring-[#075E46] outline-hidden bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#202923] mb-1">
                Academic & Islamic Credentials
              </label>
              <input
                type="text"
                value={qualification}
                onChange={(e) => setQualification(e.target.value)}
                placeholder="e.g. Al-Alimiyyah, Hafiz, B.A."
                disabled={isSubmitting}
                className="w-full px-3 py-2 rounded-xl border border-[#E3E8E3] text-sm text-[#202923] focus:ring-2 focus:ring-[#075E46] outline-hidden bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#202923] mb-1">
                Teaching Experience
              </label>
              <input
                type="text"
                value={experienceYears}
                onChange={(e) => setExperienceYears(e.target.value)}
                placeholder="e.g. 10+ Years"
                disabled={isSubmitting}
                className="w-full px-3 py-2 rounded-xl border border-[#E3E8E3] text-sm text-[#202923] focus:ring-2 focus:ring-[#075E46] outline-hidden bg-white"
              />
            </div>
          </div>

          {/* Short Biography */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-[#202923]">
                Short Biography / Mentorship Description
              </label>
              <span className="text-[11px] text-[#64716B]">
                {bio.length}/300 chars
              </span>
            </div>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 300))}
              placeholder="Brief scholarly background, character mentorship, or teaching philosophy."
              rows={3}
              disabled={isSubmitting}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E3E8E3] text-sm text-[#202923] focus:ring-2 focus:ring-[#075E46] outline-hidden bg-white resize-none"
            />
          </div>

          {/* Public Profile Settings Toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#F7F6F0] border border-[#E3E8E3]">
            <div className="flex items-start space-x-2.5">
              <ShieldCheck className="w-4 h-4 text-[#075E46] shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-bold text-[#0B3028] block">
                  Showcase on Public Portal
                </span>
                <span className="text-[11px] text-[#64716B]">
                  Enable this to make the profile visible on your public college website.
                </span>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                disabled={isSubmitting}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#075E46]"></div>
            </label>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-[#E3E8E3]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-[#64716B] hover:text-[#0B3028] hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center space-x-2 px-5 py-2 rounded-xl bg-[#075E46] hover:bg-[#064e3b] text-white text-xs sm:text-sm font-bold shadow-xs hover:shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Profile...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Save Staff Member</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
