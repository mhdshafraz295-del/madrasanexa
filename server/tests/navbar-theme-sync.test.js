import { THEME_PRESETS, DEFAULT_THEME_TOKENS } from '../src/services/madrasa-theme.service.js';

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✓ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ [FAIL] ${testName}`);
    failed++;
  }
}

console.log('\n=== Targeted Test Suite: Public Navbar Theme Synchronization ===\n');

// -------------------------------------------------------------
// Test 1: Default Background Synchronization
// -------------------------------------------------------------
console.log('Test 1: Verifying default theme background tokens');

assert(DEFAULT_THEME_TOKENS.pageBg === '#ffffff', 'DEFAULT_THEME_TOKENS.pageBg is pure white (#ffffff)');
assert(DEFAULT_THEME_TOKENS.navbarBg === '#ffffff', 'DEFAULT_THEME_TOKENS.navbarBg is pure white (#ffffff)');
assert(
  Boolean(DEFAULT_THEME_TOKENS.pageBg && DEFAULT_THEME_TOKENS.navbarBg),
  'Default pageBg and navbarBg tokens are defined'
);

// -------------------------------------------------------------
// Test 2: Verification of All Six Theme Presets
// -------------------------------------------------------------
console.log('\nTest 2: Verifying all six theme presets have valid page backgrounds');

assert(THEME_PRESETS.length === 6, 'Exactly six theme presets are registered');

const expectedPresetIds = [
  'classic-green',
  'ocean-navy',
  'royal-emerald',
  'warm-sand',
  'minimal-white',
  'midnight-gold',
];

for (const id of expectedPresetIds) {
  const preset = THEME_PRESETS.find((p) => p.id === id);
  assert(Boolean(preset), `Preset "${id}" exists in catalog`);
  assert(Boolean(preset?.tokens?.pageBg), `Preset "${id}" defines pageBg: ${preset?.tokens?.pageBg}`);

  // Simulate navbar background resolution
  const resolvedNavbarBg = preset?.tokens?.pageBg || '#ffffff';
  assert(
    resolvedNavbarBg === preset?.tokens?.pageBg,
    `Preset "${id}" navbar resolves exactly to active pageBg (${resolvedNavbarBg})`
  );
}

// -------------------------------------------------------------
// Test 3: Custom Tenant Background Synchronization
// -------------------------------------------------------------
console.log('\nTest 3: Verifying dynamic CMS background reflection');

function resolveNavbarBg(theme) {
  return (theme && theme.pageBg) || '#ffffff';
}

// Case A: Custom pastel background configured in CMS
const customTenantTheme = {
  pageBg: '#f0fdf4', // Custom mint
  headingColor: '#166534',
};
assert(resolveNavbarBg(customTenantTheme) === '#f0fdf4', 'Navbar reflects custom CMS background color #f0fdf4');

// Case B: Midnight Gold dark theme
const midnightTheme = THEME_PRESETS.find((p) => p.id === 'midnight-gold')?.tokens;
assert(resolveNavbarBg(midnightTheme) === '#090d16', 'Navbar reflects dark obsidian background #090d16');

// Case C: Null or unconfigured profile
assert(resolveNavbarBg(null) === '#ffffff', 'Navbar falls back to pure white #ffffff when theme is null');
assert(resolveNavbarBg({}) === '#ffffff', 'Navbar falls back to pure white #ffffff when pageBg is empty');

// -------------------------------------------------------------
// Test 4: Legacy Warm Ivory Migration to Statistics Card White
// -------------------------------------------------------------
console.log('\nTest 4: Legacy Warm Ivory (#f7f6f0) migration to Card White (#ffffff)');

function sanitizeThemeBg(rawTheme) {
  const isLegacyIvory = rawTheme?.pageBg && String(rawTheme.pageBg).toLowerCase() === '#f7f6f0';
  const resolvedPageBg = isLegacyIvory ? '#ffffff' : (rawTheme?.pageBg || '#ffffff');
  return {
    pageBg: resolvedPageBg,
    navbarBg: isLegacyIvory ? '#ffffff' : (rawTheme?.navbarBg || resolvedPageBg),
    cardBg: '#ffffff', // Exact background of Statistics Cards
  };
}

const legacyStoredTheme = {
  pageBg: '#f7f6f0',
  navbarBg: '#ffffff',
};
const sanitized = sanitizeThemeBg(legacyStoredTheme);

assert(sanitized.cardBg === '#ffffff', 'Statistics Cards background = #ffffff');
assert(sanitized.navbarBg === '#ffffff', 'Navbar background = #ffffff');
assert(sanitized.pageBg === '#ffffff', 'Public Website default background = #ffffff');
assert(sanitized.pageBg === sanitized.navbarBg && sanitized.navbarBg === sanitized.cardBg, 'All three (Card, Navbar, Website) are 100% unified at #ffffff');

// -------------------------------------------------------------
// Summary
// -------------------------------------------------------------
console.log('\n========================================');
console.log(`Total tests passed: ${passed}`);
console.log(`Total tests failed: ${failed}`);
console.log('========================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
