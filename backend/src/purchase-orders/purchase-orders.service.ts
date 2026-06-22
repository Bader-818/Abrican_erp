import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { paginate } from '../common/helpers/pagination.helper';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { PurchaseOrdersQueryDto } from './dto/purchase-orders-query.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';

const PO_SELECT = {
  id: true,
  poNumber: true,
  poValue: true,
  consumedAmount: true,
  currency: true,
  issueDate: true,
  expiryDate: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  client: { select: { id: true, name: true } },
  contract: { select: { id: true, contractNumber: true, title: true } },
  _count: { select: { jobs: true } },
} satisfies Prisma.PurchaseOrderSelect;

/** Adds the computed remainingAmount (poValue - consumedAmount) to a PO row. */
function withRemainingAmount<T extends { poValue: Prisma.Decimal; consumedAmount: Prisma.Decimal }>(
  po: T,
) {
  return { ...po, remainingAmount: po.poValue.minus(po.consumedAmount) };
}

@Injectable()
export class PurchaseOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PurchaseOrdersQueryDto) {
    const where: Prisma.PurchaseOrderWhereInput = {
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...(query.contractId ? { contractId: query.contractId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { poNumber: { contains: query.search, mode: 'insensitive' } },
              { client: { name: { contains: query.search, mode: 'insensitive' } } },
              { contract: { contractNumber: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const result = await paginate(this.prisma.purchaseOrder, query, {
      where,
      orderBy: { expiryDate: 'desc' },
      select: PO_SELECT,
    });

    return { ...result, data: result.data.map(withRemainingAmount) };
  }

  async findOne(id: string) {
    const po = await this.prisma.purchaseOrder.findUnique({ where: { id }, select: PO_SELECT });
    if (!po) {
      throw new NotFoundException('Purchase order not found');
    }
    return withRemainingAmount(po);
  }

  async create(dto: CreatePurchaseOrderDto) {
    await this.validateClient(dto.clientId);
    await this.validateContract(dto.contractId, dto.clientId);
    this.validateDates(dto.issueDate, dto.expiryDate);

    const existing = await this.prisma.purchaseOrder.findUnique({
      where: { poNumber: dto.poNumber },
    });
    if (existing) {
      throw new ConflictException('PO number already in use');
    }

    const po = await this.prisma.purchaseOrder.create({
      data: {
        clientId: dto.clientId,
        contractId: dto.contractId,
        poNumber: dto.poNumber,
        poValue: dto.poValue,
        currency: dto.currency,
        issueDate: new Date(dto.issueDate),
        expiryDate: new Date(dto.expiryDate),
        status: dto.status,
      },
      select: PO_SELECT,
    });
    return withRemainingAmount(po);
  }

  async update(id: string, dto: UpdatePurchaseOrderDto) {
    const po = await this.prisma.purchaseOrder.findUnique({ where: { id } });
    if (!po) {
      throw new NotFoundException('Purchase order not found');
    }

    const clientId = dto.clientId ?? po.clientId;
    if (dto.clientId && dto.clientId !== po.clientId) {
      await this.validateClient(dto.clientId);
    }

    // contractId may be explicitly set to null to detach the PO from a contract
    const contractId = dto.contractId === undefined ? po.contractId : dto.contractId;
    if (contractId) {
      await this.validateContract(contractId, clientId);
    }

    const issueDate = dto.issueDate ?? po.issueDate.toISOString();
    const expiryDate = dto.expiryDate ?? po.expiryDate.toISOString();
    this.validateDates(issueDate, expiryDate);

    if (dto.poNumber && dto.poNumber !== po.poNumber) {
      const existing = await this.prisma.purchaseOrder.findUnique({
        where: { poNumber: dto.poNumber },
      });
      if (existing) {
        throw new ConflictException('PO number already in use');
      }
    }

    const updated = await this.prisma.purchaseOrder.update({
      where: { id },
      data: {
        clientId: dto.clientId,
        ...(dto.contractId !== undefined ? { contractId: dto.contractId } : {}),
        poNumber: dto.poNumber,
        poValue: dto.poValue,
        currency: dto.currency,
        ...(dto.issueDate ? { issueDate: new Date(dto.issueDate) } : {}),
        ...(dto.expiryDate ? { expiryDate: new Date(dto.expiryDate) } : {}),
        status: dto.status,
      },
      select: PO_SELECT,
    });
    return withRemainingAmount(updated);
  }

  async remove(id: string) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      select: { _count: { select: { jobs: true } } },
    });
    if (!po) {
      throw new NotFoundException('Purchase order not found');
    }

    if (po._count.jobs > 0) {
      throw new ConflictException(
        'Cannot delete a purchase order with jobs. Set its status to CANCELLED instead.',
      );
    }

    await this.prisma.purchaseOrder.delete({ where: { id } });
    return { success: true };
  }

  // --- Helpers ----------------------------------------------------------------

  private validateDates(issueDate: string, expiryDate: string) {
    if (new Date(expiryDate) <= new Date(issueDate)) {
      throw new BadRequestException('expiryDate must be after issueDate');
    }
  }

  private async validateClient(clientId: string) {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true },
    });
    if (!client) {
      throw new BadRequestException('Invalid clientId');
    }
  }

  private async validateContract(contractId: string | undefined | null, clientId: string) {
    if (!contractId) {
      return;
    }
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
