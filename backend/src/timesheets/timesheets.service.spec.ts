import { BadRequestException, ConflictException } from '@nestjs/common';
import { ApprovalStatus, AuditAction } from '@prisma/client';
import { TimesheetsService } from './timesheets.service';
import { AuthenticatedUser } from '../common/types/authenticated-user.interface';

function makeUser(): AuthenticatedUser {
  return { id: 'u1', email: 'a@b.c', name: 'T', roleId: 'r', roleName: 'Admin', permissions: [], mfaEnabled: false, mustChangePassword: false };
}

describe('TimesheetsService', () => {
  let prisma: any;
  let audit: { record: jest.Mock };
  let service: TimesheetsService;

  beforeEach(() => {
    prisma = {
      job: { findUnique: jest.fn().mockResolvedValue({ id: 'job-1' }) },
      employee: { findUnique: jest.fn().mockResolvedValue({ id: 'emp-1' }) },
      crew: { findUnique: jest.fn().mockResolvedValue({ id: 'crew-1' }) },
      timesheet: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'ts-1', ...data })),
        findUnique: jest.fn(),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'ts-1', ...data })),
      },
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    service = new TimesheetsService(prisma, audit as any);
  });

  const baseDto = { jobId: 'job-1', employeeId: 'emp-1', workDate: '2026-07-01', regularHours: 8 };

  it('creates a DRAFT timesheet', async () => {
    const result = await service.create(baseDto as any, makeUser());
    expect(result.approvalStatus ?? 'DRAFT').toBeDefined();
    expect(prisma.timesheet.create).toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: AuditAction.CREATE }));
  });

  it('requires exactly one of employee or crew', async () => {
    await expect(
      service.create({ jobId: 'job-1', workDate: '2026-07-01', regularHours: 8 } as any, makeUser()),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create({ ...baseDto, crewId: 'crew-1' } as any, makeUser()),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a timesheet with no hours', async () => {
    await expect(
      service.create({ jobId: 'job-1', employeeId: 'emp-1', workDate: '2026-07-01' } as any, makeUser()),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('submits a DRAFT timesheet', async () => {
    prisma.timesheet.findUnique.mockResolvedValue({ approvalStatus: ApprovalStatus.DRAFT });
    const result = await service.submit('ts-1', makeUser());
    expect(result.approvalStatus).toBe(ApprovalStatus.SUBMITTED);
  });

  it('only approves a SUBMITTED timesheet', async () => {
    prisma.timesheet.findUnique.mockResolvedValue({ approvalStatus: ApprovalStatus.DRAFT });
    await expect(service.approve('ts-1', makeUser())).rejects.toBeInstanceOf(ConflictException);
  });

  it('approves a SUBMITTED timesheet and stamps approver', async () => {
    prisma.timesheet.findUnique.mockResolvedValue({ approvalStatus: ApprovalStatus.SUBMITTED });
    const result = await service.approve('ts-1', makeUser());
    expect(result.approvalStatus).toBe(ApprovalStatus.APPROVED);
    expect(prisma.timesheet.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ approvedById: 'u1' }) }),
    );
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: AuditAction.APPROVE }));
  });

  it('blocks editing an APPROVED timesheet', async () => {
    prisma.timesheet.findUnique.mockResolvedValue({ approvalStatus: ApprovalStatus.APPROVED });
    await expect(service.update('ts-1', { regularHours: 4 }, makeUser())).rejects.toBeInstanceOf(ConflictException);
  });
});
