import dotenv from 'dotenv';
import { prisma } from '../src/lib/prisma.js';
import { hashPassword, validatePasswordStrength } from '../src/utils/password.js';

dotenv.config();

async function seedSuperAdmin() {
  const name = process.env.SUPER_ADMIN_NAME || 'Platform Administrator';
  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;

  if (!email || !password) {
    console.error('❌ Missing SUPER_ADMIN_EMAIL or SUPER_ADMIN_PASSWORD environment variables.');
    console.error('Usage: Set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD before running this script.');
    process.exit(1);
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Validate password policy
  const passwordCheck = validatePasswordStrength(password);
  if (!passwordCheck.valid) {
    console.error(`❌ Password policy violation: ${passwordCheck.message}`);
    process.exit(1);
  }

  try {
    // Check if account already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      console.log(`ℹ️ Super Admin account with email "${normalizedEmail}" already exists (ID: ${existingUser.id}).`);
      console.log('Skipping creation (non-destructive idempotency preserved).');
      return;
    }

    // Hash password securely with cost factor 12
    const passwordHash = await hashPassword(password);

    // Create Super Admin record
    const superAdmin = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
        role: 'SUPER_ADMIN',
        madrasaId: null,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    console.log('✅ Initial Super Admin created successfully:');
    console.log(`   ID:    ${superAdmin.id}`);
    console.log(`   Name:  ${superAdmin.name}`);
    console.log(`   Email: ${superAdmin.email}`);
    console.log(`   Role:  ${superAdmin.role}`);
  } catch (error) {
    console.error('❌ Failed to bootstrap Super Admin:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedSuperAdmin().catch((err) => {
  console.error('Fatal bootstrapping error:', err);
  process.exit(1);
});
