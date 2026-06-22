import { Injectable } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { paginate } from '../common/helpers/pagination.helper';

export interface RecordAuditLogParams {
  userId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string | null;
  comment?: string | null;
}

export interface AuditLogQuery extends PaginationQueryDto {
  entityType?: string;
  entityId?: string;
  action?: AuditAction;
  userId?: string;
}

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async record(params: RecordAuditLogParams) {
    return this.prisma.auditLog.create({
      data: {
        userId: params.userId ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        oldValue: (params.oldValue ?? null) as Prisma.InputJsonValue,
        newValue: (params.newValue ?? null) as Prisma.InputJsonValue,
        ipAddress: params.ipAddress ?? null,
        comment: params.comment ?? null,
      },
    });
  }

  async findAll(query: AuditLogQuery) {
    const where: Prisma.AuditLogWhereInput = {
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
    };

    return paginate(this.prisma.auditLog, query, {
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
  }
}
