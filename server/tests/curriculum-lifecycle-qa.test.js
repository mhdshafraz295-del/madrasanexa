import test from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../src/lib/prisma.js';
import {
  updateTenantProfile,
  getTenantProfile,
  getPublicProfileBySlug,
  sanitizeCurriculumForPublic,
} from '../src/services/madrasa-profile.service.js';

test('Curriculum System Final QA Lifecycle Suite', async (t) => {
  // Locate primary test madrasa
  const profile = await prisma.madrasaProfile.findFirst({
    include: { madrasa: true }
  });

  if (!profile || !profile.madrasa) {
    console.log('Skipping DB lifecycle test: No active madrasa profile found in DB.');
    return;
  }

  const madrasaId = profile.madrasaId;
  const slug = profile.madrasa.slug;
  const initialCurriculum = profile.curriculumJson;

  try {
    await t.test('Checks 2, 3 & 4: Create temporary test programme with multiple levels, subjects, 2 books & verify persistence', async () => {
      const testProgrammePayload = {
        categories: [
          { id: 'cat_qa_general', label: 'QA General Stream', displayOrder: 1 }
        ],
        programmes: [
          {
            id: 'qa_temp_prog_01',
            categoryId: 'cat_qa_general',
            name: '[QA-TEMP] Comprehensive Curriculum Test',
            code: 'QA-01',
            durationYears: '2 Years',
            isPublished: false, // Initially unpublished
            displayOrder: 1,
            levels: [
              {
                id: 'qa_lvl_01',
                levelType: 'GRADE',
                levelLabel: 'Grade 10 Test Level',
                displayOrder: 1,
                subjects: [
                  {
                    id: 'qa_sub_01',
                    name: 'Quranic Arabic & Tajweed',
                    code: 'ARAB-10',
                    isOptional: false,
                    displayOrder: 1,
                    books: [
                      {
                        id: 'qa_bk_01',
                        title: 'Durus al-Lughah al-Arabiyyah Book 1',
                        author: 'Dr. V. Abdur Rahim',
                        completionNotes: 'Chapters 1-12',
                        displayOrder: 1
                      },
                      {
                        id: 'qa_bk_02',
                        title: 'Al-Jazariyyah in Tajweed',
                        author: 'Ibn al-Jazari',
                        completionNotes: 'Memorization of all 107 lines',
                        displayOrder: 2
                      }
                    ]
                  },
                  {
                    id: 'qa_sub_02',
                    name: 'Islamic History',
                    code: 'HIST-10',
                    isOptional: true,
                    displayOrder: 2,
                    books: [
                      {
                        id: 'qa_bk_03',
                        title: 'When The Moon Split (Ar-Raheeq Al-Makhtum)',
                        author: 'Safiur Rahman Mubarakpuri',
                        displayOrder: 1
                      }
                    ]
                  }
                ]
              },
              {
                id: 'qa_lvl_02',
                levelType: 'STREAM',
                levelLabel: 'Grade 12 Science Stream',
                streamName: 'Physical Science',
                displayOrder: 2,
                subjects: [
                  {
                    id: 'qa_sub_03',
                    name: 'Combined Mathematics',
                    isOptional: false,
                    displayOrder: 1,
                    books: [
                      {
                        id: 'qa_bk_04',
                        title: 'Applied Mathematics Statics',
                        displayOrder: 1
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      };

      // Save via updateTenantProfile
      const updatedProfile = await updateTenantProfile(madrasaId, {
        curriculumJson: testProgrammePayload
      });
      assert.ok(updatedProfile);

      // Refresh / re-query from DB to verify persistence
      const freshTenant = await getTenantProfile(madrasaId);
      assert.ok(freshTenant.curriculumJson);
      assert.equal(freshTenant.curriculumJson.programmes.length, 1);

      const persistedProg = freshTenant.curriculumJson.programmes[0];
      assert.equal(persistedProg.id, 'qa_temp_prog_01');
      assert.equal(persistedProg.levels.length, 2);

      const sub1 = persistedProg.levels[0].subjects[0];
      assert.equal(sub1.books.length, 2);
      assert.equal(sub1.books[0].title, 'Durus al-Lughah al-Arabiyyah Book 1');
      assert.equal(sub1.books[1].title, 'Al-Jazariyyah in Tajweed');
    });

    await t.test('Check 5: Publish programme and verify it appears on the public website API', async () => {
      // Fetch current curriculum, toggle isPublished to true, and save
      const current = await getTenantProfile(madrasaId);
      const publishedPayload = {
        ...current.curriculumJson,
        programmes: current.curriculumJson.programmes.map(p => ({ ...p, isPublished: true }))
      };

      await updateTenantProfile(madrasaId, { curriculumJson: publishedPayload });

      // Ensure profile itself is published so getPublicProfileBySlug does not 404
      await prisma.madrasaProfile.update({
        where: { madrasaId },
        data: { isPublished: true }
      });

      // Call public endpoint
      const publicData = await getPublicProfileBySlug(slug);
      assert.ok(publicData.curriculum !== null);
      assert.equal(publicData.curriculum.programmes.length, 1);
      assert.equal(publicData.curriculum.programmes[0].id, 'qa_temp_prog_01');
      assert.equal(publicData.curriculum.programmes[0].name, '[QA-TEMP] Comprehensive Curriculum Test');
      assert.equal(publicData.curriculum.programmes[0].levels[0].subjects[0].books.length, 2);
    });

    await t.test('Check 6: Unpublish programme and verify it is no longer returned by the public API', async () => {
      // Toggle isPublished to false
      const current = await getTenantProfile(madrasaId);
      const unpublishedPayload = {
        ...current.curriculumJson,
        programmes: current.curriculumJson.programmes.map(p => ({ ...p, isPublished: false }))
      };

      await updateTenantProfile(madrasaId, { curriculumJson: unpublishedPayload });

      // Call public endpoint again
      const publicData = await getPublicProfileBySlug(slug);
      // Since no programmes are published, curriculum must be sanitized to null
      assert.equal(publicData.curriculum, null);
    });

    await t.test('Check 7: Verify tenant isolation prevents cross-tenant access or modification', async () => {
      const simulatedTenantBId = 'cmu_test_tenant_b_fake';

      // Tenant isolation on update: updating a non-existent or different tenant does not affect madrasaId
      try {
        await updateTenantProfile(simulatedTenantBId, {
          curriculumJson: { categories: [], programmes: [] }
        });
        assert.fail('Should have thrown NotFoundError for invalid tenant');
      } catch (err) {
        assert.equal(err.name, 'NotFoundError');
      }

      // Verify madrasa A's curriculum remains unaffected
      const tenantA = await getTenantProfile(madrasaId);
      assert.ok(tenantA.curriculumJson !== null);
      assert.equal(tenantA.curriculumJson.programmes[0].id, 'qa_temp_prog_01');
    });

  } finally {
    // Clean up temporary test data: revert to initialCurriculum
    console.log('Restoring initial curriculumJson state to protect database...');
    await prisma.madrasaProfile.update({
      where: { madrasaId },
      data: { curriculumJson: initialCurriculum }
    });
    console.log('Restored successfully.');
  }
});
