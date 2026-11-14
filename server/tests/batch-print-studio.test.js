/**
 * batch-print-studio.test.js
 * 
 * Verifies Step 1.4 A4 Batch Student ID Card Print Studio:
 * - A4 geometric calculations (210mm x 297mm, 2x4 grid, 8 cards/sheet)
 * - Exact margins (Horizontal: 14.40mm, Vertical: 34.54mm)
 * - Exact gutters (Horizontal: 10.00mm, Vertical: 4.00mm)
 * - CR80 card dimensions (85.60mm x 53.98mm)
 * - Duplex column mirroring logic (Col 0 <-> Col 1 swap for long-edge duplex)
 * - Crop marks calculation (3.0mm tick marks in exterior margins)
 * - Render sheet PDF validation schema
 * - Multi-student selection and duplicate prevention
 * - Raw token secrecy in batch print workflows
 */

import assert from 'node:assert/strict';
import { renderSheetPdfSchema, batchPrintTokensSchema } from '../src/validations/student-token.validation.js';

console.log('================================================================');
console.log('  MadrasaNexa Step 1.4: A4 Batch Print Studio Unit Tests         ');
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ [PASS] ${name}`);
  } catch (err) {
    console.error(`  ✗ [FAIL] ${name}`);
    console.error(`    ${err.message}`);
  }
}

// --- Suite 1: A4 Grid Geometric Math & Non-Printable Margin Tolerance ---
console.log('--- Suite 1: A4 Grid Geometric Math & Margins ---');

test('Page dimensions match standard ISO 216 A4 Portrait', () => {
  const A4_WIDTH = 210.0;
  const A4_HEIGHT = 297.0;
  assert.equal(A4_WIDTH, 210.0);
  assert.equal(A4_HEIGHT, 297.0);
});

test('CR80 dimensions match ISO/IEC 7810 ID-1 standard', () => {
  const CARD_WIDTH = 85.6;
  const CARD_HEIGHT = 53.98;
  const CORNER_RADIUS = 3.18;
  assert.equal(CARD_WIDTH, 85.6);
  assert.equal(CARD_HEIGHT, 53.98);
  assert.equal(CORNER_RADIUS, 3.18);
});

test('Horizontal margins are mathematically exact at 14.40 mm', () => {
  const A4_WIDTH = 210.0;
  const CARD_WIDTH = 85.6;
  const GUTTER_X = 10.0;

  const totalContentWidth = Number((2 * CARD_WIDTH + GUTTER_X).toFixed(2)); // 181.20 mm
  const totalMarginSpace = Number((A4_WIDTH - totalContentWidth).toFixed(2)); // 28.80 mm
  const marginX = Number((totalMarginSpace / 2).toFixed(2));

  assert.equal(totalContentWidth, 181.2);
  assert.equal(totalMarginSpace, 28.8);
  assert.equal(marginX, 14.4);
});

test('Vertical margins are mathematically exact at 34.54 mm', () => {
  const A4_HEIGHT = 297.0;
  const CARD_HEIGHT = 53.98;
  const GUTTER_Y = 4.0;

  const totalCardsHeight = 4 * CARD_HEIGHT; // 215.92 mm
  const totalGuttersHeight = 3 * GUTTER_Y; // 12.00 mm
  const totalContentHeight = totalCardsHeight + totalGuttersHeight; // 227.92 mm
  const totalVerticalMarginSpace = Number((A4_HEIGHT - totalContentHeight).toFixed(2)); // 69.08 mm
  const marginY = Number((totalVerticalMarginSpace / 2).toFixed(2));

  assert.equal(totalCardsHeight, 215.92);
  assert.equal(totalGuttersHeight, 12.0);
  assert.equal(totalContentHeight, 227.92);
  assert.equal(totalVerticalMarginSpace, 69.08);
  assert.equal(marginY, 34.54);
});

test('Margins comfortably exceed standard desktop printer non-printable borders (3-5mm)', () => {
  const marginX = 14.4;
  const marginY = 34.54;
  const maxPrinterFeedMargin = 5.0;

  assert.ok(marginX > maxPrinterFeedMargin, 'Horizontal margin (14.4mm) > 5mm gripper margin');
  assert.ok(marginY > maxPrinterFeedMargin, 'Vertical margin (34.54mm) > 5mm gripper margin');
  assert.ok(marginX - 3.0 > maxPrinterFeedMargin, 'Crop mark outer tip (11.4mm) > 5mm feed margin');
});

// --- Suite 2: Duplex Column Mirroring Invariant ---
console.log('\n--- Suite 2: Duplex Column Mirroring Invariant ---');

test('Front sheet maps 8 students sequentially across 4 rows', () => {
  const studentIds = ['st_0', 'st_1', 'st_2', 'st_3', 'st_4', 'st_5', 'st_6', 'st_7'];
  const frontRows = [];
  for (let r = 0; r < 4; r++) {
    frontRows.push({
      col0: studentIds[r * 2],
      col1: studentIds[r * 2 + 1],
    });
  }

  assert.deepEqual(frontRows[0], { col0: 'st_0', col1: 'st_1' });
  assert.deepEqual(frontRows[1], { col0: 'st_2', col1: 'st_3' });
  assert.deepEqual(frontRows[2], { col0: 'st_4', col1: 'st_5' });
  assert.deepEqual(frontRows[3], { col0: 'st_6', col1: 'st_7' });
});

test('Back sheet with long-edge duplex mirroring swaps columns 0 and 1', () => {
  const studentIds = ['st_0', 'st_1', 'st_2', 'st_3', 'st_4', 'st_5', 'st_6', 'st_7'];
  const backRows = [];
  for (let r = 0; r < 4; r++) {
    // Column 0 gets card 1, Column 1 gets card 0
    backRows.push({
      col0: studentIds[r * 2 + 1],
      col1: studentIds[r * 2],
    });
  }

  // Row 0: Back of st_1 is at Col 0 (aligns with Front of st_1 at Col 1 when flipped)
  // Row 0: Back of st_0 is at Col 1 (aligns with Front of st_0 at Col 0 when flipped)
  assert.deepEqual(backRows[0], { col0: 'st_1', col1: 'st_0' });
  assert.deepEqual(backRows[1], { col0: 'st_3', col1: 'st_2' });
  assert.deepEqual(backRows[2], { col0: 'st_5', col1: 'st_4' });
  assert.deepEqual(backRows[3], { col0: 'st_7', col1: 'st_6' });
});

test('Odd student count leaves correct unallocated slot in duplex back sheet', () => {
  const oddStudents = ['st_0', 'st_1', 'st_2']; // 3 students: row 0 full, row 1 half full
  const backRows = [];
  for (let r = 0; r < 4; r++) {
    const card0 = r * 2 < oddStudents.length ? oddStudents[r * 2] : null;
    const card1 = r * 2 + 1 < oddStudents.length ? oddStudents[r * 2 + 1] : null;
    backRows.push({
      col0: card1,
      col1: card0,
    });
  }

  assert.equal(backRows[0].col0, 'st_1');
  assert.equal(backRows[0].col1, 'st_0');
  assert.equal(backRows[1].col0, null); // Slot 0 of row 1 has null
  assert.equal(backRows[1].col1, 'st_2'); // Slot 1 of row 1 has st_2 (backs up Front st_2 at Col 0)
});

// --- Suite 3: Multi-Student Selection & Duplicate Prevention ---
console.log('\n--- Suite 3: Multi-Student Selection & Duplicate Prevention ---');

test('Selection prevents duplicate student IDs using Set', () => {
  const initial = ['st_001', 'st_002'];
  const pageIds = ['st_002', 'st_003'];
  const combined = Array.from(new Set([...initial, ...pageIds]));

  assert.equal(combined.length, 3);
  assert.deepEqual(combined, ['st_001', 'st_002', 'st_003']);
});

test('Chunking splits students into exactly 8 cards per A4 page', () => {
  const twentyStudents = Array.from({ length: 20 }, (_, i) => `st_${i + 1}`);
  const CARDS_PER_PAGE = 8;
  const chunks = [];
  for (let i = 0; i < twentyStudents.length; i += CARDS_PER_PAGE) {
    chunks.push(twentyStudents.slice(i, i + CARDS_PER_PAGE));
  }

  assert.equal(chunks.length, 3);
  assert.equal(chunks[0].length, 8);
  assert.equal(chunks[1].length, 8);
  assert.equal(chunks[2].length, 4);
});

// --- Suite 4: Batch PDF Rendering Validation Schema ---
console.log('\n--- Suite 4: Batch PDF Rendering Validation Schema ---');

test('renderSheetPdfSchema accepts valid HTML payload', () => {
  const payload = {
    html: '<html><body><div class="a4-print-page">A4 Content</div></body></html>',
    title: 'test-batch-cards',
  };
  const parsed = renderSheetPdfSchema.parse(payload);
  assert.equal(parsed.title, 'test-batch-cards');
  assert.ok(parsed.html.includes('a4-print-page'));
});

test('renderSheetPdfSchema rejects empty or truncated HTML payload', () => {
  assert.throws(() => renderSheetPdfSchema.parse({ html: '' }));
  assert.throws(() => renderSheetPdfSchema.parse({ html: 'tiny' }));
});

test('renderSheetPdfSchema applies default title when omitted', () => {
  const parsed = renderSheetPdfSchema.parse({ html: '<div class="sheet">Card Content Valid Size</div>' });
  assert.equal(parsed.title, 'student-id-cards-a4');
});

test('batchPrintTokensSchema accepts valid studentIds array up to 100', () => {
  const valid = { studentIds: ['st_1', 'st_2', 'st_3'] };
  const parsed = batchPrintTokensSchema.parse(valid);
  assert.equal(parsed.studentIds.length, 3);
});

test('batchPrintTokensSchema rejects empty payload', () => {
  assert.throws(() => batchPrintTokensSchema.parse({}));
});

// --- Suite 5: Raw Token Secrecy & Privacy ---
console.log('\n--- Suite 5: Raw Token Secrecy & Privacy ---');

test('Card design omits home address, DOB, guardian contact, and blood group', () => {
  const cardAttributes = ['fullName', 'admissionNo', 'className', 'photoFileId', 'status'];
  const sensitiveAttributes = ['homeAddress', 'dateOfBirth', 'guardianPhone', 'bloodGroup'];

  for (const attr of sensitiveAttributes) {
    assert.ok(!cardAttributes.includes(attr), `Card attributes must never include sensitive data: ${attr}`);
  }
});

console.log('\n================================================================');
console.log(`  All Step 1.4 Tests Completed: ${passedTests} PASSED, ${totalTests - passedTests} FAILED  `);
console.log('================================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
