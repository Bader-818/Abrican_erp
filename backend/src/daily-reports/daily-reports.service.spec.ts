import { BadRequestException, ConflictException } from '@nestjs/common';
import { ApprovalStatus, AuditAction } from '@prisma/client';
import { DailyReportsService } from './daily-reports.service';
import { AuthenticatedUser } from '../common/types/authenticated-user.interface';

function makeUser(id = 'u1'): AuthenticatedUser {
  return { id, email: 'a@b.c', name: 'T', roleId: 'r', roleName: 'Admin', permissions: [], mfaEnabled: false, mustChangePassword: false };
}

// Covers INV-D6 (shared approval workflow) — parity with timesheets.
describe('DailyReportsService', () => {
  let prisma: any;
  let audit: { record: jest.Mock };
  let service: DailyReportsService;

  beforeEach(() => {
    prisma = {
      job: { findUnique: jest.fn().mockResolvedValue({ id: 'job-1' }) },
      employee: { findUnique: jest.fn().mockResolvedValue({ id: 'emp-1' }) },
      dailyReport: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'dr-1', ...data })),
        findUnique: jest.fn(),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'dr-1', ...data })),
      },
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    service = new DailyReportsService(prisma as any, audit as any);
  });

  const dto = { jobId: 'job-1', reportDate: '2026-07-01', workPerformed: 'Welded 3 joints' };

  it('creates a DRAFT report and audits it', async () => {
    await service.create(dto as any, makeUser());
    expect(prisma.dailyReport.create).toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: AuditAction.CREATE }));
  });

  it('rejects an invalid jobId', async () => {
    prisma.job.findUnique.mockResolvedValue(null);
    await expect(service.create(dto as any, makeUser())).rejects.toBeInstanceOf(BadRequestException);
  });

  it('submits a DRAFT report', async () => {
    prisma.dailyReport.findUnique.mockResolvedValue({ approvalStatus: ApprovalStatus.DRAFT });
    const result = await service.submit('dr-1', makeUser());
    expect(result.approvalStatus).toBe(ApprovalStatus.SUBMITTED);
  });

  it('only approves a SUBMITTED report (INV-D6-1)', async () => {
    prisma.dailyReport.findUnique.mockResolvedValue({ approvalStatus: ApprovalStatus.DRAFT });
    await expect(service.approve('dr-1', makeUser())).rejects.toBeInstanceOf(ConflictException);
  });

  it('approves a SUBMITTED report and stamps approver', async () => {
    prisma.dailyReport.findUnique.mockResolvedValue({ approvalStatus: ApprovalStatus.SUBMITTED });
    const result = await service.approve('dr-1', makeUser());
    expect(result.approvalStatus).toBe(ApprovalStatus.APPROVED);
    expect(prisma.dailyReport.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ approvedById: 'u1' }) }),
    );
  });

  it('blocks editing an APPROVED report (INV-D6-2)', async () => {
    prisma.dailyReport.findUnique.mockResolvedValue({ approvalStatus: ApprovalStatus.APPROVED });
    await expect(service.update('dr-1', { workPerformed: 'x' }, makeUser())).rejects.toBeInstanceOf(ConflictException);
  });
});
