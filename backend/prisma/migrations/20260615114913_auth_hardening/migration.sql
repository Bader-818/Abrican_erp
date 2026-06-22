-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'TOKEN_REUSE_DETECTED';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lockedUntil" TIMESTAMP(3);
