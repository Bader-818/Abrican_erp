import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as QRCode from 'qrcode';
import { AuditLogService } from '../audit-log/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';
import { generateTotpSecret, totpKeyUri, verifyTotp } from './totp.util';

@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  // --- Password -------------------------------------------------------------

  /** Self-service password change. Revokes the user's *other* sessions. */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    currentRefreshId?: string,
    ipAddress?: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const matches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!matches) throw new UnauthorizedException('Current password is incorrect');

    const sameAsOld = await bcrypt.compare(newPassword, user.passwordHash);
    if (sameAsOld) throw new BadRequestException('New password must differ from the current one');

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, passwordChangedAt: new Date(), mustChangePassword: false },
    });

    // Invalidate every other session; keep the one making this request.
    await this.prisma.refreshToken.updateMany({
      where: { userId, revoked: false, ...(currentRefreshId ? { id: { not: currentRefreshId } } : {}) },
      data: { revoked: true },
    });

    await this.auditLogService.record({
      userId,
      action: AuditAction.PASSWORD_CHANGED,
      entityType: 'User',
      entityId: userId,
      ipAddress,
      comment: 'Password changed; other sessions revoked.',
    });
    return { success: true };
  }

  // --- MFA (TOTP) -----------------------------------------------------------

  /** Begin enrollment: store a pending secret and return a QR to scan. */
  async startMfaSetup(userId: string, email: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.mfaEnabled) throw new ConflictException('MFA is already enabled');

    const secret = generateTotpSecret();
    await this.prisma.user.update({ where: { id: userId }, data: { mfaSecret: secret } });

    const otpauthUrl = totpKeyUri(email, secret);
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl, { margin: 1, width: 220 });
    return { secret, otpauthUrl, qrDataUrl };
  }

  /** Confirm enrollment by verifying the first code. */
  async enableMfa(userId: string, token: string, ipAddress?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.mfaEnabled) throw new ConflictException('MFA is already enabled');
    if (!user.mfaSecret) throw new BadRequestException('Start MFA setup first');
    if (!verifyTotp(user.mfaSecret, token)) {
      throw new UnauthorizedException('Invalid authentication code');
    }

    await this.prisma.user.update({ where: { id: userId }, data: { mfaEnabled: true } });
    await this.auditLogService.record({
      userId,
      action: AuditAction.MFA_ENABLED,
      entityType: 'User',
      entityId: userId,
      ipAddress,
    });
    return { success: true };
  }

  /** Disable MFA — requires a valid current code. */
  async disableMfa(userId: string, token: string, ipAddress?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (!user.mfaEnabled || !user.mfaSecret) throw new ConflictException('MFA is not enabled');
    if (!verifyTotp(user.mfaSecret, token)) {
      throw new UnauthorizedException('Invalid authentication code');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: false, mfaSecret: null },
    });
    await this.auditLogService.record({
      userId,
      action: AuditAction.MFA_DISABLED,
      entityType: 'User',
      entityId: userId,
      ipAddress,
    });
    return { success: true };
  }

  // --- Sessions -------------------------------------------------------------

  async listSessions(userId: string, currentRefreshId?: string) {
    const sessions = await this.prisma.refreshToken.findMany({
      where: { userId, revoked: false, expiresAt: { gt: new Date() } },
      orderBy: [{ lastUsedAt: 'desc' }, { createdAt: 'desc' }],
      select: { id: true, userAgent: true, ipAddress: true, createdAt: true, lastUsedAt: true, expiresAt: true },
    });
    return sessions.map((s) => ({ ...s, current: s.id === currentRefreshId }));
  }

  async revokeSession(userId: string, sessionId: string, ipAddress?: string) {
    const result = await this.prisma.refreshToken.updateMany({
      where: { id: sessionId, userId, revoked: false },
      data: { revoked: true },
    });
    if (result.count === 0) throw new NotFoundException('Session not found');
    await this.auditLogService.record({
      userId,
      action: AuditAction.SESSION_REVOKED,
      entityType: 'User',
      entityId: userId,
      ipAddress,
      comment: `Revoked session ${sessionId}.`,
    });
    return { success: true };
  }
}
