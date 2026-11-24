import { prisma } from '../lib/prisma.js';
import { NotFoundError, BadRequestError, ForbiddenError } from '../utils/errors.js';

/**
 * Asserts and guarantees valid madrasa tenant ID for strict multi-tenant isolation.
 */
function assertValidTenantId(madrasaId) {
  if (!madrasaId || typeof madrasaId !== 'string' || !madrasaId.trim()) {
    throw new ForbiddenError('Madrasa tenant identifier is required for tenant isolation.');
  }
  return madrasaId.trim();
}

/**
 * Helper to normalize and synchronize multiple qualifications
 */
function normalizeQualifications(payload, isRequired = true) {
  let qualificationsList = Array.isArray(payload.qualificationsList)
    ? payload.qualificationsList
        .filter((q) => q && (typeof q.degree === 'string' || typeof q.university === 'string'))
        .map((q) => ({
          degree: (q.degree || '').trim(),
          university: (q.university || '').trim(),
          year: q.year ? String(q.year).trim() : null,
        }))
        .filter((q) => q.degree || q.university)
    : null;

  let qualification = (payload.qualification || payload.degree || '').trim();
  let university = (payload.university || '').trim();

  if (qualificationsList && qualificationsList.length > 0) {
    if (!qualification && qualificationsList[0].degree) {
      qualification = qualificationsList[0].degree;
    }
    if (!university && qualificationsList[0].university) {
      university = qualificationsList[0].university;
    }
  } else if (qualification || university) {
    const defaultYear = (payload.batchYear || payload.year) ? String(payload.batchYear || payload.year).trim() : null;
    qualificationsList = [
      {
        degree: qualification,
        university: university,
        year: defaultYear,
      },
    ];
  }

  if (isRequired && !qualification && !university) {
    throw new BadRequestError('At least one Degree / Qualification and University is required.');
  }

  return { qualification, university, qualificationsList };
}

/**
 * Resolves madrasa by slug or code
 */
async function resolveMadrasa(madrasaCode) {
  if (!madrasaCode || typeof madrasaCode !== 'string') {
    throw new NotFoundError('Madrasa identifier is required.');
  }

  const trimmed = madrasaCode.trim();
  const madrasa = await prisma.madrasa.findFirst({
    where: {
      OR: [
        { code: trimmed },
        { slug: trimmed },
        { code: trimmed.toUpperCase() },
        { slug: trimmed.toLowerCase() },
      ],
      status: 'ACTIVE',
    },
    select: {
      id: true,
      code: true,
      name: true,
      slug: true,
      logoFileId: true,
      showAlumniOnWebsite: true,
    },
  });

  if (!madrasa) {
    throw new NotFoundError(`Madrasa '${madrasaCode}' not found or inactive.`);
  }

  return madrasa;
}

/**
 * Public Endpoint: Fetch active madrasa branding + approved alumni list
 */
export async function getPublicAlumniForMadrasa(madrasaCode) {
  const madrasa = await resolveMadrasa(madrasaCode);

  let logoUrl = null;
  if (madrasa.logoFileId) {
    const file = await prisma.fileObject.findFirst({
      where: { id: madrasa.logoFileId, madrasaId: madrasa.id },
      select: { publicUrl: true },
    });
    logoUrl = file?.publicUrl || null;
  }

  const rawAlumni = await prisma.alumniScholar.findMany({
    where: {
      madrasaId: madrasa.id,
      approvalStatus: 'APPROVED',
    },
    orderBy: [
      { isFeatured: 'desc' },
      { batchYear: 'desc' },
      { fullName: 'asc' },
    ],
  });

  // Extract distinct batch years and classes/divisions for client filters
  const batchYearSet = new Set();
  const classOrDivisionSet = new Set();

  const sanitizedAlumni = rawAlumni.map((item) => {
    if (item.batchYear) batchYearSet.add(item.batchYear);
    if (item.classOrDivision) classOrDivisionSet.add(item.classOrDivision);

    return {
      id: item.id,
      fullName: item.fullName,
      photoUrl: item.photoUrl,
      batchYear: item.batchYear,
      classOrDivision: item.classOrDivision,
      academicStatus: item.academicStatus,
      customStatusLabel: item.customStatusLabel,
      qualification: item.qualification,
      university: item.university,
      qualificationsList: item.qualificationsList,
      facultyOrDepartment: item.facultyOrDepartment,
      currentRole: item.currentRole,
      cityCountry: item.cityCountry,
      bio: item.bio,
      email: item.showContactPublicly ? item.email : null,
      phone: item.showContactPublicly ? item.phone : null,
      linkedinUrl: item.linkedinUrl,
      showContactPublicly: item.showContactPublicly,
      availableForMentorship: item.availableForMentorship,
      isFeatured: item.isFeatured,
      createdAt: item.createdAt,
    };
  });

  return {
    madrasa: {
      id: madrasa.id,
      name: madrasa.name,
      code: madrasa.code,
      slug: madrasa.slug,
      logoUrl,
      showAlumniOnWebsite: Boolean(madrasa.showAlumniOnWebsite),
    },
    alumni: sanitizedAlumni,
    batchYears: Array.from(batchYearSet).sort((a, b) => b.localeCompare(a)),
    classOrDivisions: Array.from(classOrDivisionSet).sort(),
    totalCount: sanitizedAlumni.length,
  };
}

