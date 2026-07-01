import { BadRequestException, NotFoundException } from '@nestjs/common';
import { JobStatus } from '@prisma/client';
import { JobStatusService } from './job-status.service';

// Covers INV-D3-3/4/5 + INV-X-2: forward-only finance status advance.
describe('JobStatusService.applyFinanceStatus', () => {
  let prisma: any;
  let audit: { record: jest.Mock };
  let service: JobStatusService;

  beforeEach(() => {
    prisma = {
      job: { findUnique: jest.fn(), update: jest.fn().mockResolvedValue({}) },
      jobStatusHistory: { create: jest.fn().mockResolvedValue({}) },
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    service = new JobStatusService(prisma as any, audit as any);
  });

  it('throws NotFound when the job is missing', async () => {
    prisma.job.findUnique.mockResolvedValue(null);
    await expect(service.applyFinanceStatus('j', JobStatus.INVOICED, 'u', 'r')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses a cancelled job (INV-D3-4)', async () => {
    prisma.job.findUnique.mockResolvedValue({ status: JobStatus.CANCELLED });
    await expect(service.applyFinanceStatus('j', JobStatus.INVOICED, 'u', 'r')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses a non-finance target status', async () => {
    prisma.job.findUnique.mockResolvedValue({ status: JobStatus.COMPLETED });
    await expect(service.applyFinanceStatus('j', JobStatus.DRAFT, 'u', 'r')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses a job that has not reached COMPLETED (INV-D3-5)', async () => {
    prisma.job.findUnique.mockResolvedValue({ status: JobStatus.ACTIVE });
    await expect(service.applyFinanceStatus('j', JobStatus.INVOICED, 'u', 'r')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('advances forward and records history + audit', async () => {
    prisma.job.findUnique.mockResolvedValue({ status: JobStatus.COMPLETED });
    await service.applyFinanceStatus('j', JobStatus.INVOICED, 'u', 'Invoice issued');
    expect(prisma.job.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: JobStatus.INVOICED } }),
    );
    expect(prisma.jobStatusHistory.create).toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalled();
  });

  it('is a silent no-op on a backward move (INV-D3-3)', async () => {
    prisma.job.findUnique.mockResolvedValue({ status: JobStatus.PAID });
    await service.applyFinanceStatus('j', JobStatus.INVOICED, 'u', 'r');
    expect(prisma.job.update).not.toHaveBeenCalled();
  });
});

// Job status carries its resource bookings along (Scheduling ↔ Jobs consistency).
describe('JobStatusService.changeStatus assignment cascade', () => {
  let prisma: any;
  let tx: any;
  let audit: { record: jest.Mock };
  let service: JobStatusService;

  beforeEach(() => {
    tx = {
      job: { update: jest.fn().mockResolvedValue({ id: 'j', status: JobStatus.ACTIVE }) },
      jobStatusHistory: { create: jest.fn().mockResolvedValue({}) },
      jobAssignment: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
    };
    prisma = {
      job: { findUnique: jest.fn().mockResolvedValue({ id: 'j', status: JobStatus.SCHEDULED, actualStartDate: null, actualEndDate: null }) },
      jobAssignment: { count: jest.fn().mockResolvedValue(2) },
      $transaction: jest.fn((cb: any) => cb(tx)),
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    service = new JobStatusService(prisma as any, audit as any);
  });

  const user = { id: 'u', permissions: ['jobs.status_override'] } as any;

  it('activates PLANNED bookings when the job goes ACTIVE', async () => {
    await service.changeStatus('j', { toStatus: JobStatus.ACTIVE } as any, user);
    expect(tx.jobAssignment.updateMany).toHaveBeenCalledWith({
      where: { jobId: 'j', status: { in: ['PLANNED'] } },
      data: { status: 'ACTIVE' },
    });
  });

  it('does not cascade for a non-cascading transition (ON_HOLD)', async () => {
    prisma.job.findUnique.mockResolvedValue({ id: 'j', status: JobStatus.ACTIVE, actualStartDate: new Date(), actualEndDate: null });
    await service.changeStatus('j', { toStatus: JobStatus.ON_HOLD } as any, user);
    expect(tx.jobAssignment.updateMany).not.toHaveBeenCalled();
  });
});
