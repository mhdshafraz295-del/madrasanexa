import {
  staffPresentationItemSchema,
  staffSectionSchema,
  updateMadrasaProfileSchema,
} from '../src/validations/madrasa-profile.validation.js';

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

console.log('\n=== Targeted Test Suite: Public Staff Section & Animated Statistics ===\n');

// -------------------------------------------------------------
// Test 1: Validation Schema for Staff Presentation
// -------------------------------------------------------------
console.log('Test 1: Validating staff presentation schemas');

const validStaffConfig = {
  isEnabled: true,
  showStats: true,
  sectionTitle: 'Our Scholarly Faculty & Mentors',
  sectionSubtitle: 'Dedicated scholars and educators guiding hearts and minds with wisdom and care.',
  items: [
    {
      ustadhId: 'ust-tenant-101',
      isPublic: true,
      sortOrder: 0,
      designation: 'Head of Hifz & Tajweed',
      department: 'Quranic Sciences',
      qualification: 'Al-Alimiyyah (Nadwatul Ulama), Hafiz-ul-Quran',
      experienceYears: 12,
      bio: 'Specializes in authentic tajweed transmission and student character development.',
      photoFileId: 'fid-photo-101',
      photoUrl: 'https://example.com/photos/ust101.webp',
    },
    {
      ustadhId: 'ust-tenant-102',
      isPublic: false,
      sortOrder: 1,
      designation: 'Islamic Studies Instructor',
      department: 'Hadith & Fiqh',
      qualification: 'B.A. Islamic Studies',
      experienceYears: '5+ Years',
      bio: null,
      photoFileId: null,
      photoUrl: null,
    },
  ],
};

const parsedConfig = staffSectionSchema.safeParse(validStaffConfig);
assert(parsedConfig.success === true, 'staffSectionSchema accepts valid configuration');
assert(parsedConfig.data?.items?.length === 2, 'Parsed configuration contains both staff items');

// Missing ustadhId should fail
const invalidItem = {
  isPublic: true,
  sortOrder: 0,
  designation: 'Faculty',
};
const parsedInvalid = staffPresentationItemSchema.safeParse(invalidItem);
assert(parsedInvalid.success === false, 'staffPresentationItemSchema rejects missing ustadhId');

// Profile update schema accepts staffJson
const profileUpdatePayload = {
  heroTitle: 'Welcome to Madrasa',
  staffJson: validStaffConfig,
};
const parsedProfileUpdate = updateMadrasaProfileSchema.safeParse(profileUpdatePayload);
assert(parsedProfileUpdate.success === true, 'updateMadrasaProfileSchema accepts staffJson');

// -------------------------------------------------------------
// Test 2: Tenant Isolation & Foreign ID Rejection
// -------------------------------------------------------------
console.log('\nTest 2: Verifying Tenant Isolation & Foreign Reference Checks');

// Mock database check simulating updateTenantProfile logic
function validateTenantStaffAndPhotos(madrasaId, staffJson, tenantUstadhDb, tenantFileDb) {
  if (!staffJson || !Array.isArray(staffJson.items)) return true;

  const ustadhIds = staffJson.items.map((it) => it.ustadhId).filter(Boolean);
  for (const uid of ustadhIds) {
    const exists = tenantUstadhDb.some((u) => u.id === uid && u.madrasaId === madrasaId);
    if (!exists) {
      throw new Error(`Ustadh ID ${uid} does not belong to this madrasa.`);
    }
  }

  const photoFileIds = staffJson.items.map((it) => it.photoFileId).filter(Boolean);
  for (const fid of photoFileIds) {
    const exists = tenantFileDb.some((f) => f.id === fid && f.madrasaId === madrasaId);
    if (!exists) {
      throw new Error(`Photo file ID ${fid} is invalid or does not belong to this madrasa.`);
    }
  }

  return true;
}

const mockUstadhDb = [
  { id: 'ust-t1-a', madrasaId: 'tenant-1', fullName: 'Sheikh Ahmad', isActive: true },
  { id: 'ust-t1-b', madrasaId: 'tenant-1', fullName: 'Ustadh Bilal', isActive: true },
  { id: 'ust-t2-c', madrasaId: 'tenant-2', fullName: 'Ustadh Tariq', isActive: true }, // Foreign tenant
];

