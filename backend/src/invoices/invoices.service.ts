import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  BillingUnit,
  EstimateStatus,
  InvoiceStatus,
  JobStatus,
  LineKind,
  Prisma,
} from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service';
import { computeLine, round2, sumTotals } from '../common/finance/line-math';
import { paginate } from '../common/helpers/pagination.helper';
import { AuthenticatedUser } from '../common/types/authenticated-user.interface';
import { JobStatusService } from '../jobs/job-status.service';
import { PdfService } from '../pdf/pdf.service';
import { mapUnitLabel } from '../pdf/unit-label';
import { PrismaService } from '../prisma/prisma.service';
import { IStorageService } from '../storage/storage.interface';
import { CreateInvoiceFromEstimateDto } from './dto/create-invoice-from-estimate.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { InvoiceLineDto } from './dto/invoice-line.dto';
import { InvoicesQueryDto } from './dto/invoices-query.dto';
import { IssueInvoiceDto } from './dto/issue-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';

const NUMBER_RETRIES = 3;
const DEFAULT_PAYMENT_TERMS_DAYS = 30;

const INVOICE_LIST_SELECT = {
  id: true,
  invoiceNumber: true,
  status: true,
  currency: true,
  invoiceDate: true,
  dueDate: true,
  totalAmount: true,
  paidAmount: true,
  outstandingAmount: true,
  jobId: true,
  createdAt: true,
  client: { select: { id: true, name: true } },
  job: { select: { id: true, jobCode: true } },
} satisfies Prisma.InvoiceSelect;

