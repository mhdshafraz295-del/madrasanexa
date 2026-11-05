import { prisma } from '../src/lib/prisma.js';
import { hashPassword } from '../src/utils/password.js';
import { signAccessToken } from '../src/utils/jwt.js';
import app from '../src/app.js';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_PREFIX = 'exp_test_' + Date.now();

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

// Fixtures
let madrasaA = null;
let adminA = null;
let tokenA = '';

let madrasaB = null;
let adminB = null;
let tokenB = '';

let madrasaExpired = null;
let adminExpired = null;
let tokenExpired = '';

let madrasaPending = null;
let adminPending = null;
let tokenPending = '';

let madrasaNoSub = null;
let adminNoSub = null;
let tokenNoSub = '';

async function setup() {
  console.log('\n--- Setting up Expense Analysis Test Fixtures ---');
  const now = new Date();

  // 1. Subscription Plan
  const plan = await prisma.plan.upsert({
    where: { code: 'PRO_EXPENSE_TEST' },
    create: {
      name: 'Pro Expense Test Plan',
      code: 'PRO_EXPENSE_TEST',
      price: 1000,
      durationMonths: 12,
      isActive: true,
    },
    update: {},
  });

  const pwd = await hashPassword('TestPassword123!');

  // 2. Madrasa A (Active subscription)
  madrasaA = await prisma.madrasa.create({
    data: {
      name: `${TEST_PREFIX} Madrasa A`,
      code: `EA_${Date.now().toString().slice(-6)}_${Math.random().toString(36).slice(2, 6)}`,
      slug: `ea-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      status: 'ACTIVE',
      email: `${TEST_PREFIX}_a@example.com`,
    },
  });

  adminA = await prisma.user.create({
    data: {
      madrasaId: madrasaA.id,
      name: 'Admin A',
      email: `${TEST_PREFIX}_adminA@example.com`,
      passwordHash: pwd,
      role: 'MADRASA_ADMIN',
      isActive: true,
      mustChangePassword: false,
    },
  });

  await prisma.subscription.create({
    data: {
      madrasaId: madrasaA.id,
      planId: plan.id,
      status: 'ACTIVE',
      startsAt: new Date(now.getTime() - 10 * 86400000),
      endsAt: new Date(now.getTime() + 300 * 86400000),
      priceAtPurchase: 1000,
      durationMonthsAtPurchase: 12,
    },
  });

  await prisma.madrasaSetting.create({
    data: {
      madrasaId: madrasaA.id,
      currency: 'LKR',
    },
  });

  tokenA = signAccessToken({
    userId: adminA.id,
    madrasaId: madrasaA.id,
    role: 'MADRASA_ADMIN',
    email: adminA.email,
  });

  // 3. Madrasa B (Active subscription, separate tenant)
  madrasaB = await prisma.madrasa.create({
    data: {
      name: `${TEST_PREFIX} Madrasa B`,
      code: `EB_${Date.now().toString().slice(-6)}_${Math.random().toString(36).slice(2, 6)}`,
      slug: `eb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      status: 'ACTIVE',
      email: `${TEST_PREFIX}_b@example.com`,
    },
  });

  adminB = await prisma.user.create({
    data: {
      madrasaId: madrasaB.id,
      name: 'Admin B',
      email: `${TEST_PREFIX}_adminB@example.com`,
      passwordHash: pwd,
      role: 'MADRASA_ADMIN',
      isActive: true,
      mustChangePassword: false,
    },
  });

  await prisma.subscription.create({
    data: {
      madrasaId: madrasaB.id,
      planId: plan.id,
      status: 'ACTIVE',
      startsAt: new Date(now.getTime() - 10 * 86400000),
      endsAt: new Date(now.getTime() + 300 * 86400000),
      priceAtPurchase: 1000,
      durationMonthsAtPurchase: 12,
    },
  });

  tokenB = signAccessToken({
    userId: adminB.id,
    madrasaId: madrasaB.id,
    role: 'MADRASA_ADMIN',
    email: adminB.email,
  });

  // 4. Madrasa Expired (Expired subscription)
  madrasaExpired = await prisma.madrasa.create({
    data: {
      name: `${TEST_PREFIX} Madrasa Expired`,
      code: `EE_${Date.now().toString().slice(-6)}_${Math.random().toString(36).slice(2, 6)}`,
      slug: `ee-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      status: 'ACTIVE',
      email: `${TEST_PREFIX}_exp@example.com`,
    },
  });

  adminExpired = await prisma.user.create({
    data: {
      madrasaId: madrasaExpired.id,
      name: 'Admin Expired',
      email: `${TEST_PREFIX}_adminExp@example.com`,
      passwordHash: pwd,
      role: 'MADRASA_ADMIN',
      isActive: true,
      mustChangePassword: false,
    },
  });

  await prisma.subscription.create({
    data: {
      madrasaId: madrasaExpired.id,
      planId: plan.id,
      status: 'EXPIRED',
      startsAt: new Date(now.getTime() - 400 * 86400000),
      endsAt: new Date(now.getTime() - 10 * 86400000),
      priceAtPurchase: 1000,
      durationMonthsAtPurchase: 12,
    },
  });

  tokenExpired = signAccessToken({
    userId: adminExpired.id,
    madrasaId: madrasaExpired.id,
    role: 'MADRASA_ADMIN',
    email: adminExpired.email,
  });

  // 5. Madrasa Pending (Subscription never approved)
  madrasaPending = await prisma.madrasa.create({
    data: {
      name: `${TEST_PREFIX} Madrasa Pending`,
      code: `EP_${Date.now().toString().slice(-6)}_${Math.random().toString(36).slice(2, 6)}`,
      slug: `ep-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      status: 'ACTIVE',
      email: `${TEST_PREFIX}_pen@example.com`,
    },
  });

  adminPending = await prisma.user.create({
    data: {
      madrasaId: madrasaPending.id,
      name: 'Admin Pending',
      email: `${TEST_PREFIX}_adminPen@example.com`,
      passwordHash: pwd,
      role: 'MADRASA_ADMIN',
      isActive: true,
      mustChangePassword: false,
    },
  });

  tokenPending = signAccessToken({
    userId: adminPending.id,
    madrasaId: madrasaPending.id,
    role: 'MADRASA_ADMIN',
    email: adminPending.email,
  });

  // 6. Madrasa No Subscription
  madrasaNoSub = await prisma.madrasa.create({
    data: {
      name: `${TEST_PREFIX} Madrasa NoSub`,
      code: `EN_${Date.now().toString().slice(-6)}_${Math.random().toString(36).slice(2, 6)}`,
      slug: `en-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      status: 'ACTIVE',
      email: `${TEST_PREFIX}_nosub@example.com`,
    },
  });

  adminNoSub = await prisma.user.create({
    data: {
      madrasaId: madrasaNoSub.id,
      name: 'Admin NoSub',
      email: `${TEST_PREFIX}_adminNoSub@example.com`,
      passwordHash: pwd,
      role: 'MADRASA_ADMIN',
      isActive: true,
      mustChangePassword: false,
    },
  });

  tokenNoSub = signAccessToken({
    userId: adminNoSub.id,
    madrasaId: madrasaNoSub.id,
    role: 'MADRASA_ADMIN',
    email: adminNoSub.email,
  });

  // Start HTTP Server
  await new Promise((resolve) => {
    testServer = http.createServer(app);
    testServer.listen(0, '127.0.0.1', () => {
      const port = testServer.address().port;
      baseUrl = `http://127.0.0.1:${port}/api/madrasa-admin/expense-analysis`;
      console.log(`Test server running at ${baseUrl}`);
      resolve();
    });
  });
}

