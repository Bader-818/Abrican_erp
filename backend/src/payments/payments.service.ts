import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, InvoiceStatus, JobStatus, PaymentMethod, Prisma } from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service';
import { round2 } from '../common/finance/line-math';
import { paginate } from '../common/helpers/pagination.helper';
import { AuthenticatedUser } from '../common/types/authenticated-user.interface';
import { JobStatusService } from '../jobs/job-status.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentsQueryDto } from './dto/payments-query.dto';

const PAYMENT_SELECT = {
  id: true,
  invoiceId: true,
  clientId: true,
  paymentDate: true,
  amount: true,
  method: true,
  referenceNumber: true,
  notes: true,
  createdAt: true,
  invoice: { select: { id: true, invoiceNumber: true, totalAmount: true, outstandingAmount: true, status: true } },
  client: { select: { id: true, name: true } },
} satisfies Prisma.PaymentSelect;

export interface AgingBuckets {
  current: number; // 0–30 days past due (incl. not yet due)
  d31_60: number;
  d61_90: number;
  d90_plus: number;
}

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly jobStatusService: JobStatusService,
  ) {}

  async findAll(query: PaymentsQueryDto) {
    const where: Prisma.PaymentWhereInput = {
      ...(query.invoiceId ? { invoiceId: query.invoiceId } : {}),
      ...(query.clientId ? { clientId: query.clientId } : {}),
    };
    return paginate(this.prisma.payment, query, {
      where,
      orderBy: { paymentDate: 'desc' },
      select: PAYMENT_SELECT,
    });
  }

  async findOne(id: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id }, select: PAYMENT_SELECT });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    return payment;
  }

  /**
   * Record a full or partial payment against an issued invoice. Recomputes the
   * invoice's paid/outstanding amounts, flips it to PARTIALLY_PAID or PAID, and
   * advances the linked job's status — all atomically.
   */
  async create(dto: CreatePaymentDto, user: AuthenticatedUser, ipAddress?: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: dto.invoiceId },
      select: {
        id: true,
        invoiceNumber: true,
        clientId: true,
        jobId: true,
        status: true,
        totalAmount: true,
        paidAmount: true,
      },
    });
    if (!invoice) {
      throw new BadRequestException('Invalid invoiceId');
    }

    const payable: InvoiceStatus[] = [InvoiceStatus.SUBMITTED, InvoiceStatus.PARTIALLY_PAID];
    if (!payable.includes(invoice.status)) {
      throw new ConflictException(
        `Payments can only be recorded against a submitted invoice (it is ${invoice.status})`,
      );
    }

    const total = Number(invoice.totalAmount);
    const paidSoFar = Number(invoice.paidAmount);
    const outstanding = round2(total - paidSoFar);
    const amount = round2(dto.amount);
    if (amount > outstanding) {
      throw new BadRequestException(
        `Payment (${amount}) exceeds the outstanding balance (${outstanding})`,
      );
    }

    const newPaid = round2(paidSoFar + amount);
    const newOutstanding = round2(total - newPaid);
    const fullyPaid = newOutstanding <= 0;
    const newStatus = fullyPaid ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID;

    const payment = await this.prisma.$transaction(async (tx) => {
      // Update the invoice first so the payment's embedded invoice snapshot
      // (PAYMENT_SELECT) reflects the post-payment paid/outstanding/status.
      await tx.invoice.update({
        where: { id: invoice.id },
        data: { paidAmount: newPaid, outstandingAmount: newOutstanding, status: newStatus },
      });

      const created = await tx.payment.create({
        data: {
          invoiceId: invoice.id,
          clientId: invoice.clientId,
          paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
          amount,
          method: dto.method ?? PaymentMethod.BANK_TRANSFER,
          referenceNumber: dto.referenceNumber,
          notes: dto.notes,
          createdById: user.id,
        },
        select: PAYMENT_SELECT,
      });

      if (invoice.jobId) {
        await this.jobStatusService.applyFinanceStatus(
          invoice.jobId,
          fullyPaid ? JobStatus.PAID : JobStatus.PARTIALLY_PAID,
          user.id,
          `Payment recorded against ${invoice.invoiceNumber}`,
          tx,
        );
      }

      return created;
    });

    await this.auditLogService.record({
      userId: user.id,
      action: AuditAction.CREATE,
      entityType: 'Payment',
      entityId: payment.id,
      newValue: { invoiceNumber: invoice.invoiceNumber, amount, newStatus },
      ipAddress,
    });

    return payment;
  }

  /**
   * Receivables aging across all invoices with an outstanding balance, bucketed
   * by days past due (0–30 / 31–60 / 61–90 / 90+).
   */
  async aging() {
    const now = new Date();
    const invoices = await this.prisma.invoice.findMany({
      where: {
        outstandingAmount: { gt: 0 },
        status: { in: [InvoiceStatus.SUBMITTED, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE] },
      },
      select: {
        id: true,
        invoiceNumber: true,
        dueDate: true,
        outstandingAmount: true,
        status: true,
        client: { select: { id: true, name: true } },
      },
      orderBy: { dueDate: 'asc' },
    });

    const buckets: AgingBuckets = { current: 0, d31_60: 0, d61_90: 0, d90_plus: 0 };
    const rows = invoices.map((inv) => {
      const daysPastDue = Math.floor((now.getTime() - inv.dueDate.getTime()) / 86_400_000);
      const outstanding = Number(inv.outstandingAmount);
      const bucket = this.bucketFor(daysPastDue);
      buckets[bucket] = round2(buckets[bucket] + outstanding);
      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        client: inv.client,
        dueDate: inv.dueDate,
        outstandingAmount: outstanding,
        daysPastDue,
        bucket,
        status: inv.status,
      };
    });

    const totalOutstanding = round2(
      buckets.current + buckets.d31_60 + buckets.d61_90 + buckets.d90_plus,
    );

    return { asOf: now, buckets, totalOutstanding, invoices: rows };
  }

  private bucketFor(daysPastDue: number): keyof AgingBuckets {
    if (daysPastDue <= 30) return 'current';
    if (daysPastDue <= 60) return 'd31_60';
    if (daysPastDue <= 90) return 'd61_90';
    return 'd90_plus';
  }
}
