import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { CrewsService } from './crews.service';

describe('CrewsService', () => {
  let prisma: any;
  let service: CrewsService;

  beforeEach(() => {
    prisma = {
      employee: { findUnique: jest.fn().mockResolvedValue({ id: 'emp-1' }) },
      crew: { findUnique: jest.fn(), create: jest.fn(), delete: jest.fn().mockResolvedValue({}) },
    };
    service = new CrewsService(prisma as any);
  });

  it('rejects an invalid supervisorId', async () => {
    prisma.employee.findUnique.mockResolvedValue(null);
    await expect(service.create({ name: 'Crew A', supervisorId: 'bad' } as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('findOne throws NotFound for a missing crew', async () => {
    prisma.crew.findUnique.mockResolvedValue(null);
    await expect(service.findOne('nope')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('blocks deleting a crew with assignments', async () => {
    prisma.crew.findUnique.mockResolvedValue({ _count: { assignments: 2 } });
    await expect(service.remove('cr1')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.crew.delete).not.toHaveBeenCalled();
  });

  it('allows deleting a crew with no assignments', async () => {
    prisma.crew.findUnique.mockResolvedValue({ _count: { assignments: 0 } });
    await expect(service.remove('cr1')).resolves.toEqual({ success: true });
  });
});
