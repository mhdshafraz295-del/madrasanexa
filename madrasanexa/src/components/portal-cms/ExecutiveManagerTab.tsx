import React, { useEffect, useState } from 'react';
import {
  Users,
  UserPlus,
  ArrowUpDown,
  Upload,
  Trash2,
  Edit2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  X,
  Award,
  Calendar,
  Quote,
} from 'lucide-react';
import {
  apiGetExecutiveMembers,
  apiCreateExecutiveMember,
  apiUpdateExecutiveMember,
  apiDeleteExecutiveMember,
  apiUploadExecutivePhoto,
} from '../../services/api';
import type { ExecutiveMember, CreateExecutiveMemberPayload } from '../../services/api';

const POSITION_PRESETS = [
  'President',
  'Vice President',
  'General Secretary',
  'Assistant Secretary',
  'Treasurer',
  'Principal / Mudir',
  'Executive Member',
  'Patron / Advisor',
  'Custom...',
];

interface ExecutiveManagerTabProps {
  disabled?: boolean;
}

export const ExecutiveManagerTab: React.FC<ExecutiveManagerTabProps> = ({ disabled = false }) => {
  const [members, setMembers] = useState<ExecutiveMember[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingMember, setEditingMember] = useState<ExecutiveMember | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Form Fields
  const [fullName, setFullName] = useState<string>('');
  const [selectedPreset, setSelectedPreset] = useState<string>('President');
  const [customPosition, setCustomPosition] = useState<string>('');
  const [displayOrder, setDisplayOrder] = useState<number>(0);
  const [qualification, setQualification] = useState<string>('');
  const [termPeriod, setTermPeriod] = useState<string>('');
  const [messageOrBio, setMessageOrBio] = useState<string>('');
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [photoFileId, setPhotoFileId] = useState<string>('');
  const [isActive, setIsActive] = useState<boolean>(true);
  const [uploadingPhoto, setUploadingPhoto] = useState<boolean>(false);

  // Delete Confirmation State
  const [memberToDelete, setMemberToDelete] = useState<ExecutiveMember | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const data = await apiGetExecutiveMembers();
      setMembers(data);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.response?.data?.message || 'Failed to load executive members.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const openAddModal = () => {
    setEditingMember(null);
    setFullName('');
    setSelectedPreset('President');
    setCustomPosition('');
    // Automatically set display order to next sequence
    const nextOrder = members.length > 0 ? Math.max(...members.map((m) => m.displayOrder || 0)) + 1 : 1;
    setDisplayOrder(nextOrder);
    setQualification('');
    setTermPeriod('');
    setMessageOrBio('');
    setPhotoUrl('');
    setPhotoFileId('');
    setIsActive(true);
    setIsModalOpen(true);
  };

  const openEditModal = (member: ExecutiveMember) => {
    setEditingMember(member);
    setFullName(member.fullName);
    if (POSITION_PRESETS.includes(member.position)) {
      setSelectedPreset(member.position);
      setCustomPosition('');
    } else {
      setSelectedPreset('Custom...');
      setCustomPosition(member.position);
    }
    setDisplayOrder(member.displayOrder ?? 0);
    setQualification(member.qualification || '');
    setTermPeriod(member.termPeriod || '');
    setMessageOrBio(member.messageOrBio || '');
    setPhotoUrl(member.photoUrl || '');
    setPhotoFileId(member.photoFileId || '');
    setIsActive(member.isActive);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (submitting || uploadingPhoto) return;
    setIsModalOpen(false);
    setEditingMember(null);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFeedback({ type: 'error', message: 'Please select a valid image file (JPG, PNG, WebP).' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setFeedback({ type: 'error', message: 'Photo must be smaller than 5 MB.' });
      return;
    }

    try {
      setUploadingPhoto(true);
      const result = await apiUploadExecutivePhoto(file);
      setPhotoUrl(result.url);
      setPhotoFileId(result.fileId);
      setFeedback({ type: 'success', message: 'Portrait photo uploaded successfully.' });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.response?.data?.message || 'Failed to upload photo.',
      });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = () => {
    setPhotoUrl('');
    setPhotoFileId('');
  };

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setFeedback({ type: 'error', message: 'Full name is required.' });
      return;
    }

    const position = selectedPreset === 'Custom...' ? customPosition.trim() : selectedPreset;
    if (!position) {
      setFeedback({ type: 'error', message: 'Position is required.' });
      return;
    }

    const payload: CreateExecutiveMemberPayload = {
      fullName: fullName.trim(),
      position,
      displayOrder: Number(displayOrder) || 0,
      qualification: qualification.trim() || null,
      termPeriod: termPeriod.trim() || null,
      messageOrBio: messageOrBio.trim() || null,
      photoUrl: photoUrl.trim() || null,
      photoFileId: photoFileId.trim() || null,
      isActive,
    };

    try {
      setSubmitting(true);
      if (editingMember) {
        await apiUpdateExecutiveMember(editingMember.id, payload);
        setFeedback({ type: 'success', message: 'Executive member updated successfully.' });
      } else {
        await apiCreateExecutiveMember(payload);
        setFeedback({ type: 'success', message: 'Executive member added successfully.' });
      }
      setIsModalOpen(false);
      fetchMembers();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.response?.data?.message || 'Failed to save executive member.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (member: ExecutiveMember) => {
    try {
      await apiUpdateExecutiveMember(member.id, { isActive: !member.isActive });
      setMembers((prev) =>
        prev.map((m) => (m.id === member.id ? { ...m, isActive: !m.isActive } : m))
      );
      setFeedback({
        type: 'success',
        message: `${member.fullName} is now ${!member.isActive ? 'active' : 'hidden'}.`,
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.response?.data?.message || 'Failed to update member status.',
      });
    }
  };

  const confirmDeleteMember = async () => {
    if (!memberToDelete) return;
    try {
      setDeleting(true);
      await apiDeleteExecutiveMember(memberToDelete.id);
      setMembers((prev) => prev.filter((m) => m.id !== memberToDelete.id));
      setFeedback({ type: 'success', message: 'Executive member deleted successfully.' });
      setMemberToDelete(null);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.response?.data?.message || 'Failed to delete member.',
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-7 space-y-6 shadow-sm">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#6B6A45]/10 flex items-center justify-center text-[#6B6A45]">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                Executive Committee & Board
              </h2>
              <p className="text-xs sm:text-sm text-slate-500">
                Manage trustees, governing board, and committee members featured on your public portal.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          disabled={disabled || loading}
          className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-[#6B6A45] hover:bg-[#585737] text-white text-xs sm:text-sm font-semibold shadow-sm transition-all shrink-0 disabled:opacity-50"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Executive Member</span>
        </button>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between text-xs sm:text-sm font-medium transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/80'
              : 'bg-rose-50 text-rose-800 border border-rose-200/80'
          }`}
        >
          <div className="flex items-center space-x-2.5">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center space-y-3">
          <Loader2 className="w-8 h-8 text-[#6B6A45] animate-spin" />
          <p className="text-xs sm:text-sm text-slate-500 font-medium">Loading executive committee members...</p>
        </div>
      ) : members.length === 0 ? (
        /* Empty State */
        <div className="py-12 sm:py-16 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 p-6">
          <div className="w-14 h-14 rounded-2xl bg-[#6B6A45]/10 text-[#6B6A45] flex items-center justify-center mx-auto mb-3.5">
            <Users className="w-7 h-7" />
          </div>
          <h3 className="text-base font-semibold text-slate-800 mb-1">No Executive Members Yet</h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mb-5">
            Add board trustees, executive officers, and patrons. They will be displayed in an interactive spotlight carousel on your tenant website.
          </p>
          <button
            type="button"
            onClick={openAddModal}
            disabled={disabled}
            className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-[#6B6A45] hover:bg-[#585737] text-white text-xs sm:text-sm font-semibold shadow-sm transition-all"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add First Member</span>
          </button>
        </div>
      ) : (
        /* Member List / Grid */
        <div className="space-y-3">
          <div className="hidden sm:grid sm:grid-cols-12 gap-4 px-4 py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider bg-slate-50 rounded-lg">
            <div className="col-span-1 text-center">Order</div>
            <div className="col-span-5">Member & Position</div>
            <div className="col-span-3">Qualification / Term</div>
            <div className="col-span-1 text-center">Status</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>

          <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-xl overflow-hidden bg-white">
            {members.map((member) => (
              <div
                key={member.id}
                className="p-4 sm:px-4 sm:py-3.5 flex flex-col sm:grid sm:grid-cols-12 gap-3 sm:gap-4 items-start sm:items-center hover:bg-slate-50/80 transition-colors"
              >
                {/* Order badge */}
                <div className="col-span-1 flex items-center sm:justify-center">
                  <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center border border-slate-200">
                    {member.displayOrder}
                  </span>
                </div>

                {/* Member Info */}
                <div className="col-span-5 flex items-center space-x-3 w-full">
                  <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0 bg-[#F4F3EC] border border-[#E2E0D0] flex items-center justify-center">
                    {member.photoUrl ? (
                      <img
                        src={member.photoUrl}
                        alt={member.fullName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xs font-bold text-[#6B6A45]">
                        {member.fullName
                          .split(' ')
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-bold text-slate-900 truncate">{member.fullName}</h4>
                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#6B6A45]/10 text-[#6B6A45]">
                        {member.position}
                      </span>
                      {member.messageOrBio && (
                        <span className="text-[10px] text-slate-400 italic truncate max-w-[150px]">
                          "{member.messageOrBio}"
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Qualification & Term */}
                <div className="col-span-3 text-xs text-slate-600 space-y-0.5">
                  {member.qualification && (
                    <div className="flex items-center space-x-1.5 truncate">
                      <Award className="w-3.5 h-3.5 text-[#8C8A58] shrink-0" />
                      <span className="truncate">{member.qualification}</span>
                    </div>
                  )}
                  {member.termPeriod && (
                    <div className="flex items-center space-x-1.5 text-slate-500 truncate">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{member.termPeriod}</span>
                    </div>
                  )}
                  {!member.qualification && !member.termPeriod && (
                    <span className="text-slate-400 text-[11px]">—</span>
                  )}
                </div>

                {/* Status Toggle */}
                <div className="col-span-1 flex items-center sm:justify-center">
                  <button
                    type="button"
                    onClick={() => handleToggleActive(member)}
                    disabled={disabled}
                    className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${
                      member.isActive
                        ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200'
                    }`}
                  >
                    {member.isActive ? (
                      <>
                        <Eye className="w-3 h-3" />
                        <span>Active</span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-3 h-3" />
                        <span>Hidden</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Actions */}
                <div className="col-span-2 flex items-center justify-end space-x-1.5 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => openEditModal(member)}
                    disabled={disabled}
                    className="p-1.5 text-slate-500 hover:text-[#6B6A45] hover:bg-[#6B6A45]/10 rounded-lg transition-colors"
                    title="Edit Member"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setMemberToDelete(member)}
                    disabled={disabled}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Delete Member"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add / Edit Member Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col my-auto">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60 shrink-0">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-[#6B6A45]/10 text-[#6B6A45] flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingMember ? 'Edit Executive Member' : 'Add Executive Member'}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeModal}
                disabled={submitting || uploadingPhoto}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveMember} className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs sm:text-sm">
              {/* Photo Upload Zone */}
              <div>
                <label className="block font-semibold text-slate-700 mb-2">Portrait Photo</label>
                <div className="flex items-center space-x-4">
                  <div className="relative w-20 h-20 rounded-2xl border-2 border-dashed border-[#6B6A45]/30 bg-[#F8F7F2] overflow-hidden flex items-center justify-center shrink-0">
                    {photoUrl ? (
                      <img src={photoUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center p-2 text-[#8C8A58]">
                        <Upload className="w-5 h-5 mx-auto mb-1 opacity-70" />
                        <span className="text-[10px] block leading-tight font-medium">No photo</span>
                      </div>
                    )}
                    {uploadingPhoto && (
                      <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                        <Loader2 className="w-5 h-5 text-[#6B6A45] animate-spin" />
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center space-x-2">
                      <label className="cursor-pointer inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors">
                        <Upload className="w-3.5 h-3.5" />
                        <span>{photoUrl ? 'Change Photo' : 'Upload Photo'}</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={handlePhotoUpload}
                          disabled={uploadingPhoto || submitting}
                          className="hidden"
                        />
                      </label>
                      {photoUrl && (
                        <button
                          type="button"
                          onClick={handleRemovePhoto}
                          disabled={uploadingPhoto || submitting}
                          className="px-2.5 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 text-xs font-semibold transition-colors"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Recommended: Square 1:1 portrait (JPG, PNG, WebP up to 5 MB).
                    </p>
                  </div>
                </div>
              </div>

              {/* Full Name */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Al-Haj M.S. Mohamed"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#6B6A45]/40 text-slate-800 text-xs sm:text-sm"
                />
              </div>

              {/* Position / Title */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Position Preset <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={selectedPreset}
                    onChange={(e) => setSelectedPreset(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#6B6A45]/40 text-slate-800 text-xs sm:text-sm bg-white"
                  >
                    {POSITION_PRESETS.map((pos) => (
                      <option key={pos} value={pos}>
                        {pos}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedPreset === 'Custom...' && (
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Custom Position <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={customPosition}
                      onChange={(e) => setCustomPosition(e.target.value)}
                      placeholder="e.g. Director of Affairs"
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#6B6A45]/40 text-slate-800 text-xs sm:text-sm"
                    />
                  </div>
                )}

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Display Order <span className="text-slate-400 font-normal">(Ascending)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      value={displayOrder}
                      onChange={(e) => setDisplayOrder(parseInt(e.target.value, 10) || 0)}
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#6B6A45]/40 text-slate-800 text-xs sm:text-sm"
                    />
                    <ArrowUpDown className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Qualification & Term Period */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Qualification / Honorific
                  </label>
                  <input
                    type="text"
                    value={qualification}
                    onChange={(e) => setQualification(e.target.value)}
                    placeholder="e.g. B.A. (Hons), Al-Alimiyyah"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#6B6A45]/40 text-slate-800 text-xs sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Term Period</label>
                  <input
                    type="text"
                    value={termPeriod}
                    onChange={(e) => setTermPeriod(e.target.value)}
                    placeholder="e.g. 2024 - 2026 or 2023 - Present"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#6B6A45]/40 text-slate-800 text-xs sm:text-sm"
                  />
                </div>
              </div>

              {/* Message / Bio */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Message / Quote / Bio <span className="text-slate-400 font-normal">(Shown in spotlight card)</span>
                </label>
                <div className="relative">
                  <textarea
                    rows={3}
                    value={messageOrBio}
                    onChange={(e) => setMessageOrBio(e.target.value)}
                    placeholder="e.g. Dedicated to nurturing steadfast Islamic character and academic excellence for generations to come."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#6B6A45]/40 text-slate-800 text-xs sm:text-sm"
                  />
                  <Quote className="w-3.5 h-3.5 text-slate-300 absolute right-3 bottom-3 pointer-events-none" />
                </div>
              </div>

              {/* Is Active Toggle */}
              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="isActiveToggle"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 text-[#6B6A45] rounded border-slate-300 focus:ring-[#6B6A45]"
                />
                <label htmlFor="isActiveToggle" className="font-semibold text-slate-700 cursor-pointer select-none">
                  Display actively on public website portal
                </label>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end space-x-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={submitting || uploadingPhoto}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs sm:text-sm font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || uploadingPhoto}
                  className="inline-flex items-center space-x-1.5 px-5 py-2.5 rounded-xl bg-[#6B6A45] hover:bg-[#585737] text-white text-xs sm:text-sm font-semibold shadow-sm transition-all disabled:opacity-50"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{editingMember ? 'Update Member' : 'Save Member'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {memberToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
            <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h4 className="text-base font-bold text-slate-900">Delete Executive Member?</h4>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Are you sure you want to remove <span className="font-semibold text-slate-800">{memberToDelete.fullName}</span> from the executive committee?
              </p>
            </div>
            <div className="flex items-center space-x-2.5 pt-2">
              <button
                type="button"
                onClick={() => setMemberToDelete(null)}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs sm:text-sm font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteMember}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-semibold shadow-sm transition-all disabled:opacity-50 inline-flex items-center justify-center space-x-1"
              >
                {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
