import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { AssignmentsService } from './assignments.service';
import { AuthenticatedUser } from '../common/types/authenticated-user.interface';

function makeUser(permissions: string[] = []): AuthenticatedUser {
  return {
    id: 'user-1',
    email: 'a@b.c',
    name: 'Tester',
    roleId: 'r1',
    roleName: 'Admin',
    permissions,
    mfaEnabled: false,
    mustChangePassword: false,
  };
}

describe('AssignmentsService', () => {
  let prisma: any;
  let audit: { record: jest.Mock };
  let service: AssignmentsService;

  const conflictRow = {
    id: 'existing-1',
    startDatetime: new Date('2026-06-10T06:00:00Z'),
    endDatetime: new Date('2026-06-20T16:00:00Z'),
    status: 'ACTIVE',
    job: { jobCode: 'JOB-2026-0005', title: 'Coating' },
  };

  beforeEach(() => {
    let seq = 0;
    prisma = {
      job: { findUnique: jest.fn().mockResolvedValue({ id: 'job-1' }) },
      employee: {
        findUnique: jest.fn().mockResolvedValue({ availabilityStatus: 'AVAILABLE', status: 'ACTIVE' }),
      },
      crew: { findUnique: jest.fn().mockResolvedValue({ status: 'AVAILABLE' }) },
      vehicle: { findUnique: jest.fn().mockResolvedValue({ status: 'AVAILABLE' }) },
      equipment: { findUnique: jest.fn().mockResolvedValue({ status: 'AVAILABLE' }) },
      jobAssignment: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: `new-${++seq}`, ...data })),
      },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    service = new AssignmentsService(prisma, audit as any);
  });

  const baseDto = {
    jobId: 'job-1',
    resourceType: 'EMPLOYEE' as const,
    employeeId: 'emp-1',
    startDatetime: '2026-07-01T06:00:00Z',
    endDatetime: '2026-07-05T16:00:00Z',
  };

  describe('create - validation', () => {
    it('rejects a window where end <= start', async () => {
      await expect(
        service.create({ ...baseDto, endDatetime: baseDto.startDatetime }, makeUser()),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('requires the id matching the resourceType', async () => {
      await expect(
        service.create(
          { ...baseDto, employeeId: undefined } as any,
          makeUser(),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects ids for other resource types', async () => {
      await expect(
        service.create({ ...baseDto, vehicleId: 'veh-1' } as any, makeUser()),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an invalid job', async () => {
      prisma.job.findUnique.mockResolvedValue(null);
      await expect(service.create(baseDto, makeUser())).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('create - happy path', () => {
    it('creates the assignment and records a CREATE audit when there is no conflict', async () => {
      const result = await service.create(baseDto, makeUser());

      expect(prisma.jobAssignment.create).toHaveBeenCalledTimes(1);
      expect(result.id).toBe('new-1');
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.CREATE, entityType: 'JobAssignment' }),
      );
    });
  });

  describe('create - conflict handling', () => {
    beforeEach(() => {
      prisma.jobAssignment.findMany.mockResolvedValue([conflictRow]);
    });

    it('blocks with 409 when a conflict exists and no override reason is given', async () => {
      await expect(service.create(baseDto, makeUser())).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.jobAssignment.create).not.toHaveBeenCalled();
    });

    it('forbids override when the user lacks assignments.override', async () => {
      await expect(
        service.create({ ...baseDto, overrideReason: 'urgent' }, makeUser([])),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.jobAssignment.create).not.toHaveBeenCalled();
    });

    it('allows an authorized override and records an OVERRIDE audit', async () => {
      const result = await service.create(
        { ...baseDto, overrideReason: 'approved by ops' },
        makeUser(['assignments.override']),
      );

      expect(prisma.jobAssignment.create).toHaveBeenCalledTimes(1);
      expect(result.overrideReason).toBe('approved by ops');
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.OVERRIDE }),
      );
    });
  });

  describe('create - availability', () => {
    it('treats an on-leave employee as requiring override', async () => {
      prisma.employee.findUnique.mockResolvedValue({
        availabilityStatus: 'ON_LEAVE',
        status: 'ACTIVE',
      });
      await expect(service.create(baseDto, makeUser())).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('checkConflicts', () => {
    it('returns the overlapping assignments without writing', async () => {
      prisma.jobAssignment.findMany.mockResolvedValue([conflictRow]);
      const result = await service.checkConflicts({
        resourceType: 'EMPLOYEE',
        employeeId: 'emp-1',
        startDatetime: '2026-06-12T06:00:00Z',
        endDatetime: '2026-06-14T16:00:00Z',
      });
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].jobCode).toBe('JOB-2026-0005');
      expect(prisma.jobAssignment.create).not.toHaveBeenCalled();
    });
  });

  describe('utilization', () => {
    it('computes prorated assigned hours and a consistent utilization %', async () => {
      // One employee, booked fully within the window with plannedHours = 20.
      prisma.jobAssignment.findMany.mockResolvedValue([
        {
          employeeId: 'emp-1',
          startDatetime: new Date('2026-06-08T06:00:00Z'),
          endDatetime: new Date('2026-06-12T16:00:00Z'),
          plannedHours: 20,
          employee: { name: 'Salem' },
        },
      ]);

      const report = await service.utilization({
        from: '2026-06-08',
        to: '2026-06-13',
        resourceType: 'EMPLOYEE',
      });

      expect(report.resources).toHaveLength(1);
      const r = report.resources[0];
      expect(r.name).toBe('Salem');
      expect(r.assignedHours).toBe(20); // fully inside window -> full plannedHours
      expect(r.assignmentCount).toBe(1);
      expect(r.utilizationPct).toBe(Math.round((20 / report.capacityHours) * 100));
      expect(report.capacityHours).toBeGreaterThan(0);
    });

    it('rejects an inverted window', async () => {
      await expect(
        service.utilization({ from: '2026-07-01', to: '2026-06-01' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('createMany (bulk assign)', () => {
    const bulkDto = {
      jobId: 'job-1',
      startDatetime: '2026-07-01T06:00:00Z',
      endDatetime: '2026-07-05T16:00:00Z',
      items: [
        { resourceType: 'EMPLOYEE' as const, employeeId: 'emp-1' },
        { resourceType: 'CREW' as const, crewId: 'crew-1' },
        { resourceType: 'VEHICLE' as const, vehicleId: 'veh-1' },
      ],
    };

    it('creates one assignment per resource in a single transaction', async () => {
      const result = await service.createMany(bulkDto, makeUser());
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.jobAssignment.create).toHaveBeenCalledTimes(3);
      expect(result).toHaveLength(3);
      expect(audit.record).toHaveBeenCalledTimes(3);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.CREATE }),
      );
    });

    it('rejects a batch containing the same resource twice', async () => {
      await expect(
        service.createMany(
          {
            ...bulkDto,
            items: [
              { resourceType: 'EMPLOYEE', employeeId: 'emp-1' },
              { resourceType: 'EMPLOYEE', employeeId: 'emp-1' },
            ],
          },
          makeUser(),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.jobAssignment.create).not.toHaveBeenCalled();
    });

    it('blocks the whole batch with 409 when any resource conflicts and no override is given', async () => {
      prisma.jobAssignment.findMany.mockResolvedValue([conflictRow]);
      await expect(service.createMany(bulkDto, makeUser())).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.jobAssignment.create).not.toHaveBeenCalled();
    });

    it('allows an authorized override and records OVERRIDE for the conflicting bookings', async () => {
      prisma.jobAssignment.findMany.mockResolvedValue([conflictRow]);
      const result = await service.createMany(
        { ...bulkDto, overrideReason: 'approved' },
        makeUser(['assignments.override']),
      );
      expect(result).toHaveLength(3);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.OVERRIDE }),
      );
    });
  });
});
