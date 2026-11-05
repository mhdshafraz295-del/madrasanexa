import { z } from 'zod';

const HEX_COLOR_REGEX = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

const hexColor = (label) =>
  z
    .string({ required_error: `${label} is required.` })
    .regex(HEX_COLOR_REGEX, `${label} must be a valid hexadecimal color (e.g. #047857 or #fff)`)
    .transform((val) => val.trim().toLowerCase());

export const themeTokensSchema = z
  .object({
    // Page & Backgrounds
    pageBg: hexColor('Page Background'),
    navbarBg: hexColor('Navbar Background'),
    heroOverlay: hexColor('Hero Overlay Color'),
    heroOverlayOpacity: z.coerce.number().min(0.2).max(1.0).default(0.88),
    sectionBg: hexColor('Section Background'),
    footerBg: hexColor('Footer Background'),
    cardBg: hexColor('Card Background'),

    // Typography
    headingColor: hexColor('Heading Color'),
    sectionHeadingColor: hexColor('Section Heading Color'),
    bodyTextColor: hexColor('Body Text Color'),
    mutedTextColor: hexColor('Muted Text Color'),
    linkColor: hexColor('Link Color'),
    linkHoverColor: hexColor('Link Hover Color'),
    heroTextColor: hexColor('Hero Text Color'),
    footerTextColor: hexColor('Footer Text Color'),

    // Buttons
    primaryBtnBg: hexColor('Primary Button Background'),
    primaryBtnText: hexColor('Primary Button Text'),
    primaryBtnHoverBg: hexColor('Primary Button Hover Background'),
    secondaryBtnBg: hexColor('Secondary Button Background'),
    secondaryBtnText: hexColor('Secondary Button Text'),
    secondaryBtnBorder: hexColor('Secondary Button Border'),

    // Cards, Borders & Dividers
    cardBorderColor: hexColor('Card Border Color'),
    cardShadowIntensity: z.enum(['none', 'subtle', 'medium', 'prominent']).default('subtle'),
    dividerColor: hexColor('Divider Color'),
    borderRadius: z.enum(['sm', 'md', 'lg', 'xl', '2xl']).default('xl'),

    // Form Controls
    inputBg: hexColor('Input Background'),
    inputBorderColor: hexColor('Input Border Color'),
    inputFocusBorder: hexColor('Input Focus Ring Color'),
    inputText: hexColor('Input Text Color'),
    inputPlaceholder: hexColor('Input Placeholder Color'),
  })
  .strict();

/**
 * Calculates relative luminance according to WCAG 2.1 specs.
 */
function getLuminance(hex) {
  let cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map((c) => c + c).join('');
  }
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  const a = [r, g, b].map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

/**
 * Computes contrast ratio between two hex colors.
 * Returns a ratio between 1 and 21.
 */
export function calculateContrastRatio(hex1, hex2) {
  try {
    const l1 = getLuminance(hex1);
    const l2 = getLuminance(hex2);
    const brightest = Math.max(l1, l2);
    const darkest = Math.min(l1, l2);
    return Number(((brightest + 0.05) / (darkest + 0.05)).toFixed(2));
  } catch {
    return 1;
  }
}

/**
 * Analyzes contrast compliance for all critical text and background pairs in a theme.
 */
export function analyzeThemeContrast(theme) {
  if (!theme) return { isAccessible: true, warnings: [] };

  const pairs = [
    {
      name: 'Primary Button',
      fg: theme.primaryBtnText,
      bg: theme.primaryBtnBg,
      target: 4.5,
      role: 'Button Text',
    },
    {
      name: 'Secondary Button',
      fg: theme.secondaryBtnText,
      bg: theme.secondaryBtnBg,
      target: 4.5,
      role: 'Button Text',
    },
    {
      name: 'Body Text on Page',
      fg: theme.bodyTextColor,
      bg: theme.pageBg,
      target: 4.5,
      role: 'Page Content',
    },
    {
      name: 'Headings on Page',
      fg: theme.headingColor,
      bg: theme.pageBg,
      target: 4.5,
      role: 'Headings',
    },
    {
      name: 'Body Text on Cards',
      fg: theme.bodyTextColor,
      bg: theme.cardBg,
      target: 4.5,
      role: 'Card Text',
    },
    {
      name: 'Hero Text on Overlay',
      fg: theme.heroTextColor,
      bg: theme.heroOverlay,
      target: 3.0,
      role: 'Hero Title',
    },
    {
      name: 'Footer Text on Footer',
      fg: theme.footerTextColor,
      bg: theme.footerBg,
      target: 4.5,
      role: 'Footer',
    },
    {
      name: 'Input Text on Input Background',
      fg: theme.inputText,
      bg: theme.inputBg,
      target: 4.5,
      role: 'Form Input',
    },
  ];

  const warnings = [];

  for (const pair of pairs) {
    if (!pair.fg || !pair.bg) continue;
    const ratio = calculateContrastRatio(pair.fg, pair.bg);
    if (ratio < pair.target) {
      // Suggest accessible alternative
      const isBgDark = getLuminance(pair.bg) < 0.5;
      const suggestedFg = isBgDark ? '#ffffff' : '#0f172a';
      warnings.push({
        element: pair.name,
        role: pair.role,
        contrastRatio: ratio,
        targetRatio: pair.target,
        fg: pair.fg,
        bg: pair.bg,
        message: `${pair.name} has low contrast (${ratio}:1, target is ${pair.target}:1).`,
        suggestedFg,
      });
    }
  }

  return {
    isAccessible: warnings.length === 0,
    warnings,
  };
}
