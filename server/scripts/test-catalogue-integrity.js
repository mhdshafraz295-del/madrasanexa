import assert from 'assert';
import {
  FEATURE_CATALOGUE,
  FEATURE_CATEGORIES,
  FEATURE_MAP,
  FEATURE_KEYS_ALL,
  FEATURE_KEYS_IMPLEMENTED,
  FEATURE_KEYS_CORE,
  FEATURE_KEYS_PARTIALLY_IMPLEMENTED,
  FEATURE_KEYS_PLANNED,
  FEATURE_STATUS,
  isFeatureKeyValid,
  isFeatureAssignable,
  getFeatureByKey,
  getFeaturesByCategory,
} from '../src/constants/feature-catalogue.js';

console.log('--- RUNNING FEATURE CATALOGUE INTEGRITY TESTS ---');

// 1. Total features count
assert.strictEqual(FEATURE_CATALOGUE.length, 91, 'FEATURE_CATALOGUE must contain exactly 91 features');
assert.strictEqual(FEATURE_KEYS_ALL.length, 91, 'FEATURE_KEYS_ALL must contain exactly 91 keys');
assert.strictEqual(FEATURE_MAP.size, 91, 'FEATURE_MAP must contain exactly 91 entries');
console.log('✔ Total feature count is exactly 91');

// 2. Status distribution
assert.strictEqual(FEATURE_KEYS_IMPLEMENTED.length, 61, 'Exactly 61 features must be IMPLEMENTED');
assert.strictEqual(FEATURE_KEYS_CORE.length, 20, 'Exactly 20 features must be CORE');
assert.strictEqual(FEATURE_KEYS_PARTIALLY_IMPLEMENTED.length, 4, 'Exactly 4 features must be PARTIALLY_IMPLEMENTED');
assert.strictEqual(FEATURE_KEYS_PLANNED.length, 6, 'Exactly 6 features must be PLANNED');
console.log('✔ Status distribution matches exactly (61 Implemented, 20 Core, 4 Partial, 6 Planned)');

// 3. Category count & resolution
assert.strictEqual(FEATURE_CATEGORIES.length, 20, 'Exactly 20 categories must exist');
const categoryNumbers = new Set(FEATURE_CATEGORIES.map((c) => c.number));
assert.strictEqual(categoryNumbers.size, 20, 'All 20 category numbers must be unique');
for (let i = 1; i <= 20; i++) {
  assert.ok(categoryNumbers.has(i), `Category number ${i} must exist`);
}
for (const f of FEATURE_CATALOGUE) {
  assert.ok(categoryNumbers.has(f.categoryNumber), `Feature ${f.key} references invalid category number ${f.categoryNumber}`);
}
console.log('✔ Category metadata is consistent across all 20 categories');

// 4. No duplicate keys
const seenKeys = new Set();
for (const f of FEATURE_CATALOGUE) {
  assert.ok(!seenKeys.has(f.key), `Duplicate key detected: ${f.key}`);
  seenKeys.add(f.key);
}
console.log('✔ No duplicate feature keys exist');

// 5. isAssignable agrees with status
for (const f of FEATURE_CATALOGUE) {
  if (f.status === FEATURE_STATUS.IMPLEMENTED) {
    assert.strictEqual(f.isAssignable, true, `${f.key} must be assignable`);
    assert.strictEqual(isFeatureAssignable(f.key), true, `isFeatureAssignable(${f.key}) must be true`);
  } else {
    assert.strictEqual(f.isAssignable, false, `${f.key} must NOT be assignable`);
    assert.strictEqual(isFeatureAssignable(f.key), false, `isFeatureAssignable(${f.key}) must be false`);
  }
  assert.strictEqual(isFeatureKeyValid(f.key), true, `isFeatureKeyValid(${f.key}) must be true`);
  assert.strictEqual(getFeatureByKey(f.key).key, f.key, `getFeatureByKey(${f.key}) must resolve`);
}
console.log('✔ isAssignable derived correctly for all 91 features');

// 6. Test invalid keys
assert.strictEqual(isFeatureKeyValid('NON_EXISTENT_KEY'), false);
assert.strictEqual(isFeatureAssignable('NON_EXISTENT_KEY'), false);
assert.strictEqual(getFeatureByKey('NON_EXISTENT_KEY'), null);
console.log('✔ Invalid key lookups handled correctly');

// 7. Grouped categories
const grouped = getFeaturesByCategory();
assert.strictEqual(grouped.length, 20);
const totalInGrouped = grouped.reduce((sum, g) => sum + g.features.length, 0);
assert.strictEqual(totalInGrouped, 91, 'Grouped features count must be 91');
console.log('✔ getFeaturesByCategory() successfully groups all 91 features');

// 8. Match against Batch 1 live seeded 61 keys
import { prisma } from '../src/lib/prisma.js';
const goldPlan = await prisma.plan.findUnique({
  where: { code: '540202_GOLD' },
  include: { planFeatures: true },
});
assert.ok(goldPlan, 'Dynamic Gold Tier plan must exist in DB');
assert.strictEqual(goldPlan.planFeatures.length, 61, 'Gold plan must have 61 features seeded');

const dbFeatureKeys = new Set(goldPlan.planFeatures.map((pf) => pf.featureKey));
for (const key of FEATURE_KEYS_IMPLEMENTED) {
  assert.ok(dbFeatureKeys.has(key), `Seeded DB plan missing key ${key}`);
}
for (const key of dbFeatureKeys) {
  assert.ok(FEATURE_KEYS_IMPLEMENTED.includes(key), `DB contains unexpected key ${key}`);
}
console.log('✔ All 61 IMPLEMENTED keys in catalogue match 100% with the live DB seeded features of Dynamic Gold Tier');

console.log('\n--- ALL FEATURE CATALOGUE INTEGRITY TESTS PASSED SUCCESSFULLY! ---\n');
await prisma.$disconnect();
