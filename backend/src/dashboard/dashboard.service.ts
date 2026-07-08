import { Injectable } from '@nestjs/common';
import { ApprovalStatus, InvoiceStatus, JobStatus } from '@prisma/client';
import { AssignmentsService } from '../assignments/assignments.service';
import { round2 } from '../common/finance/line-math';
import { PaymentsService } from '../payments/payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardFinanceQueryDto } from './dto/dashboard-finance-query.dto';

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Job statuses considered "in progress" operationally.
const ACTIVE_JOB_STATUSES: JobStatus[] = [
  JobStatus.APPROVED,
  JobStatus.SCHEDULED,
  JobStatus.ACTIVE,
  JobStatus.ON_HOLD,
];

// Invoices that count as issued revenue (past DRAFT/approval, not cancelled).
const ISSUED_INVOICE_STATUSES: InvoiceStatus[] = [
  InvoiceStatus.SUBMITTED,
  InvoiceStatus.PARTIALLY_PAID,
  InvoiceStatus.PAID,
  InvoiceStatus.OVERDUE,
];

// Completed work that has not yet been billed.
const UNBILLED_JOB_STATUSES: JobStatus[] = [
  JobStatus.COMPLETED,
  JobStatus.COSTING_REVIEW,
  JobStatus.READY_FOR_INVOICE,
];

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assignments: AssignmentsService,
    private readonly payments: PaymentsService,
  ) {}

  async operations() {
    const now = new Date();
    const in30 = daysFromNow(30);
    const in60 = daysFromNow(60);

    const [
      jobsByStatusRaw,
      activeJobs,
      upcomingJobs,
      assignmentsByStatusRaw,
      contractsNearExpiry,
      posNearExpiry,
      recentJobs,
      utilization,
    ] = await Promise.all([
      this.prisma.job.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.job.count({ where: { status: { in: ACTIVE_JOB_STATUSES } } }),
      this.prisma.job.count({
        where: { plannedStartDate: { gte: now, lte: in30 }, status: { notIn: [JobStatus.CANCELLED] } },
      }),
      this.prisma.jobAssignment.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.contract.count({
        where: { status: 'ACTIVE', endDate: { gte: now, lte: in60 } },
      }),
      this.prisma.purchaseOrder.count({
        where: { status: 'ACTIVE', expiryDate: { gte: now, lte: in60 } },
      }),
      this.prisma.job.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          jobCode: true,
          title: true,
          status: true,
          plannedStartDate: true,
          client: { select: { id: true, name: true } },
        },
      }),
      // Resource load over the next two weeks (reuses the assignments engine).
      this.assignments.utilization({ from: isoDate(now), to: isoDate(daysFromNow(14)) }),
    ]);

    return {
      jobsByStatus: this.toCountMap(jobsByStatusRaw),
      activeJobs,
      upcomingJobs,
      assignmentsByStatus: this.toCountMap(assignmentsByStatusRaw),
      contractsNearExpiry,
      posNearExpiry,
      recentJobs,
      topUtilization: utilization.resources.slice(0, 5),
    };
  }

  async assets() {
    const now = new Date();

    const [
      employees,
      employeesByAvailability,
      crews,
      vehicles,
      vehiclesByStatus,
      equipment,
      equipmentByStatus,
      docTotal,
      docExpired,
      docExpiring30,
      docExpiring60,
      docExpiring90,
      docNoExpiry,
      expiringSoon,
    ] = await Promise.all([
      this.prisma.employee.count(),
      this.prisma.employee.groupBy({ by: ['availabilityStatus'], _count: { _all: true } }),
      this.prisma.crew.count(),
      this.prisma.vehicle.count(),
      this.prisma.vehicle.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.equipment.count(),
      this.prisma.equipment.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.document.count(),
      this.prisma.document.count({ where: { expiryDate: { not: null, lt: now } } }),
      this.prisma.document.count({
        where: { expiryDate: { gte: now, lte: daysFromNow(30) } },
      }),
      this.prisma.document.count({
        where: { expiryDate: { gt: daysFromNow(30), lte: daysFromNow(60) } },
      }),
      this.prisma.document.count({
        where: { expiryDate: { gt: daysFromNow(60), lte: daysFromNow(90) } },
      }),
      this.prisma.document.count({ where: { expiryDate: null } }),
      this.prisma.document.findMany({
        where: { expiryDate: { not: null, lte: daysFromNow(90) } },
        orderBy: { expiryDate: 'asc' },
        take: 10,
        select: {
          id: true,
          documentType: true,
          relatedEntityType: true,
          expiryDate: true,
          employee: { select: { name: true } },
          vehicle: { select: { plateNumber: true } },
          equipment: { select: { name: true } },
          contract: { select: { contractNumber: true } },
          client: { select: { name: true } },
        },
      }),
    ]);

    return {
      resourceCounts: { employees, crews, vehicles, equipment },
      employeesByAvailability: this.toCountMap(employeesByAvailability, 'availabilityStatus'),
      vehiclesByStatus: this.toCountMap(vehiclesByStatus),
      equipmentByStatus: this.toCountMap(equipmentByStatus),
      documentExpiry: {
        total: docTotal,
        expired: docExpired,
        expiring30: docExpiring30,
        expiring60: docExpiring60,
        expiring90: docExpiring90,
        noExpiry: docNoExpiry,
        valid:
          docTotal - docExpired - docExpiring30 - docExpiring60 - docExpiring90 - docNoExpiry,
      },
      expiringSoon: expiringSoon.map((d) => ({
        id: d.id,
        documentType: d.documentType,
        relatedEntityType: d.relatedEntityType,
        expiryDate: d.expiryDate,
        record:
          d.employee?.name ??
          d.vehicle?.plateNumber ??
          d.equipment?.name ??
          d.contract?.contractNumber ??
          d.client?.name ??
          'Company-wide',
      })),
    };
  }

  /**
   * Finance KPIs for a reporting window (defaults to the current month): billed
   * revenue and output VAT, cash collected, receivables/overdue (via the aging
   * report), realised gross profit on cost-reviewed jobs, posted expenses by
   * category and input VAT, net VAT, unbilled completed work, and the invoice
   * status pipeline.
   */
  async finance(query: DashboardFinanceQueryDto) {
    const now = new Date();
    const from = query.from ? new Date(query.from) : startOfMonth(now);
    const to = query.to ? new Date(query.to) : now;
    const inRange = { gte: from, lte: to };

    const [invoiced, collected, aging, profit, postedExpenses, unbilled, invoicesByStatusRaw] =
      await Promise.all([
        this.prisma.invoice.aggregate({
          _sum: { totalAmount: true, subtotal: true, vatAmount: true },
          where: { status: { in: ISSUED_INVOICE_STATUSES }, invoiceDate: inRange },
        }),
        this.prisma.payment.aggregate({ _sum: { amount: true }, where: { paymentDate: inRange } }),
        this.payments.aging(),
        this.prisma.job.aggregate({
          _sum: { grossProfit: true },
          _avg: { grossMarginPct: true },
          _count: { _all: true },
          where: { costReviewedAt: inRange },
        }),
        this.prisma.expense.findMany({
          where: { approvalStatus: ApprovalStatus.POSTED, postedAt: inRange },
          select: { category: true, totalAmount: true, vatAmount: true },
        }),
        this.prisma.job.aggregate({
          _sum: { jobValue: true },
          _count: { _all: true },
          where: { status: { in: UNBILLED_JOB_STATUSES }, invoices: { none: {} } },
        }),
        this.prisma.invoice.groupBy({ by: ['status'], _count: { _all: true } }),
      ]);

    const outputVat = round2(Number(invoiced._sum.vatAmount ?? 0));
    const expensesByCategory: Record<string, number> = {};
    let expensesTotal = 0;
    let inputVat = 0;
    for (const e of postedExpenses) {
      const amount = Number(e.totalAmount);
      expensesByCategory[e.category] = round2((expensesByCategory[e.category] ?? 0) + amount);
      expensesTotal = round2(expensesTotal + amount);
      inputVat = round2(inputVat + Number(e.vatAmount));
    }

    const overdueAmount = round2(
      aging.invoices
        .filter((i) => i.daysPastDue > 0)
        .reduce((sum, i) => sum + i.outstandingAmount, 0),
    );

    return {
      range: { from, to },
      revenue: {
        invoicedTotal: round2(Number(invoiced._sum.totalAmount ?? 0)),
        invoicedSubtotal: round2(Number(invoiced._sum.subtotal ?? 0)),
        outputVat,
        collected: round2(Number(collected._sum.amount ?? 0)),
      },
      receivables: {
        totalOutstanding: aging.totalOutstanding,
        overdueAmount,
        aging: aging.buckets,
      },
      profit: {
        jobsReviewed: profit._count._all,
        grossProfit: round2(Number(profit._sum.grossProfit ?? 0)),
        avgMarginPct: profit._avg.grossMarginPct != null ? round2(Number(profit._avg.grossMarginPct)) : null,
      },
      expenses: { total: expensesTotal, inputVat, byCategory: expensesByCategory },
      vat: { output: outputVat, input: inputVat, net: round2(outputVat - inputVat) },
      unbilled: {
        count: unbilled._count._all,
        value: round2(Number(unbilled._sum.jobValue ?? 0)),
      },
      invoicesByStatus: this.toCountMap(invoicesByStatusRaw),
    };
  }

  private toCountMap<T extends Record<string, unknown>>(
    rows: T[],
    key: keyof T = 'status' as keyof T,
  ): Record<string, number> {
    const map: Record<string, number> = {};
    for (const row of rows) {
      const k = String(row[key]);
      const count = (row as { _count?: { _all?: number } })._count?._all ?? 0;
      map[k] = count;
    }
    return map;
  }
}
