import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ApprovalStatus,
  AssignmentStatus,
  AuditAction,
  InvoiceStatus,
  JobStatus,
  ResourceType,
} from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service';
import { round2 } from '../common/finance/line-math';
import { AuthenticatedUser } from '../common/types/authenticated-user.interface';
import { FinanceAlertsService } from '../finance-alerts/finance-alerts.service';
import { JobStatusService } from '../jobs/job-status.service';
import { PrismaService } from '../prisma/prisma.service';
import { OVERTIME_MULTIPLIER, STANDBY_MULTIPLIER, TRAVEL_MULTIPLIER } from './costing.constants';

/** A job's actual cost breakdown and resulting profitability (S12). */
export interface JobCostBreakdown {
  jobId: string;
  status: JobStatus;
  labourCost: number;
  vehicleCost: number;
  equipmentCost: number;
  expensesByCategory: Record<string, number>;
  expensesTotal: number;
  actualCost: number;
  revenue: number;
  revenueBasis: 'INVOICED' | 'JOB_VALUE' | 'NONE';
  grossProfit: number;
  grossMarginPct: number | null;
  costBudget: number | null;
  costVariance: number | null;
  costReviewedAt: Date | null;
  /** Non-fatal data gaps (e.g. resources with no cost rate) surfaced to the user. */
  warnings: string[];
}

// A job must have reached at least COMPLETED before its cost can be reviewed.
const REVIEWABLE_STATUSES: JobStatus[] = [JobStatus.COMPLETED, JobStatus.COSTING_REVIEW];

