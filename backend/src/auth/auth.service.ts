import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuditAction, NotificationType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import type { SignOptions } from 'jsonwebtoken';
import { AuditLogService } from '../audit-log/audit-log.service';
import { parseDurationToMs } from '../common/helpers/duration.helper';
import { PrismaService } from '../prisma/prisma.service';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

/** Device context captured on each issued refresh token (for the sessions list). */
export interface TokenContext {
  ipAddress?: string;
  userAgent?: string;
}

// Account lockout policy: lock for LOCK_DURATION_MS after MAX_FAILED_ATTEMPTS
// consecutive failures. A successful login clears the counter.
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      return null;
    }

    // Block while locked (checked before the password compare so a locked
    // account can't be probed).
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException(
        'Account temporarily locked due to too many failed attempts. Try again later.',
      );
    }

    if (user.status !== 'ACTIVE') {
      return null;
    }

    const matches = await bcrypt.compare(password, user.passwordHash);

    if (!matches) {
      await this.registerFailedAttempt(user.id, user.failedLoginAttempts);
      return null;
    }

    // Successful login clears any accumulated failures / lock.
    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    }

    return user;
  }

  private async registerFailedAttempt(userId: string, currentAttempts: number) {
    const attempts = currentAttempts + 1;
    if (attempts >= MAX_FAILED_ATTEMPTS) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: new Date(Date.now() + LOCK_DURATION_MS),
        },
      });
      await this.auditLogService.record({
        userId,
        action: AuditAction.ACCOUNT_LOCKED,
        entityType: 'User',
        entityId: userId,
        comment: `Account locked after ${MAX_FAILED_ATTEMPTS} failed login attempts.`,
      });
    } else {
      await this.prisma.user.update({
        where: { id: userId },
        data: { failedLoginAttempts: attempts },
      });
    }
  }

  async login(userId: string, ctx: TokenContext = {}): Promise<TokenPair> {
    await this.cleanupExpiredTokens(userId);
    const accessToken = this.signAccessToken(userId);
    const refresh = await this.issueRefreshToken(userId, ctx);

    await this.auditLogService.record({
      userId,
      action: AuditAction.LOGIN,
      entityType: 'User',
      entityId: userId,
      ipAddress: ctx.ipAddress,
    });

    return {
      accessToken,
      refreshToken: refresh.token,
      refreshTokenExpiresAt: refresh.expiresAt,
    };
  }

  async refresh(refreshTokenValue: string, ctx: TokenContext = {}): Promise<TokenPair> {
    const [id, secret] = refreshTokenValue.split('.');
    if (!id || !secret) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const record = await this.prisma.refreshToken.findUnique({ where: { id } });
    if (!record || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Reuse detection: a rotated (revoked) token being replayed means it was
    // either leaked or stolen. Revoke the whole family and force re-login.
    if (record.revoked) {
      await this.revokeAllForUser(record.userId);
      await this.auditLogService.record({
        userId: record.userId,
        action: AuditAction.TOKEN_REUSE_DETECTED,
        entityType: 'User',
        entityId: record.userId,
        comment: 'Revoked refresh token replayed — all sessions revoked.',
      });
      // Surface a security alert the user sees on next sign-in.
      await this.prisma.notification.create({
        data: {
          userId: record.userId,
          type: NotificationType.GENERAL,
          title: 'Security alert: session anomaly',
          message:
            'A revoked sign-in token was replayed, so all your sessions were signed out as a precaution. If this wasn’t you, change your password.',
        },
      });
      throw new UnauthorizedException('Refresh token reuse detected. Please log in again.');
    }

    const expectedHash = Buffer.from(record.tokenHash, 'hex');
    const actualHash = Buffer.from(this.hashToken(secret), 'hex');
    if (
      expectedHash.length !== actualHash.length ||
      !timingSafeEqual(expectedHash, actualHash)
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Rotate: revoke the used token, issue a new one (carrying device info).
    await this.prisma.refreshToken.update({ where: { id }, data: { revoked: true } });

    const accessToken = this.signAccessToken(record.userId);
    const refresh = await this.issueRefreshToken(record.userId, {
      ipAddress: ctx.ipAddress ?? record.ipAddress ?? undefined,
      userAgent: ctx.userAgent ?? record.userAgent ?? undefined,
    });

    return {
      accessToken,
      refreshToken: refresh.token,
      refreshTokenExpiresAt: refresh.expiresAt,
    };
  }

  async logout(refreshTokenValue: string | undefined, userId: string, ipAddress?: string) {
    if (refreshTokenValue) {
      const [id] = refreshTokenValue.split('.');
      if (id) {
        await this.prisma.refreshToken.updateMany({
          where: { id, userId },
          data: { revoked: true },
        });
      }
    }

    await this.auditLogService.record({
      userId,
      action: AuditAction.LOGOUT,
      entityType: 'User',
      entityId: userId,
      ipAddress,
    });

    return { success: true };
  }

  /** Revoke every active refresh token for a user ("sign out everywhere"). */
  async revokeAllForUser(userId: string): Promise<number> {
    const result = await this.prisma.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true },
    });
    return result.count;
  }

  async logoutAll(userId: string, ipAddress?: string) {
    const revoked = await this.revokeAllForUser(userId);
    await this.auditLogService.record({
      userId,
      action: AuditAction.LOGOUT,
      entityType: 'User',
      entityId: userId,
      ipAddress,
      comment: `Signed out of all sessions (${revoked} token(s) revoked).`,
    });
    return { success: true, revoked };
  }

  getRefreshCookieOptions() {
    return {
      httpOnly: true,
      secure: this.config.get('NODE_ENV') === 'production',
      sameSite: 'lax' as const,
      path: '/api/v1/auth',
      maxAge: parseDurationToMs(this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d')),
    };
  }

  getRefreshCookieClearOptions() {
    return {
      httpOnly: true,
      secure: this.config.get('NODE_ENV') === 'production',
      sameSite: 'lax' as const,
      path: '/api/v1/auth',
    };
  }

  private signAccessToken(userId: string): string {
    return this.jwtService.sign(
      { sub: userId },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRES_IN', '15m') as SignOptions['expiresIn'],
      },
    );
  }

  private async issueRefreshToken(userId: string, ctx: TokenContext = {}) {
    const id = randomUUID();
    const secret = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(secret);
    const expiresAt = new Date(
      Date.now() + parseDurationToMs(this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d')),
    );

    await this.prisma.refreshToken.create({
      data: {
        id,
        userId,
        tokenHash,
        expiresAt,
        ipAddress: ctx.ipAddress ?? null,
        userAgent: ctx.userAgent ?? null,
        lastUsedAt: new Date(),
      },
    });

    return { token: `${id}.${secret}`, expiresAt };
  }

  /** Opportunistically prune a user's expired refresh tokens (no scheduler). */
  private async cleanupExpiredTokens(userId: string) {
    await this.prisma.refreshToken.deleteMany({
      where: { userId, expiresAt: { lt: new Date() } },
    });
  }

  private hashToken(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}
