import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { paginate } from '../common/helpers/pagination.helper';
import { PrismaService } from '../prisma/prisma.service';
import { ContractsQueryDto } from './dto/contracts-query.dto';
import { CreateContractDto } from './dto/create-contract.dto';
import { CreateRateCardDto, UpdateRateCardDto } from './dto/rate-card.dto';
import { UpdateContractDto } from './dto/update-contract.dto';

const CONTRACT_LIST_SELECT = {
  id: true,
  contractNumber: true,
  title: true,
  startDate: true,
  endDate: true,
  contractValue: true,
  consumedValue: true,
  paymentTermsDays: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  client: { select: { id: true, name: true } },
  _count: { select: { rateCards: true, purchaseOrders: true, jobs: true } },
} satisfies Prisma.ContractSelect;

const CONTRACT_DETAIL_SELECT = {
  ...CONTRACT_LIST_SELECT,
  scope: true,
  rateCards: {
    select: {
      id: true,
      serviceLine: true,
      itemCode: true,
      description: true,
      unit: true,
      unitPrice: true,
      currency: true,
      vatApplicable: true,
      effectiveDate: true,
    },
    orderBy: [{ serviceLine: 'asc' }, { effectiveDate: 'desc' }],
  },
} satisfies Prisma.ContractSelect;

/** Adds the computed remainingValue (contractValue - consumedValue) to a contract row. */
function withRemainingValue<T extends { contractValue: Prisma.Decimal; consumedValue: Prisma.Decimal }>(
  contract: T,
) {
  return { ...contract, remainingValue: contract.contractValue.minus(contract.consumedValue) };
}

@Injectable()
export class ContractsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ContractsQueryDto) {
    const where: Prisma.ContractWhereInput = {
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { contractNumber: { contains: query.search, mode: 'insensitive' } },
              { title: { contains: query.search, mode: 'insensitive' } },
              { client: { name: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const result = await paginate(this.prisma.contract, query, {
      where,
      orderBy: { endDate: 'desc' },
      select: CONTRACT_LIST_SELECT,
    });

    return { ...result, data: result.data.map(withRemainingValue) };
  }

  async findOne(id: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      select: CONTRACT_DETAIL_SELECT,
    });
    if (!contract) {
      throw new NotFoundException('Contract not found');
    }
    return withRemainingValue(contract);
  }

  async create(dto: CreateContractDto) {
    await this.validateClient(dto.clientId);
    this.validateDates(dto.startDate, dto.endDate);

    const existing = await this.prisma.contract.findUnique({
      where: { contractNumber: dto.contractNumber },
    });
    if (existing) {
      throw new ConflictException('Contract number already in use');
    }

    const contract = await this.prisma.contract.create({
      data: {
        clientId: dto.clientId,
        contractNumber: dto.contractNumber,
        title: dto.title,
        scope: dto.scope,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        contractValue: dto.contractValue,
        paymentTermsDays: dto.paymentTermsDays,
        status: dto.status,
      },
      select: CONTRACT_DETAIL_SELECT,
    });
    return withRemainingValue(contract);
  }

  async update(id: string, dto: UpdateContractDto) {
    const contract = await this.prisma.contract.findUnique({ where: { id } });
    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    if (dto.clientId && dto.clientId !== contract.clientId) {
      await this.validateClient(dto.clientId);
    }

    const startDate = dto.startDate ?? contract.startDate.toISOString();
    const endDate = dto.endDate ?? contract.endDate.toISOString();
    this.validateDates(startDate, endDate);

    if (dto.contractNumber && dto.contractNumber !== contract.contractNumber) {
      const existing = await this.prisma.contract.findUnique({
        where: { contractNumber: dto.contractNumber },
      });
      if (existing) {
        throw new ConflictException('Contract number already in use');
      }
    }

    const updated = await this.prisma.contract.update({
      where: { id },
      data: {
        clientId: dto.clientId,
        contractNumber: dto.contractNumber,
        title: dto.title,
        scope: dto.scope,
        ...(dto.startDate ? { startDate: new Date(dto.startDate) } : {}),
        ...(dto.endDate ? { endDate: new Date(dto.endDate) } : {}),
        contractValue: dto.contractValue,
        paymentTermsDays: dto.paymentTermsDays,
        status: dto.status,
      },
      select: CONTRACT_DETAIL_SELECT,
    });
    return withRemainingValue(updated);
  }

  async remove(id: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      select: { _count: { select: { purchaseOrders: true, jobs: true } } },
    });
    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    const { purchaseOrders, jobs } = contract._count;
    if (purchaseOrders > 0 || jobs > 0) {
      throw new ConflictException(
        'Cannot delete a contract with purchase orders or jobs. Set its status to CLOSED or TERMINATED instead.',
      );
    }

    await this.prisma.contract.delete({ where: { id } });
    return { success: true };
  }

  // --- Rate cards -----------------------------------------------------------

  async addRateCard(contractId: string, dto: CreateRateCardDto) {
    await this.ensureExists(contractId);
    return this.prisma.contractRateCard.create({
      data: {
        contractId,
        serviceLine: dto.serviceLine,
        itemCode: dto.itemCode,
        description: dto.description,
        unit: dto.unit,
        unitPrice: dto.unitPrice,
        currency: dto.currency,
        vatApplicable: dto.vatApplicable,
        effectiveDate: new Date(dto.effectiveDate),
      },
    });
  }

  async updateRateCard(contractId: string, rateCardId: string, dto: UpdateRateCardDto) {
    await this.ensureRateCardExists(contractId, rateCardId);
    return this.prisma.contractRateCard.update({
      where: { id: rateCardId },
      data: {
        serviceLine: dto.serviceLine,
        itemCode: dto.itemCode,
        description: dto.description,
        unit: dto.unit,
        unitPrice: dto.unitPrice,
        currency: dto.currency,
        vatApplicable: dto.vatApplicable,
        ...(dto.effectiveDate ? { effectiveDate: new Date(dto.effectiveDate) } : {}),
      },
    });
  }

  async removeRateCard(contractId: string, rateCardId: string) {
    await this.ensureRateCardExists(contractId, rateCardId);
    await this.prisma.contractRateCard.delete({ where: { id: rateCardId } });
    return { success: true };
  }

  // --- Helpers ----------------------------------------------------------------

  private validateDates(startDate: string, endDate: string) {
    if (new Date(endDate) <= new Date(startDate)) {
      throw new BadRequestException('endDate must be after startDate');
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

  private async ensureExists(id: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!contract) {
      throw new NotFoundException('Contract not found');
    }
  }

  private async ensureRateCardExists(contractId: string, rateCardId: string) {
    const rateCard = await this.prisma.contractRateCard.findUnique({
      where: { id: rateCardId },
      select: { contractId: true },
    });
    if (!rateCard || rateCard.contractId !== contractId) {
      throw new NotFoundException('Rate card not found');
    }
  }
}
