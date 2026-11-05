process.env.NODE_ENV = 'test';

import { prisma } from '../src/lib/prisma.js';
import { hashPassword } from '../src/utils/password.js';
import { signAccessToken } from '../src/utils/jwt.js';
import app from '../src/app.js';

const TEST_PREFIX = 'ann_test_' + Date.now();
let testPassedCount = 0;
let testFailedCount = 0;

function assert(condition, testName) {
  if (condition) {
    console.log('  ✓ [PASS] ' + testName);
    testPassedCount++;
  } else {
    console.error('  ✗ [FAIL] ' + testName);
    testFailedCount++;
  }
}

let testServer = null;
let baseUrl = '';

// Test fixtures
let superAdminUser = null;
let superAdminToken = '';

let madrasaA = null;
let madrasaAAdmin = null;
let madrasaAToken = '';

let madrasaB = null;
let madrasaBAdmin = null;
let madrasaBToken = '';

async function setup() {
  console.log('\n--- Setting Up Announcement Center Test Fixtures (madrasanexa_test) ---');

  const passwordHash = await hashPassword('TestP@ss1234!');

  // 1. Super Admin fixture
  superAdminUser = await prisma.user.create({
    data: {
      name: 'Super Admin Ann Tester',
      email: `${TEST_PREFIX}_super@test.com`,
      passwordHash,
      role: 'SUPER_ADMIN',
      madrasaId: null,
      isActive: true,
      mustChangePassword: false,
    },
  });

  superAdminToken = signAccessToken({
    userId: superAdminUser.id,
    role: superAdminUser.role,
    madrasaId: null,
  });

  // 2. Madrasa A fixture
  const randA = Math.random().toString(36).substring(2, 7).toUpperCase();
  madrasaA = await prisma.madrasa.create({
    data: {
      code: `MA_${randA}`,
      name: `Test Madrasa A (${TEST_PREFIX})`,
      slug: `${TEST_PREFIX}_slug_ma`,
      email: `${TEST_PREFIX}_ma@test.com`,
      status: 'ACTIVE',
      settings: {
        create: {
          currency: 'LKR',
          timezone: 'Asia/Colombo',
        },
      },
    },
  });

  madrasaAAdmin = await prisma.user.create({
    data: {
      name: 'Admin Madrasa A',
      email: `${TEST_PREFIX}_admin_a@test.com`,
      passwordHash,
      role: 'MADRASA_ADMIN',
      madrasaId: madrasaA.id,
      isActive: true,
      mustChangePassword: false,
    },
  });

  madrasaAToken = signAccessToken({
    userId: madrasaAAdmin.id,
    role: madrasaAAdmin.role,
    madrasaId: madrasaA.id,
  });

  // 3. Madrasa B fixture
  const randB = Math.random().toString(36).substring(2, 7).toUpperCase();
  madrasaB = await prisma.madrasa.create({
    data: {
      code: `MB_${randB}`,
      name: `Test Madrasa B (${TEST_PREFIX})`,
      slug: `${TEST_PREFIX}_slug_mb`,
      email: `${TEST_PREFIX}_mb@test.com`,
      status: 'ACTIVE',
      settings: {
        create: {
          currency: 'LKR',
          timezone: 'Asia/Colombo',
        },
      },
    },
  });

  madrasaBAdmin = await prisma.user.create({
    data: {
      name: 'Admin Madrasa B',
      email: `${TEST_PREFIX}_admin_b@test.com`,
      passwordHash,
      role: 'MADRASA_ADMIN',
      madrasaId: madrasaB.id,
      isActive: true,
      mustChangePassword: false,
    },
  });

  madrasaBToken = signAccessToken({
    userId: madrasaBAdmin.id,
    role: madrasaBAdmin.role,
    madrasaId: madrasaB.id,
  });

  // 4. Start isolated HTTP server
  await new Promise((resolve) => {
    testServer = app.listen(0, () => {
      const port = testServer.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });

  console.log(`Test server running at ${baseUrl}`);
  console.log('Fixtures initialized successfully.\n');
}

async function teardown() {
  console.log('\n--- Cleaning Up Announcement Center Test Fixtures ---');

  if (testServer) {
    await new Promise((resolve) => testServer.close(resolve));
  }

  try {
    // Clean up announcements created during tests
    await prisma.announcementRead.deleteMany({
      where: {
        user: {
          email: { startsWith: TEST_PREFIX },
        },
      },
    });

    await prisma.announcementMadrasa.deleteMany({
      where: {
        madrasa: {
          email: { startsWith: TEST_PREFIX },
        },
      },
    });

    await prisma.announcement.deleteMany({
      where: {
        title: { contains: TEST_PREFIX },
      },
    });

    await prisma.activityLog.deleteMany({
      where: {
        user: {
          email: { startsWith: TEST_PREFIX },
        },
      },
    });

    // Clean up users and madrasas
    await prisma.user.deleteMany({
      where: {
        email: { startsWith: TEST_PREFIX },
      },
    });

    await prisma.madrasaSetting.deleteMany({
      where: {
        madrasa: {
          email: { startsWith: TEST_PREFIX },
        },
      },
    });

    await prisma.madrasa.deleteMany({
      where: {
        email: { startsWith: TEST_PREFIX },
      },
    });

    console.log('Teardown complete.');
  } catch (err) {
    console.error('Error during test teardown:', err);
  }
}

async function runTests() {
  try {
    await setup();

    let draftId = null;
    let selectedAnnId = null;
    let globalAnnId = null;
    let scheduledAnnId = null;
    let expiredAnnId = null;

    // =========================================================================
    // SECTION 1: SUPER ADMIN ANNOUNCEMENT MANAGEMENT (Tests 1 - 17)
    // =========================================================================
    console.log('[TEST GROUP 1: Super Admin Announcement Management]');

    // 1. Create Draft
    {
      const res = await fetch(`${baseUrl}/api/super-admin/announcements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({
          title: `Initial Draft ${TEST_PREFIX}`,
          message: 'This is a test draft message for the announcement center.',
          category: 'MAINTENANCE',
          priority: 'IMPORTANT',
          audience: 'ALL_MADRASAS',
        }),
      });

      const body = await res.json();
      assert(res.status === 201, '1.1 POST /announcements returns 201 Created');
      assert(body.data?.status === 'DRAFT', '1.2 Announcement status is DRAFT');
      assert(body.data?.publishedAt === null, '1.3 publishedAt is null on draft');
      assert(body.data?.title.includes(TEST_PREFIX), '1.4 Title persisted correctly');
      draftId = body.data?.id;
    }

    // 2. Update Draft (effective merged state)
    {
      const res = await fetch(`${baseUrl}/api/super-admin/announcements/${draftId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({
          title: `Updated Draft Title ${TEST_PREFIX}`,
          priority: 'URGENT',
        }),
      });

      const body = await res.json();
      assert(res.status === 200, '2.1 PUT /announcements/:id returns 200');
      assert(body.data?.title === `Updated Draft Title ${TEST_PREFIX}`, '2.2 Effective title updated');
      assert(body.data?.priority === 'URGENT', '2.3 Effective priority updated');
      assert(body.data?.message === 'This is a test draft message for the announcement center.', '2.4 Unmodified message preserved via effective merge');
    }

    // 3. Get Detail
    {
      const res = await fetch(`${baseUrl}/api/super-admin/announcements/${draftId}`, {
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });
      const body = await res.json();
      assert(res.status === 200, '3.1 GET /announcements/:id returns 200');
      assert(body.data?.id === draftId, '3.2 Detail id matches');
      assert(body.data?.readCount === 0, '3.3 Reports readCount (distinct users) correctly');
      assert(typeof body.data?.targetMadrasaCount === 'number', '3.4 Reports targetMadrasaCount explicitly');
    }

    // 4. List with Summary Counts
    {
      const res = await fetch(`${baseUrl}/api/super-admin/announcements?limit=5`, {
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });
      const body = await res.json();
      assert(res.status === 200, '4.1 GET /announcements returns 200');
      assert(Array.isArray(body.data?.announcements), '4.2 Announcements array returned');
      assert(typeof body.data?.counts?.total === 'number', '4.3 Total count returned');
      assert(typeof body.data?.counts?.draft === 'number', '4.4 Draft count returned');
      assert(typeof body.data?.counts?.published === 'number', '4.5 Published count returned');
      assert(typeof body.data?.counts?.archived === 'number', '4.6 Archived count returned');
    }

    // 5. Search
    {
      const res = await fetch(`${baseUrl}/api/super-admin/announcements?search=${encodeURIComponent(TEST_PREFIX)}`, {
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });
      const body = await res.json();
      assert(res.status === 200, '5.1 Search returns 200');
      assert(body.data?.announcements.length >= 1, '5.2 Found announcement matching search query');
    }

    // 6. Filtering
    {
      const res = await fetch(`${baseUrl}/api/super-admin/announcements?status=DRAFT&priority=URGENT`, {
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });
      const body = await res.json();
      assert(res.status === 200, '6.1 Filter returns 200');
      assert(body.data?.announcements.every((a) => a.status === 'DRAFT' && a.priority === 'URGENT'), '6.2 Filter matches only DRAFT + URGENT');
    }

    // 7. Pagination
    {
      const res = await fetch(`${baseUrl}/api/super-admin/announcements?page=1&limit=2`, {
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });
      const body = await res.json();
      assert(res.status === 200, '7.1 Pagination returns 200');
      assert(body.data?.pagination?.page === 1, '7.2 Pagination page is 1');
      assert(body.data?.pagination?.limit === 2, '7.3 Pagination limit is 2');
      assert(typeof body.data?.pagination?.totalPages === 'number', '7.4 totalPages returned');
    }

    // 8. Publish Immediately via explicit POST /publish
    {
      const res = await fetch(`${baseUrl}/api/super-admin/announcements/${draftId}/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({}),
      });
      const body = await res.json();
      assert(res.status === 200, '8.1 POST /:id/publish returns 200');
      assert(body.data?.status === 'PUBLISHED', '8.2 Status transitions to PUBLISHED');
      assert(body.data?.publishedAt !== null, '8.3 publishedAt timestamp recorded');
      assert(body.data?.publishAt === null, '8.4 publishAt is null (immediate)');
      globalAnnId = draftId;
    }

    // 9. Scheduled Publication
    {
      const futureDate = new Date(Date.now() + 86400000).toISOString(); // +1 day
      const createRes = await fetch(`${baseUrl}/api/super-admin/announcements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({
          title: `Scheduled Announcement ${TEST_PREFIX}`,
          message: 'Will be visible tomorrow.',
          category: 'UPDATE',
          priority: 'NORMAL',
          audience: 'ALL_MADRASAS',
        }),
      });
      const createBody = await createRes.json();
      scheduledAnnId = createBody.data?.id;

      const pubRes = await fetch(`${baseUrl}/api/super-admin/announcements/${scheduledAnnId}/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({
          publishAt: futureDate,
        }),
      });
      const pubBody = await pubRes.json();
      assert(pubRes.status === 200, '9.1 Scheduled publish returns 200');
      assert(pubBody.data?.status === 'PUBLISHED', '9.2 Scheduled status is PUBLISHED');
      assert(pubBody.data?.isScheduled === true, '9.3 isScheduled is true');
      assert(new Date(pubBody.data?.publishAt) > new Date(), '9.4 publishAt is in the future');
    }

    // 10. Expiry Validation
    {
      const pastDate = new Date(Date.now() - 3600000).toISOString(); // -1 hour
      const futurePublish = new Date(Date.now() + 7200000).toISOString(); // +2 hours
      const earlierExpiry = new Date(Date.now() + 3600000).toISOString(); // +1 hour (before publish!)

      // 10a: Expiry before publish rejected with 400
      const rejectRes = await fetch(`${baseUrl}/api/super-admin/announcements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({
          title: `Invalid Expiry ${TEST_PREFIX}`,
          message: 'Invalid timing',
          publishAt: futurePublish,
          expiresAt: earlierExpiry,
        }),
      });
      assert(rejectRes.status === 400, '10.1 Expiry before publish rejected with 400');

      // 10b: Create expired announcement for visibility test
      const expCreate = await fetch(`${baseUrl}/api/super-admin/announcements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({
          title: `Expired Notice ${TEST_PREFIX}`,
          message: 'This notice has expired.',
          category: 'GENERAL',
          audience: 'ALL_MADRASAS',
        }),
      });
      const expBody = await expCreate.json();
      expiredAnnId = expBody.data?.id;

      // Force expired status in test DB
      await prisma.announcement.update({
        where: { id: expiredAnnId },
        data: {
          status: 'PUBLISHED',
          publishedAt: new Date(Date.now() - 7200000),
          publishAt: new Date(Date.now() - 7200000),
          expiresAt: new Date(Date.now() - 3600000),
        },
      });
      assert(true, '10.2 Expired announcement prepared in test DB');
    }

    // 11. Archive & 409 Conflict Semantics
    {
      const arcCreate = await fetch(`${baseUrl}/api/super-admin/announcements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({
          title: `Archived Test ${TEST_PREFIX}`,
          message: 'To be archived.',
          category: 'GENERAL',
        }),
      });
      const arcBody = await arcCreate.json();
      const toArchiveId = arcBody.data?.id;

      // 11a: Archive
      const arcRes = await fetch(`${baseUrl}/api/super-admin/announcements/${toArchiveId}/archive`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });
      assert(arcRes.status === 200, '11.1 POST /:id/archive returns 200');

      // 11b: Attempting to edit archived returns 409
      const editArcRes = await fetch(`${baseUrl}/api/super-admin/announcements/${toArchiveId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({ title: 'New Title' }),
      });
      assert(editArcRes.status === 409, '11.2 Editing archived announcement returns 409 Conflict');

      // 11c: Attempting to publish archived returns 409
      const pubArcRes = await fetch(`${baseUrl}/api/super-admin/announcements/${toArchiveId}/publish`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });
      assert(pubArcRes.status === 409, '11.3 Publishing archived announcement returns 409 Conflict');
    }

    // 12. ALL_MADRASAS Targeting
    {
      const res = await fetch(`${baseUrl}/api/super-admin/announcements/${globalAnnId}`, {
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });
      const body = await res.json();
      assert(body.data?.audience === 'ALL_MADRASAS', '12.1 Global announcement audience is ALL_MADRASAS');
      assert(body.data?.targets.length === 0, '12.2 Global announcement has zero target relation rows (clean)');
    }

    // 13. SELECTED_MADRASAS Targeting
    {
      const res = await fetch(`${baseUrl}/api/super-admin/announcements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({
          title: `Selected Notice for Madrasa A ${TEST_PREFIX}`,
          message: 'Notice meant strictly for Madrasa A.',
          category: 'BILLING',
          priority: 'URGENT',
          audience: 'SELECTED_MADRASAS',
          selectedMadrasaIds: [madrasaA.id],
        }),
      });
      const body = await res.json();
      assert(res.status === 201, '13.1 Targeted announcement created with 201');
      assert(body.data?.audience === 'SELECTED_MADRASAS', '13.2 Audience is SELECTED_MADRASAS');
      assert(body.data?.targets.length === 1, '13.3 Exactly 1 target relation attached');
      assert(body.data?.targets[0]?.madrasaId === madrasaA.id, '13.4 Target madrasaId matches Madrasa A');
      selectedAnnId = body.data?.id;

      // Publish targeted announcement
      await fetch(`${baseUrl}/api/super-admin/announcements/${selectedAnnId}/publish`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });
    }

    // 14. Invalid Madrasa ID Rejection
    {
      const res = await fetch(`${baseUrl}/api/super-admin/announcements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({
          title: `Fake Target ${TEST_PREFIX}`,
          message: 'Invalid target ID test',
          audience: 'SELECTED_MADRASAS',
          selectedMadrasaIds: ['non_existent_madrasa_id_123'],
        }),
      });
      assert(res.status === 400, '14.1 Non-existent Madrasa ID rejected with 400');
    }

    // 15. Duplicate Selected Madrasa IDs Deduplicated Safely
    {
      const res = await fetch(`${baseUrl}/api/super-admin/announcements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({
          title: `Deduplicate Test ${TEST_PREFIX}`,
          message: 'Duplicate ID test',
          audience: 'SELECTED_MADRASAS',
          selectedMadrasaIds: [madrasaA.id, madrasaA.id, madrasaA.id],
        }),
      });
      const body = await res.json();
      assert(res.status === 201, '15.1 Duplicate IDs handled without crash (201 Created)');
      assert(body.data?.targets.length === 1, '15.2 Duplicate IDs deduplicated to exactly 1');
    }

    // 16. Audience Switch Cleanup
    {
      const switchTestRes = await fetch(`${baseUrl}/api/super-admin/announcements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({
          title: `Audience Switch Test ${TEST_PREFIX}`,
          message: 'Starting as selected, switching to all',
          audience: 'SELECTED_MADRASAS',
          selectedMadrasaIds: [madrasaA.id],
        }),
      });
      const switchBody = await switchTestRes.json();
      const switchId = switchBody.data?.id;

      // Switch to ALL_MADRASAS
      const updateRes = await fetch(`${baseUrl}/api/super-admin/announcements/${switchId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({
          audience: 'ALL_MADRASAS',
        }),
      });
      const updateBody = await updateRes.json();
      assert(updateRes.status === 200, '16.1 Switch to ALL_MADRASAS returns 200');
      assert(updateBody.data?.audience === 'ALL_MADRASAS', '16.2 Audience updated to ALL_MADRASAS');
      assert(updateBody.data?.targets.length === 0, '16.3 Stale target relations purged atomically');
    }

    // 17. ActivityLog Events
    {
      const logs = await prisma.activityLog.findMany({
        where: {
          action: { in: ['ANNOUNCEMENT_CREATED', 'ANNOUNCEMENT_UPDATED', 'ANNOUNCEMENT_PUBLISHED', 'ANNOUNCEMENT_ARCHIVED'] },
          userId: superAdminUser.id,
        },
      });
      assert(logs.length >= 4, '17.1 Platform ActivityLog events created for lifecycle actions');
      assert(logs.every((l) => l.madrasaId === null), '17.2 ActivityLogs have madrasaId = null (platform scope)');
    }

    // =========================================================================
    // SECTION 2: MADRASA ADMIN VISIBILITY & SECURITY (Tests 18 - 30)
    // =========================================================================
    console.log('\n[TEST GROUP 2: Madrasa Admin Visibility & Multi-Tenant Isolation]');

    // 18. Madrasa Admin Sees Global Announcement
    {
      const res = await fetch(`${baseUrl}/api/madrasa-admin/announcements`, {
        headers: { Authorization: `Bearer ${madrasaAToken}` },
      });
      const body = await res.json();
      assert(res.status === 200, '18.1 GET /madrasa-admin/announcements returns 200');
      const foundGlobal = body.data?.announcements.some((a) => a.id === globalAnnId);
      assert(foundGlobal, '18.2 Madrasa A sees published global announcement');
    }

    // 19. Madrasa Admin Sees Own Selected-Target Announcement
    {
      const res = await fetch(`${baseUrl}/api/madrasa-admin/announcements`, {
        headers: { Authorization: `Bearer ${madrasaAToken}` },
      });
      const body = await res.json();
      const foundSelected = body.data?.announcements.some((a) => a.id === selectedAnnId);
      assert(foundSelected, '19.1 Madrasa A sees announcement targeted specifically to Madrasa A');
    }

    // 20. Madrasa B Does NOT See Madrasa A's Announcement (Multi-Tenant Isolation)
    {
      const res = await fetch(`${baseUrl}/api/madrasa-admin/announcements`, {
        headers: { Authorization: `Bearer ${madrasaBToken}` },
      });
      const body = await res.json();
      const leakedToB = body.data?.announcements.some((a) => a.id === selectedAnnId);
      assert(!leakedToB, '20.1 Madrasa B does NOT see announcement targeted only to Madrasa A');
    }

    // 21. Direct ID Cross-Tenant Access Blocked (IDOR Prevention -> 404)
    {
      const res = await fetch(`${baseUrl}/api/madrasa-admin/announcements/${selectedAnnId}`, {
        headers: { Authorization: `Bearer ${madrasaBToken}` },
      });
      assert(res.status === 404, '21.1 Cross-tenant direct ID access blocked with generic 404');
    }

    // 22. Draft Invisible to Madrasa Admin
    {
      const draftTest = await fetch(`${baseUrl}/api/super-admin/announcements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({
          title: `Secret Draft ${TEST_PREFIX}`,
          message: 'Never visible to tenant',
          audience: 'ALL_MADRASAS',
        }),
      });
      const draftBody = await draftTest.json();
      const hiddenDraftId = draftBody.data?.id;

      // Try list
      const listRes = await fetch(`${baseUrl}/api/madrasa-admin/announcements`, {
        headers: { Authorization: `Bearer ${madrasaAToken}` },
      });
      const listBody = await listRes.json();
      assert(!listBody.data?.announcements.some((a) => a.id === hiddenDraftId), '22.1 Draft excluded from Madrasa Admin list');

      // Try direct ID
      const directRes = await fetch(`${baseUrl}/api/madrasa-admin/announcements/${hiddenDraftId}`, {
        headers: { Authorization: `Bearer ${madrasaAToken}` },
      });
      assert(directRes.status === 404, '22.2 Draft direct-ID access returns generic 404');
    }

    // 23. Archived Invisible to Madrasa Admin
    {
      // Archive globalAnnId temporarily
      await fetch(`${baseUrl}/api/super-admin/announcements/${globalAnnId}/archive`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });

      const listRes = await fetch(`${baseUrl}/api/madrasa-admin/announcements`, {
        headers: { Authorization: `Bearer ${madrasaAToken}` },
      });
      const listBody = await listRes.json();
      assert(!listBody.data?.announcements.some((a) => a.id === globalAnnId), '23.1 Archived excluded from Madrasa Admin feed');

      const directRes = await fetch(`${baseUrl}/api/madrasa-admin/announcements/${globalAnnId}`, {
        headers: { Authorization: `Bearer ${madrasaAToken}` },
      });
      assert(directRes.status === 404, '23.2 Archived direct ID returns 404');

      // Restore to PUBLISHED in test DB for subsequent read tests
      await prisma.announcement.update({
        where: { id: globalAnnId },
        data: { status: 'PUBLISHED' },
      });
    }

    // 24. Future Scheduled Announcement Invisible
    {
      const listRes = await fetch(`${baseUrl}/api/madrasa-admin/announcements`, {
        headers: { Authorization: `Bearer ${madrasaAToken}` },
      });
      const listBody = await listRes.json();
      assert(!listBody.data?.announcements.some((a) => a.id === scheduledAnnId), '24.1 Future scheduled announcement invisible in feed');

      const directRes = await fetch(`${baseUrl}/api/madrasa-admin/announcements/${scheduledAnnId}`, {
        headers: { Authorization: `Bearer ${madrasaAToken}` },
      });
      assert(directRes.status === 404, '24.2 Future scheduled announcement direct ID returns 404');
    }

    // 25. Scheduled Announcement Visible After Effective Time
    {
      // Set publishAt to past in test DB
      await prisma.announcement.update({
        where: { id: scheduledAnnId },
        data: { publishAt: new Date(Date.now() - 60000) },
      });

      const listRes = await fetch(`${baseUrl}/api/madrasa-admin/announcements`, {
        headers: { Authorization: `Bearer ${madrasaAToken}` },
      });
      const listBody = await listRes.json();
      assert(listBody.data?.announcements.some((a) => a.id === scheduledAnnId), '25.1 Scheduled announcement becomes visible after publishAt passes');
    }

    // 26. Expired Announcement Invisible
    {
      const listRes = await fetch(`${baseUrl}/api/madrasa-admin/announcements`, {
        headers: { Authorization: `Bearer ${madrasaAToken}` },
      });
      const listBody = await listRes.json();
      assert(!listBody.data?.announcements.some((a) => a.id === expiredAnnId), '26.1 Expired announcement invisible in feed');

      const directRes = await fetch(`${baseUrl}/api/madrasa-admin/announcements/${expiredAnnId}`, {
        headers: { Authorization: `Bearer ${madrasaAToken}` },
      });
      assert(directRes.status === 404, '26.2 Expired announcement direct ID returns 404');
    }

    // 27. Unread Count Accuracy
    let initialUnread = 0;
    {
      const res = await fetch(`${baseUrl}/api/madrasa-admin/announcements/unread-count`, {
        headers: { Authorization: `Bearer ${madrasaAToken}` },
      });
      const body = await res.json();
      assert(res.status === 200, '27.1 GET /unread-count returns 200');
      assert(typeof body.data?.unreadCount === 'number', '27.2 unreadCount is a number');
      assert(body.data?.unreadCount >= 2, '27.3 Unread count reflects visible unread announcements');
      initialUnread = body.data?.unreadCount;
    }

    // 28. Mark-Read Success
    {
      const res = await fetch(`${baseUrl}/api/madrasa-admin/announcements/${selectedAnnId}/read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${madrasaAToken}` },
      });
      const body = await res.json();
      assert(res.status === 200, '28.1 POST /:id/read returns 200');
      assert(Boolean(body.data?.readAt), '28.2 readAt timestamp returned');
    }

    // 29. Mark-Read Idempotent
    {
      const res = await fetch(`${baseUrl}/api/madrasa-admin/announcements/${selectedAnnId}/read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${madrasaAToken}` },
      });
      assert(res.status === 200, '29.1 Repeated mark-read is idempotent (200 OK)');
    }

    // 30. Read Announcement Decrements Unread Count
    {
      const res = await fetch(`${baseUrl}/api/madrasa-admin/announcements/unread-count`, {
        headers: { Authorization: `Bearer ${madrasaAToken}` },
      });
      const body = await res.json();
      assert(body.data?.unreadCount === initialUnread - 1, '30.1 Unread count decrements by exactly 1 after reading');

      // Check readStatus filter
      const unreadListRes = await fetch(`${baseUrl}/api/madrasa-admin/announcements?readStatus=UNREAD`, {
        headers: { Authorization: `Bearer ${madrasaAToken}` },
      });
      const unreadBody = await unreadListRes.json();
      assert(!unreadBody.data?.announcements.some((a) => a.id === selectedAnnId), '30.2 Read announcement excluded from readStatus=UNREAD query');
    }

    // 30.1. Mark All As Read Bulk Operation
    {
      // Madrasa A marks all remaining unread as read
      const res = await fetch(`${baseUrl}/api/madrasa-admin/announcements/mark-all-read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${madrasaAToken}` },
      });
      const body = await res.json();
      assert(res.status === 200, '30.1.1 POST /mark-all-read returns 200 OK');
      assert(typeof body.data?.markedCount === 'number', '30.1.2 markedCount is returned as a number');
      assert(body.data?.markedCount >= 1, '30.1.3 At least 1 announcement was marked as read');

      // Check unread count is now 0 for Madrasa A
      const countRes = await fetch(`${baseUrl}/api/madrasa-admin/announcements/unread-count`, {
        headers: { Authorization: `Bearer ${madrasaAToken}` },
      });
      const countBody = await countRes.json();
      assert(countBody.data?.unreadCount === 0, '30.1.4 Madrasa A unreadCount is now 0');

      // Calling mark-all-read again is idempotent (markedCount === 0)
      const repeatRes = await fetch(`${baseUrl}/api/madrasa-admin/announcements/mark-all-read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${madrasaAToken}` },
      });
      const repeatBody = await repeatRes.json();
      assert(repeatRes.status === 200, '30.1.5 Repeat POST /mark-all-read is 200 OK');
      assert(repeatBody.data?.markedCount === 0, '30.1.6 Repeat call markedCount is 0 (idempotent)');

      // Multi-tenant isolation: Madrasa A mark-all does NOT mark unread for Madrasa B
      const madrasaBCountRes = await fetch(`${baseUrl}/api/madrasa-admin/announcements/unread-count`, {
        headers: { Authorization: `Bearer ${madrasaBToken}` },
      });
      const madrasaBCountBody = await madrasaBCountRes.json();
      assert(madrasaBCountBody.data?.unreadCount > 0, '30.1.7 Madrasa B unread announcements remain unread (no cross-tenant leakage)');
    }

    // =========================================================================
    // SECTION 3: ROLE & PERMISSION SECURITY (Tests 31 - 37)
    // =========================================================================
    console.log('\n[TEST GROUP 3: Role & Permission Security]');

    // 31. Unauthenticated Super Admin Routes Denied
    {
      const res = await fetch(`${baseUrl}/api/super-admin/announcements`);
      assert(res.status === 401, '31.1 Unauthenticated Super Admin request rejected with 401');
    }

    // 32. Madrasa Admin Cannot Create Announcements
    {
      const res = await fetch(`${baseUrl}/api/super-admin/announcements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${madrasaAToken}`,
        },
        body: JSON.stringify({
          title: 'Illegal Create',
          message: 'From tenant',
        }),
      });
      assert(res.status === 403, '32.1 Madrasa Admin POST /super-admin/announcements denied with 403');
    }

    // 33. Madrasa Admin Cannot Edit Announcements
    {
      const res = await fetch(`${baseUrl}/api/super-admin/announcements/${globalAnnId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${madrasaAToken}`,
        },
        body: JSON.stringify({ title: 'Illegal Edit' }),
      });
      assert(res.status === 403, '33.1 Madrasa Admin PUT /super-admin/announcements/:id denied with 403');
    }

    // 34. Madrasa Admin Cannot Publish Announcements
    {
      const res = await fetch(`${baseUrl}/api/super-admin/announcements/${globalAnnId}/publish`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${madrasaAToken}` },
      });
      assert(res.status === 403, '34.1 Madrasa Admin POST /publish denied with 403');
    }

    // 35. Madrasa Admin Cannot Archive Announcements
    {
      const res = await fetch(`${baseUrl}/api/super-admin/announcements/${globalAnnId}/archive`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${madrasaAToken}` },
      });
      assert(res.status === 403, '35.1 Madrasa Admin POST /archive denied with 403');
    }

    // 36. Arbitrary madrasaId Cannot Bypass Targeting
    {
      // Madrasa B tries to pass ?madrasaId=madrasaA.id
      const res = await fetch(`${baseUrl}/api/madrasa-admin/announcements?madrasaId=${madrasaA.id}`, {
        headers: { Authorization: `Bearer ${madrasaBToken}` },
      });
      const body = await res.json();
      assert(!body.data?.announcements.some((a) => a.id === selectedAnnId), '36.1 Client query madrasaId ignored; Madrasa B still cannot see Madrasa A target');
    }

    // 37. Zero Cross-Tenant Data Leakage
    {
      const res = await fetch(`${baseUrl}/api/madrasa-admin/announcements/${globalAnnId}`, {
        headers: { Authorization: `Bearer ${madrasaAToken}` },
      });
      const body = await res.json();
      assert(body.data?.targets === undefined, '37.1 Internal target relations omitted from tenant response');
      assert(body.data?.createdById === undefined, '37.2 Super Admin internal metadata omitted from tenant response');
    }

  } catch (err) {
    console.error('Fatal Test Runner Error:', err);
    testFailedCount++;
  } finally {
    await teardown();
  }

  console.log(`\n==================================================`);
  console.log(`ANNOUNCEMENT CENTER TEST RESULTS`);
  console.log(`Passed: ${testPassedCount}`);
  console.log(`Failed: ${testFailedCount}`);
  console.log(`==================================================\n`);

  if (testFailedCount > 0) {
    process.exit(1);
  }
}

runTests();
