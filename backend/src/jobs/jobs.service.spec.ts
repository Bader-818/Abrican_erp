import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { JobStatus } from '@prisma/client';
import { JobsService } from './jobs.service';

// Covers INV-D3 (job lifecycle) + INV-D2-4 (relation integrity) with mocked Prisma.
describe('JobsService', () => {
  let prisma: any;
  let service: JobsService;

  beforeEach(() => {
    const tx = {
      job: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'job-1', ...data })),
      },
    };
    prisma = {
      client: { findUnique: jest.fn().mockResolvedValue({ id: 'c1' }) },
      contract: { findUnique: jest.fn().mockResolvedValue({ clientId: 'c1' }) },
      purchaseOrder: { findUnique: jest.fn().mockResolvedValue({ clientId: 'c1', contractId: null }) },
      job: { findUnique: jest.fn(), delete: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn((cb: any) => cb(tx)),
      _tx: tx,
    };
    service = new JobsService(prisma as any);
  });

  const dto = {
    title: 'Pipeline inspection',
    clientId: 'c1',
    serviceType: 'NDT',
    location: 'Site A',
    plannedStartDate: '2026-07-01',
    plannedEndDate: '2026-07-10',
  };

  it('rejects an invalid clientId (INV-D2-4)', async () => {
    prisma.client.findUnique.mockResolvedValue(null);
    await expect(service.create(dto as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a contract that belongs to another client', async () => {
    prisma.contract.findUnique.mockResolvedValue({ clientId: 'other' });
    await expect(service.create({ ...dto, contractId: 'k1' } as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects plannedEndDate on/before plannedStartDate', async () => {
    await expect(
      service.create({ ...dto, plannedEndDate: '2026-07-01' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('generates a sequential per-year job code (JOB-YYYY-0001)', async () => {
    const result: any = await service.create(dto as any);
    const year = new Date().getFullYear();
    expect(result.jobCode).toBe(`JOB-${year}-0001`);
    expect(prisma._tx.job.create).toHaveBeenCalled();
  });

  it('continues from the highest existing code, not the row count (deleted jobs leave gaps)', async () => {
    const year = new Date().getFullYear();
    prisma._tx.job.findFirst.mockResolvedValue({ jobCode: `JOB-${year}-0016` });
    const result: any = await service.create(dto as any);
    expect(result.jobCode).toBe(`JOB-${year}-0017`);
  });

  it('findOne throws NotFound for a missing job', async () => {
    prisma.job.findUnique.mockResolvedValue(null);
    await expect(service.findOne('nope')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('blocks deleting a job that is not DRAFT/CANCELLED (INV-D3)', async () => {
    prisma.job.findUnique.mockResolvedValue({ status: JobStatus.ACTIVE });
    await expect(service.remove('job-1')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.job.delete).not.toHaveBeenCalled();
  });

  it('allows deleting a DRAFT job', async () => {
    prisma.job.findUnique.mockResolvedValue({ status: JobStatus.DRAFT });
    await expect(service.remove('job-1')).resolves.toEqual({ success: true });
    expect(prisma.job.delete).toHaveBeenCalled();
  });
});
