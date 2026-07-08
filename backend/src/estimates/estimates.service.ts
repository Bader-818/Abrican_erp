import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, BillingUnit, EstimateStatus, LineKind, Prisma } from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service';
import { paginate } from '../common/helpers/pagination.helper';
import { computeLine, round2, sumTotals, DEFAULT_VAT_RATE } from '../common/finance/line-math';
import { AuthenticatedUser } from '../common/types/authenticated-user.interface';
import { JobsService } from '../jobs/jobs.service';
import { PdfService } from '../pdf/pdf.service';
import { mapUnitLabel } from '../pdf/unit-label';
import { PrismaService } from '../prisma/prisma.service';
import { ConvertEstimateDto } from './dto/convert-estimate.dto';
import { CreateEstimateDto } from './dto/create-estimate.dto';
import { EstimateLineDto } from './dto/estimate-line.dto';
import { EstimatesQueryDto } from './dto/estimates-query.dto';
import { UpdateEstimateDto } from './dto/update-estimate.dto';

const NUMBER_RETRIES = 3;

const ESTIMATE_LIST_SELECT = {
  id: true,
  estimateNumber: true,
  title: true,
  jobType: true,
  location: true,
  status: true,
  currency: true,
  totalAmount: true,
  plannedStartDate: true,
  plannedEndDate: true,
  validUntil: true,
  jobId: true,
  createdAt: true,
  client: { select: { id: true, name: true } },
  contract: { select: { id: true, contractNumber: true } },
} satisfies Prisma.EstimateSelect;

const ESTIMATE_DETAIL_SELECT = {
  ...ESTIMATE_LIST_SELECT,
  notes: true,
  subtotal: true,
  vatAmount: true,
  estimatedCost: true,
  estimatedMarginPct: true,
  pdfUrl: true,
  approvedAt: true,
  updatedAt: true,
  contract: { select: { id: true, contractNumber: true, title: true } },
  job: { select: { id: true, jobCode: true, title: true, status: true } },
  createdBy: { select: { id: true, name: true } },
  approvedBy: { select: { id: true, name: true } },
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
      lineSubtotal: true,
      lineVat: true,
      lineTotal: true,
      estimatedUnitCost: true,
      lineCost: true,
      sortOrder: true,
    },
  },
} satisfies Prisma.EstimateSelect;

