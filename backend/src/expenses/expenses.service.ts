import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ApprovalStatus, AuditAction, Prisma, ReimbursementStatus } from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service';
import { DEFAULT_VAT_RATE, round2 } from '../common/finance/line-math';
import { paginate } from '../common/helpers/pagination.helper';
import { AuthenticatedUser } from '../common/types/authenticated-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { IStorageService } from '../storage/storage.interface';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { ExpensesQueryDto } from './dto/expenses-query.dto';
import { ReimburseDto } from './dto/reimburse.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';

export interface UploadedFileLike {
  originalname: string;
  buffer: Buffer;
  mimetype: string;
  size: number;
}

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_PREFIXES = ['image/'];
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
];

const LIST_SELECT = {
  id: true,
  expenseDate: true,
  vendor: true,
  category: true,
  totalAmount: true,
  currency: true,
  approvalStatus: true,
  reimbursable: true,
  reimbursementStatus: true,
  receiptName: true,
  createdAt: true,
  jobId: true,
  vehicleId: true,
  equipmentId: true,
  employeeId: true,
  job: { select: { id: true, jobCode: true, title: true } },
  employee: { select: { id: true, name: true } },
} satisfies Prisma.ExpenseSelect;

const DETAIL_SELECT = {
  ...LIST_SELECT,
  description: true,
  amountBeforeVat: true,
  vatAmount: true,
  approvedAt: true,
  rejectionReason: true,
  postedAt: true,
  receiptUrl: true,
  reimbursedAt: true,
  reimbursementNote: true,
  reimbursementMethod: true,
  reimbursementRef: true,
  updatedAt: true,
  vehicle: { select: { id: true, plateNumber: true, vehicleType: true } },
  equipment: { select: { id: true, name: true } },
  approvedBy: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.ExpenseSelect;

type ExpenseAllocation = Pick<
  Prisma.ExpenseGetPayload<{ select: typeof LIST_SELECT }>,
  'jobId' | 'vehicleId' | 'equipmentId' | 'employeeId'
>;

// Statuses in which the record is still editable/deletable by its owner.
const EDITABLE: ApprovalStatus[] = [ApprovalStatus.DRAFT, ApprovalStatus.REJECTED];

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    @Inject('IStorageService') private readonly storage: IStorageService,
  ) {}

  async findAll(query: ExpensesQueryDto) {
    const where: Prisma.ExpenseWhereInput = {
      ...(query.category ? { category: query.category } : {}),
      ...(query.approvalStatus ? { approvalStatus: query.approvalStatus } : {}),
      ...(query.reimbursementStatus ? { reimbursementStatus: query.reimbursementStatus } : {}),
      ...(query.jobId ? { jobId: query.jobId } : {}),
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.from || query.to
        ? {
            expenseDate: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };
    const result = await paginate(this.prisma.expense, query, {
      where,
      orderBy: { expenseDate: 'desc' },
      select: LIST_SELECT,
    });
    return { ...result, data: result.data.map((e) => this.withFlags(e)) };
  }

  async findOne(id: string) {
    const expense = await this.prisma.expense.findUnique({ where: { id }, select: DETAIL_SELECT });
    if (!expense) throw new NotFoundException('Expense not found');
    return this.withFlags(expense);
  }

  async create(dto: CreateExpenseDto, user: AuthenticatedUser, ipAddress?: string) {
    this.assertAmount(dto.amountBeforeVat);
    await this.assertAllocations(dto);
    if (dto.reimbursable && !dto.employeeId) {
      throw new BadRequestException('A reimbursable expense must name the employee to be compensated');
    }

    const { vatAmount, totalAmount } = this.computeAmounts(dto.amountBeforeVat, dto.vatAmount);

    const created = await this.prisma.expense.create({
      data: {
        expenseDate: new Date(dto.expenseDate),
        category: dto.category,
        vendor: dto.vendor,
        description: dto.description,
        currency: dto.currency ?? 'SAR',
        amountBeforeVat: dto.amountBeforeVat,
        vatAmount,
        totalAmount,
        jobId: dto.jobId,
        vehicleId: dto.vehicleId,
        equipmentId: dto.equipmentId,
        employeeId: dto.employeeId,
        reimbursable: dto.reimbursable ?? false,
        createdById: user.id,
      },
      select: DETAIL_SELECT,
    });
    await this.audit(user, AuditAction.CREATE, created.id, ipAddress);
    return this.withFlags(created);
  }

  async update(id: string, dto: UpdateExpenseDto, user: AuthenticatedUser, ipAddress?: string) {
    const existing = await this.prisma.expense.findUnique({
      where: { id },
      select: {
        approvalStatus: true,
        amountBeforeVat: true,
        vatAmount: true,
        reimbursable: true,
        employeeId: true,
      },
    });
    if (!existing) throw new NotFoundException('Expense not found');
    if (!EDITABLE.includes(existing.approvalStatus)) {
      throw new ConflictException('Only draft or rejected expenses can be edited');
    }
    await this.assertAllocations(dto);

    const reimbursable = dto.reimbursable ?? existing.reimbursable;
    const employeeId = dto.employeeId !== undefined ? dto.employeeId : existing.employeeId;
    if (reimbursable && !employeeId) {
      throw new BadRequestException('A reimbursable expense must name the employee to be compensated');
    }

    // Recompute money whenever either side of the VAT pair changes.
    const base = dto.amountBeforeVat ?? Number(existing.amountBeforeVat);
    this.assertAmount(base);
    const vatTouched = dto.vatAmount !== undefined;
    const baseTouched = dto.amountBeforeVat !== undefined;
    let money: { vatAmount?: number; totalAmount?: number } = {};
    if (vatTouched || baseTouched) {
      const vatInput = vatTouched ? dto.vatAmount : Number(existing.vatAmount);
      money = this.computeAmounts(base, vatInput);
    }

    const updated = await this.prisma.expense.update({
      where: { id },
      data: {
        ...(dto.expenseDate ? { expenseDate: new Date(dto.expenseDate) } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.vendor !== undefined ? { vendor: dto.vendor } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
        ...(baseTouched ? { amountBeforeVat: dto.amountBeforeVat } : {}),
        ...(money.vatAmount !== undefined ? { vatAmount: money.vatAmount } : {}),
        ...(money.totalAmount !== undefined ? { totalAmount: money.totalAmount } : {}),
        ...(dto.jobId !== undefined ? { jobId: dto.jobId } : {}),
        ...(dto.vehicleId !== undefined ? { vehicleId: dto.vehicleId } : {}),
        ...(dto.equipmentId !== undefined ? { equipmentId: dto.equipmentId } : {}),
        ...(dto.employeeId !== undefined ? { employeeId: dto.employeeId } : {}),
        ...(dto.reimbursable !== undefined ? { reimbursable: dto.reimbursable } : {}),
      },
      select: DETAIL_SELECT,
    });
    await this.audit(user, AuditAction.UPDATE, id, ipAddress);
    return this.withFlags(updated);
  }

  async remove(id: string, user: AuthenticatedUser, ipAddress?: string) {
    const existing = await this.prisma.expense.findUnique({
      where: { id },
      select: { approvalStatus: true, receiptUrl: true },
    });
    if (!existing) throw new NotFoundException('Expense not found');
    if (!EDITABLE.includes(existing.approvalStatus)) {
      throw new ConflictException('Only draft or rejected expenses can be deleted');
    }
    await this.prisma.expense.delete({ where: { id } });
    if (existing.receiptUrl) {
      await this.storage.delete(existing.receiptUrl).catch(() => undefined);
    }
    await this.audit(user, AuditAction.DELETE, id, ipAddress);
    return { success: true };
  }

  // --- approval workflow ----------------------------------------------------

  async submit(id: string, user: AuthenticatedUser, ipAddress?: string) {
    const existing = await this.prisma.expense.findUnique({
      where: { id },
      select: { approvalStatus: true, category: true, totalAmount: true },
    });
    if (!existing) throw new NotFoundException('Expense not found');
    if (!EDITABLE.includes(existing.approvalStatus)) {
      throw new ConflictException(`Cannot submit an expense that is ${existing.approvalStatus}`);
    }
    // Posting/submission guard (SRS 896): category + amount must be present.
    if (!existing.category || Number(existing.totalAmount) <= 0) {
      throw new BadRequestException('An expense needs a category and a positive amount before submission');
    }
    const updated = await this.prisma.expense.update({
      where: { id },
      data: { approvalStatus: ApprovalStatus.SUBMITTED, rejectionReason: null },
      select: DETAIL_SELECT,
    });
    await this.audit(user, AuditAction.UPDATE, id, ipAddress, 'Submitted for approval');
    return this.withFlags(updated);
  }

  async approve(id: string, user: AuthenticatedUser, ipAddress?: string) {
    const existing = await this.requireStatus(id, ApprovalStatus.SUBMITTED);
    this.assertNotSelf(existing.createdById, user, 'approve');
    const updated = await this.prisma.expense.update({
      where: { id },
      data: {
        approvalStatus: ApprovalStatus.APPROVED,
        approvedById: user.id,
        approvedAt: new Date(),
        // An approved out-of-pocket expense enters the reimbursement worklist.
        ...(existing.reimbursable
          ? { reimbursementStatus: ReimbursementStatus.PENDING }
          : {}),
      },
      select: DETAIL_SELECT,
    });
    await this.audit(user, AuditAction.APPROVE, id, ipAddress);
    return this.withFlags(updated);
  }

  async reject(id: string, reason: string | undefined, user: AuthenticatedUser, ipAddress?: string) {
    const existing = await this.requireStatus(id, ApprovalStatus.SUBMITTED);
    this.assertNotSelf(existing.createdById, user, 'reject');
    const updated = await this.prisma.expense.update({
      where: { id },
      data: { approvalStatus: ApprovalStatus.REJECTED, rejectionReason: reason ?? null },
      select: DETAIL_SELECT,
    });
    await this.audit(user, AuditAction.REJECT, id, ipAddress, reason);
    return this.withFlags(updated);
  }

  async post(id: string, user: AuthenticatedUser, ipAddress?: string) {
    const existing = await this.requireStatus(id, ApprovalStatus.APPROVED);
    this.assertNotSelf(existing.createdById, user, 'post');
    const updated = await this.prisma.expense.update({
      where: { id },
      data: { approvalStatus: ApprovalStatus.POSTED, postedAt: new Date() },
      select: DETAIL_SELECT,
    });
    await this.audit(user, AuditAction.UPDATE, id, ipAddress, 'Posted to job costing');
    return this.withFlags(updated);
  }

  // --- reimbursement --------------------------------------------------------

  async reimburse(id: string, dto: ReimburseDto, user: AuthenticatedUser, ipAddress?: string) {
    const existing = await this.prisma.expense.findUnique({
      where: { id },
      select: { approvalStatus: true, reimbursable: true, createdById: true },
    });
    if (!existing) throw new NotFoundException('Expense not found');
    if (!existing.reimbursable) {
      throw new BadRequestException('This expense is not flagged reimbursable');
    }
    const reimbursable: ApprovalStatus[] = [ApprovalStatus.APPROVED, ApprovalStatus.POSTED];
    if (!reimbursable.includes(existing.approvalStatus)) {
      throw new ConflictException(
        `Only an approved expense can be reimbursed (it is ${existing.approvalStatus})`,
      );
    }
    this.assertNotSelf(existing.createdById, user, 'reimburse');

    const updated = await this.prisma.expense.update({
      where: { id },
      data: {
        reimbursementStatus: dto.status,
        reimbursementNote: dto.note ?? null,
        reimbursementMethod: dto.method ?? null,
        reimbursementRef: dto.reference ?? null,
        reimbursedAt: dto.status === ReimbursementStatus.COMPENSATED
          ? (dto.date ? new Date(dto.date) : new Date())
          : null,
      },
      select: DETAIL_SELECT,
    });
    await this.audit(user, AuditAction.UPDATE, id, ipAddress, `Reimbursement: ${dto.status}`);
    return this.withFlags(updated);
  }

  /** Per-employee worklist of approved/posted reimbursable expenses. */
  async reimbursementSummary() {
    const rows = await this.prisma.expense.findMany({
      where: {
        reimbursable: true,
        approvalStatus: { in: [ApprovalStatus.APPROVED, ApprovalStatus.POSTED] },
      },
      select: LIST_SELECT,
      orderBy: { expenseDate: 'asc' },
    });

    const groups = new Map<
      string,
      {
        employee: { id: string; name: string };
        pending: number;
        compensated: number;
        delayed: number;
        declined: number;
        totalOwed: number;
        expenses: ReturnType<typeof this.withFlags>[];
      }
    >();

    for (const row of rows) {
      const emp = row.employee ?? { id: 'unassigned', name: 'Unassigned' };
      let g = groups.get(emp.id);
      if (!g) {
        g = { employee: emp, pending: 0, compensated: 0, delayed: 0, declined: 0, totalOwed: 0, expenses: [] };
        groups.set(emp.id, g);
      }
      const amount = Number(row.totalAmount);
      switch (row.reimbursementStatus) {
        case ReimbursementStatus.PENDING:
          g.pending = round2(g.pending + amount);
          g.totalOwed = round2(g.totalOwed + amount);
          break;
        case ReimbursementStatus.DELAYED:
          g.delayed = round2(g.delayed + amount);
          g.totalOwed = round2(g.totalOwed + amount);
          break;
        case ReimbursementStatus.COMPENSATED:
          g.compensated = round2(g.compensated + amount);
          break;
        case ReimbursementStatus.DECLINED:
          g.declined = round2(g.declined + amount);
          break;
        default:
          break;
      }
      g.expenses.push(this.withFlags(row));
    }

    const employees = [...groups.values()].sort((a, b) => b.totalOwed - a.totalOwed);
    const totalOwed = round2(employees.reduce((sum, e) => sum + e.totalOwed, 0));
    return { totalOwed, employees };
  }

  // --- receipt --------------------------------------------------------------

  async attachReceipt(
    id: string,
    file: UploadedFileLike | undefined,
    user: AuthenticatedUser,
    ipAddress?: string,
  ) {
    if (!file) throw new BadRequestException('A receipt file is required');
    this.validateFile(file);
    const existing = await this.prisma.expense.findUnique({
      where: { id },
      select: { id: true, receiptUrl: true },
    });
    if (!existing) throw new NotFoundException('Expense not found');

    const stored = await this.storage.save(file.buffer, file.originalname, file.mimetype, 'expenses');
    try {
      const updated = await this.prisma.expense.update({
        where: { id },
        data: { receiptUrl: stored.url, receiptName: file.originalname },
        select: DETAIL_SELECT,
      });
      // Drop the previously attached receipt, if any.
      if (existing.receiptUrl && existing.receiptUrl !== stored.url) {
        await this.storage.delete(existing.receiptUrl).catch(() => undefined);
      }
      await this.audit(user, AuditAction.UPDATE, id, ipAddress, 'Receipt attached');
      return this.withFlags(updated);
    } catch (error) {
      await this.storage.delete(stored.url).catch(() => undefined);
      throw error;
    }
  }

  async getReceipt(id: string) {
    const expense = await this.prisma.expense.findUnique({
      where: { id },
      select: { receiptUrl: true, receiptName: true },
    });
    if (!expense) throw new NotFoundException('Expense not found');
    if (!expense.receiptUrl) throw new NotFoundException('This expense has no receipt');
    return {
      path: this.storage.getPath(expense.receiptUrl),
      filename: expense.receiptName ?? 'receipt',
    };
  }

  // --- helpers --------------------------------------------------------------

  private withFlags<T extends ExpenseAllocation>(expense: T) {
    return {
      ...expense,
      unallocated:
        !expense.jobId && !expense.vehicleId && !expense.equipmentId && !expense.employeeId,
    };
  }

  private computeAmounts(amountBeforeVat: number, vatAmount?: number) {
    const base = round2(amountBeforeVat);
    const vat = vatAmount !== undefined ? round2(vatAmount) : round2(base * (DEFAULT_VAT_RATE / 100));
    return { vatAmount: vat, totalAmount: round2(base + vat) };
  }

  private assertAmount(amountBeforeVat: number) {
    if (!(amountBeforeVat > 0)) {
      throw new BadRequestException('Expense amount must be greater than zero');
    }
  }

  private assertNotSelf(createdById: string, user: AuthenticatedUser, action: string) {
    // Separation of duties (SRS 168): nobody actions their own expense.
    if (createdById === user.id) {
      throw new ForbiddenException(`You cannot ${action} an expense you created`);
    }
  }

  private async requireStatus(id: string, status: ApprovalStatus) {
    const existing = await this.prisma.expense.findUnique({
      where: { id },
      select: { approvalStatus: true, createdById: true, reimbursable: true },
    });
    if (!existing) throw new NotFoundException('Expense not found');
    if (existing.approvalStatus !== status) {
      throw new ConflictException(
        `Expense must be ${status} for this action (it is ${existing.approvalStatus})`,
      );
    }
    return existing;
  }

  private async assertAllocations(dto: CreateExpenseDto | UpdateExpenseDto) {
    if (dto.jobId) {
      const job = await this.prisma.job.findUnique({ where: { id: dto.jobId }, select: { id: true } });
      if (!job) throw new BadRequestException('Invalid jobId');
    }
    if (dto.vehicleId) {
      const v = await this.prisma.vehicle.findUnique({ where: { id: dto.vehicleId }, select: { id: true } });
      if (!v) throw new BadRequestException('Invalid vehicleId');
    }
    if (dto.equipmentId) {
      const e = await this.prisma.equipment.findUnique({ where: { id: dto.equipmentId }, select: { id: true } });
      if (!e) throw new BadRequestException('Invalid equipmentId');
    }
    if (dto.employeeId) {
      const emp = await this.prisma.employee.findUnique({ where: { id: dto.employeeId }, select: { id: true } });
      if (!emp) throw new BadRequestException('Invalid employeeId');
    }
  }

  private validateFile(file: UploadedFileLike) {
    if (file.size > MAX_FILE_BYTES) {
      throw new BadRequestException('Receipt exceeds the 10 MB limit');
    }
    const allowed =
      ALLOWED_MIME_TYPES.includes(file.mimetype) ||
      ALLOWED_MIME_PREFIXES.some((prefix) => file.mimetype.startsWith(prefix));
    if (!allowed) {
      throw new BadRequestException(`Unsupported file type: ${file.mimetype}`);
    }
  }

  private audit(
    user: AuthenticatedUser,
    action: AuditAction,
    entityId: string,
    ipAddress?: string,
    comment?: string,
  ) {
    return this.auditLogService.record({
      userId: user.id,
      action,
      entityType: 'Expense',
      entityId,
      ipAddress,
      comment,
    });
  }
}
