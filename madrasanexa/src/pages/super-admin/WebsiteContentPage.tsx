import { useState, useEffect, useRef } from 'react';
import {
  apiGetAdminHomepageDraft,
  apiUpdateHomepageDraft,
  apiPublishHomepage,
  apiUnpublishHomepage,
  apiUploadHomepageImages,
  normalizeWhatsAppNumber,
  type HomepageContentSnapshot,
  type FeatureItem,
  type HowItWorksItem,
  type HeroMediaItem,
} from '../../services/homepage.service';
import { HomepageImageUploader } from '../../components/super-admin/HomepageImageUploader';
import {
  Globe,
  Save,
  Send,
  Eye,
  ArchiveX,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Plus,
  Trash2,
  MoveUp,
  MoveDown,
  Sparkles,
  Layers,
  ListOrdered,
  Shield,
  MessageSquare,
  Search,
  Image as ImageIcon,
  Upload,
  ExternalLink,
  MessageCircle,
} from 'lucide-react';

const APPROVED_ICONS = [
  'GraduationCap',
  'Users',
  'Calendar',
  'DollarSign',
  'FileText',
  'BarChart3',
  'Megaphone',
  'Cloud',
  'ShieldCheck',
  'Layers',
  'Clock',
  'Sparkles',
  'BookOpen',
  'Award',
  'CheckCircle2',
  'Building2',
  'Landmark',
  'Lock',
  'Compass',
  'Globe',
  'HelpCircle',
  'Laptop',
  'Shield',
];

type TabKey = 'hero' | 'heroMedia' | 'features' | 'howItWorks' | 'trustSecurity' | 'cta' | 'contactFooter' | 'seo';

