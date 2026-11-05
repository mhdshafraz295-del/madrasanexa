import sharp from 'sharp';
import prisma from '../lib/prisma.js';
import {
  buildMadrasaKey,
  uploadBufferToR2,
  deleteObjectFromR2,
  resolveObjectAccessUrl,
  getR2PublicUrl,
} from './r2.service.js';
import { isR2Configured } from '../config/r2.js';
import { generateInitials } from './branding.service.js';
import { NotFoundError, BadRequestError, AppError } from '../utils/errors.js';
import { logTenantActivity } from './tenant.service.js';
import { DEFAULT_THEME_TOKENS } from './madrasa-theme.service.js';

const ALLOWED_HERO_FORMATS = new Set(['jpeg', 'png', 'webp']);
const MAX_HERO_UPLOAD_SIZE = 5 * 1024 * 1024; // 5 MB

const ALLOWED_POSTER_FORMATS = new Set(['jpeg', 'png', 'webp']);
const MAX_POSTER_UPLOAD_SIZE = 5 * 1024 * 1024; // 5 MB

export function sanitizeCurriculumForPublic(curriculumJson) {
  if (!curriculumJson || typeof curriculumJson !== 'object') {
    return null;
  }

  const rawProgrammes = Array.isArray(curriculumJson.programmes) ? curriculumJson.programmes : [];
  // Strict filter: ONLY programmes with isPublished === true are exposed publicly
  const publishedProgrammes = rawProgrammes.filter((p) => p && p.isPublished === true);

  if (publishedProgrammes.length === 0) {
    return null;
  }

  const publishedCategoryIds = new Set(publishedProgrammes.map((p) => p.categoryId));
  const rawCategories = Array.isArray(curriculumJson.categories) ? curriculumJson.categories : [];
  const publishedCategories = rawCategories.filter((c) => publishedCategoryIds.has(c.id));

  return {
    categories: publishedCategories,
    programmes: publishedProgrammes,
  };
}

async function resolveItemPosters(madrasaId, items) {
  if (!Array.isArray(items) || items.length === 0) return [];
  const resolved = [];
  for (const item of items) {
    if (!item) continue;
    let posterUrl = item.posterUrl || null;
    if (item.posterFileId) {
      const file = await prisma.fileObject.findFirst({
        where: { id: item.posterFileId, madrasaId },
        select: { objectKey: true, publicUrl: true },
      });
      if (file) {
        posterUrl = file.publicUrl || (await resolveObjectAccessUrl(file.objectKey));
      }
    }
    resolved.push({ ...item, posterUrl });
  }
  return resolved;
}

/**
 * Canonical legacy-poster normalization method (Mandatory Safeguard 4).
 * Prevents duplicate images, caps images to max 5 (Mandatory Safeguard 7),
 * selects exactly one cover image, and provides backward-compatible aliases.
 */
export function normalizeEventAlbum(event) {
  if (!event || typeof event !== 'object') return null;

  const rawImages = Array.isArray(event.images) ? event.images : [];
  let normalizedImages = [];

  if (rawImages.length > 0) {
    const seenFileIds = new Set();
    for (let i = 0; i < rawImages.length && normalizedImages.length < 5; i++) {
      const img = rawImages[i];
      if (!img) continue;
      const fileId = img.fileId ? String(img.fileId).trim() : null;
      if (fileId) {
        if (seenFileIds.has(fileId)) continue;
        seenFileIds.add(fileId);
      }
      normalizedImages.push({
        id: img.id || (fileId ? `img-${fileId}` : `img-${normalizedImages.length}`),
        fileId: fileId,
        url: img.url || null,
        caption: img.caption ? String(img.caption).slice(0, 300) : null,
        isCover: !!img.isCover,
        sortOrder: typeof img.sortOrder === 'number' ? img.sortOrder : normalizedImages.length,
      });
    }
  } else if (event.posterFileId || event.posterUrl || event.coverFileId || event.coverUrl) {
    // Canonical legacy-poster normalization: convert single poster to 1-image album
    const legacyFileId = event.coverFileId || event.posterFileId || null;
    const legacyUrl = event.coverUrl || event.posterUrl || null;
    normalizedImages = [{
      id: `img-legacy-${legacyFileId || 'cover'}`,
      fileId: legacyFileId,
      url: legacyUrl,
      caption: null,
      isCover: true,
      sortOrder: 0,
    }];
  }

  // Sort by sortOrder if available
  normalizedImages.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  // If event has coverFileId explicitly set, designate that image as cover
  if (event.coverFileId) {
    const matched = normalizedImages.find((img) => img.fileId === event.coverFileId);
    if (matched) {
      normalizedImages.forEach((img) => {
        img.isCover = img === matched;
      });
    }
  }

  // Ensure exactly one cover image is designated when images are present
  if (normalizedImages.length > 0) {
    let coverFound = false;
    for (let i = 0; i < normalizedImages.length; i++) {
      if (normalizedImages[i].isCover) {
        if (!coverFound) {
          coverFound = true;
        } else {
          normalizedImages[i].isCover = false;
        }
      }
    }
    if (!coverFound) {
      normalizedImages[0].isCover = true;
    }
  }

  const coverImg = normalizedImages.find((img) => img.isCover) || normalizedImages[0] || null;
  const coverUrl = coverImg?.url || event.coverUrl || event.posterUrl || null;
  const coverFileId = coverImg?.fileId || event.coverFileId || event.posterFileId || null;

  return {
    ...event,
    coverFileId,
    coverUrl,
    posterFileId: coverFileId, // Retain backward-compatible alias
    posterUrl: coverUrl,       // Retain backward-compatible alias
    images: normalizedImages,
    photoCount: normalizedImages.length,
  };
}

