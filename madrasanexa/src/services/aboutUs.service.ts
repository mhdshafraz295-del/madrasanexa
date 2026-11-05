import { apiClient } from './api';

export type AboutUsLanguage = 'en' | 'ar' | 'ta';

export const ABOUT_US_LANG_STORAGE_KEY = 'madrasanexa_about_language';

export function getStoredAboutUsLanguage(): AboutUsLanguage {
  try {
    const saved = localStorage.getItem(ABOUT_US_LANG_STORAGE_KEY);
    if (saved === 'ar' || saved === 'ta' || saved === 'en') {
      return saved;
    }
  } catch (e) {
    // Ignore storage access errors
  }
  return 'en';
}

export function setStoredAboutUsLanguage(lang: AboutUsLanguage): void {
  try {
    if (lang === 'en' || lang === 'ar' || lang === 'ta') {
      localStorage.setItem(ABOUT_US_LANG_STORAGE_KEY, lang);
    } else {
      localStorage.setItem(ABOUT_US_LANG_STORAGE_KEY, 'en');
    }
  } catch (e) {
    // Ignore storage access errors
  }
}

export interface CoreValueItem {
  id?: string;
  title: string;
  description: string;
  icon?: string | null;
}

export interface HighlightItem {
  id?: string;
  title: string;
  metric: string;
  description?: string | null;
}

export interface AboutUsContentSnapshot {
  title: string;
  subtitle: string;
  introduction: string;
  story: string;
  mission: string;
  vision: string;
  coreValues: CoreValueItem[];
  highlights: HighlightItem[];
  ctaLabel: string;
  ctaUrl: string;
  heroFileId?: string | null;
  heroImageUrl?: string | null;
  heroAlt?: string | null;
  storyFileId?: string | null;
  storyImageUrl?: string | null;
  storyAlt?: string | null;
  publishedAt?: string | null;
}

export interface AboutUsDraftUpdatePayload {
  language?: AboutUsLanguage;
  title?: string | null;
  subtitle?: string | null;
  introduction?: string | null;
  story?: string | null;
  mission?: string | null;
  vision?: string | null;
  coreValues?: Array<{ id?: string; title?: string; description?: string; icon?: string | null }> | null;
  highlights?: Array<{ id?: string; title?: string; metric?: string; description?: string | null }> | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  heroAlt?: string | null;
  storyAlt?: string | null;
}

export interface TranslationSnapshot {
  title: string;
  subtitle: string;
  introduction: string;
  story: string;
  mission: string;
  vision: string;
  coreValues: CoreValueItem[];
  highlights: HighlightItem[];
  ctaLabel: string;
  ctaUrl: string;
  heroAlt: string;
  storyAlt: string;
}

export interface AdminAboutUsData {
  id: string;
  status: 'DRAFT' | 'PUBLISHED' | 'UNPUBLISHED';
  draft: AboutUsContentSnapshot;
  published: AboutUsContentSnapshot;
  translations?: {
    ar?: { draft: TranslationSnapshot | null; published: TranslationSnapshot | null };
    ta?: { draft: TranslationSnapshot | null; published: TranslationSnapshot | null };
  };
  createdAt: string;
  updatedAt: string;
}

export interface FieldOriginMeta {
  lang: AboutUsLanguage;
  dir: 'ltr' | 'rtl';
  isFallback: boolean;
}

export interface FieldMetadata {
  title?: FieldOriginMeta;
  subtitle?: FieldOriginMeta;
  introduction?: FieldOriginMeta;
  story?: FieldOriginMeta;
  mission?: FieldOriginMeta;
  vision?: FieldOriginMeta;
  ctaLabel?: FieldOriginMeta;
  heroAlt?: FieldOriginMeta;
  storyAlt?: FieldOriginMeta;
  coreValues?: Array<{
    id?: string;
    title?: FieldOriginMeta;
    description?: FieldOriginMeta;
  }>;
  highlights?: Array<{
    id?: string;
    title?: FieldOriginMeta;
    description?: FieldOriginMeta;
  }>;
}

export interface PublicAboutUsData {
  isPublished: boolean;
  language?: AboutUsLanguage;
  direction?: 'ltr' | 'rtl';
  content: AboutUsContentSnapshot | null;
  fieldMetadata?: FieldMetadata;
  message?: string;
}

const CMS_HEADER_PATTERNS = [
  /Hero Visual & Main Headlines/i,
  /Primary visual banner/i,
  /Page Title \(Hero Headline\)/i,
  /Introduction & Our Story/i,
  /Comprehensive narrative/i,
  /Mission & Vision/i,
  /Highlights & Achievements/i,
  /Foundational Core Values/i,
];

function cleanFieldText(val?: string | null): string {
  if (!val) return '';
  let str = val.trim();
  for (const pattern of CMS_HEADER_PATTERNS) {
    if (pattern.test(str)) {
      str = str.replace(pattern, '').trim();
    }
  }
  return str;
}

