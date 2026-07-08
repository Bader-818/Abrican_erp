import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InvoiceStatus, JobStatus, NotificationType } from '@prisma/client';
import { round2 } from '../common/finance/line-math';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  JOB_NOT_INVOICED_DAYS,
  MARGIN_TARGET_PCT,
  PO_CONSUMPTION_ALERT_PCT,
} from './finance-alerts.constants';

const ISSUED_INVOICE_STATUSES: InvoiceStatus[] = [
  InvoiceStatus.SUBMITTED,
  InvoiceStatus.PARTIALLY_PAID,
  InvoiceStatus.PAID,
  InvoiceStatus.OVERDUE,
];

// Invoices still awaiting payment (OVERDUE isn't set anywhere; past-due is derived).
const OPEN_INVOICE_STATUSES: InvoiceStatus[] = [
  InvoiceStatus.SUBMITTED,
  InvoiceStatus.PARTIALLY_PAID,
];

const UNBILLED_JOB_STATUSES: JobStatus[] = [
  JobStatus.COMPLETED,
  JobStatus.COSTING_REVIEW,
  JobStatus.READY_FOR_INVOICE,
];

function sar(value: number): string {
  return `SAR ${round2(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Raises critical finance notifications — some in response to events (invoice
 * issue, cost review), the rest from a daily sweep (overdue invoices, unbilled
 * completed work). All delivery is in-app via NotificationsService; alerts are
 * best-effort and must never block the triggering operation.
 */
@Injectable()
export class FinanceAlertsService {
  private readonly logger = new Logger(FinanceAlertsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** After an invoice is issued: warn if it pushed its PO over / near its limit. */
  async afterInvoiceIssued(invoiceId: string): Promise<void> {
    try {
      const invoice = await this.prisma.invoice.findUnique({
        where: { id: invoiceId },
        select: {
          invoiceNumber: true,
          purchaseOrder: { select: { id: true, poNumber: true, poValue: true, consumedAmount: true } },
        },
      });
      const po = invoice?.purchaseOrder;
      if (!po) return;
      const poValue = Number(po.poValue);
      if (poValue <= 0) return;
      const consumed = Number(po.consumedAmount);
      const pctConsumed = (consumed / poValue) * 100;

      if (consumed > poValue) {
        await this.notifications.notifyUsersWithPermission('invoices.view', {
          type: NotificationType.INVOICE_EXCEEDS_PO,
          title: `PO ${po.poNumber} over-consumed`,
          message: `Issuing invoice ${invoice!.invoiceNumber} pushed PO ${po.poNumber} to ${sar(consumed)} of ${sar(poValue)}.`,
          relatedEntityType: 'PurchaseOrder',
          relatedEntityId: po.id,
        });
      } else if (pctConsumed >= PO_CONSUMPTION_ALERT_PCT) {
        await this.notifications.notifyUsersWithPermission('invoices.view', {
          type: NotificationType.PO_NEARLY_CONSUMED,
          title: `PO ${po.poNumber} ${Math.round(pctConsumed)}% consumed`,
          message: `PO ${po.poNumber} is at ${sar(consumed)} of ${sar(poValue)} after invoice ${invoice!.invoiceNumber}.`,
          relatedEntityType: 'PurchaseOrder',
          relatedEntityId: po.id,
        });
      }
    } catch (error) {
      this.logger.warn(`afterInvoiceIssued alert failed for ${invoiceId}: ${String(error)}`);
    }
  }

  /** After a cost review: warn on over-budget cost or thin margin. */
  async afterCostReview(
    jobId: string,
    input: { jobCode: string; actualCost: number; costBudget: number | null; grossMarginPct: number | null },
  ): Promise<void> {
    try {
      if (input.costBudget != null && input.actualCost > input.costBudget) {
        await this.notifications.notifyUsersWithPermission('jobs.costing_view', {
          type: NotificationType.COST_OVER_BUDGET,
          title: `Job ${input.jobCode} over budget`,
          message: `Actual cost ${sar(input.actualCost)} exceeds the budget ${sar(input.costBudget)}.`,
          relatedEntityType: 'Job',
          relatedEntityId: jobId,
        });
      }
      if (input.grossMarginPct != null && input.grossMarginPct < MARGIN_TARGET_PCT) {
        await this.notifications.notifyUsersWithPermission('jobs.costing_view', {
          type: NotificationType.MARGIN_BELOW_TARGET,
          title: `Job ${input.jobCode} margin below target`,
          message: `Gross margin ${input.grossMarginPct.toFixed(1)}% is below the ${MARGIN_TARGET_PCT}% target.`,
          relatedEntityType: 'Job',
          relatedEntityId: jobId,
        });
      }
    } catch (error) {
      this.logger.warn(`afterCostReview alert failed for ${jobId}: ${String(error)}`);
    }
  }

  /** Daily sweep for time-based alerts (overdue invoices, unbilled completed work). */
  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async dailySweep(): Promise<void> {
    await this.checkOverdueInvoices();
    await this.checkUninvoicedCompletedJobs();
  }

  async checkOverdueInvoices(): Promise<void> {
    const now = new Date();
    const overdue = await this.prisma.invoice.findMany({
      where: {
        dueDate: { lt: now },
        outstandingAmount: { gt: 0 },
        status: { in: OPEN_INVOICE_STATUSES },
      },
      select: {
        id: true,
        invoiceNumber: true,
        dueDate: true,
        outstandingAmount: true,
        client: { select: { name: true } },
      },
    });

    for (const inv of overdue) {
      const days = Math.floor((now.getTime() - inv.dueDate.getTime()) / 86_400_000);
      await this.notifications.notifyUsersWithPermission('payments.view', {
        type: NotificationType.INVOICE_OVERDUE,
        title: `Invoice ${inv.invoiceNumber} overdue`,
        message: `${inv.invoiceNumber} for ${inv.client.name} is ${days} day(s) overdue — ${sar(Number(inv.outstandingAmount))} outstanding.`,
        relatedEntityType: 'Invoice',
        relatedEntityId: inv.id,
      });
    }
  }

  async checkUninvoicedCompletedJobs(): Promise<void> {
    const cutoff = new Date(Date.now() - JOB_NOT_INVOICED_DAYS * 86_400_000);
    const jobs = await this.prisma.job.findMany({
      where: {
        status: { in: UNBILLED_JOB_STATUSES },
        actualEndDate: { lt: cutoff },
        invoices: { none: { status: { in: ISSUED_INVOICE_STATUSES } } },
      },
      select: { id: true, jobCode: true, title: true },
    });

    for (const job of jobs) {
      await this.notifications.notifyUsersWithPermission('invoices.view', {
        type: NotificationType.JOB_NOT_INVOICED,
        title: `Job ${job.jobCode} not invoiced`,
        message: `${job.jobCode} (${job.title}) has been complete for over ${JOB_NOT_INVOICED_DAYS} days with no issued invoice.`,
        relatedEntityType: 'Job',
        relatedEntityId: job.id,
      });
    }
  }
}