/**
 * Dynamically resolves access URLs for multi-image event albums.
 * Verifies tenant ownership for every FileObject (Mandatory Safeguards 8 & 10).
 */
export async function resolveEventAlbums(madrasaId, events) {
  if (!Array.isArray(events) || events.length === 0) return [];

  const normalized = events.map((e) => normalizeEventAlbum(e)).filter(Boolean);

  // Collect unique fileIds across all events for batch lookup
  const fileIds = new Set();
  for (const ev of normalized) {
    if (ev.coverFileId) fileIds.add(ev.coverFileId);
    if (ev.posterFileId) fileIds.add(ev.posterFileId);
    for (const img of ev.images || []) {
      if (img.fileId) fileIds.add(img.fileId);
    }
  }

  const urlMap = new Map();
  if (fileIds.size > 0) {
    const files = await prisma.fileObject.findMany({
      where: {
        id: { in: Array.from(fileIds) },
        madrasaId, // Strict tenant isolation check
      },
      select: { id: true, objectKey: true, publicUrl: true },
    });

    for (const f of files) {
      const url = f.publicUrl || (await resolveObjectAccessUrl(f.objectKey));
      urlMap.set(f.id, url);
    }
  }

  return normalized.map((ev) => {
    const resolvedImages = (ev.images || []).map((img, idx) => {
      const resolvedUrl = img.fileId ? (urlMap.get(img.fileId) || img.url || null) : (img.url || null);
      return {
        ...img,
        sortOrder: typeof img.sortOrder === 'number' ? img.sortOrder : idx,
        url: resolvedUrl,
      };
    });

    const coverImg = resolvedImages.find((img) => img.isCover) || resolvedImages[0] || null;
    const coverUrl =
      coverImg?.url ||
      (ev.coverFileId ? urlMap.get(ev.coverFileId) : null) ||
      (ev.posterFileId ? urlMap.get(ev.posterFileId) : null) ||
      ev.posterUrl ||
      null;
    const coverFileId = coverImg?.fileId || ev.coverFileId || ev.posterFileId || null;

    return {
      ...ev,
      coverFileId,
      coverUrl,
      posterFileId: coverFileId,
      posterUrl: coverUrl,
      images: resolvedImages,
      photoCount: resolvedImages.length,
    };
  });
}

function sanitizeOriginalFilename(rawName) {
  if (!rawName || typeof rawName !== 'string') return 'hero.webp';
  return rawName
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\.{2,}/g, '_')
    .replace(/\s+/g, '_')
    .substring(0, 100);
}

/**
 * Generates a deterministic, rule-based institutional summary.
 * No external AI API key or network dependency required.
 */
export function buildDeterministicSummary({
  madrasaName,
  introduction,
  mission,
  vision,
  syllabusInfo,
  rulesAndRegulations,
  classesCount = 0
}) {
  const sections = [];

  // Paragraph 1: Executive Overview
  if (introduction && introduction.trim()) {
    sections.push(introduction.trim());
  } else {
    sections.push(
      `${madrasaName} is a distinguished Islamic educational institution committed to nurturing academic excellence, Islamic scholarship, and character development within our community.`
    );
  }

  // Paragraph 2: Core Purpose & Values
  if (mission && vision) {
    sections.push(
      `Our institutional mission is anchored in: "${mission.trim()}". Guided by our overarching vision: "${vision.trim()}", we instill timeless Islamic values alongside holistic learning.`
    );
  } else if (mission) {
    sections.push(`Our mission: "${mission.trim()}". We strive to prepare upright, educated individuals who serve society.`);
  } else if (vision) {
    sections.push(`Our overarching vision: "${vision.trim()}".`);
  }

  // Paragraph 3: Academic & Curriculum Framework
  if (syllabusInfo && syllabusInfo.trim()) {
    sections.push(
      `Academic Framework: ${syllabusInfo.trim()} Structured across comprehensive study levels, the curriculum emphasizes rigorous Quranic studies, Tajweed, Islamic jurisprudence, and supportive foundational subjects.`
    );
  } else {
    const classContext = classesCount > 0 ? ` featuring ${classesCount} active classes` : '';
    sections.push(
      `Our structured educational curriculum${classContext} combines foundational Quranic education, Hadith studies, Arabic language proficiency, and essential life disciplines.`
    );
  }

  // Paragraph 4: Code of Conduct & Standards
  if (rulesAndRegulations && rulesAndRegulations.trim()) {
    sections.push(
      `Institutional Standards: Students and staff adhere to established guidelines fostering punctuality, mutual respect, and moral integrity: ${rulesAndRegulations.trim().slice(0, 300)}${rulesAndRegulations.trim().length > 300 ? '...' : ''}`
    );
  }

  return sections.join('\n\n');
}

/**
 * Retrieves the Madrasa Profile for a tenant, initializing a default draft if none exists.
 */
