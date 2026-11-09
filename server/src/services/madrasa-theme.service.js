import prisma from '../lib/prisma.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { themeTokensSchema, analyzeThemeContrast } from '../validations/theme.validation.js';
import { logTenantActivity } from './tenant.service.js';

export const THEME_PRESETS = [
  {
    id: 'classic-green',
    name: 'Classic Islamic Green',
    description: 'Traditional deep emerald green, warm off-white, and refined amber gold.',
    tokens: {
      pageBg: '#fcfbf7',
      navbarBg: '#ffffff',
      heroOverlay: '#064e3b',
      heroOverlayOpacity: 0.88,
      sectionBg: '#ffffff',
      footerBg: '#062e24',
      cardBg: '#ffffff',

      headingColor: '#064e3b',
      sectionHeadingColor: '#0f172a',
      bodyTextColor: '#334155',
      mutedTextColor: '#64748b',
      linkColor: '#047857',
      linkHoverColor: '#065f46',
      heroTextColor: '#ffffff',
      footerTextColor: '#cbd5e1',

      primaryBtnBg: '#047857',
      primaryBtnText: '#ffffff',
      primaryBtnHoverBg: '#065f46',
      secondaryBtnBg: '#f1f5f9',
      secondaryBtnText: '#0f172a',
      secondaryBtnBorder: '#cbd5e1',

      cardBorderColor: '#e2e8f0',
      cardShadowIntensity: 'subtle',
      dividerColor: '#e2e8f0',
      borderRadius: 'xl',

      inputBg: '#ffffff',
      inputBorderColor: '#cbd5e1',
      inputFocusBorder: '#047857',
      inputText: '#0f172a',
      inputPlaceholder: '#94a3b8',
    },
  },
  {
    id: 'ocean-navy',
    name: 'Ocean Navy',
    description: 'Deep maritime navy, oceanic sapphire, and cool crisp white.',
    tokens: {
      pageBg: '#f8fafc',
      navbarBg: '#ffffff',
      heroOverlay: '#0f172a',
      heroOverlayOpacity: 0.90,
      sectionBg: '#ffffff',
      footerBg: '#0b1120',
      cardBg: '#ffffff',

      headingColor: '#0f172a',
      sectionHeadingColor: '#1e293b',
      bodyTextColor: '#334155',
      mutedTextColor: '#64748b',
      linkColor: '#0284c7',
      linkHoverColor: '#0369a1',
      heroTextColor: '#ffffff',
      footerTextColor: '#94a3b8',

      primaryBtnBg: '#0284c7',
      primaryBtnText: '#ffffff',
      primaryBtnHoverBg: '#0369a1',
      secondaryBtnBg: '#f1f5f9',
      secondaryBtnText: '#0f172a',
      secondaryBtnBorder: '#cbd5e1',

      cardBorderColor: '#e2e8f0',
      cardShadowIntensity: 'subtle',
      dividerColor: '#e2e8f0',
      borderRadius: 'xl',

      inputBg: '#ffffff',
      inputBorderColor: '#cbd5e1',
      inputFocusBorder: '#0284c7',
      inputText: '#0f172a',
      inputPlaceholder: '#94a3b8',
    },
  },
  {
    id: 'royal-emerald',
    name: 'Royal Emerald',
    description: 'Jeweled emerald green, antique parchment, and muted gold highlights.',
    tokens: {
      pageBg: '#fafaf9',
      navbarBg: '#ffffff',
      heroOverlay: '#065f46',
      heroOverlayOpacity: 0.88,
      sectionBg: '#ffffff',
      footerBg: '#022c22',
      cardBg: '#ffffff',

      headingColor: '#065f46',
      sectionHeadingColor: '#1c1917',
      bodyTextColor: '#44403c',
      mutedTextColor: '#78716c',
      linkColor: '#059669',
      linkHoverColor: '#047857',
      heroTextColor: '#ffffff',
      footerTextColor: '#d6d3d1',

      primaryBtnBg: '#059669',
      primaryBtnText: '#ffffff',
      primaryBtnHoverBg: '#047857',
      secondaryBtnBg: '#f5f5f4',
      secondaryBtnText: '#1c1917',
      secondaryBtnBorder: '#d6d3d1',

      cardBorderColor: '#e7e5e4',
      cardShadowIntensity: 'medium',
      dividerColor: '#e7e5e4',
      borderRadius: '2xl',

      inputBg: '#ffffff',
      inputBorderColor: '#d6d3d1',
      inputFocusBorder: '#059669',
      inputText: '#1c1917',
      inputPlaceholder: '#a8a29e',
    },
  },
  {
    id: 'warm-sand',
    name: 'Warm Sand',
    description: 'Warm earthen stone, desert sand, and deep espresso timber.',
    tokens: {
      pageBg: '#fdfbf7',
      navbarBg: '#ffffff',
      heroOverlay: '#451a03',
      heroOverlayOpacity: 0.88,
      sectionBg: '#ffffff',
      footerBg: '#291305',
      cardBg: '#ffffff',

      headingColor: '#451a03',
      sectionHeadingColor: '#78350f',
      bodyTextColor: '#44403c',
      mutedTextColor: '#78716c',
      linkColor: '#b45309',
      linkHoverColor: '#92400e',
      heroTextColor: '#ffffff',
      footerTextColor: '#d6d3d1',

      primaryBtnBg: '#b45309',
      primaryBtnText: '#ffffff',
      primaryBtnHoverBg: '#92400e',
      secondaryBtnBg: '#fef3c7',
      secondaryBtnText: '#78350f',
      secondaryBtnBorder: '#fde68a',

      cardBorderColor: '#fde68a',
      cardShadowIntensity: 'subtle',
      dividerColor: '#fde68a',
      borderRadius: 'lg',

      inputBg: '#ffffff',
      inputBorderColor: '#e5e7eb',
      inputFocusBorder: '#b45309',
      inputText: '#1f2937',
      inputPlaceholder: '#9ca3af',
    },
  },
  {
    id: 'minimal-white',
    name: 'Minimal White',
    description: 'Pristine modern white, monochromatic slate, and refined minimalism.',
    tokens: {
      pageBg: '#ffffff',
      navbarBg: '#ffffff',
      heroOverlay: '#1e293b',
      heroOverlayOpacity: 0.85,
      sectionBg: '#f8fafc',
      footerBg: '#0f172a',
      cardBg: '#ffffff',

      headingColor: '#0f172a',
      sectionHeadingColor: '#1e293b',
      bodyTextColor: '#334155',
      mutedTextColor: '#64748b',
      linkColor: '#2563eb',
      linkHoverColor: '#1d4ed8',
      heroTextColor: '#ffffff',
      footerTextColor: '#94a3b8',

      primaryBtnBg: '#0f172a',
      primaryBtnText: '#ffffff',
      primaryBtnHoverBg: '#1e293b',
      secondaryBtnBg: '#f1f5f9',
      secondaryBtnText: '#0f172a',
      secondaryBtnBorder: '#e2e8f0',

      cardBorderColor: '#e2e8f0',
      cardShadowIntensity: 'subtle',
      dividerColor: '#e2e8f0',
      borderRadius: 'md',

      inputBg: '#ffffff',
      inputBorderColor: '#cbd5e1',
      inputFocusBorder: '#0f172a',
      inputText: '#0f172a',
      inputPlaceholder: '#94a3b8',
    },
  },
  {
    id: 'midnight-gold',
    name: 'Midnight Gold',
    description: 'Obsidian charcoal, dark navy canvas, and warm gilded amber.',
    tokens: {
      pageBg: '#090d16',
      navbarBg: '#0f172a',
      heroOverlay: '#090d16',
      heroOverlayOpacity: 0.92,
      sectionBg: '#0f172a',
      footerBg: '#030712',
      cardBg: '#131b2e',

      headingColor: '#f8fafc',
      sectionHeadingColor: '#f1f5f9',
      bodyTextColor: '#cbd5e1',
      mutedTextColor: '#94a3b8',
      linkColor: '#fbbf24',
      linkHoverColor: '#f59e0b',
      heroTextColor: '#ffffff',
      footerTextColor: '#94a3b8',

      primaryBtnBg: '#d97706',
      primaryBtnText: '#ffffff',
      primaryBtnHoverBg: '#b45309',
      secondaryBtnBg: '#1e293b',
      secondaryBtnText: '#f8fafc',
      secondaryBtnBorder: '#334155',

      cardBorderColor: '#1e293b',
      cardShadowIntensity: 'medium',
      dividerColor: '#1e293b',
      borderRadius: 'xl',

      inputBg: '#0f172a',
      inputBorderColor: '#334155',
      inputFocusBorder: '#d97706',
      inputText: '#f8fafc',
      inputPlaceholder: '#64748b',
    },
  },
];

