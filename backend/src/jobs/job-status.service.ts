import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AssignmentStatus, AuditAction, JobStatus, Prisma } from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuthenticatedUser } from '../common/types/authenticated-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { ChangeJobStatusDto } from './dto/change-job-status.dto';
import { ALLOWED_TRANSITIONS, isTransitionAllowed } from './job-status.constants';

/**
 * Forward-only ordering of the finance lifecycle, used by `applyFinanceStatus`.
 * COMPLETED is index 0 — a job must be at least completed to be billed.
 */
/**
 * When a job moves to one of these statuses, its resource bookings are carried
 * along so the Scheduling view stays in step with the job (a job can't be ACTIVE
 * while its bookings still read PLANNED). Only the listed source statuses move;
 * terminal ones (COMPLETED/CANCELLED) are left alone.
 */
const ASSIGNMENT_CASCADE: Partial<Record<JobStatus, { to: AssignmentStatus; from: AssignmentStatus[] }>> = {
  [JobStatus.ACTIVE]: { to: AssignmentStatus.ACTIVE, from: [AssignmentStatus.PLANNED] },
  [JobStatus.COMPLETED]: {
    to: AssignmentStatus.COMPLETED,
    from: [AssignmentStatus.PLANNED, AssignmentStatus.ACTIVE],
  },
  [JobStatus.CANCELLED]: {
    to: AssignmentStatus.CANCELLED,
    from: [AssignmentStatus.PLANNED, AssignmentStatus.ACTIVE],
  },
};

const FINANCE_ORDER: JobStatus[] = [
  JobStatus.COMPLETED,
  JobStatus.COSTING_REVIEW,
  JobStatus.READY_FOR_INVOICE,
  JobStatus.INVOICED,
  JobStatus.PARTIALLY_PAID,
  JobStatus.PAID,
  JobStatus.CLOSED,
];

@Injectable()
export class JobStatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async changeStatus(
    jobId: string,
    dto: ChangeJobStatusDto,
    user: AuthenticatedUser,
    ipAddress?: string,
  ) {
    const job = await this.prisma.job.findUnique({ where: { id: jobId } });
    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (job.status === dto.toStatus) {
      throw new BadRequestException(`Job is already ${dto.toStatus}`);
    }

    if (!isTransitionAllowed(job.status, dto.toStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${job.status} to ${dto.toStatus}. Allowed: ${
          ALLOWED_TRANSITIONS[job.status].join(', ') || 'none'
        }`,
      );
    }

    let overridden = false;
    if (dto.toStatus === JobStatus.ACTIVE) {
      const assignmentCount = await this.prisma.jobAssignment.count({
        where: { jobId, status: { not: 'CANCELLED' } },
      });
      if (assignmentCount === 0) {
        if (!dto.overrideReason) {
          throw new BadRequestException(
            'Job has no active resource assignments. Assign resources first, or supply an override reason.',
          );
        }
        if (!user.permissions.includes('jobs.status_override')) {
          throw new ForbiddenException('You do not have permission to override the assignment requirement');
        }
        overridden = true;
      }
    }

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.job.update({
        where: { id: jobId },
        data: {
          status: dto.toStatus,
          ...(dto.toStatus === JobStatus.ACTIVE && !job.actualStartDate
            ? { actualStartDate: now }
            : {}),
          ...(dto.toStatus === JobStatus.COMPLETED && !job.actualEndDate
            ? { actualEndDate: now }
            : {}),
        },
      });

      await tx.jobStatusHistory.create({
        data: {
          jobId,
          fromStatus: job.status,
          toStatus: dto.toStatus,
          changedById: user.id,
          reason: dto.overrideReason ?? dto.reason,
        },
      });

      // Carry the job's resource bookings along with the job status.
      const cascade = ASSIGNMENT_CASCADE[dto.toStatus];
      if (cascade) {
        await tx.jobAssignment.updateMany({
          where: { jobId, status: { in: cascade.from } },
          data: { status: cascade.to },
        });
      }

      return result;
    });

    await this.auditLogService.record({
      userId: user.id,
      action: overridden ? AuditAction.OVERRIDE : AuditAction.STATUS_CHANGE,
      entityType: 'Job',
      entityId: jobId,
      oldValue: { status: job.status },
      newValue: { status: dto.toStatus },
      ipAddress,
      comment: overridden
        ? `Activated without assignments. Override reason: ${dto.overrideReason}`
        : dto.reason,
    });

    return updated;
  }

  /**
   * Advance a job along the finance lifecycle in response to a system event
   * (invoice submitted, payment recorded). Unlike `changeStatus`, this is driven
   * by finance modules — not a user action — so it bypasses the assignment gate.
   *
   * It is **forward-only**: it never moves a job backward in the finance order
   * (a second payment on a PAID job is a no-op, not an error) and refuses jobs
   * that are CANCELLED or not yet COMPLETED. Runs inside the caller's
   * transaction when one is supplied so the status change commits atomically
   * with the invoice/payment write.
   */
  async applyFinanceStatus(
    jobId: string,
    toStatus: JobStatus,
    userId: string,
    reason: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    const job = await client.job.findUnique({ where: { id: jobId }, select: { status: true } });
    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (job.status === JobStatus.CANCELLED) {
      throw new BadRequestException('Cannot bill or pay a cancelled job');
    }

    const fromIdx = FINANCE_ORDER.indexOf(job.status);
    const toIdx = FINANCE_ORDER.indexOf(toStatus);
    if (toIdx < 0) {
      throw new BadRequestException(`${toStatus} is not a finance status`);
    }
    // A job must reach COMPLETED before any finance status applies.
    if (fromIdx < 0) {
      throw new BadRequestException('Job must be COMPLETED before it can be invoiced or paid');
    }
    // Forward-only: ignore no-op / backward moves silently.
    if (toIdx <= fromIdx) {
      return;
    }

    await client.job.update({ where: { id: jobId }, data: { status: toStatus } });
    await client.jobStatusHistory.create({
      data: { jobId, fromStatus: job.status, toStatus, changedById: userId, reason },
    });
    await this.auditLogService.record({
      userId,
      action: AuditAction.STATUS_CHANGE,
      entityType: 'Job',
      entityId: jobId,
      oldValue: { status: job.status },
      newValue: { status: toStatus },
      comment: reason,
    });
  }
}