export async function getTenantProfile(madrasaId) {
  let profile = await prisma.madrasaProfile.findUnique({
    where: { madrasaId }
  });

  const madrasa = await prisma.madrasa.findUnique({
    where: { id: madrasaId },
    include: {
      settings: true
    }
  });

  if (!madrasa) {
    throw new NotFoundError('Madrasa not found.');
  }

  if (!profile) {
    // Initialize draft profile
    profile = await prisma.madrasaProfile.create({
      data: {
        madrasaId,
        isPublished: false,
        heroTitle: `Welcome to ${madrasa.name}`,
        heroSubtitle: 'Dedicated to traditional Islamic education and scholarly excellence.',
        introduction: `${madrasa.name} provides a balanced Islamic and academic education designed to nurture students of upright character.`,
        contactPhone: madrasa.phone || null,
        contactEmail: madrasa.email || null,
        address: madrasa.address || null,
        eventsJson: [],
        noticesJson: []
      }
    });
  }

  let logoUrl = null;
  if (madrasa.logoFileId) {
    const logoFile = await prisma.fileObject.findFirst({
      where: {
        id: madrasa.logoFileId,
        madrasaId,
        type: 'MADRASA_LOGO',
      },
    });
    if (logoFile) {
      logoUrl = await resolveObjectAccessUrl(logoFile.objectKey);
    }
  }

  let heroImageUrl = null;
  if (profile.heroImageFileId) {
    const heroFile = await prisma.fileObject.findFirst({
      where: {
        id: profile.heroImageFileId,
        madrasaId,
        type: 'MADRASA_HERO_IMAGE',
      },
    });
    if (heroFile) {
      heroImageUrl = await resolveObjectAccessUrl(heroFile.objectKey);
    }
  }

  const resolvedEvents = await resolveEventAlbums(madrasaId, profile.eventsJson);
  const resolvedNotices = await resolveItemPosters(madrasaId, profile.noticesJson);

  let resolvedStaffJson = profile.staffJson;
  if (resolvedStaffJson && typeof resolvedStaffJson === 'object' && Array.isArray(resolvedStaffJson.items)) {
    const items = [];
    for (const item of resolvedStaffJson.items) {
      if (!item) continue;
      let photoUrl = item.photoUrl || null;
      if (item.photoFileId) {
        const file = await prisma.fileObject.findFirst({
          where: { id: item.photoFileId, madrasaId },
          select: { objectKey: true, publicUrl: true },
        });
        if (file) {
          photoUrl = file.publicUrl || (await resolveObjectAccessUrl(file.objectKey));
        }
      }
      items.push({ ...item, photoUrl });
    }
    resolvedStaffJson = { ...resolvedStaffJson, items };
  }

  return {
    ...profile,
    staffJson: resolvedStaffJson,
    eventsJson: resolvedEvents,
    noticesJson: resolvedNotices,
    heroImageUrl,
    madrasa: {
      id: madrasa.id,
      name: madrasa.name,
      code: madrasa.code,
      slug: madrasa.slug,
      logoFileId: madrasa.logoFileId,
      logoUrl,
      initials: generateInitials(madrasa.name),
    }
  };
}

/**
 * Updates Madrasa Profile fields for a tenant.
 */
export async function updateTenantProfile(madrasaId, data, userId = null) {
  const existing = await getTenantProfile(madrasaId);

  if (data.staffJson !== undefined && data.staffJson !== null) {
    if (Array.isArray(data.staffJson.items)) {
      const ustadhIds = data.staffJson.items.map((it) => it.ustadhId).filter(Boolean);
      if (ustadhIds.length > 0) {
        const validUstadhs = await prisma.ustadh.findMany({
          where: { id: { in: ustadhIds }, madrasaId },
          select: { id: true },
        });
        const validSet = new Set(validUstadhs.map((u) => u.id));
        for (const uid of ustadhIds) {
          if (!validSet.has(uid)) {
            throw new BadRequestError(`Ustadh ID ${uid} is invalid or does not belong to this madrasa.`);
          }
        }
      }
      const photoFileIds = data.staffJson.items.map((it) => it.photoFileId).filter(Boolean);
      if (photoFileIds.length > 0) {
        const validFiles = await prisma.fileObject.findMany({
          where: { id: { in: photoFileIds }, madrasaId },
          select: { id: true },
        });
        const validFileSet = new Set(validFiles.map((f) => f.id));
        for (const fid of photoFileIds) {
          if (!validFileSet.has(fid)) {
            throw new BadRequestError(`Photo file ID ${fid} is invalid or does not belong to this madrasa.`);
          }
        }
      }
    }
  }

  const updated = await prisma.madrasaProfile.update({
    where: { madrasaId },
    data: {
      heroTitle: data.heroTitle !== undefined ? data.heroTitle : existing.heroTitle,
      heroSubtitle: data.heroSubtitle !== undefined ? data.heroSubtitle : existing.heroSubtitle,
      introduction: data.introduction !== undefined ? data.introduction : existing.introduction,
      mission: data.mission !== undefined ? data.mission : existing.mission,
      vision: data.vision !== undefined ? data.vision : existing.vision,
      syllabusInfo: data.syllabusInfo !== undefined ? data.syllabusInfo : existing.syllabusInfo,
      rulesAndRegulations: data.rulesAndRegulations !== undefined ? data.rulesAndRegulations : existing.rulesAndRegulations,
      contactPhone: data.contactPhone !== undefined ? data.contactPhone : existing.contactPhone,
      contactEmail: data.contactEmail !== undefined ? (data.contactEmail || null) : existing.contactEmail,
      address: data.address !== undefined ? data.address : existing.address,
      curriculumJson: data.curriculumJson !== undefined ? data.curriculumJson : existing.curriculumJson,
      staffJson: data.staffJson !== undefined ? data.staffJson : existing.staffJson,
      eventsJson: data.eventsJson !== undefined
        ? (Array.isArray(data.eventsJson) ? data.eventsJson.map(normalizeEventAlbum).filter(Boolean) : data.eventsJson)
        : existing.eventsJson,
      noticesJson: data.noticesJson !== undefined ? data.noticesJson : existing.noticesJson
    }
  });

  if (userId) {
    await logTenantActivity({
      madrasaId,
      userId,
      action: 'UPDATE_HOMEPAGE_PROFILE',
      details: 'Madrasa homepage profile draft updated.'
    });
  }

  return updated;
}

/**
 * Deterministically generates and saves the institutional summary.
 */