const mockFileDb = [
  { id: 'file-t1-a', madrasaId: 'tenant-1', objectKey: 't1/photo.webp' },
  { id: 'file-t2-c', madrasaId: 'tenant-2', objectKey: 't2/photo.webp' }, // Foreign file
];

// Valid tenant 1 items
const tenant1StaffJson = {
  isEnabled: true,
  items: [
    { ustadhId: 'ust-t1-a', photoFileId: 'file-t1-a', isPublic: true, sortOrder: 0 },
  ],
};

let validTenantPass = false;
try {
  validTenantPass = validateTenantStaffAndPhotos('tenant-1', tenant1StaffJson, mockUstadhDb, mockFileDb);
} catch (e) {
  validTenantPass = false;
}
assert(validTenantPass === true, 'Tenant 1 staff and photo successfully validated');

// Foreign tenant ustadh injection attempt
const crossTenantUstadhPayload = {
  isEnabled: true,
  items: [
    { ustadhId: 'ust-t2-c', photoFileId: 'file-t1-a', isPublic: true, sortOrder: 0 },
  ],
};

let crossTenantRejected = false;
try {
  validateTenantStaffAndPhotos('tenant-1', crossTenantUstadhPayload, mockUstadhDb, mockFileDb);
} catch (e) {
  crossTenantRejected = true;
  assert(e.message.includes('does not belong to this madrasa'), 'Cross-tenant ustadh reference blocked');
}
assert(crossTenantRejected === true, 'Foreign tenant staff ID strictly rejected');

// Foreign tenant photo file injection attempt
const crossTenantPhotoPayload = {
  isEnabled: true,
  items: [
    { ustadhId: 'ust-t1-a', photoFileId: 'file-t2-c', isPublic: true, sortOrder: 0 },
  ],
};

let crossTenantPhotoRejected = false;
try {
  validateTenantStaffAndPhotos('tenant-1', crossTenantPhotoPayload, mockUstadhDb, mockFileDb);
} catch (e) {
  crossTenantPhotoRejected = true;
  assert(e.message.includes('invalid or does not belong'), 'Cross-tenant photo file reference blocked');
}
assert(crossTenantPhotoRejected === true, 'Foreign tenant photo reference strictly rejected');

// -------------------------------------------------------------
// Test 3: Accurate, Non-Overlapping Statistics
// -------------------------------------------------------------
console.log('\nTest 3: Verifying Non-Overlapping Database Statistics');

const mockStudents = [
  { id: 's1', madrasaId: 'tenant-1', status: 'ACTIVE' },
  { id: 's2', madrasaId: 'tenant-1', status: 'ACTIVE' },
  { id: 's3', madrasaId: 'tenant-1', status: 'INACTIVE' },
  { id: 's4', madrasaId: 'tenant-2', status: 'ACTIVE' }, // Foreign
];

const mockStaffRecords = [
  { id: 'u1', madrasaId: 'tenant-1', staffType: 'USTADH', isActive: true },
  { id: 'u2', madrasaId: 'tenant-1', staffType: 'USTADH', isActive: true },
  { id: 'u3', madrasaId: 'tenant-1', staffType: 'SCHOOL_TEACHER', isActive: true },
  { id: 'u4', madrasaId: 'tenant-1', staffType: 'USTADH', isActive: false }, // Inactive
  { id: 'u5', madrasaId: 'tenant-2', staffType: 'USTADH', isActive: true }, // Foreign
];

// Calculate tenant-1 counts
const tenantId = 'tenant-1';
const totalStudents = mockStudents.filter((s) => s.madrasaId === tenantId && s.status === 'ACTIVE').length;
const totalStaff = mockStaffRecords.filter((s) => s.madrasaId === tenantId && s.isActive === true).length;
const totalTeachers = mockStaffRecords.filter(
  (s) => s.madrasaId === tenantId && s.isActive === true && s.staffType === 'USTADH'
).length;

assert(totalStudents === 2, 'Total active students count is 2 (inactive and foreign excluded)');
assert(totalStaff === 3, 'Total active staff count is 3 (inactive and foreign excluded)');
assert(totalTeachers === 2, 'Total teachers with USTADH classification is 2 (excluding secular teacher)');
assert(totalTeachers <= totalStaff, 'Teachers count is a clean non-overlapping subset of total staff');

