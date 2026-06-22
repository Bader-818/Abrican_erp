import { ConflictException, NotFoundException } from '@nestjs/common';
import { EquipmentService } from './equipment.service';

describe('EquipmentService', () => {
  let prisma: any;
  let service: EquipmentService;

  beforeEach(() => {
    prisma = {
      equipment: { findUnique: jest.fn(), delete: jest.fn().mockResolvedValue({}) },
    };
    service = new EquipmentService(prisma as any);
  });

  it('findOne throws NotFound for missing equipment', async () => {
    prisma.equipment.findUnique.mockResolvedValue(null);
    await expect(service.findOne('nope')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('blocks deleting equipment with assignments', async () => {
    prisma.equipment.findUnique.mockResolvedValue({ _count: { assignments: 1 } });
    await expect(service.remove('eq1')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.equipment.delete).not.toHaveBeenCalled();
  });

  it('allows deleting equipment with no assignments', async () => {
    prisma.equipment.findUnique.mockResolvedValue({ _count: { assignments: 0 } });
    await expect(service.remove('eq1')).resolves.toEqual({ success: true });
  });
});
