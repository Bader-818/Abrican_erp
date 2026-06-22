import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { RolesService } from './roles.service';

// Covers INV-D1 (RBAC management integrity).
describe('RolesService', () => {
  let prisma: any;
  let service: RolesService;

  beforeEach(() => {
    prisma = {
      role: {
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn().mockResolvedValue({}),
      },
      permission: { findMany: jest.fn().mockResolvedValue([]) },
    };
    service = new RolesService(prisma as any);
  });

  it('rejects a duplicate role name', async () => {
    prisma.role.findUnique.mockResolvedValue({ id: 'r1', name: 'Ops' });
    await expect(service.create({ name: 'Ops', permissionKeys: [] } as any)).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects unknown permission keys', async () => {
    prisma.role.findUnique.mockResolvedValue(null);
    prisma.permission.findMany.mockResolvedValue([]); // none of the requested keys exist
    await expect(
      service.create({ name: 'New', permissionKeys: ['does.not_exist'] } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('findOne throws NotFound for a missing role', async () => {
    prisma.role.findUnique.mockResolvedValue(null);
    await expect(service.findOne('nope')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('blocks deleting a role still assigned to users', async () => {
    prisma.role.findUnique.mockResolvedValue({ id: 'r1', _count: { users: 3 } });
    await expect(service.remove('r1')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.role.delete).not.toHaveBeenCalled();
  });

  it('allows deleting an unused role', async () => {
    prisma.role.findUnique.mockResolvedValue({ id: 'r1', _count: { users: 0 } });
    await expect(service.remove('r1')).resolves.toEqual({ success: true });
  });
});
