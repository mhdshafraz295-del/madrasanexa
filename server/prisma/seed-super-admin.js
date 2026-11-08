import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { hashPassword, validatePasswordStrength } from '../src/utils/password.js';
import { normalizeEmail } from '../src/utils/email-normalization.js';

// Load environment variables from .env if present
dotenv.config();

/**
 * Zod schema for email address validation.
 */
const emailSchema = z
  .string({ required_error: 'SUPER_ADMIN_EMAIL is required' })
  .min(1, 'SUPER_ADMIN_EMAIL cannot be empty')
  .max(120, 'SUPER_ADMIN_EMAIL must not exceed 120 characters')
  .email('SUPER_ADMIN_EMAIL must be a valid email address');

/**
 * Secure, production-safe, idempotent bootstrap function for the initial Super Admin.
 *
 * @param {object} params
 * @param {string} [params.name] - Super Admin full name (default: 'Platform Administrator')
 * @param {string} params.email - Super Admin email address (normalized to lowercase)
 * @param {string} params.password - Super Admin plaintext password (validated against security policy)
 * @param {boolean} [params.mustChangePassword=false] - Whether user must change password on first login
 * @param {PrismaClient} [params.prismaClient] - Optional injected PrismaClient instance (caller manages lifecycle)
 * @param {string} [params.databaseUrl] - Optional database URL if constructing private PrismaClient
 * @returns {Promise<{ success: boolean, alreadyExists: boolean, user: object }>}
 */
export async function bootstrapSuperAdmin({
  name = 'Platform Administrator',
  email,
  password,
  mustChangePassword = false,
  prismaClient = null,
  databaseUrl = null,
} = {}) {
  // 1. Validate required environment inputs
  if (!email || typeof email !== 'string' || !email.trim()) {
    throw new Error('Validation Error: SUPER_ADMIN_EMAIL is required and cannot be empty.');
  }

  if (!password || typeof password !== 'string' || !password.trim()) {
    throw new Error('Validation Error: SUPER_ADMIN_PASSWORD is required and cannot be empty.');
  }

  // 2. Normalize and validate email
  const normalizedEmail = normalizeEmail(email);
  const emailValidation = emailSchema.safeParse(normalizedEmail);
  if (!emailValidation.success) {
    const errorMsg = emailValidation.error.issues.map((i) => i.message).join(', ');
    throw new Error(`Validation Error: ${errorMsg}`);
  }

  // 3. Validate password against platform security policy
  const passwordCheck = validatePasswordStrength(password);
  if (!passwordCheck.valid) {
    throw new Error(`Password Policy Violation: ${passwordCheck.message}`);
  }

  // 4. Validate and sanitize name
  const trimmedName = typeof name === 'string' && name.trim() ? name.trim().slice(0, 100) : 'Platform Administrator';

  // 5. Establish PrismaClient connection
  const shouldDisconnect = !prismaClient;
  const client =
    prismaClient ||
    new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl || process.env.DATABASE_URL,
        },
      },
      log: ['error'],
    });

  try {
    // 6. Check for existing account with the same normalized email (Idempotency)
    const existingUser = await client.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        mustChangePassword: true,
        createdAt: true,
      },
    });

    if (existingUser) {
      if (existingUser.role !== 'SUPER_ADMIN') {
        throw new Error(
          `Conflict Error: An account with email "${normalizedEmail}" already exists with role "${existingUser.role}". ` +
            'Cannot overwrite or convert an existing non-super-admin account.'
        );
      }

      console.log(`ℹ️ Super Admin account with email "${normalizedEmail}" already exists (ID: ${existingUser.id}).`);
      console.log('Skipping creation (non-destructive idempotency preserved; existing password unchanged).');

      return {
        success: true,
        alreadyExists: true,
        user: existingUser,
      };
    }

    // 7. Hash password securely with bcrypt cost factor 12
    const passwordHash = await hashPassword(password);

    // 8. Create Super Admin record atomically
    const superAdmin = await client.user.create({
      data: {
        name: trimmedName,
        email: normalizedEmail,
        passwordHash,
        role: 'SUPER_ADMIN',
        madrasaId: null,
        isActive: true,
        mustChangePassword: Boolean(mustChangePassword),
        tokenVersion: 0,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        mustChangePassword: true,
        createdAt: true,
      },
    });

    console.log('✅ Initial Super Admin created successfully:');
    console.log(`   ID:        ${superAdmin.id}`);
    console.log(`   Name:      ${superAdmin.name}`);
    console.log(`   Email:     ${superAdmin.email}`);
    console.log(`   Role:      ${superAdmin.role}`);
    console.log(`   Active:    ${superAdmin.isActive}`);
    console.log(`   CreatedAt: ${superAdmin.createdAt.toISOString()}`);

    return {
      success: true,
      alreadyExists: false,
      user: superAdmin,
    };
  } finally {
    if (shouldDisconnect) {
      await client.$disconnect();
    }
  }
}

/**
 * CLI Entrypoint: Runs only when script is executed directly via `node seed-super-admin.js`.
 */
async function runCli() {
  const name = process.env.SUPER_ADMIN_NAME || 'Platform Administrator';
  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;

  if (!email || !password) {
    console.error('❌ Missing required environment variables:');
    if (!email) console.error('   - SUPER_ADMIN_EMAIL is required');
    if (!password) console.error('   - SUPER_ADMIN_PASSWORD is required');
    console.error('\nUsage:');
    console.error('  SUPER_ADMIN_EMAIL="admin@madrasanexa.com" SUPER_ADMIN_PASSWORD="YourSecurePassword#2026!" node prisma/seed-super-admin.js');
    process.exit(1);
  }

  try {
    await bootstrapSuperAdmin({
      name,
      email,
      password,
    });
    process.exit(0);
  } catch (err) {
    console.error(`❌ Bootstrap Failed: ${err.message}`);
    process.exit(1);
  }
}

// Auto-run CLI when invoked directly from shell
const isDirectExecution = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectExecution) {
  runCli();
}