export const DEFAULT_THEME_TOKENS = {
  pageBg: '#ffffff',
  navbarBg: '#ffffff',
  heroOverlay: '#504F34',
  heroOverlayOpacity: 0.90,
  sectionBg: '#ffffff',
  footerBg: '#504F34',
  cardBg: '#ffffff',

  headingColor: '#252525',
  sectionHeadingColor: '#252525',
  bodyTextColor: '#252525',
  mutedTextColor: '#666666',
  linkColor: '#504F34',
  linkHoverColor: '#363522',
  heroTextColor: '#ffffff',
  footerTextColor: '#f5f5f1',

  primaryBtnBg: '#504F34',
  primaryBtnText: '#ffffff',
  primaryBtnHoverBg: '#3d3c27',
  secondaryBtnBg: '#ffffff',
  secondaryBtnText: '#252525',
  secondaryBtnBorder: '#a5a477',

  cardBorderColor: '#e5e5df',
  cardShadowIntensity: 'subtle',
  dividerColor: '#e5e5df',
  borderRadius: 'xl',

  inputBg: '#ffffff',
  inputBorderColor: '#e5e5df',
  inputFocusBorder: '#504F34',
  inputText: '#252525',
  inputPlaceholder: '#666666',
};

/**
 * Retrieves the theme settings (draft, published, defaults, presets) for a tenant.
 */