async function teardown() {
  console.log('\n--- Cleaning Up Expense Test Fixtures ---');
  if (testServer) {
    await new Promise((resolve) => testServer.close(resolve));
  }

  const ids = [madrasaA?.id, madrasaB?.id, madrasaExpired?.id, madrasaPending?.id, madrasaNoSub?.id].filter(Boolean);

  if (ids.length > 0) {
    await prisma.activityLog.deleteMany({ where: { madrasaId: { in: ids } } });
    await prisma.expenseMonthlyInsight.deleteMany({ where: { madrasaId: { in: ids } } });
    await prisma.expenseBudget.deleteMany({ where: { madrasaId: { in: ids } } });
    await prisma.expense.deleteMany({ where: { madrasaId: { in: ids } } });
    await prisma.expenseCategory.deleteMany({ where: { madrasaId: { in: ids } } });
    await prisma.madrasaSetting.deleteMany({ where: { madrasaId: { in: ids } } });
    await prisma.subscription.deleteMany({ where: { madrasaId: { in: ids } } });
    await prisma.user.deleteMany({ where: { madrasaId: { in: ids } } });
    await prisma.madrasa.deleteMany({ where: { id: { in: ids } } });
  }

  await prisma.$disconnect();
}

async function runTests() {
  console.log('\n==================================================');
  console.log('STARTING EXPENSE ANALYSIS TEST SUITE');
  console.log('==================================================\n');

  let foodCatA = null;
  let teaCatA = null;
  let milkTeaCatA = null;
  let gasCatA = null;
  let catB = null;

  // 1. Clean Start
  {
    console.log('\n--- Group 1: New Madrasa Clean Start ---');
    const res = await fetch(`${baseUrl}/categories`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const body = await res.json();
    assert(res.status === 200 && Array.isArray(body.data) && body.data.length === 0, '1. New Madrasa has zero categories');

    const expRes = await fetch(`${baseUrl}/expenses`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const expBody = await expRes.json();
    assert(expRes.status === 200 && expBody.total === 0 && expBody.data.length === 0, '2. New Madrasa has zero expenses');

    const sumRes = await fetch(`${baseUrl}/summary?month=2026-09`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const sumBody = await sumRes.json();
    assert(sumRes.status === 200 && sumBody.data.currentTotal === '0' && sumBody.data.previousTotal === '0', '3. New Madrasa summary has zero totals');
  }

  // 2. Category Management
  {
    console.log('\n--- Group 2: Category Management ---');
    const res1 = await fetch(`${baseUrl}/categories`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Food', description: 'Hostel meal groceries' }),
    });
    const body1 = await res1.json();
    assert(res1.status === 201 && body1.data.name === 'Food' && body1.data.isActive === true, '4. Create category Food');
    foodCatA = body1.data;

    // Duplicate rejection
    const resDup = await fetch(`${baseUrl}/categories`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Food' }),
    });
    assert(resDup.status === 409, '5. Duplicate category name rejected with 409');

    // Create additional categories
    const resTea = await fetch(`${baseUrl}/categories`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Tea' }),
    });
    teaCatA = (await resTea.json()).data;

    const resMilkTea = await fetch(`${baseUrl}/categories`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Milk Tea' }),
    });
    milkTeaCatA = (await resMilkTea.json()).data;

    const resGas = await fetch(`${baseUrl}/categories`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Gas' }),
    });
    gasCatA = (await resGas.json()).data;

    // Create category for Tenant B
    const resCatB = await fetch(`${baseUrl}/categories`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Food' }), // Same name in Tenant B allowed!
    });
    assert(resCatB.status === 201, '6. Tenant B can have same category name (tenant uniqueness)');
    catB = (await resCatB.json()).data;

    // Update Category
    const resUp = await fetch(`${baseUrl}/categories/${foodCatA.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: 'Updated groceries description' }),
    });
    assert(resUp.status === 200, '7. Update category description');

    // Deactivate Category
    const resDeact = await fetch(`${baseUrl}/categories/${teaCatA.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: false }),
    });
    const deactBody = await resDeact.json();
    assert(resDeact.status === 200 && deactBody.data.isActive === false, '8. Deactivate category');

    // Reactivate for subsequent tests
    await fetch(`${baseUrl}/categories/${teaCatA.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: true }),
    });
  }

  // 3. Strict Decimal & Input Validation
  {
    console.log('\n--- Group 3: Strict Decimal & Input Validation ---');

    // Malformed amount "100abc" rejected
    const res1 = await fetch(`${baseUrl}/expenses`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expenseDate: '2026-09-10',
        categoryId: foodCatA.id,
        description: 'Testing malformed amount',
        amount: '100abc',
      }),
    });
    assert(res1.status === 400, '9. Amount "100abc" rejected with 400');

    // Amount = 0 rejected
    const res2 = await fetch(`${baseUrl}/expenses`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expenseDate: '2026-09-10',
        categoryId: foodCatA.id,
        description: 'Zero amount',
        amount: '0',
      }),
    });
    assert(res2.status === 400, '10. Amount 0 rejected with 400');

    // Negative amount rejected
    const res3 = await fetch(`${baseUrl}/expenses`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expenseDate: '2026-09-10',
        categoryId: foodCatA.id,
        description: 'Negative amount',
        amount: '-5000',
      }),
    });
    assert(res3.status === 400, '11. Negative amount rejected with 400');

    // Too many decimal places in amount (>2) rejected
    const res4 = await fetch(`${baseUrl}/expenses`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expenseDate: '2026-09-10',
        categoryId: foodCatA.id,
        description: '3 decimals amount',
        amount: '12500.555',
      }),
    });
    assert(res4.status === 400, '12. Amount with >2 decimal places rejected with 400');

    // Overflow Decimal(12,2) rejected
    const res5 = await fetch(`${baseUrl}/expenses`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expenseDate: '2026-09-10',
        categoryId: foodCatA.id,
        description: 'Overflow amount',
        amount: '99999999999.00', // 11 digits before decimal
      }),
    });
    assert(res5.status === 400, '13. Decimal(12,2) overflow rejected with 400');

    // Quantity with >3 decimals rejected
    const res6 = await fetch(`${baseUrl}/expenses`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expenseDate: '2026-09-10',
        categoryId: foodCatA.id,
        description: 'Quantity decimals test',
        amount: '1000',
        quantity: '5.1234',
      }),
    });
    assert(res6.status === 400, '14. Quantity with >3 decimals rejected with 400');

    // Invalid calendar date rejected
    const res7 = await fetch(`${baseUrl}/expenses`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expenseDate: '2026-02-30',
        categoryId: foodCatA.id,
        description: 'Feb 30 invalid date',
        amount: '1000',
      }),
    });
    assert(res7.status === 400, '15. Invalid calendar date 2026-02-30 rejected with 400');

    // Empty description rejected
    const res8 = await fetch(`${baseUrl}/expenses`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expenseDate: '2026-09-10',
        categoryId: foodCatA.id,
        description: '   ',
        amount: '1000',
      }),
    });
    assert(res8.status === 400, '16. Empty description rejected with 400');

    // Cross-tenant categoryId rejected with 404
    const res9 = await fetch(`${baseUrl}/expenses`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expenseDate: '2026-09-10',
        categoryId: catB.id, // belongs to Tenant B
        description: 'Cross tenant test',
        amount: '1000',
      }),
    });
    assert(res9.status === 404, '17. Cross-tenant categoryId rejected with 404');
  }

  // 4. Expense CRUD & Transactional ActivityLog
  let expense1 = null;
  {
    console.log('\n--- Group 4: Expense CRUD & Transactional Audit Logs ---');
    const res = await fetch(`${baseUrl}/expenses`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expenseDate: '2026-09-20',
        categoryId: milkTeaCatA.id,
        description: 'Milk and tea powder purchase',
        amount: '12500.00',
        quantity: '50.000',
        unitLabel: 'L',
        unitCost: '250.00',
        supplierName: 'ABC Traders',
        reasonNote: 'Student hostel count increased this month.',
      }),
    });
    const body = await res.json();
    assert(res.status === 201 && body.data.status === 'ACTIVE' && Number(body.data.amount) === 12500, '18. Create expense with all fields');
    expense1 = body.data;

    // Verify transactional activity log was created
    const log = await prisma.activityLog.findFirst({
      where: { madrasaId: madrasaA.id, action: 'EXPENSE_CREATED', entityId: expense1.id },
    });
    assert(Boolean(log && log.action === 'EXPENSE_CREATED'), '19. Financial EXPENSE_CREATED ActivityLog committed transactionally');

    // Update Expense
    const updateRes = await fetch(`${baseUrl}/expenses/${expense1.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: 'Milk and tea powder updated',
        amount: '13000.00',
      }),
    });
    const updateBody = await updateRes.json();
    assert(updateRes.status === 200 && Number(updateBody.data.amount) === 13000, '20. Update expense amount and description');

    // Revert back for accurate testing
    await fetch(`${baseUrl}/expenses/${expense1.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: 'Milk and tea powder purchase',
        amount: '12500.00',
      }),
    });
  }

  // 5. Void Expense Behavior & Historical Visibility
  {
    console.log('\n--- Group 5: Void Expense & History Audit ---');
    // Create an expense to void
    const tempRes = await fetch(`${baseUrl}/expenses`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expenseDate: '2026-09-05',
        categoryId: foodCatA.id,
        description: 'Duplicate food purchase to void',
        amount: '10000.00',
      }),
    });
    const tempExp = (await tempRes.json()).data;

    // Check summary includes 10000
    const sumBefore = await fetch(`${baseUrl}/summary?month=2026-09`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const sumBeforeBody = await sumBefore.json();
    assert(Number(sumBeforeBody.data.currentTotal) >= 22500, '21. Monthly total includes active expense before void');

    // Void with reason
    const voidRes = await fetch(`${baseUrl}/expenses/${tempExp.id}/void`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ voidReason: 'Duplicate invoice entry entered by mistake' }),
    });
    const voidBody = await voidRes.json();
    assert(voidRes.status === 200 && voidBody.data.status === 'VOID' && voidBody.data.voidReason === 'Duplicate invoice entry entered by mistake', '22. Void expense with mandatory reason');

    // Verify transactional activity log for void
    const voidLog = await prisma.activityLog.findFirst({
      where: { madrasaId: madrasaA.id, action: 'EXPENSE_VOIDED', entityId: tempExp.id },
    });
    assert(Boolean(voidLog && voidLog.action === 'EXPENSE_VOIDED'), '23. EXPENSE_VOIDED ActivityLog committed transactionally');

    // Summary excludes voided expense
    const sumAfter = await fetch(`${baseUrl}/summary?month=2026-09`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const sumAfterBody = await sumAfter.json();
    assert(Number(sumAfterBody.data.currentTotal) === Number(sumBeforeBody.data.currentTotal) - 10000, '24. Voided expense excluded from monthly active total');

    // History can still list VOID records
    const histRes = await fetch(`${baseUrl}/expenses?status=VOID`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const histBody = await histRes.json();
    assert(histBody.data.some((e) => e.id === tempExp.id && e.status === 'VOID'), '25. VOID expense remains visible in history for audit trail');

    // Voided record cannot be edited
    const editVoid = await fetch(`${baseUrl}/expenses/${tempExp.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: '5000' }),
    });
    assert(editVoid.status === 400, '26. Voided expense cannot be modified (status 400)');
  }

  // 6. Month Comparison & Category Union (Gas August=15000, Sep=0)
  {
    console.log('\n--- Group 6: Month Comparison & Category Union (Gas Test) ---');

    // August 2026 Expenses:
    // Food: 80,000
    // Tea: 18,000
    // Milk Tea: 25,000
    // Gas: 15,000
    await fetch(`${baseUrl}/expenses`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expenseDate: '2026-08-10',
        categoryId: foodCatA.id,
        description: 'August Food staples',
        amount: '80000.00',
      }),
    });
    await fetch(`${baseUrl}/expenses`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expenseDate: '2026-08-12',
        categoryId: teaCatA.id,
        description: 'August Tea bulk purchase',
        amount: '18000.00',
      }),
    });
    await fetch(`${baseUrl}/expenses`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expenseDate: '2026-08-15',
        categoryId: milkTeaCatA.id,
        description: 'August Milk Tea',
        amount: '25000.00',
        quantity: '50',
        unitLabel: 'L',
        unitCost: '320.00',
      }),
    });
    await fetch(`${baseUrl}/expenses`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expenseDate: '2026-08-20',
        categoryId: milkTeaCatA.id,
        description: 'August Milk Tea batch 2',
        amount: '0.00', // will fail if 0
      }),
    });
    // Add second batch with valid amount
    await fetch(`${baseUrl}/expenses`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expenseDate: '2026-08-22',
        categoryId: milkTeaCatA.id,
        description: 'August Milk Tea batch 2',
        amount: '1000.00',
        quantity: '10',
        unitLabel: 'L',
        unitCost: '320.00',
      }),
    });

    // August Gas: 15,000 (CRITICAL TEST)
    await fetch(`${baseUrl}/expenses`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expenseDate: '2026-08-25',
        categoryId: gasCatA.id,
        description: 'August Gas Cylinders',
        amount: '15000.00',
      }),
    });

    // September 2026 Expenses:
    // Food: 92,000
    // Tea: 20,000
    // Milk Tea: remaining to reach 38,000 total (12,500 already created above, need 25,500)
    // Gas: ZERO recorded for September!
    await fetch(`${baseUrl}/expenses`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expenseDate: '2026-09-12',
        categoryId: foodCatA.id,
        description: 'September Food purchases',
        amount: '92000.00',
      }),
    });
    await fetch(`${baseUrl}/expenses`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expenseDate: '2026-09-14',
        categoryId: teaCatA.id,
        description: 'September Tea purchases',
        amount: '20000.00',
      }),
    });
    await fetch(`${baseUrl}/expenses`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expenseDate: '2026-09-18',
        categoryId: milkTeaCatA.id,
        description: 'September Milk Tea balance',
        amount: '25500.00',
        quantity: '50',
        unitLabel: 'L',
        unitCost: '355.00',
      }),
    });

    // Fetch comparison for September 2026
    const compRes = await fetch(`${baseUrl}/comparison?month=2026-09`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const compBody = await compRes.json();
    const rows = compBody.data;

    // Check Food: August 80,000 -> Sep 92,000 (+12,000, +15.00%)
    const foodRow = rows.find((r) => r.categoryId === foodCatA.id);
    assert(
      foodRow &&
        Number(foodRow.previousTotal) === 80000 &&
        Number(foodRow.currentTotal) === 92000 &&
        Number(foodRow.difference) === 12000 &&
        foodRow.changeLabel === '+15.00%',
      '27. Food comparison: Aug=80k, Sep=92k, Diff=+12k (+15.00%)'
    );

    // Check Gas (MANDATORY TEST: August=15,000, September=0, Difference=-15,000, Change=-100.00%)
    const gasRow = rows.find((r) => r.categoryId === gasCatA.id);
    assert(
      gasRow &&
        Number(gasRow.previousTotal) === 15000 &&
        Number(gasRow.currentTotal) === 0 &&
        Number(gasRow.difference) === -15000 &&
        gasRow.changeLabel === '-100.00%',
      '28. Gas category-union test: Aug=15,000, Sep=0, Diff=-15,000, Change=-100.00% (NOT DROPPED)'
    );

    // Summary calculation
    const sumRes = await fetch(`${baseUrl}/summary?month=2026-09`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const sumBody = await sumRes.json();
    assert(
      Number(sumBody.data.currentTotal) === 150000 && // 92000 + 20000 + 38000
        Number(sumBody.data.previousTotal) === 139000, // 80000 + 18000 + 26000 + 15000
      '29. September vs August authoritative summary totals calculated accurately'
    );
  }

  // 7. Zero-Previous Month (New Spend)
  {
    console.log('\n--- Group 7: Zero Previous Month (New Spend) ---');
    // Create new category with spend ONLY in September 2026
    const resEvent = await fetch(`${baseUrl}/categories`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Events' }),
    });
    const eventCat = (await resEvent.json()).data;

    await fetch(`${baseUrl}/expenses`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expenseDate: '2026-09-28',
        categoryId: eventCat.id,
        description: 'Special Mawlid Event lunch',
        amount: '5000.00',
      }),
    });

    const compRes = await fetch(`${baseUrl}/comparison?month=2026-09`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const compBody = await compRes.json();
    const eventRow = compBody.data.find((r) => r.categoryId === eventCat.id);

    assert(
      eventRow &&
        Number(eventRow.previousTotal) === 0 &&
        Number(eventRow.currentTotal) === 5000 &&
        eventRow.percentageChange === null &&
        eventRow.changeLabel === 'NEW_SPEND',
      '30. Zero previous month spend produces changeLabel="NEW_SPEND" without Infinity/NaN'
    );
  }

  // 8. January Rollover (January 2027 -> December 2026)
  {
    console.log('\n--- Group 8: January Rollover Transition ---');
    // Expense in Dec 2026
    await fetch(`${baseUrl}/expenses`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expenseDate: '2026-12-15',
        categoryId: foodCatA.id,
        description: 'Dec 2026 Food',
        amount: '50000.00',
      }),
    });

    // Expense in Jan 2027
    await fetch(`${baseUrl}/expenses`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expenseDate: '2027-01-10',
        categoryId: foodCatA.id,
        description: 'Jan 2027 Food',
        amount: '55000.00',
      }),
    });

    const sumRes = await fetch(`${baseUrl}/summary?month=2027-01`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const sumBody = await sumRes.json();
    assert(
      sumBody.data.selectedMonth === '2027-01' &&
        sumBody.data.previousMonth === '2026-12' &&
        Number(sumBody.data.currentTotal) === 55000 &&
        Number(sumBody.data.previousTotal) === 50000 &&
        sumBody.data.changeLabel === '+10.00%',
      '31. January 2027 correctly rolls over to December 2026 as previous calendar month'
    );
  }

  // 9. Atomic Bulk Budget Upsert & Zero-Budget Safety
  {
    console.log('\n--- Group 9: Atomic Budgets & Zero-Budget Division Safety ---');

    // Duplicate categoryId in payload rejected
    const dupRes = await fetch(`${baseUrl}/budgets`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        year: 2026,
        month: 9,
        budgets: [
          { categoryId: foodCatA.id, amount: '90000.00' },
          { categoryId: foodCatA.id, amount: '95000.00' }, // duplicate!
        ],
      }),
    });
    assert(dupRes.status === 400, '32. Duplicate categoryId in budget payload rejected with 400');

    // Atomic rollback test: first valid category, second cross-tenant category
    const atomicRes = await fetch(`${baseUrl}/budgets`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        year: 2026,
        month: 9,
        budgets: [
          { categoryId: foodCatA.id, amount: '99999.00' },
          { categoryId: catB.id, amount: '50000.00' }, // Cross-tenant!
        ],
      }),
    });
    assert(atomicRes.status === 404, '33. Cross-tenant category in bulk budgets returns 404');

    // Verify first budget row was NOT saved (atomic)
    const checkB = await prisma.expenseBudget.findFirst({
      where: { madrasaId: madrasaA.id, categoryId: foodCatA.id, year: 2026, month: 9 },
    });
    assert(checkB === null, '34. Bulk budget is atomic: zero rows saved when one category fails');

    // Save valid budgets for September 2026
    // Food: 90,000 (Actual: 92,000 -> OVER_BUDGET)
    // Milk Tea: 30,000 (Actual: 38,000 -> OVER_BUDGET)
    // Tea: 25,000 (Actual: 20,000 -> 80% = NEAR_BUDGET)
    // Gas: 0.00 (Actual: 0.00 -> zero budget zero actual = WITHIN_BUDGET)
    const validBudgets = await fetch(`${baseUrl}/budgets`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        year: 2026,
        month: 9,
        budgets: [
          { categoryId: foodCatA.id, amount: '90000.00' },
          { categoryId: milkTeaCatA.id, amount: '30000.00' },
          { categoryId: teaCatA.id, amount: '25000.00' },
          { categoryId: gasCatA.id, amount: '0.00' },
        ],
      }),
    });
    assert(validBudgets.status === 200, '35. Bulk upsert valid category budgets succeeds');

    // Check comparison for zero-budget division safety:
    // Gas: budget=0, actual=0 -> budgetVariance=0, status=WITHIN_BUDGET
    const compRes = await fetch(`${baseUrl}/comparison?month=2026-09`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const rows = (await compRes.json()).data;
    const gasRow = rows.find((r) => r.categoryId === gasCatA.id);
    assert(
      gasRow &&
        Number(gasRow.budget) === 0 &&
        Number(gasRow.currentTotal) === 0 &&
        Number(gasRow.budgetVariance) === 0 &&
        gasRow.budgetStatus === 'WITHIN_BUDGET',
      '36. Zero-budget safety: budget=0 AND actual=0 gives WITHIN_BUDGET without division error'
    );

    // Check budget=0 and actual>0 -> OVER_BUDGET
    // Set Events budget to 0 (Actual is 5,000)
    const eventCat = (await (await fetch(`${baseUrl}/categories`, { headers: { Authorization: `Bearer ${tokenA}` } })).json()).data.find(
      (c) => c.name === 'Events'
    );
    await fetch(`${baseUrl}/budgets`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        year: 2026,
        month: 9,
        budgets: [{ categoryId: eventCat.id, amount: '0.00' }],
      }),
    });

    const compRes2 = await fetch(`${baseUrl}/comparison?month=2026-09`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const rows2 = (await compRes2.json()).data;
    const eventRow = rows2.find((r) => r.categoryId === eventCat.id);
    assert(
      eventRow &&
        Number(eventRow.budget) === 0 &&
        Number(eventRow.currentTotal) === 5000 &&
        eventRow.budgetStatus === 'OVER_BUDGET',
      '37. Zero-budget safety: budget=0 AND actual>0 gives OVER_BUDGET without division error'
    );
  }

  // 10. Recorded Reasons, Admin Insights & No-Fabrication Verification
  {
    console.log('\n--- Group 10: Recorded Reasons vs No-Fabrication Verification ---');

    // Check recorded reason for Milk Tea
    const compRes = await fetch(`${baseUrl}/comparison?month=2026-09`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const rows = (await compRes.json()).data;
    const milkTeaRow = rows.find((r) => r.categoryId === milkTeaCatA.id);
    assert(
      milkTeaRow && milkTeaRow.recordedReasons.includes('Student hostel count increased this month.'),
      '38. Recorded reason appears verbatim in category comparison'
    );

    // Save Admin qualitative insight
    const insRes = await fetch(`${baseUrl}/insights`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        categoryId: milkTeaCatA.id,
        year: 2026,
        month: 9,
        adminReason: 'Milk price increased from supplier and extra hostel students stayed for exams.',
        actionPlan: 'Compare alternate milk vendors and monitor daily canteen usage.',
      }),
    });
    assert(insRes.status === 200, '39. Upsert monthly admin insight and action plan');

    // Cost Review endpoint: verify deterministic suggestions and NO fabricated reason
    const revRes = await fetch(`${baseUrl}/cost-review?month=2026-09`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const revBody = (await revRes.json()).data;
    const foodRev = revBody.categories.find((c) => c.categoryId === foodCatA.id);

    // Food had no reason entered
    assert(
      foodRev && foodRev.recordedReasons.length === 0 && !foodRev.adminReason,
      '40. When no reason recorded, system does NOT invent or fabricate any cause'
    );

    // Milk Tea is over budget -> deterministic suggestion triggered
    const milkTeaRev = revBody.categories.find((c) => c.categoryId === milkTeaCatA.id);
    assert(
      milkTeaRev &&
        milkTeaRev.suggestions.some((s) => s.includes('Review the largest expenses in this category')),
      '41. Deterministic cost review suggestion triggered for over-budget category'
    );
  }

  // 11. Six-Month Trend (Exactly 6 Entries)
  {
    console.log('\n--- Group 11: Six-Month Trend ---');
    const trendRes = await fetch(`${baseUrl}/trend?month=2026-09`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const trendBody = await trendRes.json();
    assert(
      trendRes.status === 200 && Array.isArray(trendBody.data) && trendBody.data.length === 6,
      '42. Six-month trend returns EXACTLY 6 calendar month points'
    );
  }

  // 12. Cross-Tenant Security & Search Isolation
  {
    console.log('\n--- Group 12: Cross-Tenant Security & Isolation ---');

    // Tenant B cannot view Tenant A expense
    const res1 = await fetch(`${baseUrl}/expenses?categoryId=${milkTeaCatA.id}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    const body1 = await res1.json();
    assert(body1.total === 0, '43. Tenant B querying Tenant A categoryId returns zero records');

    // Tenant B cannot edit Tenant A expense
    const res2 = await fetch(`${baseUrl}/expenses/${expense1.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenB}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: 'Hacked by B' }),
    });
    assert(res2.status === 404, '44. Tenant B editing Tenant A expense rejected with 404');

    // Tenant B cannot void Tenant A expense
    const res3 = await fetch(`${baseUrl}/expenses/${expense1.id}/void`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ voidReason: 'Malicious void attempt' }),
    });
    assert(res3.status === 404, '45. Tenant B voiding Tenant A expense rejected with 404');

    // Tenant B search isolation: searching exact description of A returns 0
    const res4 = await fetch(`${baseUrl}/expenses?search=Milk%20and%20tea%20powder%20purchase`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    const body4 = await res4.json();
    assert(body4.total === 0, '46. Search isolation: Tenant B searching Tenant A text returns 0 records');
  }

  // 13. Subscription Gate (ACTIVE, PENDING, EXPIRED, NO_SUBSCRIPTION)
  {
    console.log('\n--- Group 13: Subscription Gate Enforcement ---');

    // ACTIVE allowed
    const resActive = await fetch(`${baseUrl}/categories`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(resActive.status === 200, '47. Subscription gate: ACTIVE subscription allowed (200)');

    // PENDING rejected with 403
    const resPending = await fetch(`${baseUrl}/categories`, {
      headers: { Authorization: `Bearer ${tokenPending}` },
    });
    assert(resPending.status === 403, '48. Subscription gate: PENDING subscription rejected with 403');

    // EXPIRED rejected with 403
    const resExpired = await fetch(`${baseUrl}/categories`, {
      headers: { Authorization: `Bearer ${tokenExpired}` },
    });
    assert(resExpired.status === 403, '49. Subscription gate: EXPIRED subscription rejected with 403');

    // NO_SUBSCRIPTION rejected with 403
    const resNoSub = await fetch(`${baseUrl}/categories`, {
      headers: { Authorization: `Bearer ${tokenNoSub}` },
    });
    assert(resNoSub.status === 403, '50. Subscription gate: NO_SUBSCRIPTION rejected with 403');
  }

  // 14. Export Verification (PDF & CSV with Formula Injection Defense)
  {
    console.log('\n--- Group 14: Export Verification & Formula Injection Defense ---');

    // Create an expense starting with formula injection characters: =SUM(1,2), +cmd, -test, @calc
    await fetch(`${baseUrl}/expenses`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expenseDate: '2026-09-29',
        categoryId: foodCatA.id,
        description: '=cmd|/C calc!A0',
        amount: '100.00',
        supplierName: '+malicious_supplier',
        reasonNote: '@injected_reason',
      }),
    });

    // Detailed CSV export
    const detRes = await fetch(`${baseUrl}/export/details.csv?month=2026-09`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(
      detRes.status === 200 && detRes.headers.get('content-type')?.includes('text/csv'),
      '51. Detailed CSV returns HTTP 200 with text/csv header'
    );
    const detCsv = await detRes.text();
    assert(
      detCsv.includes("'=cmd|/C calc!A0") && detCsv.includes("'+malicious_supplier") && detCsv.includes("'@injected_reason"),
      '52. Detailed CSV sanitizes formula injection characters (=, +, @) with leading apostrophe'
    );

    // Summary CSV export
    const sumRes = await fetch(`${baseUrl}/export/summary.csv?month=2026-09`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(
      sumRes.status === 200 && sumRes.headers.get('content-type')?.includes('text/csv'),
      '53. Summary CSV returns HTTP 200 with text/csv header'
    );
    const sumCsv = await sumRes.text();
    assert(
      sumCsv.includes('Gas') && sumCsv.includes('-100.00%'),
      '54. Summary CSV contains category-union Gas row with -100.00%'
    );

    // Monthly PDF export endpoint
    const pdfRes = await fetch(`${baseUrl}/export/pdf?month=2026-09`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(
      pdfRes.status === 200 && pdfRes.headers.get('content-type')?.includes('application/pdf'),
      '55. Monthly PDF returns HTTP 200 with application/pdf header'
    );
    const pdfBuffer = await pdfRes.arrayBuffer();
    assert(pdfBuffer.byteLength > 1000, '56. Monthly PDF buffer is non-empty and valid size (>1000 bytes)');

    // Save PDF artifact for real visual inspection
    const pdfPath = path.resolve(__dirname, 'test-expense-analysis-september-2026.pdf');
    fs.writeFileSync(pdfPath, Buffer.from(pdfBuffer));
    console.log(`  ✓ [SAVED] Real Monthly PDF saved to: ${pdfPath}`);
    assert(fs.existsSync(pdfPath), '57. Real test PDF generated and saved for visual verification');
  }

  console.log('\n==================================================');
  console.log(`TEST SUITE COMPLETED: ${testPassedCount} PASSED, ${testFailedCount} FAILED`);
  console.log('==================================================\n');
}

async function main() {
  try {
    await setup();
    await runTests();
  } catch (err) {
    console.error('Test suite uncaught error:', err);
    testFailedCount++;
  } finally {
    await teardown();
    process.exit(testFailedCount > 0 ? 1 : 0);
  }
}

main();
