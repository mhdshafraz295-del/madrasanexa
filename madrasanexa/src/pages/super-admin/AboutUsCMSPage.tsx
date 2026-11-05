import React, { useState, useEffect, useRef } from 'react';
import {
  aboutUsService,
  toDraftUpdatePayload,
  type AdminAboutUsData,
  type AboutUsContentSnapshot,
  type AboutUsLanguage,
  type CoreValueItem,
  type HighlightItem,
} from '../../services/aboutUs.service';
import AboutUsContentView from '../../components/about-us/AboutUsContentView';
import {
  FileText,
  Upload,
  Trash2,
  Eye,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Globe,
  X,
  Sparkles,
  Shield,
  Layers,
  Send,
  EyeOff,
  Languages,
  Plus,
} from 'lucide-react';

const emptySnapshot: AboutUsContentSnapshot = {
  title: '',
  subtitle: '',
  introduction: '',
  story: '',
  mission: '',
  vision: '',
  coreValues: [],
  highlights: [],
  ctaLabel: '',
  ctaUrl: '',
  heroAlt: '',
  storyAlt: '',
};

export default function AboutUsCMSPage() {
  const [data, setData] = useState<AdminAboutUsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  const [uploadingHero, setUploadingHero] = useState(false);
  const [uploadingStory, setUploadingStory] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Active language tab in Super Admin CMS
  const [activeTab, setActiveTab] = useState<AboutUsLanguage>('en');

  // Form states per language (preserves unsaved tab switching)
  const [forms, setForms] = useState<Record<AboutUsLanguage, AboutUsContentSnapshot>>({
    en: { ...emptySnapshot },
    ar: { ...emptySnapshot },
    ta: { ...emptySnapshot },
  });

  const heroInputRef = useRef<HTMLInputElement>(null);
  const storyInputRef = useRef<HTMLInputElement>(null);

  // Load data
  const loadData = async () => {
    try {
      setLoading(true);
      const res = await aboutUsService.getAdminAboutUs();
      setData(res);

      setForms({
        en: { ...res.draft },
        ar: res.translations?.ar?.draft ? { ...res.translations.ar.draft, ctaUrl: '' } : { ...emptySnapshot },
        ta: res.translations?.ta?.draft ? { ...res.translations.ta.draft, ctaUrl: '' } : { ...emptySnapshot },
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to load About Us CMS data.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // CTA URL Client-side validation helper
  const isCtaUrlValid = (url: string) => {
    if (!url) return true;
    const lower = url.trim().toLowerCase();
    if (
      lower.startsWith('javascript:') ||
      lower.startsWith('data:') ||
      lower.startsWith('file:') ||
      lower.startsWith('vbscript:')
    ) {
      return false;
    }
    return url.trim().startsWith('/') || lower.startsWith('https://');
  };

  const getErrorMessage = (err: any, fallback: string): string => {
    const data = err.response?.data;
    if (data) {
      if (Array.isArray(data.errors) && data.errors.length > 0) {
        const first = data.errors[0];
        const prefix = first.path ? `${first.path}: ` : '';
        return `${prefix}${first.message}`;
      }
      if (data.message) {
        return data.message;
      }
    }
    return err.message || fallback;
  };

  // Update current active tab form state
  const updateActiveForm = (updater: (prev: AboutUsContentSnapshot) => AboutUsContentSnapshot) => {
    setForms((prev) => ({
      ...prev,
      [activeTab]: updater(prev[activeTab]),
    }));
  };

  // Save Draft for current active tab
  const handleSaveDraft = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const currentDraft = forms[activeTab];

    if (activeTab === 'en' && currentDraft.ctaUrl && !isCtaUrlValid(currentDraft.ctaUrl)) {
      setFeedback({
        type: 'error',
        message: 'CTA URL must start with "/" for internal paths or "https://" for external URLs.',
      });
      return;
    }

    try {
      setSaving(true);
      setFeedback(null);
      const payload = toDraftUpdatePayload(currentDraft, activeTab);
      const updated = await aboutUsService.updateDraft(payload);
      setData(updated);

      setForms((prev) => ({
        ...prev,
        en: { ...updated.draft },
        ar: updated.translations?.ar?.draft ? { ...updated.translations.ar.draft } : prev.ar,
        ta: updated.translations?.ta?.draft ? { ...updated.translations.ta.draft } : prev.ta,
      }));

      const langName = activeTab === 'en' ? 'English' : activeTab === 'ar' ? 'Arabic' : 'Tamil';
      setFeedback({ type: 'success', message: `${langName} draft content saved successfully.` });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: getErrorMessage(err, 'Failed to save draft content.'),
      });
    } finally {
      setSaving(false);
    }
  };

  // Publish
  const handlePublish = async () => {
    if (
      !window.confirm(
        'Are you sure you want to publish the current drafts? All languages will be published atomically to live public /about-us.'
      )
    ) {
      return;
    }

    try {
      setPublishing(true);
      setFeedback(null);
      // Save current active tab first
      const payload = toDraftUpdatePayload(forms[activeTab], activeTab);
      await aboutUsService.updateDraft(payload);
      const updated = await aboutUsService.publish();
      setData(updated);

      setForms({
        en: { ...updated.draft },
        ar: updated.translations?.ar?.draft ? { ...updated.translations.ar.draft, ctaUrl: '' } : { ...emptySnapshot },
        ta: updated.translations?.ta?.draft ? { ...updated.translations.ta.draft, ctaUrl: '' } : { ...emptySnapshot },
      });

      setFeedback({
        type: 'success',
        message: 'About Us content published successfully across all languages! Live public page is updated.',
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: getErrorMessage(err, 'Failed to publish About Us content.'),
      });
    } finally {
      setPublishing(false);
    }
  };

  // Unpublish
  const handleUnpublish = async () => {
    if (
      !window.confirm(
        'Are you sure you want to unpublish? The public /about-us page will show as unpublished, but all draft and published data will be preserved.'
      )
    ) {
      return;
    }

    try {
      setUnpublishing(true);
      setFeedback(null);
      const updated = await aboutUsService.unpublish();
      setData(updated);
      setFeedback({
        type: 'success',
        message: 'About Us content unpublished. Public page is now inactive.',
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to unpublish content.',
      });
    } finally {
      setUnpublishing(false);
    }
  };

  // Hero Image Upload (Shared)
  const handleHeroFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setFeedback({ type: 'error', message: 'Hero image must be smaller than 5 MB.' });
      return;
    }

    try {
      setUploadingHero(true);
      setFeedback(null);
      const updated = await aboutUsService.uploadHeroImage(file, forms.en.heroAlt || undefined);
      setData(updated);
      setForms((prev) => ({
        ...prev,
        en: {
          ...prev.en,
          heroImageUrl: updated.draft.heroImageUrl,
          heroFileId: updated.draft.heroFileId,
        },
      }));
      setFeedback({ type: 'success', message: 'Hero image uploaded to draft successfully.' });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to upload hero image.',
      });
    } finally {
      setUploadingHero(false);
      if (heroInputRef.current) heroInputRef.current.value = '';
    }
  };

  // Remove Hero Image (Shared)
  const handleRemoveHeroImage = async () => {
    try {
      setUploadingHero(true);
      setFeedback(null);
      const updated = await aboutUsService.removeHeroImage();
      setData(updated);
      setForms((prev) => ({
        ...prev,
        en: {
          ...prev.en,
          heroImageUrl: null,
          heroFileId: null,
        },
      }));
      setFeedback({ type: 'success', message: 'Draft hero image removed.' });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to remove hero image.',
      });
    } finally {
      setUploadingHero(false);
    }
  };

  // Story Image Upload (Shared)
  const handleStoryFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setFeedback({ type: 'error', message: 'Story image must be smaller than 5 MB.' });
      return;
    }

    try {
      setUploadingStory(true);
      setFeedback(null);
      const updated = await aboutUsService.uploadStoryImage(file, forms.en.storyAlt || undefined);
      setData(updated);
      setForms((prev) => ({
        ...prev,
        en: {
          ...prev.en,
          storyImageUrl: updated.draft.storyImageUrl,
          storyFileId: updated.draft.storyFileId,
        },
      }));
      setFeedback({ type: 'success', message: 'Story image uploaded to draft successfully.' });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to upload story image.',
      });
    } finally {
      setUploadingStory(false);
      if (storyInputRef.current) storyInputRef.current.value = '';
    }
  };

  // Remove Story Image (Shared)
  const handleRemoveStoryImage = async () => {
    try {
      setUploadingStory(true);
      setFeedback(null);
      const updated = await aboutUsService.removeStoryImage();
      setData(updated);
      setForms((prev) => ({
        ...prev,
        en: {
          ...prev.en,
          storyImageUrl: null,
          storyFileId: null,
        },
      }));
      setFeedback({ type: 'success', message: 'Draft story image removed.' });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to remove story image.',
      });
    } finally {
      setUploadingStory(false);
    }
  };

  // Core Value Handlers (English tab adds/removes canonical items; AR/TA tabs localize text for canonical IDs)
  const handleAddCoreValue = () => {
    if (forms.en.coreValues.length >= 12) {
      setFeedback({ type: 'error', message: 'Maximum 12 core values allowed.' });
      return;
    }
    const newId = `cv_${Date.now()}`;
    updateActiveForm((prev) => ({
      ...prev,
      coreValues: [
        ...prev.coreValues,
        { id: newId, title: '', description: '', icon: 'Shield' },
      ],
    }));
  };

  const handleUpdateCoreValue = (index: number, field: keyof CoreValueItem, value: string) => {
    updateActiveForm((prev) => {
      const updated = [...prev.coreValues];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, coreValues: updated };
    });
  };

  const handleRemoveCoreValue = (index: number) => {
    updateActiveForm((prev) => {
      const updated = prev.coreValues.filter((_, i) => i !== index);
      return { ...prev, coreValues: updated };
    });
  };

  // Localized Core Value Handler for AR / TA tabs
  const handleUpdateLocalizedCoreValue = (canonicalId: string, field: 'title' | 'description', value: string) => {
    updateActiveForm((prev) => {
      const existing = [...prev.coreValues];
      const idx = existing.findIndex((v) => v.id === canonicalId);
      if (idx >= 0) {
        existing[idx] = { ...existing[idx], [field]: value };
      } else {
        existing.push({ id: canonicalId, title: field === 'title' ? value : '', description: field === 'description' ? value : '' });
      }
      return { ...prev, coreValues: existing };
    });
  };

  // Highlights Handlers
  const handleAddHighlight = () => {
    if (forms.en.highlights.length >= 12) {
      setFeedback({ type: 'error', message: 'Maximum 12 highlights allowed.' });
      return;
    }
    const newId = `hl_${Date.now()}`;
    updateActiveForm((prev) => ({
      ...prev,
      highlights: [
        ...prev.highlights,
        { id: newId, metric: '', title: '', description: '' },
      ],
    }));
  };

  const handleUpdateHighlight = (index: number, field: keyof HighlightItem, value: string) => {
    updateActiveForm((prev) => {
      const updated = [...prev.highlights];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, highlights: updated };
    });
  };

  const handleRemoveHighlight = (index: number) => {
    updateActiveForm((prev) => {
      const updated = prev.highlights.filter((_, i) => i !== index);
      return { ...prev, highlights: updated };
    });
  };

  // Localized Highlight Handler for AR / TA tabs
  const handleUpdateLocalizedHighlight = (canonicalId: string, field: 'title' | 'description', value: string) => {
    updateActiveForm((prev) => {
      const existing = [...prev.highlights];
      const idx = existing.findIndex((h) => h.id === canonicalId);
      if (idx >= 0) {
        existing[idx] = { ...existing[idx], [field]: value };
      } else {
        existing.push({ id: canonicalId, title: field === 'title' ? value : '', metric: '', description: field === 'description' ? value : '' });
      }
      return { ...prev, highlights: existing };
    });
  };

  if (loading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#37C6A3] mb-3" />
        <p className="text-xs font-semibold text-[#7C8A9A]">Loading About Us CMS...</p>
      </div>
    );
  }

  // Build live preview snapshot combining active tab's localized draft with EN draft fallbacks
  const getPreviewSnapshot = (): AboutUsContentSnapshot => {
    const currentForm = forms[activeTab];
    const enForm = forms.en;

    if (activeTab === 'en') {
      return {
        ...enForm,
      };
    }

    // AR or TA preview
    const resolvedCoreValues = enForm.coreValues.map((enCv) => {
      const locCv = currentForm.coreValues.find((c) => c.id === enCv.id);
      return {
        id: enCv.id,
        title: locCv?.title?.trim() || enCv.title,
        description: locCv?.description?.trim() || enCv.description,
        icon: enCv.icon,
      };
    });

    const resolvedHighlights = enForm.highlights.map((enHl) => {
      const locHl = currentForm.highlights.find((h) => h.id === enHl.id);
      return {
        id: enHl.id,
        title: locHl?.title?.trim() || enHl.title,
        metric: enHl.metric,
        description: locHl?.description?.trim() || enHl.description,
      };
    });

    return {
      title: currentForm.title?.trim() || enForm.title,
      subtitle: currentForm.subtitle?.trim() || enForm.subtitle,
      introduction: currentForm.introduction?.trim() || enForm.introduction,
      story: currentForm.story?.trim() || enForm.story,
      mission: currentForm.mission?.trim() || enForm.mission,
      vision: currentForm.vision?.trim() || enForm.vision,
      coreValues: resolvedCoreValues,
      highlights: resolvedHighlights,
      ctaLabel: currentForm.ctaLabel?.trim() || enForm.ctaLabel,
      ctaUrl: enForm.ctaUrl,
      heroFileId: enForm.heroFileId,
      heroImageUrl: enForm.heroImageUrl,
      heroAlt: currentForm.heroAlt?.trim() || enForm.heroAlt,
      storyFileId: enForm.storyFileId,
      storyImageUrl: enForm.storyImageUrl,
      storyAlt: currentForm.storyAlt?.trim() || enForm.storyAlt,
    };
  };

  const statusBadge = () => {
    switch (data?.status) {
      case 'PUBLISHED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#37C6A3]/10 text-[#2EB392] border border-[#37C6A3]/20">
            <span className="w-2 h-2 rounded-full bg-[#37C6A3]"></span>
            Published (Live)
          </span>
        );
      case 'UNPUBLISHED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
            <span className="w-2 h-2 rounded-full bg-slate-400"></span>
            Unpublished
          </span>
        );
      case 'DRAFT':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            Draft (Not Live)
          </span>
        );
    }
  };

  const currentForm = forms[activeTab];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 text-[#0F172A]">
      {/* Top Header & Publication Action Bar */}
      <div className="bg-white border border-[#E7E9EE] rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold tracking-tight text-[#0F172A]">
              About Us Management
            </h1>
            {statusBadge()}
          </div>
          <p className="text-xs text-[#7C8A9A]">
            Manage the global platform About Us story, visuals, and multilingual content (EN, AR, TA).
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setShowPreviewModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#E7E9EE] bg-white hover:bg-[#F7F6F1] text-xs font-bold text-[#0F172A] transition cursor-pointer"
          >
            <Eye className="w-4 h-4 text-[#37C6A3]" />
            <span>Preview {activeTab.toUpperCase()}</span>
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={() => handleSaveDraft()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs font-bold transition disabled:opacity-50 cursor-pointer"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-[#37C6A3]" />
            )}
            <span>Save {activeTab.toUpperCase()} Draft</span>
          </button>

          {data?.status === 'PUBLISHED' && (
            <button
              type="button"
              disabled={unpublishing}
              onClick={handleUnpublish}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition disabled:opacity-50 cursor-pointer"
            >
              {unpublishing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <EyeOff className="w-4 h-4" />
              )}
              <span>Unpublish</span>
            </button>
          )}

          <button
            type="button"
            disabled={publishing}
            onClick={handlePublish}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#37C6A3] hover:bg-[#2EB392] text-[#0F172A] text-xs font-bold transition shadow-sm disabled:opacity-50 cursor-pointer"
          >
            {publishing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span>Publish All Live</span>
          </button>
        </div>
      </div>

      {/* Language Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-[#E7E9EE] pb-2">
        <div className="flex items-center gap-2" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'en'}
            onClick={() => setActiveTab('en')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'en'
                ? 'bg-[#0F172A] text-white shadow-xs'
                : 'bg-white border border-[#E7E9EE] text-[#7C8A9A] hover:text-[#0F172A]'
            }`}
          >
            <Languages className="w-4 h-4 text-[#37C6A3]" />
            <span>English</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'ar'}
            onClick={() => setActiveTab('ar')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'ar'
                ? 'bg-[#0F172A] text-white shadow-xs'
                : 'bg-white border border-[#E7E9EE] text-[#7C8A9A] hover:text-[#0F172A]'
            }`}
          >
            <Languages className="w-4 h-4 text-[#37C6A3]" />
            <span>العربية</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'ta'}
            onClick={() => setActiveTab('ta')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'ta'
                ? 'bg-[#0F172A] text-white shadow-xs'
                : 'bg-white border border-[#E7E9EE] text-[#7C8A9A] hover:text-[#0F172A]'
            }`}
          >
            <Languages className="w-4 h-4 text-[#37C6A3]" />
            <span>தமிழ்</span>
          </button>
        </div>

        <span className="text-xs text-[#7C8A9A] font-semibold hidden sm:inline-block">
          Editing: <strong className="text-[#0F172A]">{activeTab === 'en' ? 'English (Canonical)' : activeTab === 'ar' ? 'Arabic Draft' : 'Tamil Draft'}</strong>
        </span>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs font-semibold ${
            feedback.type === 'success'
              ? 'bg-[#37C6A3]/10 border-[#37C6A3]/30 text-[#0F172A]'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-[#37C6A3]" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main CMS Form Sections */}
      <form onSubmit={handleSaveDraft} className="space-y-8">
        {/* Section 1: Hero Visuals & Messaging */}
        <div className="bg-white border border-[#E7E9EE] rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm">
          <div className="border-b border-[#E7E9EE] pb-4">
            <h2 className="text-base font-bold text-[#0F172A] flex items-center gap-2">
              <Globe className="w-4 h-4 text-[#37C6A3]" />
              <span>Hero Visual & Main Headlines ({activeTab.toUpperCase()})</span>
            </h2>
            <p className="text-xs text-[#7C8A9A] mt-0.5">
              Primary visual banner and high-level messaging shown at the top of the About Us page.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                  Page Title (Hero Headline)
                </label>
                <input
                  type="text"
                  maxLength={255}
                  dir={activeTab === 'ar' ? 'rtl' : 'ltr'}
                  value={currentForm.title}
                  onChange={(e) => updateActiveForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder={activeTab === 'en' ? 'e.g. Empowering Islamic Institutions' : activeTab === 'ar' ? 'العنوان بالعربية...' : 'தலைப்பு தமிழில்...'}
                  className="w-full px-4 py-2.5 rounded-xl border border-[#E7E9EE] bg-[#F7F6F1] text-xs text-[#0F172A] focus:outline-none focus:border-[#37C6A3] transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                  Subtitle
                </label>
                <textarea
                  rows={3}
                  maxLength={1000}
                  dir={activeTab === 'ar' ? 'rtl' : 'ltr'}
                  value={currentForm.subtitle}
                  onChange={(e) => updateActiveForm((prev) => ({ ...prev, subtitle: e.target.value }))}
                  placeholder="Supporting subtitle providing brief context..."
                  className="w-full px-4 py-2.5 rounded-xl border border-[#E7E9EE] bg-[#F7F6F1] text-xs text-[#0F172A] focus:outline-none focus:border-[#37C6A3] transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                    CTA Button Label
                  </label>
                  <input
                    type="text"
                    maxLength={100}
                    dir={activeTab === 'ar' ? 'rtl' : 'ltr'}
                    value={currentForm.ctaLabel}
                    onChange={(e) => updateActiveForm((prev) => ({ ...prev, ctaLabel: e.target.value }))}
                    placeholder="e.g. Get Started Today"
                    className="w-full px-4 py-2.5 rounded-xl border border-[#E7E9EE] bg-[#F7F6F1] text-xs text-[#0F172A] focus:outline-none focus:border-[#37C6A3] transition"
                  />
                </div>
                {activeTab === 'en' ? (
                  <div>
                    <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                      CTA URL (Shared)
                    </label>
                    <input
                      type="text"
                      maxLength={500}
                      value={forms.en.ctaUrl}
                      onChange={(e) => updateActiveForm((prev) => ({ ...prev, ctaUrl: e.target.value }))}
                      placeholder="e.g. /register or https://..."
                      className="w-full px-4 py-2.5 rounded-xl border border-[#E7E9EE] bg-[#F7F6F1] text-xs text-[#0F172A] focus:outline-none focus:border-[#37C6A3] transition"
                    />
                  </div>
                ) : (
                  <div className="text-xs text-[#7C8A9A] self-end pb-3 font-medium">
                    <span>CTA URL is shared from English canonical form ({forms.en.ctaUrl || 'None'})</span>
                  </div>
                )}
              </div>
            </div>

            {/* Hero Image Box (Shared across tabs) */}
            <div className="space-y-4">
              <label className="block text-xs font-bold text-[#0F172A]">
                Hero Image (Shared Global Media)
              </label>

              <div className="border border-[#E7E9EE] rounded-xl p-4 bg-[#F7F6F1] flex flex-col items-center justify-center min-h-[180px] relative overflow-hidden">
                {forms.en.heroImageUrl ? (
                  <div className="w-full space-y-3">
                    <img
                      src={forms.en.heroImageUrl}
                      alt={currentForm.heroAlt || forms.en.heroAlt || 'Hero Draft'}
                      className="w-full h-40 object-cover rounded-lg border border-[#E7E9EE]"
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-[#37C6A3]">
                        ✓ Shared Hero Image Ready
                      </span>
                      {activeTab === 'en' && (
                        <button
                          type="button"
                          onClick={handleRemoveHeroImage}
                          disabled={uploadingHero}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 hover:text-rose-700 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center space-y-2">
                    <Upload className="w-8 h-8 text-[#7C8A9A] mx-auto opacity-50" />
                    <p className="text-xs font-semibold text-[#0F172A]">
                      No draft hero image uploaded
                    </p>
                    <p className="text-[11px] text-[#7C8A9A]">
                      Supports JPG, PNG, WebP up to 5 MB
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                {activeTab === 'en' && (
                  <>
                    <input
                      type="file"
                      ref={heroInputRef}
                      onChange={handleHeroFileChange}
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => heroInputRef.current?.click()}
                      disabled={uploadingHero}
                      className="px-4 py-2 rounded-xl bg-white border border-[#E7E9EE] hover:bg-[#F7F6F1] text-xs font-bold text-[#0F172A] transition inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {uploadingHero ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Upload className="w-3.5 h-3.5 text-[#37C6A3]" />
                      )}
                      <span>{forms.en.heroImageUrl ? 'Replace Hero Image' : 'Upload Hero Image'}</span>
                    </button>
                  </>
                )}

                <input
                  type="text"
                  placeholder={`Hero image alt description (${activeTab.toUpperCase()})...`}
                  dir={activeTab === 'ar' ? 'rtl' : 'ltr'}
                  value={currentForm.heroAlt || ''}
                  onChange={(e) => updateActiveForm((prev) => ({ ...prev, heroAlt: e.target.value }))}
                  className="flex-1 px-3 py-2 rounded-xl border border-[#E7E9EE] bg-[#F7F6F1] text-xs text-[#0F172A] focus:outline-none focus:border-[#37C6A3]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Narrative Story & Story Visual */}
        <div className="bg-white border border-[#E7E9EE] rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm">
          <div className="border-b border-[#E7E9EE] pb-4">
            <h2 className="text-base font-bold text-[#0F172A] flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#37C6A3]" />
              <span>Introduction & Our Story ({activeTab.toUpperCase()})</span>
            </h2>
            <p className="text-xs text-[#7C8A9A] mt-0.5">
              Comprehensive narrative outlining the origin, ethos, and journey of MadrasaNexa.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                  Introduction Lead Paragraph
                </label>
                <textarea
                  rows={3}
                  maxLength={2000}
                  dir={activeTab === 'ar' ? 'rtl' : 'ltr'}
                  value={currentForm.introduction}
                  onChange={(e) => updateActiveForm((prev) => ({ ...prev, introduction: e.target.value }))}
                  placeholder="High-level introductory synopsis..."
                  className="w-full px-4 py-2.5 rounded-xl border border-[#E7E9EE] bg-[#F7F6F1] text-xs text-[#0F172A] focus:outline-none focus:border-[#37C6A3] transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                  Detailed Story Narrative
                </label>
                <textarea
                  rows={7}
                  maxLength={5000}
                  dir={activeTab === 'ar' ? 'rtl' : 'ltr'}
                  value={currentForm.story}
                  onChange={(e) => updateActiveForm((prev) => ({ ...prev, story: e.target.value }))}
                  placeholder="In-depth background on why MadrasaNexa was created..."
                  className="w-full px-4 py-2.5 rounded-xl border border-[#E7E9EE] bg-[#F7F6F1] text-xs text-[#0F172A] focus:outline-none focus:border-[#37C6A3] transition"
                />
              </div>
            </div>

            {/* Story Image Box (Shared across tabs) */}
            <div className="space-y-4">
              <label className="block text-xs font-bold text-[#0F172A]">
                Story Image (Shared Global Media)
              </label>

              <div className="border border-[#E7E9EE] rounded-xl p-4 bg-[#F7F6F1] flex flex-col items-center justify-center min-h-[180px] relative overflow-hidden">
                {forms.en.storyImageUrl ? (
                  <div className="w-full space-y-3">
                    <img
                      src={forms.en.storyImageUrl}
                      alt={currentForm.storyAlt || forms.en.storyAlt || 'Story Draft'}
                      className="w-full h-40 object-cover rounded-lg border border-[#E7E9EE]"
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-[#37C6A3]">
                        ✓ Shared Story Image Ready
                      </span>
                      {activeTab === 'en' && (
                        <button
                          type="button"
                          onClick={handleRemoveStoryImage}
                          disabled={uploadingStory}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 hover:text-rose-700 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center space-y-2">
                    <Upload className="w-8 h-8 text-[#7C8A9A] mx-auto opacity-50" />
                    <p className="text-xs font-semibold text-[#0F172A]">
                      No draft story image uploaded
                    </p>
                    <p className="text-[11px] text-[#7C8A9A]">
                      Supports JPG, PNG, WebP up to 5 MB
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                {activeTab === 'en' && (
                  <>
                    <input
                      type="file"
                      ref={storyInputRef}
                      onChange={handleStoryFileChange}
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => storyInputRef.current?.click()}
                      disabled={uploadingStory}
                      className="px-4 py-2 rounded-xl bg-white border border-[#E7E9EE] hover:bg-[#F7F6F1] text-xs font-bold text-[#0F172A] transition inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {uploadingStory ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Upload className="w-3.5 h-3.5 text-[#37C6A3]" />
                      )}
                      <span>{forms.en.storyImageUrl ? 'Replace Story Image' : 'Upload Story Image'}</span>
                    </button>
                  </>
                )}

                <input
                  type="text"
                  placeholder={`Story image alt description (${activeTab.toUpperCase()})...`}
                  dir={activeTab === 'ar' ? 'rtl' : 'ltr'}
                  value={currentForm.storyAlt || ''}
                  onChange={(e) => updateActiveForm((prev) => ({ ...prev, storyAlt: e.target.value }))}
                  className="flex-1 px-3 py-2 rounded-xl border border-[#E7E9EE] bg-[#F7F6F1] text-xs text-[#0F172A] focus:outline-none focus:border-[#37C6A3]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Mission & Vision */}
        <div className="bg-white border border-[#E7E9EE] rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm">
          <div className="border-b border-[#E7E9EE] pb-4">
            <h2 className="text-base font-bold text-[#0F172A] flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#37C6A3]" />
              <span>Mission & Vision ({activeTab.toUpperCase()})</span>
            </h2>
            <p className="text-xs text-[#7C8A9A] mt-0.5">
              Strategic direction and institutional commitments.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                Our Mission
              </label>
              <textarea
                rows={4}
                maxLength={2000}
                dir={activeTab === 'ar' ? 'rtl' : 'ltr'}
                value={currentForm.mission}
                onChange={(e) => updateActiveForm((prev) => ({ ...prev, mission: e.target.value }))}
                placeholder="Our mission is to..."
                className="w-full px-4 py-2.5 rounded-xl border border-[#E7E9EE] bg-[#F7F6F1] text-xs text-[#0F172A] focus:outline-none focus:border-[#37C6A3] transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                Our Vision
              </label>
              <textarea
                rows={4}
                maxLength={2000}
                dir={activeTab === 'ar' ? 'rtl' : 'ltr'}
                value={currentForm.vision}
                onChange={(e) => updateActiveForm((prev) => ({ ...prev, vision: e.target.value }))}
                placeholder="Our vision is to become..."
                className="w-full px-4 py-2.5 rounded-xl border border-[#E7E9EE] bg-[#F7F6F1] text-xs text-[#0F172A] focus:outline-none focus:border-[#37C6A3] transition"
              />
            </div>
          </div>
        </div>

        {/* Section 4: Highlights / Quantitative Metrics */}
        <div className="bg-white border border-[#E7E9EE] rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm">
          <div className="border-b border-[#E7E9EE] pb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#0F172A] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#37C6A3]" />
                <span>Highlights & Achievements ({activeTab.toUpperCase()})</span>
              </h2>
              <p className="text-xs text-[#7C8A9A] mt-0.5">
                {activeTab === 'en'
                  ? 'Canonical metrics illustrating platform scale and adoption.'
                  : 'Localize highlight titles and descriptions. Metric value remains canonical from English.'}
              </p>
            </div>

            {activeTab === 'en' && (
              <button
                type="button"
                onClick={handleAddHighlight}
                disabled={forms.en.highlights.length >= 12}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E7E9EE] bg-[#F7F6F1] hover:bg-white text-xs font-bold text-[#0F172A] transition disabled:opacity-40 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-[#37C6A3]" />
                <span>Add Metric ({forms.en.highlights.length}/12)</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeTab === 'en'
              ? forms.en.highlights.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className="p-4 rounded-xl border border-[#E7E9EE] bg-[#F7F6F1] space-y-3 relative group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-[#7C8A9A]">#{idx + 1}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveHighlight(idx)}
                        className="text-slate-400 hover:text-rose-600 p-1 transition cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="Metric (e.g. 50+, 99.9%)"
                        value={item.metric}
                        maxLength={50}
                        onChange={(e) => handleUpdateHighlight(idx, 'metric', e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-[#E7E9EE] bg-white text-xs font-bold text-[#0F172A] focus:outline-none focus:border-[#37C6A3]"
                      />
                      <input
                        type="text"
                        placeholder="Title (e.g. Active Madrasas)"
                        value={item.title}
                        maxLength={100}
                        onChange={(e) => handleUpdateHighlight(idx, 'title', e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-[#E7E9EE] bg-white text-xs text-[#0F172A] focus:outline-none focus:border-[#37C6A3]"
                      />
                      <input
                        type="text"
                        placeholder="Brief description..."
                        value={item.description || ''}
                        maxLength={500}
                        onChange={(e) => handleUpdateHighlight(idx, 'description', e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-[#E7E9EE] bg-white text-xs text-[#7C8A9A] focus:outline-none focus:border-[#37C6A3]"
                      />
                    </div>
                  </div>
                ))
              : forms.en.highlights.map((enItem, idx) => {
                  const locItem = currentForm.highlights.find((h) => h.id === enItem.id);
                  return (
                    <div
                      key={enItem.id || idx}
                      className="p-4 rounded-xl border border-[#E7E9EE] bg-[#F7F6F1] space-y-3 relative"
                    >
                      <div className="flex items-center justify-between border-b border-[#E7E9EE] pb-2">
                        <span className="text-[11px] font-bold text-[#0F172A]">
                          Canonical Metric: <span className="font-mono text-[#37C6A3]">{enItem.metric || 'N/A'}</span>
                        </span>
                        <span className="text-[10px] text-[#7C8A9A]">ID: {enItem.id?.substring(0, 8)}</span>
                      </div>

                      <div className="space-y-2">
                        <label className="block text-[11px] font-semibold text-[#7C8A9A]">
                          Localized Title ({activeTab.toUpperCase()}):
                        </label>
                        <input
                          type="text"
                          maxLength={100}
                          dir={activeTab === 'ar' ? 'rtl' : 'ltr'}
                          placeholder={`EN Fallback: ${enItem.title}`}
                          value={locItem?.title || ''}
                          onChange={(e) => handleUpdateLocalizedHighlight(enItem.id!, 'title', e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg border border-[#E7E9EE] bg-white text-xs font-bold text-[#0F172A] focus:outline-none focus:border-[#37C6A3]"
                        />

                        <label className="block text-[11px] font-semibold text-[#7C8A9A]">
                          Localized Description ({activeTab.toUpperCase()}):
                        </label>
                        <input
                          type="text"
                          maxLength={500}
                          dir={activeTab === 'ar' ? 'rtl' : 'ltr'}
                          placeholder={enItem.description ? `EN Fallback: ${enItem.description}` : 'Description...'}
                          value={locItem?.description || ''}
                          onChange={(e) => handleUpdateLocalizedHighlight(enItem.id!, 'description', e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg border border-[#E7E9EE] bg-white text-xs text-[#7C8A9A] focus:outline-none focus:border-[#37C6A3]"
                        />
                      </div>
                    </div>
                  );
                })}
          </div>
        </div>

        {/* Section 5: Core Values */}
        <div className="bg-white border border-[#E7E9EE] rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm">
          <div className="border-b border-[#E7E9EE] pb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#0F172A] flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#37C6A3]" />
                <span>Foundational Core Values ({activeTab.toUpperCase()})</span>
              </h2>
              <p className="text-xs text-[#7C8A9A] mt-0.5">
                {activeTab === 'en'
                  ? 'Canonical ethical and administrative principles.'
                  : 'Localize core value titles and descriptions. Icons remain canonical from English.'}
              </p>
            </div>

            {activeTab === 'en' && (
              <button
                type="button"
                onClick={handleAddCoreValue}
                disabled={forms.en.coreValues.length >= 12}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E7E9EE] bg-[#F7F6F1] hover:bg-white text-xs font-bold text-[#0F172A] transition disabled:opacity-40 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-[#37C6A3]" />
                <span>Add Value ({forms.en.coreValues.length}/12)</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeTab === 'en'
              ? forms.en.coreValues.map((val, idx) => (
                  <div
                    key={val.id || idx}
                    className="p-4 rounded-xl border border-[#E7E9EE] bg-[#F7F6F1] space-y-3 relative group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-[#7C8A9A]">#{idx + 1}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveCoreValue(idx)}
                        className="text-slate-400 hover:text-rose-600 p-1 transition cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="space-y-2">
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="text"
                          placeholder="Title"
                          value={val.title}
                          maxLength={100}
                          onChange={(e) => handleUpdateCoreValue(idx, 'title', e.target.value)}
                          className="col-span-2 px-3 py-1.5 rounded-lg border border-[#E7E9EE] bg-white text-xs font-bold text-[#0F172A] focus:outline-none focus:border-[#37C6A3]"
                        />
                        <select
                          value={val.icon || 'Shield'}
                          onChange={(e) => handleUpdateCoreValue(idx, 'icon', e.target.value)}
                          className="px-2 py-1.5 rounded-lg border border-[#E7E9EE] bg-white text-xs text-[#0F172A] focus:outline-none focus:border-[#37C6A3]"
                        >
                          <option value="Shield">Shield</option>
                          <option value="Award">Award</option>
                          <option value="Book">Book</option>
                          <option value="Compass">Compass</option>
                          <option value="Target">Target</option>
                          <option value="Users">Users</option>
                          <option value="Sparkles">Sparkles</option>
                        </select>
                      </div>

                      <textarea
                        rows={2}
                        placeholder="Description..."
                        value={val.description}
                        maxLength={500}
                        onChange={(e) => handleUpdateCoreValue(idx, 'description', e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-[#E7E9EE] bg-white text-xs text-[#7C8A9A] focus:outline-none focus:border-[#37C6A3]"
                      />
                    </div>
                  </div>
                ))
              : forms.en.coreValues.map((enVal, idx) => {
                  const locVal = currentForm.coreValues.find((c) => c.id === enVal.id);
                  return (
                    <div
                      key={enVal.id || idx}
                      className="p-4 rounded-xl border border-[#E7E9EE] bg-[#F7F6F1] space-y-3 relative"
                    >
                      <div className="flex items-center justify-between border-b border-[#E7E9EE] pb-2">
                        <span className="text-[11px] font-bold text-[#0F172A]">
                          Canonical Icon: <span className="font-mono text-[#37C6A3]">{enVal.icon || 'Default'}</span>
                        </span>
                        <span className="text-[10px] text-[#7C8A9A]">ID: {enVal.id?.substring(0, 8)}</span>
                      </div>

                      <div className="space-y-2">
                        <label className="block text-[11px] font-semibold text-[#7C8A9A]">
                          Localized Title ({activeTab.toUpperCase()}):
                        </label>
                        <input
                          type="text"
                          maxLength={100}
                          dir={activeTab === 'ar' ? 'rtl' : 'ltr'}
                          placeholder={`EN Fallback: ${enVal.title}`}
                          value={locVal?.title || ''}
                          onChange={(e) => handleUpdateLocalizedCoreValue(enVal.id!, 'title', e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg border border-[#E7E9EE] bg-white text-xs font-bold text-[#0F172A] focus:outline-none focus:border-[#37C6A3]"
                        />

                        <label className="block text-[11px] font-semibold text-[#7C8A9A]">
                          Localized Description ({activeTab.toUpperCase()}):
                        </label>
                        <textarea
                          rows={2}
                          maxLength={500}
                          dir={activeTab === 'ar' ? 'rtl' : 'ltr'}
                          placeholder={enVal.description ? `EN Fallback: ${enVal.description}` : 'Description...'}
                          value={locVal?.description || ''}
                          onChange={(e) => handleUpdateLocalizedCoreValue(enVal.id!, 'description', e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg border border-[#E7E9EE] bg-white text-xs text-[#7C8A9A] focus:outline-none focus:border-[#37C6A3]"
                        />
                      </div>
                    </div>
                  );
                })}
          </div>
        </div>

        {/* Bottom Save Action */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-[#37C6A3]" />
            )}
            <span>Save {activeTab.toUpperCase()} Draft Changes</span>
          </button>
        </div>
      </form>

      {/* Live Preview Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-6xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-[#E7E9EE] relative">
            <div className="sticky top-0 bg-white border-b border-[#E7E9EE] px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#37C6A3]" />
                <h3 className="text-sm font-bold text-[#0F172A]">
                  Draft Live Preview — {activeTab.toUpperCase()}
                </h3>
                <span className="text-xs text-[#7C8A9A]">(Draft Snapshot with Field Fallbacks)</span>
              </div>
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="p-1.5 rounded-lg hover:bg-[#F7F6F1] text-slate-500 hover:text-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-0">
              <AboutUsContentView
                content={getPreviewSnapshot()}
                isPreview={true}
                language={activeTab}
                direction={activeTab === 'ar' ? 'rtl' : 'ltr'}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