export default function WebsiteContentPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<'DRAFT' | 'PUBLISHED' | 'UNPUBLISHED'>('DRAFT');
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [draft, setDraft] = useState<HomepageContentSnapshot | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('hero');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    loadDraft();
  }, []);

  async function loadDraft() {
    try {
      setLoading(true);
      const res = await apiGetAdminHomepageDraft();
      setStatus(res.status);
      setPublishedAt(res.publishedAt || null);
      const rawDraft = res.draftContent || {};
      setDraft({
        ...rawDraft,
        heroMedia: rawDraft.heroMedia || {
          enabled: true,
          autoplay: true,
          autoplayInterval: 5000,
          items: [],
        },
        productPreviewMedia: rawDraft.productPreviewMedia || {
          enabled: true,
          fileId: null,
          url: null,
          alt: '',
          caption: null,
        },
        whatsapp: rawDraft.whatsapp || {
          enabled: true,
          number: '+94 78 325 4552',
          defaultMessage: 'Assalamu Alaikum, I would like to know more about MadrasaNexa.',
        },
      });
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.response?.data?.message || 'Failed to load website content draft.',
      });
    } finally {
      setLoading(false);
    }
  }

  function validateHeroMediaAltText(): { valid: boolean; firstInvalidItem?: HeroMediaItem; index?: number } {
    if (!draft?.heroMedia?.items?.length) return { valid: true };
    const items = draft.heroMedia.items;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.enabled) {
        const trimmed = (it.alt || '').trim();
        if (trimmed.length < 3 || trimmed.length > 200) {
          return { valid: false, firstInvalidItem: it, index: i };
        }
      }
    }
    return { valid: true };
  }

  function validateProductPreviewAltText(): { valid: boolean; message?: string } {
    if (!draft?.productPreviewMedia) return { valid: true };
    const ppm = draft.productPreviewMedia;
    if (ppm.enabled && ppm.fileId) {
      const trimmed = (ppm.alt || '').trim();
      if (trimmed.length < 3) {
        return { valid: false, message: 'Product preview screenshot requires alt text (minimum 3 characters).' };
      }
      if (trimmed.length > 200) {
        return { valid: false, message: 'Product preview alt text cannot exceed 200 characters.' };
      }
    }
    return { valid: true };
  }

  function validateFeaturesAltText(): { valid: boolean; featureTitle?: string; message?: string } {
    if (!draft?.features?.length) return { valid: true };
    for (const feat of draft.features) {
      if (feat.enabled && feat.imageFileId) {
        const trimmed = (feat.imageAlt || '').trim();
        if (trimmed.length < 3) {
          return {
            valid: false,
            featureTitle: feat.title,
            message: `Feature "${feat.title || 'Untitled'}" screenshot requires alt text (minimum 3 characters).`,
          };
        }
        if (trimmed.length > 200) {
          return {
            valid: false,
            featureTitle: feat.title,
            message: `Feature "${feat.title || 'Untitled'}" alt text cannot exceed 200 characters.`,
          };
        }
      }
    }
    return { valid: true };
  }

  function handleApiError(err: any, fallbackMessage: string) {
    const rawMsg = err.response?.data?.message || err.message || '';
    const errors = err.response?.data?.errors;

    // Check for heroMedia item alt errors (e.g. heroMedia.items.2.alt)
    let errorIdx: number | null = null;
    const match = /heroMedia\.items\.(\d+)\.alt/.exec(rawMsg);
    if (match) {
      errorIdx = Number(match[1]);
    } else if (Array.isArray(errors)) {
      const altIssue = errors.find((e: any) => e.path?.includes('heroMedia') && e.path?.includes('alt'));
      if (altIssue && typeof altIssue.path?.[2] === 'number') {
        errorIdx = altIssue.path[2];
      }
    }

    if (errorIdx !== null && draft?.heroMedia?.items?.[errorIdx]) {
      const item = draft.heroMedia.items[errorIdx];
      setActiveTab('heroMedia');
      setTimeout(() => {
        const el = document.getElementById(`alt-input-${item.id}`);
        if (el) {
          el.focus();
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
      setNotification({
        type: 'error',
        message: `Image #${errorIdx + 1} "${item.fileName || 'Hero Image'}" requires valid alt text (minimum 3 characters) before saving.`,
      });
      return;
    }

    setNotification({
      type: 'error',
      message: err.response?.data?.message || fallbackMessage,
    });
  }

  async function handleSaveDraft() {
    if (!draft) return;

    // Precheck alt text on all enabled hero images
    const altCheck = validateHeroMediaAltText();
    if (!altCheck.valid && altCheck.firstInvalidItem) {
      setNotification({
        type: 'error',
        message: 'Please add alt text (minimum 3 characters) to all enabled hero images before saving.',
      });
      setActiveTab('heroMedia');
      setTimeout(() => {
        const el = document.getElementById(`alt-input-${altCheck.firstInvalidItem!.id}`);
        if (el) {
          el.focus();
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
      return;
    }

    const previewAltCheck = validateProductPreviewAltText();
    if (!previewAltCheck.valid) {
      setNotification({
        type: 'error',
        message: previewAltCheck.message || 'Please provide valid alt text for the product preview screenshot.',
      });
      setActiveTab('hero');
      return;
    }

    const featAltCheck = validateFeaturesAltText();
    if (!featAltCheck.valid) {
      setNotification({
        type: 'error',
        message: featAltCheck.message || 'Please provide valid alt text for the feature screenshot.',
      });
      setActiveTab('features');
      return;
    }

    try {
      setSaving(true);
      setNotification(null);
      const res = await apiUpdateHomepageDraft(draft);
      setStatus(res.status as any);
      setNotification({ type: 'success', message: 'Draft saved successfully. (Not yet published)' });
    } catch (err: any) {
      handleApiError(err, 'Failed to save draft.');
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!draft) return;

    // Precheck alt text on all enabled hero images
    const altCheck = validateHeroMediaAltText();
    if (!altCheck.valid && altCheck.firstInvalidItem) {
      setNotification({
        type: 'error',
        message: 'Please add alt text (minimum 3 characters) to all enabled hero images before publishing.',
      });
      setActiveTab('heroMedia');
      setTimeout(() => {
        const el = document.getElementById(`alt-input-${altCheck.firstInvalidItem!.id}`);
        if (el) {
          el.focus();
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
      return;
    }

    const previewAltCheck = validateProductPreviewAltText();
    if (!previewAltCheck.valid) {
      setNotification({
        type: 'error',
        message: previewAltCheck.message || 'Please provide valid alt text for the product preview screenshot.',
      });
      setActiveTab('hero');
      return;
    }

    const featAltCheck = validateFeaturesAltText();
    if (!featAltCheck.valid) {
      setNotification({
        type: 'error',
        message: featAltCheck.message || 'Please provide valid alt text for the feature screenshot.',
      });
      setActiveTab('features');
      return;
    }

    // Validate WhatsApp number before publishing if enabled
    if (draft.whatsapp?.enabled && draft.whatsapp?.number) {
      const normalized = normalizeWhatsAppNumber(draft.whatsapp.number);
      if (!normalized || normalized.length < 7 || normalized.length > 15) {
        setNotification({
          type: 'error',
          message: 'Please provide a valid international WhatsApp number (e.g. +94 78 325 4552).',
        });
        setActiveTab('contactFooter');
        return;
      }
    }

    try {
      setPublishing(true);
      setNotification(null);
      // Save latest draft first
      await apiUpdateHomepageDraft(draft);
      const res = await apiPublishHomepage();
      setStatus(res.status as any);
      setPublishedAt(res.publishedAt);
      setNotification({
        type: 'success',
        message: 'Homepage content published! Public website now reflects the updated content.',
      });
    } catch (err: any) {
      handleApiError(err, 'Failed to publish homepage content.');
    } finally {
      setPublishing(false);
    }
  }

  function generateAltSuggestion(filename: string): string {
    if (!filename) return '';
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
    const cleaned = nameWithoutExt.replace(/[-_.]+/g, ' ').trim();
    const lower = cleaned.toLowerCase();
    if (
      cleaned.length < 3 ||
      lower === 'image' ||
      lower === 'photo' ||
      lower === 'slider' ||
      lower === 'slider image' ||
      lower === 'hero' ||
      lower === 'hero image' ||
      lower === 'untitled'
    ) {
      return '';
    }
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  // Media Slider helpers
  async function handleMediaUpload(files: FileList | File[]) {
    if (!draft) return;
    const fileArray = Array.from(files);
    if (!fileArray.length) return;

    const currentItems = draft.heroMedia?.items || [];
    if (currentItems.length + fileArray.length > 8) {
      setNotification({
        type: 'error',
        message: `Maximum 8 hero images allowed. You can only upload ${Math.max(0, 8 - currentItems.length)} more image(s).`,
      });
      return;
    }

    // Validate size and mime types
    for (const f of fileArray) {
      if (f.size > 5 * 1024 * 1024) {
        setNotification({
          type: 'error',
          message: `File "${f.name}" exceeds the 5MB size limit.`,
        });
        return;
      }
      const allowed = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowed.includes(f.type)) {
        setNotification({
          type: 'error',
          message: `File "${f.name}" is not an accepted format. Only JPEG, PNG, and WebP are allowed.`,
        });
        return;
      }
    }

    try {
      setUploadingImages(true);
      setNotification(null);
      const res = await apiUploadHomepageImages(fileArray);

      const newItems: HeroMediaItem[] = res.map((file, idx) => {
        const altSuggestion = generateAltSuggestion(file.originalName);
        return {
          id: file.id,
          fileId: file.id,
          url: file.url,
          publicUrl: file.url,
          alt: altSuggestion,
          caption: '',
          sortOrder: currentItems.length + idx + 1,
          enabled: true,
          fileName: file.originalName,
          originalName: file.originalName,
          fileSize: file.size,
          size: file.size,
        };
      });

      setDraft({
        ...draft,
        heroMedia: {
          ...(draft.heroMedia || { enabled: true, autoplay: true, autoplayInterval: 5000 }),
          items: [...currentItems, ...newItems],
        },
      });

      setNotification({
        type: 'success',
        message: `Uploaded ${newItems.length} image(s) successfully. Please enter descriptive alt text and click "Save Draft".`,
      });
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.response?.data?.message || 'Failed to upload images.',
      });
    } finally {
      setUploadingImages(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  function updateMediaItem(id: string, updates: Partial<HeroMediaItem>) {
    if (!draft) return;
    const items = (draft.heroMedia?.items || []).map((it) => (it.id === id ? { ...it, ...updates } : it));
    setDraft({
      ...draft,
      heroMedia: {
        ...(draft.heroMedia || { enabled: true, autoplay: true, autoplayInterval: 5000 }),
        items,
      },
    });
  }

  function removeMediaItem(id: string) {
    if (!draft) return;
    const remaining = (draft.heroMedia?.items || []).filter((it) => it.id !== id);
    const reordered = remaining.map((it, idx) => ({ ...it, sortOrder: idx + 1 }));
    setDraft({
      ...draft,
      heroMedia: {
        ...(draft.heroMedia || { enabled: true, autoplay: true, autoplayInterval: 5000 }),
        items: reordered,
      },
    });
    setNotification({
      type: 'success',
      message: 'Image removed from slider. Click "Save Draft" to persist this change.',
    });
  }

  function moveMediaItem(index: number, direction: 'up' | 'down') {
    if (!draft) return;
    const items = [...(draft.heroMedia?.items || [])];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= items.length) return;
    const temp = items[index];
    items[index] = items[targetIdx];
    items[targetIdx] = temp;
    const reordered = items.map((it, idx) => ({ ...it, sortOrder: idx + 1 }));
    setDraft({
      ...draft,
      heroMedia: {
        ...(draft.heroMedia || { enabled: true, autoplay: true, autoplayInterval: 5000 }),
        items: reordered,
      },
    });
  }

  async function handleUnpublish() {
    try {
      setUnpublishing(true);
      setNotification(null);
      const res = await apiUnpublishHomepage();
      setStatus(res.status as any);
      setNotification({
        type: 'success',
        message: 'Homepage unpublished. Public site will show safe fallback shell.',
      });
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.response?.data?.message || 'Failed to unpublish.',
      });
    } finally {
      setUnpublishing(false);
    }
  }

  // Feature item helpers
  function addFeature() {
    if (!draft) return;
    const newFeat: FeatureItem = {
      id: `feat-${Date.now()}`,
      title: 'New Feature',
      description: 'Describe this platform feature capability.',
      icon: 'Sparkles',
      sortOrder: (draft.features?.length || 0) + 1,
      enabled: true,
    };
    setDraft({
      ...draft,
      features: [...(draft.features || []), newFeat],
    });
  }

  function updateFeature(id: string, updates: Partial<FeatureItem>) {
    if (!draft) return;
    setDraft({
      ...draft,
      features: (draft.features || []).map((f) => (f.id === id ? { ...f, ...updates } : f)),
    });
  }

  function removeFeature(id: string) {
    if (!draft) return;
    setDraft({
      ...draft,
      features: (draft.features || []).filter((f) => f.id !== id),
    });
  }

  function moveFeature(index: number, direction: 'up' | 'down') {
    if (!draft) return;
    const feats = [...(draft.features || [])];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= feats.length) return;
    const temp = feats[index];
    feats[index] = feats[targetIdx];
    feats[targetIdx] = temp;
    // update sortOrder
    const reordered = feats.map((f, i) => ({ ...f, sortOrder: i + 1 }));
    setDraft({ ...draft, features: reordered });
  }

  // How It Works helpers
  function addStep() {
    if (!draft) return;
    const newStep: HowItWorksItem = {
      id: `step-${Date.now()}`,
      step: (draft.howItWorks?.length || 0) + 1,
      title: 'New Step',
      description: 'Describe what happens during this step.',
      enabled: true,
    };
    setDraft({
      ...draft,
      howItWorks: [...(draft.howItWorks || []), newStep],
    });
  }

  function updateStep(id: string, updates: Partial<HowItWorksItem>) {
    if (!draft) return;
    setDraft({
      ...draft,
      howItWorks: (draft.howItWorks || []).map((s) => (s.id === id ? { ...s, ...updates } : s)),
    });
  }

  function removeStep(id: string) {
    if (!draft) return;
    setDraft({
      ...draft,
      howItWorks: (draft.howItWorks || []).filter((s) => s.id !== id),
    });
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3 text-[#7C8A9A]">
          <Loader2 className="w-8 h-8 animate-spin text-[#37C6A3]" />
          <p className="text-xs font-semibold uppercase tracking-wider">Loading Website Content CMS...</p>
        </div>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
        <p className="text-sm font-semibold text-[#0F172A]">Failed to load website content.</p>
        <button
          onClick={loadDraft}
          className="mt-4 px-4 py-2 bg-[#0F172A] text-white rounded-xl text-xs font-bold"
        >
          Try Again
        </button>
      </div>
    );
  }

  const tabs: { key: TabKey; label: string; icon: any }[] = [
    { key: 'hero', label: 'Hero Section', icon: Sparkles },
    { key: 'heroMedia', label: 'Hero Media Slider', icon: ImageIcon },
    { key: 'features', label: 'Features (Bento)', icon: Layers },
    { key: 'howItWorks', label: 'How It Works', icon: ListOrdered },
    { key: 'trustSecurity', label: 'Trust & Security', icon: Shield },
    { key: 'cta', label: 'Call to Action', icon: Send },
    { key: 'contactFooter', label: 'Contact & WhatsApp', icon: MessageSquare },
    { key: 'seo', label: 'SEO & Metadata', icon: Search },
  ];

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-[#E7E9EE] shadow-xs">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-9 h-9 rounded-xl bg-[#0F172A] text-white flex items-center justify-center shadow-xs">
              <Globe className="w-5 h-5 text-[#37C6A3]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#0F172A] tracking-tight">Website Content CMS</h1>
              <div className="flex items-center gap-2 text-xs text-[#7C8A9A]">
                <span>Public SaaS Landing Page Management</span>
                <span>•</span>
                <span
                  className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded text-[10px] uppercase tracking-wider ${
                    status === 'PUBLISHED'
                      ? 'bg-emerald-100 text-emerald-800'
                      : status === 'DRAFT'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-100 text-slate-800'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      status === 'PUBLISHED'
                        ? 'bg-emerald-500'
                        : status === 'DRAFT'
                        ? 'bg-amber-500'
                        : 'bg-slate-400'
                    }`}
                  />
                  <span>{status}</span>
                </span>
                {publishedAt && (
                  <span className="hidden sm:inline">
                    (Published: {new Date(publishedAt).toLocaleDateString()})
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <a
            href="/super-admin/website-content/preview"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-[#E7E9EE] bg-white text-[#0F172A] hover:bg-[#F7F6F1] transition shadow-2xs"
          >
            <Eye className="w-3.5 h-3.5 text-[#7C8A9A]" />
            <span>Preview Draft</span>
          </a>

          <button
            onClick={handleSaveDraft}
            disabled={saving || publishing}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border border-[#0F172A] bg-white text-[#0F172A] hover:bg-[#0F172A]/5 transition shadow-2xs cursor-pointer disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>Save Draft</span>
          </button>

          <button
            onClick={handlePublish}
            disabled={publishing || saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#37C6A3] text-white hover:bg-[#37C6A3]/90 transition shadow-sm cursor-pointer disabled:opacity-50"
          >
            {publishing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            <span>Publish Changes</span>
          </button>

          {status === 'PUBLISHED' && (
            <button
              onClick={handleUnpublish}
              disabled={unpublishing}
              className="p-2 rounded-xl text-xs font-bold border border-red-200 text-red-600 hover:bg-red-50 transition cursor-pointer"
              title="Unpublish Homepage"
            >
              {unpublishing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArchiveX className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Notification Banner */}
      {notification && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between text-xs font-semibold ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600" />
            )}
            <span>{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="underline cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 bg-white p-1.5 rounded-2xl border border-[#E7E9EE] shadow-2xs overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-[#0F172A] text-white shadow-xs'
                  : 'text-[#7C8A9A] hover:text-[#0F172A] hover:bg-[#F7F6F1]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Editor Content Area */}
      <div className="bg-white rounded-2xl border border-[#E7E9EE] p-6 sm:p-8 shadow-xs">
        {/* =================================================================== */}
        {/* TAB 1: HERO */}
        {/* =================================================================== */}
        {activeTab === 'hero' && (
          <div className="space-y-6 max-w-3xl">
            <div className="border-b border-[#E7E9EE] pb-4">
              <h3 className="text-base font-bold text-[#0F172A]">Hero Section Content</h3>
              <p className="text-xs text-[#7C8A9A]">Control the primary value proposition at the top of the landing page.</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1.5">Eyebrow Pill Badge</label>
              <input
                type="text"
                value={draft.hero?.eyebrow || ''}
                onChange={(e) => setDraft({ ...draft, hero: { ...draft.hero, eyebrow: e.target.value } })}
                placeholder="e.g. Modern Madrasa Management Platform"
                className="w-full px-3.5 py-2 rounded-xl border border-[#E7E9EE] text-xs font-medium text-[#0F172A] focus:outline-none focus:border-[#37C6A3]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                Main Headline <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={draft.hero?.title || ''}
                onChange={(e) => setDraft({ ...draft, hero: { ...draft.hero, title: e.target.value } })}
                placeholder="e.g. Manage Your Madrasa Smarter. Teach Better. Grow Further."
                className="w-full px-3.5 py-2 rounded-xl border border-[#E7E9EE] text-xs font-medium text-[#0F172A] focus:outline-none focus:border-[#37C6A3]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1.5">Highlighted Headline Text</label>
              <input
                type="text"
                value={draft.hero?.highlightedText || ''}
                onChange={(e) => setDraft({ ...draft, hero: { ...draft.hero, highlightedText: e.target.value } })}
                placeholder="Exact substring from headline to highlight with mint accent"
                className="w-full px-3.5 py-2 rounded-xl border border-[#E7E9EE] text-xs font-medium text-[#0F172A] focus:outline-none focus:border-[#37C6A3]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1.5">Supporting Description</label>
              <textarea
                rows={3}
                value={draft.hero?.description || ''}
                onChange={(e) => setDraft({ ...draft, hero: { ...draft.hero, description: e.target.value } })}
                placeholder="Concise overview of platform capabilities..."
                className="w-full px-3.5 py-2 rounded-xl border border-[#E7E9EE] text-xs font-medium text-[#0F172A] focus:outline-none focus:border-[#37C6A3]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1.5">Primary CTA Button Label</label>
                <input
                  type="text"
                  value={draft.hero?.primaryCtaLabel || ''}
                  onChange={(e) => setDraft({ ...draft, hero: { ...draft.hero, primaryCtaLabel: e.target.value } })}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E7E9EE] text-xs font-medium text-[#0F172A] focus:outline-none focus:border-[#37C6A3]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1.5">Primary CTA URL</label>
                <input
                  type="text"
                  value={draft.hero?.primaryCtaUrl || '/register'}
                  onChange={(e) => setDraft({ ...draft, hero: { ...draft.hero, primaryCtaUrl: e.target.value } })}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E7E9EE] text-xs font-medium text-[#0F172A] focus:outline-none focus:border-[#37C6A3]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1.5">Secondary CTA Button Label</label>
                <input
                  type="text"
                  value={draft.hero?.secondaryCtaLabel || ''}
                  onChange={(e) => setDraft({ ...draft, hero: { ...draft.hero, secondaryCtaLabel: e.target.value } })}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E7E9EE] text-xs font-medium text-[#0F172A] focus:outline-none focus:border-[#37C6A3]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1.5">Secondary CTA URL</label>
                <input
                  type="text"
                  value={draft.hero?.secondaryCtaUrl || '#features'}
                  onChange={(e) => setDraft({ ...draft, hero: { ...draft.hero, secondaryCtaUrl: e.target.value } })}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E7E9EE] text-xs font-medium text-[#0F172A] focus:outline-none focus:border-[#37C6A3]"
                />
              </div>
            </div>

            {/* Product Preview / Showcase Screenshot Configuration */}
            <div className="pt-6 border-t border-[#E7E9EE] space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-[#37C6A3]" />
                    <span>Product Showcase Screenshot</span>
                  </h4>
                  <p className="text-xs text-[#7C8A9A]">
                    Upload a high-fidelity screenshot of the real administrative portal to display in the Product Showcase section.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      productPreviewMedia: {
                        enabled: draft.productPreviewMedia?.enabled === false ? true : false,
                        fileId: draft.productPreviewMedia?.fileId || null,
                        url: draft.productPreviewMedia?.url || null,
                        alt: draft.productPreviewMedia?.alt || '',
                        caption: draft.productPreviewMedia?.caption || null,
                      },
                    })
                  }
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    draft.productPreviewMedia?.enabled !== false
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {draft.productPreviewMedia?.enabled !== false ? 'Enabled' : 'Disabled'}
                </button>
              </div>

              <div className="p-4 rounded-xl bg-[#F7F6F1]/60 border border-[#E7E9EE] space-y-4">
                <HomepageImageUploader
                  section="product-preview"
                  currentUrl={draft.productPreviewMedia?.url}
                  currentAlt={draft.productPreviewMedia?.alt}
                  onImageSelected={({ fileId, url, suggestedAlt }) => {
                    setDraft({
                      ...draft,
                      productPreviewMedia: {
                        enabled: draft.productPreviewMedia?.enabled !== false,
                        fileId,
                        url,
                        alt: draft.productPreviewMedia?.alt || suggestedAlt,
                        caption: draft.productPreviewMedia?.caption || null,
                      },
                    });
                  }}
                  onImageCleared={() => {
                    setDraft({
                      ...draft,
                      productPreviewMedia: {
                        enabled: draft.productPreviewMedia?.enabled !== false,
                        fileId: null,
                        url: null,
                        alt: '',
                        caption: null,
                      },
                    });
                  }}
                  label="Showcase Portal Screenshot"
                  helperText="Recommended: 1920x1080 or 1600x1000 WebP/PNG/JPG (Max 5 MB)"
                />

                {draft.productPreviewMedia?.fileId && (
                  <div className="space-y-3 pt-2 border-t border-[#E7E9EE]">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-bold text-[#0F172A]">
                          Accessibility Alt Text <span className="text-red-500">*</span>
                        </label>
                        <span
                          className={`text-[10px] font-semibold ${
                            (draft.productPreviewMedia?.alt || '').trim().length < 3
                              ? 'text-red-500'
                              : (draft.productPreviewMedia?.alt || '').trim().length > 200
                              ? 'text-red-500'
                              : 'text-emerald-600'
                          }`}
                        >
                          {(draft.productPreviewMedia?.alt || '').length} / 200 chars (min 3)
                        </span>
                      </div>
                      <input
                        type="text"
                        value={draft.productPreviewMedia?.alt || ''}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            productPreviewMedia: {
                              ...draft.productPreviewMedia!,
                              alt: e.target.value,
                            },
                          })
                        }
                        placeholder="e.g. MadrasaNexa Admin Dashboard Overview"
                        className={`w-full px-3 py-2 rounded-lg border text-xs font-medium focus:outline-none ${
                          draft.productPreviewMedia?.enabled && (draft.productPreviewMedia?.alt || '').trim().length < 3
                            ? 'border-red-400 bg-red-50/40 text-[#0F172A]'
                            : 'border-[#E7E9EE] text-[#0F172A] focus:border-[#37C6A3]'
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-[#0F172A] mb-1">
                        Caption <span className="text-[#7C8A9A] font-normal">(optional)</span>
                      </label>
                      <input
                        type="text"
                        value={draft.productPreviewMedia?.caption || ''}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            productPreviewMedia: {
                              ...draft.productPreviewMedia!,
                              caption: e.target.value,
                            },
                          })
                        }
                        placeholder="e.g. Comprehensive Student Records & Daily Attendance Suite"
                        className="w-full px-3 py-2 rounded-lg border border-[#E7E9EE] text-xs font-medium text-[#0F172A] focus:outline-none focus:border-[#37C6A3]"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 1.5: HERO MEDIA SLIDER */}
        {/* =================================================================== */}
        {activeTab === 'heroMedia' && (
          <div className="space-y-6 max-w-4xl">
            <div className="border-b border-[#E7E9EE] pb-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-[#0F172A]">Hero Media Slider & Images</h3>
                  <p className="text-xs text-[#7C8A9A]">
                    Upload and manage up to 8 showcase images displayed on the homepage hero section.
                  </p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#F7F6F1] border border-[#E7E9EE] text-[#0F172A]">
                  {(draft.heroMedia?.items || []).length} / 8 Images
                </span>
              </div>
            </div>

            {/* Slider Settings */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-[#F7F6F1]/60 border border-[#E7E9EE]">
              <div className="flex items-center justify-between sm:justify-start gap-3">
                <label className="text-xs font-bold text-[#0F172A]">Enable Slider</label>
                <button
                  type="button"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      heroMedia: {
                        ...(draft.heroMedia || { autoplay: true, autoplayInterval: 5000, items: [] }),
                        enabled: !draft.heroMedia?.enabled,
                      },
                    })
                  }
                  className={`w-10 h-6 rounded-full transition-colors p-0.5 flex items-center cursor-pointer ${
                    draft.heroMedia?.enabled ? 'bg-[#37C6A3] justify-end' : 'bg-slate-300 justify-start'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-white shadow-xs block" />
                </button>
              </div>

              <div className="flex items-center justify-between sm:justify-start gap-3">
                <label className="text-xs font-bold text-[#0F172A]">Autoplay</label>
                <button
                  type="button"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      heroMedia: {
                        ...(draft.heroMedia || { enabled: true, autoplayInterval: 5000, items: [] }),
                        autoplay: !draft.heroMedia?.autoplay,
                      },
                    })
                  }
                  className={`w-10 h-6 rounded-full transition-colors p-0.5 flex items-center cursor-pointer ${
                    draft.heroMedia?.autoplay ? 'bg-[#37C6A3] justify-end' : 'bg-slate-300 justify-start'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-white shadow-xs block" />
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1">Interval (ms)</label>
                <input
                  type="number"
                  min={3000}
                  max={15000}
                  step={500}
                  value={draft.heroMedia?.autoplayInterval || 5000}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      heroMedia: {
                        ...(draft.heroMedia || { enabled: true, autoplay: true, items: [] }),
                        autoplayInterval: Math.max(3000, Math.min(15000, Number(e.target.value) || 5000)),
                      },
                    })
                  }
                  className="w-full px-3 py-1.5 rounded-lg border border-[#E7E9EE] text-xs font-medium text-[#0F172A] bg-white"
                />
              </div>
            </div>

            {/* Upload Area */}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  if (e.target.files) {
                    handleMediaUpload(e.target.files);
                  }
                }}
                className="hidden"
              />

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  if (e.dataTransfer.files) {
                    handleMediaUpload(e.dataTransfer.files);
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                  dragActive
                    ? 'border-[#37C6A3] bg-[#37C6A3]/5 scale-[0.99]'
                    : 'border-[#E7E9EE] hover:border-[#37C6A3]/60 hover:bg-[#F7F6F1]/50'
                } ${uploadingImages ? 'opacity-50 pointer-events-none' : ''}`}
              >
                {uploadingImages ? (
                  <div className="flex flex-col items-center gap-2 text-[#7C8A9A]">
                    <Loader2 className="w-8 h-8 animate-spin text-[#37C6A3]" />
                    <span className="text-xs font-semibold">Uploading and optimizing images to R2...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-2xl bg-[#37C6A3]/10 text-[#37C6A3] flex items-center justify-center">
                      <Upload className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-bold text-[#0F172A]">
                      Click to browse or drag & drop images here
                    </p>
                    <p className="text-xs text-[#7C8A9A]">
                      Supports JPEG, PNG, or WebP up to 5MB each. Automatically optimized to WebP (max 1600px).
                    </p>
                    <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-[#E7E9EE] text-[11px] font-bold text-[#0F172A] shadow-2xs">
                      <Plus className="w-3.5 h-3.5 text-[#37C6A3]" />
                      <span>Select Images</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Uploaded Images List */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#7C8A9A]">
                Slider Images ({(draft.heroMedia?.items || []).length} of 8)
              </h4>

              {(!draft.heroMedia?.items || draft.heroMedia.items.length === 0) && (
                <div className="p-8 text-center bg-[#F7F6F1]/40 rounded-xl border border-[#E7E9EE] text-xs text-[#7C8A9A]">
                  No images uploaded yet. When no images are configured or enabled, the homepage automatically shows the interactive product preview dashboard.
                </div>
              )}

              {(draft.heroMedia?.items || []).map((item, index) => {
                const isAltMissing = item.enabled && (!item.alt || item.alt.trim().length < 3);
                const isAltTooLong = item.enabled && (item.alt?.trim().length || 0) > 200;
                const isAltInvalid = isAltMissing || isAltTooLong;

                return (
                  <div
                    key={item.id}
                    className={`flex flex-col md:flex-row items-start md:items-center gap-4 p-4 rounded-xl border transition shadow-2xs ${
                      isAltInvalid
                        ? 'border-red-300 ring-1 ring-red-200 bg-red-50/15'
                        : 'border-[#E7E9EE] bg-white hover:border-[#37C6A3]/40'
                    }`}
                  >
                    {/* Thumbnail */}
                    <div className="relative w-full md:w-32 h-20 shrink-0 bg-slate-100 rounded-lg overflow-hidden border border-[#E7E9EE]">
                      <img
                        src={item.publicUrl || item.url || ''}
                        alt={item.alt || 'Slide thumbnail'}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/70 text-white font-mono text-[10px] font-bold">
                        #{index + 1}
                      </span>
                    </div>

                    {/* Form fields */}
                    <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[11px] font-bold text-[#0F172A]">
                            Alt Text {item.enabled ? <span className="text-red-500">*</span> : <span className="text-[#7C8A9A] font-normal">(optional when disabled)</span>}
                          </label>
                          {item.alt && (
                            <span className={`text-[10px] ${item.alt.length > 200 ? 'text-red-500 font-bold' : 'text-[#7C8A9A]'}`}>
                              {item.alt.length}/200
                            </span>
                          )}
                        </div>
                        <input
                          id={`alt-input-${item.id}`}
                          type="text"
                          value={item.alt}
                          onChange={(e) => updateMediaItem(item.id, { alt: e.target.value })}
                          placeholder={item.enabled ? "Descriptive image alt text (required)" : "Optional alt text"}
                          className={`w-full px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors focus:outline-none ${
                            isAltInvalid
                              ? 'border-red-400 bg-red-50/40 text-[#0F172A] focus:border-red-500 focus:ring-1 focus:ring-red-500'
                              : 'border-[#E7E9EE] text-[#0F172A] focus:border-[#37C6A3]'
                          }`}
                        />
                        {isAltMissing && (
                          <p className="mt-1 text-[11px] font-semibold text-red-600 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3 text-red-500 shrink-0" />
                            <span>Alt text is required for this image (min 3 characters).</span>
                          </p>
                        )}
                        {isAltTooLong && (
                          <p className="mt-1 text-[11px] font-semibold text-red-600 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3 text-red-500 shrink-0" />
                            <span>Alt text cannot exceed 200 characters.</span>
                          </p>
                        )}
                        {!item.enabled && (
                          <p className="mt-1 text-[10px] text-[#7C8A9A]">
                            Image is disabled. Alt text is not required while disabled.
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-[#0F172A] mb-1">
                          Caption <span className="text-[#7C8A9A] font-normal">(optional)</span>
                        </label>
                        <input
                          type="text"
                          value={item.caption || ''}
                          onChange={(e) => updateMediaItem(item.id, { caption: e.target.value })}
                          placeholder="e.g. Modern Madrasa Classroom Environment"
                          className="w-full px-3 py-1.5 rounded-lg border border-[#E7E9EE] text-xs font-medium text-[#0F172A] focus:outline-none focus:border-[#37C6A3]"
                        />
                      </div>
                    </div>

                    {/* Item Actions */}
                    <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                      <button
                        type="button"
                        onClick={() => updateMediaItem(item.id, { enabled: !item.enabled })}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                          item.enabled
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {item.enabled ? 'Enabled' : 'Disabled'}
                      </button>

                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => moveMediaItem(index, 'up')}
                        className="p-1.5 rounded-lg border border-[#E7E9EE] hover:bg-[#F7F6F1] disabled:opacity-30 cursor-pointer"
                        title="Move Up"
                      >
                        <MoveUp className="w-3.5 h-3.5 text-[#0F172A]" />
                      </button>

                      <button
                        type="button"
                        disabled={index === (draft.heroMedia?.items || []).length - 1}
                        onClick={() => moveMediaItem(index, 'down')}
                        className="p-1.5 rounded-lg border border-[#E7E9EE] hover:bg-[#F7F6F1] disabled:opacity-30 cursor-pointer"
                        title="Move Down"
                      >
                        <MoveDown className="w-3.5 h-3.5 text-[#0F172A]" />
                      </button>

                      <button
                        type="button"
                        onClick={() => removeMediaItem(item.id)}
                        className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 cursor-pointer"
                        title="Remove from slider"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 2: FEATURES (BENTO GRID) */}
        {/* =================================================================== */}
        {activeTab === 'features' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E7E9EE] pb-4">
              <div>
                <h3 className="text-base font-bold text-[#0F172A]">Platform Features (Bento Cards)</h3>
                <p className="text-xs text-[#7C8A9A]">Add, reorder, or edit capabilities highlighted in the bento layout.</p>
              </div>
              <button
                onClick={addFeature}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#0F172A] text-white hover:bg-[#0F172A]/90 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Feature</span>
              </button>
            </div>

            <div className="space-y-4">
              {(draft.features || []).map((feat, idx) => (
                <div key={feat.id} className="p-4 rounded-xl border border-[#E7E9EE] bg-[#F7F6F1]/50 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-[#0F172A] text-white text-[10px] font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="text-xs font-bold text-[#0F172A]">{feat.title || 'Untitled Feature'}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => moveFeature(idx, 'up')}
                        disabled={idx === 0}
                        className="p-1 rounded text-[#7C8A9A] hover:text-[#0F172A] disabled:opacity-30 cursor-pointer"
                      >
                        <MoveUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => moveFeature(idx, 'down')}
                        disabled={idx === (draft.features?.length || 1) - 1}
                        className="p-1 rounded text-[#7C8A9A] hover:text-[#0F172A] disabled:opacity-30 cursor-pointer"
                      >
                        <MoveDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => removeFeature(feat.id)}
                        className="p-1 rounded text-red-500 hover:bg-red-50 cursor-pointer ml-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-4">
                      <label className="block text-[11px] font-semibold text-[#7C8A9A] mb-1">Feature Title</label>
                      <input
                        type="text"
                        value={feat.title}
                        onChange={(e) => updateFeature(feat.id, { title: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg border border-[#E7E9EE] bg-white text-xs font-medium text-[#0F172A]"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-semibold text-[#7C8A9A] mb-1">Lucide Icon</label>
                      <select
                        value={feat.icon}
                        onChange={(e) => updateFeature(feat.id, { icon: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg border border-[#E7E9EE] bg-white text-xs font-medium text-[#0F172A]"
                      >
                        {APPROVED_ICONS.map((ic) => (
                          <option key={ic} value={ic}>
                            {ic}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-5">
                      <label className="block text-[11px] font-semibold text-[#7C8A9A] mb-1">Description</label>
                      <input
                        type="text"
                        value={feat.description}
                        onChange={(e) => updateFeature(feat.id, { description: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg border border-[#E7E9EE] bg-white text-xs font-medium text-[#0F172A]"
                      />
                    </div>
                  </div>

                  {/* Feature Visual Screenshot (Optional) */}
                  <div className="pt-2 border-t border-[#E7E9EE] space-y-2">
                    <HomepageImageUploader
                      section="features"
                      currentUrl={feat.imageUrl}
                      currentAlt={feat.imageAlt}
                      onImageSelected={({ fileId, url, suggestedAlt }) => {
                        updateFeature(feat.id, {
                          imageFileId: fileId,
                          imageUrl: url,
                          imageAlt: feat.imageAlt || suggestedAlt,
                        });
                      }}
                      onImageCleared={() => {
                        updateFeature(feat.id, {
                          imageFileId: null,
                          imageUrl: null,
                          imageAlt: null,
                          imageCaption: null,
                        });
                      }}
                      label="Feature Screenshot / Visual Media (Optional)"
                      helperText="Attach an illustrative UI screenshot (JPG, PNG, WebP up to 5 MB)"
                    />

                    {feat.imageFileId && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-[10px] font-bold text-[#0F172A]">
                              Alt Text <span className="text-red-500">*</span>
                            </label>
                            <span
                              className={`text-[9px] font-semibold ${
                                (feat.imageAlt || '').trim().length < 3
                                  ? 'text-red-500'
                                  : (feat.imageAlt || '').trim().length > 200
                                  ? 'text-red-500'
                                  : 'text-emerald-600'
                              }`}
                            >
                              {(feat.imageAlt || '').length} / 200 chars
                            </span>
                          </div>
                          <input
                            type="text"
                            value={feat.imageAlt || ''}
                            onChange={(e) => updateFeature(feat.id, { imageAlt: e.target.value })}
                            placeholder="e.g. Student Academic Records Interface"
                            className={`w-full px-2.5 py-1.5 rounded-lg border text-xs font-medium focus:outline-none ${
                              feat.enabled && (feat.imageAlt || '').trim().length < 3
                                ? 'border-red-400 bg-red-50/40 text-[#0F172A]'
                                : 'border-[#E7E9EE] bg-white text-[#0F172A] focus:border-[#37C6A3]'
                            }`}
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-[#0F172A] mb-1">
                            Caption <span className="text-[#7C8A9A] font-normal">(optional)</span>
                          </label>
                          <input
                            type="text"
                            value={feat.imageCaption || ''}
                            onChange={(e) => updateFeature(feat.id, { imageCaption: e.target.value })}
                            placeholder="e.g. Student Profiles & Enrollment History"
                            className="w-full px-2.5 py-1.5 rounded-lg border border-[#E7E9EE] bg-white text-xs font-medium text-[#0F172A] focus:outline-none focus:border-[#37C6A3]"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 3: HOW IT WORKS */}
        {/* =================================================================== */}
        {activeTab === 'howItWorks' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E7E9EE] pb-4">
              <div>
                <h3 className="text-base font-bold text-[#0F172A]">How It Works Process Steps</h3>
                <p className="text-xs text-[#7C8A9A]">Guide prospective Madrasas through the onboarding and verification journey.</p>
              </div>
              <button
                onClick={addStep}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#0F172A] text-white hover:bg-[#0F172A]/90 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Step</span>
              </button>
            </div>

            <div className="space-y-4">
              {(draft.howItWorks || []).map((step) => (
                <div key={step.id} className="p-4 rounded-xl border border-[#E7E9EE] bg-[#F7F6F1]/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#0F172A]">Step 0{step.step}</span>
                    <button
                      onClick={() => removeStep(step.id)}
                      className="p-1 text-red-500 hover:bg-red-50 rounded cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-4">
                      <label className="block text-[11px] font-semibold text-[#7C8A9A] mb-1">Step Title</label>
                      <input
                        type="text"
                        value={step.title}
                        onChange={(e) => updateStep(step.id, { title: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg border border-[#E7E9EE] bg-white text-xs font-medium text-[#0F172A]"
                      />
                    </div>
                    <div className="sm:col-span-8">
                      <label className="block text-[11px] font-semibold text-[#7C8A9A] mb-1">Description</label>
                      <input
                        type="text"
                        value={step.description}
                        onChange={(e) => updateStep(step.id, { description: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg border border-[#E7E9EE] bg-white text-xs font-medium text-[#0F172A]"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 4: TRUST & SECURITY */}
        {/* =================================================================== */}
        {activeTab === 'trustSecurity' && (
          <div className="space-y-8 max-w-3xl">
            {/* Trust Strip */}
            <div className="space-y-4">
              <div className="border-b border-[#E7E9EE] pb-3">
                <h3 className="text-base font-bold text-[#0F172A]">Architectural Trust Badges</h3>
                <p className="text-xs text-[#7C8A9A]">Short value statements displayed directly under the hero preview.</p>
              </div>

              <div className="space-y-2">
                {(draft.trustStrip || []).map((item, idx) => (
                  <div key={item.id} className="flex flex-wrap sm:flex-nowrap items-center gap-3 p-3 bg-[#F7F6F1]/50 rounded-xl border border-[#E7E9EE]">
                    <span className="text-xs font-bold text-[#7C8A9A]">0{idx + 1}</span>
                    <input
                      type="text"
                      value={item.text}
                      onChange={(e) => {
                        const next = [...(draft.trustStrip || [])];
                        next[idx].text = e.target.value;
                        setDraft({ ...draft, trustStrip: next });
                      }}
                      className="flex-1 px-3 py-1.5 rounded-lg border border-[#E7E9EE] bg-white text-xs font-medium text-[#0F172A]"
                    />
                    <select
                      value={item.icon}
                      onChange={(e) => {
                        const next = [...(draft.trustStrip || [])];
                        next[idx].icon = e.target.value;
                        setDraft({ ...draft, trustStrip: next });
                      }}
                      className="px-3 py-1.5 rounded-lg border border-[#E7E9EE] bg-white text-xs font-medium text-[#0F172A]"
                    >
                      {APPROVED_ICONS.map((ic) => (
                        <option key={ic} value={ic}>
                          {ic}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* Security Section */}
            <div className="space-y-4 pt-4 border-t border-[#E7E9EE]">
              <div className="border-b border-[#E7E9EE] pb-3">
                <h3 className="text-base font-bold text-[#0F172A]">Security Architecture Section</h3>
                <p className="text-xs text-[#7C8A9A]">Rigorous architectural highlights (tenant isolation, RBAC, receipt protection).</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1">Heading</label>
                <input
                  type="text"
                  value={draft.security?.heading || ''}
                  onChange={(e) => setDraft({ ...draft, security: { ...draft.security, heading: e.target.value } })}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E7E9EE] text-xs font-medium text-[#0F172A]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1">Description</label>
                <textarea
                  rows={2}
                  value={draft.security?.description || ''}
                  onChange={(e) => setDraft({ ...draft, security: { ...draft.security, description: e.target.value } })}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E7E9EE] text-xs font-medium text-[#0F172A]"
                />
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 5: CTA */}
        {/* =================================================================== */}
        {activeTab === 'cta' && (
          <div className="space-y-6 max-w-3xl">
            <div className="border-b border-[#E7E9EE] pb-4">
              <h3 className="text-base font-bold text-[#0F172A]">Dark Navy CTA Banner</h3>
              <p className="text-xs text-[#7C8A9A]">Final conversion block before the contact & footer section.</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1.5">Heading</label>
              <input
                type="text"
                value={draft.cta?.heading || ''}
                onChange={(e) => setDraft({ ...draft, cta: { ...draft.cta, heading: e.target.value } })}
                className="w-full px-3.5 py-2 rounded-xl border border-[#E7E9EE] text-xs font-medium text-[#0F172A]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1.5">Description</label>
              <textarea
                rows={3}
                value={draft.cta?.description || ''}
                onChange={(e) => setDraft({ ...draft, cta: { ...draft.cta, description: e.target.value } })}
                className="w-full px-3.5 py-2 rounded-xl border border-[#E7E9EE] text-xs font-medium text-[#0F172A]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1.5">Primary CTA Label</label>
                <input
                  type="text"
                  value={draft.cta?.primaryCtaLabel || ''}
                  onChange={(e) => setDraft({ ...draft, cta: { ...draft.cta, primaryCtaLabel: e.target.value } })}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E7E9EE] text-xs font-medium text-[#0F172A]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1.5">Primary CTA URL</label>
                <input
                  type="text"
                  value={draft.cta?.primaryCtaUrl || '/register'}
                  onChange={(e) => setDraft({ ...draft, cta: { ...draft.cta, primaryCtaUrl: e.target.value } })}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E7E9EE] text-xs font-medium text-[#0F172A]"
                />
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 6: CONTACT & FOOTER */}
        {/* =================================================================== */}
        {activeTab === 'contactFooter' && (
          <div className="space-y-6 max-w-3xl">
            <div className="border-b border-[#E7E9EE] pb-4">
              <h3 className="text-base font-bold text-[#0F172A]">Platform Contact Information</h3>
              <p className="text-xs text-[#7C8A9A]">
                Authoritative platform contact details. Empty fields are gracefully hidden from the public website.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1.5">Official Email</label>
                <input
                  type="email"
                  value={draft.contact?.email || ''}
                  onChange={(e) => setDraft({ ...draft, contact: { ...draft.contact, email: e.target.value || null } })}
                  placeholder="contact@madrasanexa.com"
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E7E9EE] text-xs font-medium text-[#0F172A]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1.5">Telephone / Support Line</label>
                <input
                  type="text"
                  value={draft.contact?.phone || ''}
                  onChange={(e) => setDraft({ ...draft, contact: { ...draft.contact, phone: e.target.value || null } })}
                  placeholder="+94 11 234 5678"
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E7E9EE] text-xs font-medium text-[#0F172A]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1.5">Office Address</label>
                <input
                  type="text"
                  value={draft.contact?.address || ''}
                  onChange={(e) => setDraft({ ...draft, contact: { ...draft.contact, address: e.target.value || null } })}
                  placeholder="Official office address"
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E7E9EE] text-xs font-medium text-[#0F172A]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1.5">Working Hours</label>
                <input
                  type="text"
                  value={draft.contact?.officeHours || ''}
                  onChange={(e) => setDraft({ ...draft, contact: { ...draft.contact, officeHours: e.target.value || null } })}
                  placeholder="Mon - Fri: 9:00 AM - 5:00 PM"
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E7E9EE] text-xs font-medium text-[#0F172A]"
                />
              </div>
            </div>

            {/* WhatsApp Integration Section */}
            <div className="pt-6 border-t border-[#E7E9EE] space-y-4">
              <div className="border-b border-[#E7E9EE] pb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-[#0F172A] flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-[#25D366]" />
                    <span>WhatsApp Floating Button Settings</span>
                  </h3>
                  <p className="text-xs text-[#7C8A9A]">
                    Show or hide the floating WhatsApp inquiry button on the bottom-right of public pages.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      whatsapp: {
                        ...(draft.whatsapp || {
                          number: '+94 78 325 4552',
                          defaultMessage: 'Assalamu Alaikum, I would like to know more about MadrasaNexa.',
                        }),
                        enabled: !draft.whatsapp?.enabled,
                      },
                    })
                  }
                  className={`w-10 h-6 rounded-full transition-colors p-0.5 flex items-center cursor-pointer ${
                    draft.whatsapp?.enabled ? 'bg-[#37C6A3] justify-end' : 'bg-slate-300 justify-start'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-white shadow-xs block" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                    WhatsApp Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={draft.whatsapp?.number || ''}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        whatsapp: {
                          ...(draft.whatsapp || {
                            enabled: true,
                            defaultMessage: 'Assalamu Alaikum, I would like to know more about MadrasaNexa.',
                          }),
                          number: e.target.value,
                        },
                      })
                    }
                    placeholder="+94 78 325 4552"
                    className="w-full px-3.5 py-2 rounded-xl border border-[#E7E9EE] text-xs font-medium text-[#0F172A]"
                  />
                  <p className="mt-1 text-[11px] text-[#7C8A9A]">
                    International format with country code (e.g. +94 78 325 4552).
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                    Test Direct Chat Link
                  </label>
                  {draft.whatsapp?.number ? (
                    <a
                      href={`https://wa.me/${normalizeWhatsAppNumber(draft.whatsapp.number)}?text=${encodeURIComponent(
                        draft.whatsapp.defaultMessage || ''
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border border-[#25D366]/40 bg-[#25D366]/10 text-[#0F172A] hover:bg-[#25D366]/20 transition"
                    >
                      <MessageCircle className="w-4 h-4 text-[#25D366]" />
                      <span>Test WhatsApp Link</span>
                      <ExternalLink className="w-3 h-3 text-[#7C8A9A]" />
                    </a>
                  ) : (
                    <span className="text-xs text-[#7C8A9A] italic block pt-2">
                      Enter a phone number above to preview link
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                  Default Pre-filled Greeting Message
                </label>
                <textarea
                  rows={2}
                  value={draft.whatsapp?.defaultMessage || ''}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      whatsapp: {
                        ...(draft.whatsapp || {
                          enabled: true,
                          number: '+94 78 325 4552',
                        }),
                        defaultMessage: e.target.value,
                      },
                    })
                  }
                  placeholder="Assalamu Alaikum, I would like to know more about MadrasaNexa."
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E7E9EE] text-xs font-medium text-[#0F172A]"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-[#E7E9EE]">
              <label className="block text-xs font-bold text-[#0F172A] mb-1.5">Footer Copyright Text</label>
              <input
                type="text"
                value={draft.footer?.copyrightText || ''}
                onChange={(e) => setDraft({ ...draft, footer: { ...draft.footer, copyrightText: e.target.value } })}
                className="w-full px-3.5 py-2 rounded-xl border border-[#E7E9EE] text-xs font-medium text-[#0F172A]"
              />
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 7: SEO */}
        {/* =================================================================== */}
        {activeTab === 'seo' && (
          <div className="space-y-6 max-w-3xl">
            <div className="border-b border-[#E7E9EE] pb-4">
              <h3 className="text-base font-bold text-[#0F172A]">Search Engine Optimization (SEO)</h3>
              <p className="text-xs text-[#7C8A9A]">Meta tags applied to the public homepage document title and crawlers.</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1.5">Meta Page Title</label>
              <input
                type="text"
                value={draft.seo?.metaTitle || ''}
                onChange={(e) => setDraft({ ...draft, seo: { ...draft.seo, metaTitle: e.target.value } })}
                placeholder="MadrasaNexa — Modern Madrasa Management Platform"
                className="w-full px-3.5 py-2 rounded-xl border border-[#E7E9EE] text-xs font-medium text-[#0F172A]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1.5">Meta Description</label>
              <textarea
                rows={3}
                value={draft.seo?.metaDescription || ''}
                onChange={(e) => setDraft({ ...draft, seo: { ...draft.seo, metaDescription: e.target.value } })}
                placeholder="Concise search result summary..."
                className="w-full px-3.5 py-2 rounded-xl border border-[#E7E9EE] text-xs font-medium text-[#0F172A]"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
