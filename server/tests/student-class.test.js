import { prisma } from "../src/lib/prisma.js";
import { hashPassword } from "../src/utils/password.js";
import { signAccessToken } from "../src/utils/jwt.js";
import app from "../src/app.js";

const TEST_PREFIX = "p8_test_" + Date.now();

let testPassedCount = 0;
let testFailedCount = 0;

function assert(condition, testName) {
  if (condition) {
    console.log("  ✓ [PASS] " + testName);
    testPassedCount++;
  } else {
    console.error("  ✗ [FAIL] " + testName);
    testFailedCount++;
  }
}

let testServer = null;
let baseUrl = "";

// Fixtures
let superAdminUser = null;
let superAdminToken = "";

let madrasaA = null;
let adminA = null;
let tokenA = "";
let planA = null;
let subA = null;

let madrasaB = null;
let adminB = null;
let tokenB = "";
let planB = null;
let subB = null;

let expiredMadrasa = null;
let expiredAdmin = null;
let expiredToken = "";
let expiredSub = null;

let mustChangeAdmin = null;
let mustChangeToken = "";
let sectionA = null;
let sectionB = null;

async function setup() {
  console.log("\n--- Setting up Phase 8 Test Fixtures ---");
  const now = new Date();

  // 1. Super Admin
  superAdminUser = await prisma.user.create({
    data: {
      name: "Super Admin Phase 8",
      email: `${TEST_PREFIX}_sadmin@example.com`,
      passwordHash: await hashPassword("SuperSecurePassword123!"),
      role: "SUPER_ADMIN",
      isActive: true,
      mustChangePassword: false,
    },
  });
  superAdminToken = signAccessToken({
    userId: superAdminUser.id,
    role: superAdminUser.role,
    madrasaId: null,
  });

  // 2. Plan
  planA = await prisma.plan.create({
    data: {
      name: "Phase 8 Plan",
      code: `${TEST_PREFIX.slice(-6).toUpperCase()}_P8`,
      durationMonths: 12,
      price: 250.0,
      isActive: true,
    },
  });

  // 3. Madrasa A (Active)
  madrasaA = await prisma.madrasa.create({
    data: {
      name: "Madrasa A Al-Hikmah",
      code: `${TEST_PREFIX.slice(-6).toUpperCase()}01`,
      slug: `${TEST_PREFIX}-m-a`,
      email: `${TEST_PREFIX}_ma@example.com`,
      status: "ACTIVE",
      settings: {
        create: {
          currency: "LKR",
          timezone: "Asia/Colombo",
        },
      },
    },
  });

  adminA = await prisma.user.create({
    data: {
      name: "Admin A",
      email: `${TEST_PREFIX}_admin_a@example.com`,
      passwordHash: await hashPassword("AdminASecureP@ss123!"),
      role: "MADRASA_ADMIN",
      madrasaId: madrasaA.id,
      isActive: true,
      mustChangePassword: false,
    },
  });
  tokenA = signAccessToken({
    userId: adminA.id,
    role: adminA.role,
    madrasaId: madrasaA.id,
  });

  subA = await prisma.subscription.create({
    data: {
      madrasaId: madrasaA.id,
      planId: planA.id,
      status: "ACTIVE",
      startsAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      endsAt: new Date(now.getTime() + 300 * 24 * 60 * 60 * 1000),
      priceAtPurchase: 250.0,
      durationMonthsAtPurchase: 12,
    },
  });

  // 4. Madrasa B (Active - Separate Tenant)
  madrasaB = await prisma.madrasa.create({
    data: {
      name: "Madrasa B Al-Noor",
      code: `${TEST_PREFIX.slice(-6).toUpperCase()}02`,
      slug: `${TEST_PREFIX}-m-b`,
      email: `${TEST_PREFIX}_mb@example.com`,
      status: "ACTIVE",
      settings: {
        create: {
          currency: "LKR",
          timezone: "Asia/Colombo",
        },
      },
    },
  });

  adminB = await prisma.user.create({
    data: {
      name: "Admin B",
      email: `${TEST_PREFIX}_admin_b@example.com`,
      passwordHash: await hashPassword("AdminBSecureP@ss123!"),
      role: "MADRASA_ADMIN",
      madrasaId: madrasaB.id,
      isActive: true,
      mustChangePassword: false,
    },
  });
  tokenB = signAccessToken({
    userId: adminB.id,
    role: adminB.role,
    madrasaId: madrasaB.id,
  });

  subB = await prisma.subscription.create({
    data: {
      madrasaId: madrasaB.id,
      planId: planA.id,
      status: "ACTIVE",
      startsAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      endsAt: new Date(now.getTime() + 300 * 24 * 60 * 60 * 1000),
      priceAtPurchase: 250.0,
      durationMonthsAtPurchase: 12,
    },
  });

  // 5. Expired Madrasa
  expiredMadrasa = await prisma.madrasa.create({
    data: {
      name: "Expired Madrasa",
      code: `${TEST_PREFIX.slice(-6).toUpperCase()}03`,
      slug: `${TEST_PREFIX}-m-exp`,
      email: `${TEST_PREFIX}_exp@example.com`,
      status: "ACTIVE",
    },
  });

  expiredAdmin = await prisma.user.create({
    data: {
      name: "Expired Admin",
      email: `${TEST_PREFIX}_exp_admin@example.com`,
      passwordHash: await hashPassword("AdminExpSecureP@ss123!"),
      role: "MADRASA_ADMIN",
      madrasaId: expiredMadrasa.id,
      isActive: true,
      mustChangePassword: false,
    },
  });
  expiredToken = signAccessToken({
    userId: expiredAdmin.id,
    role: expiredAdmin.role,
    madrasaId: expiredMadrasa.id,
  });

  expiredSub = await prisma.subscription.create({
    data: {
      madrasaId: expiredMadrasa.id,
      planId: planA.id,
      status: "EXPIRED",
      startsAt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
      endsAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
      priceAtPurchase: 250.0,
      durationMonthsAtPurchase: 1,
    },
  });

  // 6. MustChangePassword Admin
  mustChangeAdmin = await prisma.user.create({
    data: {
      name: "Must Change Admin",
      email: `${TEST_PREFIX}_must_change@example.com`,
      passwordHash: await hashPassword("TempP@ssword123!"),
      role: "MADRASA_ADMIN",
      madrasaId: madrasaA.id,
      isActive: true,
      mustChangePassword: true,
    },
  });
  mustChangeToken = signAccessToken({
    userId: mustChangeAdmin.id,
    role: mustChangeAdmin.role,
    madrasaId: madrasaA.id,
    mustChangePassword: true,
  });

  // Academic Sections for Class testing
  sectionA = await prisma.academicSection.create({
    data: {
      madrasaId: madrasaA.id,
      name: `${TEST_PREFIX}_SecA`,
      code: 'SECA',
      isActive: true,
    },
  });
  sectionB = await prisma.academicSection.create({
    data: {
      madrasaId: madrasaB.id,
      name: `${TEST_PREFIX}_SecB`,
      code: 'SECB',
      isActive: true,
    },
  });

  // Start test server
  await new Promise((resolve) => {
    testServer = app.listen(5098, () => {
      baseUrl = "http://localhost:5098/api/madrasa-admin";
      resolve();
    });
  });

  console.log("Test server listening on port 5098\n");
}

