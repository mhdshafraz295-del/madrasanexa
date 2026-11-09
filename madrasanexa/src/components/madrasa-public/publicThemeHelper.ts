import type { MadrasaThemeTokens } from '../../services/api';

/**
 * MadrasaNexa — Canonical ACJU-Inspired Olive & White Institutional Default Theme Tokens.
 * Synchronized with backend DEFAULT_THEME_TOKENS.
 */
export const DEFAULT_PUBLIC_THEME: MadrasaThemeTokens = {
  // Page & Backgrounds
  pageBg: '#ffffff',              // Pure White matching navbar & public canvas
  navbarBg: '#ffffff',            // Pure White
  heroOverlay: '#504F34',         // Institutional Deep Olive
  heroOverlayOpacity: 0.90,
  sectionBg: '#ffffff',           // Pure White
  footerBg: '#504F34',            // Deep Institutional Olive
  cardBg: '#ffffff',              // Pure White

  // Typography
  headingColor: '#252525',        // Charcoal
  sectionHeadingColor: '#252525', // Charcoal
  bodyTextColor: '#252525',       // Charcoal
  mutedTextColor: '#666666',      // Muted Text
  linkColor: '#504F34',           // Deep Olive
  linkHoverColor: '#363522',      // Darker Olive
  heroTextColor: '#ffffff',       // Pure White
  footerTextColor: '#f5f5f1',     // Soft Ivory

  // Buttons
  primaryBtnBg: '#504F34',        // Deep Institutional Olive
  primaryBtnText: '#ffffff',
  primaryBtnHoverBg: '#3d3c27',   // Darker Olive Hover
  secondaryBtnBg: '#ffffff',      // Pure White
  secondaryBtnText: '#252525',    // Charcoal
  secondaryBtnBorder: '#a5a477',  // Primary Olive

  // Cards & Borders
  cardBorderColor: '#e5e5df',     // Soft Border
  cardShadowIntensity: 'subtle',
  dividerColor: '#e5e5df',        // Soft Border
  borderRadius: 'xl',

  // Form Controls
  inputBg: '#ffffff',
  inputBorderColor: '#e5e5df',
  inputFocusBorder: '#504F34',
  inputText: '#252525',
  inputPlaceholder: '#666666',
};

/**
 * Resolves the effective theme tokens for a public madrasa portal:
 * 1. If the madrasa has a valid published custom theme, merge it with defaults (ensures no missing keys).
 * 2. If no published custom theme exists, render the canonical Institutional Olive & White default.
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