// -------------------------------------------------------------
// Test 4: Public API Privacy & Inactive Staff Exclusion
// -------------------------------------------------------------
console.log('\nTest 4: Verifying Public API Privacy & Inactive Profile Filtering');

// Simulating getPublicProfileBySlug resolution logic
function resolvePublicStaff(staffConfig, dbStaff) {
  if (!staffConfig || staffConfig.isEnabled === false || !Array.isArray(staffConfig.items)) {
    return null;
  }

  const publicItems = staffConfig.items
    .filter((it) => it && it.isPublic !== false && it.ustadhId)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const activeMap = new Map(
    dbStaff
      .filter((s) => s.isActive === true)
      .map((s) => [s.id, s])
  );

  const members = [];
  for (const item of publicItems) {
    const ustadh = activeMap.get(item.ustadhId);
    if (!ustadh) continue; // Inactive or departed staff dropped

    // Strict projection: NO private phone, email, salary, notes
    members.push({
      id: ustadh.id,
      fullName: ustadh.fullName,
      designation: item.designation || (ustadh.staffType === 'USTADH' ? 'Ustadh / Scholar' : 'Faculty Member'),
      department: item.department || null,
      qualification: item.qualification || null,
      experienceYears: item.experienceYears || null,
      bio: item.bio || null,
      photoUrl: item.photoUrl || null,
      sortOrder: item.sortOrder ?? 0,
    });
  }

  return {
    isEnabled: true,
    sectionTitle: staffConfig.sectionTitle || 'Our Scholarly Faculty & Mentors',
    sectionSubtitle: staffConfig.sectionSubtitle || 'Dedicated mentors',
    members,
  };
}

const detailedStaffInDb = [
  {
    id: 'u-active-1',
    madrasaId: 'tenant-1',
    fullName: 'Mawlana Farooq',
    staffType: 'USTADH',
    isActive: true,
    phoneNumber: '+94771234567', // Confidential
    whatsappNumber: '+94771234567', // Confidential
    email: 'private@madrasa.org', // Confidential
    baseMonthlySalary: 45000, // Confidential
    notes: 'Internal performance review notes', // Confidential
  },
  {
    id: 'u-inactive-2',
    madrasaId: 'tenant-1',
    fullName: 'Ustadh Zaid (Resigned)',
    staffType: 'USTADH',
    isActive: false, // Inactive
    phoneNumber: '+94779999999',
  },
];

const sampleStaffConfig = {
  isEnabled: true,
  showStats: true,
  items: [
    { ustadhId: 'u-active-1', isPublic: true, sortOrder: 0, designation: 'Principal', qualification: 'Al-Alim' },
    { ustadhId: 'u-inactive-2', isPublic: true, sortOrder: 1, designation: 'Former Teacher' },
  ],
};

const resolved = resolvePublicStaff(sampleStaffConfig, detailedStaffInDb);

assert(resolved !== null, 'Public staff object is returned when enabled');
assert(resolved.members.length === 1, 'Only active staff member is returned; inactive member is excluded');
assert(resolved.members[0].fullName === 'Mawlana Farooq', 'Active member full name is correct');

const exposedKeys = Object.keys(resolved.members[0]);
assert(!exposedKeys.includes('phoneNumber'), 'Confidential phoneNumber is stripped');
assert(!exposedKeys.includes('whatsappNumber'), 'Confidential whatsappNumber is stripped');
assert(!exposedKeys.includes('email'), 'Confidential email is stripped');
assert(!exposedKeys.includes('baseMonthlySalary'), 'Confidential baseMonthlySalary is stripped');
assert(!exposedKeys.includes('notes'), 'Confidential notes are stripped');

// Test disabling section
const disabledConfig = { ...sampleStaffConfig, isEnabled: false };
const resolvedDisabled = resolvePublicStaff(disabledConfig, detailedStaffInDb);
assert(resolvedDisabled === null, 'Staff section returns null when isEnabled is false');

// -------------------------------------------------------------
// Test 5: Summary Results
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
