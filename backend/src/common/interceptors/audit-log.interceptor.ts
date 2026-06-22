import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuditAction } from '@prisma/client';
import { Observable, tap } from 'rxjs';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AUDIT_ENTITY_KEY, AuditEntityOptions } from '../decorators/audit-entity.decorator';
import { AuthenticatedUser } from '../types/authenticated-user.interface';

const METHOD_TO_ACTION: Record<string, AuditAction> = {
  POST: AuditAction.CREATE,
  PUT: AuditAction.UPDATE,
  PATCH: AuditAction.UPDATE,
  DELETE: AuditAction.DELETE,
};

/** Field names stripped from audit log snapshots regardless of entity type. */
const SENSITIVE_FIELDS = ['passwordHash', 'tokenHash'];

function sanitize(value: unknown): unknown {
  if (!value || typeof value !== 'object') {
    return value;
  }
  const clone: Record<string, unknown> = { ...(value as Record<string, unknown>) };
  for (const field of SENSITIVE_FIELDS) {
    delete clone[field];
  }
  return clone;
}

/**
 * Global interceptor: for routes decorated with @AuditEntity(...), records a
 * CREATE/UPDATE/DELETE audit log entry (with before/after snapshots when a
 * Prisma model is configured) after a successful POST/PUT/PATCH/DELETE.
 *
 * Business-meaningful events (status changes, overrides, login/logout) are
 * NOT covered here — services call AuditLogService.record() directly for those.
 */
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly auditLogService: AuditLogService,
    private readonly prisma: PrismaService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const options = this.reflector.getAllAndOverride<AuditEntityOptions | undefined>(
      AUDIT_ENTITY_KEY,
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest();
    const action = METHOD_TO_ACTION[request.method as string];

    if (!options || !action) {
      return next.handle();
    }

    const idParam = options.idParam ?? 'id';
    const entityIdFromParams: string | undefined = request.params?.[idParam];

    let oldValue: unknown = null;
    if (action !== AuditAction.CREATE && options.prismaModel && entityIdFromParams) {
      oldValue = await (this.prisma as any)[options.prismaModel]
        .findUnique({ where: { id: entityIdFromParams } })
        .catch(() => null);
    }

    const user: AuthenticatedUser | undefined = request.user;

    return next.handle().pipe(
      tap({
        next: (responseBody: any) => {
          const entityId = entityIdFromParams ?? responseBody?.id;
          if (!entityId) {
            return;
          }
          this.auditLogService
            .record({
              userId: user?.id ?? null,
              action,
              entityType: options.entityType,
              entityId: String(entityId),
              oldValue: sanitize(oldValue),
              newValue: action === AuditAction.DELETE ? null : sanitize(responseBody),
              ipAddress: request.ip,
            })
            .catch((err) => this.logger.error('Failed to write audit log', err));
        },
      }),
    );
  }
}
