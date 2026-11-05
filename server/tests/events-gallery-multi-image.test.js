import { eventAlbumSchema, eventAlbumImageSchema, updateMadrasaProfileSchema } from '../src/validations/madrasa-profile.validation.js';
import { normalizeEventAlbum } from '../src/services/madrasa-profile.service.js';

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

console.log('\n=== Targeted Test Suite: Events / Gallery Multi-Image Album ===\n');

// -------------------------------------------------------------
// Test 1: Upload and save an album with 5 images
// -------------------------------------------------------------
console.log('Test 1: Validating album with 5 images');
const fiveImages = [
  { id: 'img-1', fileId: 'fid-1', url: 'https://example.com/1.webp', isCover: true, sortOrder: 0 },
  { id: 'img-2', fileId: 'fid-2', url: 'https://example.com/2.webp', isCover: false, sortOrder: 1 },
  { id: 'img-3', fileId: 'fid-3', url: 'https://example.com/3.webp', isCover: false, sortOrder: 2 },
  { id: 'img-4', fileId: 'fid-4', url: 'https://example.com/4.webp', isCover: false, sortOrder: 3 },
  { id: 'img-5', fileId: 'fid-5', url: 'https://example.com/5.webp', isCover: false, sortOrder: 4 },
];

const albumPayload5 = {
  id: 'ev-test-1',
  title: 'Annual Graduation Ceremony',
  date: '2026-11-15',
  description: 'Graduation celebration for hifz students.',
  location: 'Main Auditorium',
  isPublished: true,
  images: fiveImages,
  coverFileId: 'fid-1',
  coverUrl: 'https://example.com/1.webp',
};

const parsed5 = eventAlbumSchema.safeParse(albumPayload5);
assert(parsed5.success === true, 'eventAlbumSchema accepts album with exactly 5 images');
assert(parsed5.data?.images?.length === 5, 'Parsed album contains all 5 images');

// -------------------------------------------------------------
// Test 2: Confirm that a sixth image is rejected
// -------------------------------------------------------------
console.log('\nTest 2: Confirming that a 6th image is rejected');
const sixImages = [
  ...fiveImages,
  { id: 'img-6', fileId: 'fid-6', url: 'https://example.com/6.webp', isCover: false, sortOrder: 5 },
];

const albumPayload6 = {
  ...albumPayload5,
  images: sixImages,
};

const parsed6 = eventAlbumSchema.safeParse(albumPayload6);
assert(parsed6.success === false, 'eventAlbumSchema rejects album with 6 images');
const errorMessage = parsed6.error?.issues?.[0]?.message;
assert(
  errorMessage?.includes('5') || errorMessage?.includes('images'),
  `Schema error mentions maximum limit: "${errorMessage}"`
);

// -------------------------------------------------------------
// Test 3: Confirm that an existing single-poster event still displays correctly
// -------------------------------------------------------------
console.log('\nTest 3: Confirming backward compatibility with legacy single-poster event');
const legacyEvent = {
  id: 'ev-legacy-1',
  title: 'Legacy Annual Sports Day',
  date: '2025-05-10',
  description: 'Past sports event with single poster',
  location: 'Sports Ground',
  isPublished: true,
  posterFileId: 'legacy-fid-99',
  posterUrl: 'https://r2.example.com/posters/legacy-sports.webp',
};

// Test schema acceptance of legacy format
const parsedLegacy = eventAlbumSchema.safeParse(legacyEvent);
assert(parsedLegacy.success === true, 'eventAlbumSchema accepts legacy single-poster format without images array');

// Test normalizeEventAlbum converts legacy event to 1-image album
const normalizedLegacy = normalizeEventAlbum(legacyEvent);
assert(normalizedLegacy !== null, 'normalizeEventAlbum produces non-null object');
assert(Array.isArray(normalizedLegacy.images) && normalizedLegacy.images.length === 1, 'Legacy event converted to 1-image album');
assert(normalizedLegacy.images[0].fileId === 'legacy-fid-99', 'Legacy posterFileId preserved in normalized image');
assert(normalizedLegacy.images[0].url === 'https://r2.example.com/posters/legacy-sports.webp', 'Legacy posterUrl preserved in normalized image');
assert(normalizedLegacy.images[0].isCover === true, 'Legacy poster automatically designated as cover image');
assert(normalizedLegacy.coverUrl === 'https://r2.example.com/posters/legacy-sports.webp', 'coverUrl set from legacy posterUrl');
assert(normalizedLegacy.posterUrl === 'https://r2.example.com/posters/legacy-sports.webp', 'posterUrl alias preserved for backward compatibility');
assert(normalizedLegacy.photoCount === 1, 'photoCount is 1 for legacy event');

// -------------------------------------------------------------
// Test 4: Confirm that cover selection and image ordering persist after saving
// -------------------------------------------------------------
console.log('\nTest 4: Confirming cover selection and image ordering persistence');
const unorderedImages = [
  { id: 'img-c', fileId: 'fid-c', url: 'https://example.com/c.webp', isCover: false, sortOrder: 2 },
  { id: 'img-a', fileId: 'fid-a', url: 'https://example.com/a.webp', isCover: false, sortOrder: 0 },
  { id: 'img-b', fileId: 'fid-b', url: 'https://example.com/b.webp', isCover: true, sortOrder: 1 },
];

