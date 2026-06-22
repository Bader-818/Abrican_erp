import { ConflictException, NotFoundException } from '@nestjs/common';
import { VehiclesService } from './vehicles.service';

describe('VehiclesService', () => {
  let prisma: any;
  let service: VehiclesService;

  beforeEach(() => {
    prisma = {
      vehicle: { findUnique: jest.fn(), create: jest.fn(), delete: jest.fn().mockResolvedValue({}) },
    };
    service = new VehiclesService(prisma as any);
  });

  it('rejects a duplicate plate number', async () => {
    prisma.vehicle.findUnique.mockResolvedValue({ id: 'v9' });
    await expect(service.create({ plateNumber: 'ABC-123', vehicleType: 'Truck', ownershipType: 'OWNED' } as any)).rejects.toBeInstanceOf(ConflictException);
  });

  it('findOne throws NotFound for a missing vehicle', async () => {
    prisma.vehicle.findUnique.mockResolvedValue(null);
    await expect(service.findOne('nope')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('blocks deleting a vehicle with assignments', async () => {
    prisma.vehicle.findUnique.mockResolvedValue({ _count: { assignments: 1 } });
    await expect(service.remove('v1')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.vehicle.delete).not.toHaveBeenCalled();
  });

  it('allows deleting a vehicle with no assignments', async () => {
    prisma.vehicle.findUnique.mockResolvedValue({ _count: { assignments: 0 } });
    await expect(service.remove('v1')).resolves.toEqual({ success: true });
  });
});