async function teardown() {
  console.log("\n--- Tearing Down Phase 8 Test Fixtures ---");
  if (testServer) {
    await new Promise((resolve) => testServer.close(resolve));
  }

  const madrasaIds = [madrasaA?.id, madrasaB?.id, expiredMadrasa?.id].filter(Boolean);
  const userIds = [superAdminUser?.id, adminA?.id, adminB?.id, expiredAdmin?.id, mustChangeAdmin?.id].filter(Boolean);

  await prisma.activityLog.deleteMany({
    where: {
      OR: [
        { madrasaId: { in: madrasaIds } },
        { userId: { in: userIds } },
      ],
    },
  });

  await prisma.studentFeeSetting.deleteMany({
    where: { madrasaId: { in: madrasaIds } },
  });

  await prisma.student.deleteMany({
    where: { madrasaId: { in: madrasaIds } },
  });

  await prisma.class.deleteMany({
    where: { madrasaId: { in: madrasaIds } },
  });

  await prisma.academicSection.deleteMany({
    where: { madrasaId: { in: madrasaIds } },
  });

  await prisma.subscription.deleteMany({
    where: { madrasaId: { in: madrasaIds } },
  });

  await prisma.madrasaSetting.deleteMany({
    where: { madrasaId: { in: madrasaIds } },
  });

  await prisma.user.deleteMany({
    where: { id: { in: userIds } },
  });

  await prisma.madrasa.deleteMany({
    where: { id: { in: madrasaIds } },
  });

  if (planA?.id) {
    await prisma.plan.delete({ where: { id: planA.id } });
  }

  console.log("Teardown complete.\n");
}

