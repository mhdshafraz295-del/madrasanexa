import './setup-test-env.js';
import crypto from 'crypto';
import { prisma } from '../src/lib/prisma.js';
import {
  createAlumniProfileWithSequence,
  recordConsent,
  withdrawConsent,
  renewConsent,
  publishAlumniProfile,
  unpublishAlumniProfile,
  searchGlobalDirectory,
  getGlobalAlumniProfile,
  createVerificationRequest,
  respondToVerificationRequest,
  getAlumniCertificateStream,
  listEligibleStudents,
} from '../src/services/alumni.service.js';
import {
  listEligibleStudents as listEligibleStudentsController,
  listMadrasaAlumni as listMadrasaAlumniController,
} from '../src/controllers/alumni.controller.js';
import { checkDatabaseRateLimit } from '../src/middleware/rate-limiter.js';
import { setTestStorageAdapter } from '../src/services/r2.service.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  ✗ [FAIL] ${message}`);
    failed++;
  }
}

async function runAlumniNetworkTests() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING TARGETED ALUMNI NETWORK & VERIFICATION TESTS');
  console.log('======================================================\n');

  const runId = Date.now().toString().slice(-6);

  // Set mock storage adapter so R2 calls don't require external network
  const mockStorage = new Map();
  setTestStorageAdapter({
    getObjectBuffer: async (key) => {
      return mockStorage.get(key) || Buffer.from('%PDF-1.4 Mock Certificate Data');
    },
    send: async (command) => {
      if (command.constructor?.name?.includes('Get')) {
        const { Readable } = await import('stream');
        const bodyStream = new Readable();
        bodyStream.push(mockStorage.get(command.input?.Key) || Buffer.from('%PDF-1.4 Mock Certificate Data'));
        bodyStream.push(null);
        return {
          Body: bodyStream,
          ContentType: 'application/pdf',
        };
      }
      if (command.input?.Key) {
        mockStorage.set(command.input.Key, command.input.Body || Buffer.from('mock content'));
      }
      return {};
    },
  });

  try {
    // 1. Setup Test Tenants (Madrasa A and Madrasa B)
    const madrasaA = await prisma.madrasa.create({
      data: {
        name: `Test Madrasa A ${runId}`,
        code: `TMA${runId}`,
        slug: `tma-${runId}`,
        status: 'ACTIVE',
      },
    });

    const adminA = await prisma.user.create({
      data: {
        name: `Admin A ${runId}`,
        email: `admin-a-${runId}@example.com`,
        passwordHash: 'dummy',
        role: 'MADRASA_ADMIN',
        madrasa: { connect: { id: madrasaA.id } },
        isActive: true,
      },
    });

    const madrasaB = await prisma.madrasa.create({
      data: {
        name: `Test Madrasa B ${runId}`,
        code: `TMB${runId}`,
        slug: `tmb-${runId}`,
        status: 'ACTIVE',
      },
    });

    const adminB = await prisma.user.create({
      data: {
        name: `Admin B ${runId}`,
        email: `admin-b-${runId}@example.com`,
        passwordHash: 'dummy',
        role: 'MADRASA_ADMIN',
        madrasa: { connect: { id: madrasaB.id } },
        isActive: true,
      },
    });
    adminA.madrasaId = madrasaA.id;
    adminB.madrasaId = madrasaB.id;

    // Create Student in Madrasa A
    const studentA = await prisma.student.create({
      data: {
        madrasaId: madrasaA.id,
        admissionNo: `ADM-A-${runId}`,
        fullName: `Alumni Candidate ${runId}`,
        status: 'ACTIVE',
        admissionDate: new Date('2020-01-15'),
        guardianName: 'Secret Father Name',
        guardianPhone: '+94770000000',
        address: '123 Confidential Street',
      },
    });

    // Create Certificate FileObject & StudentQualification in Madrasa A
    const certFile = await prisma.fileObject.create({
      data: {
        madrasaId: madrasaA.id,
        type: 'STUDENT_DOCUMENT',
        objectKey: `madrasas/${madrasaA.id}/documents/cert-${runId}.pdf`,
        originalName: 'hifz_diploma.pdf',
        mimeType: 'application/pdf',
        size: 1024,
        publicUrl: null,
      },
    });
    mockStorage.set(certFile.objectKey, Buffer.from('%PDF-1.4 Mock Certificate Data'));

    const qualificationA = await prisma.studentQualification.create({
      data: {
        madrasa: { connect: { id: madrasaA.id } },
        student: { connect: { id: studentA.id } },
        createdByUser: { connect: { id: adminA.id } },
        recordType: 'QUALIFICATION',
        category: 'HIFZ_JUZ',
        title: 'Complete Holy Quran Memorization (Hifz)',
        issuingAuthority: madrasaA.name,
        progressStatus: 'COMPLETED',
        verificationStatus: 'VERIFIED',
        certificateFile: { connect: { id: certFile.id } },
        achievedDate: new Date('2024-05-15'),
      },
    });

    // Create a disciplinary incident record for Student A (to verify strict privacy exclusion)
    await prisma.studentIncident.create({
      data: {
        madrasa: { connect: { id: madrasaA.id } },
        student: { connect: { id: studentA.id } },
        occurredAt: new Date('2022-05-10'),
        category: 'ACADEMIC_INTEGRITY',
        severity: 'MEDIUM',
        title: 'Classroom Disruption Incident',
        reportedDescription: 'Private disciplinary incident that should NEVER leak to directory.',
        verificationStatus: 'CONFIRMED',
        reportedByUser: { connect: { id: adminA.id } },
      },
    });

    // ------------------------------------------------------------------------
    // TEST 1: SEQUENCE GENERATION & UNIQUE FORMAT
    // ------------------------------------------------------------------------
    console.log('Testing: 1. Concurrency-Safe Sequence & Profile Creation...');
    const profileA = await createAlumniProfileWithSequence(
      madrasaA.id,
      studentA.id,
      {
        leavingDate: '2024-12-31',
        leavingReason: 'GRADUATION',
        characterAssessment: 'EXCELLENT',
        characterAssessmentNotes: 'Outstanding character and commitment.',
        academicAchievements: [{ title: 'Annual Tajweed Competition 1st Place', year: 2023 }],
        adminPrivateNotes: 'Internal confidential review note',
      },
      adminA.id
    );

    const expectedPrefix = `ALM-TMA${runId}-${new Date().getFullYear()}-0001`;
    assert(
      profileA.alumniIndexNumber === expectedPrefix,
      `Alumni Index generated correctly with padded sequence: ${profileA.alumniIndexNumber}`
    );
    assert(profileA.publicationStatus === 'DRAFT', 'Initial publication status is DRAFT');
    assert(profileA.consentStatus === 'PENDING', 'Initial consent status is PENDING');

    // ------------------------------------------------------------------------
    // TEST 2: CONSENT RECORDING, IMMEDIATE WITHDRAWAL & RENEWAL
    // ------------------------------------------------------------------------
    console.log('\nTesting: 2. Consent Lifecycle & Instant Unpublishing on Withdrawal...');
    // A) Grant Consent
    const consentGranted = await recordConsent(
      madrasaA.id,
      profileA.id,
      {
        consentParty: 'STUDENT',
        signerName: studentA.fullName,
        proofType: 'SIGNED_FORM',
        consentVersion: 'v1.0-2026',
      },
      adminA.id
    );
    assert(consentGranted.consentStatus === 'GRANTED', 'Consent recorded as GRANTED');

    // Publish profile
    const published = await publishAlumniProfile(madrasaA.id, profileA.id, adminA.id);
    assert(published.publicationStatus === 'PUBLISHED', 'Profile successfully published');

    // Verify it appears in directory
    const searchAfterPublish = await searchGlobalDirectory(madrasaB.id, { q: profileA.alumniIndexNumber });
    assert(searchAfterPublish.data.length === 1, 'Published profile found in Global Directory');

    // B) Withdraw Consent -> MUST immediately unpublish and block
    console.log('  Testing instant unpublish on consent withdrawal...');
    const consentWithdrawn = await withdrawConsent(
      madrasaA.id,
      profileA.id,
      'Student requested privacy exclusion',
      adminA.id
    );
    assert(consentWithdrawn.consentStatus === 'WITHDRAWN', 'Consent status marked as WITHDRAWN');
    assert(consentWithdrawn.publicationStatus === 'UNPUBLISHED', 'Profile immediately flipped to UNPUBLISHED');

    // Verify it is excluded from global directory search
    const searchAfterWithdraw = await searchGlobalDirectory(madrasaB.id, { q: profileA.alumniIndexNumber });
    assert(searchAfterWithdraw.data.length === 0, 'Withdrawn profile is instantly excluded from search results');

    // C) Renew Consent with proof
    console.log('  Testing consent renewal with fresh evidence...');
    const renewalFile = await prisma.fileObject.create({
      data: {
        madrasaId: madrasaA.id,
        type: 'STUDENT_DOCUMENT',
        objectKey: `madrasas/${madrasaA.id}/documents/consent-renewal-${runId}.pdf`,
        originalName: 'consent_renewal.pdf',
        mimeType: 'application/pdf',
        size: 512,
        publicUrl: null,
      },
    });

    const consentRenewed = await renewConsent(
      madrasaA.id,
      profileA.id,
      {
        consentParty: 'STUDENT',
        signerName: studentA.fullName,
        proofType: 'SIGNED_PHYSICAL_FORM',
        consentVersion: 'v2.0-2026',
        consentFileId: renewalFile.id,
      },
      adminA.id
    );
    assert(consentRenewed.consentStatus === 'GRANTED', 'Consent renewed to GRANTED');

    // Re-publish profile
    await publishAlumniProfile(madrasaA.id, profileA.id, adminA.id);

    // ------------------------------------------------------------------------
    // TEST 3: STRICT TIERED PRIVACY (ZERO DATA LEAKAGE)
    // ------------------------------------------------------------------------
    console.log('\nTesting: 3. Tiered Privacy (Zero Leakage of Private Data)...');
    const globalView = await getGlobalAlumniProfile(adminB, profileA.alumniIndexNumber);
    const ownerView = await getGlobalAlumniProfile(adminA, profileA.alumniIndexNumber);

    assert(globalView.alumniIndexNumber === profileA.alumniIndexNumber, 'Exposes Alumni Index Number (Tier 1)');
    assert(globalView.fullName === studentA.fullName, 'Exposes Full Name (Tier 1)');
    assert(globalView.qualifications.length === 1, 'Exposes verified academic qualifications (Tier 1)');
    assert(
      globalView.characterAssessment === null,
      'Tier 3 Character Assessment is strictly HIDDEN for external viewer without approved verification'
    );
    assert(
      ownerView.characterAssessment?.conductRating === 'EXCELLENT',
      'Tier 3 Character Assessment is visible to Owner Madrasa Admin'
    );

    // CRITICAL: Ensure private attributes are strictly absent
    const serialized = JSON.stringify(globalView);
    assert(!serialized.includes('Secret Father Name'), 'ZERO exposure: Guardian name is NOT leaked');
    assert(!serialized.includes('+94770000000'), 'ZERO exposure: Guardian phone is NOT leaked');
    assert(!serialized.includes('Confidential Street'), 'ZERO exposure: Student address is NOT leaked');
    assert(!serialized.includes('Classroom Disruption'), 'ZERO exposure: Disciplinary incidents NOT leaked');
    assert(!serialized.includes('Internal confidential review note'), 'ZERO exposure: Private admin notes NOT leaked');

    // ------------------------------------------------------------------------
    // TEST 4: CROSS-TENANT CERTIFICATE ACCESS & VERIFICATION WORKFLOW
    // ------------------------------------------------------------------------
    console.log('\nTesting: 4. Cross-Tenant Certificate Access & Verification...');
    // Non-owner Madrasa B attempts to download certificate directly without verification approval
    let denied = false;
    try {
      await getAlumniCertificateStream(adminB, profileA.id, qualificationA.id);
    } catch (err) {
      if (err.statusCode === 403 || err.message.includes('Cross-tenant')) {
        denied = true;
      }
    }
    assert(denied, 'Cross-tenant certificate access strictly denied without approved verification');

    // Direct owner Madrasa A can stream without restriction
    let ownerCanAccess = false;
    try {
      const streamObj = await getAlumniCertificateStream(adminA, profileA.id, qualificationA.id);
      if (streamObj && streamObj.stream) {
        ownerCanAccess = true;
      }
    } catch (err) {
      console.error(err);
    }
    assert(ownerCanAccess, 'Issuing/Owner Madrasa retains direct document access');

    // Now Madrasa B creates a verification request
    console.log('  Submitting inter-madrasa verification inquiry from Madrasa B...');
    const verifyReq = await createVerificationRequest(
      madrasaB.id,
      adminB.id,
      profileA.alumniIndexNumber,
      {
        purpose: 'ACADEMIC_ADMISSION',
        notes: 'Verification requested for Higher Alim intake 2026',
      }
    );
    assert(verifyReq.status === 'PENDING', 'Verification inquiry dispatched with status PENDING');

    // Madrasa A approves the inquiry
    console.log('  Issuing Madrasa A approves the inquiry...');
    const approvedReq = await respondToVerificationRequest(
      madrasaA.id,
      verifyReq.id,
      {
        action: 'APPROVE',
        notes: 'Duly verified and endorsed by Academic Dean',
      },
      adminA.id
    );
    assert(approvedReq.status === 'APPROVED_VERIFIED', 'Verification status updated to APPROVED_VERIFIED');

    // Now Madrasa B attempts to stream certificate -> MUST SUCCEED
    let accessGrantedAfterApproval = false;
    try {
      const crossStream = await getAlumniCertificateStream(adminB, profileA.id, qualificationA.id);
      if (crossStream && crossStream.stream) {
        accessGrantedAfterApproval = true;
      }
    } catch (err) {
      console.error(err);
    }
    assert(accessGrantedAfterApproval, 'Cross-tenant certificate access successfully granted upon inquiry approval');

    // ------------------------------------------------------------------------
    // TEST 5: FIXED-WINDOW DATABASE RATE LIMITER
    // ------------------------------------------------------------------------
    console.log('\nTesting: 5. Fixed-Window Rate Limiter Fallback...');
    const rlKey = `test_rl_${runId}`;
    const maxLimit = 3;
    const windowMs = 5000;

    const r1 = await checkDatabaseRateLimit(rlKey, maxLimit, windowMs);
    const r2 = await checkDatabaseRateLimit(rlKey, maxLimit, windowMs);
    const r3 = await checkDatabaseRateLimit(rlKey, maxLimit, windowMs);
    const r4 = await checkDatabaseRateLimit(rlKey, maxLimit, windowMs);

    assert(r1.isAllowed && r2.isAllowed && r3.isAllowed, 'First 3 requests within limit allowed');
    assert(!r4.isAllowed && r4.remaining === 0, '4th request triggers rate limit block (remaining = 0)');

    // ------------------------------------------------------------------------
    // TEST 6: AUTH CONTEXT & ELIGIBLE STUDENT LISTING VERIFICATION
    // ------------------------------------------------------------------------
    console.log('\nTesting: 6. Auth Context & Eligible Student Listing...');

    // 1. Create a second student in Madrasa A (eligible, without alumni profile)
    const studentA2 = await prisma.student.create({
      data: {
        madrasa: { connect: { id: madrasaA.id } },
        admissionNo: `ADM-A2-${runId}`,
        fullName: `Eligible Student A2 ${runId}`,
        guardianName: 'Guardian A2',
        status: 'ACTIVE',
        admissionDate: new Date('2021-03-01'),
      },
    });

    // 2. Create a student in Madrasa B (must NOT be returned for Madrasa A)
    const studentB = await prisma.student.create({
      data: {
        madrasa: { connect: { id: madrasaB.id } },
        admissionNo: `ADM-B-${runId}`,
        fullName: `Madrasa B Student ${runId}`,
        guardianName: 'Guardian B',
        status: 'ACTIVE',
        admissionDate: new Date('2021-04-01'),
      },
    });

    // Verify listEligibleStudents returns studentA2 but NOT studentA (which already has an alumni profile)
    // and NOT studentB (tenant isolated)
    const eligibleForA = await listEligibleStudents(madrasaA.id);
    const eligibleIds = eligibleForA.map((s) => s.id);

    assert(eligibleIds.includes(studentA2.id), 'Eligible student without alumni profile is returned');
    assert(!eligibleIds.includes(studentA.id), 'Student with existing alumni profile is strictly excluded');
    assert(!eligibleIds.includes(studentB.id), 'Cross-tenant students are strictly excluded');
    assert(
      eligibleForA.some((s) => s.id === studentA2.id && s.displayName && s.admissionNumber),
      'Returns correct display name and admission number'
    );

    // 3. Controller Auth Context Verification:
    // When called with req.auth and req.tenant (as set by authenticateToken + requireTenantContext)
    const mockReq = {
      auth: { userId: adminA.id, role: 'MADRASA_ADMIN', madrasaId: madrasaA.id },
      tenant: { madrasaId: madrasaA.id, code: madrasaA.code, name: madrasaA.name },
      query: {},
    };
    let jsonResult = null;
    const mockRes = {
      json: (data) => {
        jsonResult = data;
      },
      status: () => mockRes,
    };

    let controllerError = null;
    await listEligibleStudentsController(mockReq, mockRes, (err) => {
      controllerError = err;
    });
    assert(!controllerError && jsonResult?.success, 'listEligibleStudents controller succeeds with req.auth & req.tenant');

    await listMadrasaAlumniController(mockReq, mockRes, (err) => {
      controllerError = err;
    });
    assert(
      !controllerError && jsonResult?.success,
      'listMadrasaAlumni controller succeeds with req.auth & req.tenant (no madrasaId undefined crash)'
    );

    // 4. Missing Auth Context Verification:
    // When called with missing auth context -> MUST produce controlled error (401 or 403)
    let missingAuthErr = null;
    const emptyReq = { query: {} };
    await listEligibleStudentsController(emptyReq, mockRes, (err) => {
      missingAuthErr = err;
    });
    assert(
      missingAuthErr && (missingAuthErr.statusCode === 401 || missingAuthErr.statusCode === 403),
      'Missing auth context produces controlled 401/403 error (no unhandled TypeError)'
    );

    // Cleanup test data created during test
    console.log('\nCleaning up test artifacts...');
    await prisma.alumniVerificationRequest.deleteMany({ where: { alumniProfileId: profileA.id } });
    await prisma.alumniConsentRecord.deleteMany({ where: { alumniProfileId: profileA.id } });
    await prisma.alumniProfile.deleteMany({ where: { id: profileA.id } });
    await prisma.alumniIndexSequence.deleteMany({ where: { madrasaId: madrasaA.id } });
    await prisma.rateLimitBucket.deleteMany({ where: { key: rlKey } });
    await prisma.studentIncident.deleteMany({ where: { studentId: studentA.id } });
    await prisma.studentQualification.deleteMany({ where: { studentId: studentA.id } });
    await prisma.fileObject.deleteMany({ where: { id: { in: [certFile.id, renewalFile.id] } } });
    await prisma.student.deleteMany({ where: { id: { in: [studentA.id, studentA2.id, studentB.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [adminA.id, adminB.id] } } });
    await prisma.madrasa.deleteMany({ where: { id: { in: [madrasaA.id, madrasaB.id] } } });

    console.log('\n======================================================');
    console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('======================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runAlumniNetworkTests();
