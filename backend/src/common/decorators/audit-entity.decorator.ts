import { SetMetadata } from '@nestjs/common';

export const AUDIT_ENTITY_KEY = 'auditEntity';

export interface AuditEntityOptions {
  /** Logical entity name stored on the audit log row, e.g. "User", "Job" */
  entityType: string;
  /** Name of the Prisma delegate on PrismaService, e.g. "user", "job" — used to fetch the "before" state */
  prismaModel?: string;
  /** Route param name holding the entity id (default: "id") */
  idParam?: string;
}

/**
 * Marks a controller route as auditable. The global AuditLogInterceptor logs
 * CREATE/UPDATE/DELETE entries (with before/after snapshots when prismaModel
 * is provided) for POST/PATCH/PUT/DELETE requests on decorated routes.
 */
export const AuditEntity = (options: AuditEntityOptions) => SetMetadata(AUDIT_ENTITY_KEY, options);
