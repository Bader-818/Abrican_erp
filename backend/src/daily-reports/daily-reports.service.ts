import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ApprovalStatus, AuditAction, Prisma } from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service';
import { paginate } from '../common/helpers/pagination.helper';
import { AuthenticatedUser } from '../common/types/authenticated-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDailyReportDto } from './dto/create-daily-report.dto';
import { DailyReportsQueryDto } from './dto/daily-reports-query.dto';
import { UpdateDailyReportDto } from './dto/update-daily-report.dto';

const LIST_SELECT = {
  id: true,
  reportDate: true,
  workPerformed: true,
  progressPct: true,
  approvalStatus: true,
  createdAt: true,
  job: { select: { id: true, jobCode: true, title: true } },
  supervisor: { select: { id: true, name: true } },
} satisfies Prisma.DailyReportSelect;

const DETAIL_SELECT = {
  ...LIST_SELECT,
  clientRep: true,
  weather: true,
  issues: true,
  materialsUsed: true,
  equipmentUsed: true,
  vehiclesUsed: true,
  rejectionReason: true,
  approvedAt: true,
  updatedAt: true,
  approvedBy: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.DailyReportSelect;

// Statuses in which the record is still editable/deletable by its owner.
const EDITABLE: ApprovalStatus[] = [ApprovalStatus.DRAFT, ApprovalStatus.REJECTED];

@Injectable()
export class DailyReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async findAll(query: DailyReportsQueryDto) {
    const where: Prisma.DailyReportWhereInput = {
      ...(query.jobId ? { jobId: query.jobId } : {}),
      ...(query.supervisorId ? { supervisorId: query.supervisorId } : {}),
      ...(query.approvalStatus ? { approvalStatus: query.approvalStatus } : {}),
      ...(query.from || query.to
        ? {
            reportDate: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };
    return paginate(this.prisma.dailyReport, query, {
      where,
      orderBy: { reportDate: 'desc' },
      select: LIST_SELECT,
    });
  }

  async findOne(id: string) {
    const report = await this.prisma.dailyReport.findUnique({ where: { id }, select: DETAIL_SELECT });
    if (!report) throw new NotFoundException('Daily report not found');
    return report;
  }

  async create(dto: CreateDailyReportDto, user: AuthenticatedUser, ipAddress?: string) {
    await this.assertJob(dto.jobId);
    if (dto.supervisorId) await this.assertEmployee(dto.supervisorId);

    const created = await this.prisma.dailyReport.create({
      data: {
        jobId: dto.jobId,
        reportDate: new Date(dto.reportDate),
        supervisorId: dto.supervisorId,
        workPerformed: dto.workPerformed,
        progressPct: dto.progressPct,
        clientRep: dto.clientRep,
        weather: dto.weather,
        issues: dto.issues,
        materialsUsed: dto.materialsUsed,
        equipmentUsed: dto.equipmentUsed,
        vehiclesUsed: dto.vehiclesUsed,
        createdById: user.id,
      },
      select: DETAIL_SELECT,
    });
    await this.audit(user, AuditAction.CREATE, created.id, ipAddress);
    return created;
  }

  async update(id: string, dto: UpdateDailyReportDto, user: AuthenticatedUser, ipAddress?: string) {
    const existing = await this.prisma.dailyReport.findUnique({
      where: { id },
      select: { approvalStatus: true },
    });
    if (!existing) throw new NotFoundException('Daily report not found');
    if (!EDITABLE.includes(existing.approvalStatus)) {
      throw new ConflictException('Only draft or rejected reports can be edited');
    }
    if (dto.supervisorId) await this.assertEmployee(dto.supervisorId);

    const updated = await this.prisma.dailyReport.update({
      where: { id },
      data: {
        ...(dto.reportDate ? { reportDate: new Date(dto.reportDate) } : {}),
        ...(dto.supervisorId !== undefined ? { supervisorId: dto.supervisorId } : {}),
        ...(dto.workPerformed !== undefined ? { workPerformed: dto.workPerformed } : {}),
        ...(dto.progressPct !== undefined ? { progressPct: dto.progressPct } : {}),
        ...(dto.clientRep !== undefined ? { clientRep: dto.clientRep } : {}),
        ...(dto.weather !== undefined ? { weather: dto.weather } : {}),
        ...(dto.issues !== undefined ? { issues: dto.issues } : {}),
        ...(dto.materialsUsed !== undefined ? { materialsUsed: dto.materialsUsed } : {}),
        ...(dto.equipmentUsed !== undefined ? { equipmentUsed: dto.equipmentUsed } : {}),
        ...(dto.vehiclesUsed !== undefined ? { vehiclesUsed: dto.vehiclesUsed } : {}),
      },
      select: DETAIL_SELECT,
    });
    await this.audit(user, AuditAction.UPDATE, id, ipAddress);
    return updated;
  }

  async remove(id: string, user: AuthenticatedUser, ipAddress?: string) {
    const existing = await this.prisma.dailyReport.findUnique({
      where: { id },
      select: { approvalStatus: true },
    });
    if (!existing) throw new NotFoundException('Daily report not found');
    if (!EDITABLE.includes(existing.approvalStatus)) {
      throw new ConflictException('Only draft or rejected reports can be deleted');
    }
    await this.prisma.dailyReport.delete({ where: { id } });
    await this.audit(user, AuditAction.DELETE, id, ipAddress);
    return { success: true };
  }

  /** DRAFT/REJECTED → SUBMITTED. */
  async submit(id: string, user: AuthenticatedUser, ipAddress?: string) {
    const existing = await this.prisma.dailyReport.findUnique({
      where: { id },
      select: { approvalStatus: true },
    });
    if (!existing) throw new NotFoundException('Daily report not found');
    if (!EDITABLE.includes(existing.approvalStatus)) {
      throw new ConflictException(`Cannot submit a report that is ${existing.approvalStatus}`);
    }
    const updated = await this.prisma.dailyReport.update({
      where: { id },
      data: { approvalStatus: ApprovalStatus.SUBMITTED, rejectionReason: null },
      select: DETAIL_SELECT,
    });
    await this.audit(user, AuditAction.UPDATE, id, ipAddress, 'Submitted for approval');
    return updated;
  }

  /** SUBMITTED → APPROVED. */
  async approve(id: string, user: AuthenticatedUser, ipAddress?: string) {
    await this.requireStatus(id, ApprovalStatus.SUBMITTED);
    const updated = await this.prisma.dailyReport.update({
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

  /** SUBMITTED → REJECTED. */
  async reject(id: string, reason: string | undefined, user: AuthenticatedUser, ipAddress?: string) {
    await this.requireStatus(id, ApprovalStatus.SUBMITTED);
    const updated = await this.prisma.dailyReport.update({
      where: { id },
      data: { approvalStatus: ApprovalStatus.REJECTED, rejectionReason: reason ?? null },
      select: DETAIL_SELECT,
    });
    await this.audit(user, AuditAction.REJECT, id, ipAddress, reason);
    return updated;
  }

  // --- helpers --------------------------------------------------------------

  private async requireStatus(id: string, status: ApprovalStatus) {
    const existing = await this.prisma.dailyReport.findUnique({
      where: { id },
      select: { approvalStatus: true },
    });
    if (!existing) throw new NotFoundException('Daily report not found');
    if (existing.approvalStatus !== status) {
      throw new ConflictException(`Report must be ${status} for this action (it is ${existing.approvalStatus})`);
    }
    return existing;
  }

  private async assertJob(jobId: string) {
    const job = await this.prisma.job.findUnique({ where: { id: jobId }, select: { id: true } });
    if (!job) throw new BadRequestException('Invalid jobId');
  }

  private async assertEmployee(id: string) {
    const e = await this.prisma.employee.findUnique({ where: { id }, select: { id: true } });
    if (!e) throw new BadRequestException('Invalid supervisorId');
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
      entityType: 'DailyReport',
      entityId,
      ipAddress,
      comment,
    });
  }
}