export async function generateProfileSummary(madrasaId, userId = null) {
  const profile = await getTenantProfile(madrasaId);
  const classesCount = await prisma.class.count({
    where: { madrasaId, isActive: true }
  });

  const generatedSummary = buildDeterministicSummary({
    madrasaName: profile.madrasa.name,
    introduction: profile.introduction,
    mission: profile.mission,
    vision: profile.vision,
    syllabusInfo: profile.syllabusInfo,
    rulesAndRegulations: profile.rulesAndRegulations,
    classesCount
  });

  const updated = await prisma.madrasaProfile.update({
    where: { madrasaId },
    data: {
      generatedSummary,
      summaryGeneratedAt: new Date()
    }
  });

  if (userId) {
    await logTenantActivity({
      madrasaId,
      userId,
      action: 'GENERATE_HOMEPAGE_SUMMARY',
      details: 'Deterministic institutional summary generated.'
    });
  }

  return updated;
}

/**
 * Explicitly publishes the profile.
 */
export async function publishTenantProfile(madrasaId, userId = null) {
  await getTenantProfile(madrasaId);

  const updated = await prisma.madrasaProfile.update({
    where: { madrasaId },
    data: {
      isPublished: true,
      publishedAt: new Date()
    }
  });

  if (userId) {
    await logTenantActivity({
      madrasaId,
      userId,
      action: 'PUBLISH_HOMEPAGE_PROFILE',
      details: 'Madrasa homepage profile published to public portal.'
    });
  }

  return updated;
}

/**
 * Unpublishes the profile (returns to draft).
 */
export async function unpublishTenantProfile(madrasaId, userId = null) {
  await getTenantProfile(madrasaId);

  const updated = await prisma.madrasaProfile.update({
    where: { madrasaId },
    data: {
      isPublished: false,
      publishedAt: null
    }
  });

  if (userId) {
    await logTenantActivity({
      madrasaId,
      userId,
      action: 'UNPUBLISH_HOMEPAGE_PROFILE',
      details: 'Madrasa homepage profile unpublished (draft mode).'
    });
  }

  return updated;
}

/**
 * Broadcasts a published notice to eligible guardians of the madrasa.
 */
export async function broadcastNoticeToGuardians(madrasaId, noticeId, userId = null) {
  const profile = await prisma.madrasaProfile.findUnique({
    where: { madrasaId },
    include: { madrasa: true }
  });

  if (!profile) {
    throw new NotFoundError('Madrasa profile not found.');
  }

  const notices = Array.isArray(profile.noticesJson) ? profile.noticesJson : [];
  const notice = notices.find(n => n.id === noticeId);

  if (!notice) {
    throw new NotFoundError(`Notice with ID "${noticeId}" not found in madrasa profile.`);
  }

  // Get all active students with guardian contact info
  const activeStudents = await prisma.student.findMany({
    where: {
      madrasaId,
      status: 'ACTIVE'
    },
    select: {
      id: true,
      fullName: true,
      guardianName: true,
      guardianPhone: true,
      guardianEmail: true,
      whatsappOptIn: true
    }
  });

  const jobsToCreate = [];
  const now = new Date();

  for (const student of activeStudents) {
    // SMS / WhatsApp notification job
    if (student.guardianPhone && student.guardianPhone.trim()) {
      jobsToCreate.push({
        madrasaId,
        channel: 'SMS',
        eventType: 'MADRASA_NOTICE_BROADCAST',
        recipientType: 'GUARDIAN',
        recipientEntityId: student.id,
        recipientAddress: student.guardianPhone.trim(),
        recipientName: student.guardianName || student.fullName,
        subject: `[${profile.madrasa.name}] ${notice.title}`,
        message: `${notice.title}\n\n${notice.content}`,
        payloadJson: { noticeId: notice.id, studentId: student.id, madrasaSlug: profile.madrasa.slug },
        relatedEntityType: 'MadrasaNotice',
        relatedEntityId: notice.id,
        dedupeKey: `MADRASA_NOTICE_BROADCAST:${notice.id}:${student.id}:SMS`,
        status: 'PENDING',
        nextAttemptAt: now
      });
    }

    // Email notification job
    if (student.guardianEmail && student.guardianEmail.trim()) {
      jobsToCreate.push({
        madrasaId,
        channel: 'EMAIL',
        eventType: 'MADRASA_NOTICE_BROADCAST',
        recipientType: 'GUARDIAN',
        recipientEntityId: student.id,
        recipientAddress: student.guardianEmail.trim(),
        recipientName: student.guardianName || student.fullName,
        subject: `Notice: ${notice.title} - ${profile.madrasa.name}`,
        message: `${notice.content}\n\nWarm regards,\n${profile.madrasa.name}`,
        payloadJson: { noticeId: notice.id, studentId: student.id, madrasaSlug: profile.madrasa.slug },
        relatedEntityType: 'MadrasaNotice',
        relatedEntityId: notice.id,
        dedupeKey: `MADRASA_NOTICE_BROADCAST:${notice.id}:${student.id}:EMAIL`,
        status: 'PENDING',
        nextAttemptAt: now
      });
    }
  }

  let createdCount = 0;
  if (jobsToCreate.length > 0) {
    const result = await prisma.notificationJob.createMany({
      data: jobsToCreate,
      skipDuplicates: true
    });
    createdCount = result.count;
  }

  if (userId) {
    await logTenantActivity({
      madrasaId,
      userId,
      action: 'BROADCAST_NOTICE',
      details: `Notice "${notice.title}" broadcast queued for ${createdCount} guardian channels.`
    });
  }

  return {
    noticeId: notice.id,
    noticeTitle: notice.title,
    recipientsQueued: createdCount,
    totalEligibleStudents: activeStudents.length
  };
}