@Injectable()
export class CostingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly jobStatusService: JobStatusService,
    private readonly financeAlerts: FinanceAlertsService,
  ) {}

  /**
   * Compute (without persisting) a job's actual cost and profitability:
   *  - labour  = approved timesheet hours × rate (employee costRate, or the sum
   *              of a crew's active members' costRates), overtime weighted;
   *  - vehicle/equipment = non-cancelled assignment actualHours × resource costRate;
   *  - expenses = POSTED expenses allocated to the job, grouped by category.
   * Revenue is the ex-VAT invoiced subtotal if the job has been invoiced,
   * otherwise the quoted jobValue.
   */
  async computeCost(jobId: string): Promise<JobCostBreakdown> {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true, status: true, jobValue: true, costBudget: true, costReviewedAt: true },
    });
    if (!job) {
      throw new NotFoundException('Job not found');
    }

    const warnings: string[] = [];
    const labourCost = await this.labourCost(jobId, warnings);
    const { vehicleCost, equipmentCost } = await this.resourceCost(jobId, warnings);
    const { expensesByCategory, expensesTotal } = await this.expenseCost(jobId);

    const actualCost = round2(labourCost + vehicleCost + equipmentCost + expensesTotal);

    const { revenue, revenueBasis } = await this.revenue(jobId, job.jobValue);
    const grossProfit = round2(revenue - actualCost);
    const grossMarginPct = revenue > 0 ? round2((grossProfit / revenue) * 100) : null;
    const costBudget = job.costBudget != null ? Number(job.costBudget) : null;
    const costVariance = costBudget != null ? round2(actualCost - costBudget) : null;

    return {
      jobId: job.id,
      status: job.status,
      labourCost,
      vehicleCost,
      equipmentCost,
      expensesByCategory,
      expensesTotal,
      actualCost,
      revenue,
      revenueBasis,
      grossProfit,
      grossMarginPct,
      costBudget,
      costVariance,
      costReviewedAt: job.costReviewedAt,
      warnings,
    };
  }

  /**
   * Run the cost review: persist the computed cost/profit onto the job, stamp who
   * reviewed it, and advance COMPLETED → COSTING_REVIEW (a recompute while already
   * in COSTING_REVIEW just refreshes the figures).
   */
  async review(jobId: string, user: AuthenticatedUser, ipAddress?: string): Promise<JobCostBreakdown> {
    const breakdown = await this.computeCost(jobId);
    if (!REVIEWABLE_STATUSES.includes(breakdown.status)) {
      throw new BadRequestException(
        `Cost review is only available for a COMPLETED job (it is ${breakdown.status})`,
      );
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.job.update({
        where: { id: jobId },
        data: {
          actualCost: breakdown.actualCost,
          grossProfit: breakdown.grossProfit,
          grossMarginPct: breakdown.grossMarginPct,
          costReviewedAt: now,
          costReviewedById: user.id,
        },
      });
      // COMPLETED → COSTING_REVIEW (forward-only; a no-op if already reviewing).
      if (breakdown.status === JobStatus.COMPLETED) {
        await this.jobStatusService.applyFinanceStatus(
          jobId,
          JobStatus.COSTING_REVIEW,
          user.id,
          'Cost review completed',
          tx,
        );
      }
    });

    await this.auditLogService.record({
      userId: user.id,
      action: AuditAction.UPDATE,
      entityType: 'Job',
      entityId: jobId,
      newValue: {
        actualCost: breakdown.actualCost,
        grossProfit: breakdown.grossProfit,
        grossMarginPct: breakdown.grossMarginPct,
      },
      ipAddress,
      comment: 'Job cost review',
    });

    // Best-effort over-budget / thin-margin alerts (never blocks the review).
    const job = await this.prisma.job.findUnique({ where: { id: jobId }, select: { jobCode: true } });
    await this.financeAlerts.afterCostReview(jobId, {
      jobCode: job?.jobCode ?? jobId,
      actualCost: breakdown.actualCost,
      costBudget: breakdown.costBudget,
      grossMarginPct: breakdown.grossMarginPct,
    });

    return {
      ...breakdown,
      status: breakdown.status === JobStatus.COMPLETED ? JobStatus.COSTING_REVIEW : breakdown.status,
      costReviewedAt: now,
    };
  }

  /** COSTING_REVIEW → READY_FOR_INVOICE (requires a completed cost review). */
  async markReadyForInvoice(jobId: string, user: AuthenticatedUser): Promise<JobCostBreakdown> {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: { status: true, costReviewedAt: true },
    });
    if (!job) {
      throw new NotFoundException('Job not found');
    }
    if (job.status !== JobStatus.COSTING_REVIEW) {
      throw new BadRequestException(
        `Job must be in COSTING_REVIEW to mark ready for invoice (it is ${job.status})`,
      );
    }
    if (!job.costReviewedAt) {
      throw new BadRequestException('Run the cost review before marking the job ready for invoice');
    }

    await this.jobStatusService.applyFinanceStatus(
      jobId,
      JobStatus.READY_FOR_INVOICE,
      user.id,
      'Marked ready for invoice',
    );

    return this.computeCost(jobId);
  }

  // --- Cost components ---------------------------------------------------------

  private async labourCost(jobId: string, warnings: string[]): Promise<number> {
    const timesheets = await this.prisma.timesheet.findMany({
      where: { jobId, approvalStatus: ApprovalStatus.APPROVED },
      select: {
        regularHours: true,
        overtimeHours: true,
        standbyHours: true,
        travelHours: true,
        employeeId: true,
        crewId: true,
        employee: { select: { name: true, costRate: true } },
        crew: {
          select: {
            name: true,
            members: {
              where: { status: 'ACTIVE' },
              select: { employee: { select: { costRate: true } } },
            },
          },
        },
      },
    });

    let total = 0;
    for (const t of timesheets) {
      const weightedHours =
        Number(t.regularHours) +
        Number(t.overtimeHours) * OVERTIME_MULTIPLIER +
        Number(t.standbyHours) * STANDBY_MULTIPLIER +
        Number(t.travelHours) * TRAVEL_MULTIPLIER;
      if (weightedHours === 0) continue;

      let rate = 0;
      if (t.employeeId) {
        if (t.employee?.costRate != null) {
          rate = Number(t.employee.costRate);
        } else {
          warnings.push(`No cost rate for employee ${t.employee?.name ?? t.employeeId} — labour excluded`);
        }
      } else if (t.crewId) {
        const memberRates = t.crew?.members ?? [];
        rate = memberRates.reduce(
          (sum, m) => sum + (m.employee.costRate != null ? Number(m.employee.costRate) : 0),
          0,
        );
        if (rate === 0) {
          warnings.push(`No cost rates for crew ${t.crew?.name ?? t.crewId} — labour excluded`);
        }
      }
      total += weightedHours * rate;
    }
    return round2(total);
  }

  private async resourceCost(
    jobId: string,
    warnings: string[],
  ): Promise<{ vehicleCost: number; equipmentCost: number }> {
    const assignments = await this.prisma.jobAssignment.findMany({
      where: {
        jobId,
        status: { not: AssignmentStatus.CANCELLED },
        resourceType: { in: [ResourceType.VEHICLE, ResourceType.EQUIPMENT] },
      },
      select: {
        resourceType: true,
        actualHours: true,
        vehicle: { select: { plateNumber: true, costRate: true } },
        equipment: { select: { name: true, costRate: true } },
      },
    });

    let vehicleCost = 0;
    let equipmentCost = 0;
    for (const a of assignments) {
      const hours = a.actualHours != null ? Number(a.actualHours) : 0;
      if (hours === 0) continue;
      if (a.resourceType === ResourceType.VEHICLE) {
        if (a.vehicle?.costRate != null) {
          vehicleCost += hours * Number(a.vehicle.costRate);
        } else {
          warnings.push(`No cost rate for vehicle ${a.vehicle?.plateNumber ?? '?'} — cost excluded`);
        }
      } else if (a.resourceType === ResourceType.EQUIPMENT) {
        if (a.equipment?.costRate != null) {
          equipmentCost += hours * Number(a.equipment.costRate);
        } else {
          warnings.push(`No cost rate for equipment ${a.equipment?.name ?? '?'} — cost excluded`);
        }
      }
    }
    return { vehicleCost: round2(vehicleCost), equipmentCost: round2(equipmentCost) };
  }

  private async expenseCost(
    jobId: string,
  ): Promise<{ expensesByCategory: Record<string, number>; expensesTotal: number }> {
    const expenses = await this.prisma.expense.findMany({
      where: { jobId, approvalStatus: ApprovalStatus.POSTED },
      select: { category: true, totalAmount: true },
    });

    const expensesByCategory: Record<string, number> = {};
    let expensesTotal = 0;
    for (const e of expenses) {
      const amount = Number(e.totalAmount);
      expensesByCategory[e.category] = round2((expensesByCategory[e.category] ?? 0) + amount);
      expensesTotal = round2(expensesTotal + amount);
    }
    return { expensesByCategory, expensesTotal };
  }

  private async revenue(
    jobId: string,
    jobValue: unknown,
  ): Promise<{ revenue: number; revenueBasis: JobCostBreakdown['revenueBasis'] }> {
    // Ex-VAT selling value: invoiced subtotal (VAT is pass-through, not revenue).
    const issued = await this.prisma.invoice.aggregate({
      _sum: { subtotal: true },
      where: {
        jobId,
        status: {
          in: [
            InvoiceStatus.SUBMITTED,
            InvoiceStatus.PARTIALLY_PAID,
            InvoiceStatus.PAID,
            InvoiceStatus.OVERDUE,
          ],
        },
      },
    });
    const invoiced = issued._sum.subtotal != null ? Number(issued._sum.subtotal) : 0;
    if (invoiced > 0) {
      return { revenue: round2(invoiced), revenueBasis: 'INVOICED' };
    }
    if (jobValue != null) {
      return { revenue: round2(Number(jobValue)), revenueBasis: 'JOB_VALUE' };
    }
    return { revenue: 0, revenueBasis: 'NONE' };
  }
}
