import { DashboardService } from './dashboard.service';

describe('DashboardService.operations', () => {
  let prisma: any;
  let assignments: { utilization: jest.Mock };
  let service: DashboardService;

  beforeEach(() => {
    prisma = {
      job: {
        groupBy: jest
          .fn()
          .mockResolvedValue([
            { status: 'ACTIVE', _count: { _all: 2 } },
            { status: 'DRAFT', _count: { _all: 1 } },
          ]),
        count: jest.fn().mockResolvedValue(3),
        findMany: jest.fn().mockResolvedValue([]),
      },
      jobAssignment: {
        groupBy: jest.fn().mockResolvedValue([{ status: 'PLANNED', _count: { _all: 4 } }]),
      },
      contract: { count: jest.fn().mockResolvedValue(1) },
      purchaseOrder: { count: jest.fn().mockResolvedValue(0) },
    };

    // 7 resources so we can assert the top-5 slice.
    const resources = Array.from({ length: 7 }, (_, i) => ({
      resourceType: 'EMPLOYEE',
      resourceId: `r${i}`,
      name: `Resource ${i}`,
      assignedHours: 10,
      capacityHours: 80,
      utilizationPct: 100 - i * 10,
      assignmentCount: 1,
    }));
    assignments = { utilization: jest.fn().mockResolvedValue({ resources }) };

    service = new DashboardService(prisma, assignments as any);
  });

  it('maps grouped counts and passes through scalar metrics', async () => {
    const result = await service.operations();
    expect(result.jobsByStatus).toEqual({ ACTIVE: 2, DRAFT: 1 });
    expect(result.assignmentsByStatus).toEqual({ PLANNED: 4 });
    expect(result.activeJobs).toBe(3);
    expect(result.contractsNearExpiry).toBe(1);
    expect(result.posNearExpiry).toBe(0);
  });

  it('includes the top 5 utilized resources from the assignments engine', async () => {
    const result = await service.operations();
    expect(assignments.utilization).toHaveBeenCalledTimes(1);
    expect(result.topUtilization).toHaveLength(5);
    expect(result.topUtilization[0].utilizationPct).toBe(100);
  });
});
