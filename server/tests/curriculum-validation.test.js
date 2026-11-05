import test from 'node:test';
import assert from 'node:assert/strict';
import {
  curriculumPayloadSchema,
  updateMadrasaProfileSchema
} from '../src/validations/madrasa-profile.validation.js';
import { sanitizeCurriculumForPublic } from '../src/services/madrasa-profile.service.js';

test('Curriculum Validation & Security Suite', async (t) => {
  await t.test('1. Validates comprehensive General School & Islamic Education curriculum payload', () => {
    const validCurriculum = {
      categories: [
        { id: 'cat_school', label: 'General School Education', displayOrder: 1, isCustom: false },
        { id: 'cat_hifz', label: 'Hifz-ul-Quran', displayOrder: 2, isCustom: false },
        { id: 'cat_aalim', label: 'Aalim / Kitab Programme', displayOrder: 3, isCustom: false }
      ],
      programmes: [
        {
          id: 'prog_al',
          categoryId: 'cat_school',
          name: 'G.C.E. Advanced Level (A/L)',
          code: 'GCE-AL',
          description: 'Two-year pre-university secondary education pathway',
          durationYears: '2 Years',
          isPublished: true,
          displayOrder: 1,
          levels: [
            {
              id: 'lvl_al_sci',
              levelType: 'STREAM',
              levelLabel: 'Grade 12 - Physical Science',
              streamName: 'Physical Science',
              displayOrder: 1,
              subjects: [
                {
                  id: 'sub_comb_maths',
                  name: 'Combined Mathematics',
                  code: 'CMATH',
                  isOptional: false,
                  displayOrder: 1,
                  books: [
                    {
                      id: 'bk_pure_maths',
                      title: 'Pure Mathematics Part 1',
                      author: 'National Institute of Education (NIE)',
                      completionNotes: 'Covered in Terms 1-2',
                      displayOrder: 1,
                      chapters: ['Quadratic Functions', 'Complex Numbers']
                    },
                    {
                      id: 'bk_applied_maths',
                      title: 'Applied Mathematics - Statics & Dynamics',
                      author: 'NIE',
                      completionNotes: 'Covered in Term 3',
                      displayOrder: 2
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          id: 'prog_hifz',
          categoryId: 'cat_hifz',
          name: 'Tahfeez-ul-Quran (Full-time)',
          code: 'HIFZ-01',
          durationYears: 3,
          isPublished: false, // Unpublished draft
          displayOrder: 2,
          levels: [
            {
              id: 'lvl_hifz_y1',
              levelType: 'YEAR',
              levelLabel: 'Year 1 - Juz 1 to 10',
              displayOrder: 1,
              subjects: [
                {
                  id: 'sub_hifz_memorization',
                  name: 'Hifz Memorization & Tajweed',
                  isOptional: false,
                  displayOrder: 1,
                  books: [
                    {
                      id: 'bk_quran_uthmani',
                      title: 'Mushaf Al-Madinah (Uthmani Script)',
                      author: 'King Fahd Complex',
                      completionNotes: 'Target: Juz 1 to 10 with Tajweed',
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

    const parsed = curriculumPayloadSchema.parse(validCurriculum);
    assert.equal(parsed.programmes.length, 2);
    assert.equal(parsed.programmes[0].levels[0].subjects[0].books.length, 2);
    assert.equal(parsed.programmes[1].isPublished, false);
  });

  await t.test('2. Rejects invalid payloads exceeding length or schema constraints', () => {
    const invalidLevelType = {
      categories: [],
      programmes: [
        {
          id: 'prog_invalid',
          categoryId: 'cat_default',
          name: 'Invalid Level Test',
          levels: [
            {
              id: 'lvl_invalid',
              levelType: 'INVALID_TYPE_XYZ', // Invalid enum
              levelLabel: 'Test',
              subjects: []
            }
          ]
        }
      ]
    };

    assert.throws(() => curriculumPayloadSchema.parse(invalidLevelType));
  });

  await t.test('3. Privacy Guard: sanitizeCurriculumForPublic strictly exposes ONLY published programmes', () => {
    const mixedCurriculum = {
      categories: [
        { id: 'cat_school', label: 'General School', displayOrder: 1 },
        { id: 'cat_hifz', label: 'Hifz', displayOrder: 2 },
        { id: 'cat_empty', label: 'Unused Category', displayOrder: 3 }
      ],
      programmes: [
        {
          id: 'prog_public_al',
          categoryId: 'cat_school',
          name: 'G.C.E. Advanced Level',
          isPublished: true, // PUBLIC
          levels: [{ id: 'lvl_1', levelType: 'STREAM', levelLabel: 'Science', subjects: [] }]
        },
        {
          id: 'prog_secret_draft',
          categoryId: 'cat_hifz',
          name: 'Secret Draft Programme',
          isPublished: false, // DRAFT - MUST BE STRIPPED
          levels: [{ id: 'lvl_draft', levelType: 'YEAR', levelLabel: 'Draft Year', subjects: [] }]
        }
      ]
    };

    const sanitized = sanitizeCurriculumForPublic(mixedCurriculum);
    assert.ok(sanitized !== null);
    assert.equal(sanitized.programmes.length, 1);
    assert.equal(sanitized.programmes[0].id, 'prog_public_al');
    assert.equal(sanitized.programmes[0].name, 'G.C.E. Advanced Level');

    // Verify draft programme is NOT leaked
    assert.equal(sanitized.programmes.find(p => p.id === 'prog_secret_draft'), undefined);

    // Verify categories only include published category
    assert.equal(sanitized.categories.length, 1);
    assert.equal(sanitized.categories[0].id, 'cat_school');
    assert.equal(sanitized.categories.find(c => c.id === 'cat_hifz'), undefined);
    assert.equal(sanitized.categories.find(c => c.id === 'cat_empty'), undefined);
  });

  await t.test('4. Privacy Guard: returns null if NO programmes are published', () => {
    const allDrafts = {
      categories: [{ id: 'cat_hifz', label: 'Hifz', displayOrder: 1 }],
      programmes: [
        { id: 'prog_draft_1', categoryId: 'cat_hifz', name: 'Draft 1', isPublished: false, levels: [] },
        { id: 'prog_draft_2', categoryId: 'cat_hifz', name: 'Draft 2', isPublished: false, levels: [] }
      ]
    };

    const sanitized = sanitizeCurriculumForPublic(allDrafts);
    assert.equal(sanitized, null);
  });

  await t.test('5. Backward Compatibility: updateMadrasaProfileSchema preserves syllabusInfo with curriculumJson', () => {
    const updatePayload = {
      syllabusInfo: 'Legacy syllabus overview text preserved safely.',
      curriculumJson: {
        categories: [{ id: 'cat_school', label: 'School', displayOrder: 1 }],
        programmes: []
      }
    };

    const parsed = updateMadrasaProfileSchema.parse(updatePayload);
    assert.equal(parsed.syllabusInfo, 'Legacy syllabus overview text preserved safely.');
    assert.ok(parsed.curriculumJson !== undefined);
  });
});