/**
 * Public endpoint: Retrieves a madrasa profile by its slug.
 * ONLY published profiles of ACTIVE madrasas are returned.
 * Unpublished profiles return 404 (zero leak of draft content).
 */
export async function getPublicProfileBySlug(slug) {
  if (!slug || typeof slug !== 'string') {
    throw new NotFoundError('Invalid madrasa slug.');
  }

  const madrasa = await prisma.madrasa.findUnique({
    where: { slug },
    include: {
      profile: true,
      admissionPeriods: {
        where: { isOpen: true },
        select: {
          id: true,
          code: true,
          name: true,
          academicYear: true,
          startDate: true,
          endDate: true,
          isOpen: true,
          instructions: true,
          capacity: true
        }
      }
    }
  });

  if (!madrasa || madrasa.status !== 'ACTIVE') {
    throw new NotFoundError('Madrasa not found or is currently inactive.');
  }

  if (!madrasa.profile || !madrasa.profile.isPublished) {
    throw new NotFoundError('Madrasa portal has not been published yet.');
  }

  // Filter published notices and events only, and dynamically resolve poster / album URLs
  const allEvents = Array.isArray(madrasa.profile.eventsJson) ? madrasa.profile.eventsJson : [];
  const publishedEvents = await resolveEventAlbums(madrasa.id, allEvents.filter(e => e.isPublished !== false));

  const allNotices = Array.isArray(madrasa.profile.noticesJson) ? madrasa.profile.noticesJson : [];
  const publishedNotices = await resolveItemPosters(madrasa.id, allNotices.filter(n => n.isPublished !== false));

  let logoUrl = null;
  if (madrasa.logoFileId) {
    const logoFile = await prisma.fileObject.findFirst({
      where: {
        id: madrasa.logoFileId,
        madrasaId: madrasa.id,
        type: 'MADRASA_LOGO',
      },
    });
    if (logoFile) {
      logoUrl = await resolveObjectAccessUrl(logoFile.objectKey);
    }
  }

  let heroImageUrl = null;
  if (madrasa.profile.heroImageFileId) {
    const heroFile = await prisma.fileObject.findFirst({
      where: {
        id: madrasa.profile.heroImageFileId,
        madrasaId: madrasa.id,
        type: 'MADRASA_HERO_IMAGE',
      },
    });
    if (heroFile) {
      heroImageUrl = await resolveObjectAccessUrl(heroFile.objectKey);
    }
  }

  // Actual tenant-specific statistics & public staff resolution
  let stats = null;
  let staff = null;

  const staffConfig = madrasa.profile.staffJson && typeof madrasa.profile.staffJson === 'object'
    ? madrasa.profile.staffJson
    : null;

  const isStaffEnabled = staffConfig ? staffConfig.isEnabled !== false : false;
  const isStatsEnabled = staffConfig ? staffConfig.showStats !== false : true;

  if (isStatsEnabled) {
    const [totalStudents, totalStaff, totalTeachers] = await Promise.all([
      prisma.student.count({ where: { madrasaId: madrasa.id, status: 'ACTIVE' } }),
      prisma.ustadh.count({ where: { madrasaId: madrasa.id, isActive: true } }),
      prisma.ustadh.count({ where: { madrasaId: madrasa.id, isActive: true, staffType: 'USTADH' } }),
    ]);

    stats = {
      totalStudents,
      totalStaff,
      totalTeachers,
    };
  }

  if (isStaffEnabled && staffConfig && Array.isArray(staffConfig.items)) {
    const publicItems = staffConfig.items
      .filter((item) => item && item.isPublic !== false && item.ustadhId)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

    if (publicItems.length > 0) {
      const ustadhIds = publicItems.map((it) => it.ustadhId);
      const activeUstadhs = await prisma.ustadh.findMany({
        where: {
          id: { in: ustadhIds },
          madrasaId: madrasa.id,
          isActive: true, // Strictly active staff only
        },
        select: {
          id: true,
          fullName: true,
          staffType: true,
          ustadhCode: true,
        },
      });

      const ustadhMap = new Map(activeUstadhs.map((u) => [u.id, u]));

      const publicStaffMembers = [];
      for (const item of publicItems) {
        const canonicalUstadh = ustadhMap.get(item.ustadhId);
        if (!canonicalUstadh) continue; // Inactive or departed staff dropped

        let photoUrl = item.photoUrl || null;
        if (item.photoFileId) {
          const file = await prisma.fileObject.findFirst({
            where: { id: item.photoFileId, madrasaId: madrasa.id },
            select: { objectKey: true, publicUrl: true },
          });
          if (file) {
            photoUrl = file.publicUrl || (await resolveObjectAccessUrl(file.objectKey));
          }
        }

        publicStaffMembers.push({
          id: canonicalUstadh.id,
          fullName: canonicalUstadh.fullName,
          designation: item.designation || (canonicalUstadh.staffType === 'USTADH' ? 'Ustadh / Scholar' : 'Faculty Member'),
          department: item.department || null,
          qualification: item.qualification || null,
          experienceYears: item.experienceYears || null,
          bio: item.bio || null,
          photoUrl,
          sortOrder: item.sortOrder ?? 0,
        });
      }

      staff = {
        isEnabled: true,
        sectionTitle: staffConfig.sectionTitle || 'Our Scholarly Faculty & Mentors',
        sectionSubtitle: staffConfig.sectionSubtitle || 'Dedicated scholars and educators guiding hearts and minds with wisdom and care.',
        members: publicStaffMembers,
      };
    } else {
      staff = {
        isEnabled: true,
        sectionTitle: staffConfig.sectionTitle || 'Our Scholarly Faculty & Mentors',
        sectionSubtitle: staffConfig.sectionSubtitle || 'Dedicated scholars and educators guiding hearts and minds with wisdom and care.',
        members: [],
      };
    }
  }

  return {
    madrasa: {
      id: madrasa.id,
      name: madrasa.name,
      code: madrasa.code,
      slug: madrasa.slug,
      logoFileId: madrasa.logoFileId,
      logoUrl,
      initials: generateInitials(madrasa.name),
    },
    heroTitle: madrasa.profile.heroTitle,
    heroSubtitle: madrasa.profile.heroSubtitle,
    heroImageUrl,
    introduction: madrasa.profile.introduction,
    mission: madrasa.profile.mission,
    vision: madrasa.profile.vision,
    syllabusInfo: madrasa.profile.syllabusInfo,
    rulesAndRegulations: madrasa.profile.rulesAndRegulations,
    curriculum: sanitizeCurriculumForPublic(madrasa.profile.curriculumJson),
    stats,
    staff,
    generatedSummary: madrasa.profile.generatedSummary,
    contactPhone: madrasa.profile.contactPhone || madrasa.phone,
    contactEmail: madrasa.profile.contactEmail || madrasa.email,
    address: madrasa.profile.address || madrasa.address,
    events: publishedEvents,
    notices: publishedNotices,
    publishedAt: madrasa.profile.publishedAt,
    activeAdmissionPeriods: madrasa.admissionPeriods,
    theme: (() => {
      const raw = madrasa.profile.themePublishedJson || DEFAULT_THEME_TOKENS;
      const isLegacyIvory = raw.pageBg && String(raw.pageBg).toLowerCase() === '#f7f6f0';
      const resolvedPageBg = isLegacyIvory ? '#ffffff' : (raw.pageBg || '#ffffff');
      return {
        ...raw,
        pageBg: resolvedPageBg,
        navbarBg: isLegacyIvory ? '#ffffff' : (raw.navbarBg || resolvedPageBg),
      };
    })(),
  };
}

