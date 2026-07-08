import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ApprovalStatus, AuditAction, Prisma } from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service';
import { paginate } from '../common/helpers/pagination.helper';
import { AuthenticatedUser } from '../common/types/authenticated-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTimesheetDto } from './dto/create-timesheet.dto';
import { TimesheetsQueryDto } from './dto/timesheets-query.dto';
import { UpdateTimesheetDto } from './dto/update-timesheet.dto';

const LIST_SELECT = {
  id: true,
  workDate: true,
  regularHours: true,
  overtimeHours: true,
  standbyHours: true,
  travelHours: true,
  approvalStatus: true,
  createdAt: true,
  job: { select: { id: true, jobCode: true, title: true } },
  employee: { select: { id: true, name: true } },
  crew: { select: { id: true, name: true } },
} satisfies Prisma.TimesheetSelect;

const DETAIL_SELECT = {
  ...LIST_SELECT,
  notes: true,
  rejectionReason: true,
  approvedAt: true,
  updatedAt: true,
  approvedBy: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.TimesheetSelect;

const EDITABLE: ApprovalStatus[] = [ApprovalStatus.DRAFT, ApprovalStatus.REJECTED];

@Injectable()
export class TimesheetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async findAll(query: TimesheetsQueryDto) {
    const where: Prisma.TimesheetWhereInput = {
      ...(query.jobId ? { jobId: query.jobId } : {}),
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.crewId ? { crewId: query.crewId } : {}),
      ...(query.approvalStatus ? { approvalStatus: query.approvalStatus } : {}),
      ...(query.from || query.to
        ? {
            workDate: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };
    return paginate(this.prisma.timesheet, query, {
      where,
      orderBy: { workDate: 'desc' },
      select: LIST_SELECT,
    });
  }

  async findOne(id: string) {
    const ts = await this.prisma.timesheet.findUnique({ where: { id }, select: DETAIL_SELECT });
    if (!ts) throw new NotFoundException('Timesheet not found');
    return ts;
  }

  async create(dto: CreateTimesheetDto, user: AuthenticatedUser, ipAddress?: string) {
    await this.assertJob(dto.jobId);
    await this.assertResource(dto.employeeId, dto.crewId);
    this.assertHours(dto);

    const created = await this.prisma.timesheet.create({
      data: {
        jobId: dto.jobId,
        employeeId: dto.employeeId,
        crewId: dto.crewId,
        workDate: new Date(dto.workDate),
        regularHours: dto.regularHours ?? 0,
        overtimeHours: dto.overtimeHours ?? 0,
        standbyHours: dto.standbyHours ?? 0,
        travelHours: dto.travelHours ?? 0,
        notes: dto.notes,
        createdById: user.id,
      },
      select: DETAIL_SELECT,
    });
    await this.audit(user, AuditAction.CREATE, created.id, ipAddress);
    return created;
  }

  async update(id: string, dto: UpdateTimesheetDto, user: AuthenticatedUser, ipAddress?: string) {
    const existing = await this.prisma.timesheet.findUnique({
      where: { id },
      select: {
        approvalStatus: true,
        regularHours: true,
        overtimeHours: true,
        standbyHours: true,
        travelHours: true,
      },
    });
    if (!existing) throw new NotFoundException('Timesheet not found');
    if (!EDITABLE.includes(existing.approvalStatus)) {
      throw new ConflictException('Only draft or rejected timesheets can be edited');
    }

    // A timesheet must still carry hours after the edit (matches create).
    const merged =
      (dto.regularHours ?? Number(existing.regularHours)) +
      (dto.overtimeHours ?? Number(existing.overtimeHours)) +
      (dto.standbyHours ?? Number(existing.standbyHours)) +
      (dto.travelHours ?? Number(existing.travelHours));
    if (merged <= 0) {
      throw new BadRequestException('A timesheet must have at least some hours');
    }

    const updated = await this.prisma.timesheet.update({
      where: { id },
      data: {
        ...(dto.workDate ? { workDate: new Date(dto.workDate) } : {}),
        ...(dto.regularHours !== undefined ? { regularHours: dto.regularHours } : {}),
        ...(dto.overtimeHours !== undefined ? { overtimeHours: dto.overtimeHours } : {}),
        ...(dto.standbyHours !== undefined ? { standbyHours: dto.standbyHours } : {}),
        ...(dto.travelHours !== undefined ? { travelHours: dto.travelHours } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
      select: DETAIL_SELECT,
    });
    await this.audit(user, AuditAction.UPDATE, id, ipAddress);
    return updated;
  }

  async remove(id: string, user: AuthenticatedUser, ipAddress?: string) {
    const existing = await this.prisma.timesheet.findUnique({
      where: { id },
      select: { approvalStatus: true },
    });
    if (!existing) throw new NotFoundException('Timesheet not found');
    if (!EDITABLE.includes(existing.approvalStatus)) {
      throw new ConflictException('Only draft or rejected timesheets can be deleted');
    }
    await this.prisma.timesheet.delete({ where: { id } });
    await this.audit(user, AuditAction.DELETE, id, ipAddress);
    return { success: true };
  }

  async submit(id: string, user: AuthenticatedUser, ipAddress?: string) {
    const existing = await this.prisma.timesheet.findUnique({
      where: { id },
      select: { approvalStatus: true },
    });
    if (!existing) throw new NotFoundException('Timesheet not found');
    if (!EDITABLE.includes(existing.approvalStatus)) {
      throw new ConflictException(`Cannot submit a timesheet that is ${existing.approvalStatus}`);
    }
    const updated = await this.prisma.timesheet.update({
      where: { id },
      data: { approvalStatus: ApprovalStatus.SUBMITTED, rejectionReason: null },
      select: DETAIL_SELECT,
    });
    await this.audit(user, AuditAction.UPDATE, id, ipAddress, 'Submitted for approval');
    return updated;
  }

  async approve(id: string, user: AuthenticatedUser, ipAddress?: string) {
    const existing = await this.requireStatus(id, ApprovalStatus.SUBMITTED);
    this.assertNotSelf(existing.createdById, user, 'approve');
    const updated = await this.prisma.timesheet.update({
      where: { id },
      data: {
        approvalStatus: ApprovalStatus.APPROVED,
        approvedById: user.id,
        approvedAt: new Date(),
      },
      select: DETAIL_SELECT,
    });
    await this.audit(user, AuditAction.APPROVE, id, ipAddress);
    return updated;
  }

  async reject(id: string, reason: string | undefined, user: AuthenticatedUser, ipAddress?: string) {
    const existing = await this.requireStatus(id, ApprovalStatus.SUBMITTED);
    this.assertNotSelf(existing.createdById, user, 'reject');
    const updated = await this.prisma.timesheet.update({
      where: { id },
      data: { approvalStatus: ApprovalStatus.REJECTED, rejectionReason: reason ?? null },
      select: DETAIL_SELECT,
    });
    await this.audit(user, AuditAction.REJECT, id, ipAddress, reason);
    return updated;
  }

  // --- helpers --------------------------------------------------------------

  private async requireStatus(id: string, status: ApprovalStatus) {
    const existing = await this.prisma.timesheet.findUnique({
      where: { id },
      select: { approvalStatus: true, createdById: true },
    });
    if (!existing) throw new NotFoundException('Timesheet not found');
    if (existing.approvalStatus !== status) {
      throw new ConflictException(`Timesheet must be ${status} for this action (it is ${existing.approvalStatus})`);
    }
    return existing;
  }

  private assertNotSelf(createdById: string, user: AuthenticatedUser, action: string) {
    // Separation of duties (SRS 168): nobody actions their own timesheet.
    if (createdById === user.id) {
      throw new ForbiddenException(`You cannot ${action} a timesheet you created`);
    }
  }

  private assertHours(dto: CreateTimesheetDto) {
    const total =
      (dto.regularHours ?? 0) + (dto.overtimeHours ?? 0) + (dto.standbyHours ?? 0) + (dto.travelHours ?? 0);
    if (total <= 0) {
      throw new BadRequestException('Enter at least some hours');
    }
  }

  private async assertResource(employeeId?: string, crewId?: string) {
    if ((employeeId && crewId) || (!employeeId && !crewId)) {
      throw new BadRequestException('Provide exactly one of employeeId or crewId');
    }
    if (employeeId) {
      const e = await this.prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true } });
      if (!e) throw new BadRequestException('Invalid employeeId');
    } else if (crewId) {
      const c = await this.prisma.crew.findUnique({ where: { id: crewId }, select: { id: true } });
      if (!c) throw new BadRequestException('Invalid crewId');
    }
  }

  private async assertJob(jobId: string) {
    const job = await this.prisma.job.findUnique({ where: { id: jobId }, select: { id: true } });
    if (!job) throw new BadRequestException('Invalid jobId');
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
      entityType: 'Timesheet',
      entityId,
      ipAddress,
      comment,
    });
  }
}
