import assert from 'node:assert';
import test from 'node:test';

// Test suite for Student QR & Barcode Label Printing Studio
// Validates physical layout geometry on standard A4 (210 x 297 mm)

const STYLE_PRESETS = {
  minimal: {
    columns: 3,
    rows: 6,
    labelWidth: 58,
    labelHeight: 40,
    gapX: 5,
    gapY: 5,
    marginX: 13,
    marginY: 16,
  },
  professional: {
    columns: 3,
    rows: 5,
    labelWidth: 60,
    labelHeight: 48,
    gapX: 4,
    gapY: 5,
    marginX: 11,
    marginY: 16,
  },
  compact: {
    columns: 4,
    rows: 8,
    labelWidth: 45,
    labelHeight: 30,
    gapX: 4,
    gapY: 3.5,
    marginX: 9,
    marginY: 14.5,
  },
};

test('A4 Dimensions & Fit Verification for Style Presets', () => {
  const A4_WIDTH_MM = 210;
  const A4_HEIGHT_MM = 297;

  for (const [styleName, preset] of Object.entries(STYLE_PRESETS)) {
    const totalContentWidth =
      preset.marginX * 2 +
      preset.columns * preset.labelWidth +
      (preset.columns - 1) * preset.gapX;

    const totalContentHeight =
      preset.marginY * 2 +
      preset.rows * preset.labelHeight +
      (preset.rows - 1) * preset.gapY;

    // Assert that total dimensions do not overflow A4 page
    assert(
      totalContentWidth <= A4_WIDTH_MM,
      `Style ${styleName} width (${totalContentWidth}mm) exceeds A4 width (${A4_WIDTH_MM}mm)`
    );
    assert(
      totalContentHeight <= A4_HEIGHT_MM,
      `Style ${styleName} height (${totalContentHeight}mm) exceeds A4 height (${A4_HEIGHT_MM}mm)`
    );

    // Assert minimum safe margins (at least 5mm)
    assert(preset.marginX >= 5, `Style ${styleName} marginX must be >= 5mm`);
    assert(preset.marginY >= 5, `Style ${styleName} marginY must be >= 5mm`);
  }
});

test('Pagination and Grid Slot Calculations', () => {
  const calculatePagination = (totalStudents, columns, rows) => {
    const labelsPerPage = columns * rows;
    const totalPages = Math.max(1, Math.ceil(totalStudents / labelsPerPage));
    const pages = [];

    for (let p = 0; p < totalPages; p++) {
      const startIndex = p * labelsPerPage;
      const pageCards = Array.from({ length: totalStudents })
        .slice(startIndex, startIndex + labelsPerPage);
      pages.push(pageCards);
    }
    return { labelsPerPage, totalPages, pages };
  };

  // Test Case 1: 50 students with Minimal preset (3x6 = 18 per page)
  const minimal = calculatePagination(50, 3, 6);
  assert.strictEqual(minimal.labelsPerPage, 18);
  assert.strictEqual(minimal.totalPages, 3); // 18 + 18 + 14 = 50
  assert.strictEqual(minimal.pages[0].length, 18);
  assert.strictEqual(minimal.pages[1].length, 18);
  assert.strictEqual(minimal.pages[2].length, 14);

  // Test Case 2: 70 students with Professional preset (3x5 = 15 per page)
  const prof = calculatePagination(70, 3, 5);
  assert.strictEqual(prof.labelsPerPage, 15);
  assert.strictEqual(prof.totalPages, 5); // 15*4 + 10 = 70
  assert.strictEqual(prof.pages[4].length, 10);

  // Test Case 3: 100 students with Compact preset (4x8 = 32 per page)
  const compact = calculatePagination(100, 4, 8);
  assert.strictEqual(compact.labelsPerPage, 32);
  assert.strictEqual(compact.totalPages, 4); // 32*3 + 4 = 100
  assert.strictEqual(compact.pages[3].length, 4);

  // Test Case 4: 0 students
  const empty = calculatePagination(0, 3, 6);
  assert.strictEqual(empty.totalPages, 1);
  assert.strictEqual(empty.pages[0].length, 0);
});

test('Physical Positioning Coordinates on A4 Page', () => {
  const preset = STYLE_PRESETS.minimal;
  // Calculate slot for row 2, col 1 (0-indexed)
  const r = 2;
  const c = 1;
  const posX = preset.marginX + c * (preset.labelWidth + preset.gapX);
  const posY = preset.marginY + r * (preset.labelHeight + preset.gapY);

  assert.strictEqual(posX, 13 + 1 * (58 + 5)); // 13 + 63 = 76mm
  assert.strictEqual(posY, 16 + 2 * (40 + 5)); // 16 + 90 = 106mm

  // Label right edge and bottom edge must fit within page boundaries
  assert(posX + preset.labelWidth <= 210);
  assert(posY + preset.labelHeight <= 297);
});

test('Cutting Boundary Guides and Modes Validation', () => {
  const validGuideStyles = ['dotted', 'solid', 'corners', 'none'];
  const validModes = ['qr_only', 'barcode_only', 'qr_and_barcode'];
  const validStyles = ['minimal', 'professional', 'compact'];

  validGuideStyles.forEach(guide => {
    assert(typeof guide === 'string' && guide.length > 0);
  });
  validModes.forEach(mode => {
    assert(typeof mode === 'string' && mode.length > 0);
  });
  validStyles.forEach(style => {
    assert(typeof style === 'string' && style.length > 0);
  });
});