const INVOICE_DETAIL_SELECT = {
  ...INVOICE_LIST_SELECT,
  uuid: true,
  subtotal: true,
  vatAmount: true,
  clientVatNumber: true,
  billingAddress: true,
  servicePeriodFrom: true,
  servicePeriodTo: true,
  notes: true,
  zatcaStatus: true,
  pdfUrl: true,
  submittedAt: true,
  approvedAt: true,
  updatedAt: true,
  estimate: { select: { id: true, estimateNumber: true } },
  contract: { select: { id: true, contractNumber: true } },
  purchaseOrder: { select: { id: true, poNumber: true, poValue: true, consumedAmount: true } },
  job: { select: { id: true, jobCode: true, title: true, status: true } },
  createdBy: { select: { id: true, name: true } },
  approvedBy: { select: { id: true, name: true } },
  lineItems: {
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      sourceEstimateLineItemId: true,
      contractRateCardId: true,
      lineKind: true,
      description: true,
      quantity: true,
      hours: true,
      unit: true,
      unitPrice: true,
      vatRate: true,
      lineSubtotal: true,
      lineVat: true,
      lineTotal: true,
      sortOrder: true,
    },
  },
  payments: {
    orderBy: { paymentDate: 'desc' },
    select: {
      id: true,
      paymentDate: true,
      amount: true,
      method: true,
      referenceNumber: true,
      notes: true,
    },
  },
} satisfies Prisma.InvoiceSelect;

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly jobStatusService: JobStatusService,
    private readonly pdfService: PdfService,
    @Inject('IStorageService') private readonly storage: IStorageService,
  ) {}

  async findAll(query: InvoicesQueryDto) {
    const where: Prisma.InvoiceWhereInput = {
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...(query.jobId ? { jobId: query.jobId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.overdue
        ? {
            dueDate: { lt: new Date() },
            outstandingAmount: { gt: 0 },
            status: { notIn: [InvoiceStatus.PAID, InvoiceStatus.CANCELLED] },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { invoiceNumber: { contains: query.search, mode: 'insensitive' } },
              { client: { name: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    return paginate(this.prisma.invoice, query, {
      where,
      orderBy: { createdAt: 'desc' },
      select: INVOICE_LIST_SELECT,
    });
  }

  async findOne(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      select: INVOICE_DETAIL_SELECT,
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    return invoice;
  }

  async create(dto: CreateInvoiceDto, user: AuthenticatedUser, ipAddress?: string) {
    const client = await this.loadClientForInvoice(dto.clientId);
    await this.assertRelations(dto.clientId, dto.contractId, dto.purchaseOrderId, dto.jobId);

    const lines = this.buildLines(dto.items);
    const totals = sumTotals(lines);
    const invoiceDate = dto.invoiceDate ? new Date(dto.invoiceDate) : new Date();
    const dueDate = dto.dueDate
      ? new Date(dto.dueDate)
      : this.addDays(invoiceDate, client.paymentTermsDays ?? DEFAULT_PAYMENT_TERMS_DAYS);

    const created = await this.withNumber((invoiceNumber) =>
      this.prisma.invoice.create({
        data: {
          invoiceNumber,
          clientId: dto.clientId,
          contractId: dto.contractId,
          purchaseOrderId: dto.purchaseOrderId,
          jobId: dto.jobId,
          clientVatNumber: client.vatNumber,
          billingAddress: client.billingAddress,
          invoiceDate,
          dueDate,
          servicePeriodFrom: dto.servicePeriodFrom ? new Date(dto.servicePeriodFrom) : null,
          servicePeriodTo: dto.servicePeriodTo ? new Date(dto.servicePeriodTo) : null,
          notes: dto.notes,
          subtotal: totals.subtotal,
          vatAmount: totals.vatAmount,
          totalAmount: totals.totalAmount,
          outstandingAmount: totals.totalAmount,
          createdById: user.id,
          lineItems: { create: lines },
        },
        select: INVOICE_DETAIL_SELECT,
      }),
    );

    await this.audit(user, AuditAction.CREATE, created.id, {
      invoiceNumber: created.invoiceNumber,
      totalAmount: created.totalAmount,
    }, ipAddress);
    return created;
  }

  /** Seed an invoice from an approved/converted estimate (copies its lines). */
  async createFromEstimate(
    dto: CreateInvoiceFromEstimateDto,
    user: AuthenticatedUser,
    ipAddress?: string,
  ) {
    const estimate = await this.prisma.estimate.findUnique({
      where: { id: dto.estimateId },
      select: {
        id: true,
        status: true,
        clientId: true,
        contractId: true,
        jobId: true,
        lineItems: {
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            contractRateCardId: true,
            lineKind: true,
            description: true,
            quantity: true,
            hours: true,
            unit: true,
            unitPrice: true,
            vatRate: true,
          },
        },
      },
    });
    if (!estimate) {
      throw new NotFoundException('Estimate not found');
    }
    if (
      estimate.status !== EstimateStatus.APPROVED &&
      estimate.status !== EstimateStatus.CONVERTED
    ) {
      throw new ConflictException('Only an APPROVED or CONVERTED estimate can be invoiced');
    }

    const client = await this.loadClientForInvoice(estimate.clientId);
    if (dto.purchaseOrderId) {
      await this.assertRelations(estimate.clientId, estimate.contractId ?? undefined, dto.purchaseOrderId, undefined);
    }

    const lines = estimate.lineItems.map((l, index) => {
      const amounts = computeLine({
        quantity: Number(l.quantity),
        hours: Number(l.hours),
        unitPrice: Number(l.unitPrice),
        vatRate: Number(l.vatRate),
      });
      return {
        sourceEstimateLineItemId: l.id,
        contractRateCardId: l.contractRateCardId,
        lineKind: l.lineKind,
        description: l.description,
        quantity: Number(l.quantity),
        hours: Number(l.hours),
        unit: l.unit,
        unitPrice: Number(l.unitPrice),
        vatRate: Number(l.vatRate),
        lineSubtotal: amounts.lineSubtotal,
        lineVat: amounts.lineVat,
        lineTotal: amounts.lineTotal,
        sortOrder: index,
      };
    });
    const totals = sumTotals(lines);
    const invoiceDate = dto.invoiceDate ? new Date(dto.invoiceDate) : new Date();
    const dueDate = dto.dueDate
      ? new Date(dto.dueDate)
      : this.addDays(invoiceDate, client.paymentTermsDays ?? DEFAULT_PAYMENT_TERMS_DAYS);

    const created = await this.withNumber((invoiceNumber) =>
      this.prisma.invoice.create({
        data: {
          invoiceNumber,
          estimateId: estimate.id,
          clientId: estimate.clientId,
          contractId: estimate.contractId,
          purchaseOrderId: dto.purchaseOrderId,
          jobId: estimate.jobId,
          clientVatNumber: client.vatNumber,
          billingAddress: client.billingAddress,
          invoiceDate,
          dueDate,
          notes: null,
          subtotal: totals.subtotal,
          vatAmount: totals.vatAmount,
          totalAmount: totals.totalAmount,
          outstandingAmount: totals.totalAmount,
          createdById: user.id,
          lineItems: { create: lines },
        },
        select: INVOICE_DETAIL_SELECT,
      }),
    );

    await this.audit(user, AuditAction.CREATE, created.id, {
      invoiceNumber: created.invoiceNumber,
      fromEstimate: dto.estimateId,
      totalAmount: created.totalAmount,
    }, ipAddress);
    return created;
  }

  async update(id: string, dto: UpdateInvoiceDto, user: AuthenticatedUser, ipAddress?: string) {
    const existing = await this.prisma.invoice.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Invoice not found');
    }
    if (existing.status !== InvoiceStatus.DRAFT) {
      throw new ConflictException('Only DRAFT invoices can be edited');
    }
    if (dto.purchaseOrderId) {
      await this.assertRelations(existing.clientId, existing.contractId ?? undefined, dto.purchaseOrderId, undefined);
    }

    let totals: ReturnType<typeof sumTotals> | undefined;
    let lines: ReturnType<typeof this.buildLines> | undefined;
    if (dto.items) {
      lines = this.buildLines(dto.items);
      totals = sumTotals(lines);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.items) {
        await tx.invoiceLineItem.deleteMany({ where: { invoiceId: id } });
      }
      return tx.invoice.update({
        where: { id },
        data: {
          ...(dto.purchaseOrderId !== undefined ? { purchaseOrderId: dto.purchaseOrderId } : {}),
          ...(dto.invoiceDate ? { invoiceDate: new Date(dto.invoiceDate) } : {}),
          ...(dto.dueDate ? { dueDate: new Date(dto.dueDate) } : {}),
          ...(dto.servicePeriodFrom !== undefined
            ? { servicePeriodFrom: dto.servicePeriodFrom ? new Date(dto.servicePeriodFrom) : null }
            : {}),
          ...(dto.servicePeriodTo !== undefined
            ? { servicePeriodTo: dto.servicePeriodTo ? new Date(dto.servicePeriodTo) : null }
            : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
          ...(totals
            ? {
                subtotal: totals.subtotal,
                vatAmount: totals.vatAmount,
                totalAmount: totals.totalAmount,
                outstandingAmount: totals.totalAmount,
              }
            : {}),
          ...(lines ? { lineItems: { create: lines } } : {}),
        },
        select: INVOICE_DETAIL_SELECT,
      });
    });

    await this.audit(user, AuditAction.UPDATE, id, { totalAmount: updated.totalAmount }, ipAddress);
    return updated;
  }

  async remove(id: string, user: AuthenticatedUser, ipAddress?: string) {
    const existing = await this.prisma.invoice.findUnique({
      where: { id },
      select: { status: true, invoiceNumber: true },
    });
    if (!existing) {
      throw new NotFoundException('Invoice not found');
    }
    if (existing.status !== InvoiceStatus.DRAFT) {
      throw new ConflictException('Only DRAFT invoices can be deleted');
    }
    await this.prisma.invoice.delete({ where: { id } });
    await this.audit(user, AuditAction.DELETE, id, { invoiceNumber: existing.invoiceNumber }, ipAddress);
    return { success: true };
  }

  /** DRAFT → PENDING_APPROVAL. */
  async submitForApproval(id: string, user: AuthenticatedUser, ipAddress?: string) {
    return this.simpleTransition(id, InvoiceStatus.DRAFT, InvoiceStatus.PENDING_APPROVAL, AuditAction.UPDATE, user, ipAddress);
  }

  /** PENDING_APPROVAL → APPROVED. */
  async approve(id: string, user: AuthenticatedUser, ipAddress?: string) {
    return this.simpleTransition(
      id,
      InvoiceStatus.PENDING_APPROVAL,
      InvoiceStatus.APPROVED,
      AuditAction.APPROVE,
      user,
      ipAddress,
      { approvedBy: { connect: { id: user.id } }, approvedAt: new Date() },
    );
  }

  /** Cancel a pre-issue invoice (DRAFT / PENDING_APPROVAL / APPROVED). */
  async cancel(id: string, user: AuthenticatedUser, ipAddress?: string) {
    const existing = await this.prisma.invoice.findUnique({ where: { id }, select: { status: true } });
    if (!existing) {
      throw new NotFoundException('Invoice not found');
    }
    const cancellable: InvoiceStatus[] = [
      InvoiceStatus.DRAFT,
      InvoiceStatus.PENDING_APPROVAL,
      InvoiceStatus.APPROVED,
    ];
    if (!cancellable.includes(existing.status)) {
      throw new ConflictException('Only an invoice that has not been issued can be cancelled');
    }
    const updated = await this.prisma.invoice.update({
      where: { id },
      data: { status: InvoiceStatus.CANCELLED },
      select: INVOICE_DETAIL_SELECT,
    });
    await this.audit(user, AuditAction.STATUS_CHANGE, id, { status: InvoiceStatus.CANCELLED }, ipAddress);
    return updated;
  }

  /**
   * APPROVED → SUBMITTED: the legal issue step. Validates the client VAT number
   * and PO remaining balance, consumes the PO, advances the linked job to
   * INVOICED, and snapshots the PDF to storage. All in one transaction.
   */
  async issue(id: string, dto: IssueInvoiceDto, user: AuthenticatedUser, ipAddress?: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        purchaseOrder: { select: { id: true, poValue: true, consumedAmount: true } },
        _count: { select: { lineItems: true } },
      },
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    if (invoice.status !== InvoiceStatus.APPROVED) {
      throw new ConflictException(`Invoice must be APPROVED to issue (it is ${invoice.status})`);
    }
    if (invoice._count.lineItems === 0) {
      throw new BadRequestException('Cannot issue an invoice with no line items');
    }
    if (!invoice.clientVatNumber) {
      throw new BadRequestException(
        'Client VAT number is required to issue a tax invoice. Add it to the client record first.',
      );
    }

    // PO remaining-balance check (overridable).
    let poOverride = false;
    if (invoice.purchaseOrder) {
      const remaining = round2(
        Number(invoice.purchaseOrder.poValue) - Number(invoice.purchaseOrder.consumedAmount),
      );
      if (Number(invoice.totalAmount) > remaining) {
        if (!dto.overrideReason) {
          throw new ConflictException(
            `Invoice total (${invoice.totalAmount}) exceeds the remaining PO balance (${remaining}). Supply an overrideReason to issue anyway.`,
          );
        }
        if (!user.permissions.includes('invoices.approve')) {
          throw new ForbiddenException('You do not have permission to override the PO balance');
        }
        poOverride = true;
      }
    }

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.invoice.update({
        where: { id },
        data: { status: InvoiceStatus.SUBMITTED, submittedAt: now },
        select: INVOICE_DETAIL_SELECT,
      });

      if (invoice.purchaseOrderId) {
        await tx.purchaseOrder.update({
          where: { id: invoice.purchaseOrderId },
          data: { consumedAmount: { increment: invoice.totalAmount } },
        });
      }

      if (invoice.jobId) {
        await this.jobStatusService.applyFinanceStatus(
          invoice.jobId,
          JobStatus.INVOICED,
          user.id,
          `Invoice ${invoice.invoiceNumber} issued`,
          tx,
        );
      }

      return result;
    });

    // Snapshot the PDF (best-effort; failure must not roll back the issue).
    try {
      const { buffer } = await this.renderPdf(id);
      const stored = await this.storage.save(buffer, `${invoice.invoiceNumber}.pdf`, 'application/pdf', 'invoices');
      await this.prisma.invoice.update({ where: { id }, data: { pdfUrl: stored.url } });
    } catch {
      // PDF can be regenerated on demand from GET :id/pdf.
    }

    await this.audit(
      user,
      poOverride ? AuditAction.OVERRIDE : AuditAction.STATUS_CHANGE,
      id,
      { status: InvoiceStatus.SUBMITTED },
      ipAddress,
      poOverride ? `Issued over PO balance. Override reason: ${dto.overrideReason}` : `Invoice ${invoice.invoiceNumber} issued`,
    );
    return updated;
  }

  async renderPdf(id: string): Promise<{ buffer: Buffer; filename: string }> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      select: {
        invoiceNumber: true,
        invoiceDate: true,
        createdAt: true,
        currency: true,
        subtotal: true,
        vatAmount: true,
        totalAmount: true,
        clientVatNumber: true,
        billingAddress: true,
        notes: true,
        servicePeriodFrom: true,
        servicePeriodTo: true,
        client: { select: { name: true, vatNumber: true, crNumber: true, billingAddress: true } },
        contract: { select: { contractNumber: true } },
        job: { select: { jobCode: true, location: true } },
        purchaseOrder: { select: { poNumber: true } },
        lineItems: {
          orderBy: { sortOrder: 'asc' },
          select: {
            lineKind: true,
            description: true,
            quantity: true,
            hours: true,
            unit: true,
            unitPrice: true,
            lineSubtotal: true,
            lineVat: true,
            lineTotal: true,
          },
        },
      },
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    const buffer = await this.pdfService.renderFinancialDocument({
      docTypeEn: 'TAX INVOICE',
      docTypeAr: 'فاتورة ضريبية',
      number: invoice.invoiceNumber,
      issueDate: invoice.invoiceDate,
      issueTime: new Date(invoice.createdAt).toLocaleTimeString('en-US'),
      contractNo: invoice.contract?.contractNumber ?? null,
      poNo: invoice.purchaseOrder?.poNumber ?? null,
      siteLocation: invoice.job?.location ?? null,
      startJobDate: invoice.servicePeriodFrom,
      endJobDate: invoice.servicePeriodTo,
      buyer: {
        nameEn: invoice.client.name,
        crNumber: invoice.client.crNumber,
        vatNumber: invoice.clientVatNumber ?? invoice.client.vatNumber,
        addressLines: (invoice.billingAddress ?? invoice.client.billingAddress)
          ? [(invoice.billingAddress ?? invoice.client.billingAddress) as string]
          : [],
      },
      lines: invoice.lineItems.map((l, i) => ({
        code: String((i + 1) * 10),
        description: l.description,
        unit: mapUnitLabel(l.lineKind, l.unit),
        qty: Number(l.quantity) * Number(l.hours),
        unitPrice: Number(l.unitPrice),
        total: Number(l.lineSubtotal),
        vat: Number(l.lineVat),
        net: Number(l.lineTotal),
      })),
      currency: invoice.currency,
      subtotal: Number(invoice.subtotal),
      vatAmount: Number(invoice.vatAmount),
      totalAmount: Number(invoice.totalAmount),
      showBank: true,
      notes: invoice.notes,
    });
    return { buffer, filename: `${invoice.invoiceNumber}.pdf` };
  }

  // --- Helpers ----------------------------------------------------------------

  private async simpleTransition(
    id: string,
    from: InvoiceStatus,
    to: InvoiceStatus,
    action: AuditAction,
    user: AuthenticatedUser,
    ipAddress: string | undefined,
    extraData: Prisma.InvoiceUpdateInput = {},
  ) {
    const existing = await this.prisma.invoice.findUnique({ where: { id }, select: { status: true } });
    if (!existing) {
      throw new NotFoundException('Invoice not found');
    }
    if (existing.status !== from) {
      throw new ConflictException(`Invoice must be ${from} to perform this action (it is ${existing.status})`);
    }
    const updated = await this.prisma.invoice.update({
      where: { id },
      data: { status: to, ...extraData },
      select: INVOICE_DETAIL_SELECT,
    });
    await this.audit(user, action, id, { status: to }, ipAddress);
    return updated;
  }

  private buildLines(items: InvoiceLineDto[]) {
    return items.map((item, index) => {
      const amounts = computeLine({
        quantity: item.quantity,
        hours: item.hours,
        unitPrice: item.unitPrice,
        vatRate: item.vatRate,
      });
      return {
        sourceEstimateLineItemId: item.sourceEstimateLineItemId,
        contractRateCardId: item.contractRateCardId,
        lineKind: item.lineKind ?? LineKind.OTHER,
        description: item.description,
        quantity: item.quantity,
        hours: item.hours ?? 1,
        unit: item.unit ?? BillingUnit.HOUR,
        unitPrice: item.unitPrice,
        vatRate: item.vatRate ?? 15,
        lineSubtotal: amounts.lineSubtotal,
        lineVat: amounts.lineVat,
        lineTotal: amounts.lineTotal,
        sortOrder: index,
      };
    });
  }

  private async loadClientForInvoice(clientId: string) {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, vatNumber: true, billingAddress: true, paymentTermsDays: true },
    });
    if (!client) {
      throw new BadRequestException('Invalid clientId');
    }
    return client;
  }

  private async assertRelations(
    clientId: string,
    contractId?: string,
    purchaseOrderId?: string,
    jobId?: string,
  ) {
    if (contractId) {
      const contract = await this.prisma.contract.findUnique({
        where: { id: contractId },
        select: { clientId: true },
      });
      if (!contract) throw new BadRequestException('Invalid contractId');
      if (contract.clientId !== clientId) {
        throw new BadRequestException('Contract does not belong to the selected client');
      }
    }
    if (purchaseOrderId) {
      const po = await this.prisma.purchaseOrder.findUnique({
        where: { id: purchaseOrderId },
        select: { clientId: true },
      });
      if (!po) throw new BadRequestException('Invalid purchaseOrderId');
      if (po.clientId !== clientId) {
        throw new BadRequestException('Purchase order does not belong to the selected client');
      }
    }
    if (jobId) {
      const job = await this.prisma.job.findUnique({ where: { id: jobId }, select: { clientId: true } });
      if (!job) throw new BadRequestException('Invalid jobId');
      if (job.clientId !== clientId) {
        throw new BadRequestException('Job does not belong to the selected client');
      }
    }
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  private audit(
    user: AuthenticatedUser,
    action: AuditAction,
    entityId: string,
    newValue: unknown,
    ipAddress?: string,
    comment?: string,
  ) {
    return this.auditLogService.record({
      userId: user.id,
      action,
      entityType: 'Invoice',
      entityId,
      newValue,
      ipAddress,
      comment,
    });
  }

  /**
   * Sequential per-year invoice number (INV-2026-0001), derived from the
   * highest existing number — not the row count, which collides forever once
   * an invoice is deleted.
   */
  private async withNumber<T>(run: (num: string) => Promise<T>): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      const year = new Date().getFullYear();
      const full = `INV-${year}-`;
      const last = await this.prisma.invoice.findFirst({
        where: { invoiceNumber: { startsWith: full } },
        orderBy: { invoiceNumber: 'desc' },
        select: { invoiceNumber: true },
      });
      const next = last ? Number(last.invoiceNumber.slice(full.length)) + 1 : 1;
      const number = `${full}${String(next).padStart(4, '0')}`;
      try {
        return await run(number);
      } catch (error) {
        const isUnique =
          error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
        if (!isUnique || attempt >= NUMBER_RETRIES) {
          throw error;
        }
      }
    }
  }
}