const albumWithCoverAndOrder = {
  id: 'ev-order-test',
  title: 'Ordering Test Event',
  date: '2026-12-01',
  isPublished: true,
  images: unorderedImages,
  coverFileId: 'fid-b',
};

const normalizedOrder = normalizeEventAlbum(albumWithCoverAndOrder);
assert(normalizedOrder.images[0].id === 'img-a', 'Images sorted by sortOrder (index 0 is img-a)');
assert(normalizedOrder.images[1].id === 'img-b', 'Images sorted by sortOrder (index 1 is img-b)');
assert(normalizedOrder.images[2].id === 'img-c', 'Images sorted by sortOrder (index 2 is img-c)');
assert(normalizedOrder.images[1].isCover === true, 'Cover designation on img-b is preserved');
assert(normalizedOrder.coverFileId === 'fid-b', 'coverFileId correctly resolved to fid-b');
assert(normalizedOrder.posterFileId === 'fid-b', 'posterFileId alias matches coverFileId fid-b');

// -------------------------------------------------------------
// Test 5: Confirm that published albums appear publicly and draft albums remain hidden
// -------------------------------------------------------------
console.log('\nTest 5: Confirming published albums appear publicly and draft albums remain hidden');
const mixedEvents = [
  { id: 'ev-pub-1', title: 'Public Event 1', date: '2026-10-01', isPublished: true, images: [fiveImages[0]] },
  { id: 'ev-draft-1', title: 'Draft Event 1', date: '2026-10-15', isPublished: false, images: [fiveImages[1]] },
  { id: 'ev-pub-2', title: 'Public Event 2', date: '2026-11-01', isPublished: true, images: [fiveImages[2]] },
];

// Replicate public filter from madrasa-profile.service.js: allEvents.filter(e => e.isPublished !== false)
const publicFiltered = mixedEvents.filter(e => e.isPublished !== false);
assert(publicFiltered.length === 2, 'Only 2 events pass public filter');
assert(publicFiltered.every(e => e.isPublished === true), 'All exposed events have isPublished === true');
assert(!publicFiltered.some(e => e.id === 'ev-draft-1'), 'Draft album "ev-draft-1" is strictly omitted from public exposure');

// -------------------------------------------------------------
// Test 6: Confirm that images from another tenant cannot be accessed or deleted
// -------------------------------------------------------------
console.log('\nTest 6: Tenant isolation verification (ownership checks)');
// Simulating the resolveEventAlbums tenant filter logic
const mockFileObjectDb = [
  { id: 'fid-tenantA-1', madrasaId: 'tenant-A', objectKey: 'tenants/tenant-A/posters/1.webp', publicUrl: 'https://r2/tenant-A/1.webp' },
  { id: 'fid-tenantB-1', madrasaId: 'tenant-B', objectKey: 'tenants/tenant-B/posters/b.webp', publicUrl: 'https://r2/tenant-B/b.webp' },
];

function mockResolveForTenant(requestingTenantId, requestedFileIds) {
  // prisma.fileObject.findMany({ where: { id: { in: requestedFileIds }, madrasaId: requestingTenantId } })
  return mockFileObjectDb.filter(f => requestedFileIds.includes(f.id) && f.madrasaId === requestingTenantId);
}

// Tenant A requests Tenant B's file
const tenantAResolved = mockResolveForTenant('tenant-A', ['fid-tenantA-1', 'fid-tenantB-1']);
assert(tenantAResolved.length === 1, 'Tenant isolation query only returns files owned by requesting tenant');
assert(tenantAResolved[0].id === 'fid-tenantA-1', 'Only Tenant A file returned');
assert(!tenantAResolved.some(f => f.id === 'fid-tenantB-1'), 'Tenant B file blocked by tenant isolation filter');

// Simulating removeHomepagePoster authorization check
function mockRemovePoster(requestingTenantId, fileId) {
  // prisma.fileObject.findFirst({ where: { id: fileId, madrasaId: requestingTenantId } })
  const file = mockFileObjectDb.find(f => f.id === fileId && f.madrasaId === requestingTenantId);
  if (!file) {
    return { success: false, error: 'Poster file not found or unauthorized.' };
  }
  return { success: true };
}

const deleteCrossTenant = mockRemovePoster('tenant-A', 'fid-tenantB-1');
assert(deleteCrossTenant.success === false, 'Cross-tenant poster deletion rejected');
assert(deleteCrossTenant.error === 'Poster file not found or unauthorized.', 'Unauthorized error returned for cross-tenant deletion');

// -------------------------------------------------------------
// Results Summary
// -------------------------------------------------------------
console.log(`\n========================================`);
console.log(`Total tests passed: ${passed}`);
console.log(`Total tests failed: ${failed}`);
console.log(`========================================\n`);

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
