import { BadRequestException, NotFoundException } from '@nestjs/common';
import { JobStatus } from '@prisma/client';
import { CostingService } from './costing.service';

describe('CostingService', () => {
  let prisma: any;
  let audit: { record: jest.Mock };
  let jobStatus: { applyFinanceStatus: jest.Mock };
  let alerts: { afterCostReview: jest.Mock };
  let service: CostingService;

  const user = { id: 'u1' } as any;

  beforeEach(() => {
    prisma = {
      job: { findUnique: jest.fn(), update: jest.fn().mockResolvedValue({}) },
      timesheet: { findMany: jest.fn().mockResolvedValue([]) },
      jobAssignment: { findMany: jest.fn().mockResolvedValue([]) },
      expense: { findMany: jest.fn().mockResolvedValue([]) },
      invoice: { aggregate: jest.fn().mockResolvedValue({ _sum: { subtotal: null } }) },
      $transaction: jest.fn((cb: any) => cb(prisma)),
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    jobStatus = { applyFinanceStatus: jest.fn().mockResolvedValue(undefined) };
    alerts = { afterCostReview: jest.fn().mockResolvedValue(undefined) };
    service = new CostingService(prisma as any, audit as any, jobStatus as any, alerts as any);
  });

  describe('computeCost', () => {
    it('sums labour (overtime weighted), machines, and posted expenses; margin off jobValue', async () => {
      prisma.job.findUnique.mockResolvedValue({
        id: 'j1',
        status: JobStatus.COMPLETED,
        jobValue: 10000,
        costBudget: 5000,
        costReviewedAt: null,
      });
      prisma.timesheet.findMany.mockResolvedValue([
        {
          regularHours: 10,
          overtimeHours: 2, // 2 × 1.5 = 3 weighted
          standbyHours: 0,
          travelHours: 0,
          employeeId: 'e1',
          crewId: null,
          employee: { name: 'Sam', costRate: 100 }, // (10+3) × 100 = 1300
          crew: null,
        },
      ]);
      prisma.jobAssignment.findMany.mockResolvedValue([
        { resourceType: 'VEHICLE', actualHours: 5, vehicle: { plateNumber: 'ABC', costRate: 50 }, equipment: null }, // 250
        { resourceType: 'EQUIPMENT', actualHours: 4, vehicle: null, equipment: { name: 'Pump', costRate: 25 } }, // 100
      ]);
      prisma.expense.findMany.mockResolvedValue([
        { category: 'MATERIAL', totalAmount: 200 },
        { category: 'VEHICLE', totalAmount: 100 },
      ]);

      const r = await service.computeCost('j1');

      expect(r.labourCost).toBe(1300);
      expect(r.vehicleCost).toBe(250);
      expect(r.equipmentCost).toBe(100);
      expect(r.expensesTotal).toBe(300);
      expect(r.expensesByCategory).toEqual({ MATERIAL: 200, VEHICLE: 100 });
      expect(r.actualCost).toBe(1950);
      expect(r.revenue).toBe(10000);
      expect(r.revenueBasis).toBe('JOB_VALUE');
      expect(r.grossProfit).toBe(8050);
      expect(r.grossMarginPct).toBe(80.5);
      expect(r.costVariance).toBe(-3050);
      expect(r.warnings).toHaveLength(0);
    });

    it('prefers invoiced ex-VAT subtotal for revenue and warns on missing rates', async () => {
      prisma.job.findUnique.mockResolvedValue({
        id: 'j1',
        status: JobStatus.COSTING_REVIEW,
        jobValue: 10000,
        costBudget: null,
        costReviewedAt: null,
      });
      prisma.jobAssignment.findMany.mockResolvedValue([
        { resourceType: 'VEHICLE', actualHours: 5, vehicle: { plateNumber: 'ABC', costRate: null }, equipment: null },
      ]);
      prisma.invoice.aggregate.mockResolvedValue({ _sum: { subtotal: 8000 } });

      const r = await service.computeCost('j1');

      expect(r.revenue).toBe(8000);
      expect(r.revenueBasis).toBe('INVOICED');
      expect(r.vehicleCost).toBe(0);
      expect(r.costVariance).toBeNull();
      expect(r.warnings.join(' ')).toContain('vehicle');
    });

    it('throws when the job is missing', async () => {
      prisma.job.findUnique.mockResolvedValue(null);
      await expect(service.computeCost('nope')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('review', () => {
    it('persists profit and advances COMPLETED → COSTING_REVIEW', async () => {
      prisma.job.findUnique.mockResolvedValue({
        id: 'j1',
        status: JobStatus.COMPLETED,
        jobValue: 1000,
        costBudget: null,
        costReviewedAt: null,
      });

      const r = await service.review('j1', user);

      expect(prisma.job.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'j1' },
          data: expect.objectContaining({ costReviewedById: 'u1' }),
        }),
      );
      expect(jobStatus.applyFinanceStatus).toHaveBeenCalledWith(
        'j1',
        JobStatus.COSTING_REVIEW,
        'u1',
        expect.any(String),
        prisma,
      );
      expect(audit.record).toHaveBeenCalled();
      expect(r.status).toBe(JobStatus.COSTING_REVIEW);
    });

    it('does not change status when recomputing an already-reviewing job', async () => {
      prisma.job.findUnique.mockResolvedValue({
        id: 'j1',
        status: JobStatus.COSTING_REVIEW,
        jobValue: 1000,
        costBudget: null,
        costReviewedAt: new Date(),
      });

      await service.review('j1', user);
      expect(jobStatus.applyFinanceStatus).not.toHaveBeenCalled();
    });

    it('refuses a job that has not reached COMPLETED', async () => {
      prisma.job.findUnique.mockResolvedValue({
        id: 'j1',
        status: JobStatus.ACTIVE,
        jobValue: 1000,
        costBudget: null,
        costReviewedAt: null,
      });
      await expect(service.review('j1', user)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('markReadyForInvoice', () => {
    it('advances COSTING_REVIEW → READY_FOR_INVOICE once reviewed', async () => {
      prisma.job.findUnique
        .mockResolvedValueOnce({ status: JobStatus.COSTING_REVIEW, costReviewedAt: new Date() }) // gate read
        .mockResolvedValueOnce({
          id: 'j1',
          status: JobStatus.READY_FOR_INVOICE,
          jobValue: 1000,
          costBudget: null,
          costReviewedAt: new Date(),
        }); // computeCost read

      await service.markReadyForInvoice('j1', user);

      expect(jobStatus.applyFinanceStatus).toHaveBeenCalledWith(
        'j1',
        JobStatus.READY_FOR_INVOICE,
        'u1',
        expect.any(String),
      );
    });

    it('refuses when the cost review has not been run', async () => {
      prisma.job.findUnique.mockResolvedValue({ status: JobStatus.COSTING_REVIEW, costReviewedAt: null });
      await expect(service.markReadyForInvoice('j1', user)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuses when the job is not in COSTING_REVIEW', async () => {
      prisma.job.findUnique.mockResolvedValue({ status: JobStatus.COMPLETED, costReviewedAt: new Date() });
      await expect(service.markReadyForInvoice('j1', user)).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