/**
 * Public Endpoint: Self-submission by an alumnus or undergraduate
 */
export async function submitPublicAlumni(madrasaCode, payload) {
  const madrasa = await resolveMadrasa(madrasaCode);
  const { qualification, university, qualificationsList } = normalizeQualifications(payload, true);

  const batchYear = (payload.batchYear || payload.year || '').trim();
  const bio = (payload.bio !== undefined ? payload.bio : payload.academicBio) ? String(payload.bio !== undefined ? payload.bio : payload.academicBio).trim() : null;
  const availableForMentorship = payload.availableForMentorship !== undefined
    ? Boolean(payload.availableForMentorship)
    : (payload.openForMentorship !== undefined ? Boolean(payload.openForMentorship) : true);

  const created = await prisma.alumniScholar.create({
    data: {
      madrasaId: madrasa.id,
      fullName: payload.fullName.trim(),
      photoUrl: payload.photoUrl ? payload.photoUrl.trim() : null,
      batchYear,
      classOrDivision: payload.classOrDivision ? payload.classOrDivision.trim() : null,
      classId: payload.classId ? payload.classId.trim() : null,
      studentId: payload.studentId ? payload.studentId.trim() : null,
      alumniProfileId: (payload.alumniProfileId || payload.alumniId) ? String(payload.alumniProfileId || payload.alumniId).trim() : null,
      academicStatus: payload.academicStatus || 'UNDERGRADUATE',
      customStatusLabel: payload.customStatusLabel ? payload.customStatusLabel.trim() : null,
      qualification,
      university,
      qualificationsList,
      facultyOrDepartment: payload.facultyOrDepartment ? payload.facultyOrDepartment.trim() : null,
      currentRole: payload.currentRole ? payload.currentRole.trim() : null,
      cityCountry: payload.cityCountry ? payload.cityCountry.trim() : null,
      bio,
      email: payload.email ? payload.email.trim() : null,
      phone: payload.phone ? payload.phone.trim() : null,
      linkedinUrl: payload.linkedinUrl ? payload.linkedinUrl.trim() : null,
      showContactPublicly: Boolean(payload.showContactPublicly),
      availableForMentorship,
      approvalStatus: 'PENDING',
      isFeatured: false,
    },
  });

  return created;
}

/**
 * Madrasa Admin: List Alumni & Scholars Hub directory + KPIs
 */
