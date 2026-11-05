import type { MadrasaThemeTokens } from '../../services/api';

/**
 * MadrasaNexa — Canonical ACJU-Inspired Olive & White Institutional Default Theme Tokens.
 * Synchronized with backend DEFAULT_THEME_TOKENS.
 */
export const DEFAULT_PUBLIC_THEME: MadrasaThemeTokens = {
  // Page & Backgrounds
  pageBg: '#ffffff',              // Pure White matching navbar & public canvas
  navbarBg: '#ffffff',            // Pure White
  heroOverlay: '#85845C',         // Dark Olive
  heroOverlayOpacity: 0.90,
  sectionBg: '#ffffff',           // Pure White
  footerBg: '#504F34',            // Deep Institutional Olive
  cardBg: '#ffffff',              // Pure White

  // Typography
  headingColor: '#252525',        // Charcoal
  sectionHeadingColor: '#252525', // Charcoal
  bodyTextColor: '#252525',       // Charcoal
  mutedTextColor: '#666666',      // Muted Text
  linkColor: '#E56A45',           // Terracotta Read More & Accents
  linkHoverColor: '#85845C',      // Dark Olive
  heroTextColor: '#ffffff',       // Pure White
  footerTextColor: '#F5F5F1',     // Soft Ivory

  // Buttons
  primaryBtnBg: '#85845C',        // Dark Olive
  primaryBtnText: '#ffffff',
  primaryBtnHoverBg: '#6B6A45',   // Slightly darker olive
  secondaryBtnBg: '#ffffff',      // Pure White
  secondaryBtnText: '#85845C',    // Dark Olive
  secondaryBtnBorder: '#A5A477',  // Primary Olive

  // Cards & Borders
  cardBorderColor: '#E5E5DF',     // Soft Border
  cardShadowIntensity: 'subtle',
  dividerColor: '#E5E5DF',        // Soft Border
  borderRadius: 'xl',

  // Form Controls
  inputBg: '#ffffff',
  inputBorderColor: '#E5E5DF',
  inputFocusBorder: '#85845C',
  inputText: '#252525',
  inputPlaceholder: '#666666',
};

/**
 * Resolves the effective theme tokens for a public madrasa portal:
 * 1. If the madrasa has a valid published custom theme, merge it with defaults (ensures no missing keys).
 * 2. If no published custom theme exists, render the canonical Premium Islamic Emerald + Gold default.
 */
export function resolvePublicTheme(publishedTheme?: MadrasaThemeTokens | null): MadrasaThemeTokens {
  if (!publishedTheme) {
    return DEFAULT_PUBLIC_THEME;
  }
  const merged: MadrasaThemeTokens = {
    ...DEFAULT_PUBLIC_THEME,
    ...publishedTheme,
  };

  // If the stored theme still has the legacy warm ivory background '#f7f6f0',
  // map it to the pure white '#ffffff' matching the Statistics Cards.
  if (merged.pageBg && merged.pageBg.toLowerCase() === '#f7f6f0') {
    merged.pageBg = '#ffffff';
  }

  // Ensure navbar background always matches the active page background
  if (!merged.navbarBg || merged.navbarBg.toLowerCase() === '#f7f6f0') {
    merged.navbarBg = merged.pageBg || '#ffffff';
  }

  return merged;
}