export async function getPortalTheme(madrasaId) {
  const profile = await prisma.madrasaProfile.findUnique({
    where: { madrasaId },
    select: {
      id: true,
      isPublished: true,
      themeDraftJson: true,
      themePublishedJson: true,
    },
  });

  if (!profile) {
    throw new NotFoundError('Madrasa profile not found.');
  }

  const normalizeLegacyDefault = (tokens) => {
    if (!tokens || typeof tokens !== 'object') return tokens;
    if (tokens.pageBg && String(tokens.pageBg).toLowerCase() === '#f7f6f0') {
      return {
        ...tokens,
        pageBg: '#ffffff',
        navbarBg: '#ffffff',
      };
    }
    return tokens;
  };

  const rawDraft = profile.themeDraftJson || profile.themePublishedJson || DEFAULT_THEME_TOKENS;
  const rawPublished = profile.themePublishedJson || null;
  const draft = normalizeLegacyDefault(rawDraft);
  const published = normalizeLegacyDefault(rawPublished);
  const contrastAnalysis = analyzeThemeContrast(draft);

  return {
    draft,
    published,
    defaultTheme: DEFAULT_THEME_TOKENS,
    presets: THEME_PRESETS,
    isPublished: profile.isPublished,
    contrastAnalysis,
  };
}

/**
 * Saves draft theme customization for the Madrasa.
 */