export async function getMadrasaAdminAlumniHub(madrasaId, query = {}) {
  const validTenantId = assertValidTenantId(madrasaId);

  const madrasa = await prisma.madrasa.findUnique({
    where: { id: validTenantId },
    select: {
      id: true,
      code: true,
      slug: true,
      name: true,
      showAlumniOnWebsite: true,
    },
  });

  if (!madrasa) {
    throw new NotFoundError('Madrasa not found.');
  }

  const { status, batchYear, classOrDivision, search } = query;

  const where = { madrasaId: validTenantId };

  if (status && status !== 'ALL') {
    where.approvalStatus = status;
  }
  if (batchYear && batchYear !== 'ALL') {
    where.batchYear = batchYear;
  }
  if (classOrDivision && classOrDivision !== 'ALL') {
    where.classOrDivision = classOrDivision;
  }
  if (search && search.trim()) {
    const s = search.trim();
    where.OR = [
      { fullName: { contains: s } },
      { qualification: { contains: s } },
      { university: { contains: s } },
      { currentRole: { contains: s } },
      { cityCountry: { contains: s } },
    ];
  }

  const [items, allRecordsForStats] = await Promise.all([
    prisma.alumniScholar.findMany({
      where,
      orderBy: [
        { isFeatured: 'desc' },
        { createdAt: 'desc' },
      ],
    }),
    prisma.alumniScholar.findMany({
      where: { madrasaId: validTenantId },
      select: {
        id: true,
        approvalStatus: true,
        academicStatus: true,
        availableForMentorship: true,
        batchYear: true,
        classOrDivision: true,
      },
    }),
  ]);

  // Compute live KPIs across entire tenant
  const totalApproved = allRecordsForStats.filter((r) => r.approvalStatus === 'APPROVED').length;
  const pendingCount = allRecordsForStats.filter((r) => r.approvalStatus === 'PENDING').length;
  const undergraduatesCount = allRecordsForStats.filter(
    (r) => r.approvalStatus === 'APPROVED' && r.academicStatus === 'UNDERGRADUATE'
  ).length;
  const mentorsCount = allRecordsForStats.filter(
    (r) => r.approvalStatus === 'APPROVED' && r.availableForMentorship
  ).length;

  const batchYearSet = new Set();
  const classOrDivisionSet = new Set();
  allRecordsForStats.forEach((r) => {
    if (r.batchYear) batchYearSet.add(r.batchYear);
    if (r.classOrDivision) classOrDivisionSet.add(r.classOrDivision);
  });

  return {
    items,
    kpis: {
      totalApproved,
      pendingCount,
      undergraduatesCount,
      mentorsCount,
      totalCount: allRecordsForStats.length,
    },
    showAlumniOnWebsite: Boolean(madrasa.showAlumniOnWebsite),
    madrasa: {
      id: madrasa.id,
      code: madrasa.code,
      slug: madrasa.slug,
      name: madrasa.name,
    },
    availableBatchYears: Array.from(batchYearSet).sort((a, b) => b.localeCompare(a)),
    availableClassOrDivisions: Array.from(classOrDivisionSet).sort(),
  };
}

/**
 * Madrasa Admin: Toggle website visibility
 */
export async function toggleWebsiteVisibility(madrasaId, showAlumniOnWebsite) {
  const validTenantId = assertValidTenantId(madrasaId);

  const updated = await prisma.madrasa.update({
    where: { id: validTenantId },
    data: {
      showAlumniOnWebsite: Boolean(showAlumniOnWebsite),
    },
    select: {
      id: true,
      showAlumniOnWebsite: true,
    },
  });

  return updated;
}

/**
 * Madrasa Admin: Create Scholar Profile
 */
