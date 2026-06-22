import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';

// Covers INV-D1 (user lifecycle + self-delete guard).
describe('UsersService', () => {
  let prisma: any;
  let audit: { record: jest.Mock };
  let service: UsersService;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn().mockResolvedValue({}),
      },
      role: { findUnique: jest.fn().mockResolvedValue({ id: 'r1' }) },
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    service = new UsersService(prisma as any, audit as any);
  });

  const dto = { name: 'Jane', email: 'jane@abrican.local', password: 'Str0ng!Passw0rd', roleId: 'r1' };

  it('rejects a duplicate email', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u9' });
    await expect(service.create(dto as any)).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects an invalid roleId', async () => {
    prisma.user.findUnique.mockResolvedValue(null); // email free
    prisma.role.findUnique.mockResolvedValue(null); // role missing
    await expect(service.create(dto as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('prevents deleting your own account', async () => {
    await expect(service.remove('u1', 'u1')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });

  it('deletes another user', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u2' });
    await expect(service.remove('u2', 'u1')).resolves.toEqual({ success: true });
  });

  it('adminResetPassword throws NotFound for a missing user', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.adminResetPassword('nope', 'Temp!12345', 'admin')).rejects.toBeInstanceOf(NotFoundException);
  });
});
