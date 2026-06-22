import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { authenticator } from 'otplib';
import { AccountService } from './account.service';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn().mockResolvedValue('new-hash'),
}));
import * as bcrypt from 'bcrypt';

describe('AccountService', () => {
  let prisma: any;
  let audit: { record: jest.Mock };
  let service: AccountService;

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn(), update: jest.fn().mockResolvedValue({}) },
      refreshToken: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    service = new AccountService(prisma, audit as any);
    (bcrypt.compare as jest.Mock).mockReset();
  });

  describe('changePassword', () => {
    it('rejects a wrong current password', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u', passwordHash: 'h' });
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);
      await expect(
        service.changePassword('u', 'wrong', 'NewPass@12345'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('changes the password and revokes other sessions', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u', passwordHash: 'h' });
      (bcrypt.compare as jest.Mock)
        .mockResolvedValueOnce(true) // current matches
        .mockResolvedValueOnce(false); // new differs from old
      await service.changePassword('u', 'old', 'NewPass@12345', 'keep-this-session');
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ mustChangePassword: false }) }),
      );
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ id: { not: 'keep-this-session' } }) }),
      );
    });
  });

  describe('MFA (TOTP)', () => {
    it('enables MFA when the code is valid', async () => {
      const secret = authenticator.generateSecret();
      prisma.user.findUnique.mockResolvedValue({ id: 'u', mfaEnabled: false, mfaSecret: secret });
      await service.enableMfa('u', authenticator.generate(secret));
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { mfaEnabled: true } }),
      );
    });

    it('rejects an invalid MFA code', async () => {
      const secret = authenticator.generateSecret();
      prisma.user.findUnique.mockResolvedValue({ id: 'u', mfaEnabled: false, mfaSecret: secret });
      await expect(service.enableMfa('u', '123456')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('disables MFA with a valid code', async () => {
      const secret = authenticator.generateSecret();
      prisma.user.findUnique.mockResolvedValue({ id: 'u', mfaEnabled: true, mfaSecret: secret });
      await service.disableMfa('u', authenticator.generate(secret));
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { mfaEnabled: false, mfaSecret: null } }),
      );
    });

    it('refuses to set up MFA when already enabled', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u', mfaEnabled: true });
      await expect(service.startMfaSetup('u', 'a@b.c')).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
