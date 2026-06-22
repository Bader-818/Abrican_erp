import { UnauthorizedException } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';

jest.mock('bcrypt', () => ({ compare: jest.fn() }));

const compareMock = bcrypt.compare as unknown as jest.Mock;

function makeService() {
  const prisma: any = {
    user: { findUnique: jest.fn(), update: jest.fn().mockResolvedValue({}) },
    refreshToken: {
      findUnique: jest.fn(),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 3 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    notification: { create: jest.fn().mockResolvedValue({}) },
  };
  const jwtService: any = { sign: jest.fn().mockReturnValue('access-token') };
  const config: any = {
    getOrThrow: jest.fn().mockReturnValue('secret'),
    get: jest.fn((_key: string, def?: unknown) => def),
  };
  const audit: any = { record: jest.fn().mockResolvedValue(undefined) };
  const service = new AuthService(prisma, jwtService, config, audit);
  return { service, prisma, audit };
}

const activeUser = {
  id: 'u1',
  email: 'a@b.c',
  status: 'ACTIVE',
  passwordHash: 'hash',
  failedLoginAttempts: 0,
  lockedUntil: null as Date | null,
};

describe('AuthService.validateUser (account lockout)', () => {
  beforeEach(() => compareMock.mockReset());

  it('returns null for an unknown email', async () => {
    const { service, prisma } = makeService();
    prisma.user.findUnique.mockResolvedValue(null);
    expect(await service.validateUser('x@y.z', 'pw')).toBeNull();
  });

  it('throws when the account is currently locked (before checking password)', async () => {
    const { service, prisma } = makeService();
    prisma.user.findUnique.mockResolvedValue({
      ...activeUser,
      lockedUntil: new Date(Date.now() + 60_000),
    });
    await expect(service.validateUser('a@b.c', 'pw')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(compareMock).not.toHaveBeenCalled();
  });

  it('increments the counter on a wrong password', async () => {
    const { service, prisma } = makeService();
    prisma.user.findUnique.mockResolvedValue({ ...activeUser, failedLoginAttempts: 1 });
    compareMock.mockResolvedValue(false);

    expect(await service.validateUser('a@b.c', 'wrong')).toBeNull();
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { failedLoginAttempts: 2 },
    });
  });

  it('locks the account on the 5th consecutive failure', async () => {
    const { service, prisma } = makeService();
    prisma.user.findUnique.mockResolvedValue({ ...activeUser, failedLoginAttempts: 4 });
    compareMock.mockResolvedValue(false);

    await service.validateUser('a@b.c', 'wrong');
    const arg = prisma.user.update.mock.calls[0][0];
    expect(arg.data.failedLoginAttempts).toBe(0);
    expect(arg.data.lockedUntil).toBeInstanceOf(Date);
    expect(arg.data.lockedUntil.getTime()).toBeGreaterThan(Date.now());
  });

  it('resets counters and returns the user on success', async () => {
    const { service, prisma } = makeService();
    prisma.user.findUnique.mockResolvedValue({ ...activeUser, failedLoginAttempts: 3 });
    compareMock.mockResolvedValue(true);

    const result = await service.validateUser('a@b.c', 'right');
    expect(result).toMatchObject({ id: 'u1' });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
  });

  it('does not write on a clean successful login', async () => {
    const { service, prisma } = makeService();
    prisma.user.findUnique.mockResolvedValue({ ...activeUser });
    compareMock.mockResolvedValue(true);

    await service.validateUser('a@b.c', 'right');
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('returns null for an inactive (but not locked) user', async () => {
    const { service, prisma } = makeService();
    prisma.user.findUnique.mockResolvedValue({ ...activeUser, status: 'INACTIVE' });
    expect(await service.validateUser('a@b.c', 'pw')).toBeNull();
    expect(compareMock).not.toHaveBeenCalled();
  });
});

describe('AuthService.refresh (reuse detection)', () => {
  it('revokes all sessions and audits when a revoked token is replayed', async () => {
    const { service, prisma, audit } = makeService();
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt1',
      userId: 'u1',
      revoked: true,
      expiresAt: new Date(Date.now() + 60_000),
      tokenHash: 'deadbeef',
    });

    await expect(service.refresh('rt1.somesecret')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', revoked: false },
      data: { revoked: true },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: AuditAction.TOKEN_REUSE_DETECTED }),
    );
  });

  it('rejects a structurally invalid token', async () => {
    const { service } = makeService();
    await expect(service.refresh('no-dot')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('AuthService.logoutAll', () => {
  it('revokes every active token and reports the count', async () => {
    const { service, prisma, audit } = makeService();
    const result = await service.logoutAll('u1', '127.0.0.1');
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', revoked: false },
      data: { revoked: true },
    });
    expect(result).toEqual({ success: true, revoked: 3 });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: AuditAction.LOGOUT }),
    );
  });
});