export async function adminCreateScholar(madrasaId, payload, userId) {
  const validTenantId = assertValidTenantId(madrasaId);
  const { qualification, university, qualificationsList } = normalizeQualifications(payload, true);

  const batchYear = (payload.batchYear || payload.year || '').trim();
  const bio = (payload.bio !== undefined ? payload.bio : payload.academicBio) ? String(payload.bio !== undefined ? payload.bio : payload.academicBio).trim() : null;
  const availableForMentorship = payload.availableForMentorship !== undefined
    ? Boolean(payload.availableForMentorship)
    : (payload.openForMentorship !== undefined ? Boolean(payload.openForMentorship) : true);

  // Safely verify if reviewing user exists to prevent foreign-key failure
  let validReviewedByUserId = null;
  if (userId) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });
      if (user) {
        validReviewedByUserId = user.id;
      }
    } catch {
      validReviewedByUserId = null;
    }
  }

  const created = await prisma.alumniScholar.create({
    data: {
      madrasaId: validTenantId,
      fullName: payload.fullName.trim(),
      photoUrl: payload.photoUrl ? payload.photoUrl.trim() : null,
      batchYear,
      classOrDivision: payload.classOrDivision ? payload.classOrDivision.trim() : null,
      classId: payload.classId ? payload.classId.trim() : null,
      studentId: payload.studentId ? payload.studentId.trim() : null,
      alumniProfileId: (payload.alumniProfileId || payload.alumniId) ? String(payload.alumniProfileId || payload.alumniId).trim() : null,
      academicStatus: payload.academicStatus || 'UNDERGRADUATE',
      customStatusLabel: payload.customStatusLabel ? payload.customStatusLabel.trim() : null,
      qualification,
      university,
      qualificationsList,
      facultyOrDepartment: payload.facultyOrDepartment ? payload.facultyOrDepartment.trim() : null,
      currentRole: payload.currentRole ? payload.currentRole.trim() : null,
      cityCountry: payload.cityCountry ? payload.cityCountry.trim() : null,
      bio,
      email: payload.email ? payload.email.trim() : null,
      phone: payload.phone ? payload.phone.trim() : null,
      linkedinUrl: payload.linkedinUrl ? payload.linkedinUrl.trim() : null,
      showContactPublicly: Boolean(payload.showContactPublicly),
      availableForMentorship,
      approvalStatus: payload.approvalStatus || 'APPROVED',
      isFeatured: Boolean(payload.isFeatured),
      reviewedByUserId: validReviewedByUserId,
      reviewedAt: new Date(),
    },
  });

  return created;
}

/**
 * Madrasa Admin: Update Scholar Profile
 */
export async function adminUpdateScholar(madrasaId, id, payload) {
  const validTenantId = assertValidTenantId(madrasaId);
  if (!id || typeof id !== 'string' || !id.trim()) {
    throw new BadRequestError('Scholar identifier is required.');
  }
  const cleanId = id.trim();

  const existing = await prisma.alumniScholar.findFirst({
    where: { id: cleanId, madrasaId: validTenantId },
  });

  if (!existing) {
    throw new NotFoundError('Scholar profile not found.');
  }

  const updateData = {};
  if (payload.fullName !== undefined) updateData.fullName = payload.fullName.trim();
  if (payload.photoUrl !== undefined) updateData.photoUrl = payload.photoUrl ? payload.photoUrl.trim() : null;
  if (payload.batchYear !== undefined || payload.year !== undefined) {
    updateData.batchYear = (payload.batchYear || payload.year || '').trim();
  }
  if (payload.classOrDivision !== undefined) updateData.classOrDivision = payload.classOrDivision ? payload.classOrDivision.trim() : null;
  if (payload.classId !== undefined) updateData.classId = payload.classId ? payload.classId.trim() : null;
  if (payload.studentId !== undefined) updateData.studentId = payload.studentId ? payload.studentId.trim() : null;
  if (payload.alumniProfileId !== undefined || payload.alumniId !== undefined) {
    updateData.alumniProfileId = (payload.alumniProfileId || payload.alumniId) ? String(payload.alumniProfileId || payload.alumniId).trim() : null;
  }
  if (payload.academicStatus !== undefined) updateData.academicStatus = payload.academicStatus;
  if (payload.customStatusLabel !== undefined) updateData.customStatusLabel = payload.customStatusLabel ? payload.customStatusLabel.trim() : null;

  if (payload.qualificationsList !== undefined || payload.qualification !== undefined || payload.degree !== undefined || payload.university !== undefined) {
    const { qualification, university, qualificationsList } = normalizeQualifications(
      {
        qualificationsList: payload.qualificationsList !== undefined ? payload.qualificationsList : existing.qualificationsList,
        qualification: payload.qualification !== undefined ? payload.qualification : (payload.degree !== undefined ? payload.degree : existing.qualification),
        university: payload.university !== undefined ? payload.university : existing.university,
        batchYear: payload.batchYear !== undefined ? payload.batchYear : existing.batchYear,
      },
      false
    );
    if (qualificationsList !== null) updateData.qualificationsList = qualificationsList;
    if (qualification) updateData.qualification = qualification;
    if (university) updateData.university = university;
  }

  if (payload.facultyOrDepartment !== undefined) updateData.facultyOrDepartment = payload.facultyOrDepartment ? payload.facultyOrDepartment.trim() : null;
  if (payload.currentRole !== undefined) updateData.currentRole = payload.currentRole ? payload.currentRole.trim() : null;
  if (payload.cityCountry !== undefined) updateData.cityCountry = payload.cityCountry ? payload.cityCountry.trim() : null;
  if (payload.bio !== undefined || payload.academicBio !== undefined) {
    const b = payload.bio !== undefined ? payload.bio : payload.academicBio;
    updateData.bio = b ? b.trim() : null;
  }
  if (payload.email !== undefined) updateData.email = payload.email ? payload.email.trim() : null;
  if (payload.phone !== undefined) updateData.phone = payload.phone ? payload.phone.trim() : null;
  if (payload.linkedinUrl !== undefined) updateData.linkedinUrl = payload.linkedinUrl ? payload.linkedinUrl.trim() : null;
  if (payload.showContactPublicly !== undefined) updateData.showContactPublicly = Boolean(payload.showContactPublicly);
  if (payload.availableForMentorship !== undefined || payload.openForMentorship !== undefined) {
    updateData.availableForMentorship = payload.availableForMentorship !== undefined
      ? Boolean(payload.availableForMentorship)
      : Boolean(payload.openForMentorship);
  }
  if (payload.approvalStatus !== undefined) updateData.approvalStatus = payload.approvalStatus;
  if (payload.isFeatured !== undefined) updateData.isFeatured = Boolean(payload.isFeatured);

  // Security: Prevent modifying tenant ownership under any circumstances
  delete updateData.madrasaId;

  const updated = await prisma.alumniScholar.update({
    where: { id: existing.id },
    data: updateData,
  });

  return updated;
}

