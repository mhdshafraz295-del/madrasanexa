import React, { useEffect, useState } from 'react';
import {
  Users,
  UserPlus,
  ArrowUp,
  ArrowDown,
  Upload,
  Trash2,
  BarChart3,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { listUstadhs } from '../../services/ustadh.service';
import type { UstadhItem } from '../../services/ustadh.service';
import { apiUploadMadrasaPoster } from '../../services/api';
import type { StaffSectionConfig, StaffPresentationItem } from '../../services/api';
import { AddStaffModal } from './AddStaffModal';

interface StaffManagerTabProps {
  staffConfig: StaffSectionConfig | null;
  onChange: (config: StaffSectionConfig) => void;
  disabled?: boolean;
}

export const StaffManagerTab: React.FC<StaffManagerTabProps> = ({
  staffConfig,
  onChange,
  disabled = false,
}) => {
  const [ustadhList, setUstadhList] = useState<UstadhItem[]>([]);
  const [loadingUstadhs, setLoadingUstadhs] = useState<boolean>(true);
  const [uploadingForUstadhId, setUploadingForUstadhId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  // Default configuration if null
  const currentConfig: StaffSectionConfig = staffConfig || {
    isEnabled: true,
    showStats: true,
    sectionTitle: 'Our Scholarly Faculty & Mentors',
    sectionSubtitle: 'Dedicated scholars and educators guiding hearts and minds with wisdom and care.',
    items: [],
  };

  useEffect(() => {
    let isMounted = true;
    setLoadingUstadhs(true);
    listUstadhs({ isActive: true, pageSize: 100 })
      .then((res) => {
        if (isMounted) {
          setUstadhList(res.items || []);
        }
      })
      .catch((err) => {
        console.error('Failed to load ustadhs for CMS:', err);
      })
      .finally(() => {
        if (isMounted) setLoadingUstadhs(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleToggleSection = (enabled: boolean) => {
    onChange({
      ...currentConfig,
      isEnabled: enabled,
    });
  };

  const handleToggleStats = (showStats: boolean) => {
    onChange({
      ...currentConfig,
      showStats,
    });
  };

  const handleTitleChange = (val: string) => {
    onChange({
      ...currentConfig,
      sectionTitle: val,
    });
  };

  const handleSubtitleChange = (val: string) => {
    onChange({
      ...currentConfig,
      sectionSubtitle: val,
    });
  };

  // Find presentation item for a given ustadhId
  const getItem = (ustadhId: string): StaffPresentationItem => {
    const found = currentConfig.items.find((it) => it.ustadhId === ustadhId);
    if (found) return found;

    const ustadh = ustadhList.find((u) => u.id === ustadhId);
    const defaultDesignation =
      ustadh?.staffType === 'USTADH' ? 'Ustadh / Scholar' : 'Faculty Instructor';

    return {
      ustadhId,
      isPublic: false,
      sortOrder: currentConfig.items.length,
      designation: defaultDesignation,
      department: ustadh?.staffType === 'USTADH' ? 'Islamic Studies' : 'General Curriculum',
      qualification: '',
      experienceYears: '',
      bio: '',
      photoFileId: null,
      photoUrl: null,
    };
  };

  const updateItem = (ustadhId: string, updates: Partial<StaffPresentationItem>) => {
    const existingIndex = currentConfig.items.findIndex((it) => it.ustadhId === ustadhId);
    let newItems = [...currentConfig.items];

    if (existingIndex >= 0) {
      newItems[existingIndex] = {
        ...newItems[existingIndex],
        ...updates,
      };
    } else {
      const baseItem = getItem(ustadhId);
      newItems.push({
        ...baseItem,
        ...updates,
      });
    }

    onChange({
      ...currentConfig,
      items: newItems,
    });
  };

  const handleTogglePublic = (ustadhId: string, isPublic: boolean) => {
    updateItem(ustadhId, { isPublic });
  };

  const handleMoveOrder = (ustadhId: string, direction: 'up' | 'down') => {
    // Sort items by sortOrder
    const sorted = [...currentConfig.items].sort((a, b) => a.sortOrder - b.sortOrder);
    const index = sorted.findIndex((it) => it.ustadhId === ustadhId);
    if (index === -1) return;

    if (direction === 'up' && index > 0) {
      const temp = sorted[index].sortOrder;
      sorted[index].sortOrder = sorted[index - 1].sortOrder;
      sorted[index - 1].sortOrder = temp;
    } else if (direction === 'down' && index < sorted.length - 1) {
      const temp = sorted[index].sortOrder;
      sorted[index].sortOrder = sorted[index + 1].sortOrder;
      sorted[index + 1].sortOrder = temp;
    }

    onChange({
      ...currentConfig,
      items: sorted,
    });
  };

  const handlePhotoUpload = async (ustadhId: string, file: File) => {
    if (!file) return;
    setUploadingForUstadhId(ustadhId);
    setFeedback(null);
    try {
      const res = await apiUploadMadrasaPoster(file);
      updateItem(ustadhId, {
        photoFileId: res.fileId,
        photoUrl: res.posterUrl,
      });
      setFeedback({ type: 'success', message: 'Staff photograph uploaded successfully.' });
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to upload photo.';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setUploadingForUstadhId(null);
    }
  };

  const handleRemovePhoto = (ustadhId: string) => {
    updateItem(ustadhId, {
      photoFileId: null,
      photoUrl: null,
    });
  };

  return (
    <div className="space-y-8">
      {/* Top Banner & Section Toggles */}
      <div className="bg-white rounded-2xl border border-[#E3E8E3] p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E3E8E3]">
          <div>
            <h3 className="text-lg font-bold text-[#0B3028] flex items-center space-x-2">
              <Users className="w-5 h-5 text-[#075E46]" />
              <span>Public Staff & Faculty Section</span>
            </h3>
            <p className="text-xs text-[#64716B] mt-1">
              Select which verified faculty members appear on the public portal and customize their public presentation.
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={currentConfig.isEnabled}
              onChange={(e) => handleToggleSection(e.target.checked)}
              disabled={disabled}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#075E46]"></div>
            <span className="ms-3 text-xs font-bold text-[#202923]">
              {currentConfig.isEnabled ? 'Section Enabled' : 'Section Hidden'}
            </span>
          </label>
        </div>

        {/* Statistics Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-[#F7F6F0] border border-[#E3E8E3]">
          <div className="flex items-start space-x-3">
            <div className="w-9 h-9 rounded-lg bg-[#E8F3ED] text-[#075E46] flex items-center justify-center shrink-0">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#0B3028]">
                Display Live Institutional Key Statistics
              </h4>
              <p className="text-xs text-[#64716B] mt-0.5">
                Smoothly animates live database counts for enrolled students, total staff, and teaching faculty.
              </p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={currentConfig.showStats}
              onChange={(e) => handleToggleStats(e.target.checked)}
              disabled={disabled}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#075E46]"></div>
            <span className="ms-3 text-xs font-bold text-[#202923]">
              {currentConfig.showStats ? 'Stats Visible' : 'Stats Hidden'}
            </span>
          </label>
        </div>

        {/* Section Heading & Subheading Customization */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#64716B] mb-1.5">
              Public Section Title
            </label>
            <input
              type="text"
              value={currentConfig.sectionTitle || ''}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="e.g. Our Scholarly Faculty & Mentors"
              disabled={disabled || !currentConfig.isEnabled}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E3E8E3] text-sm text-[#202923] focus:ring-2 focus:ring-[#075E46] focus:border-transparent outline-hidden bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#64716B] mb-1.5">
              Public Section Subtitle
            </label>
            <input
              type="text"
              value={currentConfig.sectionSubtitle || ''}
              onChange={(e) => handleSubtitleChange(e.target.value)}
              placeholder="e.g. Dedicated scholars and educators guiding hearts and minds..."
              disabled={disabled || !currentConfig.isEnabled}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E3E8E3] text-sm text-[#202923] focus:ring-2 focus:ring-[#075E46] focus:border-transparent outline-hidden bg-white"
            />
          </div>
        </div>
      </div>

      {/* Upload Feedback Toast */}
      {feedback && (
        <div
          className={`p-4 rounded-xl flex items-center space-x-3 text-sm ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Staff Members List */}
      <div className="bg-white rounded-2xl border border-[#E3E8E3] p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E3E8E3]">
          <div>
            <h4 className="text-base font-bold text-[#0B3028]">
              Madrasa Staff Directory ({ustadhList.length})
            </h4>
            <p className="text-xs text-[#64716B] mt-0.5">
              Select staff profiles to showcase publicly. Private contact info and salaries are never exposed.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            disabled={disabled}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#075E46] hover:bg-[#064e3b] text-white text-xs sm:text-sm font-bold shadow-xs hover:shadow-md transition-all cursor-pointer disabled:opacity-50 shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Add New Staff Member</span>
          </button>
        </div>

        {loadingUstadhs ? (
          <div className="py-12 flex flex-col items-center justify-center text-[#64716B]">
            <Loader2 className="w-8 h-8 animate-spin text-[#075E46] mb-3" />
            <p className="text-sm">Loading staff directory...</p>
          </div>
        ) : ustadhList.length === 0 ? (
          <div className="py-12 text-center text-[#64716B]">
            <Users className="w-10 h-10 mx-auto text-[#64716B]/50 mb-3" />
            <p className="text-sm font-semibold">No active staff profiles found.</p>
            <p className="text-xs text-[#64716B] mt-1 mb-4">
              Add staff profiles to showcase them on your public institution website.
            </p>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              disabled={disabled}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#075E46] hover:bg-[#064e3b] text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Add First Staff Member</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {ustadhList.map((ustadh) => {
              const item = getItem(ustadh.id);
              const isUploading = uploadingForUstadhId === ustadh.id;

              return (
                <div
                  key={ustadh.id}
                  className={`p-5 rounded-2xl border transition-all ${
                    item.isPublic
                      ? 'border-[#075E46]/30 bg-white shadow-xs'
                      : 'border-[#E3E8E3] bg-[#F7F6F0]/60 opacity-80'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#E3E8E3]">
                    {/* Identity & Basic Info */}
                    <div className="flex items-center space-x-3.5 min-w-0">
                      {/* Photo Preview Thumbnail */}
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-[#F7F6F0] border border-[#E3E8E3] shrink-0 flex items-center justify-center">
                        {item.photoUrl ? (
                          <img
                            src={item.photoUrl}
                            alt={ustadh.fullName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-xs font-bold text-[#075E46]">
                            {ustadh.fullName.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                          <span className="text-sm font-extrabold text-[#0B3028]">
                            {ustadh.fullName}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E8F3ED] text-[#075E46] border border-[#075E46]/10">
                            {ustadh.ustadhCode}
                          </span>
                          <span className="text-[10px] font-medium text-[#64716B]">
                            {ustadh.staffType === 'USTADH' ? 'Ustadh / Scholar' : 'School Teacher'}
                          </span>
                        </div>
                        <p className="text-xs text-[#64716B] mt-0.5">
                          Tenure since {ustadh.joinDate ? new Date(ustadh.joinDate).getFullYear() : '—'}
                        </p>
                      </div>
                    </div>

                    {/* Visibility Switch & Reorder Buttons */}
                    <div className="flex items-center space-x-3 shrink-0">
                      <div className="flex items-center space-x-1 border border-[#E3E8E3] rounded-lg p-0.5 bg-white">
                        <button
                          type="button"
                          onClick={() => handleMoveOrder(ustadh.id, 'up')}
                          disabled={disabled || !item.isPublic}
                          className="p-1 text-[#64716B] hover:text-[#0B3028] disabled:opacity-30 rounded hover:bg-gray-100 transition-colors"
                          title="Move up in display order"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveOrder(ustadh.id, 'down')}
                          disabled={disabled || !item.isPublic}
                          className="p-1 text-[#64716B] hover:text-[#0B3028] disabled:opacity-30 rounded hover:bg-gray-100 transition-colors"
                          title="Move down in display order"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={item.isPublic}
                          onChange={(e) => handleTogglePublic(ustadh.id, e.target.checked)}
                          disabled={disabled}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#075E46]"></div>
                        <span className="ms-2 text-xs font-semibold text-[#202923]">
                          {item.isPublic ? 'Public' : 'Hidden'}
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Public Presentation Customizer (Visible when enabled) */}
                  {item.isPublic && (
                    <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                      <div>
                        <label className="block text-[11px] font-bold text-[#64716B] mb-1">
                          Public Designation
                        </label>
                        <input
                          type="text"
                          value={item.designation || ''}
                          onChange={(e) => updateItem(ustadh.id, { designation: e.target.value })}
                          placeholder="e.g. Senior Ustadh / Sheikh"
                          disabled={disabled}
                          className="w-full px-3 py-1.5 rounded-lg border border-[#E3E8E3] text-xs focus:ring-1 focus:ring-[#075E46] outline-hidden bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-[#64716B] mb-1">
                          Department / Subject
                        </label>
                        <input
                          type="text"
                          value={item.department || ''}
                          onChange={(e) => updateItem(ustadh.id, { department: e.target.value })}
                          placeholder="e.g. Hifz & Tajweed"
                          disabled={disabled}
                          className="w-full px-3 py-1.5 rounded-lg border border-[#E3E8E3] text-xs focus:ring-1 focus:ring-[#075E46] outline-hidden bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-[#64716B] mb-1">
                          Academic & Islamic Credentials
                        </label>
                        <input
                          type="text"
                          value={item.qualification || ''}
                          onChange={(e) => updateItem(ustadh.id, { qualification: e.target.value })}
                          placeholder="e.g. Al-Alimiyyah, Hafiz"
                          disabled={disabled}
                          className="w-full px-3 py-1.5 rounded-lg border border-[#E3E8E3] text-xs focus:ring-1 focus:ring-[#075E46] outline-hidden bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-[#64716B] mb-1">
                          Teaching Experience
                        </label>
                        <input
                          type="text"
                          value={item.experienceYears || ''}
                          onChange={(e) => updateItem(ustadh.id, { experienceYears: e.target.value })}
                          placeholder="e.g. 10+ Years"
                          disabled={disabled}
                          className="w-full px-3 py-1.5 rounded-lg border border-[#E3E8E3] text-xs focus:ring-1 focus:ring-[#075E46] outline-hidden bg-white"
                        />
                      </div>

                      {/* Biography / Mentorship notes */}
                      <div className="sm:col-span-2 lg:col-span-3">
                        <label className="block text-[11px] font-bold text-[#64716B] mb-1">
                          Short Biography / Mentorship Focus (Max 300 chars)
                        </label>
                        <input
                          type="text"
                          value={item.bio || ''}
                          onChange={(e) => updateItem(ustadh.id, { bio: e.target.value.slice(0, 300) })}
                          placeholder="Brief scholarly background, character mentorship, or teaching philosophy."
                          disabled={disabled}
                          className="w-full px-3 py-1.5 rounded-lg border border-[#E3E8E3] text-xs focus:ring-1 focus:ring-[#075E46] outline-hidden bg-white"
                        />
                      </div>

                      {/* Photo Upload / Change Actions */}
                      <div className="flex flex-col justify-end">
                        <label className="block text-[11px] font-bold text-[#64716B] mb-1">
                          Profile Photo
                        </label>
                        <div className="flex items-center space-x-2">
                          <label className="flex-1 inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-lg border border-[#E3E8E3] hover:border-[#075E46] text-[#075E46] font-bold text-xs bg-white cursor-pointer transition-colors shadow-2xs">
                            {isUploading ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#075E46]" />
                            ) : (
                              <Upload className="w-3.5 h-3.5" />
                            )}
                            <span>{item.photoUrl ? 'Replace' : 'Upload'}</span>
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              className="hidden"
                              disabled={disabled || isUploading}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handlePhotoUpload(ustadh.id, file);
                              }}
                            />
                          </label>

                          {item.photoUrl && (
                            <button
                              type="button"
                              onClick={() => handleRemovePhoto(ustadh.id)}
                              disabled={disabled}
                              className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors"
                              title="Remove photo"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add New Staff Member Modal */}
      <AddStaffModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={(newUstadh, presentation) => {
          const newItems = [
            ...currentConfig.items.filter((it) => it.ustadhId !== newUstadh.id),
            presentation,
          ];
          onChange({
            ...currentConfig,
            items: newItems,
          });

          // Refresh staff directory
          setLoadingUstadhs(true);
          listUstadhs({ isActive: true, pageSize: 100 })
            .then((res) => {
              setUstadhList(res.items || []);
              setFeedback({
                type: 'success',
                message: `Staff member "${newUstadh.fullName}" successfully registered and added to directory.`,
              });
            })
            .catch((err) => {
              console.error('Failed to reload ustadhs:', err);
            })
            .finally(() => {
              setLoadingUstadhs(false);
            });
        }}
        existingOrder={currentConfig.items.length}
      />
    </div>
  );
};
