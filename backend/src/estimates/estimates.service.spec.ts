import { ConflictException } from '@nestjs/common';
import { EstimateStatus } from '@prisma/client';
import { EstimatesService } from './estimates.service';
import { AuthenticatedUser } from '../common/types/authenticated-user.interface';

function makeUser(): AuthenticatedUser {
  return { id: 'user-1', email: 'a@b.c', name: 'T', roleId: 'r', roleName: 'Admin', permissions: [], mfaEnabled: false, mustChangePassword: false };
}

describe('EstimatesService', () => {
  let prisma: any;
  let audit: { record: jest.Mock };
  let jobs: { create: jest.Mock };
  let pdf: any;
  let service: EstimatesService;

  beforeEach(() => {
    prisma = {
      client: { findUnique: jest.fn().mockResolvedValue({ id: 'client-1' }) },
      contract: { findUnique: jest.fn().mockResolvedValue({ clientId: 'client-1' }) },
      contractRateCard: { findMany: jest.fn().mockResolvedValue([]) },
      estimate: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'est-1', ...data })),
        findUnique: jest.fn(),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'est-1', ...data })),
      },
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    jobs = { create: jest.fn().mockResolvedValue({ id: 'job-1', jobCode: 'JOB-2026-0001' }) };
    pdf = { renderFinancialDocument: jest.fn() };
    service = new EstimatesService(prisma as any, audit as any, jobs as any, pdf as any);
  });

  const baseDto = {
    clientId: 'client-1',
    title: 'Nitrogen purging',
    jobType: 'Nitrogen',
    location: 'Field A',
    plannedStartDate: '2026-07-01T06:00:00Z',
    plannedEndDate: '2026-07-05T16:00:00Z',
    items: [
      { description: 'Operator', quantity: 2, hours: 100, unitPrice: 110 },
      { description: 'Vaporizer 3000', quantity: 1, hours: 100, unitPrice: 742 },
    ],
  };

  it('computes price totals from the line items on create', async () => {
    await service.create(baseDto as any, makeUser());

    const createArg = prisma.estimate.create.mock.calls[0][0];
    expect(createArg.data.subtotal).toBe(96200);
    expect(createArg.data.vatAmount).toBe(14430);
    expect(createArg.data.totalAmount).toBe(110630);
    expect(createArg.data.estimateNumber).toMatch(/^EST-\d{4}-0001$/);
    expect(audit.record).toHaveBeenCalled();
  });

  it('blocks editing an estimate that is not DRAFT', async () => {
    prisma.estimate.findUnique.mockResolvedValue({ id: 'est-1', status: EstimateStatus.SENT });
    await expect(
      service.update('est-1', { title: 'x' } as any, makeUser()),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('only approves an estimate that is SENT', async () => {
    prisma.estimate.findUnique.mockResolvedValue({ status: EstimateStatus.DRAFT });
    await expect(service.approve('est-1', makeUser())).rejects.toBeInstanceOf(ConflictException);
  });

  it('converts an APPROVED estimate into a job and copies the total to jobValue', async () => {
    prisma.estimate.findUnique.mockResolvedValue({
      id: 'est-1',
      status: EstimateStatus.APPROVED,
      clientId: 'client-1',
      contractId: null,
      jobId: null,
      title: 'Nitrogen purging',
      jobType: 'Nitrogen',
      location: 'Field A',
      plannedStartDate: new Date('2026-07-01T06:00:00Z'),
      plannedEndDate: new Date('2026-07-05T16:00:00Z'),
      totalAmount: 110630,
    });

    await service.convert('est-1', {}, makeUser());

    expect(jobs.create).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: 'client-1', jobValue: 110630, serviceType: 'Nitrogen' }),
    );
    expect(prisma.estimate.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: EstimateStatus.CONVERTED, jobId: 'job-1' }) }),
    );
  });

  it('refuses to convert an estimate that is not APPROVED', async () => {
    prisma.estimate.findUnique.mockResolvedValue({ id: 'est-1', status: EstimateStatus.DRAFT, jobId: null });
    await expect(service.convert('est-1', {}, makeUser())).rejects.toBeInstanceOf(ConflictException);
  });
});