export async function saveDraftTheme(madrasaId, rawTokens, userId = null) {
  const validatedTokens = themeTokensSchema.parse(rawTokens);

  const profile = await prisma.madrasaProfile.findUnique({
    where: { madrasaId },
    select: { id: true },
  });

  if (!profile) {
    throw new NotFoundError('Madrasa profile not found.');
  }

  const updated = await prisma.madrasaProfile.update({
    where: { id: profile.id },
    data: {
      themeDraftJson: validatedTokens,
    },
    select: {
      id: true,
      themeDraftJson: true,
      themePublishedJson: true,
    },
  });

  if (userId) {
    await logTenantActivity({
      madrasaId,
      userId,
      action: 'SAVE_PORTAL_THEME_DRAFT',
      details: 'Updated theme draft settings.',
    });
  }

  const contrastAnalysis = analyzeThemeContrast(updated.themeDraftJson);

  return {
    draft: updated.themeDraftJson,
    published: updated.themePublishedJson,
    contrastAnalysis,
  };
}

/**
 * Publishes the theme to public visitors.
 * Atomically copies draft (or supplied tokens) to themePublishedJson.
 */
export async function publishTheme(madrasaId, rawTokens = null, userId = null) {
  const profile = await prisma.madrasaProfile.findUnique({
    where: { madrasaId },
    select: { id: true, themeDraftJson: true },
  });

  if (!profile) {
    throw new NotFoundError('Madrasa profile not found.');
  }

  const tokensToPublish = rawTokens
    ? themeTokensSchema.parse(rawTokens)
    : profile.themeDraftJson || DEFAULT_THEME_TOKENS;

  const updated = await prisma.madrasaProfile.update({
    where: { id: profile.id },
    data: {
      themeDraftJson: tokensToPublish,
      themePublishedJson: tokensToPublish,
    },
    select: {
      id: true,
      themeDraftJson: true,
      themePublishedJson: true,
    },
  });

  if (userId) {
    await logTenantActivity({
      madrasaId,
      userId,
      action: 'PUBLISH_PORTAL_THEME',
      details: 'Published theme customization to public website.',
    });
  }

  const contrastAnalysis = analyzeThemeContrast(updated.themePublishedJson);

  return {
    draft: updated.themeDraftJson,
    published: updated.themePublishedJson,
    contrastAnalysis,
  };
}

/**
 * Resets draft theme back to default.
 */
export async function resetThemeToDefault(madrasaId, userId = null) {
  const profile = await prisma.madrasaProfile.findUnique({
    where: { madrasaId },
    select: { id: true },
  });

  if (!profile) {
    throw new NotFoundError('Madrasa profile not found.');
  }

  const updated = await prisma.madrasaProfile.update({
    where: { id: profile.id },
    data: {
      themeDraftJson: DEFAULT_THEME_TOKENS,
    },
    select: {
      id: true,
      themeDraftJson: true,
      themePublishedJson: true,
    },
  });

  if (userId) {
    await logTenantActivity({
      madrasaId,
      userId,
      action: 'RESET_PORTAL_THEME_DRAFT',
      details: 'Reset theme draft to system default.',
    });
  }

  return {
    draft: updated.themeDraftJson,
    published: updated.themePublishedJson,
    contrastAnalysis: analyzeThemeContrast(updated.themeDraftJson),
  };
}

/**
 * Reverts unsaved draft changes back to the currently published theme.
 */
export async function discardDraftChanges(madrasaId) {
  const profile = await prisma.madrasaProfile.findUnique({
    where: { madrasaId },
    select: { id: true, themePublishedJson: true },
  });

  if (!profile) {
    throw new NotFoundError('Madrasa profile not found.');
  }

  const fallback = profile.themePublishedJson || DEFAULT_THEME_TOKENS;

  const updated = await prisma.madrasaProfile.update({
    where: { id: profile.id },
    data: {
      themeDraftJson: fallback,
    },
    select: {
      id: true,
      themeDraftJson: true,
      themePublishedJson: true,
    },
  });

  return {
    draft: updated.themeDraftJson,
    published: updated.themePublishedJson,
    contrastAnalysis: analyzeThemeContrast(updated.themeDraftJson),
  };
}
