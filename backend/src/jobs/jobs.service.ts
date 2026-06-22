import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JobStatus, Prisma } from '@prisma/client';
import { paginate } from '../common/helpers/pagination.helper';
import { PrismaService } from '../prisma/prisma.service';
import { CreateJobDto } from './dto/create-job.dto';
import { JobsQueryDto } from './dto/jobs-query.dto';
import { UpdateJobDto } from './dto/update-job.dto';

const JOB_LIST_SELECT = {
  id: true,
  jobCode: true,
  title: true,
  serviceType: true,
  location: true,
  region: true,
  plannedStartDate: true,
  plannedEndDate: true,
  actualStartDate: true,
  actualEndDate: true,
  jobValue: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  client: { select: { id: true, name: true } },
  contract: { select: { id: true, contractNumber: true } },
  purchaseOrder: { select: { id: true, poNumber: true } },
  _count: { select: { assignments: true } },
} satisfies Prisma.JobSelect;

const JOB_DETAIL_SELECT = {
  ...JOB_LIST_SELECT,
  costBudget: true,
  description: true,
  contract: { select: { id: true, contractNumber: true, title: true } },
  purchaseOrder: { select: { id: true, poNumber: true } },
  statusHistory: {
    select: {
      id: true,
      fromStatus: true,
      toStatus: true,
      reason: true,
      createdAt: true,
      changedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  },
} satisfies Prisma.JobSelect;

const JOB_CODE_CREATE_RETRIES = 3;

@Injectable()
export class JobsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: JobsQueryDto) {
    const where: Prisma.JobWhereInput = {
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...(query.contractId ? { contractId: query.contractId } : {}),
      ...(query.purchaseOrderId ? { purchaseOrderId: query.purchaseOrderId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.serviceType
        ? { serviceType: { contains: query.serviceType, mode: 'insensitive' } }
        : {}),
      ...(query.region ? { region: { contains: query.region, mode: 'insensitive' } } : {}),
      ...(query.search
        ? {
            OR: [
              { jobCode: { contains: query.search, mode: 'insensitive' } },
              { title: { contains: query.search, mode: 'insensitive' } },
              { location: { contains: query.search, mode: 'insensitive' } },
              { client: { name: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    return paginate(this.prisma.job, query, {
      where,
      orderBy: { createdAt: 'desc' },
      select: JOB_LIST_SELECT,
    });
  }

  async findOne(id: string) {
    const job = await this.prisma.job.findUnique({ where: { id }, select: JOB_DETAIL_SELECT });
    if (!job) {
      throw new NotFoundException('Job not found');
    }
    return job;
  }

  async create(dto: CreateJobDto) {
    await this.validateRelations(dto.clientId, dto.contractId, dto.purchaseOrderId);
    this.validateDates(dto.plannedStartDate, dto.plannedEndDate);

    // Sequential per-year job code (JOB-2026-0001). Generated inside the
    // create transaction; retried on the (rare) unique-constraint collision
    // when two jobs are created concurrently.
    for (let attempt = 1; ; attempt++) {
      const year = new Date().getFullYear();
      const prefix = `JOB-${year}-`;
      try {
        return await this.prisma.$transaction(async (tx) => {
          const countThisYear = await tx.job.count({ where: { jobCode: { startsWith: prefix } } });
          const jobCode = `${prefix}${String(countThisYear + 1).padStart(4, '0')}`;
          return tx.job.create({
            data: {
              jobCode,
              title: dto.title,
              clientId: dto.clientId,
              contractId: dto.contractId,
              purchaseOrderId: dto.purchaseOrderId,
              serviceType: dto.serviceType,
              location: dto.location,
              region: dto.region,
              plannedStartDate: new Date(dto.plannedStartDate),
              plannedEndDate: new Date(dto.plannedEndDate),
              jobValue: dto.jobValue,
              costBudget: dto.costBudget,
              description: dto.description,
            },
            select: JOB_DETAIL_SELECT,
          });
        });
      } catch (error) {
        const isUniqueViolation =
          error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
        if (!isUniqueViolation || attempt >= JOB_CODE_CREATE_RETRIES) {
          throw error;
        }
      }
    }
  }

  async update(id: string, dto: UpdateJobDto) {
    const job = await this.prisma.job.findUnique({ where: { id } });
    if (!job) {
      throw new NotFoundException('Job not found');
    }

    const clientId = dto.clientId ?? job.clientId;
    const contractId = dto.contractId === undefined ? job.contractId : dto.contractId;
    const purchaseOrderId =
      dto.purchaseOrderId === undefined ? job.purchaseOrderId : dto.purchaseOrderId;
    await this.validateRelations(clientId, contractId ?? undefined, purchaseOrderId ?? undefined);

    const plannedStartDate = dto.plannedStartDate ?? job.plannedStartDate.toISOString();
    const plannedEndDate = dto.plannedEndDate ?? job.plannedEndDate.toISOString();
    this.validateDates(plannedStartDate, plannedEndDate);

    return this.prisma.job.update({
      where: { id },
      data: {
        title: dto.title,
        clientId: dto.clientId,
        ...(dto.contractId !== undefined ? { contractId: dto.contractId } : {}),
        ...(dto.purchaseOrderId !== undefined ? { purchaseOrderId: dto.purchaseOrderId } : {}),
        serviceType: dto.serviceType,
        location: dto.location,
        region: dto.region,
        ...(dto.plannedStartDate ? { plannedStartDate: new Date(dto.plannedStartDate) } : {}),
        ...(dto.plannedEndDate ? { plannedEndDate: new Date(dto.plannedEndDate) } : {}),
        jobValue: dto.jobValue,
        costBudget: dto.costBudget,
        description: dto.description,
      },
      select: JOB_DETAIL_SELECT,
    });
  }

  async remove(id: string) {
    const job = await this.prisma.job.findUnique({ where: { id }, select: { status: true } });
    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (job.status !== JobStatus.DRAFT && job.status !== JobStatus.CANCELLED) {
      throw new ConflictException('Only DRAFT or CANCELLED jobs can be deleted');
    }

    await this.prisma.job.delete({ where: { id } });
    return { success: true };
  }

  // --- Helpers ----------------------------------------------------------------

  private validateDates(plannedStartDate: string, plannedEndDate: string) {
    if (new Date(plannedEndDate) <= new Date(plannedStartDate)) {
      throw new BadRequestException('plannedEndDate must be after plannedStartDate');
    }
  }

  private async validateRelations(clientId: string, contractId?: string, purchaseOrderId?: string) {
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

    if (purchaseOrderId) {
      const po = await this.prisma.purchaseOrder.findUnique({
        where: { id: purchaseOrderId },
        select: { clientId: true, contractId: true },
      });
      if (!po) {
        throw new BadRequestException('Invalid purchaseOrderId');
      }
      if (po.clientId !== clientId) {
        throw new BadRequestException('Purchase order does not belong to the selected client');
      }
      if (contractId && po.contractId && po.contractId !== contractId) {
        throw new BadRequestException('Purchase order belongs to a different contract');
      }
    }
  }
}
