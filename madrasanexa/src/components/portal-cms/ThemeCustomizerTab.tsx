import React, { useState, useEffect, useMemo } from 'react';
import {
  apiGetPortalTheme,
  apiSaveDraftTheme,
  apiPublishTheme,
  apiResetTheme,
  apiDiscardTheme,
  type MadrasaThemeTokens,
  type ThemePreset,
  type ContrastWarning,
} from '../../services/api';
import {
  Palette,
  Monitor,
  Tablet,
  Smartphone,
  Save,
  ShieldCheck,
  RotateCcw,
  Undo2,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Layers,
  Type,
  Layout,
  MousePointerClick,
  CreditCard,
  FormInput,
  Check,
} from 'lucide-react';

interface ThemeCustomizerTabProps {
  institutionName?: string;
  institutionLogoUrl?: string | null;
  heroImageUrl?: string | null;
}

// Client-side WCAG 2.1 AA luminance and contrast helper
function parseRgb(hex: string): { r: number; g: number; b: number } | null {
  if (!hex || typeof hex !== 'string') return null;
  let clean = hex.trim().replace(/^#/, '');
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  if (clean.length !== 6) return null;
  const num = parseInt(clean, 16);
  if (isNaN(num)) return null;
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function getRelativeLuminance(hex: string): number {
  const rgb = parseRgb(hex);
  if (!rgb) return 0;
  const srgb = [rgb.r, rgb.g, rgb.b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

function calculateContrastRatio(hex1: string, hex2: string): number {
  const l1 = getRelativeLuminance(hex1);
  const l2 = getRelativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}

export const ThemeCustomizerTab: React.FC<ThemeCustomizerTabProps> = ({
  institutionName = 'Madrasa Institution',
  institutionLogoUrl = null,
  heroImageUrl = null,
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [presets, setPresets] = useState<ThemePreset[]>([]);
  const [draftTokens, setDraftTokens] = useState<MadrasaThemeTokens | null>(null);
  const [publishedTokens, setPublishedTokens] = useState<MadrasaThemeTokens | null>(null);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Responsive device view: 'desktop' | 'tablet' | 'mobile'
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');

  // Accordion collapsed state for token groups
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    backgrounds: true,
    typography: true,
    hero: true,
    buttons: true,
    cards: false,
    inputs: false,
  });

  const toggleGroup = (group: string) => {
    setOpenGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  // Fetch initial theme state
  useEffect(() => {
    let mounted = true;
    const fetchTheme = async () => {
      try {
        setLoading(true);
        const data = await apiGetPortalTheme();
        if (mounted) {
          setDraftTokens(data.draft);
          setPublishedTokens(data.published);
          setPresets(data.presets);

          // Identify matching preset
          const match = data.presets.find(
            (p) => JSON.stringify(p.tokens) === JSON.stringify(data.draft)
          );
          if (match) setActivePresetId(match.id);
        }
      } catch (err: any) {
        if (mounted) {
          setFeedback({
            type: 'error',
            message: err.response?.data?.message || 'Failed to load portal theme configuration.',
          });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchTheme();
    return () => {
      mounted = false;
    };
  }, []);

  // Compute live client-side contrast warnings using canonical tokens
  const contrastWarnings = useMemo(() => {
    if (!draftTokens) return [];
    const checks: {
      fgToken: keyof MadrasaThemeTokens;
      bgToken: keyof MadrasaThemeTokens;
      element: string;
      role: string;
      target: number;
    }[] = [
      { fgToken: 'primaryBtnText', bgToken: 'primaryBtnBg', element: 'Primary Button', role: 'Button Text', target: 4.5 },
      { fgToken: 'secondaryBtnText', bgToken: 'secondaryBtnBg', element: 'Secondary Button', role: 'Button Text', target: 4.5 },
      { fgToken: 'bodyTextColor', bgToken: 'pageBg', element: 'Body Text on Page', role: 'Page Content', target: 4.5 },
      { fgToken: 'headingColor', bgToken: 'pageBg', element: 'Headings on Page', role: 'Headings', target: 4.5 },
      { fgToken: 'bodyTextColor', bgToken: 'cardBg', element: 'Body Text on Cards', role: 'Card Text', target: 4.5 },
      { fgToken: 'heroTextColor', bgToken: 'heroOverlay', element: 'Hero Text on Overlay', role: 'Hero Title', target: 3.0 },
      { fgToken: 'footerTextColor', bgToken: 'footerBg', element: 'Footer Text on Footer', role: 'Footer', target: 4.5 },
      { fgToken: 'inputText', bgToken: 'inputBg', element: 'Input Text on Input Background', role: 'Form Input', target: 4.5 },
    ];

    const warnings: ContrastWarning[] = [];
    for (const ch of checks) {
      const fg = String(draftTokens[ch.fgToken] || '');
      const bg = String(draftTokens[ch.bgToken] || '');
      if (!fg.startsWith('#') || !bg.startsWith('#')) continue;
      const ratio = calculateContrastRatio(fg, bg);
      if (ratio < ch.target) {
        const bgLum = getRelativeLuminance(bg);
        const suggested = bgLum < 0.5 ? '#ffffff' : '#0f172a';
        warnings.push({
          element: ch.element,
          role: ch.role,
          contrastRatio: ratio,
          targetRatio: ch.target,
          fg,
          bg,
          message: `${ch.element} has low contrast (${ratio}:1, target is ${ch.target}:1).`,
          suggestedFg: suggested,
        });
      }
    }
    return warnings;
  }, [draftTokens]);

  const handleTokenChange = (key: keyof MadrasaThemeTokens, val: string) => {
    if (!draftTokens) return;
    setDraftTokens({
      ...draftTokens,
      [key]: val,
    });
    setActivePresetId(null);
  };

  const handleApplyPreset = (preset: ThemePreset) => {
    setDraftTokens({ ...preset.tokens });
    setActivePresetId(preset.id);
    setFeedback({
      type: 'success',
      message: `Preset "${preset.name}" applied to draft. Click "Save Draft" or "Publish Theme" to apply.`,
    });
  };

  const handleSuggestShade = (warning: ContrastWarning) => {
    if (!warning.suggestedFg || !draftTokens) return;
    // Map element to fgToken
    let targetKey: keyof MadrasaThemeTokens = 'bodyTextColor';
    if (warning.element === 'Primary Button') targetKey = 'primaryBtnText';
    else if (warning.element === 'Secondary Button') targetKey = 'secondaryBtnText';
    else if (warning.element === 'Headings on Page') targetKey = 'headingColor';
    else if (warning.element === 'Hero Text on Overlay') targetKey = 'heroTextColor';
    else if (warning.element === 'Footer Text on Footer') targetKey = 'footerTextColor';
    else if (warning.element === 'Input Text on Input Background') targetKey = 'inputText';
    else targetKey = 'bodyTextColor';

    setDraftTokens({
      ...draftTokens,
      [targetKey]: warning.suggestedFg,
    });
  };

  const handleSaveDraft = async () => {
    if (!draftTokens) return;
    try {
      setSaving(true);
      setFeedback(null);
      const res = await apiSaveDraftTheme(draftTokens);
      setDraftTokens(res.draft);
      setFeedback({
        type: 'success',
        message: 'Theme draft saved successfully. Changes remain private until published.',
      });
    } catch (err: any) {
      const errMsg =
        err.response?.data?.errors?.[0]?.message ||
        err.response?.data?.message ||
        'Failed to save theme draft.';
      setFeedback({
        type: 'error',
        message: errMsg,
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!draftTokens) return;
    try {
      setPublishing(true);
      setFeedback(null);
      const res = await apiPublishTheme(draftTokens);
      setPublishedTokens(res.published);
      setDraftTokens(res.published);
      setFeedback({
        type: 'success',
        message: 'Theme published successfully! Public visitors will now see these colors immediately.',
      });
    } catch (err: any) {
      const errMsg =
        err.response?.data?.errors?.[0]?.message ||
        err.response?.data?.message ||
        'Failed to publish theme.';
      setFeedback({
        type: 'error',
        message: errMsg,
      });
    } finally {
      setPublishing(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Reset theme draft to the standard Classic Islamic Green palette?')) return;
    try {
      setActionLoading(true);
      setFeedback(null);
      const res = await apiResetTheme();
      setDraftTokens(res.draft);
      setActivePresetId('classic-green');
      setFeedback({
        type: 'success',
        message: 'Theme reset to default Classic Islamic Green draft.',
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to reset theme.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDiscard = async () => {
    if (!window.confirm('Discard unsaved draft changes and revert to the published theme?')) return;
    try {
      setActionLoading(true);
      setFeedback(null);
      const res = await apiDiscardTheme();
      setDraftTokens(res.draft);
      setFeedback({
        type: 'success',
        message: 'Draft reverted back to the currently published theme.',
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to discard draft changes.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading || !draftTokens) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-sm">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm font-medium text-slate-500">Loading Theme & Appearance settings...</p>
      </div>
    );
  }

  // Token input helper component
  const ColorPickerField = ({
    label,
    tokenKey,
    description,
  }: {
    label: string;
    tokenKey: keyof MadrasaThemeTokens;
    description?: string;
  }) => {
    const val = String(draftTokens[tokenKey] || '');
    return (
      <div className="space-y-1.5 p-3 rounded-xl bg-slate-50/70 border border-slate-200/60 transition hover:border-slate-300">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-800 tracking-tight">{label}</label>
          <span className="text-[10px] font-mono text-slate-500 uppercase">{val}</span>
        </div>
        {description && <p className="text-[11px] text-slate-500 leading-tight">{description}</p>}
        <div className="flex items-center space-x-2 pt-0.5">
          <div className="relative shrink-0">
            <input
              type="color"
              value={val.startsWith('#') && val.length === 7 ? val : '#000000'}
              onChange={(e) => handleTokenChange(tokenKey, e.target.value)}
              className="w-8 h-8 rounded-lg cursor-pointer border border-slate-300 p-0 overflow-hidden bg-transparent"
              title={`Choose color for ${label}`}
            />
          </div>
          <input
            type="text"
            value={val}
            maxLength={7}
            onChange={(e) => handleTokenChange(tokenKey, e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-mono uppercase bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
            placeholder="#000000"
          />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Card: Title, Status, and Action Controls */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <Palette className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <span>Theme & Appearance Customizer</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      publishedTokens
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}
                  >
                    {publishedTokens ? 'Published Theme Active' : 'Default Palette (Unpublished)'}
                  </span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Customize your institution's public colors, headers, buttons, cards, and admissions portal styling.
                </p>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={actionLoading || saving || publishing}
              onClick={handleDiscard}
              className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition-colors border border-slate-200 disabled:opacity-50"
              title="Discard draft changes and revert to last published theme"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>Discard Draft</span>
            </button>

            <button
              type="button"
              disabled={actionLoading || saving || publishing}
              onClick={handleReset}
              className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition-colors border border-slate-200 disabled:opacity-50"
              title="Reset draft to standard Classic Islamic Green preset"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Default</span>
            </button>

            <button
              type="button"
              disabled={saving || publishing || actionLoading}
              onClick={handleSaveDraft}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition-colors shadow-sm disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Save Draft'}</span>
            </button>

            <button
              type="button"
              disabled={publishing || saving || actionLoading}
              onClick={handlePublish}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white transition-colors shadow-sm disabled:opacity-50"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{publishing ? 'Publishing...' : 'Publish Theme'}</span>
            </button>
          </div>
        </div>

        {/* Feedback Message */}
        {feedback && (
          <div
            className={`mt-4 p-3.5 rounded-xl text-xs flex items-start space-x-2.5 ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            )}
            <span className="font-medium leading-relaxed">{feedback.message}</span>
          </div>
        )}
      </div>

      {/* WCAG AA Accessibility Contrast Feedback */}
      {contrastWarnings.length > 0 ? (
        <div className="bg-amber-50/80 rounded-2xl border border-amber-200 p-5 space-y-3">
          <div className="flex items-center space-x-2 text-amber-800">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <h3 className="text-xs font-bold uppercase tracking-wider">
              WCAG 2.1 AA Contrast Advisory ({contrastWarnings.length} failing combination{contrastWarnings.length > 1 ? 's' : ''})
            </h3>
          </div>
          <p className="text-xs text-amber-700 leading-relaxed">
            The color combinations below may be difficult for visitors to read. We recommend adjusting them or clicking <strong>"Fix Shade"</strong> to automatically satisfy accessibility guidelines.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {contrastWarnings.map((w, idx) => (
              <div
                key={idx}
                className="bg-white rounded-xl p-3 border border-amber-200/80 shadow-xs flex items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-0.5">
                  <div className="font-bold text-slate-800">{w.element}</div>
                  <div className="text-[11px] text-slate-500">
                    Ratio: <span className="font-mono font-bold text-rose-600">{w.contrastRatio}:1</span> (Required: {w.targetRatio}:1)
                  </div>
                </div>

                {w.suggestedFg && (
                  <button
                    type="button"
                    onClick={() => handleSuggestShade(w)}
                    className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-colors shrink-0"
                    title={`Fix foreground color to ${w.suggestedFg}`}
                  >
                    <Sparkles className="w-3 h-3 text-emerald-600" />
                    <span>Fix Shade</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-emerald-50/60 rounded-2xl border border-emerald-200/80 p-4 flex items-center space-x-3 text-emerald-800">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <div className="text-xs">
            <span className="font-bold">WCAG 2.1 AA Compliant:</span> All primary text, hero, button, and input combinations pass contrast accessibility guidelines.
          </div>
        </div>
      )}

      {/* Preset Library (6 Pre-coordinated Themes) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 space-y-4 shadow-sm">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-700" />
            <span>Curated Theme Presets</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Select one of our 6 professionally coordinated palettes designed specifically for Islamic educational institutions.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {presets.map((preset) => {
            const isActive = activePresetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleApplyPreset(preset)}
                className={`text-left p-4 rounded-xl border transition-all relative overflow-hidden flex flex-col justify-between ${
                  isActive
                    ? 'border-emerald-600 ring-2 ring-emerald-500/20 bg-emerald-50/20 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-900">{preset.name}</span>
                    {isActive && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                        <Check className="w-3 h-3" />
                        Selected
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed mb-3">
                    {preset.description}
                  </p>
                </div>

                {/* Swatches preview */}
                <div className="flex items-center space-x-1.5 pt-2 border-t border-slate-100">
                  <div
                    className="w-5 h-5 rounded-full border border-black/10 shadow-xs"
                    style={{ backgroundColor: preset.tokens.primaryBtnBg }}
                    title="Primary Button"
                  />
                  <div
                    className="w-5 h-5 rounded-full border border-black/10 shadow-xs"
                    style={{ backgroundColor: preset.tokens.heroOverlay }}
                    title="Hero Overlay"
                  />
                  <div
                    className="w-5 h-5 rounded-full border border-black/10 shadow-xs"
                    style={{ backgroundColor: preset.tokens.navbarBg }}
                    title="Navbar Background"
                  />
                  <div
                    className="w-5 h-5 rounded-full border border-black/10 shadow-xs"
                    style={{ backgroundColor: preset.tokens.cardBg }}
                    title="Card Background"
                  />
                  <div
                    className="w-5 h-5 rounded-full border border-black/10 shadow-xs"
                    style={{ backgroundColor: preset.tokens.footerBg }}
                    title="Footer Background"
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Two-Column Layout: Token Customizer (Left) & Live Responsive Preview (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Grouped Color Pickers (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-700" />
              <span>Fine-Tune Theme Tokens</span>
            </h3>

            {/* Accordion 1: Page & Backgrounds */}
            <div className="border border-slate-200/80 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => toggleGroup('backgrounds')}
                className="w-full px-4 py-3 bg-slate-50 text-left font-bold text-xs text-slate-800 flex items-center justify-between hover:bg-slate-100/70 transition"
              >
                <span className="flex items-center gap-2">
                  <Layout className="w-3.5 h-3.5 text-slate-500" />
                  Page & Container Backgrounds
                </span>
                {openGroups.backgrounds ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>

              {openGroups.backgrounds && (
                <div className="p-4 space-y-3 bg-white">
                  <ColorPickerField label="Page Background" tokenKey="pageBg" description="Overall background behind page sections" />
                  <ColorPickerField label="Navbar Background" tokenKey="navbarBg" description="Top bar containing institution title & links" />
                  <ColorPickerField label="Section Background" tokenKey="sectionBg" description="Alternating container background" />
                  <ColorPickerField label="Card Background" tokenKey="cardBg" description="Background of announcements, notices, intake cards" />
                  <ColorPickerField label="Footer Background" tokenKey="footerBg" description="Page footer containing credentials & contacts" />
                </div>
              )}
            </div>

            {/* Accordion 2: Typography & Colors */}
            <div className="border border-slate-200/80 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => toggleGroup('typography')}
                className="w-full px-4 py-3 bg-slate-50 text-left font-bold text-xs text-slate-800 flex items-center justify-between hover:bg-slate-100/70 transition"
              >
                <span className="flex items-center gap-2">
                  <Type className="w-3.5 h-3.5 text-slate-500" />
                  Typography & Text Colors
                </span>
                {openGroups.typography ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>

              {openGroups.typography && (
                <div className="p-4 space-y-3 bg-white">
                  <ColorPickerField label="Main Headings" tokenKey="headingColor" description="Page and navbar title headings" />
                  <ColorPickerField label="Section Headings" tokenKey="sectionHeadingColor" description="Titles of features, events, and intake cards" />
                  <ColorPickerField label="Body Text Color" tokenKey="bodyTextColor" description="Default paragraph and content text" />
                  <ColorPickerField label="Muted Text Color" tokenKey="mutedTextColor" description="Secondary subtitles, dates, and hints" />
                  <ColorPickerField label="Hyperlink Color" tokenKey="linkColor" description="Interactive text links and badges" />
                  <ColorPickerField label="Footer Text Color" tokenKey="footerTextColor" description="Footer headings and copyright text" />
                </div>
              )}
            </div>

            {/* Accordion 3: Hero Section */}
            <div className="border border-slate-200/80 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => toggleGroup('hero')}
                className="w-full px-4 py-3 bg-slate-50 text-left font-bold text-xs text-slate-800 flex items-center justify-between hover:bg-slate-100/70 transition"
              >
                <span className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-slate-500" />
                  Hero Section & Banner
                </span>
                {openGroups.hero ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>

              {openGroups.hero && (
                <div className="p-4 space-y-3 bg-white">
                  <ColorPickerField label="Hero Overlay Color" tokenKey="heroOverlay" description="Color tint applied over the hero background image" />
                  <ColorPickerField label="Hero Text Color" tokenKey="heroTextColor" description="Headline and subtitle color in the hero banner" />
                </div>
              )}
            </div>

            {/* Accordion 4: Action Buttons */}
            <div className="border border-slate-200/80 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => toggleGroup('buttons')}
                className="w-full px-4 py-3 bg-slate-50 text-left font-bold text-xs text-slate-800 flex items-center justify-between hover:bg-slate-100/70 transition"
              >
                <span className="flex items-center gap-2">
                  <MousePointerClick className="w-3.5 h-3.5 text-slate-500" />
                  Interactive Buttons
                </span>
                {openGroups.buttons ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>

              {openGroups.buttons && (
                <div className="p-4 space-y-3 bg-white">
                  <ColorPickerField label="Primary Button Background" tokenKey="primaryBtnBg" description="Main action buttons (Apply Now, Submit)" />
                  <ColorPickerField label="Primary Button Text" tokenKey="primaryBtnText" description="Text inside primary action buttons" />
                  <ColorPickerField label="Secondary Button Background" tokenKey="secondaryBtnBg" description="Secondary actions and options" />
                  <ColorPickerField label="Secondary Button Text" tokenKey="secondaryBtnText" description="Text inside secondary buttons" />
                  <ColorPickerField label="Secondary Button Border" tokenKey="secondaryBtnBorder" description="Border around secondary buttons" />
                </div>
              )}
            </div>

            {/* Accordion 5: Cards & Borders */}
            <div className="border border-slate-200/80 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => toggleGroup('cards')}
                className="w-full px-4 py-3 bg-slate-50 text-left font-bold text-xs text-slate-800 flex items-center justify-between hover:bg-slate-100/70 transition"
              >
                <span className="flex items-center gap-2">
                  <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                  Cards & Borders
                </span>
                {openGroups.cards ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>

              {openGroups.cards && (
                <div className="p-4 space-y-3 bg-white">
                  <ColorPickerField label="Card Border Color" tokenKey="cardBorderColor" description="Border around intake cards and announcements" />
                  <ColorPickerField label="Divider Line Color" tokenKey="dividerColor" description="Horizontal separator rules" />
                </div>
              )}
            </div>

            {/* Accordion 6: Form Controls */}
            <div className="border border-slate-200/80 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => toggleGroup('inputs')}
                className="w-full px-4 py-3 bg-slate-50 text-left font-bold text-xs text-slate-800 flex items-center justify-between hover:bg-slate-100/70 transition"
              >
                <span className="flex items-center gap-2">
                  <FormInput className="w-3.5 h-3.5 text-slate-500" />
                  Form Inputs (Admissions Desk)
                </span>
                {openGroups.inputs ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>

              {openGroups.inputs && (
                <div className="p-4 space-y-3 bg-white">
                  <ColorPickerField label="Input Background" tokenKey="inputBg" description="Background of textboxes and dropdowns" />
                  <ColorPickerField label="Input Text Color" tokenKey="inputText" description="Color of typed applicant text" />
                  <ColorPickerField label="Input Border Color" tokenKey="inputBorderColor" description="Border around application inputs" />
                  <ColorPickerField label="Input Focus Ring" tokenKey="inputFocusBorder" description="Highlight border color when input is active" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Live Interactive Responsive Preview (7 cols) */}
        <div className="lg:col-span-7 sticky top-6 space-y-3">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-emerald-700" />
                  <span>Live Interactive Preview</span>
                </h3>
                <p className="text-xs text-slate-500">Real-time simulation of your portal homepage and admissions desk.</p>
              </div>

              {/* Device view switcher */}
              <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setPreviewDevice('desktop')}
                  className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
                    previewDevice === 'desktop' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                  }`}
                  title="Desktop View (100%)"
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Desktop</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice('tablet')}
                  className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
                    previewDevice === 'tablet' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                  }`}
                  title="Tablet View (600px)"
                >
                  <Tablet className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Tablet</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice('mobile')}
                  className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
                    previewDevice === 'mobile' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                  }`}
                  title="Mobile View (375px)"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Mobile</span>
                </button>
              </div>
            </div>

            {/* Simulated Device Frame */}
            <div className="bg-slate-100/80 p-3 sm:p-4 rounded-xl flex justify-center overflow-x-auto">
              <div
                className="transition-all duration-300 rounded-xl shadow-md border border-slate-300/80 overflow-hidden flex flex-col"
                style={{
                  width:
                    previewDevice === 'mobile'
                      ? '375px'
                      : previewDevice === 'tablet'
                      ? '600px'
                      : '100%',
                  backgroundColor: draftTokens.pageBg,
                  color: draftTokens.bodyTextColor,
                }}
              >
                {/* 1. Simulated Navbar */}
                <div
                  className="px-4 py-3 flex items-center justify-between border-b"
                  style={{
                    backgroundColor: draftTokens.navbarBg,
                    color: draftTokens.headingColor,
                    borderColor: draftTokens.dividerColor,
                  }}
                >
                  <div className="flex items-center space-x-2">
                    {institutionLogoUrl ? (
                      <img
                        src={institutionLogoUrl}
                        alt="Logo"
                        className="w-7 h-7 rounded-lg object-contain bg-white/10"
                      />
                    ) : (
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs"
                        style={{
                          backgroundColor: draftTokens.primaryBtnBg,
                          color: draftTokens.primaryBtnText,
                        }}
                      >
                        MN
                      </div>
                    )}
                    <span
                      className="font-bold text-xs tracking-tight truncate max-w-[150px] sm:max-w-[220px]"
                      style={{ color: draftTokens.headingColor }}
                    >
                      {institutionName}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 text-[10px] font-semibold opacity-90">
                    <span className="hidden sm:inline" style={{ color: draftTokens.bodyTextColor }}>Home</span>
                    <span className="hidden sm:inline" style={{ color: draftTokens.bodyTextColor }}>About</span>
                    <span
                      className="px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: `${draftTokens.primaryBtnBg}20`,
                        color: draftTokens.primaryBtnBg,
                      }}
                    >
                      Admissions
                    </span>
                  </div>
                </div>

                {/* 2. Simulated Hero Banner */}
                <div
                  className="relative p-6 sm:p-8 flex flex-col justify-center items-center text-center overflow-hidden"
                  style={{
                    backgroundColor: draftTokens.heroOverlay,
                    backgroundImage: heroImageUrl
                      ? `linear-gradient(rgba(15, 23, 42, 0.75), rgba(15, 23, 42, 0.85)), url("${heroImageUrl}")`
                      : undefined,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                >
                  <div className="max-w-md space-y-2 relative z-10">
                    <h4
                      className="text-base sm:text-lg font-extrabold tracking-tight"
                      style={{ color: draftTokens.heroTextColor }}
                    >
                      Excellence in Islamic Education
                    </h4>
                    <p
                      className="text-xs leading-relaxed opacity-90"
                      style={{ color: draftTokens.heroTextColor }}
                    >
                      Nurturing Quranic scholarship, noble character, and academic mastery.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                      <button
                        type="button"
                        className="px-3.5 py-1.5 rounded-lg text-xs font-bold transition shadow-xs"
                        style={{
                          backgroundColor: draftTokens.primaryBtnBg,
                          color: draftTokens.primaryBtnText,
                        }}
                      >
                        Apply Online
                      </button>
                      <button
                        type="button"
                        className="px-3.5 py-1.5 rounded-lg text-xs font-semibold transition border"
                        style={{
                          backgroundColor: draftTokens.secondaryBtnBg,
                          color: draftTokens.secondaryBtnText,
                          borderColor: draftTokens.secondaryBtnBorder,
                        }}
                      >
                        Explore Portal
                      </button>
                    </div>
                  </div>
                </div>

                {/* 3. Simulated Content Card & Form Inputs */}
                <div className="p-4 sm:p-5 space-y-4">
                  {/* Card Section */}
                  <div
                    className="p-4 rounded-xl border shadow-xs space-y-2"
                    style={{
                      backgroundColor: draftTokens.cardBg,
                      color: draftTokens.bodyTextColor,
                      borderColor: draftTokens.cardBorderColor,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold" style={{ color: draftTokens.sectionHeadingColor }}>
                        2026/2027 Admissions Intake
                      </span>
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                        style={{
                          backgroundColor: `${draftTokens.primaryBtnBg}15`,
                          color: draftTokens.primaryBtnBg,
                        }}
                      >
                        Open for Enrollment
                      </span>
                    </div>
                    <p
                      className="text-xs leading-relaxed"
                      style={{ color: draftTokens.mutedTextColor }}
                    >
                      Applications are now being accepted for primary and secondary Hifz and Islamic studies programs.
                    </p>

                    {/* Simulated Form Input inside Card */}
                    <div className="pt-2 space-y-1.5">
                      <label className="text-[11px] font-bold" style={{ color: draftTokens.sectionHeadingColor }}>
                        Sample Applicant Input Field
                      </label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          readOnly
                          value="Muhammad Yusuf"
                          className="w-full px-2.5 py-1.5 rounded-lg text-xs border"
                          style={{
                            backgroundColor: draftTokens.inputBg,
                            color: draftTokens.inputText,
                            borderColor: draftTokens.inputBorderColor,
                          }}
                        />
                        <button
                          type="button"
                          className="px-3 py-1.5 rounded-lg text-xs font-bold shrink-0"
                          style={{
                            backgroundColor: draftTokens.primaryBtnBg,
                            color: draftTokens.primaryBtnText,
                          }}
                        >
                          Submit
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. Simulated Footer */}
                <div
                  className="px-4 py-3 border-t text-center space-y-1"
                  style={{
                    backgroundColor: draftTokens.footerBg,
                    color: draftTokens.footerTextColor,
                    borderColor: draftTokens.dividerColor,
                  }}
                >
                  <p className="text-xs font-bold">{institutionName}</p>
                  <p
                    className="text-[10px] opacity-80"
                    style={{ color: draftTokens.footerTextColor }}
                  >
                    © 2026 All Rights Reserved • Powered by MadrasaNexa SaaS
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThemeCustomizerTab;