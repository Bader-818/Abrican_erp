import { ConflictException, NotFoundException } from '@nestjs/common';
import { EmployeesService } from './employees.service';

describe('EmployeesService', () => {
  let prisma: any;
  let service: EmployeesService;

  beforeEach(() => {
    prisma = {
      employee: { findUnique: jest.fn(), delete: jest.fn().mockResolvedValue({}) },
    };
    service = new EmployeesService(prisma as any);
  });

  it('findOne throws NotFound for a missing employee', async () => {
    prisma.employee.findUnique.mockResolvedValue(null);
    await expect(service.findOne('nope')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('blocks deleting an employee with assignments/crew links', async () => {
    prisma.employee.findUnique.mockResolvedValue({ _count: { assignments: 1, crewMemberships: 0, crewsSupervised: 0 } });
    await expect(service.remove('e1')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.employee.delete).not.toHaveBeenCalled();
  });

  it('allows deleting an unlinked employee', async () => {
    prisma.employee.findUnique.mockResolvedValue({ _count: { assignments: 0, crewMemberships: 0, crewsSupervised: 0 } });
    await expect(service.remove('e1')).resolves.toEqual({ success: true });
  });
});