async function runTests() {
  await setup();

  try {
    // ----------------------------------------------------
    // GROUP 1: Authentication, Tenant & Subscription Guards
    // ----------------------------------------------------
    console.log("[GROUP 1] Authentication, Tenant & Subscription Guards");

    const unauthRes = await fetch(`${baseUrl}/classes`);
    assert(unauthRes.status === 401, "Unauthenticated request rejected with 401");

    const superRes = await fetch(`${baseUrl}/classes`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert(superRes.status === 403, "Super Admin rejected from tenant Class API with 403");

    const mustChangeRes = await fetch(`${baseUrl}/classes`, {
      headers: { Authorization: `Bearer ${mustChangeToken}` },
    });
    const mustChangeJson = await mustChangeRes.json();
    assert(mustChangeRes.status === 403, "MustChangePassword rejected with 403");
    assert(mustChangeJson.code === "MUST_CHANGE_PASSWORD", "Code is MUST_CHANGE_PASSWORD");

    const expiredRes = await fetch(`${baseUrl}/classes`, {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    const expiredJson = await expiredRes.json();
    assert(expiredRes.status === 403, "Expired Madrasa Admin blocked from classes with 403");
    assert(expiredJson.code === "SUBSCRIPTION_EXPIRED", "Code is SUBSCRIPTION_EXPIRED");

    const activeRes = await fetch(`${baseUrl}/classes`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(activeRes.status === 200, "Active Madrasa Admin can access classes (200)");

    // ----------------------------------------------------
    // GROUP 2: Class Management CRUD & Tenant Uniqueness
    // ----------------------------------------------------
    console.log("\n[GROUP 2] Class Management CRUD & Tenant Uniqueness");

    // Create Class 1 in Madrasa A
    const createClassRes1 = await fetch(`${baseUrl}/classes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        academicSectionId: sectionA.id,
        name: "Hifz Class A1",
        code: "HIFZ-01",
        defaultMonthlyFee: "2500.00",
      }),
    });
    const createClassJson1 = await createClassRes1.json();
    assert(createClassRes1.status === 201, "Create class returns 201");
    assert(createClassJson1.data?.defaultMonthlyFee === "2500.00", "defaultMonthlyFee preserved as Decimal string");
    const classA1Id = createClassJson1.data?.id;

    // Reject duplicate name within same Madrasa A
    const dupNameRes = await fetch(`${baseUrl}/classes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        academicSectionId: sectionA.id,
        name: "Hifz Class A1",
        code: "HIFZ-02",
        defaultMonthlyFee: "2500.00",
      }),
    });
    assert(dupNameRes.status === 409, "Duplicate class name in same Madrasa returns 409 Conflict");

    // Allow same class name in Madrasa B (Tenant Uniqueness)
    const classBRes = await fetch(`${baseUrl}/classes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({
        academicSectionId: sectionB.id,
        name: "Hifz Class A1",
        code: "HIFZ-01",
        defaultMonthlyFee: "3000.00",
      }),
    });
    assert(classBRes.status === 201, "Same class name allowed in Madrasa B (201 Created)");
    const classB1Json = await classBRes.json();
    const classB1Id = classB1Json.data?.id;

    // Reject duplicate code within same Madrasa A
    const dupCodeRes = await fetch(`${baseUrl}/classes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        academicSectionId: sectionA.id,
        name: "Different Name",
        code: "HIFZ-01",
        defaultMonthlyFee: "2500.00",
      }),
    });
    assert(dupCodeRes.status === 409, "Duplicate class code in same Madrasa returns 409 Conflict");

    // Cross-tenant class ID lookup returns 404
    const crossClassRes = await fetch(`${baseUrl}/classes/${classB1Id}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(crossClassRes.status === 404, "Cross-tenant class lookup returns generic 404");

    // Update class in Madrasa A
    const updateClassRes = await fetch(`${baseUrl}/classes/${classA1Id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        defaultMonthlyFee: "2750.50",
      }),
    });
    const updateClassJson = await updateClassRes.json();
    assert(updateClassRes.status === 200, "Update class returns 200");
    assert(updateClassJson.data?.defaultMonthlyFee === "2750.50", "Updated Decimal fee preserved accurately");

    // Deactivate class
    const deactRes = await fetch(`${baseUrl}/classes/${classA1Id}/deactivate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const deactJson = await deactRes.json();
    assert(deactRes.status === 200, "Deactivate class returns 200");
    assert(deactJson.data?.isActive === false, "Class isActive set to false");

    // Activate class
    const actRes = await fetch(`${baseUrl}/classes/${classA1Id}/activate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const actJson = await actRes.json();
    assert(actRes.status === 200, "Activate class returns 200");
    assert(actJson.data?.isActive === true, "Class isActive set to true");

    // No hard delete endpoint
    const deleteRes = await fetch(`${baseUrl}/classes/${classA1Id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(deleteRes.status === 404 || deleteRes.status === 405, "DELETE /classes/:id rejected (no hard delete)");

    // ----------------------------------------------------
    // GROUP 3: Student Management CRUD, Leading Zeros & Status
    // ----------------------------------------------------
    console.log("\n[GROUP 3] Student Management CRUD, Leading Zeros & Status");

    // Create Student with leading zeros in admission number
    const createStudRes1 = await fetch(`${baseUrl}/students`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        admissionNo: "001",
        fullName: "Zayd Ibn Thabit",
        classId: classA1Id,
        guardianName: "Abu Zayd",
        guardianPhone: "+94771234567",
        whatsappNumber: "+94771234567",
        whatsappOptIn: true,
        admissionDate: "2026-01-15T00:00:00.000Z",
        notes: "Memorizing Juz Amma",
      }),
    });
    const createStudJson1 = await createStudRes1.json();
    assert(createStudRes1.status === 201, "Create student returns 201");
    assert(createStudJson1.data?.admissionNo === "001", "Leading zero in admissionNo preserved as string (001)");
    assert(createStudJson1.data?.feeSource === "CLASS_DEFAULT", "Fee source is CLASS_DEFAULT");
    assert(createStudJson1.data?.effectiveMonthlyFee === "2750.50", "Effective fee equals class default fee");
    const studentA1Id = createStudJson1.data?.id;

    // Duplicate admissionNo within same Madrasa A rejected
    const dupAdmissionRes = await fetch(`${baseUrl}/students`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        admissionNo: "001",
        fullName: "Another Student",
        guardianName: "Parent",
        admissionDate: "2026-02-01T00:00:00.000Z",
      }),
    });
    assert(dupAdmissionRes.status === 409, "Duplicate admissionNo in same Madrasa rejected (409 Conflict)");

    // Same admissionNo in Madrasa B allowed (Tenant Uniqueness)
    const studBRes = await fetch(`${baseUrl}/students`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({
        admissionNo: "001",
        fullName: "Student in Madrasa B",
        guardianName: "Guardian B",
        admissionDate: "2026-02-01T00:00:00.000Z",
      }),
    });
    assert(studBRes.status === 201, "Same admissionNo allowed in Madrasa B (201 Created)");
    const studBJson = await studBRes.json();
    const studentB1Id = studBJson.data?.id;

    // Cross-tenant student lookup returns 404
    const crossStudRes = await fetch(`${baseUrl}/students/${studentB1Id}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(crossStudRes.status === 404, "Cross-tenant student lookup returns 404");

    // Assigning another Madrasa class rejected with 404
    const assignForeignClassRes = await fetch(`${baseUrl}/students`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        admissionNo: "002",
        fullName: "Test Assign Foreign",
        classId: classB1Id,
        guardianName: "Guardian",
        admissionDate: "2026-02-01T00:00:00.000Z",
      }),
    });
    assert(assignForeignClassRes.status === 404, "Assigning foreign class returns 404");

    // Create inactive class in Madrasa A and attempt to assign
    const createInactClassRes = await fetch(`${baseUrl}/classes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        academicSectionId: sectionA.id,
        name: "Old Inactive Class",
        defaultMonthlyFee: "1000.00",
      }),
    });
    const inactClassJson = await createInactClassRes.json();
    await fetch(`${baseUrl}/classes/${inactClassJson.data.id}/deactivate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
    });

    const assignInactiveRes = await fetch(`${baseUrl}/students`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        admissionNo: "003",
        fullName: "Student Inactive Class",
        classId: inactClassJson.data.id,
        guardianName: "Guardian",
        admissionDate: "2026-02-01T00:00:00.000Z",
      }),
    });
    assert(assignInactiveRes.status === 400, "Assigning inactive class rejected with 400 Bad Request");

    // Student Status transitions: Inactive -> Archive -> Reactivate
    const inactRes = await fetch(`${baseUrl}/students/${studentA1Id}/inactivate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(inactRes.status === 200, "Inactivate student returns 200");

    const archRes = await fetch(`${baseUrl}/students/${studentA1Id}/archive`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(archRes.status === 200, "Archive student returns 200");

    // Verify archived student is not deleted
    const studAfterArch = await prisma.student.findUnique({ where: { id: studentA1Id } });
    assert(studAfterArch !== null && studAfterArch.status === "ARCHIVED", "Archive does NOT delete student record");

    // Reactivate student
    const reactivateRes = await fetch(`${baseUrl}/students/${studentA1Id}/activate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(reactivateRes.status === 200, "Reactivate student returns 200");
    const studAfterReact = await prisma.student.findUnique({ where: { id: studentA1Id } });
    assert(studAfterReact.status === "ACTIVE", "Student status restored to ACTIVE");

    // No hard delete endpoint
    const delStudRes = await fetch(`${baseUrl}/students/${studentA1Id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(delStudRes.status === 404 || delStudRes.status === 405, "DELETE /students/:id rejected (no hard delete)");

    // ----------------------------------------------------
    // GROUP 4: WhatsApp Consent Transitions (Merged State)
    // ----------------------------------------------------
    console.log("\n[GROUP 4] WhatsApp Consent Transitions (Merged State)");

    // Student with number and opt-in false
    const studNoOptInRes = await fetch(`${baseUrl}/students`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        admissionNo: "004",
        fullName: "Bilal Habashi",
        guardianName: "Guardian",
        whatsappNumber: "+94779998888",
        whatsappOptIn: false,
        admissionDate: "2026-01-01T00:00:00.000Z",
      }),
    });
    const studNoOptInJson = await studNoOptInRes.json();
    assert(studNoOptInRes.status === 201, "Number can exist with optIn false (201)");
    assert(studNoOptInJson.data?.whatsappOptInAt === null, "whatsappOptInAt is null when optIn is false");
    const stud4Id = studNoOptInJson.data?.id;

    // PATCH optIn = true without resending number (Merged state validation - Correction #5)
    const patchOptInRes = await fetch(`${baseUrl}/students/${stud4Id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        whatsappOptIn: true,
      }),
    });
    const patchOptInJson = await patchOptInRes.json();
    assert(patchOptInRes.status === 200, "PATCH optIn = true uses merged state with existing number");
    assert(patchOptInJson.data?.whatsappOptIn === true, "whatsappOptIn is now true");
    assert(patchOptInJson.data?.whatsappOptInAt !== null, "whatsappOptInAt timestamp set");

    // PATCH clearing number while optIn remains true -> 400 Bad Request
    const patchClearNumRes = await fetch(`${baseUrl}/students/${stud4Id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        whatsappNumber: null,
      }),
    });
    assert(patchClearNumRes.status === 400, "Clearing number while optIn remains true is rejected with 400");

    // PATCH optIn = false clears timestamp
    const patchDisableConsentRes = await fetch(`${baseUrl}/students/${stud4Id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        whatsappOptIn: false,
      }),
    });
    const patchDisableJson = await patchDisableConsentRes.json();
    assert(patchDisableConsentRes.status === 200, "Disable consent returns 200");
    assert(patchDisableJson.data?.whatsappOptInAt === null, "whatsappOptInAt cleared to null");

    // ----------------------------------------------------
    // GROUP 5: Student Fee Resolution, Overrides & History
    // ----------------------------------------------------
    console.log("\n[GROUP 5] Student Fee Resolution, Overrides & History");

    // Student 5 with initial override
    const stud5Res = await fetch(`${baseUrl}/students`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        admissionNo: "005",
        fullName: "Fee Timeline Student",
        classId: classA1Id, // default fee is 2750.50
        guardianName: "Guardian 5",
        admissionDate: "2026-01-01T00:00:00.000Z",
        monthlyFeeOverride: "2000.00",
      }),
    });
    const stud5Json = await stud5Res.json();
    const stud5Id = stud5Json.data?.id;
    assert(stud5Res.status === 201, "Student with initial override created (201)");
    assert(stud5Json.data?.feeSource === "STUDENT_OVERRIDE", "Fee source is STUDENT_OVERRIDE");
    assert(stud5Json.data?.effectiveMonthlyFee === "2000.00", "Initial effective fee is 2000.00");

    // Insert setting at Apr 1 = 2500 (Future/Later setting)
    const setAprRes = await fetch(`${baseUrl}/students/${stud5Id}/fee-settings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        amount: "2500.00",
        effectiveFrom: "2026-04-01T00:00:00.000Z",
        reason: "Term 2 fee adjustment",
      }),
    });
    assert(setAprRes.status === 200, "Apr 1 fee setting added (200)");

    // Insert setting between Jan 1 and Apr 1: Mar 1 = 2200 (Mandatory Correction #2)
    const setMarRes = await fetch(`${baseUrl}/students/${stud5Id}/fee-settings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        amount: "2200.00",
        effectiveFrom: "2026-03-01T00:00:00.000Z",
        reason: "Mid-term adjustment",
      }),
    });
    assert(setMarRes.status === 200, "Mar 1 fee setting inserted between Jan 1 and Apr 1 (200)");

    // Inspect Fee History intervals
    const historyRes = await fetch(`${baseUrl}/students/${stud5Id}/fee-history`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const historyJson = await historyRes.json();
    const historyItems = historyJson.data;
    assert(historyItems.length === 3, "Exactly 3 non-overlapping fee settings exist");

    // Verify chronological order and interval non-overlap:
    // [Jan 1 - Mar 1), [Mar 1 - Apr 1), [Apr 1 - null)
    const janSetting = historyItems.find((h) => Math.abs(Number(h.amount) - 2000) < 0.01);
    const marSetting = historyItems.find((h) => Math.abs(Number(h.amount) - 2200) < 0.01);
    const aprSetting = historyItems.find((h) => Math.abs(Number(h.amount) - 2500) < 0.01);

    assert(janSetting !== undefined, "Jan 1 setting exists");
    assert(marSetting !== undefined, "Mar 1 setting exists");
    assert(aprSetting !== undefined, "Apr 1 setting exists");

    assert(new Date(janSetting.effectiveTo).toISOString() === "2026-03-01T00:00:00.000Z", "Jan 1 setting closed at Mar 1");
    assert(new Date(marSetting.effectiveTo).toISOString() === "2026-04-01T00:00:00.000Z", "Mar 1 setting closed at Apr 1");
    assert(aprSetting.effectiveTo === null, "Apr 1 setting is open (effectiveTo: null)");

    // Exact duplicate effectiveFrom rejected (Mandatory Correction #4)
    const dupDateRes = await fetch(`${baseUrl}/students/${stud5Id}/fee-settings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        amount: "2300.00",
        effectiveFrom: "2026-03-01T00:00:00.000Z",
      }),
    });
    assert(dupDateRes.status === 409, "Exact duplicate effectiveFrom rejected with 409 Conflict");

    // Historical resolution for Feb 15 must return 2000.00, NOT current Student.monthlyFee (Mandatory Correction #1)
    const { getEffectiveStudentFee } = await import("../src/services/student-fee.service.js");
    const febFee = await getEffectiveStudentFee(stud5Id, madrasaA.id, new Date("2026-02-15T00:00:00.000Z"));
    assert(febFee.effectiveMonthlyFee === "2000.00", "Historical fee for Feb 15 resolves to 2000.00 (StudentFeeSetting)");

    const marFee = await getEffectiveStudentFee(stud5Id, madrasaA.id, new Date("2026-03-15T00:00:00.000Z"));
    assert(marFee.effectiveMonthlyFee === "2200.00", "Historical fee for Mar 15 resolves to 2200.00");

    const aprFee = await getEffectiveStudentFee(stud5Id, madrasaA.id, new Date("2026-04-15T00:00:00.000Z"));
    assert(aprFee.effectiveMonthlyFee === "2500.00", "Historical fee for Apr 15 resolves to 2500.00");

    // Historical resolution before Jan 1 returns Class default fee (Correction #1)
    const decFee = await getEffectiveStudentFee(stud5Id, madrasaA.id, new Date("2025-12-15T00:00:00.000Z"));
    assert(decFee.feeSource === "CLASS_DEFAULT", "Fee before Jan 1 falls back to CLASS_DEFAULT");
    assert(decFee.effectiveMonthlyFee === "2750.50", "Fee before Jan 1 is 2750.50");

    // Reverting to class default with explicit effective date (Mandatory Correction #8)
    const revertRes = await fetch(`${baseUrl}/students/${stud5Id}/fee-settings/use-class-default`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        effectiveDate: "2026-05-01T00:00:00.000Z",
        reason: "Returning to class standard rate",
      }),
    });
    assert(revertRes.status === 200, "Revert to class default returns 200");

    // Check that Apr 1 setting was closed at May 1
    const aprAfterRevert = await prisma.studentFeeSetting.findFirst({
      where: { madrasaId: madrasaA.id, studentId: stud5Id, effectiveFrom: new Date("2026-04-01T00:00:00.000Z") },
    });
    assert(new Date(aprAfterRevert.effectiveTo).toISOString() === "2026-05-01T00:00:00.000Z", "Apr 1 setting closed at May 1");

    // Fee for Jun 1 must now resolve to CLASS_DEFAULT
    const junFee = await getEffectiveStudentFee(stud5Id, madrasaA.id, new Date("2026-06-01T00:00:00.000Z"));
    assert(junFee.feeSource === "CLASS_DEFAULT", "Fee for June resolves to CLASS_DEFAULT");
    assert(junFee.effectiveMonthlyFee === "2750.50", "June fee amount is class default 2750.50");

    // ----------------------------------------------------
    // GROUP 6: Two-Tenant Isolation (Anti-Enumeration)
    // ----------------------------------------------------
    console.log("\n[GROUP 6] Two-Tenant Isolation (Anti-Enumeration)");

    // Admin A cannot view Class B
    const aViewsClassB = await fetch(`${baseUrl}/classes/${classB1Id}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(aViewsClassB.status === 404, "Admin A cannot view Class B (404 Not Found)");

    // Admin A cannot edit Class B
    const aEditsClassB = await fetch(`${baseUrl}/classes/${classB1Id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ name: "Hacked Class Name" }),
    });
    assert(aEditsClassB.status === 404, "Admin A cannot edit Class B (404 Not Found)");

    // Admin A cannot view Student B
    const aViewsStudentB = await fetch(`${baseUrl}/students/${studentB1Id}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(aViewsStudentB.status === 404, "Admin A cannot view Student B (404 Not Found)");

    // Admin A cannot edit Student B
    const aEditsStudentB = await fetch(`${baseUrl}/students/${studentB1Id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ fullName: "Hacked Student Name" }),
    });
    assert(aEditsStudentB.status === 404, "Admin A cannot edit Student B (404 Not Found)");

    // Admin A cannot view Student B fee history
    const aViewsFeeHistB = await fetch(`${baseUrl}/students/${studentB1Id}/fee-history`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(aViewsFeeHistB.status === 404, "Admin A cannot view Student B fee history (404 Not Found)");

    // Admin A cannot set fee override on Student B
    const aSetsFeeB = await fetch(`${baseUrl}/students/${studentB1Id}/fee-settings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        amount: "9999.00",
        effectiveFrom: "2026-01-01T00:00:00.000Z",
      }),
    });
    assert(aSetsFeeB.status === 404, "Admin A cannot set fee override on Student B (404 Not Found)");

    // Verify Student List search and pagination are tenant-isolated
    const listRes = await fetch(`${baseUrl}/students`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const listJson = await listRes.json();
    assert(listRes.status === 200, "Student list returns 200");
    const hasAnyMadrasaBStudent = listJson.data.items.some((item) => item.fullName === "Student in Madrasa B");
    assert(!hasAnyMadrasaBStudent, "Zero Madrasa B students visible in Madrasa A student list");

  } finally {
    await teardown();
  }

  console.log("=============================================");
  console.log(`Phase 8 Test Results: ${testPassedCount} Passed, ${testFailedCount} Failed`);
  console.log("=============================================\n");

  if (testFailedCount > 0) {
    process.exit(1);
  }
}

runTests();
