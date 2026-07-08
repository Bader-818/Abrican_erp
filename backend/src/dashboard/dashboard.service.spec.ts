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
    const payments = { aging: jest.fn() };

    service = new DashboardService(prisma, assignments as any, payments as any);
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

describe('DashboardService.finance', () => {
  let prisma: any;
  let payments: { aging: jest.Mock };
  let service: DashboardService;

  beforeEach(() => {
    prisma = {
      invoice: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: { totalAmount: 1150, subtotal: 1000, vatAmount: 150 },
        }),
        groupBy: jest.fn().mockResolvedValue([
          { status: 'PAID', _count: { _all: 3 } },
          { status: 'SUBMITTED', _count: { _all: 2 } },
        ]),
      },
      payment: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 500 } }) },
      job: {
        aggregate: jest
          .fn()
          // profit aggregate (cost-reviewed jobs)
          .mockResolvedValueOnce({ _sum: { grossProfit: 400 }, _avg: { grossMarginPct: 40 }, _count: { _all: 2 } })
          // unbilled aggregate
          .mockResolvedValueOnce({ _sum: { jobValue: 8000 }, _count: { _all: 1 } }),
      },
      expense: {
        findMany: jest.fn().mockResolvedValue([
          { category: 'MATERIAL', totalAmount: 230, vatAmount: 30 },
          { category: 'FUEL', totalAmount: 115, vatAmount: 15 },
        ]),
      },
    };
    payments = {
      aging: jest.fn().mockResolvedValue({
        buckets: { current: 100, d31_60: 50, d61_90: 0, d90_plus: 25 },
        totalOutstanding: 175,
        invoices: [
          { outstandingAmount: 100, daysPastDue: -5 }, // not yet due
          { outstandingAmount: 50, daysPastDue: 40 },
          { outstandingAmount: 25, daysPastDue: 95 },
        ],
      }),
    };
    service = new DashboardService(prisma, {} as any, payments as any);
  });

  it('aggregates revenue, receivables, profit, expenses, VAT, and unbilled work', async () => {
    const r = await service.finance({});

    expect(r.revenue).toEqual({ invoicedTotal: 1150, invoicedSubtotal: 1000, outputVat: 150, collected: 500 });
    expect(r.receivables.totalOutstanding).toBe(175);
    expect(r.receivables.overdueAmount).toBe(75); // 50 + 25 (excludes the not-yet-due 100)
    expect(r.profit).toEqual({ jobsReviewed: 2, grossProfit: 400, avgMarginPct: 40 });
    expect(r.expenses.total).toBe(345);
    expect(r.expenses.inputVat).toBe(45);
    expect(r.expenses.byCategory).toEqual({ MATERIAL: 230, FUEL: 115 });
    expect(r.vat).toEqual({ output: 150, input: 45, net: 105 });
    expect(r.unbilled).toEqual({ count: 1, value: 8000 });
    expect(r.invoicesByStatus).toEqual({ PAID: 3, SUBMITTED: 2 });
  });
});
