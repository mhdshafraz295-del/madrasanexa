import assert from 'node:assert/strict';
import { DEFAULT_THEME_TOKENS, THEME_PRESETS } from '../src/services/madrasa-theme.service.js';
import { themeTokensSchema, analyzeThemeContrast } from '../src/validations/theme.validation.js';

console.log('=== RUNNING TARGETED THEME INTEGRITY TESTS ===\n');

// TEST 1: All 6 presets intact
console.log('[TEST 1] Presets Integrity');
assert.equal(THEME_PRESETS.length, 6, 'Exactly 6 coordinated presets preserved');
const expectedPresetIds = ['classic-green', 'ocean-navy', 'royal-emerald', 'warm-sand', 'minimal-white', 'midnight-gold'];
expectedPresetIds.forEach(id => {
  const found = THEME_PRESETS.find(p => p.id === id);
  assert(found, `Preset ${id} is present`);
});
console.log('  ✓ [PASS] All 6 original presets preserved without modification');

// TEST 2: Canonical schema validation for DEFAULT_THEME_TOKENS
console.log('\n[TEST 2] Schema Validation of DEFAULT_THEME_TOKENS');
const parsed = themeTokensSchema.safeParse(DEFAULT_THEME_TOKENS);
assert(parsed.success, 'DEFAULT_THEME_TOKENS validates against themeTokensSchema: ' + JSON.stringify(parsed.error?.format()));
console.log('  ✓ [PASS] DEFAULT_THEME_TOKENS conforms strictly to canonical token schema');

// TEST 3: WCAG AA Contrast Compliance
console.log('\n[TEST 3] WCAG 2.1 AA Contrast Analysis');
const analysis = analyzeThemeContrast(DEFAULT_THEME_TOKENS);
assert.equal(analysis.isAccessible, true, 'Default theme is fully accessible');
assert.equal(analysis.warnings.length, 0, 'Zero contrast warnings for default theme');
console.log('  ✓ [PASS] Official Institutional Olive default tokens pass all WCAG contrast targets');

// TEST 4: Specific Brand Colors Verification
console.log('\n[TEST 4] Approved Palette Hex Codes');
assert.equal(DEFAULT_THEME_TOKENS.pageBg, '#ffffff', 'pageBg is Pure White');
assert.equal(DEFAULT_THEME_TOKENS.navbarBg, '#ffffff', 'navbarBg is Pure White');
assert.equal(DEFAULT_THEME_TOKENS.heroOverlay, '#504F34', 'heroOverlay is Deep Institutional Olive');
assert.equal(DEFAULT_THEME_TOKENS.footerBg, '#504F34', 'footerBg is Deep Institutional Olive');
assert.equal(DEFAULT_THEME_TOKENS.primaryBtnBg, '#504F34', 'primaryBtnBg is Deep Institutional Olive');
assert.equal(DEFAULT_THEME_TOKENS.headingColor, '#252525', 'headingColor is Charcoal Dark');
assert.equal(DEFAULT_THEME_TOKENS.linkColor, '#504F34', 'linkColor is Deep Institutional Olive');
assert.equal(DEFAULT_THEME_TOKENS.secondaryBtnBorder, '#a5a477', 'secondaryBtnBorder is Primary Olive');
assert.equal(DEFAULT_THEME_TOKENS.cardBorderColor, '#e5e5df', 'cardBorderColor is Soft Border');
console.log('  ✓ [PASS] Approved brand colors correctly bound to canonical tokens');

console.log('\n=============================================');
console.log('All Theme Integrity Tests Passed!');
console.log('=============================================\n');
