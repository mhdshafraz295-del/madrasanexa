import { apiClient } from './api';

export interface PlanData {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  price: number | string;
  originalPrice?: number | string | null;
  isSpecialOffer?: boolean;
  specialOfferLabel?: string | null;
  durationMonths: number;
  isActive: boolean;
}

export interface HeroData {
  eyebrow?: string | null;
  title: string;
  highlightedText?: string | null;
  description?: string | null;
  primaryCtaLabel: string;
  primaryCtaUrl: string;
  secondaryCtaLabel: string;
  secondaryCtaUrl: string;
  enabled: boolean;
}

export interface TrustItem {
  id: string;
  text: string;
  icon: string;
  enabled: boolean;
}

export interface FeatureItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  sortOrder: number;
  enabled: boolean;
  imageFileId?: string | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
  imageCaption?: string | null;
}

export interface ProductPreviewMedia {
  enabled: boolean;
  fileId?: string | null;
  url?: string | null;
  alt: string;
  caption?: string | null;
  originalName?: string;
  size?: number;
}

export interface HowItWorksItem {
  id: string;
  step: number;
  title: string;
  description: string;
  enabled: boolean;
}

export interface SecurityItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  enabled: boolean;
}

export interface SecuritySectionData {
  heading?: string | null;
  description?: string | null;
  items?: SecurityItem[] | null;
  enabled: boolean;
}

export interface CtaData {
  heading: string;
  description?: string | null;
  primaryCtaLabel: string;
  primaryCtaUrl: string;
  secondaryCtaLabel: string;
  secondaryCtaUrl: string;
  enabled: boolean;
}

export interface ContactData {
  headline?: string | null;
  description?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  officeHours?: string | null;
  enabled: boolean;
}

export interface QuickLink {
  label: string;
  url: string;
}

export interface FooterData {
  platformDescription?: string | null;
  copyrightText?: string | null;
  quickLinks?: QuickLink[] | null;
}

export interface SeoData {
  metaTitle?: string | null;
  metaDescription?: string | null;
  ogTitle?: string | null;
  ogDescription?: string | null;
}

export interface HeroMediaItem {
  id: string;
  fileId: string;
  url?: string;
  publicUrl?: string;
  alt: string;
  caption?: string | null;
  enabled: boolean;
  sortOrder: number;
  originalName?: string;
  fileName?: string;
  size?: number;
  fileSize?: number;
}

export interface HeroMediaSection {
  enabled: boolean;
  autoplay: boolean;
  autoplayInterval: number;
  items: HeroMediaItem[];
}

export interface WhatsAppSection {
  enabled: boolean;
  number: string;
  defaultMessage: string;
}

export interface HomepageContentSnapshot {
  hero: HeroData;
  heroMedia?: HeroMediaSection;
  productPreviewMedia?: ProductPreviewMedia;
  trustStrip: TrustItem[];
  features: FeatureItem[];
  howItWorks: HowItWorksItem[];
  security: SecuritySectionData;
  cta: CtaData;
  contact: ContactData;
  whatsapp?: WhatsAppSection;
  footer: FooterData;
  seo: SeoData;
}

export interface PublicHomepageResponse {
  isPublished: boolean;
  status: 'DRAFT' | 'PUBLISHED' | 'UNPUBLISHED';
  publishedAt?: string | null;
  content: HomepageContentSnapshot | null;
  plans: PlanData[];
  aboutUs: any | null;
}

export interface AdminHomepageDraftResponse {
  id: string;
  status: 'DRAFT' | 'PUBLISHED' | 'UNPUBLISHED';
  draftContent: HomepageContentSnapshot;
  publishedContent: HomepageContentSnapshot | null;
  publishedAt?: string | null;
  publishedById?: string | null;
  createdAt: string;
  updatedAt: string;
  activePlansCount: number;
}

/**
 * Normalizes an international phone number string to purely digits for wa.me URL.
 */
export function normalizeWhatsAppNumber(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  return raw.replace(/[^0-9]/g, '');
}

/**
 * Public: Fetch published homepage content, active plans, and about us
 */
export async function apiGetPublicHomepage(): Promise<PublicHomepageResponse> {
  const res = await apiClient.get<{ success: boolean; data: PublicHomepageResponse }>('/public/homepage');
  return res.data.data;
}

/**
 * Super Admin: Fetch homepage draft and current status
 */
export async function apiGetAdminHomepageDraft(): Promise<AdminHomepageDraftResponse> {
  const res = await apiClient.get<{ success: boolean; data: AdminHomepageDraftResponse }>(
    '/super-admin/website-content/homepage'
  );
  return res.data.data;
}

/**
 * Super Admin: Update homepage draft
 */
export async function apiUpdateHomepageDraft(
  payload: Partial<HomepageContentSnapshot>
): Promise<{ status: string; draftContent: HomepageContentSnapshot; updatedAt: string }> {
  const res = await apiClient.put<{
    success: boolean;
    message: string;
    data: { status: string; draftContent: HomepageContentSnapshot; updatedAt: string };
  }>('/super-admin/website-content/homepage', payload);
  return res.data.data;
}

/**
 * Super Admin: Publish homepage draft
 */
export async function apiPublishHomepage(): Promise<{
  status: string;
  publishedAt: string;
  publishedContent: HomepageContentSnapshot;
}> {
  const res = await apiClient.post<{
    success: boolean;
    message: string;
    data: { status: string; publishedAt: string; publishedContent: HomepageContentSnapshot };
  }>('/super-admin/website-content/homepage/publish');
  return res.data.data;
}

/**
 * Super Admin: Unpublish homepage
 */
export async function apiUnpublishHomepage(): Promise<{ status: string; updatedAt: string }> {
  const res = await apiClient.post<{
    success: boolean;
    message: string;
    data: { status: string; updatedAt: string };
  }>('/super-admin/website-content/homepage/unpublish');
  return res.data.data;
}

export interface UploadedHomepageImage {
  id: string;
  fileId: string;
  url: string;
  publicUrl?: string;
  originalName: string;
  fileName?: string;
  size: number;
  mimeType?: string;
}

/**
 * Super Admin: Upload images for homepage sections (hero, product-preview, features)
 */
export async function apiUploadHomepageImages(
  files: FileList | File[] | FormData,
  section: 'hero' | 'product-preview' | 'features' = 'hero'
): Promise<UploadedHomepageImage[]> {
  let body: FormData;
  if (files instanceof FormData) {
    body = files;
  } else {
    body = new FormData();
    const fileArray = Array.from(files);
    for (const f of fileArray) {
      body.append('images', f);
    }
  }

  if (!body.has('section')) {
    body.append('section', section);
  }

  const res = await apiClient.post<{
    success: boolean;
    message: string;
    data: UploadedHomepageImage[];
  }>(`/super-admin/website-content/homepage/images?section=${encodeURIComponent(section)}`, body, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.data;
}

/**
 * Super Admin: Remove image from storage (only when unreferenced)
 */
export async function apiDeleteHomepageImage(
  fileId: string
): Promise<{ success: boolean; message: string }> {
  const res = await apiClient.delete<{ success: boolean; data: { success: boolean; message: string } }>(
    `/super-admin/website-content/homepage/images/${fileId}`
  );
  return res.data.data;
}