/**
 * Madrasa Admin: Update Status (Approve / Reject / Toggle Feature)
 */
export async function adminUpdateScholarStatus(madrasaId, id, { approvalStatus, isFeatured }, userId) {
  const validTenantId = assertValidTenantId(madrasaId);
  if (!id || typeof id !== 'string' || !id.trim()) {
    throw new BadRequestError('Scholar identifier is required.');
  }
  const cleanId = id.trim();

  const existing = await prisma.alumniScholar.findFirst({
    where: { id: cleanId, madrasaId: validTenantId },
  });

  if (!existing) {
    throw new NotFoundError('Scholar profile not found.');
  }

  const data = {};
  if (approvalStatus) {
    data.approvalStatus = approvalStatus;
    data.reviewedByUserId = userId;
    data.reviewedAt = new Date();
  }
  if (isFeatured !== undefined) {
    data.isFeatured = Boolean(isFeatured);
  }

  const updated = await prisma.alumniScholar.update({
    where: { id: existing.id },
    data,
  });

  return updated;
}

/**
 * Madrasa Admin: Delete Scholar
 */
export async function adminDeleteScholar(madrasaId, id) {
  const validTenantId = assertValidTenantId(madrasaId);
  if (!id || typeof id !== 'string' || !id.trim()) {
    throw new BadRequestError('Scholar identifier is required.');
  }
  const cleanId = id.trim();

  const existing = await prisma.alumniScholar.findFirst({
    where: { id: cleanId, madrasaId: validTenantId },
  });

  if (!existing) {
    throw new NotFoundError('Scholar profile not found.');
  }

  await prisma.alumniScholar.delete({
    where: { id: existing.id },
  });

  return { success: true, message: 'Profile deleted successfully.' };
}

/**
 * Teacher Portal: Get read-only list of approved alumni
 */
export async function getTeacherAlumni(madrasaId) {
  const validTenantId = assertValidTenantId(madrasaId);

  const alumni = await prisma.alumniScholar.findMany({
    where: {
      madrasaId: validTenantId,
      approvalStatus: 'APPROVED',
    },
    orderBy: [
      { isFeatured: 'desc' },
      { batchYear: 'desc' },
      { fullName: 'asc' },
    ],
  });

  return alumni;
}
