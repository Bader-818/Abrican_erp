import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

/**
 * Dedicated admin identity for the e2e suite. The suite must never log in as
 * the real seeded admin: a human may have MFA enabled on it, and the failed
 * -login scenarios here would lock the account a person is actually using.
 * ensureE2eAdmin() resets this user to a known state before each suite.
 */
export const E2E_ADMIN = {
  email: 'e2e-admin@abrican.local',
  password: 'E2eAdmin!2026-secret',
};

export async function ensureE2eAdmin(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'Admin' } });
    const passwordHash = await bcrypt.hash(E2E_ADMIN.password, 10);
    const knownState = {
      passwordHash,
      roleId: adminRole.id,
      status: 'ACTIVE' as const,
      mfaEnabled: false,
      mfaSecret: null,
      mustChangePassword: false,
      failedLoginAttempts: 0,
      lockedUntil: null,
    };
    await prisma.user.upsert({
      where: { email: E2E_ADMIN.email },
      update: knownState,
      create: { name: 'E2E Admin', email: E2E_ADMIN.email, ...knownState },
    });
  } finally {
    await prisma.$disconnect();
  }
}