/**
 * Uploads, validates, optimizes, and atomically sets the Madrasa Hero Background Image.
 *
 * Security & Reliability Guarantees:
 * - Multer memory storage (size <= 5MB)
 * - Sharp decompression bomb protection (limitInputPixels, dimension check)
 * - Strict SVG and malicious payload rejection
 * - 16:9 recommended ratio optimization (max 1920x1080)
 * - High-efficiency WebP conversion at quality 85
 * - Atomic DB update with R2 compensation rollback
 * - Non-blocking cleanup of previously active hero image
 */
export async function uploadHeroImage(
  madrasaId,
  fileBuffer,
  originalName,
  userId = null,
  ipAddress = null,
  userAgent = null
) {
  if (!fileBuffer || !Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
    throw new BadRequestError('No image file provided. Please upload a valid image.');
  }

  if (fileBuffer.length > MAX_HERO_UPLOAD_SIZE) {
    throw new BadRequestError('Hero background image must be smaller than 5 MB.');
  }

  // Reject SVGs strictly before sharp decoding to prevent XML parsing/SSRF/Stored XSS
  const nameLower = (originalName || '').toLowerCase();
  const isSvgExtension = nameLower.endsWith('.svg');
  const bufferPrefix = fileBuffer.slice(0, 100).toString('utf8').toLowerCase();
  const isSvgContent = bufferPrefix.includes('<svg') || bufferPrefix.includes('<?xml');

  if (isSvgExtension || isSvgContent) {
    throw new BadRequestError('SVG images are not allowed for security reasons. Please upload a JPG, PNG or WebP image.');
  }

  // Decompression-bomb and format validation using Sharp
  let metadata;
  try {
    const probe = sharp(fileBuffer, {
      limitInputPixels: 16777216,
      failOnError: true,
    });
    metadata = await probe.metadata();
  } catch (err) {
    throw new BadRequestError('Corrupted or invalid image file. Please upload a valid JPG, PNG, or WebP image.');
  }

  if (metadata.format === 'svg') {
    throw new BadRequestError('SVG images are not allowed for security reasons. Please upload a JPG, PNG or WebP image.');
  }

  if (!metadata.format || !ALLOWED_HERO_FORMATS.has(metadata.format)) {
    throw new BadRequestError('Please upload a JPG, PNG or WebP image.');
  }

  if (metadata.pages && metadata.pages > 1) {
    throw new BadRequestError('Animated or multi-page images are not supported.');
  }

  if ((metadata.width && metadata.width > 4096) || (metadata.height && metadata.height > 4096)) {
    throw new BadRequestError('Image dimensions are too large. Maximum supported dimensions are 4096x4096.');
  }

  // Optimize hero image: fit inside 1920x1080 (16:9), WebP at quality 85
  let processedBuffer;
  try {
    processedBuffer = await sharp(fileBuffer, { limitInputPixels: 16777216 })
      .resize(1920, 1080, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toBuffer();
  } catch (err) {
    throw new BadRequestError('Failed to process image. Please ensure it is a valid image file.');
  }

  const uniqueId = `hero_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const objectKey = buildMadrasaKey(madrasaId, 'hero', `${uniqueId}.webp`);

  try {
    await uploadBufferToR2(objectKey, processedBuffer, 'image/webp');
  } catch (storageErr) {
    console.error('[MadrasaProfileService] Hero storage upload failed:', storageErr.message);
    if (!isR2Configured()) {
      throw new AppError('File storage is not configured.', 500);
    }
    throw new AppError(storageErr.message || 'File storage service is unavailable.', 500);
  }

  let newFileRecord;
  let previousHeroFileId = null;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Ensure profile exists
      let profile = await tx.madrasaProfile.findUnique({
        where: { madrasaId },
        select: { id: true, heroImageFileId: true }
      });

      if (!profile) {
        profile = await tx.madrasaProfile.create({
          data: {
            madrasaId,
            isPublished: false,
          },
          select: { id: true, heroImageFileId: true }
        });
      }

      previousHeroFileId = profile.heroImageFileId;

      const fileRecord = await tx.fileObject.create({
        data: {
          madrasaId,
          type: 'MADRASA_HERO_IMAGE',
          objectKey,
          originalName: sanitizeOriginalFilename(originalName),
          mimeType: 'image/webp',
          size: processedBuffer.length,
          publicUrl: getR2PublicUrl(objectKey) || null,
        },
      });

      await tx.madrasaProfile.update({
        where: { madrasaId },
        data: { heroImageFileId: fileRecord.id },
      });

      await tx.activityLog.create({
        data: {
          madrasaId,
          userId: userId || null,
          action: 'HERO_IMAGE_UPDATED',
          entityType: 'MADRASA_PROFILE',
          entityId: profile.id,
          metadata: {
            fileId: fileRecord.id,
            objectKey,
            size: processedBuffer.length,
            mimeType: 'image/webp',
          },
          ipAddress: ipAddress ? String(ipAddress).slice(0, 45) : null,
          userAgent: userAgent ? String(userAgent).slice(0, 500) : null,
        },
      });

      return fileRecord;
    });

    newFileRecord = result;
  } catch (dbError) {
    try {
      await deleteObjectFromR2(objectKey);
    } catch (cleanupErr) {
      console.warn('[MadrasaProfileService] Compensation cleanup failed for orphaned hero object:', objectKey, cleanupErr.message);
    }
    throw dbError;
  }

  // Non-blocking cleanup of previous hero image
  if (previousHeroFileId && previousHeroFileId !== newFileRecord.id) {
    cleanupPreviousHeroFile(madrasaId, previousHeroFileId, newFileRecord.id).catch((err) => {
      console.warn('[MadrasaProfileService] Cleanup of previous hero image failed:', err.message);
    });
  }

  const heroImageUrl = await resolveObjectAccessUrl(objectKey);

  return {
    success: true,
    message: 'Hero background image updated successfully.',
    data: {
      fileId: newFileRecord.id,
      heroImageUrl,
      heroImageFileId: newFileRecord.id,
      size: processedBuffer.length,
      mimeType: 'image/webp',
    },
  };
}

/**
 * Removes the hero background image for a madrasa and cleans up storage.
 */
export async function removeHeroImage(
  madrasaId,
  userId = null,
  ipAddress = null,
  userAgent = null
) {
  const profile = await prisma.madrasaProfile.findUnique({
    where: { madrasaId },
    select: { id: true, heroImageFileId: true },
  });

  if (!profile) {
    throw new NotFoundError('Madrasa profile not found.');
  }

  const oldFileId = profile.heroImageFileId;
  if (!oldFileId) {
    return {
      success: true,
      message: 'No hero background image to remove.',
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.madrasaProfile.update({
      where: { madrasaId },
      data: { heroImageFileId: null },
    });

    await tx.activityLog.create({
      data: {
        madrasaId,
        userId: userId || null,
        action: 'HERO_IMAGE_REMOVED',
        entityType: 'MADRASA_PROFILE',
        entityId: profile.id,
        metadata: { removedFileId: oldFileId },
        ipAddress: ipAddress ? String(ipAddress).slice(0, 45) : null,
        userAgent: userAgent ? String(userAgent).slice(0, 500) : null,
      },
    });
  });

  cleanupPreviousHeroFile(madrasaId, oldFileId, null).catch((err) => {
    console.warn('[MadrasaProfileService] Cleanup of removed hero image failed:', err.message);
  });

  return {
    success: true,
    message: 'Hero background image removed successfully.',
  };
}

/**
 * Safely cleans up an old hero image file from DB and R2.
 */
async function cleanupPreviousHeroFile(madrasaId, oldFileId, currentActiveFileId) {
  if (!oldFileId || oldFileId === currentActiveFileId) return;

  const currentProfile = await prisma.madrasaProfile.findUnique({
    where: { madrasaId },
    select: { heroImageFileId: true },
  });

  if (currentProfile?.heroImageFileId === oldFileId) {
    return;
  }

  const oldFile = await prisma.fileObject.findFirst({
    where: {
      id: oldFileId,
      madrasaId,
      type: 'MADRASA_HERO_IMAGE',
    },
  });

  if (!oldFile) return;

  try {
    await prisma.fileObject.delete({ where: { id: oldFile.id } });
  } catch (err) {
    console.warn('[MadrasaProfileService] Failed to delete old hero FileObject:', err.message);
    return;
  }

  try {
    await deleteObjectFromR2(oldFile.objectKey);
  } catch (r2Err) {
    console.warn('[MadrasaProfileService] Failed to delete old hero R2 object:', oldFile.objectKey, r2Err.message);
  }
}

/**
 * Uploads, validates, optimizes, and stores a homepage notice or event poster to Cloudflare R2.
 */
export async function uploadHomepagePoster(
  madrasaId,
  fileBuffer,
  originalName,
  userId = null,
  ipAddress = null,
  userAgent = null
) {
  if (!fileBuffer || !Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
    throw new BadRequestError('No image file provided. Please upload a valid image.');
  }

  if (fileBuffer.length > MAX_POSTER_UPLOAD_SIZE) {
    throw new BadRequestError('Poster image must be smaller than 5 MB.');
  }

  const nameLower = (originalName || '').toLowerCase();
  const isSvgExtension = nameLower.endsWith('.svg');
  const bufferPrefix = fileBuffer.slice(0, 100).toString('utf8').toLowerCase();
  const isSvgContent = bufferPrefix.includes('<svg') || bufferPrefix.includes('<?xml');

  if (isSvgExtension || isSvgContent) {
    throw new BadRequestError('SVG images are not allowed for security reasons. Please upload a JPG, PNG or WebP image.');
  }

  let metadata;
  try {
    const probe = sharp(fileBuffer, {
      limitInputPixels: 67108864,
      failOnError: true,
    });
    metadata = await probe.metadata();
  } catch (err) {
    throw new BadRequestError('Corrupted or invalid image file. Please upload a valid JPG, PNG, or WebP image.');
  }

  if (metadata.format === 'svg') {
    throw new BadRequestError('SVG images are not allowed for security reasons. Please upload a JPG, PNG or WebP image.');
  }

  if (!metadata.format || !ALLOWED_POSTER_FORMATS.has(metadata.format)) {
    throw new BadRequestError('Please upload a JPG, PNG or WebP image.');
  }

  if (metadata.pages && metadata.pages > 1) {
    throw new BadRequestError('Animated or multi-page images are not supported.');
  }

  if ((metadata.width && metadata.width > 8192) || (metadata.height && metadata.height > 8192)) {
    throw new BadRequestError('Image dimensions are too large. Maximum supported dimensions are 8192x8192.');
  }

  // High-Quality HD image processing: up to 3840px (4K), Lanczos3 high-precision filter, auto-rotation, WebP at quality 94
  let processedBuffer;
  try {
    processedBuffer = await sharp(fileBuffer, { limitInputPixels: 67108864 })
      .rotate()
      .resize(3840, 3840, {
        fit: 'inside',
        withoutEnlargement: true,
        kernel: sharp.kernel.lanczos3,
      })
      .webp({
        quality: 94,
        effort: 4,
        smartSubsample: true,
      })
      .toBuffer();
  } catch (err) {
    throw new BadRequestError('Failed to process image. Please ensure it is a valid image file.');
  }

  const uniqueId = `poster_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const objectKey = buildMadrasaKey(madrasaId, 'posters', `${uniqueId}.webp`);

  try {
    await uploadBufferToR2(objectKey, processedBuffer, 'image/webp');
  } catch (storageErr) {
    console.error('[MadrasaProfileService] Poster storage upload failed:', storageErr.message);
    if (!isR2Configured()) {
      throw new AppError('File storage is not configured.', 500);
    }
    throw new AppError(storageErr.message || 'File storage service is unavailable.', 500);
  }

  let fileRecord;
  try {
    fileRecord = await prisma.fileObject.create({
      data: {
        madrasaId,
        type: 'OTHER',
        objectKey,
        originalName: sanitizeOriginalFilename(originalName),
        mimeType: 'image/webp',
        size: processedBuffer.length,
        publicUrl: getR2PublicUrl(objectKey) || null,
      },
    });

    if (userId) {
      await logTenantActivity({
        madrasaId,
        userId,
        action: 'POSTER_UPLOADED',
        details: `Homepage poster uploaded (${fileRecord.id}).`,
        ipAddress,
        userAgent,
      });
    }
  } catch (dbError) {
    try {
      await deleteObjectFromR2(objectKey);
    } catch (cleanupErr) {
      console.warn('[MadrasaProfileService] Compensation cleanup failed for orphaned poster object:', objectKey, cleanupErr.message);
    }
    throw dbError;
  }

  const posterUrl = await resolveObjectAccessUrl(objectKey);

  return {
    success: true,
    message: 'Poster uploaded successfully.',
    data: {
      fileId: fileRecord.id,
      posterUrl,
      size: processedBuffer.length,
      mimeType: 'image/webp',
    },
  };
}

/**
 * Removes a homepage poster and safely deletes the R2 object.
 */
export async function removeHomepagePoster(madrasaId, fileId, userId = null, ipAddress = null, userAgent = null) {
  if (!fileId) {
    throw new BadRequestError('fileId is required.');
  }

  const fileObject = await prisma.fileObject.findFirst({
    where: {
      id: fileId,
      madrasaId,
    },
  });

  if (!fileObject) {
    throw new NotFoundError('Poster file not found or unauthorized.');
  }

  await prisma.fileObject.delete({
    where: { id: fileObject.id },
  });

  try {
    await deleteObjectFromR2(fileObject.objectKey);
  } catch (err) {
    console.warn('[MadrasaProfileService] Failed to delete poster from R2:', fileObject.objectKey, err.message);
  }

  if (userId) {
    await logTenantActivity({
      madrasaId,
      userId,
      action: 'POSTER_REMOVED',
      details: `Homepage poster file removed (${fileId}).`,
      ipAddress,
      userAgent,
    });
  }

  return {
    success: true,
    message: 'Poster removed successfully.',
  };
}

/**
 * Uploads, validates, optimizes, and stores multiple event album images.
 * Caps at maximum 5 images and processes sequentially to protect server memory.
 */
export async function uploadEventImages(
  madrasaId,
  files,
  userId = null,
  ipAddress = null,
  userAgent = null
) {
  if (!files || !Array.isArray(files) || files.length === 0) {
    throw new BadRequestError('No image files provided.');
  }

  if (files.length > 5) {
    throw new BadRequestError('An event album supports a maximum of 5 images.');
  }

  const results = [];
  for (const file of files) {
    const singleResult = await uploadHomepagePoster(
      madrasaId,
      file.buffer,
      file.originalname,
      userId,
      ipAddress,
      userAgent
    );
    results.push(singleResult.data);
  }

  return {
    success: true,
    message: `${results.length} image(s) uploaded successfully.`,
    data: results,
  };
}