@Injectable()
export class EstimatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly jobsService: JobsService,
    private readonly pdfService: PdfService,
  ) {}

  /** Render the quotation PDF on demand. Returns the buffer + a filename. */
  async renderPdf(id: string): Promise<{ buffer: Buffer; filename: string }> {
    const estimate = await this.prisma.estimate.findUnique({
      where: { id },
      select: {
        estimateNumber: true,
        location: true,
        currency: true,
        subtotal: true,
        vatAmount: true,
        totalAmount: true,
        notes: true,
        plannedStartDate: true,
        plannedEndDate: true,
        createdAt: true,
        client: { select: { name: true, vatNumber: true, crNumber: true, billingAddress: true } },
        contract: { select: { contractNumber: true } },
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
    if (!estimate) {
      throw new NotFoundException('Estimate not found');
    }

    const buffer = await this.pdfService.renderFinancialDocument({
      docTypeEn: 'QUOTATION',
      docTypeAr: 'عرض سعر',
      number: estimate.estimateNumber,
      issueDate: estimate.createdAt,
      contractNo: estimate.contract?.contractNumber ?? null,
      siteLocation: estimate.location,
      startJobDate: estimate.plannedStartDate,
      endJobDate: estimate.plannedEndDate,
      buyer: {
        nameEn: estimate.client.name,
        crNumber: estimate.client.crNumber,
        vatNumber: estimate.client.vatNumber,
        addressLines: estimate.client.billingAddress ? [estimate.client.billingAddress] : [],
      },
      lines: estimate.lineItems.map((l, i) => ({
        code: String((i + 1) * 10),
        description: l.description,
        unit: mapUnitLabel(l.lineKind, l.unit),
        qty: Number(l.quantity) * Number(l.hours),
        unitPrice: Number(l.unitPrice),
        total: Number(l.lineSubtotal),
        vat: Number(l.lineVat),
        net: Number(l.lineTotal),
      })),
      currency: estimate.currency,
      subtotal: Number(estimate.subtotal),
      vatAmount: Number(estimate.vatAmount),
      totalAmount: Number(estimate.totalAmount),
      showBank: false,
      notes: estimate.notes,
    });

    return { buffer, filename: `${estimate.estimateNumber}.pdf` };
  }

  async findAll(query: EstimatesQueryDto) {
    const where: Prisma.EstimateWhereInput = {
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...(query.contractId ? { contractId: query.contractId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { estimateNumber: { contains: query.search, mode: 'insensitive' } },
              { title: { contains: query.search, mode: 'insensitive' } },
              { client: { name: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    return paginate(this.prisma.estimate, query, {
      where,
      orderBy: { createdAt: 'desc' },
      select: ESTIMATE_LIST_SELECT,
    });
  }

  async findOne(id: string) {
    const estimate = await this.prisma.estimate.findUnique({
      where: { id },
      select: ESTIMATE_DETAIL_SELECT,
    });
    if (!estimate) {
      throw new NotFoundException('Estimate not found');
    }
    return estimate;
  }

  async create(dto: CreateEstimateDto, user: AuthenticatedUser, ipAddress?: string) {
    await this.assertRelations(dto.clientId, dto.contractId);
    this.validateDates(dto.plannedStartDate, dto.plannedEndDate);
    const lines = await this.buildLines(dto.items, dto.contractId);
    const totals = sumTotals(lines);
    const cost = this.costRollup(lines, Number(totals.subtotal));

    const created = await this.withNumber('EST', (estimateNumber) =>
      this.prisma.estimate.create({
        data: {
          estimateNumber,
          clientId: dto.clientId,
          contractId: dto.contractId,
          title: dto.title,
          jobType: dto.jobType,
          location: dto.location,
          plannedStartDate: new Date(dto.plannedStartDate),
          plannedEndDate: new Date(dto.plannedEndDate),
          validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
          notes: dto.notes,
          subtotal: totals.subtotal,
          vatAmount: totals.vatAmount,
          totalAmount: totals.totalAmount,
          estimatedCost: cost.estimatedCost,
          estimatedMarginPct: cost.estimatedMarginPct,
          createdById: user.id,
          lineItems: { create: lines },
        },
        select: ESTIMATE_DETAIL_SELECT,
      }),
    );

    await this.auditLogService.record({
      userId: user.id,
      action: AuditAction.CREATE,
      entityType: 'Estimate',
      entityId: created.id,
      newValue: { estimateNumber: created.estimateNumber, totalAmount: created.totalAmount },
      ipAddress,
    });

    return created;
  }

  async update(id: string, dto: UpdateEstimateDto, user: AuthenticatedUser, ipAddress?: string) {
    const existing = await this.prisma.estimate.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Estimate not found');
    }
    if (existing.status !== EstimateStatus.DRAFT) {
      throw new ConflictException('Only DRAFT estimates can be edited');
    }

    const clientId = dto.clientId ?? existing.clientId;
    const contractId = dto.contractId === undefined ? existing.contractId : dto.contractId;
    await this.assertRelations(clientId, contractId ?? undefined);

    const start = dto.plannedStartDate ?? existing.plannedStartDate.toISOString();
    const end = dto.plannedEndDate ?? existing.plannedEndDate.toISOString();
    this.validateDates(start, end);

    let totals: ReturnType<typeof sumTotals> | undefined;
    let lines: Awaited<ReturnType<typeof this.buildLines>> | undefined;
    let cost: ReturnType<typeof this.costRollup> | undefined;
    if (dto.items) {
      lines = await this.buildLines(dto.items, contractId ?? undefined);
      totals = sumTotals(lines);
      cost = this.costRollup(lines, Number(totals.subtotal));
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.items) {
        await tx.estimateLineItem.deleteMany({ where: { estimateId: id } });
      }
      return tx.estimate.update({
        where: { id },
        data: {
          ...(dto.clientId !== undefined ? { clientId: dto.clientId } : {}),
          ...(dto.contractId !== undefined ? { contractId: dto.contractId } : {}),
          ...(dto.title !== undefined ? { title: dto.title } : {}),
          ...(dto.jobType !== undefined ? { jobType: dto.jobType } : {}),
          ...(dto.location !== undefined ? { location: dto.location } : {}),
          ...(dto.plannedStartDate ? { plannedStartDate: new Date(dto.plannedStartDate) } : {}),
          ...(dto.plannedEndDate ? { plannedEndDate: new Date(dto.plannedEndDate) } : {}),
          ...(dto.validUntil !== undefined
            ? { validUntil: dto.validUntil ? new Date(dto.validUntil) : null }
            : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
          ...(totals
            ? {
                subtotal: totals.subtotal,
                vatAmount: totals.vatAmount,
                totalAmount: totals.totalAmount,
                estimatedCost: cost?.estimatedCost ?? null,
                estimatedMarginPct: cost?.estimatedMarginPct ?? null,
              }
            : {}),
          ...(lines ? { lineItems: { create: lines } } : {}),
        },
        select: ESTIMATE_DETAIL_SELECT,
      });
    });

    await this.auditLogService.record({
      userId: user.id,
      action: AuditAction.UPDATE,
      entityType: 'Estimate',
      entityId: id,
      newValue: { totalAmount: updated.totalAmount },
      ipAddress,
    });

    return updated;
  }

  async remove(id: string, user: AuthenticatedUser, ipAddress?: string) {
    const existing = await this.prisma.estimate.findUnique({
      where: { id },
      select: { status: true, estimateNumber: true },
    });
    if (!existing) {
      throw new NotFoundException('Estimate not found');
    }
    if (existing.status !== EstimateStatus.DRAFT && existing.status !== EstimateStatus.REJECTED) {
      throw new ConflictException('Only DRAFT or REJECTED estimates can be deleted');
    }

    await this.prisma.estimate.delete({ where: { id } });
    await this.auditLogService.record({
      userId: user.id,
      action: AuditAction.DELETE,
      entityType: 'Estimate',
      entityId: id,
      oldValue: { estimateNumber: existing.estimateNumber },
      ipAddress,
    });
    return { success: true };
  }

  /** DRAFT → SENT (quotation issued to the client). */
  async send(id: string, user: AuthenticatedUser, ipAddress?: string) {
    return this.transition(id, EstimateStatus.DRAFT, EstimateStatus.SENT, AuditAction.UPDATE, user, ipAddress);
  }

  /** SENT → APPROVED (client accepted the quotation). */
  async approve(id: string, user: AuthenticatedUser, ipAddress?: string) {
    return this.transition(
      id,
      EstimateStatus.SENT,
      EstimateStatus.APPROVED,
      AuditAction.APPROVE,
      user,
      ipAddress,
      { approvedBy: { connect: { id: user.id } }, approvedAt: new Date() },
    );
  }

  /** SENT → REJECTED (client declined). */
  async reject(id: string, reason: string | undefined, user: AuthenticatedUser, ipAddress?: string) {
    return this.transition(
      id,
      EstimateStatus.SENT,
      EstimateStatus.REJECTED,
      AuditAction.REJECT,
      user,
      ipAddress,
      {},
      reason,
    );
  }

  /**
   * APPROVED → CONVERTED: create a Job from the estimate, link it, and copy the
   * quoted total into Job.jobValue (expected revenue). The created job is the
   * starting point for invoicing (S8).
   */
  async convert(
    id: string,
    dto: ConvertEstimateDto,
    user: AuthenticatedUser,
    ipAddress?: string,
  ) {
    const estimate = await this.prisma.estimate.findUnique({ where: { id } });
    if (!estimate) {
      throw new NotFoundException('Estimate not found');
    }
    if (estimate.status !== EstimateStatus.APPROVED) {
      throw new ConflictException('Only APPROVED estimates can be converted to a job');
    }
    if (estimate.jobId) {
      throw new ConflictException('This estimate has already been converted');
    }

    const job = await this.jobsService.create({
      title: estimate.title,
      clientId: estimate.clientId,
      contractId: estimate.contractId ?? undefined,
      purchaseOrderId: dto.purchaseOrderId,
      serviceType: estimate.jobType,
      location: estimate.location,
      region: dto.region,
      plannedStartDate: estimate.plannedStartDate.toISOString(),
      plannedEndDate: estimate.plannedEndDate.toISOString(),
      jobValue: Number(estimate.totalAmount),
      description: dto.description,
    });

    const updated = await this.prisma.estimate.update({
      where: { id },
      data: { status: EstimateStatus.CONVERTED, jobId: job.id },
      select: ESTIMATE_DETAIL_SELECT,
    });

    await this.auditLogService.record({
      userId: user.id,
      action: AuditAction.STATUS_CHANGE,
      entityType: 'Estimate',
      entityId: id,
      oldValue: { status: EstimateStatus.APPROVED },
      newValue: { status: EstimateStatus.CONVERTED, jobId: job.id, jobCode: job.jobCode },
      ipAddress,
      comment: `Converted to job ${job.jobCode}`,
    });

    return updated;
  }

  // --- Helpers ----------------------------------------------------------------

  private async transition(
    id: string,
    from: EstimateStatus,
    to: EstimateStatus,
    action: AuditAction,
    user: AuthenticatedUser,
    ipAddress: string | undefined,
    extraData: Prisma.EstimateUpdateInput = {},
    comment?: string,
  ) {
    const existing = await this.prisma.estimate.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!existing) {
      throw new NotFoundException('Estimate not found');
    }
    if (existing.status !== from) {
      throw new ConflictException(`Estimate must be ${from} to perform this action (it is ${existing.status})`);
    }

    const updated = await this.prisma.estimate.update({
      where: { id },
      data: { status: to, ...extraData },
      select: ESTIMATE_DETAIL_SELECT,
    });

    await this.auditLogService.record({
      userId: user.id,
      action,
      entityType: 'Estimate',
      entityId: id,
      oldValue: { status: from },
      newValue: { status: to },
      ipAddress,
      comment,
    });

    return updated;
  }

  private async buildLines(items: EstimateLineDto[], contractId?: string | null) {
    // Validate any referenced rate cards belong to the estimate's contract, and
    // load their price/VAT so contract lines are priced from the card (authoritative).
    const cardIds = items.map((i) => i.contractRateCardId).filter((x): x is string => !!x);
    const byId = new Map<string, { contractId: string; unitPrice: unknown; vatApplicable: boolean }>();
    if (cardIds.length > 0) {
      const cards = await this.prisma.contractRateCard.findMany({
        where: { id: { in: cardIds } },
        select: { id: true, contractId: true, unitPrice: true, vatApplicable: true },
      });
      for (const c of cards) byId.set(c.id, c);
      for (const cardId of cardIds) {
        const card = byId.get(cardId);
        if (!card) {
          throw new BadRequestException(`Invalid contractRateCardId: ${cardId}`);
        }
        if (contractId && card.contractId !== contractId) {
          throw new BadRequestException('A rate card line does not belong to the selected contract');
        }
      }
    }

    return items.map((item, index) => {
      // A line linked to a rate card uses the card's fixed price + VAT — the client
      // cannot override them. Custom lines (no card) keep their submitted values.
      const card = item.contractRateCardId ? byId.get(item.contractRateCardId) : undefined;
      const unitPrice = card ? Number(card.unitPrice) : item.unitPrice;
      // VAT is system-controlled, never client-set: the card's rate for contract
      // lines, the standard rate for custom lines.
      const vatRate = card ? (card.vatApplicable ? DEFAULT_VAT_RATE : 0) : DEFAULT_VAT_RATE;

      const amounts = computeLine({
        quantity: item.quantity,
        hours: item.hours,
        unitPrice,
        vatRate,
      });
      // Optional internal cost projection (S12) — ex-VAT, never client-facing.
      const hours = item.hours ?? 1;
      const estimatedUnitCost = item.estimatedUnitCost ?? null;
      const lineCost =
        estimatedUnitCost != null ? round2(item.quantity * hours * estimatedUnitCost) : null;
      return {
        contractRateCardId: item.contractRateCardId,
        lineKind: item.lineKind ?? LineKind.OTHER,
        description: item.description,
        quantity: item.quantity,
        hours,
        unit: item.unit ?? BillingUnit.HOUR,
        unitPrice,
        vatRate,
        lineSubtotal: amounts.lineSubtotal,
        lineVat: amounts.lineVat,
        lineTotal: amounts.lineTotal,
        estimatedUnitCost,
        lineCost,
        sortOrder: index,
      };
    });
  }

  /**
   * Roll up the optional per-line costs into the estimate's estimatedCost and
   * projected margin (vs the ex-VAT subtotal). Returns nulls when no line carried
   * a cost, so an estimate without cost input stays uncosted.
   */
  private costRollup(
    lines: { lineCost: number | null }[],
    subtotal: number,
  ): { estimatedCost: number | null; estimatedMarginPct: number | null } {
    const hasCost = lines.some((l) => l.lineCost != null);
    if (!hasCost) {
      return { estimatedCost: null, estimatedMarginPct: null };
    }
    const estimatedCost = round2(lines.reduce((sum, l) => sum + (l.lineCost ?? 0), 0));
    const estimatedMarginPct =
      subtotal > 0 ? round2(((subtotal - estimatedCost) / subtotal) * 100) : null;
    return { estimatedCost, estimatedMarginPct };
  }

  private validateDates(start: string, end: string) {
    if (new Date(end) <= new Date(start)) {
      throw new BadRequestException('plannedEndDate must be after plannedStartDate');
    }
  }

  private async assertRelations(clientId: string, contractId?: string) {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true },
    });
    if (!client) {
      throw new BadRequestException('Invalid clientId');
    }
    if (contractId) {
      const contract = await this.prisma.contract.findUnique({
        where: { id: contractId },
        select: { clientId: true },
      });
      if (!contract) {
        throw new BadRequestException('Invalid contractId');
      }
      if (contract.clientId !== clientId) {
        throw new BadRequestException('Contract does not belong to the selected client');
      }
    }
  }

  /**
   * Sequential per-year number (EST-2026-0001), retried on rare collision.
   * Derived from the highest existing number — not the row count, which
   * collides forever once an estimate is deleted.
   */
  private async withNumber<T>(prefix: string, run: (num: string) => Promise<T>): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      const year = new Date().getFullYear();
      const full = `${prefix}-${year}-`;
      const last = await this.prisma.estimate.findFirst({
        where: { estimateNumber: { startsWith: full } },
        orderBy: { estimateNumber: 'desc' },
        select: { estimateNumber: true },
      });
      const next = last ? Number(last.estimateNumber.slice(full.length)) + 1 : 1;
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
