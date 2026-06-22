import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { ApprovalStatus, AuditAction, ExpenseCategory, ReimbursementStatus } from '@prisma/client';
import { ExpensesService } from './expenses.service';
import { AuthenticatedUser } from '../common/types/authenticated-user.interface';

function makeUser(id = 'u1'): AuthenticatedUser {
  return {
    id,
    email: 'a@b.c',
    name: 'T',
    roleId: 'r',
    roleName: 'Admin',
    permissions: [],
    mfaEnabled: false,
    mustChangePassword: false,
  };
}

describe('ExpensesService', () => {
  let prisma: any;
  let audit: { record: jest.Mock };
  let storage: { save: jest.Mock; delete: jest.Mock; getPath: jest.Mock };
  let service: ExpensesService;

  beforeEach(() => {
    prisma = {
      job: { findUnique: jest.fn().mockResolvedValue({ id: 'job-1' }) },
      vehicle: { findUnique: jest.fn().mockResolvedValue({ id: 'veh-1' }) },
      equipment: { findUnique: jest.fn().mockResolvedValue({ id: 'eq-1' }) },
      employee: { findUnique: jest.fn().mockResolvedValue({ id: 'emp-1' }) },
      expense: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'exp-1', ...data })),
        findUnique: jest.fn(),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'exp-1', ...data })),
        delete: jest.fn().mockResolvedValue(undefined),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    storage = { save: jest.fn(), delete: jest.fn().mockResolvedValue(undefined), getPath: jest.fn() };
    service = new ExpensesService(prisma, audit as any, storage as any);
  });

  const baseDto = {
    expenseDate: '2026-07-01',
    category: ExpenseCategory.MATERIAL,
    amountBeforeVat: 1000,
  };

  it('creates a DRAFT expense and auto-computes 15% VAT', async () => {
    const result = await service.create(baseDto as any, makeUser());
    expect(prisma.expense.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ vatAmount: 150, totalAmount: 1150 }) }),
    );
    expect(result.unallocated).toBe(true);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: AuditAction.CREATE }));
  });

  it('honours an explicit vatAmount', async () => {
    await service.create({ ...baseDto, vatAmount: 0 } as any, makeUser());
    expect(prisma.expense.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ vatAmount: 0, totalAmount: 1000 }) }),
    );
  });

  it('rejects a non-positive amount', async () => {
    await expect(
      service.create({ ...baseDto, amountBeforeVat: 0 } as any, makeUser()),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires an employee when reimbursable', async () => {
    await expect(
      service.create({ ...baseDto, reimbursable: true } as any, makeUser()),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('marks expense allocated when a job is set', async () => {
    const result = await service.create({ ...baseDto, jobId: 'job-1' } as any, makeUser());
    expect(result.unallocated).toBe(false);
  });

  it('submits a DRAFT expense', async () => {
    prisma.expense.findUnique.mockResolvedValue({
      approvalStatus: ApprovalStatus.DRAFT,
      category: ExpenseCategory.MATERIAL,
      totalAmount: 1150,
    });
    const result = await service.submit('exp-1', makeUser());
    expect(result.approvalStatus).toBe(ApprovalStatus.SUBMITTED);
  });

  it('only approves a SUBMITTED expense', async () => {
    prisma.expense.findUnique.mockResolvedValue({
      approvalStatus: ApprovalStatus.DRAFT,
      createdById: 'someone',
      reimbursable: false,
    });
    await expect(service.approve('exp-1', makeUser())).rejects.toBeInstanceOf(ConflictException);
  });

  it('blocks self-approval (separation of duties)', async () => {
    prisma.expense.findUnique.mockResolvedValue({
      approvalStatus: ApprovalStatus.SUBMITTED,
      createdById: 'u1',
      reimbursable: false,
    });
    await expect(service.approve('exp-1', makeUser('u1'))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('approves a SUBMITTED expense by another user and stamps approver', async () => {
    prisma.expense.findUnique.mockResolvedValue({
      approvalStatus: ApprovalStatus.SUBMITTED,
      createdById: 'author',
      reimbursable: false,
    });
    const result = await service.approve('exp-1', makeUser('approver'));
    expect(result.approvalStatus).toBe(ApprovalStatus.APPROVED);
    expect(prisma.expense.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ approvedById: 'approver' }) }),
    );
  });

  it('sets reimbursement PENDING when approving a reimbursable expense', async () => {
    prisma.expense.findUnique.mockResolvedValue({
      approvalStatus: ApprovalStatus.SUBMITTED,
      createdById: 'author',
      reimbursable: true,
    });
    const result = await service.approve('exp-1', makeUser('approver'));
    expect(result.reimbursementStatus).toBe(ReimbursementStatus.PENDING);
  });

  it('posts an APPROVED expense', async () => {
    prisma.expense.findUnique.mockResolvedValue({
      approvalStatus: ApprovalStatus.APPROVED,
      createdById: 'author',
      reimbursable: false,
    });
    const result = await service.post('exp-1', makeUser('finance'));
    expect(result.approvalStatus).toBe(ApprovalStatus.POSTED);
  });

  it('blocks editing an APPROVED expense', async () => {
    prisma.expense.findUnique.mockResolvedValue({
      approvalStatus: ApprovalStatus.APPROVED,
      amountBeforeVat: 1000,
      vatAmount: 150,
      reimbursable: false,
      employeeId: null,
    });
    await expect(
      service.update('exp-1', { amountBeforeVat: 500 }, makeUser()),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects reimbursing a non-reimbursable expense', async () => {
    prisma.expense.findUnique.mockResolvedValue({
      approvalStatus: ApprovalStatus.APPROVED,
      reimbursable: false,
      createdById: 'author',
    });
    await expect(
      service.reimburse('exp-1', { status: ReimbursementStatus.COMPENSATED } as any, makeUser('mgr')),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('compensates a reimbursable APPROVED expense', async () => {
    prisma.expense.findUnique.mockResolvedValue({
      approvalStatus: ApprovalStatus.APPROVED,
      reimbursable: true,
      createdById: 'author',
    });
    const result = await service.reimburse(
      'exp-1',
      { status: ReimbursementStatus.COMPENSATED } as any,
      makeUser('mgr'),
    );
    expect(result.reimbursementStatus).toBe(ReimbursementStatus.COMPENSATED);
    expect(prisma.expense.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ reimbursedAt: expect.any(Date) }) }),
    );
  });
});