/**
 * Explicitly sanitizes draft state into only the fields permitted by
 * backend updateAboutUsDraftSchema / updateAboutUsTranslationDraftSchema.
 */
export function toDraftUpdatePayload(
  draft: Partial<AboutUsContentSnapshot>,
  language: AboutUsLanguage = 'en'
): AboutUsDraftUpdatePayload {
  const payload: AboutUsDraftUpdatePayload = {
    language,
    title: cleanFieldText(draft.title),
    subtitle: cleanFieldText(draft.subtitle),
    introduction: cleanFieldText(draft.introduction),
    story: cleanFieldText(draft.story),
    mission: cleanFieldText(draft.mission),
    vision: cleanFieldText(draft.vision),
    coreValues: Array.isArray(draft.coreValues)
      ? draft.coreValues.map((v) => ({
          ...(v.id ? { id: v.id } : {}),
          title: cleanFieldText(v.title),
          description: cleanFieldText(v.description),
          ...(language === 'en' ? { icon: v.icon ? v.icon.trim() : null } : {}),
        }))
      : [],
    highlights: Array.isArray(draft.highlights)
      ? draft.highlights.map((h) => ({
          ...(h.id ? { id: h.id } : {}),
          title: cleanFieldText(h.title),
          description: cleanFieldText(h.description),
          ...(language === 'en' ? { metric: cleanFieldText(h.metric) } : {}),
        }))
      : [],
    ctaLabel: cleanFieldText(draft.ctaLabel),
    heroAlt: cleanFieldText(draft.heroAlt),
    storyAlt: cleanFieldText(draft.storyAlt),
  };

  if (language === 'en') {
    payload.ctaUrl = draft.ctaUrl && draft.ctaUrl.trim() ? draft.ctaUrl.trim() : null;
  }

  return payload;
}

export const aboutUsService = {
  // Super Admin: Get complete About Us CMS state
  async getAdminAboutUs(): Promise<AdminAboutUsData> {
    const res = await apiClient.get<{ success: boolean; data: AdminAboutUsData }>(
      '/super-admin/about-us'
    );
    return res.data.data;
  },

  // Super Admin: Update draft snapshot for EN, AR, or TA
  async updateDraft(payload: AboutUsDraftUpdatePayload): Promise<AdminAboutUsData> {
    const res = await apiClient.put<{ success: boolean; data: AdminAboutUsData }>(
      '/super-admin/about-us/draft',
      payload
    );
    return res.data.data;
  },

  // Super Admin: Upload hero image
  async uploadHeroImage(file: File, altText?: string): Promise<AdminAboutUsData> {
    const formData = new FormData();
    formData.append('image', file);
    if (altText) {
      formData.append('altText', altText);
    }
    const res = await apiClient.post<{ success: boolean; data: AdminAboutUsData }>(
      '/super-admin/about-us/hero-image',
      formData
    );
    return res.data.data;
  },

  // Super Admin: Remove draft hero image
  async removeHeroImage(): Promise<AdminAboutUsData> {
    const res = await apiClient.delete<{ success: boolean; data: AdminAboutUsData }>(
      '/super-admin/about-us/hero-image'
    );
    return res.data.data;
  },

  // Super Admin: Upload story image
  async uploadStoryImage(file: File, altText?: string): Promise<AdminAboutUsData> {
    const formData = new FormData();
    formData.append('image', file);
    if (altText) {
      formData.append('altText', altText);
    }
    const res = await apiClient.post<{ success: boolean; data: AdminAboutUsData }>(
      '/super-admin/about-us/story-image',
      formData
    );
    return res.data.data;
  },

  // Super Admin: Remove draft story image
  async removeStoryImage(): Promise<AdminAboutUsData> {
    const res = await apiClient.delete<{ success: boolean; data: AdminAboutUsData }>(
      '/super-admin/about-us/story-image'
    );
    return res.data.data;
  },

  // Super Admin: Publish draft
  async publish(): Promise<AdminAboutUsData> {
    const res = await apiClient.post<{ success: boolean; data: AdminAboutUsData }>(
      '/super-admin/about-us/publish'
    );
    return res.data.data;
  },

  // Super Admin: Unpublish
  async unpublish(): Promise<AdminAboutUsData> {
    const res = await apiClient.post<{ success: boolean; data: AdminAboutUsData }>(
      '/super-admin/about-us/unpublish'
    );
    return res.data.data;
  },

  // Public: Get published About Us (with optional language query and AbortSignal)
  async getPublicAboutUs(
    lang?: AboutUsLanguage,
    options?: { signal?: AbortSignal }
  ): Promise<PublicAboutUsData> {
    const query = lang ? `?lang=${encodeURIComponent(lang)}` : '';
    const res = await apiClient.get<{ success: boolean; data: PublicAboutUsData }>(
      `/public/about-us${query}`,
      { signal: options?.signal }
    );
    return res.data.data;
  },
};
