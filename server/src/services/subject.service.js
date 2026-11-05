import { prisma } from '../lib/prisma.js';
import { ConflictError, NotFoundError, BadRequestError } from '../utils/errors.js';

/**
 * Lists all subjects for the authenticated Madrasa.
 *
 * @param {string} madrasaId
 * @param {{ search?: string, isActive?: boolean }} [query={}]
 * @returns {Promise<Array<object>>}
 */
export async function listSubjects(madrasaId, query = {}) {
  const where = { madrasaId };

  if (query.isActive !== undefined) {
    where.isActive = query.isActive;
  }

  if (query.search && query.search.trim()) {
    const s = query.search.trim();
    where.OR = [
      { name: { contains: s } },
      { code: { contains: s } },
    ];
  }

  return await prisma.subject.findMany({
    where,
    orderBy: { name: 'asc' },
  });
}

/**
 * Creates a new subject for the authenticated Madrasa.
 *
 * @param {string} madrasaId
 * @param {{ name: string, code?: string, description?: string }} data
 * @returns {Promise<object>}
 */
export async function createSubject(madrasaId, data) {
  const name = data.name ? data.name.trim() : '';
  const code = data.code ? data.code.trim().toUpperCase() : null;
  const description = data.description ? data.description.trim() : null;

  if (!name) {
    throw new BadRequestError('Subject name is required.');
  }

  // Check duplicate name
  const existingName = await prisma.subject.findFirst({
    where: { madrasaId, name },
  });
  if (existingName) {
    throw new ConflictError(`Subject with name "${name}" already exists.`);
  }

  // Check duplicate code
  if (code) {
    const existingCode = await prisma.subject.findFirst({
      where: { madrasaId, code },
    });
    if (existingCode) {
      throw new ConflictError(`Subject with code "${code}" already exists.`);
    }
  }

  return await prisma.subject.create({
    data: {
      madrasaId,
      name,
      code,
      description,
      isActive: true,
    },
  });
}

/**
 * Retrieves a subject by ID ensuring strict tenant ownership.
 *
 * @param {string} madrasaId
 * @param {string} subjectId
 * @returns {Promise<object>}
 */
export async function getSubject(madrasaId, subjectId) {
  const subject = await prisma.subject.findFirst({
    where: { id: subjectId, madrasaId },
  });
  if (!subject) {
    throw new NotFoundError('Subject not found.');
  }
  return subject;
}
